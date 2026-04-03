import { NextRequest, NextResponse } from 'next/server';
import { getPlayerById, updatePlayer, deletePlayer, calculateOverall } from '@/lib/db/queries';

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
            data.overall = calculateOverall(
                merged.attack ?? 50, merged.defense ?? 50, merged.serve ?? 50,
                merged.block ?? 50, merged.receive ?? 50, merged.setting ?? 50,
                merged.speed ?? 50, merged.agility ?? 50, merged.strength ?? 50,
                merged.endurance ?? 50, merged.vertical ?? 50, merged.flexibility ?? 50,
                merged.torque ?? 50, merged.balance ?? 50,
                merged.leadership ?? 50, merged.teamwork ?? 50, merged.concentration ?? 50,
                merged.pressure ?? 50, merged.consistency ?? 50, merged.vision ?? 50,
                merged.game_iq ?? 50, merged.intimidation ?? 50,
                merged.position ?? '',
                merged.precision ?? 50, merged.flair ?? 50, merged.digging ?? 50,
                merged.positioning ?? 50, merged.ball_control ?? 50, merged.technique ?? 50,
                merged.playmaking ?? 50, merged.spin ?? 50,
            );
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
