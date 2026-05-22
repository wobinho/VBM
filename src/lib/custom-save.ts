/**
 * Shared types + pure validation for the custom-save creator.
 *
 * This file has NO server-only imports (no better-sqlite3), so it is safe to
 * import from both the creation wizard (client) and the seeder (server).
 */

/**
 * A brand-new team created from scratch in the custom-save wizard. It is
 * referenced by a synthetic negative id so it slots into the same tier arrays
 * as catalog teams (whose ids are always positive).
 */
export interface CustomTeamDef {
    id: number;     // synthetic, negative, unique across the whole save
    name: string;
    logo: string;   // club badge key — a file in public/assets/teams (e.g. "12")
}

/** One user-created league — always a 2-tier pyramid with promotion/relegation. */
export interface CustomPyramidConfig {
    name: string;                       // display name for the pyramid as a whole
    kind: 'domestic' | 'international';
    country: string;                    // domestic: a country; international: 'International'
    rounds: number;                     // round-robin multiplier (games per season)
    promotionCount: number;             // R — bottom R of Tier 1 ↔ top R of Tier 2
    playoffEnabled: boolean;            // Tier 1 playoff
    playoffTopN: number;                // playoff bracket size
    seriesLength: number;               // best-of-N per playoff series
    tier1Name: string;
    tier2Name: string;
    tier1TeamIds: number[];             // team ids — positive = catalog, negative = custom
    tier2TeamIds: number[];
    teamNames: Record<string, number | string>; // catalogTeamId -> custom name (renamed only)
    customTeams: CustomTeamDef[];       // from-scratch teams referenced by negative ids
}

/** Schedule window for a custom cup, within the Jul–Dec cup block. */
export interface CustomCupWindow {
    startMonth: number;
    startDay: number;
    endMonth: number;
    endDay: number;
}

/** One user-created knockout cup. */
export interface CustomCupConfig {
    name: string;
    teamIds: number[];          // catalog team ids — power of 2 (2, 4, 8, 16)
    window: CustomCupWindow;
}

/** Fantasy-draft setup for a custom save. */
export interface CustomDraftConfig {
    enabled: boolean;
    pool: 'existing' | 'generated' | 'mixed';
}

export interface CustomWorldConfig {
    saveName: string;
    startYear: number;
    pyramids: CustomPyramidConfig[];
    cups: CustomCupConfig[];
    draft: CustomDraftConfig;
}

export const ALLOWED_ROUNDS = [1, 2, 3, 4];
export const ALLOWED_TOPN = [2, 4, 8, 16];
export const ALLOWED_SERIES = [1, 3, 5, 7];
export const MIN_TIER_TEAMS = 4;
export const MAX_TIER_TEAMS = 24;
export const MAX_PYRAMIDS = 8;
export const MAX_SAVE_NAME = 40;
export const MAX_LEAGUE_NAME = 40;
export const MAX_TEAM_NAME = 40;
/** Selectable club badges live at public/assets/teams/1.png … N.png. */
export const TEAM_BADGE_COUNT = 48;
export const ALLOWED_CUP_SIZES = [2, 4, 8, 16];
export const MAX_CUPS = 6;
export const MAX_CUP_NAME = 40;
export const CUP_BLOCK_START_MONTH = 7;
export const CUP_BLOCK_END_MONTH = 12;

export const ALLOWED_DRAFT_POOLS = ['existing', 'generated', 'mixed'] as const;
/** Roster make-up every team must end the draft with (7 players total). */
export const DRAFT_QUOTA: Record<string, number> = {
    'Outside Hitter': 2, 'Middle Blocker': 2, 'Opposite Hitter': 1, 'Setter': 1, 'Libero': 1,
};
export const DRAFT_POSITIONS = ['Outside Hitter', 'Middle Blocker', 'Opposite Hitter', 'Setter', 'Libero'];
export const DRAFT_ROSTER_SIZE = 7;

/** Round-robin schedule maths used for the review-step preview. */
export function scheduleSummary(teamCount: number, rounds: number): { gameWeeks: number; fixtures: number } {
    if (teamCount < 2) return { gameWeeks: 0, fixtures: 0 };
    return {
        gameWeeks: (teamCount - 1) * rounds,
        fixtures: (teamCount / 2) * (teamCount - 1) * rounds,
    };
}

// ── Cup scheduling (shared by the wizard preview and the server seeder) ──────

export interface CupRoundPlan {
    roundNumber: number;
    name: string;
    isFinal: boolean;
    dates: string[]; // non-final: [date]; final (best-of-3): [game1, game2]
}

/** Number of knockout rounds for a power-of-2 team count. */
export function cupRoundCount(teamCount: number): number {
    return Math.max(1, Math.round(Math.log2(Math.max(2, teamCount))));
}

function cupRoundName(roundTeamCount: number): string {
    switch (roundTeamCount) {
        case 2: return 'Grand Final';
        case 4: return 'Semi Finals';
        case 8: return 'Quarter Finals';
        case 16: return 'Round of 16';
        default: return `Round of ${roundTeamCount}`;
    }
}

function fmtDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** Mon/Wed/Fri dates inside a cup window, evenly down-sampled to `count`. */
function cupDates(year: number, w: CustomCupWindow, count: number): string[] {
    const start = new Date(year, w.startMonth - 1, w.startDay);
    const end = new Date(year, w.endMonth - 1, w.endDay);
    const pool: string[] = [];
    const d = new Date(start);
    while (d <= end) {
        const wd = d.getDay();
        if (wd === 1 || wd === 3 || wd === 5) pool.push(fmtDate(d));
        d.setDate(d.getDate() + 1);
    }
    if (pool.length === 0) return Array.from({ length: count }, () => fmtDate(start));
    if (pool.length <= count) {
        const out = [...pool];
        while (out.length < count) out.push(pool[pool.length - 1]);
        return out;
    }
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
        out.push(pool[Math.round((i * (pool.length - 1)) / (count - 1))]);
    }
    return out;
}

/**
 * Plans a custom cup's rounds: round numbers (the final lands on 6 to match
 * the cup engine's best-of-3 final handling), names, and play dates.
 */
export function planCupRounds(year: number, teamCount: number, window: CustomCupWindow): CupRoundPlan[] {
    const rounds = cupRoundCount(teamCount);
    const dates = cupDates(year, window, rounds + 1);
    const plans: CupRoundPlan[] = [];
    let size = teamCount;
    for (let i = 0; i < rounds; i++) {
        const isFinal = i === rounds - 1;
        plans.push({
            roundNumber: 7 - rounds + i,
            name: cupRoundName(size),
            isFinal,
            dates: isFinal ? [dates[rounds - 1], dates[rounds]] : [dates[i]],
        });
        size = Math.floor(size / 2);
    }
    return plans;
}

/**
 * Structural validation that needs no database access. Returns a list of
 * human-readable errors (empty = valid). The server runs this plus a catalog
 * existence check before building the world.
 */
export function validateCustomWorldConfig(config: CustomWorldConfig): string[] {
    const errors: string[] = [];
    if (!config || typeof config !== 'object') return ['Invalid configuration.'];

    const saveName = (config.saveName ?? '').trim();
    if (!saveName) errors.push('Give your save a name.');
    else if (saveName.length > MAX_SAVE_NAME) errors.push(`Save name must be ${MAX_SAVE_NAME} characters or fewer.`);

    const pyramids = config.pyramids ?? [];
    if (pyramids.length < 1) errors.push('Add at least one league.');
    if (pyramids.length > MAX_PYRAMIDS) errors.push(`At most ${MAX_PYRAMIDS} leagues are allowed.`);

    const leagueNames = new Set<string>();
    const allTeamIds: number[] = [];
    const renamedCounts = new Map<string, number>();

    pyramids.forEach((p, i) => {
        const label = (p.name || `League ${i + 1}`).trim() || `League ${i + 1}`;

        ([['Tier 1', p.tier1Name], ['Tier 2', p.tier2Name]] as const).forEach(([tierLabel, tName]) => {
            const n = (tName ?? '').trim();
            if (!n) { errors.push(`${label}: ${tierLabel} needs a division name.`); return; }
            if (n.length > MAX_LEAGUE_NAME) errors.push(`${label}: ${tierLabel} name is too long.`);
            const key = n.toLowerCase();
            if (leagueNames.has(key)) errors.push(`Division name "${n}" is used more than once.`);
            leagueNames.add(key);
        });

        if (!ALLOWED_ROUNDS.includes(p.rounds)) errors.push(`${label}: invalid number of rounds.`);
        if (!ALLOWED_SERIES.includes(p.seriesLength)) errors.push(`${label}: invalid playoff series length.`);

        const t1 = p.tier1TeamIds ?? [];
        const t2 = p.tier2TeamIds ?? [];
        ([['Tier 1', t1], ['Tier 2', t2]] as const).forEach(([tierLabel, ids]) => {
            if (ids.length < MIN_TIER_TEAMS) errors.push(`${label}: ${tierLabel} needs at least ${MIN_TIER_TEAMS} teams.`);
            else if (ids.length > MAX_TIER_TEAMS) errors.push(`${label}: ${tierLabel} can have at most ${MAX_TIER_TEAMS} teams.`);
            else if (ids.length % 2 !== 0) errors.push(`${label}: ${tierLabel} must have an even number of teams.`);
            allTeamIds.push(...ids);
        });

        if (p.promotionCount < 1) errors.push(`${label}: promotion count must be at least 1.`);
        if (t1.length && p.promotionCount >= t1.length) errors.push(`${label}: promotion count must be smaller than the Tier 1 team count.`);
        if (t2.length && p.promotionCount >= t2.length) errors.push(`${label}: promotion count must be smaller than the Tier 2 team count.`);

        if (p.playoffEnabled) {
            if (!ALLOWED_TOPN.includes(p.playoffTopN)) errors.push(`${label}: invalid playoff size.`);
            else if (t1.length && p.playoffTopN > t1.length) errors.push(`${label}: playoff size cannot exceed the Tier 1 team count.`);
        }

        const names = p.teamNames ?? {};
        [...t1, ...t2].forEach(id => {
            const custom = String(names[String(id)] ?? '').trim();
            if (custom) {
                const key = custom.toLowerCase();
                renamedCounts.set(key, (renamedCounts.get(key) ?? 0) + 1);
            }
        });

        // Custom (from-scratch) teams: every negative id placed in a tier must
        // have a matching definition, and each definition needs a name.
        const customDefs = p.customTeams ?? [];
        const customIds = new Set(customDefs.map(c => c.id));
        if ([...t1, ...t2].some(id => id < 0 && !customIds.has(id))) {
            errors.push(`${label}: a custom team is missing its details.`);
        }
        customDefs.forEach(ct => {
            const nm = (ct.name ?? '').trim();
            if (!nm) { errors.push(`${label}: every custom team needs a name.`); return; }
            if (nm.length > MAX_TEAM_NAME) errors.push(`${label}: custom team name "${nm}" is too long.`);
            const key = nm.toLowerCase();
            renamedCounts.set(key, (renamedCounts.get(key) ?? 0) + 1);
        });
    });

    const seen = new Set<number>();
    for (const id of allTeamIds) {
        if (seen.has(id)) { errors.push('A team can only be used once across the whole save.'); break; }
        seen.add(id);
    }

    for (const count of renamedCounts.values()) {
        if (count > 1) { errors.push('Two teams in your save share the same name.'); break; }
    }

    // ── Cups ──
    const cups = config.cups ?? [];
    if (cups.length > MAX_CUPS) errors.push(`At most ${MAX_CUPS} cups are allowed.`);
    const leagueTeamSet = new Set(allTeamIds);
    const cupNames = new Set<string>();
    cups.forEach((c, i) => {
        const label = (c.name || `Cup ${i + 1}`).trim() || `Cup ${i + 1}`;
        const nm = (c.name ?? '').trim();
        if (!nm) errors.push(`Cup ${i + 1} needs a name.`);
        else if (nm.length > MAX_CUP_NAME) errors.push(`${label}: name is too long.`);
        else {
            const key = nm.toLowerCase();
            if (cupNames.has(key)) errors.push(`Cup name "${nm}" is used more than once.`);
            cupNames.add(key);
        }

        const ids = c.teamIds ?? [];
        if (!ALLOWED_CUP_SIZES.includes(ids.length)) {
            errors.push(`${label}: pick 2, 4, 8 or 16 teams (currently ${ids.length}).`);
        }
        if (new Set(ids).size !== ids.length) errors.push(`${label}: a team is listed twice.`);
        for (const id of ids) {
            if (!leagueTeamSet.has(id)) { errors.push(`${label}: includes a team that is not in any league.`); break; }
        }

        const w = c.window;
        if (!w) {
            errors.push(`${label}: needs a schedule window.`);
        } else {
            if (w.startMonth < CUP_BLOCK_START_MONTH || w.endMonth > CUP_BLOCK_END_MONTH || w.endMonth < CUP_BLOCK_START_MONTH) {
                errors.push(`${label}: cups must be scheduled between July and December.`);
            }
            if (w.startMonth * 100 + w.startDay >= w.endMonth * 100 + w.endDay) {
                errors.push(`${label}: the window's start must be before its end.`);
            }
        }
    });

    // ── Draft ──
    const draft = config.draft;
    if (draft?.enabled && !ALLOWED_DRAFT_POOLS.includes(draft.pool)) {
        errors.push('Choose a valid draft player pool.');
    }

    return errors;
}
