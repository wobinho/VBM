import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { assignTeam, getUserTeam, getTeamById } from '@/lib/db/queries';
import { sessionOptions, SessionData } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
    try {
        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
        if (!session.userId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const { teamId } = await req.json();
        if (!teamId) {
            return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
        }

        // Validate team exists
        const team = getTeamById(Number(teamId));
        if (!team) {
            return NextResponse.json({ error: 'Team not found' }, { status: 404 });
        }

        // Assign team to user
        assignTeam(session.userId, Number(teamId));
        const userTeam = getUserTeam(session.userId);

        if (userTeam) {
            session.teamId = userTeam.team_id;
            session.teamName = userTeam.team_name;
            await session.save();
        }

        return NextResponse.json({ success: true, team: userTeam ? { id: userTeam.team_id, name: userTeam.team_name } : null });
    } catch (err: any) {
        console.error('Join team error:', err);
        return NextResponse.json({ error: 'Failed to join team' }, { status: 500 });
    }
}
