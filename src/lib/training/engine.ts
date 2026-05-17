import { getDb } from '@/lib/db';
import { getPlayers, updatePlayer } from '@/lib/db/queries';
import { TRAINING_PLANS, type TrainingPlanKey } from './plans';
import { stackedStatMultiplier, STAT_TO_FACILITIES } from './facilities';
import { POSITION_GROUPINGS, calculateOverall } from '@/lib/overall';

/** Daily base gain on a *targeted* stat before age/resistance/facility/coach modifiers. */
const BASE_RATE = 0.025;

/**
 * Position-relevance multiplier. Training a stat that drives the player's role
 * (main1/main2 of their position) compounds far faster than off-position work.
 * Calibrated so a season of on-position training nets ~+5–6 OVR, while
 * mis-aligned plans only drift ~+1–2 OVR.
 */
function getPositionRelevance(statKey: string, position: string): number {
  const g = POSITION_GROUPINGS[position];
  if (!g) return 1.0;
  if (statKey === g.main1 || statKey === g.main2) return 4.0;
  if (g.secondary.includes(statKey as never)) return 2.0;
  return 0.3;
}

/** Passive growth on *non-targeted* stats while a player is in training. */
const PASSIVE_RATE = 0.005;

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
 * Slow training as the player's *overall* approaches their potential. Once the
 * uncapped overall would reach potential, growth stops entirely. The cap is on
 * overall — individual stats can still climb up to 100, they just don't push
 * the overall past the player's ceiling.
 */
function getPotentialCapFactor(currentOverall: number, potential: number): number {
  if (currentOverall >= potential) return 0;
  const diff = potential - currentOverall;
  if (diff <= 2) return 0.20;
  if (diff <= 5) return 0.45;
  return 1.00;
}

function getCoachBonus(coachQuality: number): number {
  return (coachQuality / 100) * 0.7;
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

  const assignments = db.prepare(`
    SELECT ta.*, p.id as player_id, p.age, p.player_name, p.potential
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

    const potential = player.potential ?? 99;
    const currentOverall = calculateOverall(player as any, player.position);

    /* ── Targeted stats: full training rate ─────────────────────────── */
    for (const statKey of plan.stats) {
      const currentStat = (player as any)[statKey];
      if (currentStat === undefined || currentStat === null) continue;

      const facilityMult = stackedStatMultiplier(statKey, facilityLevels);
      const coachQuality = coachMap.get(planKey) || 0;
      const coachMult = coachQuality > 0 ? 1 + getCoachBonus(coachQuality) : 1.0;
      const ageMult = getAgeMultiplier(player.age);
      const resistance = getStatResistance(currentStat);
      const capFactor = getPotentialCapFactor(currentOverall, potential);
      const positionMult = getPositionRelevance(statKey, player.position);

      const dailyGain = BASE_RATE * ageMult * resistance * capFactor * facilityMult * coachMult * positionMult;
      if (dailyGain <= 0) continue;
      if (currentStat >= 100) continue;

      statProgress[statKey] = (statProgress[statKey] || 0) + dailyGain;
      if (statProgress[statKey] >= 1.0) {
        const candidate = Math.min(currentStat + 1, 100);
        const candidateOverall = calculateOverall({ ...(player as any), [statKey]: candidate }, player.position);
        // Block the stat tick if it would push overall past potential.
        if (candidateOverall > potential && candidateOverall > currentOverall) {
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
    const overallAfterTargeted = calculateOverall(player as any, player.position);
    for (const statKey of ALL_STATS) {
      if (trainedStats.has(statKey)) continue;
      const currentStat = (player as any)[statKey];
      if (currentStat === undefined || currentStat === null) continue;

      const facilityMult = stackedStatMultiplier(statKey, facilityLevels);
      const ageMult = getAgePassiveMultiplier(player.age);
      const capFactor = getPotentialCapFactor(overallAfterTargeted, potential);

      let passiveDrift: number;
      if (player.age <= 29) {
        passiveDrift = PASSIVE_RATE * ageMult * capFactor * facilityMult;
      } else if (PHYSICAL_STATS.has(statKey)) {
        passiveDrift = -PASSIVE_RATE * ageMult * 0.5;
      } else {
        passiveDrift = PASSIVE_RATE * 0.3 * capFactor * facilityMult;
      }
      if (passiveDrift === 0) continue;

      statProgress[statKey] = (statProgress[statKey] || 0) + passiveDrift;
      if (Math.abs(statProgress[statKey]) >= 1.0) {
        const change = Math.trunc(statProgress[statKey]);
        const target = Math.max(1, Math.min(currentStat + change, 100));
        if (target === currentStat) {
          statProgress[statKey] = 0;
          continue;
        }
        // Positive drift can't push overall past potential. Decline is unrestricted.
        if (target > currentStat) {
          const candidateOverall = calculateOverall({ ...(player as any), [statKey]: target }, player.position);
          if (candidateOverall > potential && candidateOverall > overallAfterTargeted) {
            statProgress[statKey] = 0;
            continue;
          }
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
