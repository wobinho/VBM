import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { authGetUserById, authGetSave } from '@/lib/db/auth-db';
import { openSaveDb, runWithDb } from '@/lib/db';
import { getUserTeam, getLeagues, assignTeam } from '@/lib/db/queries';
import { sessionOptions, SessionData } from '@/lib/auth/session';

export async function GET() {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.userId) {
        return NextResponse.json({ user: null, team: null, activeSave: null });
    }
    const user = authGetUserById(session.userId);
    if (!user) {
        return NextResponse.json({ user: null, team: null, activeSave: null });
    }
    const userPayload = {
        id: user.id, email: user.email, username: user.username,
        displayName: user.display_name, isAdmin: user.is_admin === 1,
    };

    // No save selected yet — the save-picker screen handles selection.
    if (!session.saveId) {
        return NextResponse.json({ user: userPayload, team: null, activeSave: null });
    }
    const save = authGetSave(session.saveId);
    if (!save || save.user_id !== user.id) {
        return NextResponse.json({ user: userPayload, team: null, activeSave: null });
    }

    const userDb = openSaveDb(save);
    return runWithDb(userDb, () => {
        const userTeam = getUserTeam(user.id);
        const draftRow = userDb.prepare("SELECT value FROM world_meta WHERE key = 'draft_status'")
            .get() as { value: string } | undefined;
        return NextResponse.json({
            user: userPayload,
            activeSave: {
                id: save.id, name: save.name, save_type: save.save_type,
                status: save.status, created_at: save.created_at, last_played: save.last_played,
            },
            team: userTeam ? { id: userTeam.team_id, name: userTeam.team_name, league_id: userTeam.league_id } : null,
            availableLeagues: !userTeam ? getLeagues() : undefined,
            draftPending: draftRow?.value === 'pending',
        });
    });
}

export async function POST(req: Request) {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (!session.saveId) {
        return NextResponse.json({ error: 'No save selected' }, { status: 409 });
    }
    const save = authGetSave(session.saveId);
    if (!save || save.user_id !== session.userId) {
        return NextResponse.json({ error: 'Save not found' }, { status: 404 });
    }
    const { teamId } = await req.json();
    if (!teamId) {
        return NextResponse.json({ error: 'Team ID required' }, { status: 400 });
    }
    const userDb = openSaveDb(save);
    const userTeam = await runWithDb(userDb, () => {
        assignTeam(session.userId!, teamId);
        return getUserTeam(session.userId!);
    });
    if (userTeam) {
        session.teamId = userTeam.team_id;
        session.teamName = userTeam.team_name;
        await session.save();
    }
    return NextResponse.json({ success: true, team: userTeam ? { id: userTeam.team_id, name: userTeam.team_name, league_id: userTeam.league_id } : null });
}
