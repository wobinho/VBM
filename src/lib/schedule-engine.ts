/**
 * Triple Round-Robin Schedule Generator
 *
 * For 16 teams:
 *   - Single round-robin = 15 rounds, 8 games/round = 120 games
 *   - Triple round-robin = 45 rounds, 8 games/round = 360 games
 *   - Each team plays 45 matches (every opponent exactly 3 times)
 *
 * Scheduling: primary on Saturdays, fallback Wednesdays for conflicts.
 * 45 rounds spread across Jan–Dec of the season year.
 */

export interface FixtureSlot {
  game_week: number;
  home_team_id: number;
  away_team_id: number;
  scheduled_date: string; // YYYY-MM-DD
}

/** Returns all Saturdays in the given year as YYYY-MM-DD strings. */
function getSaturdaysOfYear(year: number): string[] {
  const saturdays: string[] = [];
  const d = new Date(year, 0, 1);
  // Advance to first Saturday (day 6)
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
  while (d.getFullYear() === year) {
    saturdays.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 7);
  }
  return saturdays;
}

/** Returns all Wednesdays in the given year as YYYY-MM-DD strings. */
function getWednesdaysOfYear(year: number): string[] {
  const wednesdays: string[] = [];
  const d = new Date(year, 0, 1);
  while (d.getDay() !== 3) d.setDate(d.getDate() + 1);
  while (d.getFullYear() === year) {
    wednesdays.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 7);
  }
  return wednesdays;
}

/**
 * Polygon round-robin algorithm for n teams (n must be even).
 * Returns pairings for a single round, given the current rotation state.
 *
 * @param rotating - mutable rotating ring (length n-1)
 * @param fixed    - the team fixed at position n-1
 * @param pass     - 0, 1, or 2 — controls home/away assignment to ensure
 *                   each team gets 2 home and 1 away appearances against
 *                   each opponent over the 3 meetings (or vice versa)
 * @param round    - current round index within this pass (0 to n-2)
 */
function pairsForRound(
  rotating: number[],
  fixed: number,
  pass: number,
  round: number,
): [number, number][] {
  const n = rotating.length + 1; // total teams
  const pairs: [number, number][] = [];

  // Fixed-team pairing: alternate home/away across passes
  if (pass % 2 === 0) {
    pairs.push([rotating[0], fixed]);
  } else {
    pairs.push([fixed, rotating[0]]);
  }

  // Inner pairings
  for (let i = 1; i < n / 2; i++) {
    const t1 = rotating[i];
    const t2 = rotating[n - 1 - i];
    // Alternate home/away based on pass + position for balance
    if ((pass + round + i) % 2 === 0) {
      pairs.push([t1, t2]);
    } else {
      pairs.push([t2, t1]);
    }
  }

  return pairs;
}

/**
 * Generate a triple round-robin schedule.
 *
 * @param teamIds - array of exactly 16 team IDs
 * @param year    - the season calendar year (e.g. 2026)
 * @returns       array of FixtureSlots, sorted by game_week
 */
export function generateTripleRoundRobin(
  teamIds: number[],
  year: number,
): FixtureSlot[] {
  const n = teamIds.length;
  if (n < 2 || n % 2 !== 0) throw new Error('Team count must be an even number ≥ 2');

  const saturdays   = getSaturdaysOfYear(year);
  const wednesdays  = getWednesdaysOfYear(year);
  const totalRounds = 3 * (n - 1); // 45 for n=16

  // Build a combined pool: Saturdays first, then Wednesdays as overflow
  // We prioritise filling Saturdays; if 45 > total Saturdays we spill into Wednesdays
  const datePool: string[] = [];
  let si = 0, wi = 0;
  while (datePool.length < totalRounds) {
    if (si < saturdays.length) {
      datePool.push(saturdays[si++]);
    } else if (wi < wednesdays.length) {
      datePool.push(wednesdays[wi++]);
    } else {
      // Extremely unlikely — just reuse last Saturday
      datePool.push(saturdays[saturdays.length - 1]);
    }
  }

  const fixtures: FixtureSlot[] = [];
  let gameWeek = 1;

  for (let pass = 0; pass < 3; pass++) {
    // Fresh rotating array for each pass
    const rotating = [...teamIds.slice(0, n - 1)];
    const fixed = teamIds[n - 1];

    for (let round = 0; round < n - 1; round++) {
      const date = datePool[gameWeek - 1];
      const pairs = pairsForRound(rotating, fixed, pass, round);

      for (const [home, away] of pairs) {
        fixtures.push({ game_week: gameWeek, home_team_id: home, away_team_id: away, scheduled_date: date });
      }

      gameWeek++;
      // Rotate left: first element moves to the end
      rotating.push(rotating.shift()!);
    }
  }

  return fixtures;
}
