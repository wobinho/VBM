'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import {
    Swords, Play, Trophy, RotateCcw, Zap, FastForward, SkipForward, ChevronRight,
    AlertCircle, Users,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Team { id: number; team_name: string; played: number; won: number; lost: number; points: number; }

interface SimPlayer {
    id: number; player_name: string; position: string; overall: number;
    attack: number; serve: number; block: number; receive: number; setting: number;
    spike_power: number; spike_accuracy: number; jump_serve: number; float_serve: number;
    block_timing: number; dig_technique: number; pressure_handling: number; consistency: number;
    country: string; experience: number;
}

interface SimLineup { OH1: SimPlayer | null; MB1: SimPlayer | null; OPP: SimPlayer | null; S: SimPlayer | null; MB2: SimPlayer | null; OH2: SimPlayer | null; L: SimPlayer | null; }

interface TeamStrengths { serve: number; attack: number; block: number; receive: number; mental: number; overall: number; }

interface SetResult { home: number; away: number; }

interface PointLogEntry { text: string; scoredBy: 'home' | 'away'; homeTotal: number; awayTotal: number; }

interface MatchSimState {
    currentSet: number;
    homeScore: number;
    awayScore: number;
    homeSetsWon: number;
    awaySetsWon: number;
    completedSets: SetResult[];
    servingTeam: 'home' | 'away';
    pointLog: PointLogEntry[];
    done: boolean;
    winner: 'home' | 'away' | null;
    /** Consecutive points: positive = home on a run, negative = away on a run */
    homeStreak: number;
}

// ─── Simulation helpers ───────────────────────────────────────────────────────

function avg(nums: number[]): number {
    return nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 50;
}

function buildStrengths(lu: SimLineup): TeamStrengths {
    const all = Object.values(lu).filter(Boolean) as SimPlayer[];
    if (!all.length) return { serve: 50, attack: 50, block: 50, receive: 50, mental: 50, overall: 50 };

    const attackers = [lu.OH1, lu.OPP, lu.MB1, lu.MB2].filter(Boolean) as SimPlayer[];
    const blockers  = [lu.MB1, lu.MB2, lu.OH1, lu.OH2, lu.OPP].filter(Boolean) as SimPlayer[];
    const receivers = [lu.L, lu.OH1, lu.OH2].filter(Boolean) as SimPlayer[];
    const setterBonus = lu.S ? lu.S.setting * 0.04 : 0;

    return {
        serve:   avg(all.map(p => p.serve * 0.5 + p.jump_serve * 0.3 + p.float_serve * 0.2)),
        attack:  avg(attackers.map(p => p.attack * 0.4 + p.spike_power * 0.35 + p.spike_accuracy * 0.25)) + setterBonus,
        block:   avg(blockers.map(p => p.block * 0.5 + p.block_timing * 0.5)),
        receive: avg(receivers.map(p => p.receive * 0.5 + p.dig_technique * 0.5)),
        mental:  avg(all.map(p => p.pressure_handling * 0.5 + p.consistency * 0.5)),
        overall: avg(all.map(p => p.overall)),
    };
}

/**
 * Chemistry (0.75 – 1.25):
 *  +  Same nationality players communicate better → cohesion bonus
 *  +  High average experience → composed under pressure
 *  −  Patchwork roster from 7 different countries → strangers on court
 *
 * Chemistry primarily amplifies the mental / consistency battle in long rallies,
 * so a well-bonded 70 OVR squad can punch above their weight against a superteam
 * of strangers.
 */
function computeChemistry(lu: SimLineup): number {
    const players = Object.values(lu).filter(Boolean) as SimPlayer[];
    if (!players.length) return 1.0;

    // Nationality cohesion: fraction sharing the most common country
    const countryCount: Record<string, number> = {};
    for (const p of players) countryCount[p.country] = (countryCount[p.country] ?? 0) + 1;
    const maxGroup = Math.max(...Object.values(countryCount));
    const cohesion  = maxGroup / players.length;           // 0.14 (all diff) → 1.0 (all same)

    // Experience bonus: avg 0–100, centred at 50
    const avgExp    = players.reduce((s, p) => s + p.experience, 0) / players.length;
    const expBonus  = (avgExp - 50) / 200;                 // −0.25 → +0.25

    // Baseline 0.75 (strangers) → scales to 1.15 with full cohesion, ±exp
    return Math.min(1.25, Math.max(0.75, 0.75 + cohesion * 0.4 + expBonus));
}

/**
 * Converts a winning streak into a per-rally quality bonus.
 * Positive bonus belongs to home; the away momentum is its inverse.
 *   streak ±3  →  ±8 pts
 *   streak ±5  → ±14 pts
 *   streak ±7  → ±20 pts  (on fire)
 */
function getMomentumBonus(streak: number): number {
    const abs = Math.abs(streak);
    const bonus = abs >= 7 ? 20 : abs >= 5 ? 14 : abs >= 3 ? 8 : 0;
    return streak > 0 ? bonus : -bonus;
}

function autoLineup(players: SimPlayer[]): SimLineup {
    const byPos: Record<string, SimPlayer[]> = {};
    for (const p of players) {
        if (!byPos[p.position]) byPos[p.position] = [];
        byPos[p.position].push(p);
    }
    for (const k in byPos) byPos[k].sort((a, b) => b.overall - a.overall);

    const pick = (pos: string): SimPlayer | null => byPos[pos]?.shift() ?? null;
    const pickAny = (): SimPlayer | null => {
        for (const pos of ['Outside Hitter', 'Middle Blocker', 'Opposite Hitter', 'Setter', 'Libero']) {
            const p = pick(pos);
            if (p) return p;
        }
        return null;
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

// Random pick helpers
function pickOne<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function pickAttacker(lu: SimLineup): SimPlayer | null {
    return pickOne([lu.OH1, lu.OPP, lu.MB1, lu.MB2].filter(Boolean) as SimPlayer[]) ?? null;
}
function pickBlocker(lu: SimLineup): SimPlayer | null {
    return pickOne([lu.MB1, lu.MB2].filter(Boolean) as SimPlayer[]) ?? lu.OH1 ?? lu.OH2 ?? null;
}
function pickServer(lu: SimLineup): SimPlayer | null {
    return pickOne(Object.values(lu).filter(Boolean) as SimPlayer[]) ?? null;
}
function pickReceiver(lu: SimLineup): SimPlayer | null {
    return lu.L ?? lu.OH1 ?? lu.OH2 ?? null;
}
function pickAnyPlayer(lu: SimLineup): SimPlayer | null {
    return pickOne(Object.values(lu).filter(Boolean) as SimPlayer[]) ?? null;
}

type PointEventType = 'ace' | 'serve_error' | 'spike' | 'block' | 'dig_winner' | 'attack_error' | 'rally';

function describePoint(
    event: PointEventType,
    playerName: string,
    winnerTeamName: string,
    loserTeamName: string,
): string {
    switch (event) {
        case 'ace':          return pickOne([`ACE! ${playerName} rifles an unreturnable serve!`, `${playerName} fires a jump serve ace!`, `Ace from ${playerName}! ${loserTeamName} can't handle it!`]);
        case 'serve_error':  return pickOne([`Serve error by ${playerName}! ${loserTeamName} gives away a point.`, `${playerName}'s serve into the net. Free point for ${winnerTeamName}.`]);
        case 'spike':        return pickOne([`${playerName} HAMMERS it down! Unstoppable spike!`, `${playerName} with a powerful cross-court blast!`, `${playerName} finishes the rally with a clean kill!`]);
        case 'block':        return pickOne([`BLOCK! ${playerName} stuffs the attack!`, `${playerName} with a massive block rejection!`, `Huge block from ${playerName} — point ${winnerTeamName}!`]);
        case 'dig_winner':   return pickOne([`${playerName} digs everything — ${winnerTeamName} wins the rally!`, `Incredible defence by ${playerName}, ${winnerTeamName} earns the point!`]);
        case 'attack_error': return pickOne([`Attack error! ${playerName} sends it out!`, `${playerName} hits wide — ${winnerTeamName} gets the point!`, `Unforced error by ${playerName}.`]);
        case 'rally':        return pickOne([`Long rally, ${winnerTeamName} stays composed!`, `Intense exchange ends with ${winnerTeamName} pulling ahead!`, `${winnerTeamName} wins an epic rally!`]);
    }
}

/**
 * Core rally resolver.
 *
 * Key design principles:
 *  1. VARIANCE=80 → std dev ≈ 23 per quality roll, combined diff std dev ≈ 32.
 *     A 15-pt mean advantage → ~46% spike-win probability instead of the old ~90%.
 *  2. MOMENTUM shifts all quality rolls for the streaking team, so a 5-point run
 *     is genuinely hard to stop — but RNG still allows the comeback.
 *  3. SERVE PRESSURE cascades: a sharp serve (vs. weak receive) degrades the
 *     opponent's counter-attack quality, not just the ace chance. This is the
 *     "high-serve exploits high-block team's weak reception" mechanic — aces fly
 *     past blockers entirely, and poor passes lead to weaker sets.
 *  4. CHEMISTRY scales the mental/consistency tiebreaker — a cohesive 70-OVR
 *     squad can out-grind a superteam of strangers in long rallies.
 */
function simulateRally(
    sStr: TeamStrengths, rStr: TeamStrengths,
    sLu: SimLineup, rLu: SimLineup,
    sName: string, rName: string,
    sMomBonus: number,  // quality shift for serving team (+ve = serving team on a run)
    sChem: number,      // serving team chemistry multiplier
    rChem: number,      // receiving team chemistry multiplier
): { servingWins: boolean; text: string } {
    const rng = () => Math.random();

    // Serve pressure: how much the server's aggression exceeds the passer's skill.
    // Ranges roughly −0.5 (server weak / receiver strong) to +0.5 (dominant serve).
    const servePressure = (sStr.serve - rStr.receive) / 120;

    // ── Ace: 4–9% ──────────────────────────────────────────────────────────────
    // High serve + weak receive creates more aces. Momentum-focused servers are
    // more daring. Crucially, aces bypass blockers entirely — a team with elite
    // block but poor receive is exposed by a great server.
    const aceProb = Math.max(0.04, Math.min(0.09,
        0.06 + servePressure * 0.06 + sMomBonus / 500,
    ));
    if (rng() < aceProb) {
        const server = pickServer(sLu);
        return { servingWins: true, text: describePoint('ace', server?.player_name ?? 'Server', sName, rName) };
    }

    // ── Serve error: 5–9% ──────────────────────────────────────────────────────
    // Momentum teams are more composed, committing fewer unforced errors.
    const errProb = Math.max(0.05, Math.min(0.09,
        0.07 - (sStr.serve - 50) / 1500 - sMomBonus / 600,
    ));
    if (rng() < errProb) {
        const server = pickServer(sLu);
        return { servingWins: false, text: describePoint('serve_error', server?.player_name ?? 'Server', rName, sName) };
    }

    // ── Quality rolls (high variance + momentum offset) ─────────────────────────
    const V = 80;                       // total roll range → ±40 → std dev ≈ 23
    const momS =  sMomBonus;
    const momR = -sMomBonus;

    const atkQ  = sStr.attack  + momS + (rng() - 0.5) * V;
    const blkQ  = rStr.block   + momR + (rng() - 0.5) * V;

    // Serve pressure cascades into reception quality: bad pass → worse set → weaker dig
    const pressurePenalty = Math.max(0, servePressure * 12);
    const digQ  = (rStr.receive - pressurePenalty) + momR + (rng() - 0.5) * V;

    // Poor reception also degrades counter-attack (setter can't set a perfect ball
    // off a desperate dig)
    const cAtkQ = (rStr.attack  - Math.max(0, servePressure * 8)) + momR + (rng() - 0.5) * V;
    const cBlkQ = sStr.block    + momS + (rng() - 0.5) * V;

    // ── Block (cap 18%) ─────────────────────────────────────────────────────────
    const blockChance = Math.max(0, (blkQ - atkQ + 15) / 120);
    if (rng() < Math.min(0.18, blockChance)) {
        const blocker = pickBlocker(rLu);
        return { servingWins: false, text: describePoint('block', blocker?.player_name ?? 'Blocker', rName, sName) };
    }

    // ── Attack error (relative only) ────────────────────────────────────────────
    if (atkQ < digQ - 18 && rng() < 0.30) {
        const attacker = pickAttacker(sLu);
        return { servingWins: false, text: describePoint('attack_error', attacker?.player_name ?? 'Attacker', rName, sName) };
    }

    // ── Spike win ───────────────────────────────────────────────────────────────
    if (atkQ > digQ + 22) {
        const attacker = pickAttacker(sLu);
        return { servingWins: true, text: describePoint('spike', attacker?.player_name ?? 'Attacker', sName, rName) };
    }

    // ── Dig & counter-attack ────────────────────────────────────────────────────
    if (cAtkQ > cBlkQ + 18) {
        const digger = pickReceiver(rLu);
        return { servingWins: false, text: describePoint('dig_winner', digger?.player_name ?? 'Libero', rName, sName) };
    }

    // ── Long rally — chemistry-weighted mental battle ────────────────────────────
    // Chemistry multiplies the mental stat so cohesive teams stay calmer under
    // prolonged pressure; superteams of strangers crack more often in clutch rallies.
    const mentalAdv = (sStr.mental * sChem - rStr.mental * rChem) * 0.4 + (rng() - 0.5) * 60;
    if (mentalAdv > 0) {
        return { servingWins: true, text: describePoint('rally', sName, sName, rName) };
    } else {
        return { servingWins: false, text: describePoint('rally', rName, rName, sName) };
    }
}

function setTarget(setNum: number) { return setNum === 5 ? 15 : 25; }

function computeNextPoint(
    state: MatchSimState,
    homeStr: TeamStrengths, awayStr: TeamStrengths,
    homeLu: SimLineup, awayLu: SimLineup,
    homeName: string, awayName: string,
    homeChem: number, awayChem: number,
): MatchSimState {
    const isHomeServing = state.servingTeam === 'home';
    const sStr  = isHomeServing ? homeStr  : awayStr;
    const rStr  = isHomeServing ? awayStr  : homeStr;
    const sLu   = isHomeServing ? homeLu   : awayLu;
    const rLu   = isHomeServing ? awayLu   : homeLu;
    const sName = isHomeServing ? homeName : awayName;
    const rName = isHomeServing ? awayName : homeName;
    const sChem = isHomeServing ? homeChem : awayChem;
    const rChem = isHomeServing ? awayChem : homeChem;

    // Convert home's streak to a serving-team-perspective momentum bonus
    const rawMom   = getMomentumBonus(state.homeStreak);
    const sMomBonus = isHomeServing ? rawMom : -rawMom;

    const { servingWins, text } = simulateRally(
        sStr, rStr, sLu, rLu, sName, rName, sMomBonus, sChem, rChem,
    );

    let homeScore   = state.homeScore;
    let awayScore   = state.awayScore;
    let servingTeam = state.servingTeam;
    const scoredBy: 'home' | 'away' = (isHomeServing === servingWins) ? 'home' : 'away';

    // Update streak: extend if same team scored again, reset to ±1 on turnover
    let homeStreak = state.homeStreak;
    if (scoredBy === 'home') {
        homeStreak = homeStreak >= 0 ? homeStreak + 1 : 1;
        homeScore++;
        if (!isHomeServing) servingTeam = 'home';
    } else {
        homeStreak = homeStreak <= 0 ? homeStreak - 1 : -1;
        awayScore++;
        if (isHomeServing) servingTeam = 'away';
    }

    const target  = setTarget(state.currentSet);
    const setOver = (homeScore >= target || awayScore >= target) && Math.abs(homeScore - awayScore) >= 2;

    const entry: PointLogEntry = { text, scoredBy, homeTotal: homeScore, awayTotal: awayScore };
    const newLog = [entry, ...state.pointLog].slice(0, 8);

    if (!setOver) {
        return { ...state, homeScore, awayScore, servingTeam, pointLog: newLog, homeStreak };
    }

    // ── Set over — reset streak for fresh momentum in next set ──────────────────
    const homeWonSet = homeScore > awayScore;
    const newCompleted = [...state.completedSets, { home: homeScore, away: awayScore }];
    const newHomeSets  = state.homeSetsWon + (homeWonSet ? 1 : 0);
    const newAwaySets  = state.awaySetsWon + (homeWonSet ? 0 : 1);
    const matchOver    = newHomeSets === 3 || newAwaySets === 3;

    const setEndEntry: PointLogEntry = {
        text: `— Set ${state.currentSet} to ${homeWonSet ? homeName : awayName}! (${homeScore}–${awayScore}) —`,
        scoredBy,
        homeTotal: homeScore,
        awayTotal: awayScore,
    };

    return {
        currentSet:    matchOver ? state.currentSet : state.currentSet + 1,
        homeScore:     matchOver ? homeScore : 0,
        awayScore:     matchOver ? awayScore : 0,
        homeSetsWon:   newHomeSets,
        awaySetsWon:   newAwaySets,
        completedSets: newCompleted,
        servingTeam:   homeWonSet ? 'away' : 'home',
        pointLog:      [setEndEntry, ...state.pointLog].slice(0, 8),
        done:          matchOver,
        winner:        matchOver ? (newHomeSets > newAwaySets ? 'home' : 'away') : null,
        homeStreak:    0,  // fresh momentum each set
    };
}

function runToSetEnd(
    state: MatchSimState,
    homeStr: TeamStrengths, awayStr: TeamStrengths,
    homeLu: SimLineup, awayLu: SimLineup,
    homeName: string, awayName: string,
    homeChem: number, awayChem: number,
): MatchSimState {
    let s = state;
    const targetSet = s.currentSet;
    let safety = 0;
    while (!s.done && s.currentSet === targetSet && safety++ < 500) {
        s = computeNextPoint(s, homeStr, awayStr, homeLu, awayLu, homeName, awayName, homeChem, awayChem);
    }
    return s;
}

function runToMatchEnd(
    state: MatchSimState,
    homeStr: TeamStrengths, awayStr: TeamStrengths,
    homeLu: SimLineup, awayLu: SimLineup,
    homeName: string, awayName: string,
    homeChem: number, awayChem: number,
): MatchSimState {
    let s = state;
    let safety = 0;
    while (!s.done && safety++ < 2000) {
        s = computeNextPoint(s, homeStr, awayStr, homeLu, awayLu, homeName, awayName, homeChem, awayChem);
    }
    return s;
}

// ─── Component ────────────────────────────────────────────────────────────────

type SimSpeed = 'normal' | 'fast';
const SPEED_MS: Record<SimSpeed, number> = { normal: 650, fast: 100 };

export default function MatchPage() {
    const { team } = useAuth();

    // ── Setup phase state
    const [opponents, setOpponents] = useState<Team[]>([]);
    const [selectedOpp, setSelectedOpp] = useState<Team | null>(null);
    const [myLineup, setMyLineup] = useState<SimLineup | null>(null);
    const [lineupError, setLineupError] = useState<string | null>(null);
    const [loadingLineup, setLoadingLineup] = useState(true);

    // ── Match phase state
    const [phase, setPhase] = useState<'setup' | 'live' | 'done'>('setup');
    const [displayState, setDisplayState] = useState<MatchSimState | null>(null);
    const [speed, setSpeed] = useState<SimSpeed>('normal');
    const [homeChemistry, setHomeChemistry] = useState<number>(1.0);

    // ── Refs for simulation control (avoid stale closures)
    const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
    const speedRef     = useRef<SimSpeed>('normal');
    const matchRef     = useRef<MatchSimState | null>(null);
    const homeStrRef   = useRef<TeamStrengths | null>(null);
    const awayStrRef   = useRef<TeamStrengths | null>(null);
    const homeLuRef    = useRef<SimLineup | null>(null);
    const awayLuRef    = useRef<SimLineup | null>(null);
    const homeNameRef  = useRef<string>('Home');
    const awayNameRef  = useRef<string>('Away');
    const homeChemRef  = useRef<number>(1.0);
    const awayChemRef  = useRef<number>(1.0);

    // Load my lineup + opponents
    useEffect(() => {
        if (!team) return;
        setLoadingLineup(true);
        Promise.all([
            fetch(`/api/squad?teamId=${team.id}`).then(r => r.json()),
            fetch('/api/teams').then(r => r.json()),
        ]).then(([lineupData, teams]: [Record<string, SimPlayer | null>, Team[]]) => {
            const hasPlayers = Object.values(lineupData).some(Boolean);
            if (hasPlayers) {
                const lu = lineupData as unknown as SimLineup;
                setMyLineup(lu);
                setHomeChemistry(computeChemistry(lu));
                setLineupError(null);
            } else {
                setLineupError('No starting lineup set. Go to Squad Selection to set your lineup.');
            }
            setOpponents(teams.filter((t: Team) => t.id !== team.id));
            setLoadingLineup(false);
        });
    }, [team]);

    const stopTimer = useCallback(() => {
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    }, []);

    const stepSim = useCallback(() => {
        const state = matchRef.current;
        if (!state || state.done) return;

        const newState = computeNextPoint(
            state,
            homeStrRef.current!, awayStrRef.current!,
            homeLuRef.current!, awayLuRef.current!,
            homeNameRef.current, awayNameRef.current,
            homeChemRef.current, awayChemRef.current,
        );
        matchRef.current = newState;
        setDisplayState({ ...newState });

        if (newState.done) {
            setPhase('done');
        } else {
            const ms = SPEED_MS[speedRef.current];
            timerRef.current = setTimeout(stepSim, ms);
        }
    }, []);

    const startMatch = useCallback(async () => {
        if (!team || !myLineup || !selectedOpp) return;

        // Load opponent players and auto-generate their lineup
        const oppPlayers: SimPlayer[] = await fetch(`/api/players?teamId=${selectedOpp.id}`).then(r => r.json());
        const oppLu = autoLineup([...oppPlayers]);

        const homeStr  = buildStrengths(myLineup);
        const awayStr  = buildStrengths(oppLu);
        const homeChem = computeChemistry(myLineup);
        const awayChem = computeChemistry(oppLu);

        // Store in refs
        homeStrRef.current  = homeStr;
        awayStrRef.current  = awayStr;
        homeLuRef.current   = myLineup;
        awayLuRef.current   = oppLu;
        homeNameRef.current = team.name;
        awayNameRef.current = selectedOpp.team_name;
        homeChemRef.current = homeChem;
        awayChemRef.current = awayChem;

        const initialState: MatchSimState = {
            currentSet: 1, homeScore: 0, awayScore: 0,
            homeSetsWon: 0, awaySetsWon: 0, completedSets: [],
            servingTeam: 'home', pointLog: [], done: false, winner: null,
            homeStreak: 0,
        };

        matchRef.current = initialState;
        setDisplayState({ ...initialState });
        setPhase('live');
        timerRef.current = setTimeout(stepSim, SPEED_MS[speedRef.current]);
    }, [team, myLineup, selectedOpp, stepSim]);

    const handleSpeedToggle = useCallback(() => {
        const next: SimSpeed = speedRef.current === 'normal' ? 'fast' : 'normal';
        speedRef.current = next;
        setSpeed(next);
        // Reschedule timer at new speed
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = setTimeout(stepSim, SPEED_MS[next]);
        }
    }, [stepSim]);

    const handleSkipSet = useCallback(() => {
        stopTimer();
        const state = matchRef.current;
        if (!state || state.done) return;
        const newState = runToSetEnd(
            state,
            homeStrRef.current!, awayStrRef.current!,
            homeLuRef.current!, awayLuRef.current!,
            homeNameRef.current, awayNameRef.current,
            homeChemRef.current, awayChemRef.current,
        );
        matchRef.current = newState;
        setDisplayState({ ...newState });
        if (newState.done) {
            setPhase('done');
        } else {
            timerRef.current = setTimeout(stepSim, SPEED_MS[speedRef.current]);
        }
    }, [stopTimer, stepSim]);

    const handleSkipGame = useCallback(() => {
        stopTimer();
        const state = matchRef.current;
        if (!state) return;
        const newState = runToMatchEnd(
            state,
            homeStrRef.current!, awayStrRef.current!,
            homeLuRef.current!, awayLuRef.current!,
            homeNameRef.current, awayNameRef.current,
            homeChemRef.current, awayChemRef.current,
        );
        matchRef.current = newState;
        setDisplayState({ ...newState });
        setPhase('done');
    }, [stopTimer]);

    const handleReset = useCallback(async () => {
        stopTimer();
        if (displayState?.done && team && displayState.winner) {
            const myWon = displayState.winner === 'home';
            await fetch(`/api/teams/${team.id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ played: 1, won: myWon ? 1 : 0, lost: myWon ? 0 : 1 }),
            });
        }
        matchRef.current = null;
        setDisplayState(null);
        setSelectedOpp(null);
        setPhase('setup');
    }, [stopTimer, displayState, team]);

    // Cleanup on unmount
    useEffect(() => () => stopTimer(), [stopTimer]);

    const homeStr = myLineup ? buildStrengths(myLineup) : null;

    // ─── Render: Setup ───────────────────────────────────────────────────────
    if (phase === 'setup') {
        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Swords className="text-amber-400" />Match Simulation
                </h1>

                {/* Lineup status banner */}
                {loadingLineup ? (
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm">Loading lineup…</div>
                ) : lineupError ? (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-red-400">
                        <AlertCircle size={18} />
                        <span>{lineupError}</span>
                    </div>
                ) : (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-emerald-400 text-sm">
                        <Users size={16} />
                        <span>Lineup ready — {Object.values(myLineup!).filter(Boolean).length} players set</span>
                    </div>
                )}

                {/* Teams comparison */}
                <div className="grid grid-cols-3 gap-4 items-center">
                    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center">
                        <div className="w-14 h-14 mx-auto rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-2xl font-black text-amber-400 mb-3">
                            {team?.name?.charAt(0) ?? '?'}
                        </div>
                        <h3 className="font-bold text-white truncate">{team?.name ?? 'Your Team'}</h3>
                        {homeStr && (
                            <>
                                <div className="mt-2 text-2xl font-black text-amber-400">{Math.round(homeStr.overall)}</div>
                                <p className="text-xs text-gray-500">Overall</p>
                                <div className="mt-3 grid grid-cols-3 gap-1 text-[10px]">
                                    {[['ATK', homeStr.attack], ['BLK', homeStr.block], ['SRV', homeStr.serve]].map(([l, v]) => (
                                        <div key={l as string} className="bg-white/5 rounded p-1">
                                            <div className="text-gray-500">{l}</div>
                                            <div className="font-bold text-white">{Math.round(v as number)}</div>
                                        </div>
                                    ))}
                                </div>
                                {/* Chemistry indicator */}
                                <div className="mt-3">
                                    <div className="flex items-center justify-between text-[10px] mb-1">
                                        <span className="text-gray-500">Chemistry</span>
                                        <span className={`font-bold ${homeChemistry >= 1.15 ? 'text-emerald-400' : homeChemistry >= 1.0 ? 'text-amber-400' : 'text-red-400'}`}>
                                            {homeChemistry >= 1.15 ? 'High' : homeChemistry >= 1.0 ? 'Good' : homeChemistry >= 0.88 ? 'Low' : 'Poor'}
                                        </span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-black/30 overflow-hidden">
                                        <div className={`h-full rounded-full transition-all ${homeChemistry >= 1.15 ? 'bg-emerald-400' : homeChemistry >= 1.0 ? 'bg-amber-400' : 'text-red-400 bg-red-400'}`}
                                            style={{ width: `${Math.round(((homeChemistry - 0.75) / 0.5) * 100)}%` }} />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="text-center text-3xl font-black text-gray-600">VS</div>

                    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center">
                        {selectedOpp ? (
                            <>
                                <div className="w-14 h-14 mx-auto rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-2xl font-black text-red-400 mb-3">
                                    {selectedOpp.team_name.charAt(0)}
                                </div>
                                <h3 className="font-bold text-white truncate">{selectedOpp.team_name}</h3>
                                <div className="mt-2 text-sm text-gray-400">{selectedOpp.won}W – {selectedOpp.lost}L</div>
                            </>
                        ) : (
                            <p className="text-gray-500 py-6 text-sm">Select an opponent</p>
                        )}
                    </div>
                </div>

                {/* Opponent picker */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {opponents.map(opp => (
                        <button key={opp.id} onClick={() => setSelectedOpp(opp)}
                            className={`p-3 rounded-xl text-left transition-all ${selectedOpp?.id === opp.id
                                ? 'bg-red-500/20 border border-red-500/40 text-red-400'
                                : 'bg-white/5 border border-white/10 text-gray-300 hover:border-white/20'}`}>
                            <p className="font-semibold text-sm truncate">{opp.team_name}</p>
                            <p className="text-xs text-gray-500">{opp.won}W – {opp.lost}L</p>
                        </button>
                    ))}
                </div>

                <button
                    onClick={startMatch}
                    disabled={!selectedOpp || !!lineupError || loadingLineup}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-lg disabled:opacity-30 hover:from-amber-400 hover:to-orange-400 transition-all flex items-center justify-center gap-2"
                >
                    <Play size={20} />Play Match
                </button>
            </div>
        );
    }

    // ─── Render: Live + Done ─────────────────────────────────────────────────
    const ds = displayState;
    if (!ds) return null;

    const homeName = homeNameRef.current;
    const awayName = awayNameRef.current;
    const target = setTarget(ds.currentSet);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                    <Swords className="text-amber-400" />
                    {phase === 'done' ? 'Match Result' : `Set ${ds.currentSet} — Live`}
                </h1>
                {phase === 'live' && (
                    <div className="flex gap-2">
                        <button onClick={handleSpeedToggle}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${speed === 'fast'
                                ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
                                : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white'}`}>
                            <Zap size={12} />{speed === 'fast' ? 'Fast' : 'Normal'}
                        </button>
                        <button onClick={handleSkipSet}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 border border-white/10 text-gray-400 hover:text-white flex items-center gap-1 transition-all">
                            <SkipForward size={12} />Skip Set
                        </button>
                        <button onClick={handleSkipGame}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 border border-white/10 text-gray-400 hover:text-white flex items-center gap-1 transition-all">
                            <FastForward size={12} />Skip Game
                        </button>
                    </div>
                )}
            </div>

            {/* Scoreboard */}
            <div className={`rounded-2xl border p-6 ${phase === 'done'
                ? 'bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30'
                : 'bg-white/5 border-white/10'}`}>

                {phase === 'done' && (
                    <div className="text-center mb-4">
                        <Trophy size={40} className="mx-auto text-amber-400 mb-2" />
                        <p className="text-xl font-black text-white">
                            {ds.winner === 'home' ? homeName : awayName} Wins!
                        </p>
                    </div>
                )}

                {/* Current set scores */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 text-center">
                        <p className="text-sm text-gray-400 mb-1 truncate">{homeName}</p>
                        <div className="text-6xl font-black text-amber-400">{ds.homeScore}</div>
                        <div className="text-lg font-bold text-amber-300/60 mt-1">{ds.homeSetsWon} sets</div>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <span className="text-gray-600 text-2xl font-black">–</span>
                        {phase === 'live' && (
                            <span className="text-[10px] text-gray-600 font-semibold uppercase tracking-widest">
                                First to {target}
                            </span>
                        )}
                    </div>
                    <div className="flex-1 text-center">
                        <p className="text-sm text-gray-400 mb-1 truncate">{awayName}</p>
                        <div className="text-6xl font-black text-red-400">{ds.awayScore}</div>
                        <div className="text-lg font-bold text-red-300/60 mt-1">{ds.awaySetsWon} sets</div>
                    </div>
                </div>

                {/* Set progress bars (live only) */}
                {phase === 'live' && (
                    <>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                            <div className="h-1.5 rounded-full bg-black/30 overflow-hidden">
                                <div className="h-full bg-amber-400 rounded-full transition-all duration-300"
                                    style={{ width: `${Math.min(100, (ds.homeScore / target) * 100)}%` }} />
                            </div>
                            <div className="h-1.5 rounded-full bg-black/30 overflow-hidden">
                                <div className="h-full bg-red-400 rounded-full transition-all duration-300"
                                    style={{ width: `${Math.min(100, (ds.awayScore / target) * 100)}%` }} />
                            </div>
                        </div>
                        {/* Momentum indicator */}
                        {Math.abs(ds.homeStreak) >= 3 && (
                            <div className={`mt-3 text-center text-xs font-bold tracking-wide ${ds.homeStreak > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                                {ds.homeStreak > 0
                                    ? `${homeName} on a ${ds.homeStreak}-point run!`
                                    : `${awayName} on a ${Math.abs(ds.homeStreak)}-point run!`}
                                {Math.abs(ds.homeStreak) >= 5 && ' 🔥'}
                            </div>
                        )}
                    </>
                )}

                {/* Completed sets */}
                {ds.completedSets.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                        <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Set history</p>
                        <div className="flex gap-2 flex-wrap">
                            {ds.completedSets.map((s, i) => (
                                <div key={i} className="text-center px-3 py-1.5 rounded-lg bg-black/20 border border-white/5">
                                    <div className="text-[10px] text-gray-500">Set {i + 1}</div>
                                    <div className={`text-sm font-bold ${s.home > s.away ? 'text-amber-400' : 'text-red-400'}`}>
                                        {s.home}–{s.away}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Point-by-point log */}
            {phase === 'live' && ds.pointLog.length > 0 && (
                <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                    <div className="px-4 py-2 border-b border-white/5 text-xs text-gray-500 uppercase tracking-wider font-semibold">
                        Rally Log
                    </div>
                    <div className="divide-y divide-white/5">
                        {ds.pointLog.map((entry, i) => (
                            <div key={i} className={`px-4 py-2.5 flex items-center gap-3 transition-all ${i === 0 ? 'bg-white/5' : ''}`}>
                                <ChevronRight size={12} className={entry.scoredBy === 'home' ? 'text-amber-400' : 'text-red-400'} />
                                <span className="text-sm text-gray-300 flex-1">{entry.text}</span>
                                <span className="text-xs font-bold tabular-nums text-gray-500 shrink-0">
                                    {entry.homeTotal}–{entry.awayTotal}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Done: action buttons */}
            {phase === 'done' && (
                <div className="flex gap-3 justify-center">
                    <button onClick={handleReset}
                        className="px-6 py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-all flex items-center gap-2">
                        <RotateCcw size={16} />New Match
                    </button>
                </div>
            )}
        </div>
    );
}
