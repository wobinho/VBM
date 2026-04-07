import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    
    // 1. Get the current active cup (Copa Italia)
    // For now we assume Italy and current year, or just the latest active one
    const cup = db.prepare(`
      SELECT * FROM cup_competitions 
      WHERE status = 'active'
      ORDER BY year DESC, id DESC LIMIT 1
    `).get() as any;

    if (!cup) {
      return NextResponse.json({ error: 'No active cup found' }, { status: 404 });
    }

    // 2. Get rounds for this cup
    const rounds = db.prepare(`
      SELECT * FROM cup_rounds 
      WHERE cup_id = ? 
      ORDER BY round_number ASC
    `).all(cup.id) as any[];

    // 3. Get fixtures for all rounds
    const roundsWithFixtures = rounds.map(r => {
      const fixtures = db.prepare(`
        SELECT cf.*, 
               ht.team_name as home_team_name, 
               at.team_name as away_team_name
        FROM cup_fixtures cf
        JOIN teams ht ON cf.home_team_id = ht.id
        JOIN teams at ON cf.away_team_id = at.id
        WHERE cf.round_id = ?
        ORDER BY cf.id ASC
      `).all(r.id);
      
      return {
        ...r,
        fixtures
      };
    });

    return NextResponse.json({
      cup,
      rounds: roundsWithFixtures
    });
  } catch (error: any) {
    console.error('Error fetching cup data:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
