/**
 * Schedule Engine
 *
 * Regular Season (Jan 1 – Jun 30):
 *   Round-robin fixture generation on Monday / Wednesday / Friday.
 *   Number of rounds and date range are controlled by LeagueConfig.
 *   - Leagues with playoffs: regular season Jan 1 – Apr 30 (typically 3 rounds)
 *   - Leagues without playoffs: regular season Jan 1 – Jun 30 (typically 3 rounds)
 *
 * Post-Season / Playoffs (May 1 – Jun 30) — tier-2 leagues with playoffs only:
 *   Round 1 – Conference Semifinals (4 series): N1vN4, N2vN3, S1vS4, S2vS3
 *   Round 2 – Conference Finals       (2 series): North, South
 *   Round 3 – Grand Final             (1 series): North champ vs South champ
 *
 *   Each series is best-of-5 (first to 3 wins). Only the first 3 games are
 *   pre-scheduled (minimum needed for a 3-0 sweep). Games 4-5 are scheduled
 *   dynamically only if the series needs them.
 *
 *   Games alternate Monday / Wednesday / Friday:
 *     Game 1: Monday     (round start)
 *     Game 2: Wednesday  (+2 days)
 *     Game 3: Friday     (+4 days from game 1)
 *     Game 4: Monday     (+9 days from game 1) — scheduled only if needed
 *     Game 5: Wednesday  (+11 days from game 1) — scheduled only if needed
 *
 *   Next round's game-1 Monday comes 18 days after Round 1's game-1 Monday.
 *
 *   Round 1 starts on the first Monday of May.
 *   Round 2 starts once ALL Round 1 series are complete (next round generated dynamically).
 *   Round 3 starts once ALL Round 2 series are complete (next round generated dynamically).
 *
 * Cup Block (Aug 1 – Dec 31):
 *   - Mondays: National Cups (single-elimination or group-knockout)
 *   - Wednesdays: Champions League-type cups (group-knockout to knockout)
 *   - Fridays: Secondary cups (single-elimination)
 *   Day-slot scheduling is driven by cup_type, not by a separate column.
 */

export interface FixtureSlot {
  game_week: number;
  home_team_id: number;
  away_team_id: number;
  scheduled_date: string; // YYYY-MM-DD
}

export interface PlayoffGameSlot {
  series_round: number;     // 1, 2, or 3
  conference: string | null;// 'north', 'south', or null for grand final
  seed_high: number;        // higher seed (1 beats 4, etc.)
  seed_low: number;
  home_team_id: number;
  away_team_id: number;
  game_number: number;      // 1–5 within the series
  scheduled_date: string;
}

/** Format a Date as YYYY-MM-DD using local time (avoids UTC rollback on toISOString). */
function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Returns all Saturdays in [startDate, endDate] inclusive. */
function getSaturdaysInRange(startDate: Date, endDate: Date): string[] {
  const saturdays: string[] = [];
  const d = new Date(startDate);
  // Advance to first Saturday (day 6)
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
  while (d <= endDate) {
    saturdays.push(toLocalDateString(d));
    d.setDate(d.getDate() + 7);
  }
  return saturdays;
}

/** Returns all dates of a given weekday (0=Sun…6=Sat) in [startDate, endDate] inclusive. */
function getDatesForWeekday(startDate: Date, endDate: Date, weekday: number): string[] {
  const dates: string[] = [];
  const d = new Date(startDate);
  while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
  while (d <= endDate) {
    dates.push(toLocalDateString(d));
    d.setDate(d.getDate() + 7);
  }
  return dates;
}

/**
 * Returns an ordered list of matchday dates for the regular season.
 * Pools Mondays (weekday 1), Wednesdays (weekday 3), and Fridays (weekday 5)
 * from [startDate, endDate], merges chronologically, returns first `totalRounds` dates.
 *
 * Algorithm:
 *   1. Collect all Mondays, Wednesdays, Fridays in the date range.
 *   2. Merge and sort chronologically.
 *   3. Return the first `totalRounds` dates from the merged pool.
 */
function getRegularSeasonMatchdays(startDate: Date, endDate: Date, totalRounds: number): string[] {
  const mondays    = getDatesForWeekday(startDate, endDate, 1);
  const wednesdays = getDatesForWeekday(startDate, endDate, 3);
  const fridays    = getDatesForWeekday(startDate, endDate, 5);

  // Merge all three day pools and sort chronologically
  const all = [...mondays, ...wednesdays, ...fridays].sort();

  if (all.length < totalRounds) {
    throw new Error(`Not enough Mon/Wed/Fri dates in range for ${totalRounds} rounds (found ${all.length})`);
  }

  return all.slice(0, totalRounds);
}

/**
 * Polygon round-robin algorithm for n teams (n must be even).
 */
function pairsForRound(
  rotating: number[],
  fixed: number,
  pass: number,
  round: number,
): [number, number][] {
  const n = rotating.length + 1;
  const pairs: [number, number][] = [];

  if (pass % 2 === 0) {
    pairs.push([rotating[0], fixed]);
  } else {
    pairs.push([fixed, rotating[0]]);
  }

  for (let i = 1; i < n / 2; i++) {
    const t1 = rotating[i];
    const t2 = rotating[n - 1 - i];
    if ((pass + round + i) % 2 === 0) {
      pairs.push([t1, t2]);
    } else {
      pairs.push([t2, t1]);
    }
  }

  return pairs;
}

/** Fisher-Yates shuffle — mutates array in place. */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Generate a round-robin schedule for any number of rounds, spread across a given date range.
 *
 * RNG is applied in two ways so each season looks different:
 *   1. The team array is shuffled before scheduling — changes who faces who each week.
 *   2. The order of passes is shuffled — changes which pass runs first/second/third,
 *      altering the home/away distribution across the calendar.
 *
 * @param teamIds   - array of team IDs (even count)
 * @param rounds    - number of round-robin passes (1=single, 2=double, 3=triple)
 * @param startDate - first day of the regular season
 * @param endDate   - last day of the regular season (strict cutoff)
 */
export function generateRoundRobinSchedule(
  teamIds: number[],
  rounds: number,
  startDate: Date,
  endDate: Date,
): FixtureSlot[] {
  const n = teamIds.length;
  if (n < 2 || n % 2 !== 0) throw new Error('Team count must be an even number ≥ 2');

  const totalRounds = rounds * (n - 1);

  const datePool = getRegularSeasonMatchdays(startDate, endDate, totalRounds);
  if (datePool.length < totalRounds) {
    throw new Error(`Not enough matchdays before season end for ${totalRounds} rounds (found ${datePool.length})`);
  }

  // RNG #1: shuffle team order so matchup pairings differ each season
  const shuffledTeams = shuffle([...teamIds]);

  // RNG #2: shuffle pass order so home/away patterns vary across the calendar
  const passOrder = shuffle(Array.from({ length: rounds }, (_, i) => i));

  const fixtures: FixtureSlot[] = [];
  let gameWeek = 1;

  for (const pass of passOrder) {
    const rotating = [...shuffledTeams.slice(0, n - 1)];
    const fixed = shuffledTeams[n - 1];

    for (let round = 0; round < n - 1; round++) {
      const date = datePool[gameWeek - 1];
      const pairs = pairsForRound(rotating, fixed, pass, round);

      for (const [home, away] of pairs) {
        fixtures.push({ game_week: gameWeek, home_team_id: home, away_team_id: away, scheduled_date: date });
      }

      gameWeek++;
      rotating.push(rotating.shift()!);
    }
  }

  return fixtures;
}

/**
 * Generate a triple round-robin schedule spread across Jan 1 – Jun 30.
 * Thin wrapper around generateRoundRobinSchedule for backwards compatibility.
 *
 * @param teamIds - array of team IDs (even count)
 * @param year    - the season calendar year
 */
export function generateTripleRoundRobin(
  teamIds: number[],
  year: number,
): FixtureSlot[] {
  return generateRoundRobinSchedule(
    teamIds,
    3,
    new Date(year, 0, 1),  // Jan 1
    new Date(year, 5, 30), // Jun 30
  );
}

/**
 * Generate all playoff game slots for a given year.
 *
 * seedings: an object mapping conference ('north'/'south') to an ordered array
 * of team IDs from rank 1 (best) to rank 4.
 *
 * Schedule:
 *   Round 1 (Conf Semis): starts first Saturday in September — 5 weekly slots
 *   Round 2 (Conf Finals): starts 5 Saturdays after Round 1 start — 5 weekly slots
 *   Round 3 (Grand Final): starts 5 Saturdays after Round 2 start — 5 weekly slots
 *
 * All rounds stay within Sep 1 – Nov 30.
 */
export function generatePlayoffSchedule(
  seedings: { north: number[]; south: number[] },
  year: number,
): PlayoffGameSlot[] {
  // Build pool of Saturdays for Sep 1 – Nov 30
  const playoffStart = new Date(year, 8, 1);   // Sep 1
  const playoffEnd   = new Date(year, 10, 30); // Nov 30
  const saturdays    = getSaturdaysInRange(playoffStart, playoffEnd);

  // Saturdays are indexed 0-based. Each round gets 5 slots.
  // Round 1 starts at index 0 (first Saturday ≥ Sep 1)
  // Round 2 starts at index 5
  // Round 3 starts at index 10
  const roundStartIdx = [0, 5, 10];

  const slots: PlayoffGameSlot[] = [];

  // Helper: schedule 5 games of a series starting at a given Saturday index
  function scheduleSeries(
    round: number,
    conference: string | null,
    seedHigh: number,
    seedLow: number,
    highTeamId: number,
    lowTeamId: number,
    startSatIdx: number,
  ) {
    for (let g = 0; g < 5; g++) {
      const satIdx = startSatIdx + g;
      const date = saturdays[Math.min(satIdx, saturdays.length - 1)];

      // Home/away rotation: games 1,2 at high seed's home; 3,4 at low seed's home; 5 at high seed's home
      let homeId: number;
      let awayId: number;
      if (g < 2) {
        homeId = highTeamId; awayId = lowTeamId;
      } else if (g < 4) {
        homeId = lowTeamId; awayId = highTeamId;
      } else {
        homeId = highTeamId; awayId = lowTeamId;
      }

      slots.push({
        series_round: round,
        conference,
        seed_high: seedHigh,
        seed_low: seedLow,
        home_team_id: homeId,
        away_team_id: awayId,
        game_number: g + 1,
        scheduled_date: date,
      });
    }
  }

  const { north, south } = seedings;

  // ── Round 1: Conference Semifinals ───────────────────────────────────────────
  // North: 1v4 and 2v3
  // We interleave the two north series and two south series on the same Saturdays
  // by giving them the same start index — they play on the same day (different matchups)
  scheduleSeries(1, 'north', 1, 4, north[0], north[3], roundStartIdx[0]);
  scheduleSeries(1, 'north', 2, 3, north[1], north[2], roundStartIdx[0]);
  scheduleSeries(1, 'south', 1, 4, south[0], south[3], roundStartIdx[0]);
  scheduleSeries(1, 'south', 2, 3, south[1], south[2], roundStartIdx[0]);

  // ── Round 2: Conference Finals ────────────────────────────────────────────────
  // Winners TBD — we schedule with placeholder team IDs of 0.
  // The actual team IDs are filled in when the round is generated dynamically
  // after Round 1 completes. We only store the slot dates here for reference;
  // the DB-level generation in queries.ts uses this function for Round 1 only
  // and creates Rounds 2 & 3 on the fly. So we skip Rounds 2 & 3 here.

  return slots.filter(s => s.series_round === 1);
}

/**
 * Get the anchor (game-1) dates for each playoff round in a given year.
 * Round 1 starts on the first Monday of May.
 * Round 2 starts 18 days later (also Monday).
 * Round 3 starts 18 days after Round 2 (also Monday).
 */
export function getPlayoffRoundStartDates(year: number): { round1: string; round2: string; round3: string } {
  const [r1, , , , ] = getPlayoffRoundDates(year, 1);
  const [r2, , , , ] = getPlayoffRoundDates(year, 2);
  const [r3, , , , ] = getPlayoffRoundDates(year, 3);
  return { round1: r1, round2: r2, round3: r3 };
}

/**
 * Get all matchdays for a cup competition in a given year (Aug 1 – Dec 31).
 * Each cup type has a fixed day-of-week slot:
 *   'national' → Mondays
 *   'cl'       → Wednesdays
 *   'secondary' → Fridays
 *
 * @param year - the season calendar year
 * @param cupType - the cup type ('national', 'cl', or 'secondary')
 * @returns array of YYYY-MM-DD strings for all game dates in the cup block
 */
export function getCupMatchdays(year: number, cupType: 'national' | 'cl' | 'secondary'): string[] {
  const cupStart = new Date(year, 7, 1);  // Aug 1
  const cupEnd   = new Date(year, 11, 31); // Dec 31

  const weekday = cupType === 'national' ? 1 : cupType === 'cl' ? 3 : 5;
  return getDatesForWeekday(cupStart, cupEnd, weekday);
}

/**
 * Get the 5 game dates for a given playoff round.
 *
 * Round 1 anchor: first Monday of May.
 * Round 2 anchor: Monday, 18 days after Round 1's game-1 Monday
 *                 (Round 1 worst-case ends on Wed +11; next Monday is +18).
 * Round 3 anchor: Monday, 18 days after Round 2's game-1 Monday.
 *
 * Game offsets from anchor (days), alternating Mon/Wed/Fri:
 *   Game 1: +0  (Monday)
 *   Game 2: +2  (Wednesday, +2 from Monday)
 *   Game 3: +4  (Friday, +2 from Wednesday)
 *   Game 4: +9  (Monday, +5 from Friday = next Mon)
 *   Game 5: +11 (Wednesday, +2 from Monday)
 */
export function getPlayoffRoundDates(year: number, round: 1 | 2 | 3): string[] {
  // Round 1 anchor: first Monday (day 1) on or after May 1
  const may1 = new Date(year, 4, 1);
  while (may1.getDay() !== 1) may1.setDate(may1.getDate() + 1);
  const round1Mon = new Date(may1);

  // Round 2 anchor: Monday, 18 days after Round 1's game-1 Monday
  const round2Mon = new Date(round1Mon);
  round2Mon.setDate(round1Mon.getDate() + 18);

  // Round 3 anchor: Monday, 18 days after Round 2's game-1 Monday
  const round3Mon = new Date(round2Mon);
  round3Mon.setDate(round2Mon.getDate() + 18);

  const anchor = round === 1 ? round1Mon : round === 2 ? round2Mon : round3Mon;

  // All anchors are Monday, so offsets are the same for all rounds
  const offsets = [0, 2, 4, 9, 11];

  return offsets.map(offset => {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() + offset);
    return toLocalDateString(d);
  });
}
