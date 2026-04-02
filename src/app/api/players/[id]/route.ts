import { NextRequest, NextResponse } from 'next/server';
import { getPlayerById, updatePlayer, deletePlayer } from '@/lib/db/queries';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const player = getPlayerById(Number(id));
    if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    return NextResponse.json(player);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const data = await req.json();
    updatePlayer(Number(id), data);
    const player = getPlayerById(Number(id));
    return NextResponse.json(player);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    deletePlayer(Number(id));
    return NextResponse.json({ success: true });
}
