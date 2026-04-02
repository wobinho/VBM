import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { updateOfferStatus, getOfferById, updatePlayer, updateTeamMoney, getTeamById, getPlayerById } from '@/lib/db/queries';
import { sessionOptions, SessionData } from '@/lib/auth/session';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;
    const { status } = await req.json();
    const offer = getOfferById(Number(id));

    if (!offer) return NextResponse.json({ error: 'Offer not found' }, { status: 404 });

    updateOfferStatus(Number(id), status);

    // Process accepted offers - transfer the player and money
    if (status === 'accepted') {
        const player = getPlayerById(offer.player_id);
        if (player && session.teamId) {
            // Get buyer and seller teams
            const buyerTeam = getTeamById(session.teamId);
            if (buyerTeam && player.team_id) {
                const sellerTeam = getTeamById(player.team_id);
                // Transfer money
                updateTeamMoney(session.teamId, buyerTeam.team_money - offer.offer_amount);
                if (sellerTeam) {
                    updateTeamMoney(player.team_id, sellerTeam.team_money + offer.offer_amount);
                }
                // Move player to buyer's team
                updatePlayer(offer.player_id, { team_id: session.teamId });
            }
        }
    }

    return NextResponse.json({ success: true });
}
