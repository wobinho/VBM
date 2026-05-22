import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';
import { authGetSave } from '@/lib/db/auth-db';
import { openSaveDb } from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/auth/session';

const TEAMS_DIR = path.join(process.cwd(), 'public', 'assets', 'teams');

/**
 * GET /api/team-badge/[id] — resolves a team's club badge.
 *
 * A team's crest is decoupled from its row id via the teams.logo column:
 * copied teams carry their origin badge, from-scratch custom teams carry a
 * user-picked one, and classic-save teams fall back to their id. Resolves to a
 * file under public/assets/teams and 307-redirects to it.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const teamId = Number(id);
    let badge = Number.isFinite(teamId) ? String(teamId) : 'default';

    try {
        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
        if (session.userId && session.saveId && Number.isFinite(teamId)) {
            const save = authGetSave(session.saveId);
            if (save && save.user_id === session.userId) {
                const db = openSaveDb(save);
                const row = db.prepare('SELECT logo, origin_team_id FROM teams WHERE id = ?')
                    .get(teamId) as { logo: string | null; origin_team_id: number | null } | undefined;
                badge = row?.logo?.trim()
                    || (row?.origin_team_id != null ? String(row.origin_team_id) : '')
                    || String(teamId);
            }
        }
    } catch {
        /* fall through to id / default badge */
    }

    let file = /^[A-Za-z0-9_-]+$/.test(badge) ? `${badge}.png` : 'default.png';
    if (!fs.existsSync(path.join(TEAMS_DIR, file))) file = 'default.png';

    return NextResponse.redirect(new URL(`/assets/teams/${file}`, req.url), {
        status: 307,
        headers: { 'Cache-Control': 'public, max-age=3600' },
    });
}
