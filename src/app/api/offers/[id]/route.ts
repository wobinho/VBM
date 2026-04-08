import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { updateOfferStatus, getOfferById, updatePlayer, updateTeamMoney, getTeamById, getPlayerById, getGameState } from '@/lib/db/queries';
import { getDb } from '@/lib/db';
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
                // Record team history for next season
                const gs = getGameState();
                const year = gs ? parseInt(gs.current_date.slice(0, 4), 10) : new Date().getFullYear();
                const db = getDb();
                db.prepare(`
                  INSERT OR REPLACE INTO player_team_history (player_id, team_id, team_name, season_year)
                  VALUES (?, ?, ?, ?)
                `).run(offer.player_id, session.teamId, buyerTeam.team_name, year);
            }
        }
    }

    return NextResponse.json({ success: true });
}
