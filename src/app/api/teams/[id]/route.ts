import { NextRequest, NextResponse } from 'next/server';
import { getTeamById, updateTeamMoney, updateTeamStats } from '@/lib/db/queries';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const team = getTeamById(Number(id));
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    return NextResponse.json(team, {
        headers: {
            'Cache-Control': 'no-store, max-age=0',
        }
    });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const data = await req.json();
        if (data.team_money !== undefined) {
            updateTeamMoney(Number(id), data.team_money);
        } else {
            updateTeamStats(Number(id), data);
        }
        const team = getTeamById(Number(id));
        return NextResponse.json(team);
    } catch (err) {
        console.error('Error updating team:', err);
        return NextResponse.json({ error: 'Failed to update team' }, { status: 500 });
    }
}
