// ── Position-based stat groupings & OVR calculation ──────────────────────────
// Used by: Quick Add Player, Player Editor, server-side recomputeOverall,
//          seed.ts, and all API routes that touch player stats.
//
// Formula:
//   OVR = (Main1 * 0.40) + (Main2 * 0.35) + (SecondaryAvg * 0.20) + (OtherAvg * 0.05)

export const ALL_STAT_KEYS = [
  'attack', 'defense', 'serve', 'block', 'receive', 'setting',
  'precision', 'flair', 'digging', 'positioning', 'ball_control', 'technique', 'playmaking', 'spin',
  'speed', 'agility', 'strength', 'endurance', 'vertical', 'flexibility', 'torque', 'balance',
  'leadership', 'teamwork', 'concentration', 'pressure', 'consistency', 'vision', 'game_iq', 'intimidation',
] as const;

export type StatKey = typeof ALL_STAT_KEYS[number];

export interface PositionGrouping {
  main1: StatKey;
  main2: StatKey;
  secondary: StatKey[];   // exactly 6
}

export const POSITION_GROUPINGS: Record<string, PositionGrouping> = {
  'Middle Blocker': {
    main1: 'block',
    main2: 'attack',
    secondary: ['defense', 'vertical', 'positioning', 'precision', 'strength', 'endurance'],
  },
  'Setter': {
    main1: 'setting',
    main2: 'playmaking',
    secondary: ['game_iq', 'vision', 'technique', 'teamwork', 'consistency', 'positioning'],
  },
  'Libero': {
    main1: 'receive',
    main2: 'digging',
    secondary: ['balance', 'flexibility', 'agility', 'speed', 'concentration', 'pressure'],
  },
  'Outside Hitter': {
    main1: 'attack',
    main2: 'defense',
    secondary: ['strength', 'block', 'serve', 'receive', 'consistency', 'positioning'],
  },
  'Opposite Hitter': {
    main1: 'attack',
    main2: 'defense',
    secondary: ['strength', 'block', 'serve', 'receive', 'consistency', 'positioning'],
  },
};

/** Derive the "Other" stats (the 22 that are neither main nor secondary). */
export function getOtherStats(grouping: PositionGrouping): StatKey[] {
  const used = new Set<StatKey>([grouping.main1, grouping.main2, ...grouping.secondary]);
  return ALL_STAT_KEYS.filter(k => !used.has(k)) as StatKey[];
}

/**
 * Calculate OVR from a stats record and position.
 *
 * OVR = Main1 * 0.40 + Main2 * 0.35 + avg(Secondary) * 0.20 + avg(Other) * 0.05
 * Clamped to [1, 99], rounded to nearest integer.
 */
export function calculateOverall(stats: Record<string, number>, position: string): number {
  const grouping = POSITION_GROUPINGS[position];
  if (!grouping) {
    // Fallback: simple average of all 30 stats
    const sum = ALL_STAT_KEYS.reduce((acc, k) => acc + (stats[k] ?? 50), 0);
    return Math.max(1, Math.min(99, Math.round(sum / ALL_STAT_KEYS.length)));
  }

  const main1 = stats[grouping.main1] ?? 50;
  const main2 = stats[grouping.main2] ?? 50;

  const secSum = grouping.secondary.reduce((acc, k) => acc + (stats[k] ?? 50), 0);
  const secAvg = secSum / grouping.secondary.length;

  const otherKeys = getOtherStats(grouping);
  const otherSum = otherKeys.reduce((acc, k) => acc + (stats[k] ?? 50), 0);
  const otherAvg = otherSum / otherKeys.length;

  const raw = main1 * 0.40 + main2 * 0.35 + secAvg * 0.20 + otherAvg * 0.05;
  return Math.max(1, Math.min(99, Math.round(raw)));
}
