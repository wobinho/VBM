import { getDb } from '@/lib/db';
import { getPlayers, updatePlayer } from '@/lib/db/queries';
import { TRAINING_PLANS, type TrainingPlanKey } from './plans';
import { stackedStatMultiplier, STAT_TO_FACILITIES } from './facilities';

/** Daily base gain on a *targeted* stat before age/resistance/facility/coach modifiers. */
const BASE_RATE = 0.025;

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

function getPotentialCapFactor(statValue: number, potential: number): number {
  if (statValue >= potential) return 0;
  const diff = potential - statValue;
  if (diff <= 5) return 0.20;
  if (diff <= 10) return 0.45;
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

    /* ── Targeted stats: full training rate ─────────────────────────── */
    for (const statKey of plan.stats) {
      const currentStat = (player as any)[statKey];
      if (currentStat === undefined || currentStat === null) continue;

      const facilityMult = stackedStatMultiplier(statKey, facilityLevels);
      const coachQuality = coachMap.get(planKey) || 0;
      const coachMult = coachQuality > 0 ? 1 + getCoachBonus(coachQuality) : 1.0;
      const ageMult = getAgeMultiplier(player.age);
      const resistance = getStatResistance(currentStat);
      const capFactor = getPotentialCapFactor(currentStat, player.potential);

      const dailyGain = BASE_RATE * ageMult * resistance * capFactor * facilityMult * coachMult;
      if (dailyGain <= 0) continue;

      statProgress[statKey] = (statProgress[statKey] || 0) + dailyGain;
      if (statProgress[statKey] >= 1.0) {
        const newValue = Math.min(currentStat + 1, player.potential);
        if (newValue > currentStat) {
          updatePlayer(playerId, { [statKey]: newValue });
          gains.push({
            playerId, playerName: player.player_name, statKey,
            oldValue: currentStat, newValue, planKey, teamId,
          });
          db.prepare(`
            INSERT INTO training_stat_gains (player_id, team_id, stat_key, old_value, new_value, plan_key, gained_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(playerId, teamId, statKey, currentStat, newValue, planKey, date);
          (player as any)[statKey] = newValue;
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

      const facilityMult = stackedStatMultiplier(statKey, facilityLevels);
      const ageMult = getAgePassiveMultiplier(player.age);
      const capFactor = getPotentialCapFactor(currentStat, player.potential);

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
        const target = Math.max(1, Math.min(currentStat + change, player.potential || 100));
        if (target !== currentStat) {
          updatePlayer(playerId, { [statKey]: target });
          (player as any)[statKey] = target;
          statProgress[statKey] -= change;
        } else {
          statProgress[statKey] = 0;
        }
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
