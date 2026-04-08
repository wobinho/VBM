// ─── Types ────────────────────────────────────────────────────────────────────

export interface SimPlayer {
    id: number; player_name: string; position: string; overall: number;
    attack: number; serve: number; block: number; receive: number; setting: number;
    precision: number; flair: number; digging: number; positioning: number;
    ball_control: number; technique: number; playmaking: number; spin: number;
    speed: number; agility: number; strength: number; endurance: number;
    vertical: number; flexibility: number; torque: number; balance: number;
    leadership: number; teamwork: number; concentration: number; pressure: number;
    consistency: number; vision: number; game_iq: number; intimidation: number;
    country: string;
}

export interface SimLineup { OH1: SimPlayer | null; MB1: SimPlayer | null; OPP: SimPlayer | null; S: SimPlayer | null; MB2: SimPlayer | null; OH2: SimPlayer | null; L: SimPlayer | null; }

export interface TeamStrengths { serve: number; attack: number; block: number; receive: number; mental: number; overall: number; }

export interface SetResult { home: number; away: number; }

export interface PointLogEntry { text: string; scoredBy: 'home' | 'away'; homeTotal: number; awayTotal: number; players?: RallyPlayers; teams?: RallyTeams; eventType?: PointEventType; }

export interface PlayerMatchStats {
    playerName: string; position: string; points: number; aces: number;
    blocks: number; spikes: number; digs: number; serveErrors: number; attackErrors: number;
}

export interface TeamMatchStats {
    totalPoints: number; aces: number; blocks: number; spikes: number;
    digs: number; serveErrors: number; attackErrors: number;
    players: Record<string, PlayerMatchStats>;
}

export interface MatchStats { home: TeamMatchStats; away: TeamMatchStats; }

export interface MatchSimState {
    currentSet: number; homeScore: number; awayScore: number;
    homeSetsWon: number; awaySetsWon: number; completedSets: SetResult[];
    servingTeam: 'home' | 'away'; pointLog: PointLogEntry[]; done: boolean;
    winner: 'home' | 'away' | null; homeStreak: number;
    lastRallyPlayers?: RallyPlayers; lastRallyTeams?: RallyTeams; matchStats: MatchStats;
}

export type PointEventType = 'ace' | 'serve_error' | 'spike' | 'block' | 'dig_winner' | 'attack_error' | 'rally';
export interface RallyPlayers { server?: string; receiver?: string; setter?: string; attacker?: string; blocker?: string; digger?: string; }
export interface RallyTeams { serverTeam?: 'home' | 'away'; receiverTeam?: 'home' | 'away'; setterTeam?: 'home' | 'away'; attackerTeam?: 'home' | 'away'; blockerTeam?: 'home' | 'away'; }

export interface RallyHighlight { playerName: string; team: 'home' | 'away'; phase: 'serve' | 'receive' | 'set' | 'attack' | 'block'; }

// ─── Simulation helpers ───────────────────────────────────────────────────────

export function emptyTeamStats(): TeamMatchStats {
    return { totalPoints: 0, aces: 0, blocks: 0, spikes: 0, digs: 0, serveErrors: 0, attackErrors: 0, players: {} };
}

export function ensurePlayer(stats: TeamMatchStats, player: SimPlayer): PlayerMatchStats {
    if (!stats.players[player.player_name]) {
        stats.players[player.player_name] = {
            playerName: player.player_name, position: player.position,
            points: 0, aces: 0, blocks: 0, spikes: 0, digs: 0, serveErrors: 0, attackErrors: 0,
        };
    }
    return stats.players[player.player_name];
}

export function avg(nums: number[]): number {
    return nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 50;
}

export function buildStrengths(lu: SimLineup): TeamStrengths {
    const all = Object.values(lu).filter(Boolean) as SimPlayer[];
    if (!all.length) return { serve: 50, attack: 50, block: 50, receive: 50, mental: 50, overall: 50 };
    const attackers = [lu.OH1, lu.OPP, lu.MB1, lu.MB2].filter(Boolean) as SimPlayer[];
    const blockers  = [lu.MB1, lu.MB2, lu.OH1, lu.OH2, lu.OPP].filter(Boolean) as SimPlayer[];
    const receivers = [lu.L, lu.OH1, lu.OH2].filter(Boolean) as SimPlayer[];
    const setterBonus = lu.S ? (lu.S.setting * 0.5 + lu.S.playmaking * 0.3 + lu.S.vision * 0.2) * 0.04 : 0;
    return {
        serve:   avg(all.map(p => p.serve * 0.40 + p.technique * 0.25 + p.spin * 0.20 + p.agility * 0.15)),
        attack:  avg(attackers.map(p => p.attack * 0.35 + p.precision * 0.25 + p.flair * 0.15 + p.strength * 0.15 + p.vertical * 0.10)) + setterBonus,
        block:   avg(blockers.map(p => p.block * 0.40 + p.positioning * 0.25 + p.vertical * 0.20 + p.concentration * 0.15)),
        receive: avg(receivers.map(p => p.receive * 0.35 + p.digging * 0.25 + p.ball_control * 0.20 + p.flexibility * 0.10 + p.balance * 0.10)),
        mental:  avg(all.map(p => p.pressure * 0.25 + p.consistency * 0.25 + p.game_iq * 0.20 + p.concentration * 0.15 + p.vision * 0.15)),
        overall: avg(all.map(p => p.overall)),
    };
}

export function computeChemistry(lu: SimLineup): number {
    const players = Object.values(lu).filter(Boolean) as SimPlayer[];
    if (!players.length) return 1.0;
    const countryCount: Record<string, number> = {};
    for (const p of players) countryCount[p.country] = (countryCount[p.country] ?? 0) + 1;
    const maxGroup = Math.max(...Object.values(countryCount));
    const cohesion = maxGroup / players.length;
    const avgTeamwork    = players.reduce((s, p) => s + p.teamwork, 0) / players.length;
    const avgLeadership  = players.reduce((s, p) => s + p.leadership, 0) / players.length;
    const teamworkBonus  = (avgTeamwork - 50) / 200;
    const leadershipBonus = (avgLeadership - 50) / 400;
    return Math.min(1.25, Math.max(0.75, 0.75 + cohesion * 0.35 + teamworkBonus + leadershipBonus));
}

export function getMomentumBonus(streak: number): number {
    const abs = Math.abs(streak);
    const bonus = abs >= 7 ? 12 : abs >= 5 ? 8 : abs >= 3 ? 4 : 0;
    return streak > 0 ? bonus : -bonus;
}

export function autoLineup(players: SimPlayer[]): SimLineup {
    const byPos: Record<string, SimPlayer[]> = {};
    for (const p of players) {
        if (!byPos[p.position]) byPos[p.position] = [];
        byPos[p.position].push(p);
    }
    for (const k in byPos) byPos[k].sort((a, b) => b.overall - a.overall);
    const pick = (pos: string): SimPlayer | null => byPos[pos]?.shift() ?? null;
    const pickAny = (): SimPlayer | null => {
        for (const pos of ['Outside Hitter', 'Middle Blocker', 'Opposite Hitter', 'Setter', 'Libero']) {
            const p = pick(pos); if (p) return p;
        }
        return null;
    };
    return {
        OH1: pick('Outside Hitter') ?? pickAny(), MB1: pick('Middle Blocker') ?? pickAny(),
        OPP: pick('Opposite Hitter') ?? pickAny(), S: pick('Setter') ?? pickAny(),
        MB2: pick('Middle Blocker') ?? pickAny(), OH2: pick('Outside Hitter') ?? pickAny(),
        L: pick('Libero') ?? pickAny(),
    };
}

export function pickOne<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

export function weightedPick(players: SimPlayer[], weightFn: (p: SimPlayer) => number): SimPlayer {
    const weights = players.map(weightFn);
    const total = weights.reduce((s, w) => s + Math.max(0.1, w), 0);
    let r = Math.random() * total;
    for (let i = 0; i < players.length; i++) {
        r -= Math.max(0.1, weights[i]);
        if (r <= 0) return players[i];
    }
    return players[players.length - 1];
}

export function pickServer(lu: SimLineup): SimPlayer | null {
    const all = Object.values(lu).filter(Boolean) as SimPlayer[];
    if (!all.length) return null;
    return weightedPick(all, p => p.serve * 0.40 + p.technique * 0.25 + p.spin * 0.20 + p.agility * 0.15);
}

export function pickReceiver(lu: SimLineup): SimPlayer | null {
    const cands = [lu.L, lu.OH1, lu.OH2].filter(Boolean) as SimPlayer[];
    if (!cands.length) return null;
    return weightedPick(cands, p => p.receive * 0.35 + p.digging * 0.25 + p.ball_control * 0.20 + p.flexibility * 0.10 + p.balance * 0.10);
}

export function pickAttacker(lu: SimLineup): SimPlayer | null {
    const cands = [lu.OH1, lu.OPP, lu.MB1, lu.MB2].filter(Boolean) as SimPlayer[];
    if (!cands.length) return null;
    return weightedPick(cands, p => p.attack * 0.35 + p.precision * 0.25 + p.flair * 0.15 + p.strength * 0.15 + p.vertical * 0.10);
}

export function pickBlocker(attackerPos: string | undefined, lu: SimLineup): SimPlayer | null {
    const blockWeight = (p: SimPlayer) => p.block * 0.40 + p.positioning * 0.25 + p.vertical * 0.20 + p.concentration * 0.15;
    if (attackerPos === 'Middle Blocker') {
        const cands = [lu.MB1, lu.MB2].filter(Boolean) as SimPlayer[];
        if (cands.length) return weightedPick(cands, blockWeight);
    } else {
        const cands = [lu.OH1, lu.OH2, lu.OPP].filter(Boolean) as SimPlayer[];
        if (cands.length) return weightedPick(cands, blockWeight);
    }
    const all = [lu.MB1, lu.MB2, lu.OH1, lu.OH2, lu.OPP].filter(Boolean) as SimPlayer[];
    if (!all.length) return null;
    return weightedPick(all, blockWeight);
}

export function describePoint(event: PointEventType, p: RallyPlayers, winnerTeamName: string, loserTeamName: string): string {
    const srv = p.server ?? 'Server', rec = p.receiver ?? 'Receiver', set = p.setter ?? 'Setter';
    const atk = p.attacker ?? 'Attacker', blk = p.blocker ?? 'Blocker', dig = p.digger ?? rec;
    switch (event) {
        case 'ace': return pickOne([`${srv} ➜ ACE! Unreturnable serve, ${loserTeamName} can't handle it!`, `${srv} rifles a jump serve ace past ${rec}!`, `ACE from ${srv}! ${rec} had no chance.`]);
        case 'serve_error': return pickOne([`${srv} serves into the net — free point for ${winnerTeamName}.`, `Serve error by ${srv}! ${loserTeamName} gives away a point.`]);
        case 'spike': return pickOne([`${srv} ➜ ${rec} digs ➜ ${set} sets ➜ ${atk} HAMMERS it down!`, `${srv} serves, ${rec} passes, ${set} sets up ${atk} — clean kill!`, `Beautiful rally: ${rec} ➜ ${set} ➜ ${atk} finishes with a cross-court blast!`]);
        case 'block': return pickOne([`${srv} ➜ ${rec} passes ➜ ${set} sets ➜ ${atk} attacks — BLOCKED by ${blk}!`, `${atk} swings hard but ${blk} stuffs it at the net!`, `Huge block from ${blk} — ${atk}'s spike goes straight back down!`]);
        case 'dig_winner': return pickOne([`${atk} attacks, ${dig} digs everything up — ${winnerTeamName} wins the rally!`, `Incredible defence by ${dig}! ${winnerTeamName} earns the counter-attack point.`]);
        case 'attack_error': return pickOne([`${srv} ➜ ${rec} ➜ ${set} ➜ ${atk} hits wide — ${winnerTeamName} gets the point!`, `Attack error by ${atk}! Ball goes out of bounds.`, `Unforced error from ${atk} — ${winnerTeamName} benefits.`]);
        case 'rally': return pickOne([`Long rally — ${winnerTeamName} stays composed to take the point!`, `Intense exchange ends with ${winnerTeamName} pulling ahead!`, `${winnerTeamName} grinds out an epic rally!`]);
    }
}

export function simulateRally(
    sStr: TeamStrengths, rStr: TeamStrengths, sLu: SimLineup, rLu: SimLineup,
    sName: string, rName: string, sMomBonus: number, sChem: number, rChem: number, servingIsHome: boolean,
): { servingWins: boolean; text: string; players: RallyPlayers; teams: RallyTeams; eventType: PointEventType;
    serverRef?: SimPlayer; receiverRef?: SimPlayer; setterRef?: SimPlayer;
    attackerRef?: SimPlayer; blockerRef?: SimPlayer; diggerRef?: SimPlayer; } {
    const rng = () => Math.random();
    const server = pickServer(sLu);
    const serveStat = server ? server.serve * 0.40 + server.technique * 0.25 + server.spin * 0.20 + server.agility * 0.15 : 50;
    const intimidationBonus = server ? server.intimidation * 0.05 : 0;
    const receiver = pickReceiver(rLu);
    const receiveStat = receiver ? receiver.receive * 0.35 + receiver.digging * 0.25 + receiver.ball_control * 0.20 + receiver.flexibility * 0.10 + receiver.balance * 0.10 : 50;
    const servePressure = (serveStat + intimidationBonus - receiveStat) / 120;
    const sTeam: 'home' | 'away' = servingIsHome ? 'home' : 'away';
    const rTeam: 'home' | 'away' = servingIsHome ? 'away' : 'home';
    const aceProb = Math.max(0.03, Math.min(0.12, 0.06 + servePressure * 0.08 + sMomBonus / 600));
    if (rng() < aceProb) return { servingWins: true, eventType: 'ace', text: describePoint('ace', { server: server?.player_name, receiver: receiver?.player_name }, sName, rName), players: { server: server?.player_name, receiver: receiver?.player_name }, teams: { serverTeam: sTeam, receiverTeam: rTeam }, serverRef: server ?? undefined, receiverRef: receiver ?? undefined };
    const serverConsistency = server ? (server.consistency * 0.5 + server.technique * 0.5) : 50;
    const errProb = Math.max(0.05, Math.min(0.11, 0.08 - (serveStat - 50) / 1200 - (serverConsistency - 50) / 2000 - sMomBonus / 700));
    if (rng() < errProb) return { servingWins: false, eventType: 'serve_error', text: describePoint('serve_error', { server: server?.player_name }, rName, sName), players: { server: server?.player_name }, teams: { serverTeam: sTeam }, serverRef: server ?? undefined };
    const setter = sLu.S;
    const setStat = setter ? setter.setting * 0.5 + setter.playmaking * 0.3 + setter.vision * 0.2 : 50;
    const setBonus = (setStat - 50) / 100 * 10;
    const attacker = pickAttacker(sLu);
    const atkStat = attacker ? attacker.attack * 0.35 + attacker.precision * 0.25 + attacker.flair * 0.15 + attacker.strength * 0.15 + attacker.vertical * 0.10 : 50;
    const blocker = pickBlocker(attacker?.position, rLu);
    const blkStat = blocker ? blocker.block * 0.40 + blocker.positioning * 0.25 + blocker.vertical * 0.20 + blocker.concentration * 0.15 : 50;
    const digger  = pickReceiver(rLu);
    const digStat = digger ? digger.receive * 0.35 + digger.digging * 0.25 + digger.ball_control * 0.20 + digger.flexibility * 0.10 + digger.balance * 0.10 : 50;
    const cAttacker = pickAttacker(rLu);
    const cAtkStat  = cAttacker ? cAttacker.attack * 0.35 + cAttacker.precision * 0.25 + cAttacker.flair * 0.15 + cAttacker.strength * 0.15 + cAttacker.vertical * 0.10 : 50;
    const cBlocker = pickBlocker(cAttacker?.position, sLu);
    const cBlkStat = cBlocker ? cBlocker.block * 0.40 + cBlocker.positioning * 0.25 + cBlocker.vertical * 0.20 + cBlocker.concentration * 0.15 : 50;
    const V = 220, momS = sMomBonus * 0.5, momR = -sMomBonus * 0.5;
    const pressurePenalty = Math.max(0, servePressure * 8);
    const atkQ  = (atkStat + setBonus) + momS + (rng() - 0.5) * V;
    const blkQ  = blkStat + momR + (rng() - 0.5) * V;
    const digQ  = (digStat - pressurePenalty) + momR + (rng() - 0.5) * V;
    const cAtkQ = (cAtkStat - Math.max(0, servePressure * 5)) + momR + (rng() - 0.5) * V;
    const cBlkQ = cBlkStat + momS + (rng() - 0.5) * V;
    const blockChance = Math.max(0, (blkQ - atkQ + 15) / 120);
    if (rng() < Math.min(0.22, blockChance)) return { servingWins: false, eventType: 'block', text: describePoint('block', { server: server?.player_name, receiver: receiver?.player_name, setter: setter?.player_name, attacker: attacker?.player_name, blocker: blocker?.player_name }, rName, sName), players: { server: server?.player_name, receiver: receiver?.player_name, setter: setter?.player_name, attacker: attacker?.player_name, blocker: blocker?.player_name }, teams: { serverTeam: sTeam, receiverTeam: rTeam, setterTeam: sTeam, attackerTeam: sTeam, blockerTeam: rTeam }, serverRef: server ?? undefined, receiverRef: receiver ?? undefined, setterRef: setter ?? undefined, attackerRef: attacker ?? undefined, blockerRef: blocker ?? undefined };
    if (atkQ < digQ - 18 && rng() < 0.30) return { servingWins: false, eventType: 'attack_error', text: describePoint('attack_error', { server: server?.player_name, receiver: receiver?.player_name, setter: setter?.player_name, attacker: attacker?.player_name }, rName, sName), players: { server: server?.player_name, receiver: receiver?.player_name, setter: setter?.player_name, attacker: attacker?.player_name }, teams: { serverTeam: sTeam, receiverTeam: rTeam, setterTeam: sTeam, attackerTeam: sTeam }, serverRef: server ?? undefined, receiverRef: receiver ?? undefined, setterRef: setter ?? undefined, attackerRef: attacker ?? undefined };
    if (atkQ > digQ + 22) return { servingWins: true, eventType: 'spike', text: describePoint('spike', { server: server?.player_name, receiver: receiver?.player_name, setter: setter?.player_name, attacker: attacker?.player_name }, sName, rName), players: { server: server?.player_name, receiver: receiver?.player_name, setter: setter?.player_name, attacker: attacker?.player_name }, teams: { serverTeam: sTeam, receiverTeam: rTeam, setterTeam: sTeam, attackerTeam: sTeam }, serverRef: server ?? undefined, receiverRef: receiver ?? undefined, setterRef: setter ?? undefined, attackerRef: attacker ?? undefined };
    if (cAtkQ > cBlkQ + 18) return { servingWins: false, eventType: 'dig_winner', text: describePoint('dig_winner', { attacker: attacker?.player_name, digger: digger?.player_name }, rName, sName), players: { attacker: attacker?.player_name, digger: digger?.player_name }, teams: { attackerTeam: sTeam, receiverTeam: rTeam }, attackerRef: cAttacker ?? undefined, diggerRef: digger ?? undefined };
    const sRallyBonus = sLu.S ? (sLu.S.vision * 0.5 + sLu.S.game_iq * 0.5) * 0.02 : 0;
    const rRallyBonus = rLu.S ? (rLu.S.vision * 0.5 + rLu.S.game_iq * 0.5) * 0.02 : 0;
    const sEndurance = avg(Object.values(sLu).filter(Boolean).map((p) => (p as SimPlayer).endurance));
    const rEndurance = avg(Object.values(rLu).filter(Boolean).map((p) => (p as SimPlayer).endurance));
    const sMental = (sStr.mental + sRallyBonus + sEndurance * 0.05) * (1 + (sChem - 1) * 0.1);
    const rMental = (rStr.mental + rRallyBonus + rEndurance * 0.05) * (1 + (rChem - 1) * 0.1);
    const mentalAdv = (sMental - rMental) * 0.4 + (rng() - 0.5) * 80;
    if (mentalAdv > 0) return { servingWins: true, eventType: 'rally', text: describePoint('rally', {}, sName, rName), players: { server: server?.player_name }, teams: { serverTeam: sTeam }, serverRef: server ?? undefined };
    return { servingWins: false, eventType: 'rally', text: describePoint('rally', {}, rName, sName), players: { server: server?.player_name }, teams: { serverTeam: sTeam }, serverRef: server ?? undefined };
}

export function setTarget(setNum: number) { return setNum === 5 ? 15 : 25; }

export function computeNextPoint(state: MatchSimState, homeStr: TeamStrengths, awayStr: TeamStrengths, homeLu: SimLineup, awayLu: SimLineup, homeName: string, awayName: string, homeChem: number, awayChem: number): MatchSimState {
    const isHomeServing = state.servingTeam === 'home';
    const sStr = isHomeServing ? homeStr : awayStr, rStr = isHomeServing ? awayStr : homeStr;
    const sLu = isHomeServing ? homeLu : awayLu, rLu = isHomeServing ? awayLu : homeLu;
    const sName = isHomeServing ? homeName : awayName, rName = isHomeServing ? awayName : homeName;
    const sChem = isHomeServing ? homeChem : awayChem, rChem = isHomeServing ? awayChem : homeChem;
    const rawMom = getMomentumBonus(state.homeStreak);
    const sMomBonus = isHomeServing ? rawMom : -rawMom;
    const result = simulateRally(sStr, rStr, sLu, rLu, sName, rName, sMomBonus, sChem, rChem, isHomeServing);
    const { servingWins, text, players, teams, eventType } = result;
    let homeScore = state.homeScore, awayScore = state.awayScore, servingTeam = state.servingTeam;
    const scoredBy: 'home' | 'away' = (isHomeServing === servingWins) ? 'home' : 'away';
    let homeStreak = state.homeStreak;
    if (scoredBy === 'home') { homeStreak = homeStreak >= 0 ? homeStreak + 1 : 1; homeScore++; if (!isHomeServing) servingTeam = 'home'; }
    else { homeStreak = homeStreak <= 0 ? homeStreak - 1 : -1; awayScore++; if (isHomeServing) servingTeam = 'away'; }
    const newStats: MatchStats = { home: { ...state.matchStats.home, players: { ...state.matchStats.home.players } }, away: { ...state.matchStats.away, players: { ...state.matchStats.away.players } } };
    const scoringSide = scoredBy, losingSide: 'home' | 'away' = scoredBy === 'home' ? 'away' : 'home';
    const losingTeamStats = newStats[losingSide];
    const sTeam: 'home' | 'away' = isHomeServing ? 'home' : 'away';
    const rTeam: 'home' | 'away' = isHomeServing ? 'away' : 'home';
    if (eventType === 'ace' && result.serverRef) { const p = ensurePlayer(newStats[sTeam], result.serverRef); p.aces++; p.points++; newStats[sTeam].aces++; newStats[sTeam].totalPoints++; }
    if (eventType === 'serve_error' && result.serverRef) { const p = ensurePlayer(newStats[sTeam], result.serverRef); p.serveErrors++; newStats[sTeam].serveErrors++; newStats[rTeam].totalPoints++; }
    if (eventType === 'spike' && result.attackerRef) { const p = ensurePlayer(newStats[sTeam], result.attackerRef); p.spikes++; p.points++; newStats[sTeam].spikes++; newStats[sTeam].totalPoints++; }
    if (eventType === 'block' && result.blockerRef) { const p = ensurePlayer(newStats[rTeam], result.blockerRef); p.blocks++; p.points++; newStats[rTeam].blocks++; newStats[rTeam].totalPoints++; }
    if (eventType === 'dig_winner') {
        if (result.diggerRef) { const dp = ensurePlayer(newStats[rTeam], result.diggerRef); dp.digs++; newStats[rTeam].digs++; }
        if (result.attackerRef) { const ap = ensurePlayer(newStats[rTeam], result.attackerRef); ap.spikes++; ap.points++; newStats[rTeam].spikes++; newStats[rTeam].totalPoints++; }
    }
    if (eventType === 'attack_error' && result.attackerRef) { const p = ensurePlayer(newStats[sTeam], result.attackerRef); p.attackErrors++; newStats[sTeam].attackErrors++; newStats[rTeam].totalPoints++; }
    const target = setTarget(state.currentSet);
    const setOver = (homeScore >= target || awayScore >= target) && Math.abs(homeScore - awayScore) >= 2;
    const entry: PointLogEntry = { text, scoredBy, homeTotal: homeScore, awayTotal: awayScore, players, teams, eventType };
    const newLog = [entry, ...state.pointLog].slice(0, 8);
    if (!setOver) return { ...state, homeScore, awayScore, servingTeam, pointLog: newLog, homeStreak, lastRallyPlayers: players, lastRallyTeams: teams, matchStats: newStats };
    const homeWonSet = homeScore > awayScore;
    const newCompleted = [...state.completedSets, { home: homeScore, away: awayScore }];
    const newHomeSets = state.homeSetsWon + (homeWonSet ? 1 : 0);
    const newAwaySets = state.awaySetsWon + (homeWonSet ? 0 : 1);
    const matchOver = newHomeSets === 3 || newAwaySets === 3;
    const setEndEntry: PointLogEntry = { text: `— Set ${state.currentSet} to ${homeWonSet ? homeName : awayName}! (${homeScore}–${awayScore}) —`, scoredBy, homeTotal: homeScore, awayTotal: awayScore };
    return {
        currentSet: matchOver ? state.currentSet : state.currentSet + 1,
        homeScore: matchOver ? homeScore : 0, awayScore: matchOver ? awayScore : 0,
        homeSetsWon: newHomeSets, awaySetsWon: newAwaySets, completedSets: newCompleted,
        servingTeam: homeWonSet ? 'away' : 'home',
        pointLog: [setEndEntry, ...state.pointLog].slice(0, 8),
        done: matchOver, winner: matchOver ? (newHomeSets > newAwaySets ? 'home' : 'away') : null,
        homeStreak: 0, lastRallyPlayers: players, lastRallyTeams: teams, matchStats: newStats,
    };
}

export function runToSetEnd(state: MatchSimState, homeStr: TeamStrengths, awayStr: TeamStrengths, homeLu: SimLineup, awayLu: SimLineup, homeName: string, awayName: string, homeChem: number, awayChem: number): MatchSimState {
    let s = state; const targetSet = s.currentSet; let safety = 0;
    while (!s.done && s.currentSet === targetSet && safety++ < 500) s = computeNextPoint(s, homeStr, awayStr, homeLu, awayLu, homeName, awayName, homeChem, awayChem);
    return s;
}

export function runToMatchEnd(state: MatchSimState, homeStr: TeamStrengths, awayStr: TeamStrengths, homeLu: SimLineup, awayLu: SimLineup, homeName: string, awayName: string, homeChem: number, awayChem: number): MatchSimState {
    let s = state; let safety = 0;
    while (!s.done && safety++ < 2000) s = computeNextPoint(s, homeStr, awayStr, homeLu, awayLu, homeName, awayName, homeChem, awayChem);
    return s;
}
