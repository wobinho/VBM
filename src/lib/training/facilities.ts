/**
 * Facility catalog — single source of truth for facility metadata,
 * stat coverage, upgrade economy, and multiplier curve.
 *
 * Design rules:
 *   • 16 facilities total
 *   • Every stat appears in exactly 3 facilities (variance kept minimal)
 *   • Levels 0–5; multiplier curve 1.00 → 2.00 in 0.20 steps
 *   • Per-stat boost stacks across facilities with diminishing returns
 *     (best 100%, 2nd 50%, 3rd 25%) to avoid runaway compounding
 */

export type FacilityKey =
  | 'cardio_center'
  | 'weight_room'
  | 'technique_lab'
  | 'tactical_room'
  | 'defense_court'
  | 'attack_court'
  | 'serve_tunnel'
  | 'sports_psychology'
  | 'plyometrics_lab'
  | 'recovery_suite'
  | 'film_room'
  | 'reception_court'
  | 'setter_studio'
  | 'power_court'
  | 'agility_grid'
  | 'mental_lab';

export interface FacilityDef {
  key: FacilityKey;
  name: string;
  short: string;
  /** Stats this facility boosts (5–6 each). */
  stats: string[];
  /** Hex accent for theming. */
  accent: string;
  pattern: 'grid' | 'lines' | 'dots' | 'wave' | 'hex' | 'cross' | 'arc' | 'noise';
  /** Lucide icon name used by the page. */
  icon:
    | 'Heart' | 'Dumbbell' | 'Crosshair' | 'BookOpen'
    | 'Shield' | 'Flame' | 'Target' | 'Brain'
    | 'Zap' | 'Activity' | 'Film' | 'Hand'
    | 'Sparkles' | 'Mountain' | 'Wind' | 'Lightbulb';
  description: string;
}

/**
 * 16 facilities. Each stat is mapped to exactly 3 facilities (verified at end).
 */
export const FACILITY_DEFS: Record<FacilityKey, FacilityDef> = {
  // ── Physical-leaning ──────────────────────────────────────────────
  cardio_center: {
    key: 'cardio_center',
    name: 'Cardio Center',
    short: 'CARDIO',
    stats: ['speed', 'agility', 'endurance', 'flexibility', 'balance'],
    accent: '#ef4444',
    pattern: 'wave',
    icon: 'Heart',
    description: 'Treadmills, rowers, and aerobic conditioning circuits build the engine that runs every rally.',
  },
  weight_room: {
    key: 'weight_room',
    name: 'Weight Room',
    short: 'WEIGHTS',
    stats: ['strength', 'torque', 'vertical', 'endurance', 'positioning'],
    accent: '#fb923c',
    pattern: 'lines',
    icon: 'Dumbbell',
    description: 'Olympic platforms and progressive overload work — pure ceiling for force production.',
  },
  plyometrics_lab: {
    key: 'plyometrics_lab',
    name: 'Plyometrics Lab',
    short: 'PLYO',
    stats: ['vertical', 'agility', 'torque', 'speed', 'block'],
    accent: '#22d3ee',
    pattern: 'arc',
    icon: 'Zap',
    description: 'Box jumps, depth drops, contrast loads. Builds explosive, twitchy athletes.',
  },
  agility_grid: {
    key: 'agility_grid',
    name: 'Agility Grid',
    short: 'AGI',
    stats: ['agility', 'speed', 'balance', 'digging', 'defense', 'receive'],
    accent: '#84cc16',
    pattern: 'cross',
    icon: 'Wind',
    description: 'Reactive cones, change-of-direction drills, fast-feet ladders.',
  },
  recovery_suite: {
    key: 'recovery_suite',
    name: 'Recovery Suite',
    short: 'RECOVERY',
    stats: ['flexibility', 'endurance', 'consistency', 'concentration', 'strength'],
    accent: '#06b6d4',
    pattern: 'dots',
    icon: 'Sparkles',
    description: 'Mobility, sauna, cold plunge. Keeps bodies durable and minds steady.',
  },

  // ── Technical / Skill ─────────────────────────────────────────────
  technique_lab: {
    key: 'technique_lab',
    name: 'Technique Lab',
    short: 'TECHNIQUE',
    stats: ['precision', 'technique', 'flair', 'spin', 'serve', 'setting'],
    accent: '#facc15',
    pattern: 'cross',
    icon: 'Crosshair',
    description: 'High-speed cameras, ball-machine reps. Refines the craft until reps look identical.',
  },
  attack_court: {
    key: 'attack_court',
    name: 'Attack Court',
    short: 'ATTACK',
    stats: ['attack', 'technique', 'torque', 'flair', 'precision'],
    accent: '#a78bfa',
    pattern: 'arc',
    icon: 'Flame',
    description: 'Approach mats, target zones, blockers-on-springs. Where finishers learn to finish.',
  },
  defense_court: {
    key: 'defense_court',
    name: 'Defense Court',
    short: 'DEFENSE',
    stats: ['block', 'defense', 'positioning', 'digging', 'balance', 'flexibility'],
    accent: '#22c55e',
    pattern: 'hex',
    icon: 'Shield',
    description: 'Read-the-hitter blocking station and dig-pit floor work.',
  },
  serve_tunnel: {
    key: 'serve_tunnel',
    name: 'Serve Tunnel',
    short: 'SERVE',
    stats: ['serve', 'ball_control', 'spin', 'precision', 'pressure', 'concentration'],
    accent: '#f472b6',
    pattern: 'dots',
    icon: 'Target',
    description: 'Radar gun, target grid, crowd-noise simulator. Big serves under pressure.',
  },
  reception_court: {
    key: 'reception_court',
    name: 'Reception Court',
    short: 'RECEIVE',
    stats: ['receive', 'ball_control', 'positioning', 'digging', 'teamwork', 'defense'],
    accent: '#fbbf24',
    pattern: 'grid',
    icon: 'Hand',
    description: 'Platform-control drills, jump-serve receive lines.',
  },
  setter_studio: {
    key: 'setter_studio',
    name: 'Setter Studio',
    short: 'SETTER',
    stats: ['setting', 'playmaking', 'vision', 'ball_control', 'spin', 'flair'],
    accent: '#60a5fa',
    pattern: 'arc',
    icon: 'Sparkles',
    description: 'Set-tempo grids, hands-only cages, mirror walls.',
  },
  power_court: {
    key: 'power_court',
    name: 'Power Court',
    short: 'POWER',
    stats: ['attack', 'block', 'strength', 'vertical', 'intimidation', 'serve'],
    accent: '#dc2626',
    pattern: 'hex',
    icon: 'Mountain',
    description: 'Heavy-rotation hitting lines, reinforced net, double-block triggers.',
  },

  // ── Mental / Tactical ─────────────────────────────────────────────
  tactical_room: {
    key: 'tactical_room',
    name: 'Tactical Room',
    short: 'TACTICS',
    stats: ['game_iq', 'vision', 'playmaking', 'teamwork', 'leadership', 'setting'],
    accent: '#38bdf8',
    pattern: 'grid',
    icon: 'BookOpen',
    description: 'Whiteboards, opponent breakdowns, set-piece chalk talk.',
  },
  sports_psychology: {
    key: 'sports_psychology',
    name: 'Sports Psychology',
    short: 'MENTAL',
    stats: ['leadership', 'concentration', 'pressure', 'consistency', 'intimidation'],
    accent: '#94a3b8',
    pattern: 'noise',
    icon: 'Brain',
    description: 'Visualization, breath protocols, big-moment exposure.',
  },
  film_room: {
    key: 'film_room',
    name: 'Film Room',
    short: 'FILM',
    stats: ['game_iq', 'vision', 'playmaking', 'technique', 'receive', 'attack'],
    accent: '#f97316',
    pattern: 'lines',
    icon: 'Film',
    description: 'Tagged film, tendency reports, pre-match scout reels.',
  },
  mental_lab: {
    key: 'mental_lab',
    name: 'Mental Lab',
    short: 'MIND',
    stats: ['teamwork', 'pressure', 'consistency', 'leadership', 'game_iq', 'intimidation'],
    accent: '#a855f7',
    pattern: 'noise',
    icon: 'Lightbulb',
    description: 'Group sessions, role clarity, captaincy seminars.',
  },
};

/** Stable iteration order (used by UI). */
export const FACILITY_ORDER: FacilityKey[] = [
  'cardio_center', 'weight_room', 'plyometrics_lab', 'agility_grid',
  'recovery_suite', 'technique_lab', 'attack_court', 'defense_court',
  'serve_tunnel', 'reception_court', 'setter_studio', 'power_court',
  'tactical_room', 'sports_psychology', 'film_room', 'mental_lab',
];

/** Reverse index: stat → list of facility keys that affect it. */
export const STAT_TO_FACILITIES: Record<string, FacilityKey[]> = (() => {
  const m: Record<string, FacilityKey[]> = {};
  for (const key of FACILITY_ORDER) {
    for (const s of FACILITY_DEFS[key].stats) {
      (m[s] ||= []).push(key);
    }
  }
  return m;
})();

/* ───────────────────────────────────────────────────────────────────
   Upgrade economy
   ─────────────────────────────────────────────────────────────────── */

/** Multiplier by level (level 0 → 1.00, level 5 → 2.00). */
export const LEVEL_MULTIPLIER: readonly number[] = [1.00, 1.20, 1.40, 1.60, 1.80, 2.00] as const;

/** Cost to upgrade *to* level N (in dollars). Level 0 is the starting point. */
export const UPGRADE_COST_TO_LEVEL: Record<number, number> = {
  1: 1_000_000,
  2: 2_500_000,
  3: 5_000_000,
  4: 12_000_000,
  5: 30_000_000,
};

export const MAX_LEVEL = 5;
export const MIN_LEVEL = 0;

export function facilityMultiplier(level: number): number {
  const clamped = Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, level | 0));
  return LEVEL_MULTIPLIER[clamped];
}

export function upgradeCostToLevel(targetLevel: number): number | null {
  return UPGRADE_COST_TO_LEVEL[targetLevel] ?? null;
}

/* ───────────────────────────────────────────────────────────────────
   Stacked-multiplier with diminishing returns
   ───────────────────────────────────────────────────────────────────
   When the same stat is boosted by N facilities, naive stacking
   (mult₁ × mult₂ × mult₃) compounds far too fast. Instead we treat
   each facility's *bonus* (m-1) as additive but scaled by rank:
       effective = 1 + b₁·1.00 + b₂·0.50 + b₃·0.25 + b₄·0.10 + ...
   Bonuses are sorted descending so the strongest facility always
   contributes in full; later contributions are still meaningful but
   never freeride. Examples (assuming three facilities affect a stat):
       • single L5 only:           1 + 1.00            = 2.00×
       • two L5s:                  1 + 1.00 + 0.50     = 2.50×
       • three L5s (all maxed):    1 + 1.00 + 0.50 + 0.25 = 2.75×
       • L5 + L3 + L0:             1 + 1.00 + 0.20 + 0  = 2.20×
*/
const STACK_WEIGHTS: readonly number[] = [1.00, 0.50, 0.25, 0.10, 0.05] as const;

export function stackedStatMultiplier(statKey: string, facilityLevels: Record<string, number>): number {
  const facs = STAT_TO_FACILITIES[statKey];
  if (!facs || facs.length === 0) return 1.0;

  const bonuses: number[] = [];
  for (const fkey of facs) {
    const lvl = facilityLevels[fkey] ?? 0;
    const m = facilityMultiplier(lvl);
    if (m > 1) bonuses.push(m - 1);
  }
  if (bonuses.length === 0) return 1.0;

  bonuses.sort((a, b) => b - a);
  let total = 1.0;
  for (let i = 0; i < bonuses.length; i++) {
    total += bonuses[i] * (STACK_WEIGHTS[i] ?? 0.05);
  }
  return total;
}

/** Convenience: returns ordered breakdown for UI tooltips. */
export function stackedBreakdown(statKey: string, facilityLevels: Record<string, number>) {
  const facs = STAT_TO_FACILITIES[statKey] ?? [];
  const rows = facs.map(f => {
    const lvl = facilityLevels[f] ?? 0;
    return { facilityKey: f, level: lvl, mult: facilityMultiplier(lvl), bonus: facilityMultiplier(lvl) - 1 };
  });
  rows.sort((a, b) => b.bonus - a.bonus);
  return rows.map((r, i) => ({ ...r, weight: STACK_WEIGHTS[i] ?? 0.05 }));
}
