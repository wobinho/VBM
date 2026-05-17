/**
 * Office facility catalog — single source of truth for office-side
 * upgradeables that move the team's monthly revenue/expense lines.
 *
 * Design rules:
 *   • 6 office facilities — Office, Training Ground, Stadium, plus three
 *     stadium-attached upgradeables (Seating, Big Screens, Merch Shop)
 *   • Levels 0-5 — same ladder as training facilities so the UI feels uniform
 *   • Each facility maps to one or more economy lines (income or expense),
 *     producing a percentage modifier that runMonthlyEconomy applies
 *     on top of the base values.
 *   • Reuses the existing training_facilities DB table — facility_type is
 *     free-form text, no schema change needed. Keys here are namespaced
 *     "office_*" to avoid colliding with training facility keys.
 */

import type { LucideIcon } from 'lucide-react';
import {
  Briefcase, Dumbbell, Building2, Tv, ShoppingBag, Users,
  Megaphone, Coffee, ParkingCircle, Microscope, Stethoscope, Radio,
} from 'lucide-react';

export type OfficeFacilityKey =
  | 'office_hq'
  | 'training_ground'
  | 'stadium_main'
  | 'stadium_seating'
  | 'stadium_screens'
  | 'merchandise_shop'
  | 'marketing_dept'
  | 'hospitality_lounge'
  | 'parking_complex'
  | 'analytics_lab'
  | 'medical_bay'
  | 'broadcast_studio';

export type EconomyLine =
  | 'income_matchday'
  | 'income_sponsorship'
  | 'income_merchandise'
  | 'income_broadcast'
  | 'expense_staff'
  | 'expense_other';

export interface OfficeFacilityEffect {
  line: EconomyLine;
  /**
   * Per-level fractional change applied multiplicatively.
   * Positive = grows the line, negative = shrinks it.
   * E.g. 0.15 → +15% per level → L5 = +75% over base.
   */
  perLevel: number;
}

export type OfficeBlueprintPattern =
  | 'grid' | 'lines' | 'dots' | 'wave' | 'hex' | 'cross' | 'arc' | 'noise';

export interface OfficeFacilityDef {
  key: OfficeFacilityKey;
  name: string;
  short: string;
  accent: string;
  icon: LucideIcon;
  pattern: OfficeBlueprintPattern;
  description: string;
  effects: OfficeFacilityEffect[];
}

export const OFFICE_FACILITY_DEFS: Record<OfficeFacilityKey, OfficeFacilityDef> = {
  office_hq: {
    key: 'office_hq',
    name: 'Club Office',
    short: 'OFFICE',
    accent: '#facc15',
    icon: Briefcase,
    pattern: 'grid',
    description:
      'Boardroom, admin staff, and back-office software. A tighter operation trims staff and overhead costs.',
    effects: [
      { line: 'expense_staff', perLevel: -0.06 },
      { line: 'expense_other', perLevel: -0.08 },
      { line: 'income_sponsorship', perLevel: 0.05 },
    ],
  },
  training_ground: {
    key: 'training_ground',
    name: 'Training Ground',
    short: 'GROUND',
    accent: '#22d3ee',
    icon: Dumbbell,
    pattern: 'cross',
    description:
      'Pitches, recovery pools, dorms for the academy. A modern campus attracts kit deals and sponsor visits.',
    effects: [
      { line: 'income_sponsorship', perLevel: 0.08 },
      { line: 'expense_staff', perLevel: -0.03 },
    ],
  },
  stadium_main: {
    key: 'stadium_main',
    name: 'Stadium',
    short: 'STADIUM',
    accent: '#fb923c',
    icon: Building2,
    pattern: 'arc',
    description:
      'The main bowl. Each upgrade adds capacity and lifts ticketing across every home night.',
    effects: [
      { line: 'income_matchday', perLevel: 0.18 },
      { line: 'income_broadcast', perLevel: 0.04 },
    ],
  },
  stadium_seating: {
    key: 'stadium_seating',
    name: 'Premium Seating',
    short: 'SEATING',
    accent: '#a78bfa',
    icon: Users,
    pattern: 'hex',
    description:
      'VIP boxes, hospitality tiers, padded bowl seats. Pricier ticket bands without growing the footprint.',
    effects: [
      { line: 'income_matchday', perLevel: 0.12 },
      { line: 'income_sponsorship', perLevel: 0.04 },
    ],
  },
  stadium_screens: {
    key: 'stadium_screens',
    name: 'Stadium Screens',
    short: 'SCREENS',
    accent: '#60a5fa',
    icon: Tv,
    pattern: 'lines',
    description:
      'LED ribbons, jumbotron, second-screen integrations. Better broadcast product, richer sponsor inventory.',
    effects: [
      { line: 'income_broadcast', perLevel: 0.15 },
      { line: 'income_sponsorship', perLevel: 0.06 },
    ],
  },
  merchandise_shop: {
    key: 'merchandise_shop',
    name: 'Merchandise Shop',
    short: 'MERCH',
    accent: '#22c55e',
    icon: ShoppingBag,
    pattern: 'dots',
    description:
      'Flagship store, online fulfilment, kit drops. Direct sales lift on every shirt, scarf, and replica.',
    effects: [
      { line: 'income_merchandise', perLevel: 0.20 },
    ],
  },

  // ── Expansion wing ──────────────────────────────────────────────
  marketing_dept: {
    key: 'marketing_dept',
    name: 'Marketing Department',
    short: 'MKTG',
    accent: '#ec4899',
    icon: Megaphone,
    pattern: 'wave',
    description:
      'Brand team, campaign studio, social content room. Brings new sponsors to the table and grows fan-side spend.',
    effects: [
      { line: 'income_sponsorship', perLevel: 0.12 },
      { line: 'income_merchandise', perLevel: 0.06 },
    ],
  },
  hospitality_lounge: {
    key: 'hospitality_lounge',
    name: 'Hospitality Lounge',
    short: 'LOUNGE',
    accent: '#f59e0b',
    icon: Coffee,
    pattern: 'noise',
    description:
      'Member bars, executive suites, catering deals. Premium matchday spend without enlarging the bowl.',
    effects: [
      { line: 'income_matchday', perLevel: 0.10 },
      { line: 'income_sponsorship', perLevel: 0.03 },
    ],
  },
  parking_complex: {
    key: 'parking_complex',
    name: 'Parking Complex',
    short: 'PARKING',
    accent: '#94a3b8',
    icon: ParkingCircle,
    pattern: 'grid',
    description:
      'Multi-storey decks and matchday flow. Lifts attendance ceilings and squeezes ancillary spend per visitor.',
    effects: [
      { line: 'income_matchday', perLevel: 0.06 },
      { line: 'expense_other', perLevel: -0.05 },
    ],
  },
  analytics_lab: {
    key: 'analytics_lab',
    name: 'Analytics Lab',
    short: 'ANALYTICS',
    accent: '#38bdf8',
    icon: Microscope,
    pattern: 'cross',
    description:
      'Data engineers, opposition models, recruitment scoring. Better signings, leaner overhead.',
    effects: [
      { line: 'expense_other', perLevel: -0.10 },
      { line: 'income_broadcast', perLevel: 0.03 },
    ],
  },
  medical_bay: {
    key: 'medical_bay',
    name: 'Medical Bay',
    short: 'MEDICAL',
    accent: '#ef4444',
    icon: Stethoscope,
    pattern: 'dots',
    description:
      'Imaging, physio suites, return-to-play protocols. Healthier squad, lower replacement and care costs.',
    effects: [
      { line: 'expense_staff', perLevel: -0.05 },
      { line: 'expense_other', perLevel: -0.06 },
    ],
  },
  broadcast_studio: {
    key: 'broadcast_studio',
    name: 'Broadcast Studio',
    short: 'STUDIO',
    accent: '#8b5cf6',
    icon: Radio,
    pattern: 'lines',
    description:
      'In-house production gallery, club channel, post-match shows. Owns more of the broadcast pie.',
    effects: [
      { line: 'income_broadcast', perLevel: 0.18 },
      { line: 'income_sponsorship', perLevel: 0.04 },
    ],
  },
};

export const OFFICE_FACILITY_ORDER: OfficeFacilityKey[] = [
  'office_hq',
  'training_ground',
  'stadium_main',
  'stadium_seating',
  'stadium_screens',
  'merchandise_shop',
  'marketing_dept',
  'hospitality_lounge',
  'parking_complex',
  'analytics_lab',
  'medical_bay',
  'broadcast_studio',
];

/** Multiplier by level — shared with training so the UI ladder reads the same. */
export const OFFICE_LEVEL_MULTIPLIER: readonly number[] = [1.00, 1.20, 1.40, 1.60, 1.80, 2.00] as const;

/** Cost to upgrade *to* level N (in dollars). Same ladder as training facilities. */
export const OFFICE_UPGRADE_COST_TO_LEVEL: Record<number, number> = {
  1: 1_000_000,
  2: 2_500_000,
  3: 5_000_000,
  4: 12_000_000,
  5: 30_000_000,
};

export const OFFICE_MAX_LEVEL = 5;
export const OFFICE_MIN_LEVEL = 0;

export function officeUpgradeCostToLevel(targetLevel: number): number | null {
  return OFFICE_UPGRADE_COST_TO_LEVEL[targetLevel] ?? null;
}

export function isOfficeFacilityKey(key: string): key is OfficeFacilityKey {
  return key in OFFICE_FACILITY_DEFS;
}

/**
 * Compute the per-line multipliers given a map of office-facility levels.
 * Effects sum across facilities additively (no diminishing returns) so the
 * impact of a build-out is easy to reason about in-fiction.
 *
 *   result[line] = 1 + sum(effect.perLevel * level for every effect on that line)
 *
 * Lines not touched by any facility return 1.0.
 */
export function computeEconomyMultipliers(
  levels: Partial<Record<OfficeFacilityKey, number>>,
): Record<EconomyLine, number> {
  const result: Record<EconomyLine, number> = {
    income_matchday: 1,
    income_sponsorship: 1,
    income_merchandise: 1,
    income_broadcast: 1,
    expense_staff: 1,
    expense_other: 1,
  };

  for (const key of OFFICE_FACILITY_ORDER) {
    const lvl = levels[key] ?? 0;
    if (lvl <= 0) continue;
    const def = OFFICE_FACILITY_DEFS[key];
    for (const eff of def.effects) {
      result[eff.line] += eff.perLevel * lvl;
    }
  }

  // Floor expense multipliers so we never produce negative or zero monthly costs.
  result.expense_staff = Math.max(0.25, result.expense_staff);
  result.expense_other = Math.max(0.25, result.expense_other);

  return result;
}
