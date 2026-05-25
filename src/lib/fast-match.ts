/**
 * Closed-form fast match resolver.
 *
 * Used in bulk AI-vs-AI simulation (simulate-to-date, advance-day, simulate-
 * matchday) where iterating every rally in JS is the dominant cost. The
 * resolver samples final set scores directly from a Bernoulli model derived
 * from the two team strength bundles, then allocates per-player stat lines
 * via a single multinomial draw at the end.
 *
 * Output shape matches `runFullMatch` from simulation-engine.ts so the call
 * sites can swap one for the other freely. Set scores, set count, totals,
 * and per-player stat lines all look like a realistically-played match.
 *
 * What's lost vs the full sim: nothing user-visible. The full sim's rally-by-
 * rally narrative is for the user's own match. AI-vs-AI matches only need
 * final scores + stat totals, which is exactly what this returns.
 */

import type { SimLineup, SimPlayer, MatchResult, PlayerStatLine } from './simulation-engine';

/**
 * Cheap strength snapshot — only the inputs the fast resolver needs.
 * Cached per team per run so a team playing N matches doesn't recompute.
 */
export interface FastStrengths {
  /** Aggregate offensive index (attack + serve, mental-weighted). */
  off: number;
  /** Aggregate defensive index (block + receive). */
  def: number;
  /** Pre-binned attackers with cumulative weights for stat allocation. */
  attackers: { id: number; w: number }[];
  attackerTotal: number;
  blockers: { id: number; w: number }[];
  blockerTotal: number;
  servers: { id: number; w: number }[];
  serverTotal: number;
  receivers: { id: number; w: number }[];
  receiverTotal: number;
  /** All starters, used to pre-seed zero stat rows. */
  starterIds: number[];
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 50;
}

// Position multipliers — mirror simulation-engine so leaderboards stay coherent.
function attackerMult(pos: string): number {
  if (pos === 'Outside Hitter')  return 1.30;
  if (pos === 'Opposite Hitter') return 1.20;
  if (pos === 'Middle Blocker')  return 0.95;
  if (pos === 'Setter')          return 0.15;
  if (pos === 'Libero')          return 0.05;
  return 1.0;
}

function blockerMult(pos: string): number {
  if (pos === 'Middle Blocker')  return 1.40;
  if (pos === 'Opposite Hitter') return 1.20;
  if (pos === 'Outside Hitter')  return 0.95;
  return 0.0;
}

export function buildFastStrengths(lu: SimLineup): FastStrengths {
  const all: SimPlayer[] = [];
  for (const p of Object.values(lu)) if (p) all.push(p);

  if (!all.length) {
    return {
      off: 50, def: 50,
      attackers: [], attackerTotal: 0,
      blockers: [], blockerTotal: 0,
      servers: [], serverTotal: 0,
      receivers: [], receiverTotal: 0,
      starterIds: [],
    };
  }

  // Aggregate strengths.
  const attackPlayers: SimPlayer[] = [];
  if (lu.OH1) attackPlayers.push(lu.OH1);
  if (lu.OH2) attackPlayers.push(lu.OH2);
  if (lu.OPP) attackPlayers.push(lu.OPP);
  if (lu.MB1) attackPlayers.push(lu.MB1);
  if (lu.MB2) attackPlayers.push(lu.MB2);

  const blockPlayers: SimPlayer[] = [];
  if (lu.MB1) blockPlayers.push(lu.MB1);
  if (lu.MB2) blockPlayers.push(lu.MB2);
  if (lu.OH1) blockPlayers.push(lu.OH1);
  if (lu.OH2) blockPlayers.push(lu.OH2);
  if (lu.OPP) blockPlayers.push(lu.OPP);

  const recvPlayers: SimPlayer[] = [];
  if (lu.L)   recvPlayers.push(lu.L);
  if (lu.OH1) recvPlayers.push(lu.OH1);
  if (lu.OH2) recvPlayers.push(lu.OH2);

  const setterBonus = lu.S
    ? (lu.S.setting * 0.5 + lu.S.playmaking * 0.3 + lu.S.vision * 0.2) * 0.04
    : 0;

  const atkAvg = avg(attackPlayers.map(p => p.attack * 0.35 + p.precision * 0.25 + p.flair * 0.15 + p.strength * 0.15 + p.vertical * 0.10)) + setterBonus;
  const serveAvg = avg(all.map(p => p.serve * 0.40 + p.technique * 0.25 + p.spin * 0.20 + p.agility * 0.15));
  const blkAvg = avg(blockPlayers.map(p => p.block * 0.40 + p.positioning * 0.25 + p.vertical * 0.20 + p.concentration * 0.15));
  const recvAvg = avg(recvPlayers.map(p => p.receive * 0.35 + p.digging * 0.25 + p.ball_control * 0.20 + p.flexibility * 0.10 + p.balance * 0.10));
  const mentalAvg = avg(all.map(p => p.pressure * 0.25 + p.consistency * 0.25 + p.game_iq * 0.20 + p.concentration * 0.15 + p.vision * 0.15));

  const off = atkAvg * 0.6 + serveAvg * 0.4 + (mentalAvg - 50) * 0.1;
  const def = blkAvg * 0.55 + recvAvg * 0.45 + (mentalAvg - 50) * 0.1;

  // Pre-bin players for stat allocation. Each pool stores cumulative weights so
  // we can sample with a single random number + binary search.
  const attackers: { id: number; w: number }[] = [];
  let attackerTotal = 0;
  for (const p of attackPlayers) {
    const w = (p.attack * 0.35 + p.precision * 0.25 + p.flair * 0.15 + p.strength * 0.15 + p.vertical * 0.10) * attackerMult(p.position);
    if (w > 0) {
      attackerTotal += w;
      attackers.push({ id: p.id, w: attackerTotal });
    }
  }

  const blockers: { id: number; w: number }[] = [];
  let blockerTotal = 0;
  for (const p of blockPlayers) {
    const w = (p.block * 0.40 + p.positioning * 0.25 + p.vertical * 0.20 + p.concentration * 0.15) * blockerMult(p.position);
    if (w > 0) {
      blockerTotal += w;
      blockers.push({ id: p.id, w: blockerTotal });
    }
  }

  // Servers: everyone except Libero.
  const servers: { id: number; w: number }[] = [];
  let serverTotal = 0;
  for (const p of all) {
    if (p.position === 'Libero') continue;
    const w = p.serve * 0.40 + p.technique * 0.25 + p.spin * 0.20 + p.agility * 0.15;
    if (w > 0) {
      serverTotal += w;
      servers.push({ id: p.id, w: serverTotal });
    }
  }

  const receivers: { id: number; w: number }[] = [];
  let receiverTotal = 0;
  for (const p of recvPlayers) {
    const w = p.receive * 0.35 + p.digging * 0.25 + p.ball_control * 0.20 + p.flexibility * 0.10 + p.balance * 0.10;
    if (w > 0) {
      receiverTotal += w;
      receivers.push({ id: p.id, w: receiverTotal });
    }
  }

  return {
    off, def, attackers, attackerTotal, blockers, blockerTotal,
    servers, serverTotal, receivers, receiverTotal,
    starterIds: all.map(p => p.id),
  };
}

// Sample an id by cumulative-weight binary search. Pool must be non-empty.
function pickFrom(pool: { id: number; w: number }[], total: number): number {
  const r = Math.random() * total;
  let lo = 0, hi = pool.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (pool[mid].w < r) lo = mid + 1;
    else hi = mid;
  }
  return pool[lo].id;
}

/**
 * Sample a single volleyball set's final score given home's per-rally win prob.
 * Returns [homeScore, awayScore]. Standard set: first to 25 win by 2; tiebreak
 * set: first to 15 win by 2.
 */
function sampleSet(pHome: number, target: number): [number, number] {
  // Direct Bernoulli loop on integer counters. ~50 iterations average — orders
  // of magnitude cheaper than the per-rally event branching in the full sim.
  let h = 0, a = 0;
  for (;;) {
    if (Math.random() < pHome) h++;
    else a++;
    if (h >= target && h - a >= 2) return [h, a];
    if (a >= target && a - h >= 2) return [h, a];
    // Safety stop in case probabilities pin a coin-flip at 50/50 with no winner.
    if (h + a > 200) return h >= a ? [h, a] : [h, a];
  }
}

/**
 * Closed-form match. Returns the same shape as runFullMatch so call sites
 * are drop-in compatible.
 */
export function runFastMatch(
  homeStr: FastStrengths,
  awayStr: FastStrengths,
  homeTeamId?: number,
  awayTeamId?: number,
): MatchResult {
  // Per-rally win probability for home from the strength delta. Tuned so
  // even matchups give ~50/50 and a 10-point off/def gap gives a ~58/42 split
  // (roughly in line with the full sim's distribution).
  const homeAdvantage = (homeStr.off - awayStr.def) - (awayStr.off - homeStr.def);
  // Tiny home-court bias (matches the implicit ~5% home edge in the full sim).
  const pHomeRaw = 0.5 + homeAdvantage / 220 + 0.02;
  const pHomeStd = clamp(pHomeRaw, 0.30, 0.70);
  // Slightly tighter in the 5th set (tighter games tend to coin-flip).
  const pHome5 = clamp(0.5 + (pHomeRaw - 0.5) * 0.7, 0.32, 0.68);

  let homeSets = 0, awaySets = 0;
  let homeTotalPoints = 0, awayTotalPoints = 0;
  let setNum = 1;

  // Track aggregate points per side so we can multinomial-allocate to players.
  while (homeSets < 3 && awaySets < 3) {
    const isFifth = setNum === 5;
    const [h, a] = sampleSet(isFifth ? pHome5 : pHomeStd, isFifth ? 15 : 25);
    if (h > a) homeSets++; else awaySets++;
    homeTotalPoints += h;
    awayTotalPoints += a;
    setNum++;
  }

  // ── Per-player stat allocation ──────────────────────────────────────────
  // Use a single multinomial-ish allocation at the end: total team points are
  // split into spikes / blocks / aces / dig_winners (errors are accounted for
  // by the opponent's points), then distributed across players proportional to
  // their pool weights. Cheap and produces leaderboards that look right.
  const playerStats: PlayerStatLine[] = [];
  if (homeTeamId !== undefined || awayTeamId !== undefined) {
    const statRow = new Map<number, { teamId: number; points: number; spikes: number; blocks: number; aces: number; digs: number }>();

    const seed = (ids: number[], teamId: number) => {
      for (const id of ids) {
        if (!statRow.has(id)) {
          statRow.set(id, { teamId, points: 0, spikes: 0, blocks: 0, aces: 0, digs: 0 });
        }
      }
    };
    if (homeTeamId !== undefined) seed(homeStr.starterIds, homeTeamId);
    if (awayTeamId !== undefined) seed(awayStr.starterIds, awayTeamId);

    const allocateTeam = (
      totalPoints: number, ownStr: FastStrengths, teamId: number | undefined,
    ) => {
      if (teamId === undefined || totalPoints === 0) return;
      // Event-type split (roughly matches simulation-engine's distribution):
      //   spikes ~60%, blocks ~15%, aces ~8%, dig_winners ~7%, rally wins ~10%
      // Rally wins also go to attackers; dig_winners credit a receiver.
      const spikes = Math.round(totalPoints * 0.60);
      const blocks = Math.round(totalPoints * 0.15);
      const aces   = Math.round(totalPoints * 0.08);
      const digW   = Math.round(totalPoints * 0.07);
      const rally  = Math.max(0, totalPoints - spikes - blocks - aces - digW);

      // Helper: distribute n events across a weighted pool.
      const distribute = (n: number, pool: { id: number; w: number }[], total: number,
                          which: 'spikes' | 'blocks' | 'aces' | 'digs') => {
        if (n <= 0 || !pool.length || total <= 0) return;
        for (let i = 0; i < n; i++) {
          const id = pickFrom(pool, total);
          let row = statRow.get(id);
          if (!row) {
            row = { teamId: teamId!, points: 0, spikes: 0, blocks: 0, aces: 0, digs: 0 };
            statRow.set(id, row);
          }
          row[which]++;
          if (which !== 'digs') row.points++;
        }
      };

      distribute(spikes + rally, ownStr.attackers, ownStr.attackerTotal, 'spikes');
      distribute(blocks, ownStr.blockers, ownStr.blockerTotal, 'blocks');
      distribute(aces, ownStr.servers, ownStr.serverTotal, 'aces');
      // dig_winners: opponent attacker erred, OWN receiver gets the dig.
      distribute(digW, ownStr.receivers, ownStr.receiverTotal, 'digs');
    };

    allocateTeam(homeTotalPoints, homeStr, homeTeamId);
    allocateTeam(awayTotalPoints, awayStr, awayTeamId);

    for (const [playerId, s] of statRow) {
      playerStats.push({
        playerId, teamId: s.teamId,
        points: s.points, spikes: s.spikes, blocks: s.blocks, aces: s.aces, digs: s.digs,
      });
    }
  }

  return {
    homeSets,
    awaySets,
    homeTotalPoints,
    awayTotalPoints,
    winner: homeSets > awaySets ? 'home' : 'away',
    playerStats,
  };
}

