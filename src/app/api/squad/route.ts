import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import { getSquadLineupWithPlayers, saveSquadLineup, getUserTeam } from '@/lib/db/queries';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get('teamId');
    if (!teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 });
    const lineup = getSquadLineupWithPlayers(Number(teamId));
    return NextResponse.json(lineup);
}

export async function POST(req: NextRequest) {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { teamId, lineup } = body as {
        teamId: number;
        lineup: { oh1: number | null; mb1: number | null; opp: number | null; s: number | null; mb2: number | null; oh2: number | null; l: number | null };
    };

    // Check if user owns this team
    const userTeam = getUserTeam(session.userId);
    if (!userTeam || userTeam.team_id !== teamId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    saveSquadLineup(teamId, lineup);
    return NextResponse.json({ success: true });
}
