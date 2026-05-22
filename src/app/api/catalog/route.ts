import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { openCatalogDb } from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/auth/session';

interface CatalogTeam {
    id: number;
    team_name: string;
    country: string;
    league_id: number;
    avg_overall: number;
    player_count: number;
}

/**
 * GET /api/catalog — the pristine "original" leagues + teams, used as the
 * source pool when building a custom save.
 */
export async function GET() {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = openCatalogDb();

    const leagues = db.prepare(`
        SELECT id, league_name, country, continent, tier
        FROM leagues
        ORDER BY continent, country, tier, league_name
    `).all() as { id: number; league_name: string; country: string; continent: string; tier: number }[];

    const teams = db.prepare(`
        SELECT t.id, t.team_name, t.country, t.league_id,
            CAST(COALESCE(AVG(p.overall), 0) AS INTEGER) AS avg_overall,
            COUNT(p.id) AS player_count
        FROM teams t
        LEFT JOIN players p ON p.team_id = t.id
        GROUP BY t.id
        ORDER BY t.team_name
    `).all() as CatalogTeam[];

    const teamsByLeague = new Map<number, CatalogTeam[]>();
    for (const t of teams) {
        if (!teamsByLeague.has(t.league_id)) teamsByLeague.set(t.league_id, []);
        teamsByLeague.get(t.league_id)!.push(t);
    }

    return NextResponse.json({
        leagues: leagues.map(l => ({ ...l, teams: teamsByLeague.get(l.id) ?? [] })),
    });
}
