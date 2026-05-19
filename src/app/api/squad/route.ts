import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import { getSquadLineupWithPlayers, saveSquadLineup, getUserTeam, getPlayers } from '@/lib/db/queries';
import { withUserDb } from '@/lib/db/with-user-db';

const SLOT_POSITION: Record<string, string> = {
    oh1: 'Outside Hitter',
    mb1: 'Middle Blocker',
    opp: 'Opposite Hitter',
    s:   'Setter',
    mb2: 'Middle Blocker',
    oh2: 'Outside Hitter',
    l:   'Libero',
};

export const GET = withUserDb(async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get('teamId');
    if (!teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 });
    const lineup = getSquadLineupWithPlayers(Number(teamId));
    return NextResponse.json(lineup);
});

export const POST = withUserDb(async (req: NextRequest) => {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    const body = await req.json();
    const { teamId, lineup } = body as {
        teamId: number;
        lineup: { oh1: number | null; mb1: number | null; opp: number | null; s: number | null; mb2: number | null; oh2: number | null; l: number | null };
    };

    // Check if user owns this team
    const userTeam = getUserTeam(session.userId!);
    if (!userTeam || userTeam.team_id !== teamId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate every assigned player is on this team and matches their slot's position
    const roster = getPlayers(teamId);
    const rosterById = new Map(roster.map(p => [p.id, p]));
    for (const [slot, playerId] of Object.entries(lineup)) {
        if (playerId == null) continue;
        const player = rosterById.get(playerId);
        if (!player) {
            return NextResponse.json({ error: `Player ${playerId} not on team ${teamId}` }, { status: 400 });
        }
        const required = SLOT_POSITION[slot];
        if (required && player.position !== required) {
            return NextResponse.json({
                error: `Slot ${slot.toUpperCase()} requires a ${required}; ${player.player_name} is a ${player.position}`,
            }, { status: 400 });
        }
    }

    saveSquadLineup(teamId, lineup);
    return NextResponse.json({ success: true });
});
