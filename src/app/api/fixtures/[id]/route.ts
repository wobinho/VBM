import { NextResponse } from 'next/server';
import {
  getFixtureById, updateFixtureResult, updateTeamStatsAfterMatch,
  getSquadLineup, getPlayers, recordPlayoffGameResult,
  getGameState, getFixtures, getPlayoffGamesByDate,
  advanceGameDate, getCupFixtureById,
} from '@/lib/db/queries';
import { runFullMatch, autoLineupFromPlayers, SimLineup, SimPlayer, PlayerStatLine } from '@/lib/simulation-engine';
import { getDb } from '@/lib/db';
import { getCupFixturesByDate, recordCupFixtureResult } from '@/lib/cup-engine';

/**
 * PATCH /api/fixtures/[id] — Save the user's manually-simulated match result,
 * then simulate all other fixtures/playoff games on the same date.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const gameId = Number(id);
    const db = getDb();
    const { homeSets, awaySets, homePoints, awayPoints, playerStats } = await req.json();

    // 1. Determine if this is a regular fixture, playoff game, or cup game
    const { searchParams } = new URL(req.url);
    const typeS = searchParams.get('type'); // 'playoff' or 'cup'

    let fixture = null;
    let isPlayoffGame = typeS === 'playoff';
    let isCupGame = typeS === 'cup';
    let playoffGame: any = null;
    let cupGame: any = null;
    let targetDate: string;

    if (isPlayoffGame) {
      playoffGame = db.prepare(`
        SELECT pg.*,
          ht.team_name AS home_team_name,
          at.team_name AS away_team_name
        FROM playoff_games pg
        JOIN teams ht ON pg.home_team_id = ht.id
        JOIN teams at ON pg.away_team_id = at.id
        WHERE pg.id = ?
      `).get(gameId) as any;

      if (!playoffGame) return NextResponse.json({ error: 'Playoff game not found' }, { status: 404 });
      targetDate = playoffGame.scheduled_date;
    } else if (isCupGame) {
      cupGame = getCupFixtureById(gameId);
      if (!cupGame) return NextResponse.json({ error: 'Cup game not found' }, { status: 404 });
      targetDate = cupGame.scheduled_date;
    } else {
      fixture = getFixtureById(gameId);
      if (!fixture) {
        // Fallback: check playoff_games
        playoffGame = db.prepare(`
          SELECT pg.*,
            ht.team_name AS home_team_name,
            at.team_name AS away_team_name
          FROM playoff_games pg
          JOIN teams ht ON pg.home_team_id = ht.id
          JOIN teams at ON pg.away_team_id = at.id
          WHERE pg.id = ?
        `).get(gameId) as any;

        if (playoffGame) {
          isPlayoffGame = true;
          targetDate = playoffGame.scheduled_date;
        } else {
          // Fallback: check cup_fixtures
          cupGame = getCupFixtureById(gameId);
          if (cupGame) {
            isCupGame = true;
            targetDate = cupGame.scheduled_date;
          } else {
            return NextResponse.json({ error: 'Game not found' }, { status: 404 });
          }
        }
      } else {
        targetDate = fixture.scheduled_date;
      }
    }

    // 2. Save the user's match result
    const seasonYear = parseInt(targetDate.slice(0, 4), 10);

    if (isPlayoffGame) {
      recordPlayoffGameResult(gameId, {
        home_sets:   homeSets,
        away_sets:   awaySets,
        home_points: homePoints ?? 0,
        away_points: awayPoints ?? 0,
      });
      if (playerStats?.length) {
        insertPlayerMatchStats(db, playerStats, 'playoff', gameId, seasonYear);
      }
    } else if (isCupGame) {
      recordCupFixtureResult(gameId, {
        home_sets:   homeSets,
        away_sets:   awaySets,
        home_points: homePoints ?? 0,
        away_points: awayPoints ?? 0,
      });
      if (playerStats?.length) {
        insertPlayerMatchStats(db, playerStats, 'cup', gameId, seasonYear);
      }
    } else if (fixture) {
      updateFixtureResult(gameId, {
        home_sets:   homeSets,
        away_sets:   awaySets,
        home_points: homePoints ?? 0,
        away_points: awayPoints ?? 0,
      });
      updateTeamStatsAfterMatch(
        fixture.home_team_id, fixture.away_team_id,
        homeSets, awaySets,
        homePoints ?? 0, awayPoints ?? 0,
      );
      if (playerStats?.length) {
        insertPlayerMatchStats(db, playerStats, 'league', gameId, seasonYear);
      }
    }

    // 3. Simulate all remaining regular fixtures on the same date
    const dayFixtures = getFixtures({ date: targetDate });
    for (const f of dayFixtures) {
      if (f.status === 'completed' || (!isPlayoffGame && !isCupGame && f.id === gameId)) continue;
      const homeLu = buildLineup(f.home_team_id);
      const awayLu = buildLineup(f.away_team_id);
      const result = runFullMatch(homeLu, awayLu);
      updateFixtureResult(f.id, {
        home_sets:   result.homeSets,
        away_sets:   result.awaySets,
        home_points: result.homeTotalPoints,
        away_points: result.awayTotalPoints,
      });
      updateTeamStatsAfterMatch(f.home_team_id, f.away_team_id, result.homeSets, result.awaySets, result.homeTotalPoints, result.awayTotalPoints);
    }

    // 4. Simulate all remaining playoff games on the same date
    const dayPlayoffGames = getPlayoffGamesByDate(targetDate);
    for (const pg of dayPlayoffGames) {
      if (pg.status === 'completed' || (isPlayoffGame && pg.id === gameId)) continue;
      const homeLu = buildLineup(pg.home_team_id);
      const awayLu = buildLineup(pg.away_team_id);
      const result = runFullMatch(homeLu, awayLu);
      recordPlayoffGameResult(pg.id, {
        home_sets:   result.homeSets,
        away_sets:   result.awaySets,
        home_points: result.homeTotalPoints,
        away_points: result.awayTotalPoints,
      });
    }

    // 4b. Simulate all remaining cup fixtures on the same date
    const dayCupFixtures = getCupFixturesByDate(targetDate);
    for (const cf of dayCupFixtures) {
      if (cf.status === 'completed' || (isCupGame && cf.id === gameId)) continue;
      const homeLu = buildLineup(cf.home_team_id);
      const awayLu = buildLineup(cf.away_team_id);
      const result = runFullMatch(homeLu, awayLu);
      recordCupFixtureResult(cf.id, {
        home_sets:   result.homeSets,
        away_sets:   result.awaySets,
        home_points: result.homeTotalPoints,
        away_points: result.awayTotalPoints,
      });
    }

    // 5. If ALL fixtures for this date (regular, playoff, cup) are now complete,
    // automatically advance the game date to the next day.
    const allReg = getFixtures({ date: targetDate });
    const allPo  = getPlayoffGamesByDate(targetDate, true);
    const allCup = getCupFixturesByDate(targetDate);
    
    const anyPendingReg = allReg.some(f => f.status === 'scheduled');
    const anyPendingPo  = allPo.some(pg => pg.status === 'scheduled');
    const anyPendingCup = allCup.length > 0;

    if (!anyPendingReg && !anyPendingPo && !anyPendingCup) {
      const current = new Date(targetDate);
      current.setDate(current.getDate() + 1);
      const nextDate = current.toISOString().slice(0, 10);
      advanceGameDate(nextDate);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error saving match result:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** GET /api/fixtures/[id] — fetch a single fixture */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const gameId = Number(id);
  const { searchParams } = new URL(req.url);
  const typeS = searchParams.get('type');

  const db = getDb();

  if (typeS === 'playoff') {
    const playoffGame = db.prepare(`
      SELECT pg.*,
        ht.team_name AS home_team_name,
        at.team_name AS away_team_name
      FROM playoff_games pg
      JOIN teams ht ON pg.home_team_id = ht.id
      JOIN teams at ON pg.away_team_id = at.id
      WHERE pg.id = ?
    `).get(gameId) as any;
    if (!playoffGame) return NextResponse.json({ error: 'Playoff game not found' }, { status: 404 });
    return NextResponse.json({
      ...playoffGame,
      is_playoff: true,
      season_name: 'Playoffs',
    });
  }

  if (typeS === 'cup') {
    const cupGame = getCupFixtureById(gameId);
    if (!cupGame) return NextResponse.json({ error: 'Cup game not found' }, { status: 404 });
    return NextResponse.json({
      ...cupGame,
      is_cup: true,
      season_name: cupGame.cup_name ?? 'Cup',
    });
  }

  const fixture = getFixtureById(gameId);
  if (!fixture) {
    // try playoff fallback
    const playoffGame = db.prepare(`
      SELECT pg.*,
        ht.team_name AS home_team_name,
        at.team_name AS away_team_name
      FROM playoff_games pg
      JOIN teams ht ON pg.home_team_id = ht.id
      JOIN teams at ON pg.away_team_id = at.id
      WHERE pg.id = ?
    `).get(gameId) as any;
    if (playoffGame) {
      return NextResponse.json({...playoffGame, is_playoff: true, season_name: 'Playoffs'});
    }
    // try cup fallback
    const cupGame = getCupFixtureById(gameId);
    if (cupGame) {
       return NextResponse.json({...cupGame, is_cup: true, season_name: cupGame.cup_name ?? 'Cup'});
    }
    return NextResponse.json({ error: 'Fixture not found' }, { status: 404 });
  }
  return NextResponse.json(fixture);
}

/**
 * POST /api/fixtures/[id] — Quick Sim: simulate the target fixture AND all other
 * fixtures/playoff games on the same date, then persist all results.
 *
 * This behaves like simulate-matchday but includes the user's game.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const gameId = Number(id);
    const db = getDb();

    const state = getGameState();
    if (!state) return NextResponse.json({ error: 'Game state not initialized' }, { status: 500 });

    const currentDate = state.current_date;

    const { searchParams } = new URL(req.url);
    const typeS = searchParams.get('type');

    // Determine if this is a regular fixture or playoff game
    let targetFixture = null;
    let isPlayoffGame = typeS === 'playoff';
    let targetPlayoffGame: any = null;
    let targetDate: string;

    if (isPlayoffGame) {
      targetPlayoffGame = db.prepare(`
        SELECT pg.*,
          ht.team_name AS home_team_name,
          at.team_name AS away_team_name
        FROM playoff_games pg
        JOIN teams ht ON pg.home_team_id = ht.id
        JOIN teams at ON pg.away_team_id = at.id
        WHERE pg.id = ?
      `).get(gameId) as any;

      if (!targetPlayoffGame) return NextResponse.json({ error: 'Playoff game not found' }, { status: 404 });
      targetDate = targetPlayoffGame.scheduled_date;
    } else {
      targetFixture = getFixtureById(gameId);
      if (!targetFixture) {
        targetPlayoffGame = db.prepare(`
          SELECT pg.*,
            ht.team_name AS home_team_name,
            at.team_name AS away_team_name
          FROM playoff_games pg
          JOIN teams ht ON pg.home_team_id = ht.id
          JOIN teams at ON pg.away_team_id = at.id
          WHERE pg.id = ?
        `).get(gameId) as any;

        if (targetPlayoffGame) {
          isPlayoffGame = true;
          targetDate = targetPlayoffGame.scheduled_date;
        } else {
          return NextResponse.json({ error: 'Fixture not found' }, { status: 404 });
        }
      } else {
        targetDate = targetFixture.scheduled_date;
      }
    }

    // ── Simulate all regular fixtures on this date ───────────────────────────────
    const dayFixtures = getFixtures({ date: targetDate });
    const simulatedRegular = [];

    for (const f of dayFixtures) {
      if (f.status === 'completed') continue;

      const homeLu = buildLineup(f.home_team_id);
      const awayLu = buildLineup(f.away_team_id);
      const result = runFullMatch(homeLu, awayLu);

      updateFixtureResult(f.id, {
        home_sets:   result.homeSets,
        away_sets:   result.awaySets,
        home_points: result.homeTotalPoints,
        away_points: result.awayTotalPoints,
      });
      updateTeamStatsAfterMatch(f.home_team_id, f.away_team_id, result.homeSets, result.awaySets, result.homeTotalPoints, result.awayTotalPoints);

      const updated = getFixtureById(f.id);
      simulatedRegular.push({
        id:       f.id,
        homeTeam: updated?.home_team_name ?? f.home_team_id.toString(),
        awayTeam: updated?.away_team_name ?? f.away_team_id.toString(),
        homeSets: result.homeSets,
        awaySets: result.awaySets,
        winner:   result.winner,
        type:     'regular',
      });
    }

    // ── Simulate all playoff games on this date ─────────────────────────────────
    const dayPlayoffGames = getPlayoffGamesByDate(targetDate);
    const simulatedPlayoff = [];

    for (const pg of dayPlayoffGames) {
      if (pg.status === 'completed') continue;

      const homeLu = buildLineup(pg.home_team_id);
      const awayLu = buildLineup(pg.away_team_id);
      const result = runFullMatch(homeLu, awayLu);

      recordPlayoffGameResult(pg.id, {
        home_sets:   result.homeSets,
        away_sets:   result.awaySets,
        home_points: result.homeTotalPoints,
        away_points: result.awayTotalPoints,
      });

      simulatedPlayoff.push({
        id:       pg.id,
        homeTeam: pg.home_team_name ?? pg.home_team_id.toString(),
        awayTeam: pg.away_team_name ?? pg.away_team_id.toString(),
        homeSets: result.homeSets,
        awaySets: result.awaySets,
        winner:   result.winner,
        type:     'playoff',
      });
    }

    const allSimulated = [...simulatedRegular, ...simulatedPlayoff];

    return NextResponse.json({
      date: targetDate,
      simulatedCount: allSimulated.length,
      simulated: allSimulated,
    });
  } catch (error) {
    console.error('Error simulating fixture:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


// ─── Helpers ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function insertPlayerMatchStats(
  db: any,
  stats: PlayerStatLine[],
  fixtureType: 'league' | 'playoff' | 'cup',
  fixtureId: number,
  seasonYear: number,
) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO player_match_stats
      (player_id, team_id, season_year, fixture_type, fixture_id, points, spikes, blocks, aces, digs)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const s of stats) {
    stmt.run(s.playerId, s.teamId || null, seasonYear, fixtureType, fixtureId, s.points, s.spikes, s.blocks, s.aces, s.digs);
  }
}

function buildLineup(teamId: number): SimLineup {
  const saved = getSquadLineup(teamId);
  const players = getPlayers(teamId) as unknown as SimPlayer[];

  if (saved) {
    const idMap = new Map(players.map(p => [p.id, p]));
    const lu: SimLineup = {
      OH1: saved.oh1_player_id ? (idMap.get(saved.oh1_player_id) ?? null) : null,
      MB1: saved.mb1_player_id ? (idMap.get(saved.mb1_player_id) ?? null) : null,
      OPP: saved.opp_player_id ? (idMap.get(saved.opp_player_id) ?? null) : null,
      S:   saved.s_player_id   ? (idMap.get(saved.s_player_id)   ?? null) : null,
      MB2: saved.mb2_player_id ? (idMap.get(saved.mb2_player_id) ?? null) : null,
      OH2: saved.oh2_player_id ? (idMap.get(saved.oh2_player_id) ?? null) : null,
      L:   saved.l_player_id   ? (idMap.get(saved.l_player_id)   ?? null) : null,
    };
    // If saved lineup has at least 5 valid players, use it; otherwise fall back to auto
    const filled = Object.values(lu).filter(Boolean).length;
    if (filled >= 5) return lu;
  }

  return autoLineupFromPlayers(players);
}
