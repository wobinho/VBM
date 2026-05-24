import { type TrainingPlanKey, getPlanByKey } from './plans';
import { calculateOverall, POSITION_GROUPINGS, potentialKeyFor, type StatKey } from '@/lib/overall';
import { stackedStatMultiplier, STAT_TO_FACILITIES } from './facilities';

/** Mirror of the engine's position-relevance multiplier — must stay in sync. */
function getPositionRelevance(statKey: string, position: string): number {
  const g = POSITION_GROUPINGS[position];
  if (!g) return 1.0;
  if (statKey === g.main1 || statKey === g.main2) return 1.2;
  if (g.secondary.includes(statKey as never)) return 1.1;
  return 1.0;
}

const BASE_RATE = 0.012;
const PASSIVE_RATE = 0.0025;

const PHYSICAL_STATS = new Set([
  'speed', 'agility', 'strength', 'torque', 'vertical',
  'flexibility', 'endurance', 'balance',
]);

const ALL_STATS = Object.keys(STAT_TO_FACILITIES);

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
 * Per-stat cap factor — mirrors engine.ts. A stat slows as it approaches its
 * own potential ceiling and stops entirely when it reaches it.
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

/** Read a stat's per-stat potential off the player row. */
function statPotentialOf(player: Record<string, unknown>, stat: string): number {
  const v = player[potentialKeyFor(stat as StatKey)];
  return typeof v === 'number' ? v : 99;
}

/** Daily gain (real, not integer) on a targeted stat given current conditions. */
export function dailyGainForTrainedStat(
  statValue: number,
  statPotential: number,
  age: number,
  statKey: string,
  facilityLevels: Record<string, number>,
  coachQuality: number = 0,
  position: string = '',
): number {
  if (statValue >= statPotential) return 0;
  if (statValue >= 100) return 0;
  const facilityMult = stackedStatMultiplier(statKey, facilityLevels);
  const coachMult = coachQuality > 0 ? 1 + getCoachBonus(coachQuality) : 1.0;
  const ageMult = getAgeMultiplier(age);
  const resistance = getStatResistance(statValue);
  const capFactor = getPotentialCapFactor(statValue, statPotential);
  const positionMult = position ? getPositionRelevance(statKey, position) : 1.0;
  return BASE_RATE * ageMult * resistance * capFactor * facilityMult * coachMult * positionMult;
}

/** Daily drift (real) on a passive (non-targeted) stat. */
export function dailyDriftForPassiveStat(
  statValue: number,
  statPotential: number,
  age: number,
  statKey: string,
  facilityLevels: Record<string, number>,
): number {
  const facilityMult = stackedStatMultiplier(statKey, facilityLevels);
  const ageMult = getAgePassiveMultiplier(age);
  const capFactor = getPotentialCapFactor(statValue, statPotential);
  // Decay toward a lowered ceiling — if current stat exceeds its potential,
  // pull it down rather than letting cap factor zero out the drift.
  if (statValue > statPotential) return -PASSIVE_RATE;
  if (age <= 29) return PASSIVE_RATE * ageMult * capFactor * facilityMult;
  if (PHYSICAL_STATS.has(statKey)) return -PASSIVE_RATE * ageMult * 0.5;
  return PASSIVE_RATE * 0.3 * capFactor * facilityMult;
}

export function daysToNextPoint(
  statValue: number,
  statPotential: number,
  age: number,
  statKey: string,
  facilityLevels: Record<string, number>,
  coachQuality: number = 0,
  position: string = '',
): number | null {
  if (statValue >= statPotential) return null;
  const g = dailyGainForTrainedStat(statValue, statPotential, age, statKey, facilityLevels, coachQuality, position);
  if (g <= 0) return null;
  return Math.ceil(1 / g);
}

export interface StatProjection {
  statKey: string;
  current: number;
  projected: number;
  potential: number;
  delta: number;
  dailyGain: number;
  isTrained: boolean;
}

/**
 * Project every stat forward by `days` days under current training. Targeted
 * stats use full gain; non-targeted use passive drift. Returns per-stat
 * results and the simulated overall.
 */
export function projectSeason(
  player: any,
  planKey: TrainingPlanKey | null,
  facilityLevels: Record<string, number>,
  coachMap: Map<string, number>,
  days: number = 240,
): { stats: StatProjection[]; projectedOverall: number; deltaOverall: number; currentOverall: number } {
  const plan = planKey ? getPlanByKey(planKey) : null;
  const trained = new Set<string>(plan?.stats ?? []);
  const coachQuality = planKey ? (coachMap.get(planKey) || 0) : 0;

  const sim: Record<string, number> = {};
  for (const s of ALL_STATS) sim[s] = player[s] ?? 50;

  const currentOverall = calculateOverall(player, player.position);

  // Simulate day-by-day at low resolution. Each day adds float drift; we
  // floor at the end to mirror tickTraining's integer-stat semantics.
  const accum: Record<string, number> = {};
  for (const s of ALL_STATS) accum[s] = 0;

  for (let d = 0; d < days; d++) {
    // Targeted stats
    if (plan) {
      for (const s of plan.stats as string[]) {
        const statPot = statPotentialOf(player, s);
        const g = dailyGainForTrainedStat(sim[s], statPot, player.age, s, facilityLevels, coachQuality, player.position);
        accum[s] += g;
        while (accum[s] >= 1 && sim[s] < 100) {
          const next = sim[s] + 1;
          if (next > statPot) { accum[s] = 0; break; }
          sim[s] = next;
          accum[s] -= 1;
        }
      }
    }
    // Passive stats
    for (const s of ALL_STATS) {
      if (trained.has(s)) continue;
      const statPot = statPotentialOf(player, s);
      const drift = dailyDriftForPassiveStat(sim[s], statPot, player.age, s, facilityLevels);
      accum[s] += drift;
      while (Math.abs(accum[s]) >= 1) {
        const step = accum[s] >= 1 ? 1 : -1;
        const target = Math.max(1, Math.min(sim[s] + step, 100));
        if (target === sim[s]) { accum[s] = 0; break; }
        if (step > 0 && target > statPot) { accum[s] = 0; break; }
        sim[s] = target;
        accum[s] -= step;
      }
    }
  }

  const stats: StatProjection[] = ALL_STATS.map(s => {
    const statPot = statPotentialOf(player, s);
    return {
      statKey: s,
      current: player[s] ?? 50,
      projected: sim[s],
      potential: statPot,
      delta: sim[s] - (player[s] ?? 50),
      dailyGain: trained.has(s)
        ? dailyGainForTrainedStat(player[s] ?? 50, statPot, player.age, s, facilityLevels, coachQuality, player.position)
        : dailyDriftForPassiveStat(player[s] ?? 50, statPot, player.age, s, facilityLevels),
      isTrained: trained.has(s),
    };
  });

  const projectedPlayer = { ...player, ...sim };
  const projectedOverall = calculateOverall(projectedPlayer, player.position);

  return {
    stats,
    projectedOverall,
    deltaOverall: projectedOverall - currentOverall,
    currentOverall,
  };
}

export function estimateDaysToNextOvr(
  player: any,
  planKey: TrainingPlanKey,
  facilityLevels: Record<string, number>,
  coachMap: Map<string, number>,
): number | null {
  const plan = getPlanByKey(planKey);
  if (!plan) return null;
  const currentOvr = calculateOverall(player, player.position);
  if (currentOvr >= 99) return null;

  const maxDays = 365;
  const coachQuality = coachMap.get(planKey) || 0;
  const sim: Record<string, number> = {};
  for (const s of ALL_STATS) sim[s] = player[s] ?? 50;
  const accum: Record<string, number> = {};
  for (const s of ALL_STATS) accum[s] = 0;

  for (let day = 1; day <= maxDays; day++) {
    for (const s of plan.stats as string[]) {
      const statPot = statPotentialOf(player, s);
      const g = dailyGainForTrainedStat(sim[s], statPot, player.age, s, facilityLevels, coachQuality, player.position);
      accum[s] += g;
      while (accum[s] >= 1 && sim[s] < 100) {
        const next = sim[s] + 1;
        if (next > statPot) { accum[s] = 0; break; }
        sim[s] = next;
        accum[s] -= 1;
      }
    }
    const newOvr = calculateOverall({ ...player, ...sim }, player.position);
    if (newOvr > currentOvr) return day;
  }
  return null;
}
