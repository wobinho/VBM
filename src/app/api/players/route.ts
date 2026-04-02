import { NextRequest, NextResponse } from 'next/server';
import { getPlayers, searchPlayers, getFreeAgents, createPlayer } from '@/lib/db/queries';

export async function GET(req: NextRequest) {
    const teamId = req.nextUrl.searchParams.get('teamId');
    const search = req.nextUrl.searchParams.get('search');
    const freeAgents = req.nextUrl.searchParams.get('freeAgents');

    if (search) return NextResponse.json(searchPlayers(search));
    if (freeAgents === 'true') return NextResponse.json(getFreeAgents());
    if (teamId) return NextResponse.json(getPlayers(Number(teamId)));
    return NextResponse.json(getPlayers());
}

export async function POST(req: NextRequest) {
    try {
        const data = await req.json();
        const id = createPlayer(data);
        return NextResponse.json({ success: true, id });
    } catch (error) {
        console.error('Create player error:', error);
        return NextResponse.json({ error: 'Failed to create player' }, { status: 500 });
    }
}
