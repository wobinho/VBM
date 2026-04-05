import { NextRequest, NextResponse } from 'next/server';
import { createPlayer } from '@/lib/db/queries';

interface BulkPlayerData {
  version: string;
  created_at: string;
  players: Array<{
    player_name: string;
    position: string;
    age: number;
    country: string;
    jersey_number: number;
    height?: number;
    potential?: number;
    overall: number;
    attack: number;
    defense: number;
    serve: number;
    block: number;
    receive: number;
    setting: number;
    precision?: number;
    flair?: number;
    digging?: number;
    positioning?: number;
    ball_control?: number;
    technique?: number;
    playmaking?: number;
    spin?: number;
    speed?: number;
    agility?: number;
    strength?: number;
    endurance?: number;
    vertical?: number;
    flexibility?: number;
    torque?: number;
    balance?: number;
    leadership?: number;
    teamwork?: number;
    concentration?: number;
    pressure?: number;
    consistency?: number;
    vision?: number;
    game_iq?: number;
    intimidation?: number;
    contract_years?: number;
    monthly_wage?: number;
    player_value?: number;
  }>;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const bulkData: BulkPlayerData = body;

    // Validate structure
    if (!bulkData.version || !Array.isArray(bulkData.players)) {
      return NextResponse.json(
        { error: 'Invalid bulk player format. Must contain version and players array.' },
        { status: 400 }
      );
    }

    if (bulkData.players.length === 0) {
      return NextResponse.json(
        { error: 'Players array is empty.' },
        { status: 400 }
      );
    }

    // Set defaults for optional fields
    const defaultStats = {
      precision: 50,
      flair: 50,
      digging: 50,
      positioning: 50,
      ball_control: 50,
      technique: 50,
      playmaking: 50,
      spin: 50,
      speed: 50,
      agility: 50,
      strength: 50,
      endurance: 50,
      vertical: 50,
      flexibility: 50,
      torque: 50,
      balance: 50,
      leadership: 50,
      teamwork: 50,
      concentration: 50,
      pressure: 50,
      consistency: 50,
      vision: 50,
      game_iq: 50,
      intimidation: 50,
      contract_years: 1,
      monthly_wage: 1000,
      player_value: 100000,
    };

    const results = [];
    const errors = [];

    for (let i = 0; i < bulkData.players.length; i++) {
      try {
        const player = bulkData.players[i];

        // Merge with defaults
        const playerData: any = {
          team_id: null,
          ...defaultStats,
          ...player,
        };

        // Validate required fields
        const requiredFields = ['player_name', 'position', 'age', 'country', 'jersey_number', 'overall', 'attack', 'defense', 'serve', 'block', 'receive', 'setting'];
        let hasError = false;
        for (const field of requiredFields) {
          if (playerData[field] === undefined || playerData[field] === null) {
            errors.push({
              index: i,
              player_name: player.player_name || 'Unknown',
              error: `Missing required field: ${field}`,
            });
            hasError = true;
          }
        }
        if (hasError) continue;

        const id = createPlayer(playerData);
        results.push({
          index: i,
          player_id: id,
          player_name: player.player_name,
          success: true,
        });
      } catch (error) {
        errors.push({
          index: i,
          player_name: bulkData.players[i].player_name || 'Unknown',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      created: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Bulk player import error:', error);
    return NextResponse.json(
      { error: 'Failed to process bulk player import', details: error instanceof Error ? error.message : '' },
      { status: 500 }
    );
  }
}
