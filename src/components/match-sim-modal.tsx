'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import {
    Swords, Play, Trophy, RotateCcw, Zap, FastForward, SkipForward, ChevronRight,
    AlertCircle, Users, Activity, Shield, Star, TrendingUp, Award, Target, X,
} from 'lucide-react';
import {
    SimPlayer, SimLineup, TeamStrengths, SetResult, PointLogEntry,
    PlayerMatchStats, TeamMatchStats, MatchStats, MatchSimState,
    PointEventType, RallyPlayers, RallyTeams, RallyHighlight,
    emptyTeamStats, ensurePlayer, avg, buildStrengths, computeChemistry,
    getMomentumBonus, autoLineup, pickOne, weightedPick, pickServer,
    pickReceiver, pickAttacker, pickBlocker, describePoint,
    simulateRally, setTarget, computeNextPoint, runToSetEnd, runToMatchEnd
} from '@/lib/match-engine';

// ─── Speed ───────────────────────────────────────────────────────────────────

type SimSpeed = 'very_slow' | 'slow' | 'normal' | 'fast';
const SPEED_MS: Record<SimSpeed, number> = { very_slow: 3200, slow: 1600, normal: 600, fast: 80 };
const SPEED_LABELS: Record<SimSpeed, string> = { very_slow: 'Immersive', slow: 'Slow', normal: 'Normal', fast: 'Fast' };

// ─── TeamBadge ────────────────────────────────────────────────────────────────
function TeamBadge({ teamId, size = 'sm' }: { teamId?: number; size?: 'sm' | 'md' }) {
    const [src, setSrc] = useState(teamId ? `/assets/teams/${teamId}.png` : '');
    const [failed, setFailed] = useState(!teamId);
    const dims = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
    if (failed) return null;
    return (
        <div className={`relative ${dims} shrink-0`}>
            <img src={src} alt="Team" className="w-full h-full object-contain"
                onError={() => { if (src !== '/assets/teams/default.png') setSrc('/assets/teams/default.png'); else setFailed(true); }} />
        </div>
    );
}

// ─── PostGameStats ────────────────────────────────────────────────────────────
function PostGameStats({ stats, homeName, awayName }: { stats: MatchStats; homeName: string; awayName: string; }) {
    const [tab, setTab] = useState<'overview' | 'home' | 'away'>('overview');
    const h = stats.home, a = stats.away;
    const allPlayers = [...Object.values(h.players).map(p => ({ ...p, side: 'home' as const })), ...Object.values(a.players).map(p => ({ ...p, side: 'away' as const }))];
    const mvp        = allPlayers.reduce((best, p) => p.points  > (best?.points  ?? -1) ? p : best, allPlayers[0] ?? null);
    const topBlocker = allPlayers.reduce((best, p) => p.blocks  > (best?.blocks  ?? -1) ? p : best, allPlayers[0] ?? null);
    const topServer  = allPlayers.reduce((best, p) => p.aces    > (best?.aces    ?? -1) ? p : best, allPlayers[0] ?? null);
    const topDigger  = allPlayers.reduce((best, p) => p.digs    > (best?.digs    ?? -1) ? p : best, allPlayers[0] ?? null);
    const performers = [
        { title: 'MVP', icon: Star, player: mvp, stat: mvp?.points, unit: 'PTS', accent: 'from-amber-500/20 to-yellow-500/10 border-amber-500/30', text: 'text-amber-400' },
        { title: 'Top Server', icon: Zap, player: topServer, stat: topServer?.aces, unit: 'ACE', accent: 'from-sky-500/20 to-blue-500/10 border-sky-500/30', text: 'text-sky-400' },
        { title: 'Top Block', icon: Shield, player: topBlocker, stat: topBlocker?.blocks, unit: 'BLK', accent: 'from-violet-500/20 to-purple-500/10 border-violet-500/30', text: 'text-violet-400' },
        { title: 'Top Digger', icon: Activity, player: topDigger, stat: topDigger?.digs, unit: 'DIG', accent: 'from-emerald-500/20 to-green-500/10 border-emerald-500/30', text: 'text-emerald-400' },
    ];
    const overviewRows = [
        { label: 'Points', icon: Star, home: h.totalPoints, away: a.totalPoints },
        { label: 'Aces', icon: Zap, home: h.aces, away: a.aces },
        { label: 'Blocks', icon: Shield, home: h.blocks, away: a.blocks },
        { label: 'Spikes', icon: Target, home: h.spikes, away: a.spikes },
        { label: 'Digs', icon: Activity, home: h.digs, away: a.digs },
        { label: 'Serve Errors', icon: TrendingUp, home: h.serveErrors, away: a.serveErrors },
        { label: 'Attack Errors', icon: TrendingUp, home: h.attackErrors, away: a.attackErrors },
    ];
    const renderPlayerTable = (teamStats: TeamMatchStats, side: 'home' | 'away') => {
        const players = Object.values(teamStats.players).sort((a, b) => b.points - a.points);
        if (!players.length) return <p className="text-gray-500 text-sm text-center py-8">No player data</p>;
        const accent = side === 'home' ? 'text-amber-400' : 'text-red-400';
        const barColor = side === 'home' ? 'bg-amber-400' : 'bg-red-400';
        const maxPts = Math.max(...players.map(p => p.points), 1);
        return (
            <div className="overflow-x-auto -mx-1">
                <table className="w-full text-xs border-collapse">
                    <thead><tr className="text-[10px] uppercase tracking-widest text-gray-600 border-b border-white/8">
                        <th className="text-left py-2 pl-1 font-semibold">Player</th>
                        <th className="text-center py-2 px-1 font-semibold w-8">Pos</th>
                        <th className={`text-right py-2 px-2 font-semibold w-10 ${accent}`}>PTS</th>
                        <th className="text-right py-2 px-2 font-semibold w-9 text-sky-500">ACE</th>
                        <th className="text-right py-2 px-2 font-semibold w-9 text-violet-500">BLK</th>
                        <th className="text-right py-2 px-2 font-semibold w-9 text-emerald-500">ATK</th>
                        <th className="text-right py-2 px-2 font-semibold w-9 text-orange-500">DIG</th>
                        <th className="text-right py-2 pr-1 font-semibold w-9 text-red-500">ERR</th>
                    </tr></thead>
                    <tbody className="divide-y divide-white/[0.04]">
                        {players.map((p, idx) => {
                            const barPct = maxPts > 0 ? Math.min(100, (p.points / maxPts) * 100) : 0;
                            return (
                                <tr key={p.playerName} className={`transition-colors hover:bg-white/[0.03] ${idx === 0 ? 'bg-white/[0.02]' : ''}`}>
                                    <td className="py-2.5 pl-1"><div className="flex flex-col gap-0.5"><span className={`font-semibold leading-none ${idx === 0 ? 'text-white' : 'text-gray-300'}`}>{p.playerName}</span><div className="mt-1 h-0.5 rounded-full bg-white/8 overflow-hidden w-full max-w-[80px]"><div className={`h-full rounded-full ${barColor} transition-all duration-700`} style={{ width: `${barPct}%` }} /></div></div></td>
                                    <td className="text-center py-2.5 px-1 text-[9px] font-bold text-gray-600 uppercase">{p.position === 'Opposite Hitter' ? 'OP' : p.position.split(' ').map((w: string) => w[0]).join('')}</td>
                                    <td className={`text-right py-2.5 px-2 font-black tabular-nums ${idx === 0 ? accent : 'text-gray-300'}`}>{p.points}</td>
                                    <td className="text-right py-2.5 px-2 tabular-nums text-sky-400/80">{p.aces || '–'}</td>
                                    <td className="text-right py-2.5 px-2 tabular-nums text-violet-400/80">{p.blocks || '–'}</td>
                                    <td className="text-right py-2.5 px-2 tabular-nums text-emerald-400/80">{p.spikes || '–'}</td>
                                    <td className="text-right py-2.5 px-2 tabular-nums text-orange-400/80">{p.digs || '–'}</td>
                                    <td className="text-right py-2.5 pr-1 tabular-nums text-red-400/70">{(p.serveErrors + p.attackErrors) || '–'}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };
    return (
        <div className="rounded-2xl bg-gradient-to-b from-gray-950 to-gray-900 border border-white/10 overflow-hidden shadow-2xl">
            <div className="px-5 py-3.5 border-b border-white/[0.07] flex items-center gap-2 bg-black/20"><Award size={15} className="text-amber-400 shrink-0" /><h3 className="font-bold text-white text-sm uppercase tracking-widest">Match Statistics</h3></div>
            <div className="p-4 border-b border-white/[0.07]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-3">Top Performers</p>
                <div className="grid grid-cols-2 gap-2">
                    {performers.map(({ title, icon: Icon, player, stat, unit, accent, text }) => (
                        <div key={title} className={`rounded-xl bg-gradient-to-br ${accent} border p-3 flex items-center gap-3`}>
                            <div className="w-8 h-8 rounded-lg bg-black/30 flex items-center justify-center shrink-0"><Icon size={14} className={text} /></div>
                            <div className="min-w-0 flex-1"><p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">{title}</p><p className="text-xs font-semibold text-white truncate leading-tight mt-0.5">{player?.playerName ?? '—'}</p><p className={`text-[10px] font-black ${text} leading-none mt-0.5`}>{stat ?? 0} <span className="font-normal text-gray-600">{unit}</span></p></div>
                            {player && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-black/30 shrink-0 ${player.side === 'home' ? 'text-amber-400/70' : 'text-red-400/70'}`}>{player.side === 'home' ? homeName.slice(0, 3).toUpperCase() : awayName.slice(0, 3).toUpperCase()}</span>}
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex border-b border-white/[0.07] bg-black/10">
                {[{ key: 'overview', label: 'Overview' }, { key: 'home', label: homeName }, { key: 'away', label: awayName }].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key as typeof tab)} className={`flex-1 py-2.5 text-[11px] font-bold transition-all duration-150 cursor-pointer ${tab === t.key ? t.key === 'away' ? 'text-red-400 border-b-2 border-red-400' : 'text-amber-400 border-b-2 border-amber-400' : 'text-gray-600 hover:text-gray-400'}`}>
                        {t.label.length > 14 ? t.label.slice(0, 14) + '…' : t.label}
                    </button>
                ))}
            </div>
            <div className="p-4">
                {tab === 'overview' && (
                    <div className="space-y-0">
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center mb-4 gap-2"><span className="text-xs font-black text-amber-400 truncate">{homeName}</span><span className="text-[10px] text-gray-700 uppercase tracking-widest font-semibold text-center w-20">Stat</span><span className="text-xs font-black text-red-400 truncate text-right">{awayName}</span></div>
                        {overviewRows.map(row => {
                            const total = row.home + row.away || 1, homePct = (row.home / total) * 100;
                            const Icon = row.icon, homeWins = row.home >= row.away, awayWins = row.away > row.home;
                            return (
                                <div key={row.label} className="py-2.5 border-b border-white/[0.04] last:border-0">
                                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-2">
                                        <span className={`text-xl font-black tabular-nums ${homeWins ? 'text-amber-400' : 'text-gray-500'}`}>{row.home}</span>
                                        <div className="flex flex-col items-center gap-0.5 w-20"><Icon size={10} className="text-gray-600" /><span className="text-[9px] text-gray-600 uppercase tracking-wider font-semibold text-center leading-tight">{row.label}</span></div>
                                        <span className={`text-xl font-black tabular-nums text-right ${awayWins ? 'text-red-400' : 'text-gray-500'}`}>{row.away}</span>
                                    </div>
                                    <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden flex"><div className="h-full bg-amber-400/80 transition-all duration-700 ease-out" style={{ width: `${homePct}%` }} /><div className="h-full bg-red-400/80 transition-all duration-700 ease-out" style={{ width: `${100 - homePct}%` }} /></div>
                                </div>
                            );
                        })}
                    </div>
                )}
                {tab === 'home' && renderPlayerTable(h, 'home')}
                {tab === 'away' && renderPlayerTable(a, 'away')}
            </div>
        </div>
    );
}

// ─── Main Modal Component ─────────────────────────────────────────────────────

interface MatchSimModalProps {
    fixtureId: number;
    fixtureType?: 'regular' | 'playoff' | 'cup';
    onClose: () => void;
    onMatchComplete: () => Promise<void>;
}

export default function MatchSimModal({ fixtureId, fixtureType = 'regular', onClose, onMatchComplete }: MatchSimModalProps) {
    const { team } = useAuth();

    const [myLineup, setMyLineup] = useState<SimLineup | null>(null);
    const [lineupError, setLineupError] = useState<string | null>(null);
    const [loadingLineup, setLoadingLineup] = useState(true);
    const [selectedOpp, setSelectedOpp] = useState<{ id: number; team_name: string } | null>(null);

    const [oppStr, setOppStr] = useState<TeamStrengths | null>(null);
    const [oppChemistry, setOppChemistry] = useState<number>(1.0);

    const [liveHomeLu, setLiveHomeLu] = useState<SimLineup | null>(null);
    const [liveAwayLu, setLiveAwayLu] = useState<SimLineup | null>(null);

    const [phase, setPhase] = useState<'loading' | 'live' | 'done'>('loading');
    const [displayState, setDisplayState] = useState<MatchSimState | null>(null);
    const [speed, setSpeed] = useState<SimSpeed>('slow');
    const [activeHighlight, setActiveHighlight] = useState<RallyHighlight | null>(null);
    const [homeChemistry, setHomeChemistry] = useState<number>(1.0);
    const [userIsHome, setUserIsHome] = useState<boolean>(true);


    const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
    const speedRef    = useRef<SimSpeed>('slow');
    const matchRef    = useRef<MatchSimState | null>(null);
    const homeStrRef  = useRef<TeamStrengths | null>(null);
    const awayStrRef  = useRef<TeamStrengths | null>(null);
    const homeLuRef   = useRef<SimLineup | null>(null);
    const awayLuRef   = useRef<SimLineup | null>(null);
    const homeNameRef = useRef<string>('Home');
    const awayNameRef = useRef<string>('Away');
    const homeChemRef = useRef<number>(1.0);
    const awayChemRef = useRef<number>(1.0);
    const homeTeamIdRef = useRef<number | null>(null);
    const awayTeamIdRef = useRef<number | null>(null);

    // Load lineup & fixture data, then auto-start match
    useEffect(() => {
        if (!team) return;
        setLoadingLineup(true);
        const typeParam = fixtureType !== 'regular' ? `?type=${fixtureType}` : '';
        Promise.all([
            fetch(`/api/squad?teamId=${team.id}`).then(r => r.json()),
            fetch(`/api/fixtures/${fixtureId}${typeParam}`).then(r => r.json()),
        ]).then(async ([lineupData, fixtureRes]: [Record<string, SimPlayer | null>, any]) => {
            const hasPlayers = Object.values(lineupData).some(Boolean);
            if (!hasPlayers) {
                setLineupError('No starting lineup set. Go to Squad Selection to set your lineup.');
                setLoadingLineup(false);
                return;
            }
            const lu = lineupData as unknown as SimLineup;
            setMyLineup(lu);
            setHomeChemistry(computeChemistry(lu));

            if (fixtureRes && !fixtureRes.error) {
                const isHome = fixtureRes.home_team_id === team.id;
                setUserIsHome(isHome);
                const oppId = isHome ? fixtureRes.away_team_id : fixtureRes.home_team_id;
                const oppName = isHome ? fixtureRes.away_team_name : fixtureRes.home_team_name;
                setSelectedOpp({ id: oppId, team_name: oppName });

                // Load opp lineup
                const oppLineupData: Record<string, SimPlayer | null> = await fetch(`/api/squad?teamId=${oppId}`).then(r => r.json());
                const hasOppPlayers = Object.values(oppLineupData).some(Boolean);
                let oppLu: SimLineup;
                if (hasOppPlayers) {
                    oppLu = oppLineupData as unknown as SimLineup;
                } else {
                    const oppPlayers: SimPlayer[] = await fetch(`/api/players?teamId=${oppId}`).then(r => r.json());
                    oppLu = autoLineup([...oppPlayers]);
                }

                const homeStr = buildStrengths(lu);
                const awayStr = buildStrengths(oppLu);
                const homeChem = computeChemistry(lu);
                const awayChem = computeChemistry(oppLu);

                setOppStr(awayStr);
                setOppChemistry(awayChem);

                homeStrRef.current  = homeStr;
                awayStrRef.current  = awayStr;
                homeLuRef.current   = lu;
                awayLuRef.current   = oppLu;
                homeNameRef.current = team.name;
                awayNameRef.current = oppName;
                homeChemRef.current = homeChem;
                awayChemRef.current = awayChem;
                homeTeamIdRef.current = team.id;
                awayTeamIdRef.current = oppId;

                const initialState: MatchSimState = {
                    currentSet: 1, homeScore: 0, awayScore: 0,
                    homeSetsWon: 0, awaySetsWon: 0, completedSets: [],
                    servingTeam: 'home', pointLog: [], done: false, winner: null,
                    homeStreak: 0, matchStats: { home: emptyTeamStats(), away: emptyTeamStats() },
                };
                matchRef.current = initialState;
                setDisplayState({ ...initialState });
                setLiveHomeLu(lu);
                setLiveAwayLu(oppLu);
                setActiveHighlight(null);
                setPhase('live');
                timerRef.current = setTimeout(() => stepSimFn(), SPEED_MS[speedRef.current]);
            }
            setLoadingLineup(false);
        });
    }, [team, fixtureId]);

    const stopTimer = useCallback(() => {
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    }, []);

    const persistMatchResult = useCallback(async (finalState: MatchSimState) => {
        try {
            // The sim always places the user's team as "home" internally.
            // When the user is the away team in the fixture, we must swap the sets/points
            // so they map to the correct home/away columns in the database.
            const fixtureHomeSets   = userIsHome ? finalState.homeSetsWon : finalState.awaySetsWon;
            const fixtureAwaySets   = userIsHome ? finalState.awaySetsWon : finalState.homeSetsWon;
            const fixtureHomePoints = userIsHome ? finalState.matchStats.home.totalPoints : finalState.matchStats.away.totalPoints;
            const fixtureAwayPoints = userIsHome ? finalState.matchStats.away.totalPoints : finalState.matchStats.home.totalPoints;

            // Convert player stats from match format to API format, mapping player names to IDs
            const playerStats = [];
            const homeTeamId = homeTeamIdRef.current;
            const awayTeamId = awayTeamIdRef.current;

            // Create lookup maps by player name for both teams
            const homePlayerMap = new Map((homeLuRef.current ? Object.values(homeLuRef.current).filter(Boolean) as SimPlayer[] : []).map(p => [p.player_name, p]));
            const awayPlayerMap = new Map((awayLuRef.current ? Object.values(awayLuRef.current).filter(Boolean) as SimPlayer[] : []).map(p => [p.player_name, p]));

            for (const [playerName, stats] of Object.entries(finalState.matchStats.home.players)) {
                const player = homePlayerMap.get(playerName);
                if (player) {
                    playerStats.push({
                        playerId: player.id,
                        teamId: homeTeamId,
                        points: stats.points,
                        spikes: stats.spikes,
                        blocks: stats.blocks,
                        aces: stats.aces,
                        digs: stats.digs,
                    });
                }
            }
            for (const [playerName, stats] of Object.entries(finalState.matchStats.away.players)) {
                const player = awayPlayerMap.get(playerName);
                if (player) {
                    playerStats.push({
                        playerId: player.id,
                        teamId: awayTeamId,
                        points: stats.points,
                        spikes: stats.spikes,
                        blocks: stats.blocks,
                        aces: stats.aces,
                        digs: stats.digs,
                    });
                }
            }

            const typeParam = fixtureType !== 'regular' ? `?type=${fixtureType}` : '';
            await fetch(`/api/fixtures/${fixtureId}${typeParam}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    homeSets:   fixtureHomeSets,
                    awaySets:   fixtureAwaySets,
                    homePoints: fixtureHomePoints,
                    awayPoints: fixtureAwayPoints,
                    playerStats,
                }),
            });
        } catch (err) { console.error('Failed to save match result:', err); }
    }, [fixtureId, userIsHome]);

    const handleClose = useCallback(async () => {
        await onMatchComplete();
        onClose();
    }, [onMatchComplete, onClose]);

    // Use a ref for stepSim to avoid stale closures
    const stepSimRef = useRef<() => void>(() => {});

    const stepSimFn = useCallback(() => {
        const state = matchRef.current;
        if (!state || state.done) return;
        const newState = computeNextPoint(state, homeStrRef.current!, awayStrRef.current!, homeLuRef.current!, awayLuRef.current!, homeNameRef.current, awayNameRef.current, homeChemRef.current, awayChemRef.current);
        matchRef.current = newState;
        setDisplayState({ ...newState });
        const rp = newState.lastRallyPlayers, rt = newState.lastRallyTeams;
        const phases: RallyHighlight[] = [];
        if (rp?.server   && rt?.serverTeam)   phases.push({ playerName: rp.server,   team: rt.serverTeam,   phase: 'serve'   });
        if (rp?.receiver && rt?.receiverTeam) phases.push({ playerName: rp.receiver, team: rt.receiverTeam, phase: 'receive' });
        if (rp?.setter   && rt?.setterTeam)   phases.push({ playerName: rp.setter,   team: rt.setterTeam,   phase: 'set'     });
        if (rp?.attacker && rt?.attackerTeam) phases.push({ playerName: rp.attacker, team: rt.attackerTeam, phase: 'attack'  });
        if (rp?.blocker  && rt?.blockerTeam)  phases.push({ playerName: rp.blocker,  team: rt.blockerTeam,  phase: 'block'   });
        const totalMs = SPEED_MS[speedRef.current], stepMs = Math.min(500, Math.floor(totalMs / Math.max(phases.length + 1, 2)));
        if (phases.length > 0 && speedRef.current !== 'fast') {
            phases.forEach((h, i) => { setTimeout(() => setActiveHighlight(h), i * stepMs); });
            setTimeout(() => setActiveHighlight(null), phases.length * stepMs);
        }
        if (newState.done) {
            setPhase('done');
            persistMatchResult(newState);
        } else {
            timerRef.current = setTimeout(() => stepSimRef.current(), SPEED_MS[speedRef.current]);
        }
    }, [persistMatchResult]);

    useEffect(() => { stepSimRef.current = stepSimFn; }, [stepSimFn]);

    const handleSpeedToggle = useCallback(() => {
        const cycle: SimSpeed[] = ['very_slow', 'slow', 'normal', 'fast'];
        const next = cycle[(cycle.indexOf(speedRef.current) + 1) % cycle.length];
        speedRef.current = next; setSpeed(next);
        if (next === 'fast') setActiveHighlight(null);
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = setTimeout(() => stepSimRef.current(), SPEED_MS[next]); }
    }, []);

    const handleSkipSet = useCallback(() => {
        stopTimer(); setActiveHighlight(null);
        const state = matchRef.current;
        if (!state || state.done) return;
        const newState = runToSetEnd(state, homeStrRef.current!, awayStrRef.current!, homeLuRef.current!, awayLuRef.current!, homeNameRef.current, awayNameRef.current, homeChemRef.current, awayChemRef.current);
        matchRef.current = newState; setDisplayState({ ...newState });
        if (newState.done) { setPhase('done'); persistMatchResult(newState); }
        else timerRef.current = setTimeout(() => stepSimRef.current(), SPEED_MS[speedRef.current]);
    }, [stopTimer, persistMatchResult]);

    const handleSkipGame = useCallback(() => {
        stopTimer(); setActiveHighlight(null);
        const state = matchRef.current; if (!state) return;
        const newState = runToMatchEnd(state, homeStrRef.current!, awayStrRef.current!, homeLuRef.current!, awayLuRef.current!, homeNameRef.current, awayNameRef.current, homeChemRef.current, awayChemRef.current);
        matchRef.current = newState; setDisplayState({ ...newState });
        setPhase('done'); persistMatchResult(newState);
    }, [stopTimer, persistMatchResult]);

    useEffect(() => () => stopTimer(), [stopTimer]);

    const homeName = homeNameRef.current;
    const awayName = awayNameRef.current;
    const ds = displayState;

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
            <div className="relative w-full max-w-2xl my-4 bg-gray-950 border border-white/10 rounded-2xl shadow-2xl">
                {/* Close button */}
                {phase === 'done' && (
                    <button onClick={handleClose}
                        className="absolute top-3 right-3 z-10 p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all">
                        <X size={16} />
                    </button>
                )}

                <div className="p-5 space-y-4">
                    {/* Loading state */}
                    {phase === 'loading' && (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-gray-400 text-sm">Loading match data…</p>
                            {lineupError && (
                                <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-red-400">
                                    <AlertCircle size={16} />
                                    <span className="text-sm">{lineupError}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Live / Done state */}
                    {(phase === 'live' || phase === 'done') && ds && (() => {
                        const target = setTarget(ds.currentSet);
                        return (
                            <>
                                {/* Header */}
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                        <Swords className="text-amber-400" size={18} />
                                        {phase === 'done' ? 'Match Result' : `Set ${ds.currentSet} — Live`}
                                    </h2>
                                    {phase === 'live' && (
                                        <div className="flex gap-2">
                                            <button onClick={handleSpeedToggle}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${speed === 'fast' ? 'bg-red-500/20 border border-red-500/40 text-red-400' : speed === 'normal' ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400' : speed === 'slow' ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400' : 'bg-sky-500/20 border border-sky-500/40 text-sky-400'}`}>
                                                <Zap size={12} />{SPEED_LABELS[speed]}
                                            </button>
                                            <button onClick={handleSkipSet}
                                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 border border-white/10 text-gray-400 hover:text-white flex items-center gap-1 transition-all cursor-pointer">
                                                <SkipForward size={12} />Skip Set
                                            </button>
                                            <button onClick={handleSkipGame}
                                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 border border-white/10 text-gray-400 hover:text-white flex items-center gap-1 transition-all cursor-pointer">
                                                <FastForward size={12} />Skip Game
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Scoreboard */}
                                <div className={`rounded-2xl border p-5 ${phase === 'done' ? 'bg-gradient-to-br from-amber-500/10 via-gray-900 to-orange-500/10 border-amber-500/30' : 'bg-gradient-to-br from-gray-900 to-gray-800/80 border-white/10'}`}>
                                    {phase === 'done' && (
                                        <div className="text-center mb-4">
                                            <Trophy size={36} className="mx-auto text-amber-400 mb-2" />
                                            <p className="text-xl font-black text-white">{ds.winner === 'home' ? homeName : awayName} Wins!</p>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex-1 text-center">
                                            <div className="flex items-center justify-center gap-2 mb-1"><TeamBadge teamId={homeTeamIdRef.current ?? undefined} size="sm" /><p className="text-sm text-gray-400 truncate">{homeName}</p></div>
                                            <div className="text-5xl font-black text-amber-400">{ds.homeScore}</div>
                                            <div className="text-base font-bold text-amber-300/60 mt-1">{ds.homeSetsWon} sets</div>
                                        </div>
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-gray-600 text-2xl font-black">–</span>
                                            {phase === 'live' && <span className="text-[10px] text-gray-600 font-semibold uppercase tracking-widest">First to {target}</span>}
                                        </div>
                                        <div className="flex-1 text-center">
                                            <div className="flex items-center justify-center gap-2 mb-1"><TeamBadge teamId={awayTeamIdRef.current ?? undefined} size="sm" /><p className="text-sm text-gray-400 truncate">{awayName}</p></div>
                                            <div className="text-5xl font-black text-red-400">{ds.awayScore}</div>
                                            <div className="text-base font-bold text-red-300/60 mt-1">{ds.awaySetsWon} sets</div>
                                        </div>
                                    </div>
                                    {phase === 'live' && (
                                        <>
                                            <div className="mt-4 grid grid-cols-2 gap-2">
                                                <div className="h-1.5 rounded-full bg-black/30 overflow-hidden"><div className="h-full bg-amber-400 rounded-full transition-all duration-300" style={{ width: `${Math.min(100, (ds.homeScore / target) * 100)}%` }} /></div>
                                                <div className="h-1.5 rounded-full bg-black/30 overflow-hidden"><div className="h-full bg-red-400 rounded-full transition-all duration-300" style={{ width: `${Math.min(100, (ds.awayScore / target) * 100)}%` }} /></div>
                                            </div>
                                            {Math.abs(ds.homeStreak) >= 3 && (
                                                <div className={`mt-3 text-center text-xs font-bold tracking-wide ${ds.homeStreak > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                                                    {ds.homeStreak > 0 ? `${homeName} on a ${ds.homeStreak}-point run!` : `${awayName} on a ${Math.abs(ds.homeStreak)}-point run!`}
                                                    {Math.abs(ds.homeStreak) >= 5 && ' 🔥'}
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {ds.completedSets.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-white/10">
                                            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Set history</p>
                                            <div className="flex gap-2 flex-wrap">
                                                {ds.completedSets.map((s, i) => (
                                                    <div key={i} className="text-center px-3 py-1.5 rounded-lg bg-black/20 border border-white/5">
                                                        <div className="text-[10px] text-gray-500">Set {i + 1}</div>
                                                        <div className={`text-sm font-bold ${s.home > s.away ? 'text-amber-400' : 'text-red-400'}`}>{s.home}–{s.away}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Lineup panels — live only */}
                                {phase === 'live' && liveHomeLu && liveAwayLu && (
                                    <div className="grid grid-cols-2 gap-3">
                                        {(['home', 'away'] as const).map(side => {
                                            const lu = side === 'home' ? liveHomeLu : liveAwayLu;
                                            const name = side === 'home' ? homeName : awayName;
                                            const accentCls = side === 'home' ? 'text-amber-400 border-amber-500/20 bg-gradient-to-br from-amber-500/8 to-orange-500/5' : 'text-red-400 border-red-500/20 bg-gradient-to-br from-red-500/8 to-rose-500/5';
                                            const glowCls   = side === 'home' ? 'ring-amber-400/70 bg-amber-500/15 shadow-amber-400/20' : 'ring-red-400/70 bg-red-500/15 shadow-red-400/20';
                                            const rows: { slot: keyof SimLineup; label: string }[] = [
                                                { slot: 'OH1', label: 'OH' }, { slot: 'OH2', label: 'OH' }, { slot: 'OPP', label: 'OPP' },
                                                { slot: 'MB1', label: 'MB' }, { slot: 'MB2', label: 'MB' }, { slot: 'S', label: 'S' }, { slot: 'L', label: 'L' },
                                            ];
                                            const phaseLabel: Record<RallyHighlight['phase'], string> = { serve: 'Serving', receive: 'Receiving', set: 'Setting', attack: 'Attacking', block: 'Blocking' };
                                            return (
                                                <div key={side} className={`rounded-xl border p-3 ${accentCls}`}>
                                                    <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${side === 'home' ? 'text-amber-400' : 'text-red-400'}`}>{name}</p>
                                                    <div className="space-y-1">
                                                        {rows.map(({ slot, label }) => {
                                                            const p = lu[slot]; if (!p) return null;
                                                            const isActive = activeHighlight?.team === side && activeHighlight.playerName === p.player_name;
                                                            return (
                                                                <div key={slot} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-200 ${isActive ? `ring-1 ring-offset-0 shadow-md ${glowCls}` : ''}`}>
                                                                    <span className="text-[9px] font-black text-gray-600 w-6 shrink-0 uppercase">{label}</span>
                                                                    <span className={`text-xs font-medium truncate flex-1 transition-colors duration-200 ${isActive ? (side === 'home' ? 'text-amber-400' : 'text-red-400') : 'text-gray-300'}`}>{p.player_name}</span>
                                                                    {isActive && activeHighlight && <span className={`text-[9px] font-bold uppercase tracking-wide shrink-0 ${side === 'home' ? 'text-amber-400' : 'text-red-400'}`}>{phaseLabel[activeHighlight.phase]}</span>}
                                                                    {!isActive && <span className="text-[9px] text-gray-600 shrink-0">{p.overall}</span>}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Point log */}
                                {phase === 'live' && ds.pointLog.length > 0 && (
                                    <div className="rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800/80 border border-white/10 overflow-hidden">
                                        <div className="px-4 py-2 border-b border-white/5 text-xs text-gray-500 uppercase tracking-wider font-semibold">Rally Log</div>
                                        <div className="divide-y divide-white/5">
                                            {ds.pointLog.map((entry, i) => (
                                                <div key={i} className={`px-4 py-2.5 flex items-center gap-3 transition-all ${i === 0 ? 'bg-white/[0.03]' : ''}`}>
                                                    <ChevronRight size={12} className={entry.scoredBy === 'home' ? 'text-amber-400' : 'text-red-400'} />
                                                    <span className="text-sm text-gray-300 flex-1">{entry.text}</span>
                                                    <span className="text-xs font-bold tabular-nums text-gray-500 shrink-0">{entry.homeTotal}–{entry.awayTotal}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Post-game stats */}
                                {phase === 'done' && ds.matchStats && (
                                    <PostGameStats stats={ds.matchStats} homeName={homeName} awayName={awayName} />
                                )}

                                {/* Done: close button */}
                                {phase === 'done' && (
                                    <div className="flex gap-3 justify-center">
                                        <button onClick={handleClose}
                                            className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold hover:from-amber-400 hover:to-orange-400 transition-all flex items-center gap-2 cursor-pointer">
                                            <RotateCcw size={16} />Return to Dashboard
                                        </button>
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
}
