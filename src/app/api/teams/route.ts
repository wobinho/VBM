import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { getTeams, getTeamsByLeague, createTeam, getLeagueById, assignTeam, getUserTeam } from '@/lib/db/queries';
import { sessionOptions, SessionData } from '@/lib/auth/session';

export async function GET(req: NextRequest) {
    const leagueId = req.nextUrl.searchParams.get('leagueId');
    if (leagueId) {
        return NextResponse.json(getTeamsByLeague(Number(leagueId)));
    }
    return NextResponse.json(getTeams());
}

export async function POST(req: NextRequest) {
    try {
        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
        if (!session.userId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const { teamName, leagueId } = await req.json();
        if (!teamName || !leagueId) {
            return NextResponse.json({ error: 'teamName and leagueId are required' }, { status: 400 });
        }

        // Validate league exists
        const league = getLeagueById(Number(leagueId));
        if (!league) {
            return NextResponse.json({ error: 'League not found' }, { status: 404 });
        }

        // Create team and assign to user
        const newTeamId = createTeam({ team_name: teamName.trim(), league_id: Number(leagueId) });
        assignTeam(session.userId, newTeamId);
        const userTeam = getUserTeam(session.userId);

        if (userTeam) {
            session.teamId = userTeam.team_id;
            session.teamName = userTeam.team_name;
            await session.save();
        }

        return NextResponse.json({ success: true, team: userTeam ? { id: userTeam.team_id, name: userTeam.team_name } : null });
    } catch (err: any) {
        if (err.message?.includes('UNIQUE constraint failed')) {
            return NextResponse.json({ error: 'Team name already taken' }, { status: 409 });
        }
        console.error('Create team error:', err);
        return NextResponse.json({ error: 'Failed to create team' }, { status: 500 });
    }
}
