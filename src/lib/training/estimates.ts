import { TRAINING_PLANS, type TrainingPlanKey, getPlanByKey } from './plans';
import { calculateOverall } from '@/lib/overall';
import { stackedStatMultiplier, STAT_TO_FACILITIES } from './facilities';

const BASE_RATE = 0.025;
const PASSIVE_RATE = 0.005;

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

/** Daily gain (real, not integer) on a targeted stat given current conditions. */
export function dailyGainForTrainedStat(
  statValue: number,
  potential: number,
  age: number,
  statKey: string,
  facilityLevels: Record<string, number>,
  coachQuality: number = 0,
): number {
  if (statValue >= potential) return 0;
  const facilityMult = stackedStatMultiplier(statKey, facilityLevels);
  const coachMult = coachQuality > 0 ? 1 + getCoachBonus(coachQuality) : 1.0;
  const ageMult = getAgeMultiplier(age);
  const resistance = getStatResistance(statValue);
  const capFactor = getPotentialCapFactor(statValue, potential);
  return BASE_RATE * ageMult * resistance * capFactor * facilityMult * coachMult;
}

/** Daily drift (real) on a passive (non-targeted) stat. */
export function dailyDriftForPassiveStat(
  statValue: number,
  potential: number,
  age: number,
  statKey: string,
  facilityLevels: Record<string, number>,
): number {
  const facilityMult = stackedStatMultiplier(statKey, facilityLevels);
  const ageMult = getAgePassiveMultiplier(age);
  const capFactor = getPotentialCapFactor(statValue, potential);
  if (age <= 29) return PASSIVE_RATE * ageMult * capFactor * facilityMult;
  if (PHYSICAL_STATS.has(statKey)) return -PASSIVE_RATE * ageMult * 0.5;
  return PASSIVE_RATE * 0.3 * capFactor * facilityMult;
}

export function daysToNextPoint(
  statValue: number,
  potential: number,
  age: number,
  statKey: string,
  facilityLevels: Record<string, number>,
  coachQuality: number = 0,
): number | null {
  if (statValue >= potential) return null;
  const g = dailyGainForTrainedStat(statValue, potential, age, statKey, facilityLevels, coachQuality);
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
        const g = dailyGainForTrainedStat(sim[s], player.potential, player.age, s, facilityLevels, coachQuality);
        accum[s] += g;
        while (accum[s] >= 1 && sim[s] < player.potential) {
          sim[s] = Math.min(sim[s] + 1, player.potential);
          accum[s] -= 1;
        }
      }
    }
    // Passive stats
    for (const s of ALL_STATS) {
      if (trained.has(s)) continue;
      const drift = dailyDriftForPassiveStat(sim[s], player.potential, player.age, s, facilityLevels);
      accum[s] += drift;
      while (Math.abs(accum[s]) >= 1) {
        const step = accum[s] >= 1 ? 1 : -1;
        const target = Math.max(1, Math.min(sim[s] + step, player.potential || 100));
        if (target === sim[s]) { accum[s] = 0; break; }
        sim[s] = target;
        accum[s] -= step;
      }
    }
  }

  const stats: StatProjection[] = ALL_STATS.map(s => ({
    statKey: s,
    current: player[s] ?? 50,
    projected: sim[s],
    potential: player.potential,
    delta: sim[s] - (player[s] ?? 50),
    dailyGain: trained.has(s)
      ? dailyGainForTrainedStat(player[s] ?? 50, player.potential, player.age, s, facilityLevels, coachQuality)
      : dailyDriftForPassiveStat(player[s] ?? 50, player.potential, player.age, s, facilityLevels),
    isTrained: trained.has(s),
  }));

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
      const g = dailyGainForTrainedStat(sim[s], player.potential, player.age, s, facilityLevels, coachQuality);
      accum[s] += g;
      while (accum[s] >= 1 && sim[s] < player.potential) {
        sim[s] = Math.min(sim[s] + 1, player.potential);
        accum[s] -= 1;
      }
    }
    const newOvr = calculateOverall({ ...player, ...sim }, player.position);
    if (newOvr > currentOvr) return day;
  }
  return null;
}
