/**
 * Server-Side Simulation Engine
 *
 * Extracted from src/app/match/page.tsx — the pure simulation logic,
 * stripped of React state, UI text, and narrative generation.
 * Used by the fixture simulation API to resolve matches without
 * requiring a browser session.
 */

export interface SimPlayer {
  id: number;
  player_name: string;
  position: string;
  overall: number;
  attack: number;
  serve: number;
  block: number;
  receive: number;
  setting: number;
  precision: number;
  flair: number;
  digging: number;
  positioning: number;
  ball_control: number;
  technique: number;
  playmaking: number;
  spin: number;
  speed: number;
  agility: number;
  strength: number;
  endurance: number;
  vertical: number;
  flexibility: number;
  torque: number;
  balance: number;
  leadership: number;
  teamwork: number;
  concentration: number;
  pressure: number;
  consistency: number;
  vision: number;
  game_iq: number;
  intimidation: number;
  country: string;
}

export interface SimLineup {
  OH1: SimPlayer | null;
  MB1: SimPlayer | null;
  OPP: SimPlayer | null;
  S: SimPlayer | null;
  MB2: SimPlayer | null;
  OH2: SimPlayer | null;
  L: SimPlayer | null;
}

export interface TeamStrengths {
  serve: number;
  attack: number;
  block: number;
  receive: number;
  mental: number;
  overall: number;
}

export interface PlayerStatLine {
  playerId: number;
  teamId: number;
  points: number;
  spikes: number;
  blocks: number;
  aces: number;
  digs: number;
}

export interface MatchResult {
  homeSets: number;
  awaySets: number;
  homeTotalPoints: number;
  awayTotalPoints: number;
  winner: 'home' | 'away';
  playerStats?: PlayerStatLine[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 50;
}

function buildStrengths(lu: SimLineup): TeamStrengths {
  const all = Object.values(lu).filter(Boolean) as SimPlayer[];
  if (!all.length) return { serve: 50, attack: 50, block: 50, receive: 50, mental: 50, overall: 50 };

  const attackers = [lu.OH1, lu.OPP, lu.MB1, lu.MB2].filter(Boolean) as SimPlayer[];
  const blockers  = [lu.MB1, lu.MB2, lu.OH1, lu.OH2, lu.OPP].filter(Boolean) as SimPlayer[];
  const receivers = [lu.L, lu.OH1, lu.OH2].filter(Boolean) as SimPlayer[];
  const setterBonus = lu.S
    ? (lu.S.setting * 0.5 + lu.S.playmaking * 0.3 + lu.S.vision * 0.2) * 0.04
    : 0;

  return {
    serve:   avg(all.map(p => p.serve * 0.40 + p.technique * 0.25 + p.spin * 0.20 + p.agility * 0.15)),
    attack:  avg(attackers.map(p => p.attack * 0.35 + p.precision * 0.25 + p.flair * 0.15 + p.strength * 0.15 + p.vertical * 0.10)) + setterBonus,
    block:   avg(blockers.map(p => p.block * 0.40 + p.positioning * 0.25 + p.vertical * 0.20 + p.concentration * 0.15)),
    receive: avg(receivers.map(p => p.receive * 0.35 + p.digging * 0.25 + p.ball_control * 0.20 + p.flexibility * 0.10 + p.balance * 0.10)),
    mental:  avg(all.map(p => p.pressure * 0.25 + p.consistency * 0.25 + p.game_iq * 0.20 + p.concentration * 0.15 + p.vision * 0.15)),
    overall: avg(all.map(p => p.overall)),
  };
}

function computeChemistry(lu: SimLineup): number {
  const players = Object.values(lu).filter(Boolean) as SimPlayer[];
  if (!players.length) return 1.0;

  const countryCount: Record<string, number> = {};
  for (const p of players) countryCount[p.country] = (countryCount[p.country] ?? 0) + 1;
  const maxGroup = Math.max(...Object.values(countryCount));
  const cohesion = maxGroup / players.length;

  const avgTeamwork   = players.reduce((s, p) => s + p.teamwork, 0) / players.length;
  const avgLeadership = players.reduce((s, p) => s + p.leadership, 0) / players.length;
  const teamworkBonus  = (avgTeamwork - 50) / 200;
  const leadershipBonus = (avgLeadership - 50) / 400;

  return Math.min(1.25, Math.max(0.75, 0.75 + cohesion * 0.35 + teamworkBonus + leadershipBonus));
}

function getMomentumBonus(streak: number): number {
  const abs = Math.abs(streak);
  const bonus = abs >= 7 ? 12 : abs >= 5 ? 8 : abs >= 3 ? 4 : 0;
  return streak > 0 ? bonus : -bonus;
}

// ─── Player pickers ───────────────────────────────────────────────────────────

function weightedPick(players: SimPlayer[], weightFn: (p: SimPlayer) => number): SimPlayer {
  const weights = players.map(weightFn);
  const total = weights.reduce((s, w) => s + Math.max(0.1, w), 0);
  let r = Math.random() * total;
  for (let i = 0; i < players.length; i++) {
    r -= Math.max(0.1, weights[i]);
    if (r <= 0) return players[i];
  }
  return players[players.length - 1];
}

function pickServer(lu: SimLineup): SimPlayer | null {
  const all = Object.values(lu).filter(Boolean) as SimPlayer[];
  return all.length
    ? weightedPick(all, p => p.serve * 0.40 + p.technique * 0.25 + p.spin * 0.20 + p.agility * 0.15)
    : null;
}

function pickReceiver(lu: SimLineup): SimPlayer | null {
  const cands = [lu.L, lu.OH1, lu.OH2].filter(Boolean) as SimPlayer[];
  return cands.length
    ? weightedPick(cands, p => p.receive * 0.35 + p.digging * 0.25 + p.ball_control * 0.20 + p.flexibility * 0.10 + p.balance * 0.10)
    : null;
}

function pickAttacker(lu: SimLineup): SimPlayer | null {
  const cands = [lu.OH1, lu.OPP, lu.MB1, lu.MB2].filter(Boolean) as SimPlayer[];
  return cands.length
    ? weightedPick(cands, p => p.attack * 0.35 + p.precision * 0.25 + p.flair * 0.15 + p.strength * 0.15 + p.vertical * 0.10)
    : null;
}

function pickBlocker(attackerPos: string | undefined, lu: SimLineup): SimPlayer | null {
  const blockWeight = (p: SimPlayer) => p.block * 0.40 + p.positioning * 0.25 + p.vertical * 0.20 + p.concentration * 0.15;
  if (attackerPos === 'Middle Blocker') {
    const cands = [lu.MB1, lu.MB2].filter(Boolean) as SimPlayer[];
    if (cands.length) return weightedPick(cands, blockWeight);
  } else {
    const cands = [lu.OH1, lu.OH2, lu.OPP].filter(Boolean) as SimPlayer[];
    if (cands.length) return weightedPick(cands, blockWeight);
  }
  const all = [lu.MB1, lu.MB2, lu.OH1, lu.OH2, lu.OPP].filter(Boolean) as SimPlayer[];
  return all.length ? weightedPick(all, blockWeight) : null;
}

// ─── Rally resolver ───────────────────────────────────────────────────────────

interface RallyEvent {
  servingWins: boolean;
  scorer: SimPlayer | null;
  eventType: 'ace' | 'serve_error' | 'spike' | 'block' | 'dig_winner' | 'rally';
}

function simulateRally(
  sStr: TeamStrengths,
  rStr: TeamStrengths,
  sLu: SimLineup,
  rLu: SimLineup,
  sMomBonus: number,
  sChem: number,
  rChem: number,
  isHomeServing: boolean,
): RallyEvent {
  const rng = Math.random;

  const server   = pickServer(sLu);
  const serveStat = server
    ? server.serve * 0.40 + server.technique * 0.25 + server.spin * 0.20 + server.agility * 0.15
    : 50;
  const intimidationBonus = server ? server.intimidation * 0.05 : 0;

  const receiver    = pickReceiver(rLu);
  const receiveStat = receiver
    ? receiver.receive * 0.35 + receiver.digging * 0.25 + receiver.ball_control * 0.20 + receiver.flexibility * 0.10 + receiver.balance * 0.10
    : 50;

  const servePressure = (serveStat + intimidationBonus - receiveStat) / 120;

  // Ace
  const aceProb = Math.max(0.03, Math.min(0.12, 0.06 + servePressure * 0.08 + sMomBonus / 600));
  if (rng() < aceProb) return { servingWins: true, scorer: server, eventType: 'ace' };

  // Serve error
  const serverConsistency = server ? (server.consistency * 0.5 + server.technique * 0.5) : 50;
  const errProb = Math.max(0.05, Math.min(0.11,
    0.08 - (serveStat - 50) / 1200 - (serverConsistency - 50) / 2000 - sMomBonus / 700,
  ));
  if (rng() < errProb) return { servingWins: false, scorer: receiver, eventType: 'serve_error' };

  const setter  = sLu.S;
  const setStat = setter ? setter.setting * 0.5 + setter.playmaking * 0.3 + setter.vision * 0.2 : 50;
  const setBonus = (setStat - 50) / 100 * 10;

  const attacker = pickAttacker(sLu);
  const atkStat  = attacker
    ? attacker.attack * 0.35 + attacker.precision * 0.25 + attacker.flair * 0.15 + attacker.strength * 0.15 + attacker.vertical * 0.10
    : 50;

  const blocker = pickBlocker(attacker?.position, rLu);
  const blkStat = blocker
    ? blocker.block * 0.40 + blocker.positioning * 0.25 + blocker.vertical * 0.20 + blocker.concentration * 0.15
    : 50;

  const digger  = pickReceiver(rLu);
  const digStat = digger
    ? digger.receive * 0.35 + digger.digging * 0.25 + digger.ball_control * 0.20 + digger.flexibility * 0.10 + digger.balance * 0.10
    : 50;

  const cAttacker = pickAttacker(rLu);
  const cAtkStat  = cAttacker
    ? cAttacker.attack * 0.35 + cAttacker.precision * 0.25 + cAttacker.flair * 0.15 + cAttacker.strength * 0.15 + cAttacker.vertical * 0.10
    : 50;
  const cBlocker = pickBlocker(cAttacker?.position, sLu);
  const cBlkStat = cBlocker
    ? cBlocker.block * 0.40 + cBlocker.positioning * 0.25 + cBlocker.vertical * 0.20 + cBlocker.concentration * 0.15
    : 50;

  const V    = 220;
  const momS =  sMomBonus * 0.5;
  const momR = -sMomBonus * 0.5;
  const pressurePenalty = Math.max(0, servePressure * 8);

  const atkQ  = (atkStat + setBonus) + momS + (rng() - 0.5) * V;
  const blkQ  = blkStat              + momR + (rng() - 0.5) * V;
  const digQ  = (digStat - pressurePenalty) + momR + (rng() - 0.5) * V;
  const cAtkQ = (cAtkStat - Math.max(0, servePressure * 5)) + momR + (rng() - 0.5) * V;
  const cBlkQ = cBlkStat + momS + (rng() - 0.5) * V;

  // Block
  const blockChance = Math.max(0, (blkQ - atkQ + 15) / 120);
  if (rng() < Math.min(0.22, blockChance)) return { servingWins: false, scorer: blocker, eventType: 'block' };

  // Attack error
  if (atkQ < digQ - 18 && rng() < 0.30) return { servingWins: false, scorer: digger, eventType: 'dig_winner' };

  // Spike win
  if (atkQ > digQ + 22) return { servingWins: true, scorer: attacker, eventType: 'spike' };

  // Dig & counter
  if (cAtkQ > cBlkQ + 18) return { servingWins: false, scorer: cAttacker, eventType: 'spike' };

  // Long rally — mental battle
  const sRallyBonus = sLu.S ? (sLu.S.vision * 0.5 + sLu.S.game_iq * 0.5) * 0.02 : 0;
  const rRallyBonus = rLu.S ? (rLu.S.vision * 0.5 + rLu.S.game_iq * 0.5) * 0.02 : 0;
  const sEndurance  = avg(Object.values(sLu).filter(Boolean).map(p => (p as SimPlayer).endurance));
  const rEndurance  = avg(Object.values(rLu).filter(Boolean).map(p => (p as SimPlayer).endurance));
  const sMental = (sStr.mental + sRallyBonus + sEndurance * 0.05) * (1 + (sChem - 1) * 0.1);
  const rMental = (rStr.mental + rRallyBonus + rEndurance * 0.05) * (1 + (rChem - 1) * 0.1);
  const mentalAdv = (sMental - rMental) * 0.4 + (rng() - 0.5) * 80;

  const mentalWinner = mentalAdv > 0 ? attacker ?? null : cAttacker ?? null;
  return { servingWins: mentalAdv > 0, scorer: mentalWinner, eventType: 'rally' };
}

// ─── Set & match runner ───────────────────────────────────────────────────────

function setTarget(setNum: number): number {
  return setNum === 5 ? 15 : 25;
}

function simulateSet(
  setNum: number,
  homeStr: TeamStrengths,
  awayStr: TeamStrengths,
  homeLu: SimLineup,
  awayLu: SimLineup,
  homeChem: number,
  awayChem: number,
  statAcc?: Map<number, { teamId: number; points: number; spikes: number; blocks: number; aces: number; digs: number }>,
  homeTeamId?: number,
  awayTeamId?: number,
): { homeScore: number; awayScore: number } {
  const target = setTarget(setNum);
  let homeScore = 0, awayScore = 0;
  let serving: 'home' | 'away' = 'home';
  let streak = 0;
  let guard = 0;

  while (guard++ < 500) {
    const isHomeServing = serving === 'home';
    const sStr  = isHomeServing ? homeStr  : awayStr;
    const rStr  = isHomeServing ? awayStr  : homeStr;
    const sLu   = isHomeServing ? homeLu   : awayLu;
    const rLu   = isHomeServing ? awayLu   : homeLu;
    const sChem = isHomeServing ? homeChem : awayChem;
    const rChem = isHomeServing ? awayChem : homeChem;
    const sTeamId = isHomeServing ? homeTeamId : awayTeamId;
    const rTeamId = isHomeServing ? awayTeamId : homeTeamId;

    const rawMom   = getMomentumBonus(streak);
    const sMomBonus = isHomeServing ? rawMom : -rawMom;

    const rally = simulateRally(sStr, rStr, sLu, rLu, sMomBonus, sChem, rChem, isHomeServing);
    const { servingWins, scorer, eventType } = rally;
    const scoredBy: 'home' | 'away' = (isHomeServing === servingWins) ? 'home' : 'away';

    // Accumulate player stats
    if (statAcc && scorer && scorer.id !== undefined) {
      const scorerTeamId = (scoredBy === 'home' ? homeTeamId : awayTeamId) ?? 0;
      if (!statAcc.has(scorer.id)) {
        statAcc.set(scorer.id, { teamId: scorerTeamId, points: 0, spikes: 0, blocks: 0, aces: 0, digs: 0 });
      }
      const s = statAcc.get(scorer.id)!;
      s.points++;
      if (eventType === 'ace') s.aces++;
      else if (eventType === 'spike' || eventType === 'rally') s.spikes++;
      else if (eventType === 'block') s.blocks++;
      else if (eventType === 'dig_winner') s.digs++;
    }

    if (scoredBy === 'home') {
      homeScore++;
      streak = streak >= 0 ? streak + 1 : 1;
      if (!isHomeServing) serving = 'home';
    } else {
      awayScore++;
      streak = streak <= 0 ? streak - 1 : -1;
      if (isHomeServing) serving = 'away';
    }

    const maxScore = Math.max(homeScore, awayScore);
    const minScore = Math.min(homeScore, awayScore);
    if (maxScore >= target && maxScore - minScore >= 2) break;
  }

  return { homeScore, awayScore };
}

/**
 * Build a best-of-5 lineup automatically from a pool of players,
 * picking the best available by position.
 */
export function autoLineupFromPlayers(players: SimPlayer[]): SimLineup {
  const byPos: Record<string, SimPlayer[]> = {};
  for (const p of players) {
    if (!byPos[p.position]) byPos[p.position] = [];
    byPos[p.position].push(p);
  }
  for (const k in byPos) byPos[k].sort((a, b) => b.overall - a.overall);

  const used = new Set<number>();
  const pick = (pos: string): SimPlayer | null => {
    const arr = byPos[pos] ?? [];
    const p = arr.find(x => !used.has(x.id));
    if (p) { used.add(p.id); return p; }
    return null;
  };
  const pickAny = (): SimPlayer | null => {
    for (const pos of ['Outside Hitter', 'Middle Blocker', 'Opposite Hitter', 'Setter', 'Libero']) {
      const p = pick(pos);
      if (p) return p;
    }
    return players.find(x => !used.has(x.id)) ?? null;
  };

  return {
    OH1: pick('Outside Hitter') ?? pickAny(),
    MB1: pick('Middle Blocker')  ?? pickAny(),
    OPP: pick('Opposite Hitter') ?? pickAny(),
    S:   pick('Setter')          ?? pickAny(),
    MB2: pick('Middle Blocker')  ?? pickAny(),
    OH2: pick('Outside Hitter')  ?? pickAny(),
    L:   pick('Libero')          ?? pickAny(),
  };
}

/**
 * Run a complete best-of-5 match and return the final result.
 * Pass homeTeamId/awayTeamId to get per-player stats in the result.
 */
export function runFullMatch(
  homeLu: SimLineup,
  awayLu: SimLineup,
  homeTeamId?: number,
  awayTeamId?: number,
): MatchResult {
  const homeStr  = buildStrengths(homeLu);
  const awayStr  = buildStrengths(awayLu);
  const homeChem = computeChemistry(homeLu);
  const awayChem = computeChemistry(awayLu);

  const statAcc = new Map<number, { teamId: number; points: number; spikes: number; blocks: number; aces: number; digs: number }>();

  let homeSets = 0, awaySets = 0;
  let homeTotalPoints = 0, awayTotalPoints = 0;
  let setNum = 1;

  while (homeSets < 3 && awaySets < 3) {
    const { homeScore, awayScore } = simulateSet(
      setNum, homeStr, awayStr, homeLu, awayLu, homeChem, awayChem,
      statAcc, homeTeamId, awayTeamId,
    );
    if (homeScore > awayScore) homeSets++;
    else awaySets++;
    homeTotalPoints += homeScore;
    awayTotalPoints += awayScore;
    setNum++;
  }

  const playerStats: PlayerStatLine[] = [];
  for (const [playerId, s] of statAcc) {
    playerStats.push({ playerId, teamId: s.teamId, points: s.points, spikes: s.spikes, blocks: s.blocks, aces: s.aces, digs: s.digs });
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
