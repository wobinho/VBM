import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/db';
import { withUserDb } from '@/lib/db/with-user-db';
import { getUserTeam } from '@/lib/db/queries';
import { autoPickLineup } from '@/lib/seed-custom';
import { DRAFT_QUOTA, DRAFT_ROSTER_SIZE } from '@/lib/custom-save';
import { sessionOptions, SessionData } from '@/lib/auth/session';

/** GET /api/draft — the pending fantasy-draft pool, teams and the user's team. */
export const GET = withUserDb(async () => {
    const db = getDb();
    const status = db.prepare("SELECT value FROM world_meta WHERE key = 'draft_status'")
        .get() as { value: string } | undefined;
    if (status?.value !== 'pending') {
        return NextResponse.json({ done: true });
    }
    const poolMode = (db.prepare("SELECT value FROM world_meta WHERE key = 'draft_pool_mode'")
        .get() as { value: string } | undefined)?.value ?? 'existing';

    const pool = db.prepare(`
        SELECT id, player_name, position, age, country, overall, potential,
               attack, block, serve, receive, setting, digging
        FROM players WHERE team_id IS NULL
        ORDER BY overall DESC
    `).all();

    const teams = db.prepare(`
        SELECT t.id, t.team_name, l.league_name
        FROM teams t JOIN leagues l ON t.league_id = l.id
        ORDER BY t.id
    `).all();

    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    let userTeamId: number | null = null;
    if (session.userId) {
        userTeamId = getUserTeam(session.userId)?.team_id ?? null;
    }

    return NextResponse.json({ done: false, poolMode, pool, teams, userTeamId });
});

/** POST /api/draft — commit final team rosters from the completed draft. */
export const POST = withUserDb(async (req: NextRequest) => {
    const db = getDb();
    const status = db.prepare("SELECT value FROM world_meta WHERE key = 'draft_status'")
        .get() as { value: string } | undefined;
    if (status?.value !== 'pending') {
        return NextResponse.json({ error: 'Draft already completed' }, { status: 409 });
    }

    const body = (await req.json().catch(() => null)) as { assignments?: Record<string, number[]> } | null;
    const assignments = body?.assignments;
    if (!assignments || typeof assignments !== 'object') {
        return NextResponse.json({ error: 'Missing draft assignments' }, { status: 400 });
    }

    const poolRows = db.prepare('SELECT id, position FROM players WHERE team_id IS NULL')
        .all() as { id: number; position: string }[];
    const poolById = new Map(poolRows.map(p => [p.id, p.position]));
    const teamIds = (db.prepare('SELECT id FROM teams').all() as { id: number }[]).map(t => t.id);

    // Validate: every team covered, 7 players each, position make-up matches
    // the quota, and every pool player used exactly once.
    if (Object.keys(assignments).length !== teamIds.length || !teamIds.every(id => assignments[String(id)])) {
        return NextResponse.json({ error: 'Draft must cover every team' }, { status: 400 });
    }

    const usedPlayers = new Set<number>();
    for (const teamId of teamIds) {
        const ids = assignments[String(teamId)] ?? [];
        if (ids.length !== DRAFT_ROSTER_SIZE) {
            return NextResponse.json({ error: `Every team needs ${DRAFT_ROSTER_SIZE} players` }, { status: 400 });
        }
        const posCount: Record<string, number> = {};
        for (const pid of ids) {
            const pos = poolById.get(pid);
            if (pos === undefined) {
                return NextResponse.json({ error: 'A drafted player is not in the pool' }, { status: 400 });
            }
            if (usedPlayers.has(pid)) {
                return NextResponse.json({ error: 'A player was drafted twice' }, { status: 400 });
            }
            usedPlayers.add(pid);
            posCount[pos] = (posCount[pos] ?? 0) + 1;
        }
        for (const [pos, need] of Object.entries(DRAFT_QUOTA)) {
            if ((posCount[pos] ?? 0) !== need) {
                return NextResponse.json({ error: 'A team has an invalid position make-up' }, { status: 400 });
            }
        }
    }
    if (usedPlayers.size !== poolRows.length) {
        return NextResponse.json({ error: 'Not all pool players were drafted' }, { status: 400 });
    }

    const assign = db.prepare('UPDATE players SET team_id = ? WHERE id = ?');
    const apply = db.transaction(() => {
        for (const teamId of teamIds) {
            for (const pid of assignments[String(teamId)]) assign.run(teamId, pid);
            autoPickLineup(db, teamId);
        }
        db.prepare("INSERT OR REPLACE INTO world_meta (key, value) VALUES ('draft_status', 'done')").run();
    });
    apply();

    return NextResponse.json({ success: true });
});
