import { NextRequest, NextResponse } from 'next/server';
import { getPlayerById, updatePlayer, deletePlayer } from '@/lib/db/queries';
import { calculateOverall } from '@/lib/overall';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const player = getPlayerById(Number(id));
    if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    return NextResponse.json(player);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const data = await req.json();

        // Always recalculate overall from stats to keep it in sync
        const current = getPlayerById(Number(id));
        if (current) {
            const merged = { ...current, ...data };
            data.overall = calculateOverall(merged, merged.position ?? '');
        }

        updatePlayer(Number(id), data);
        const player = getPlayerById(Number(id));
        return NextResponse.json(player);
    } catch (error) {
        console.error('PATCH /api/players/[id] error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    deletePlayer(Number(id));
    return NextResponse.json({ success: true });
}
