import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/index';

interface LinkCondition {
    scope?: string;
    position?: string;
    count?: number;
    conference?: string;
}

interface RoundDef {
    name?: string;
    scope?: string;
    teams_per_conference?: number;
    teams_count?: number;
}

interface ParsedConfig {
    format?: { type?: string };
    post_season?: { type?: string; rounds?: RoundDef[] };
}

export async function GET() {
    const db = getDb();
    const leagues = db.prepare(`
        SELECT l.*, lc.config
        FROM leagues l
        LEFT JOIN league_configs lc ON lc.league_id = l.id
        ORDER BY l.id
    `).all() as (Record<string, unknown> & { id: number; config?: string })[];

    const links = db.prepare(`
        SELECT from_league_id, to_league_id, from_condition
        FROM league_links
    `).all() as { from_league_id: number; to_league_id: number; from_condition: string }[];

    // Index links by from_league_id for fast lookup
    const linksByFrom = new Map<number, { to_league_id: number; from_condition: LinkCondition }[]>();
    for (const l of links) {
        let cond: LinkCondition = {};
        try { cond = JSON.parse(l.from_condition) as LinkCondition; } catch { /* ignore */ }
        if (!linksByFrom.has(l.from_league_id)) linksByFrom.set(l.from_league_id, []);
        linksByFrom.get(l.from_league_id)!.push({ to_league_id: l.to_league_id, from_condition: cond });
    }

    const result = leagues.map(({ config, ...rest }) => {
        const parsed: ParsedConfig | null = config ? (JSON.parse(config) as ParsedConfig) : null;
        const formatType = parsed?.format?.type ?? null;
        const postSeasonType = parsed?.post_season?.type ?? null;

        // Determine number of playoff teams (from first round of post-season)
        let playoffTeams = 0;
        const round1 = parsed?.post_season?.rounds?.[0];
        if (round1) {
            if (round1.scope === 'whole_table' && typeof round1.teams_count === 'number') {
                playoffTeams = round1.teams_count;
            } else if (round1.scope === 'per_conference' && typeof round1.teams_per_conference === 'number') {
                // Pairs per conference × 2 teams per pair (but we'll surface as per-conference count)
                playoffTeams = round1.teams_per_conference;
            }
        }

        // Count promotion and relegation slots from this league.
        // Outgoing links with position='top' are promotion (top N teams go up),
        // outgoing links with position='bottom' are relegation (bottom N teams go down).
        // This is robust to leagues sharing the same tier number.
        let promotionCount = 0;
        let relegationCount = 0;
        const outgoing = linksByFrom.get(rest.id as number) ?? [];
        for (const link of outgoing) {
            const count = link.from_condition.count ?? 0;
            const pos = link.from_condition.position;
            if (pos === 'top') {
                promotionCount += count;
            } else if (pos === 'bottom') {
                relegationCount += count;
            }
        }

        return {
            ...rest,
            format_type: formatType,
            post_season_type: postSeasonType,
            playoff_teams: playoffTeams,
            promotion_count: promotionCount,
            relegation_count: relegationCount,
        };
    });

    return NextResponse.json(result);
}
