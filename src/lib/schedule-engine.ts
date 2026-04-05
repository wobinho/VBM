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
 *   Each series is best-of-5 (first to 3 wins). Only the first 3 games are
 *   pre-scheduled (minimum needed for a 3-0 sweep). Games 4-5 are scheduled
 *   dynamically only if the series needs them.
 *
 *   Games alternate Friday / Tuesday:
 *     Game 1: Friday   (round start)
 *     Game 2: Tuesday  (+4 days)
 *     Game 3: Friday   (+7 days from game 1)
 *     Game 4: Tuesday  (+11 days from game 1) — scheduled only if needed
 *     Game 5: Friday   (+14 days from game 1) — scheduled only if needed
 *
 *   Next round starts on Tuesday (+18 days from round's game-1 Friday, i.e. 4 days
 *   after the worst-case game-5 Friday). The next round's game 1 is that Tuesday,
 *   then Friday, Tuesday, … following the same pattern offset from that anchor.
 *
 *   Round 1 starts on the first Friday of September.
 *   Round 2 starts once ALL Round 1 series are complete (next round generated dynamically).
 *   Round 3 starts once ALL Round 2 series are complete (next round generated dynamically).
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
 * Generate a triple round-robin schedule spread across Jan 1 – Aug 31.
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
    new Date(year, 7, 31), // Aug 31
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
 * Round 1 starts on the first Friday of September.
 * Round 2 starts 18 days later (Tuesday).
 * Round 3 starts 17 days after Round 2 (Friday).
 */
export function getPlayoffRoundStartDates(year: number): { round1: string; round2: string; round3: string } {
  const [r1, , , , ] = getPlayoffRoundDates(year, 1);
  const [r2, , , , ] = getPlayoffRoundDates(year, 2);
  const [r3, , , , ] = getPlayoffRoundDates(year, 3);
  return { round1: r1, round2: r2, round3: r3 };
}

/**
 * Get the 5 game dates for a given playoff round.
 *
 * Round 1 anchor: first Friday of September.
 * Round 2 anchor: Tuesday, 18 days after Round 1's game-1 Friday
 *                 (4 days after the worst-case game-5 Friday of Round 1).
 * Round 3 anchor: Friday, 17 days after Round 2's game-1 Tuesday
 *                 (3 days after the worst-case game-5 Tuesday of Round 2).
 *
 * Game offsets from anchor (days):
 *   Game 1: +0
 *   Game 2: +4   (Fri→Tue or Tue→Fri)
 *   Game 3: +7   (back to anchor weekday)
 *   Game 4: +11  (if needed)
 *   Game 5: +14  (if needed)
 */
export function getPlayoffRoundDates(year: number, round: 1 | 2 | 3): string[] {
  // Round 1 anchor: first Friday (day 5) on or after Sep 1
  const sep1 = new Date(year, 8, 1);
  while (sep1.getDay() !== 5) sep1.setDate(sep1.getDate() + 1);
  const round1Fri = new Date(sep1);

  // Round 2 anchor: Tuesday 18 days after Round 1's game-1 Friday
  // (Round 1 worst-case ends on Fri +14; next Tuesday is +18)
  const round2Tue = new Date(round1Fri);
  round2Tue.setDate(round1Fri.getDate() + 18);

  // Round 3 anchor: Friday 17 days after Round 2's game-1 Tuesday
  // (Round 2 worst-case ends on Tue +14; next Friday is +17)
  const round3Fri = new Date(round2Tue);
  round3Fri.setDate(round2Tue.getDate() + 17);

  const anchor = round === 1 ? round1Fri : round === 2 ? round2Tue : round3Fri;

  // Offsets depend on anchor weekday:
  //   Anchor=Friday (rounds 1 & 3): Fri→Tue is +4, Tue→Fri is +3 → [0, 4, 7, 11, 14]
  //   Anchor=Tuesday (round 2):     Tue→Fri is +3, Fri→Tue is +4 → [0, 3, 7, 10, 14]
  const anchorIsFriday = anchor.getDay() === 5;
  const offsets = anchorIsFriday
    ? [0, 4, 7, 11, 14]
    : [0, 3, 7, 10, 14];

  return offsets.map(offset => {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() + offset);
    return toLocalDateString(d);
  });
}
