import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { authGetUserById } from '@/lib/db/auth-db';
import { openUserDb, runWithDb } from '@/lib/db';
import { getUserTeam, getLeagues, assignTeam } from '@/lib/db/queries';
import { sessionOptions, SessionData } from '@/lib/auth/session';

export async function GET() {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.userId) {
        return NextResponse.json({ user: null, team: null });
    }
    const user = authGetUserById(session.userId);
    if (!user) {
        return NextResponse.json({ user: null, team: null });
    }
    const userDb = openUserDb(user.id);
    return runWithDb(userDb, () => {
        const userTeam = getUserTeam(user.id);
        return NextResponse.json({
            user: { id: user.id, email: user.email, username: user.username, displayName: user.display_name, isAdmin: user.is_admin === 1 },
            team: userTeam ? { id: userTeam.team_id, name: userTeam.team_name, league_id: userTeam.league_id } : null,
            availableLeagues: !userTeam ? getLeagues() : undefined,
        });
    });
}

export async function POST(req: Request) {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.userId) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { teamId } = await req.json();
    if (!teamId) {
        return NextResponse.json({ error: 'Team ID required' }, { status: 400 });
    }
    const userDb = openUserDb(session.userId);
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
