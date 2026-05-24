import { getDb } from '@/lib/db';
import { getPlayers, updatePlayer } from '@/lib/db/queries';
import { TRAINING_PLANS, type TrainingPlanKey } from './plans';
import { stackedStatMultiplier, STAT_TO_FACILITIES } from './facilities';
import { POSITION_GROUPINGS, potentialKeyFor, type StatKey } from '@/lib/overall';

/** Daily base gain on a *targeted* stat before age/resistance/facility/coach modifiers. */
const BASE_RATE = 0.012;

/**
 * Position-relevance multiplier. All 4 plan stats develop at a visible rate so
 * users see progress on every targeted stat. Overall growth is still gated by
 * the OVR formula's natural weighting (main1 40% / main2 35% / secondary 20% /
 * other 5%), so on-position plans naturally yield bigger OVR gains without
 * needing to suppress raw stat growth on off-position stats.
 */
function getPositionRelevance(statKey: string, position: string): number {
  const g = POSITION_GROUPINGS[position];
  if (!g) return 1.0;
  if (statKey === g.main1 || statKey === g.main2) return 1.2;
  if (g.secondary.includes(statKey as never)) return 1.1;
  return 1.0;
}

/** Passive growth on *non-targeted* stats while a player is in training. */
const PASSIVE_RATE = 0.0025;

/** Physical stats — decline gently past prime when not actively trained. */
const PHYSICAL_STATS = new Set([
  'speed', 'agility', 'strength', 'torque', 'vertical',
  'flexibility', 'endurance', 'balance',
]);

/** Full list of trainable stats (canonical order). */
const ALL_STATS = Object.keys(STAT_TO_FACILITIES);

interface FacilityLevels { [key: string]: number; }

function getAgeMultiplier(age: number): number {
  if (age <= 20) return 1.60;
  if (age <= 23) return 1.25;
  if (age <= 26) return 1.00;
  if (age <= 29) return 0.80;
  if (age <= 32) return 0.55;
  if (age <= 35) return 0.30;
  return 0.10;
}

function getStatResistance(statValue: number): number {
  if (statValue <= 50) return 1.10;
  if (statValue <= 65) return 0.90;
  if (statValue <= 75) return 0.70;
  if (statValue <= 84) return 0.50;
  return 0.30;
}

/**
 * Slow training as a stat approaches its own per-stat potential. Each of the
 * 30 stats has its own ceiling now, so the cap factor is computed per stat,
 * not against the overall. When the stat reaches its ceiling, growth stops.
 */
function getPotentialCapFactor(currentStat: number, statPotential: number): number {
  if (currentStat >= statPotential) return 0;
  const diff = statPotential - currentStat;
  if (diff <= 2) return 0.20;
  if (diff <= 5) return 0.45;
  return 1.00;
}

function getCoachBonus(coachQuality: number): number {
  return (coachQuality / 100) * 1.0;
}

function getAgePassiveMultiplier(age: number): number {
  if (age <= 23) return 1.4;
  if (age <= 29) return 0.8;
  if (age <= 32) return 0.5;
  if (age <= 35) return 0.8;
  if (age <= 38) return 1.4;
  return 1.8;
}

export interface TrainingGainEvent {
  playerId: number;
  playerName: string;
  statKey: string;
  oldValue: number;
  newValue: number;
  planKey: string;
  teamId: number;
}

export function tickTraining(teamId: number, date: string): TrainingGainEvent[] {
  const db = getDb();
  const gains: TrainingGainEvent[] = [];

  // Per-stat potentials live on the player row (one column per stat). We
  // pull them via SELECT p.* so every `{stat}_potential` comes along — the
  // per-stat cap check reads from p[`${stat}_potential`].
  const assignments = db.prepare(`
    SELECT ta.*, p.*, p.id as player_id
    FROM training_assignments ta
    JOIN players p ON ta.player_id = p.id
    WHERE p.team_id = ?
  `).all(teamId) as any[];
  if (assignments.length === 0) return gains;

  const facilities = db.prepare(`
    SELECT facility_type, level
    FROM training_facilities
    WHERE team_id = ?
  `).all(teamId) as any[];
  const facilityLevels: FacilityLevels = {};
  for (const fac of facilities) facilityLevels[fac.facility_type] = fac.level;

  const coaches = db.prepare(`
    SELECT specialty, quality
    FROM training_coaches
    WHERE team_id = ?
  `).all(teamId) as any[];
  const coachMap = new Map(coaches.map(c => [c.specialty, c.quality]));

  const allPlayers = getPlayers(teamId) as any[];
  const playerMap = new Map(allPlayers.map(p => [p.id, p]));

  for (const assignment of assignments) {
    const playerId = assignment.player_id;
    const player = playerMap.get(playerId);
    if (!player) continue;

    const planKey = assignment.plan_key as TrainingPlanKey;
    const plan = TRAINING_PLANS[planKey];
    if (!plan) continue;

    const statProgress = JSON.parse(assignment.stat_progress || '{}') as Record<string, number>;
    const trainedStats = new Set(plan.stats as unknown as string[]);

    // Helper to read a per-stat potential off the joined player row. Falls
    // back to 99 if the column is somehow missing (legacy DB pre-migration).
    const statPotentialOf = (stat: string): number => {
      const v = (player as any)[potentialKeyFor(stat as StatKey)];
      return typeof v === 'number' ? v : 99;
    };

    /* ── Targeted stats: full training rate, capped per-stat ─────────── */
    for (const statKey of plan.stats) {
      const currentStat = (player as any)[statKey];
      if (currentStat === undefined || currentStat === null) continue;

      const statPot = statPotentialOf(statKey);
      const facilityMult = stackedStatMultiplier(statKey, facilityLevels);
      const coachQuality = coachMap.get(planKey) || 0;
      const coachMult = coachQuality > 0 ? 1 + getCoachBonus(coachQuality) : 1.0;
      const ageMult = getAgeMultiplier(player.age);
      const resistance = getStatResistance(currentStat);
      const capFactor = getPotentialCapFactor(currentStat, statPot);
      const positionMult = getPositionRelevance(statKey, player.position);

      const dailyGain = BASE_RATE * ageMult * resistance * capFactor * facilityMult * coachMult * positionMult;
      if (dailyGain <= 0) continue;
      if (currentStat >= 100) continue;

      statProgress[statKey] = (statProgress[statKey] || 0) + dailyGain;
      if (statProgress[statKey] >= 1.0) {
        const candidate = Math.min(currentStat + 1, 100);
        // Per-stat cap: never push a stat above its own potential.
        if (candidate > statPot) {
          statProgress[statKey] = 0;
          continue;
        }
        if (candidate > currentStat) {
          updatePlayer(playerId, { [statKey]: candidate });
          gains.push({
            playerId, playerName: player.player_name, statKey,
            oldValue: currentStat, newValue: candidate, planKey, teamId,
          });
          db.prepare(`
            INSERT INTO training_stat_gains (player_id, team_id, stat_key, old_value, new_value, plan_key, gained_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(playerId, teamId, statKey, currentStat, candidate, planKey, date);
          (player as any)[statKey] = candidate;
          statProgress[statKey] -= 1.0;
        } else {
          statProgress[statKey] = 0;
        }
      }
    }

    /* ── Passive growth on non-targeted stats ───────────────────────── */
    for (const statKey of ALL_STATS) {
      if (trainedStats.has(statKey)) continue;
      const currentStat = (player as any)[statKey];
      if (currentStat === undefined || currentStat === null) continue;

      const statPot = statPotentialOf(statKey);
      const facilityMult = stackedStatMultiplier(statKey, facilityLevels);
      const ageMult = getAgePassiveMultiplier(player.age);
      const capFactor = getPotentialCapFactor(currentStat, statPot);

      let passiveDrift: number;
      if (player.age <= 29) {
        passiveDrift = PASSIVE_RATE * ageMult * capFactor * facilityMult;
      } else if (PHYSICAL_STATS.has(statKey)) {
        passiveDrift = -PASSIVE_RATE * ageMult * 0.5;
      } else {
        passiveDrift = PASSIVE_RATE * 0.3 * capFactor * facilityMult;
      }
      // Even if positive drift is gated by per-stat cap, decay can still pull
      // a stat back toward a lowered potential.
      if (passiveDrift === 0 && currentStat <= statPot) continue;
      // If the per-stat potential dropped below the current stat (after the
      // season recalc lowered the ceiling), pull the stat one tick per tick
      // toward the new ceiling.
      if (currentStat > statPot) {
        passiveDrift = Math.min(passiveDrift, -PASSIVE_RATE);
      }

      statProgress[statKey] = (statProgress[statKey] || 0) + passiveDrift;
      if (Math.abs(statProgress[statKey]) >= 1.0) {
        const change = Math.trunc(statProgress[statKey]);
        const target = Math.max(1, Math.min(currentStat + change, 100));
        if (target === currentStat) {
          statProgress[statKey] = 0;
          continue;
        }
        // Per-stat cap: positive drift can't exceed the stat's own potential.
        if (target > currentStat && target > statPot) {
          statProgress[statKey] = 0;
          continue;
        }
        updatePlayer(playerId, { [statKey]: target });
        (player as any)[statKey] = target;
        statProgress[statKey] -= change;
      }
    }

    db.prepare(`
      UPDATE training_assignments
      SET stat_progress = ?, updated_at = ?
      WHERE player_id = ?
    `).run(JSON.stringify(statProgress), date, playerId);
  }

  return gains;
}
