import { NextResponse } from 'next/server';
import { getDb, runWithDb } from '@/lib/db';
import { withUserDb } from '@/lib/db/with-user-db';
import {
  getGameState, advanceGameDate, getFixtures, getPlayoffGamesByDate,
  runMonthlyEconomy, recordPlayoffGameResult,
} from '@/lib/db/queries';
import { runFastMatch } from '@/lib/fast-match';
import type { PlayerStatLine } from '@/lib/simulation-engine';
import { getCupFixturesByDate, recordCupFixtureResult } from '@/lib/cup-engine';
import { createSimCache } from '@/lib/sim-cache';

/**
 * POST /api/simulate-to-date
 * Body: { targetDate: "YYYY-MM-DD" }
 *
 * Streams day-by-day simulation progress using Server-Sent Events (SSE).
 * Simulates ALL fixtures AND playoff games on every match day, reporting progress in real-time.
 */
export const POST = withUserDb(async (req) => {
  const db = getDb();

  let { targetDate } = await req.json() as { targetDate: string };
  if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return NextResponse.json({ error: 'Invalid targetDate' }, { status: 400 });
  }

  const state = getGameState();
  if (!state) return NextResponse.json({ error: 'Game state not initialized' }, { status: 500 });

  if (targetDate <= state.current_date) {
    return NextResponse.json({ error: 'Target date must be after the current date' }, { status: 400 });
  }

  const { generateAllCups } = await import('@/lib/cup-engine');
  const { generatePlayoffs } = await import('@/lib/db/queries');

  // Pre-generate playoffs if we're simulating into the playoff period (May 1 - Jun 30)
  // but haven't reached Jun 30 yet
  const year = parseInt(state.current_date.slice(0, 4), 10);
  const currentDate = new Date(state.current_date);
  const targetDateObj = new Date(targetDate);
  const may1 = new Date(year, 4, 1);
  const jun30 = new Date(year, 5, 30);

  // If target is in playoff period but current is before Jun 30, generate playoffsNow
  if (targetDateObj >= may1 && targetDateObj <= jun30 && currentDate < jun30) {
    const tier2Seasons = db.prepare(`
      SELECT s.id FROM seasons s
      JOIN leagues l ON s.league_id = l.id
      WHERE s.status = 'active' AND l.tier = 2
    `).all() as { id: number }[];

    for (const { id: seasonId } of tier2Seasons) {
      generatePlayoffs(seasonId);
    }
  }

  // Create a ReadableStream to send SSE updates.
  // The IIFE below runs *after* the handler returns, which would normally lose
  // the AsyncLocalStorage DB context. Re-enter it via runWithDb so getDb() works.
  const stream = new ReadableStream({
    start(controller) {
      runWithDb(db, async () => {
        try {
          let cursor = new Date(state.current_date);
          const end = new Date(targetDate);
          const totalDays = Math.ceil((end.getTime() - cursor.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          let daysProcessed = 0;

          // One SimCache for the entire range. Rosters/lineups are reused across
          // days; we only invalidate on monthly economy boundaries below if
          // needed (currently nothing in the simulate-to-date path mutates
          // player stats, so a single cache is safe).
          const sim = createSimCache();

          const insertPlayerStatsStmt = db.prepare(`
            INSERT OR REPLACE INTO player_match_stats
              (player_id, team_id, season_year, fixture_type, fixture_id, points, spikes, blocks, aces, digs)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          const insertPlayerStats = (
            stats: PlayerStatLine[],
            fixtureType: 'league' | 'playoff' | 'cup',
            fixtureId: number,
            seasonYear: number,
          ) => {
            for (const s of stats) {
              insertPlayerStatsStmt.run(
                s.playerId, s.teamId || null, seasonYear, fixtureType, fixtureId,
                s.points, s.spikes, s.blocks, s.aces, s.digs,
              );
            }
          };

          const execute = db.transaction(() => {
            while (cursor <= end) {
              const dateStr = cursor.toISOString().slice(0, 10);
              daysProcessed++;

              // ── Gate: Generate playoffs if reaching Jun 30 ───────────────────────────────
              const year = dateStr.slice(0, 4);
              if (dateStr === `${year}-06-30`) {
                // Generate playoffs for all tier-2 league seasons
                const tier2Seasons = db.prepare(`
                  SELECT s.id FROM seasons s
                  JOIN leagues l ON s.league_id = l.id
                  WHERE s.status = 'active' AND l.tier = 2
                `).all() as { id: number }[];

                for (const { id: seasonId } of tier2Seasons) {
                  generatePlayoffs(seasonId);
                }
              }

              // ── Gate: Generate cups if reaching Jul 1 ───────────────────────────────────
              if (dateStr === `${year}-07-01`) {
                generateAllCups(parseInt(year, 10));
              }

              // ── Simulate regular season fixtures ───────────────────────────────────────
              const fixtures = getFixtures({ date: dateStr, status: 'scheduled' });
              const matchesOnDay: Array<{
                type: string; home?: string; away?: string;
                result?: string; cup?: string;
              }> = [];

              if (fixtures.length > 0) {
                for (const f of fixtures) {
                  const homeStr = sim.buildFastStrengths(f.home_team_id);
                  const awayStr = sim.buildFastStrengths(f.away_team_id);
                  const result = runFastMatch(homeStr, awayStr, f.home_team_id, f.away_team_id);
                  sim.updateFixtureResult(f.id, {
                    home_sets:   result.homeSets,
                    away_sets:   result.awaySets,
                    home_points: result.homeTotalPoints,
                    away_points: result.awayTotalPoints,
                  });
                  sim.updateTeamStatsAfterMatch(
                    f.home_team_id, f.away_team_id,
                    result.homeSets, result.awaySets,
                    result.homeTotalPoints, result.awayTotalPoints,
                  );
                  if (result.playerStats?.length) {
                    insertPlayerStats(result.playerStats, 'league', f.id, parseInt(dateStr.slice(0, 4), 10));
                  }

                  matchesOnDay.push({
                    type: 'league',
                    home: f.home_team_name,
                    away: f.away_team_name,
                    result: `${result.homeSets}-${result.awaySets}`,
                  });
                }
              }

              // ── Simulate playoff games ────────────────────────────────────────────────
              const playoffGames = getPlayoffGamesByDate(dateStr);
              if (playoffGames.length > 0) {
                for (const pg of playoffGames) {
                  if (pg.status === 'completed') continue;

                  const homeStr = sim.buildFastStrengths(pg.home_team_id);
                  const awayStr = sim.buildFastStrengths(pg.away_team_id);
                  const result = runFastMatch(homeStr, awayStr, pg.home_team_id, pg.away_team_id);

                  recordPlayoffGameResult(pg.id, {
                    home_sets:   result.homeSets,
                    away_sets:   result.awaySets,
                    home_points: result.homeTotalPoints,
                    away_points: result.awayTotalPoints,
                  });
                  if (result.playerStats?.length) {
                    insertPlayerStats(result.playerStats, 'playoff', pg.id, parseInt(dateStr.slice(0, 4), 10));
                  }

                  matchesOnDay.push({
                    type: 'playoff',
                    home: pg.home_team_name,
                    away: pg.away_team_name,
                    result: `${result.homeSets}-${result.awaySets}`,
                  });
                }
              }

              // ── Simulate cup fixtures ────────────────────────────────────────────────────
              const cupFixtures = getCupFixturesByDate(dateStr);
              if (cupFixtures.length > 0) {
                for (const cf of cupFixtures) {
                  if (cf.status === 'completed') continue;

                  const homeStr = sim.buildFastStrengths(cf.home_team_id);
                  const awayStr = sim.buildFastStrengths(cf.away_team_id);
                  const result = runFastMatch(homeStr, awayStr, cf.home_team_id, cf.away_team_id);

                  recordCupFixtureResult(cf.id, {
                    home_sets:   result.homeSets,
                    away_sets:   result.awaySets,
                    home_points: result.homeTotalPoints,
                    away_points: result.awayTotalPoints,
                  });
                  if (result.playerStats?.length) {
                    insertPlayerStats(result.playerStats, 'cup', cf.id, parseInt(dateStr.slice(0, 4), 10));
                  }

                  matchesOnDay.push({
                    type: 'cup',
                    cup: cf.cup_name,
                    home: cf.home_team_name,
                    away: cf.away_team_name,
                    result: `${result.homeSets}-${result.awaySets}`,
                  });
                }
              }

              // Monthly economy on the 1st
              if (dateStr.endsWith('-01')) {
                const month = dateStr.slice(0, 7);
                const allTeams = db.prepare('SELECT id FROM teams').all() as { id: number }[];
                for (const t of allTeams) runMonthlyEconomy(t.id, month);
              }

              // Send SSE update for this day
              const data = {
                date: dateStr,
                matches: matchesOnDay,
                progress: {
                  current: daysProcessed,
                  total: totalDays,
                  percent: Math.round((daysProcessed / totalDays) * 100),
                },
              };
              controller.enqueue(
                new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
              );

              cursor.setDate(cursor.getDate() + 1);
            }

            advanceGameDate(targetDate);
          });

          execute();

          // Send completion event
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify({ status: 'complete', targetDate })}\n\n`)
          );
          controller.close();
        } catch (error) {
          console.error('Error in simulate-to-date:', error);
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify({ status: 'error', error: String(error) })}\n\n`)
          );
          controller.close();
        }
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
});
