/**
 * Schedule Engine
 *
 * Regular Season (Jan 1 – Aug 31):
 *   45-game triple round-robin for 16 teams spread across 8 months of Fridays,
 *   with Tuesdays used as fallback when more matchdays are needed.
 *   Some weeks may have 2 games (Tuesday + Friday). Regular season strictly ends Aug 31.
 *
 * Playoffs (Sep 1 – Nov 30) — IVL Premier Division only:
 *   Round 1 – Conference Semifinals (4 series): N1vN4, N2vN3, S1vS4, S2vS3
 *   Round 2 – Conference Finals       (2 series): North, South
 *   Round 3 – Grand Final             (1 series): North champ vs South champ
 *
 *   Each series is best-of-5 (first to 3 wins). Games are scheduled one per week
 *   on Saturdays. Subsequent rounds are scheduled after enough weeks for the
 *   previous round to complete (5 weeks per round worst-case).
 *
 *   Game schedule within a series:
 *     Game 1: week 0
 *     Game 2: week 1
 *     Game 3: week 2
 *     Game 4: week 3 (if needed)
 *     Game 5: week 4 (if needed)
 *
 *   Round 1 starts Sep 6 (first Saturday in Sep).
 *   Round 2 starts 5 Saturdays later (Oct 11).
 *   Round 3 starts 5 Saturdays later (Nov 15).
 *   All rounds finish by Nov 30.
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
 * Returns an ordered list of matchday dates for the regular season (Jan 1 – Aug 31).
 * Primary matchday: Friday (5). Fallback: Tuesday (2).
 *
 * Distribution strategy: Tuesday double-up weeks are front-loaded so the
 * schedule is denser early in the season and lighter toward August.
 *
 * Algorithm:
 *   1. Assign one Friday per round as the baseline (35 Fridays ≥ 45? no — use all Fridays first).
 *   2. Count how many extra slots are needed beyond available Fridays.
 *   3. Insert those Tuesdays at the START of the season (earliest available Tuesdays first),
 *      merging them chronologically with the selected Fridays.
 */
function getRegularSeasonMatchdays(startDate: Date, endDate: Date, totalRounds: number): string[] {
  const fridays  = getDatesForWeekday(startDate, endDate, 5);
  const tuesdays = getDatesForWeekday(startDate, endDate, 2);

  const extraNeeded = Math.max(0, totalRounds - fridays.length);

  // Take only as many Tuesdays as needed, from the start of the season
  const selectedTuesdays = tuesdays.slice(0, extraNeeded);

  // Merge selected Tuesdays with all Fridays, sorted chronologically
  const all = [...fridays, ...selectedTuesdays].sort();

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
 * Generate a triple round-robin schedule spread across Jan 1 – Aug 31.
 *
 * RNG is applied in two ways so each season looks different:
 *   1. The team array is shuffled before scheduling — changes who faces who each week.
 *   2. The order of the 3 passes is shuffled — changes which pass runs first/second/third,
 *      altering the home/away distribution across the calendar.
 *
 * @param teamIds - array of team IDs (even count)
 * @param year    - the season calendar year
 */
export function generateTripleRoundRobin(
  teamIds: number[],
  year: number,
): FixtureSlot[] {
  const n = teamIds.length;
  if (n < 2 || n % 2 !== 0) throw new Error('Team count must be an even number ≥ 2');

  // Regular season: Jan 1 – Aug 31 (strict cutoff)
  const seasonStart = new Date(year, 0, 1);   // Jan 1
  const seasonEnd   = new Date(year, 7, 31);  // Aug 31

  const totalRounds = 3 * (n - 1); // 45 for n=16

  // Build date pool using Fridays (primary) and Tuesdays (fallback), sorted chronologically.
  // This allows some weeks to have 2 games (Tue + Fri) to fit all 45 rounds before Aug 31.
  const datePool = getRegularSeasonMatchdays(seasonStart, seasonEnd, totalRounds);
  if (datePool.length < totalRounds) {
    throw new Error(`Not enough matchdays before Aug 31 for ${totalRounds} rounds (found ${datePool.length})`);
  }

  // RNG #1: shuffle team order so matchup pairings differ each season
  const shuffledTeams = shuffle([...teamIds]);

  // RNG #2: shuffle pass order so home/away patterns vary across the calendar
  const passOrder = shuffle([0, 1, 2]);

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
 * Get the starting Saturday dates for each playoff round in a given year.
 * Used by queries.ts when creating rounds 2 and 3 after results come in.
 */
export function getPlayoffRoundStartDates(year: number): { round1: string; round2: string; round3: string } {
  const playoffStart = new Date(year, 8, 1);
  const playoffEnd   = new Date(year, 10, 30);
  const saturdays    = getSaturdaysInRange(playoffStart, playoffEnd);

  return {
    round1: saturdays[0]  ?? `${year}-09-06`,
    round2: saturdays[5]  ?? `${year}-10-11`,
    round3: saturdays[10] ?? `${year}-11-15`,
  };
}

/**
 * Get the 5 Saturday dates for a given round's games in a year.
 */
export function getPlayoffRoundDates(year: number, round: 1 | 2 | 3): string[] {
  const playoffStart = new Date(year, 8, 1);
  const playoffEnd   = new Date(year, 10, 30);
  const saturdays    = getSaturdaysInRange(playoffStart, playoffEnd);

  const startIdx = (round - 1) * 5;
  const result: string[] = [];
  for (let i = 0; i < 5; i++) {
    result.push(saturdays[Math.min(startIdx + i, saturdays.length - 1)]);
  }
  return result;
}
