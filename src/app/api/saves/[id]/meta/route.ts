import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { authGetSave } from '@/lib/db/auth-db';
import { openSaveDb, runWithDb } from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/auth/session';

/** GET /api/saves/[id]/meta — fetch save metadata (game date, league/team counts). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const save = authGetSave(id);
    if (!save || save.user_id !== session.userId) {
        return NextResponse.json({ error: 'Save not found' }, { status: 404 });
    }

    try {
        const db = openSaveDb(save);
        const meta = runWithDb(db, () => {
            const gameState = db.prepare('SELECT "current_date" FROM game_state WHERE id = 1').get() as { current_date: string } | undefined;
            const leagueCount = db.prepare('SELECT COUNT(*) as c FROM leagues').get() as { c: number };
            const teamCount = db.prepare('SELECT COUNT(*) as c FROM teams').get() as { c: number };

            return {
                game_date: gameState?.current_date || 'Unknown',
                league_count: leagueCount?.c || 0,
                team_count: teamCount?.c || 0,
            };
        });

        return NextResponse.json(meta);
    } catch (error) {
        console.error('Failed to fetch save metadata:', error);
        return NextResponse.json({ error: 'Failed to fetch metadata' }, { status: 500 });
    }
}
