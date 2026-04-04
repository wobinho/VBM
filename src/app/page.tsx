'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import {
  Calendar, ChevronLeft, ChevronRight, Swords, Trophy, DollarSign,
  Play, Zap, TrendingUp, TrendingDown, Clock, Star, Activity,
  AlertCircle, CheckCircle2, X, Loader2, ArrowUpDown,
} from 'lucide-react';
import Image from 'next/image';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeamData {
  id: number; team_name: string;
  played: number; won: number; lost: number; points: number;
  sets_won: number; sets_lost: number;
  goal_diff: number; team_money: number; league_id: number;
}

interface Fixture {
  id: number;
  home_team_id: number; away_team_id: number;
  home_team_name: string; away_team_name: string;
  game_week: number; scheduled_date: string;
  status: string;
  home_sets: number | null; away_sets: number | null;
  season_name: string;
  is_playoff?: boolean;
  playoff_game_id?: number;
}

interface Season { id: number; year: number; name: string; }

interface GameState {
  currentDate: string;
  season: Season | null;
  userTeamId: number | null;
  upcomingFixtures: Fixture[];
  recentResults: Fixture[];
  userFixtureToday: Fixture | null;
}

interface SimResult {
  id: number; homeTeam: string; awayTeam: string;
  homeSets: number; awaySets: number; winner: 'home' | 'away';
}

interface AdvanceDayResult {
  previousDate: string;
  newDate: string;
  hasMatchDay: boolean;
  fixtureCount: number;
}

interface SimMatchdayResult {
  date: string;
  userFixtureId: number | null;
  userFixture: Fixture | null;
  simulatedCount: number;
  simulated: SimResult[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${MONTHS[parseInt(m) - 1]} ${parseInt(d)}, ${y}`;
}

function formatShortDate(iso: string) {
  const [, m, d] = iso.split('-');
  return `${MONTHS[parseInt(m) - 1].slice(0, 3)} ${parseInt(d)}`;
}

function formatMoney(n: number) {
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}K`;
}

function TeamLogo({ teamId, size = 32 }: { teamId: number; size?: number }) {
  const [src, setSrc] = useState(`/assets/teams/${teamId}.png`);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <Image src={src} alt="Team" fill unoptimized className="object-contain"
        onError={() => setSrc('/assets/teams/default.png')} />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { team } = useAuth();

  // Game state
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [players, setPlayers] = useState<{ overall: number }[]>([]);

  // Calendar
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [matchDates, setMatchDates] = useState<Set<string>>(new Set());
  const [userMatchDates, setUserMatchDates] = useState<Map<string, 'scheduled' | 'win' | 'loss'>>(new Map());
  // Maps date → opponent name for user's fixtures
  const [userMatchOpponent, setUserMatchOpponent] = useState<Map<string, string>>(new Map());

  // Day fixtures panel
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayFixtures, setDayFixtures] = useState<Fixture[]>([]);
  const [loadingDayFixtures, setLoadingDayFixtures] = useState(false);

  // Advance Day state
  const [advancing, setAdvancing] = useState(false);
  const [advanceError, setAdvanceError] = useState<string | null>(null);

  // Simulate matchday state
  const [simulatingMatchday, setSimulatingMatchday] = useState(false);
  const [matchdayResult, setMatchdayResult] = useState<SimMatchdayResult | null>(null);
  const [showResultsBanner, setShowResultsBanner] = useState(false);

  // Quick-sim state
  const [simming, setSimming] = useState(false);

  // Simulate-to-date state
  const [simToDate, setSimToDate] = useState(false);
  const [simToDateError, setSimToDateError] = useState<string | null>(null);

  // End-season result banner
  const [endSeasonResult, setEndSeasonResult] = useState<string | null>(null);

  // Season-gate states (Aug 31 / Dec 31)
  const [proceedingPlayoffs, setProceedingPlayoffs] = useState(false);
  const [proceedingNextSeason, setProceedingNextSeason] = useState(false);

  // ─── Data loading ──────────────────────────────────────────────────────────

  const loadGameState = useCallback(async () => {
    const res = await fetch('/api/game-state');
    if (res.ok) setGameState(await res.json());
  }, []);

  const loadTeamData = useCallback(async () => {
    if (!team) return;
    const [td, pl] = await Promise.all([
      fetch(`/api/teams/${team.id}`).then(r => r.json()),
      fetch(`/api/players?teamId=${team.id}`).then(r => r.json()),
    ]);
    setTeamData(td);
    setPlayers(pl);
  }, [team]);

  const loadMatchDates = useCallback(async () => {
    if (!team?.league_id) return;
    const res = await fetch(`/api/fixtures?datesOnly=true&leagueId=${team.league_id}`);
    if (!res.ok) return;
    const { dates } = await res.json();
    setMatchDates(new Set(dates as string[]));
  }, [team?.league_id]);

  const loadUserMatchDates = useCallback(async () => {
    if (!team) return;
    const res = await fetch(`/api/fixtures?teamId=${team.id}`);
    if (!res.ok) return;
    const fixtures: Fixture[] = await res.json();
    const map = new Map<string, 'scheduled' | 'win' | 'loss'>();
    const oppMap = new Map<string, string>();
    for (const f of fixtures) {
      const userIsHome = f.home_team_id === team.id;
      const oppName = userIsHome ? f.away_team_name : f.home_team_name;
      if (!oppMap.has(f.scheduled_date)) oppMap.set(f.scheduled_date, oppName);

      if (f.status === 'completed') {
        const userSets = userIsHome ? (f.home_sets ?? 0) : (f.away_sets ?? 0);
        const oppSets = userIsHome ? (f.away_sets ?? 0) : (f.home_sets ?? 0);
        map.set(f.scheduled_date, userSets > oppSets ? 'win' : 'loss');
      } else {
        if (!map.has(f.scheduled_date)) map.set(f.scheduled_date, 'scheduled');
      }
    }
    setUserMatchDates(map);
    setUserMatchOpponent(oppMap);
  }, [team]);

  useEffect(() => {
    loadGameState();
  }, [loadGameState]);

  useEffect(() => {
    loadTeamData();
    loadUserMatchDates();
  }, [loadTeamData, loadUserMatchDates]);

  useEffect(() => {
    if (gameState?.currentDate) {
      loadMatchDates();
      // Sync calendar to current game date
      const [y, m] = gameState.currentDate.split('-');
      setCalYear(parseInt(y));
      setCalMonth(parseInt(m) - 1);
    }
  }, [gameState?.currentDate, loadMatchDates]);

  // ─── Day fixtures ──────────────────────────────────────────────────────────

  const selectDate = useCallback(async (dateStr: string) => {
    if (selectedDate === dateStr) { setSelectedDate(null); return; }
    setSelectedDate(dateStr);
    setDayFixtures([]);
    setLoadingDayFixtures(true);
    const leagueId = team?.league_id;
    const url = leagueId
      ? `/api/fixtures?date=${dateStr}&leagueId=${leagueId}`
      : `/api/fixtures?date=${dateStr}`;
    const res = await fetch(url);
    if (res.ok) setDayFixtures(await res.json());
    setLoadingDayFixtures(false);
  }, [selectedDate, team?.league_id]);

  // ─── Advance Day (calendar +1, no simulation) ─────────────────────────────

  const handleAdvanceDay = async () => {
    setAdvancing(true);
    setAdvanceError(null);
    const res = await fetch('/api/advance-day', { method: 'POST' });
    if (res.status === 409) {
      const err = await res.json();
      setAdvanceError(err.message ?? 'Simulate all matches before advancing.');
      setAdvancing(false);
      return;
    }
    const data: AdvanceDayResult = await res.json();
    await Promise.all([loadGameState(), loadTeamData(), loadUserMatchDates()]);
    setAdvancing(false);
    if (data.newDate) {
      const [y, m] = data.newDate.split('-');
      setCalYear(parseInt(y)); setCalMonth(parseInt(m) - 1);
    }
  };

  // ─── Simulate match day (AI matches only, user fixture stays scheduled) ────

  const handleSimulateMatchday = async () => {
    setSimulatingMatchday(true);
    setMatchdayResult(null);
    setShowResultsBanner(false);
    const res = await fetch('/api/simulate-matchday', { method: 'POST' });
    const data: SimMatchdayResult = await res.json();
    setMatchdayResult(data);
    setShowResultsBanner(true);
    await Promise.all([loadGameState(), loadTeamData(), loadUserMatchDates()]);
    setSimulatingMatchday(false);
  };

  // ─── Simulate to a target date (all matches, incl. user's) ───────────────

  const handleSimToDate = async (targetDate: string) => {
    setSimToDate(true);
    setSimToDateError(null);
    try {
      const res = await fetch('/api/simulate-to-date', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetDate }),
      });
      const data = await res.json();
      if (!res.ok) { setSimToDateError(data.error ?? 'Simulation failed'); return; }
      await Promise.all([loadGameState(), loadTeamData(), loadUserMatchDates(), loadMatchDates()]);
      setSelectedDate(targetDate);
      // reload fixtures for the target date
      setDayFixtures([]);
      setLoadingDayFixtures(true);
      const leagueId = team?.league_id;
      const url = leagueId
        ? `/api/fixtures?date=${targetDate}&leagueId=${leagueId}`
        : `/api/fixtures?date=${targetDate}`;
      const fx = await fetch(url);
      if (fx.ok) setDayFixtures(await fx.json());
      setLoadingDayFixtures(false);
    } finally {
      setSimToDate(false);
    }
  };


  // ─── Proceed to Playoffs / Vacation (Aug 31 gate) ─────────────────────────

  const handleProceedToPlayoffs = async () => {
    setProceedingPlayoffs(true);
    setAdvanceError(null);
    try {
      const res = await fetch('/api/proceed-to-playoffs', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setAdvanceError(data.error ?? 'Failed to proceed.');
        return;
      }
      await Promise.all([loadGameState(), loadTeamData(), loadUserMatchDates(), loadMatchDates()]);
      if (data.newDate) {
        const [y, m] = data.newDate.split('-');
        setCalYear(parseInt(y)); setCalMonth(parseInt(m) - 1);
      }
    } catch (e: any) {
      setAdvanceError(e.message ?? 'Network error');
    }
    setProceedingPlayoffs(false);
  };

  // ─── Proceed to Next Season (Dec 31 gate) ─────────────────────────────────

  const handleProceedToNextSeason = async () => {
    setProceedingNextSeason(true);
    setEndSeasonResult(null);
    try {
      const res = await fetch('/api/admin/end-season', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setEndSeasonResult(data.message ?? 'New season started!');
        await Promise.all([loadGameState(), loadTeamData(), loadUserMatchDates(), loadMatchDates()]);
      } else {
        setEndSeasonResult(`Error: ${data.error ?? 'Failed'}`);
      }
    } catch (e: any) {
      setEndSeasonResult(`Error: ${e.message}`);
    }
    setProceedingNextSeason(false);
  };

  // ─── Quick-sim user fixture ────────────────────────────────────────────────

  const handleQuickSim = async (fixtureId: number) => {
    setSimming(true);
    await fetch(`/api/fixtures/${fixtureId}`, { method: 'POST' });
    await Promise.all([loadGameState(), loadTeamData(), loadUserMatchDates()]);
    setSimming(false);
  };

  // ─── Calendar logic ────────────────────────────────────────────────────────

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const calCells = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const currentDateStr = gameState?.currentDate ?? '';
  const [cy, cm] = currentDateStr.split('-');
  const todayIsInView = parseInt(cy) === calYear && parseInt(cm) - 1 === calMonth;

  function dayCellClasses(day: number | null): string {
    if (!day) return '';
    const iso = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = iso === currentDateStr && todayIsInView;
    const isSelected = iso === selectedDate;
    const userStatus = userMatchDates.get(iso);
    const hasAnyMatch = matchDates.has(iso);

    let base = 'relative flex flex-col items-center justify-center rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer select-none py-1 h-full min-h-[60px] ';

    if (isSelected) {
      base += 'ring-2 ring-amber-400 bg-amber-500/20 text-amber-300 ';
    } else if (isToday) {
      base += 'ring-2 ring-white/40 bg-white/10 text-white font-bold ';
    } else if (userStatus === 'win') {
      base += 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 ';
    } else if (userStatus === 'loss') {
      base += 'bg-red-500/15 text-red-300 hover:bg-red-500/25 ';
    } else if (userStatus === 'scheduled') {
      base += 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 ';
    } else if (hasAnyMatch) {
      base += 'text-slate-300 hover:bg-white/10 ';
    } else {
      base += 'text-slate-500 hover:bg-white/5 ';
    }

    return base;
  }

  function DayDot({ day }: { day: number }) {
    const iso = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const userStatus = userMatchDates.get(iso);
    const hasAnyMatch = matchDates.has(iso);

    if (userStatus === 'win') return <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-400" />;
    if (userStatus === 'loss') return <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-red-400" />;
    if (userStatus === 'scheduled') return <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-400" />;
    if (hasAnyMatch) return <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-sky-500/60" />;
    return null;
  }

  // ─── Derived stats ─────────────────────────────────────────────────────────

  const avgOverall = players.length > 0
    ? Math.round(players.reduce((s, p) => s + p.overall, 0) / players.length)
    : 0;

  const nextFixture = gameState?.upcomingFixtures?.[0] ?? null;

  function getResultBadge(f: Fixture) {
    if (!team || f.home_sets == null) return null;
    const userIsHome = f.home_team_id === team.id;
    const us = userIsHome ? (f.home_sets ?? 0) : (f.away_sets ?? 0);
    const them = userIsHome ? (f.away_sets ?? 0) : (f.home_sets ?? 0);
    const won = us > them;
    return { us, them, won };
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 pb-10">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-black text-white tracking-tight">{team?.name || 'Dashboard'}</h1>
            {teamData && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-amber-500/20 text-amber-400 border border-amber-500/25">
                {teamData.points} PTS
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-2">
            <Clock size={12} className="text-slate-600" />
            {gameState?.currentDate ? formatDate(gameState.currentDate) : 'Loading…'}
            {gameState?.season && (
              <span className="text-slate-600">· {gameState.season.name}</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Aug 31 gate — Proceed to Playoffs (Premier) or Vacation (other leagues) */}
          {currentDateStr.endsWith('-08-31') ? (
            <button
              onClick={handleProceedToPlayoffs}
              disabled={proceedingPlayoffs}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-150
                bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400
                disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-amber-500/25 active:scale-95 cursor-pointer"
            >
              {proceedingPlayoffs ? (
                <><Loader2 size={14} className="animate-spin" /> Processing…</>
              ) : team?.league_id === 1 ? (
                <><Trophy size={14} /> Proceed to Playoffs</>
              ) : (
                <><Star size={14} /> Proceed to Vacation</>
              )}
            </button>
          ) : currentDateStr.endsWith('-12-31') ? (
            /* Dec 31 gate — Proceed to Next Season */
            <button
              onClick={handleProceedToNextSeason}
              disabled={proceedingNextSeason}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-150
                bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:from-violet-400 hover:to-purple-500
                disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-violet-500/25 active:scale-95 cursor-pointer"
            >
              {proceedingNextSeason ? (
                <><Loader2 size={14} className="animate-spin" /> Starting New Season…</>
              ) : (
                <><ArrowUpDown size={14} /> Proceed to Next Season</>
              )}
            </button>
          ) : (
            <>
              {/* Simulate Match Day — only visible when today has fixtures and not yet simulated */}
              {gameState?.userFixtureToday && !matchdayResult && (
                <button
                  onClick={handleSimulateMatchday}
                  disabled={simulatingMatchday}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-150
                    bg-gradient-to-r from-sky-500 to-indigo-500 text-white hover:from-sky-400 hover:to-indigo-400
                    disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-sky-500/20 active:scale-95 cursor-pointer"
                >
                  {simulatingMatchday ? (
                    <><Loader2 size={14} className="animate-spin" /> Simulating…</>
                  ) : (
                    <><Zap size={14} /> Simulate Match Day</>
                  )}
                </button>
              )}
              <button
                onClick={handleAdvanceDay}
                disabled={advancing}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-150 shadow-lg
                  bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400
                  disabled:opacity-60 disabled:cursor-not-allowed shadow-amber-500/25 active:scale-95 cursor-pointer"
              >
                {advancing ? (
                  <><Loader2 size={14} className="animate-spin" /> Advancing…</>
                ) : (
                  <><ChevronRight size={14} /> Advance Day</>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Advance Day Error Banner ─────────────────────────────────────────── */}
      {advanceError && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
          <AlertCircle size={14} className="text-red-400 shrink-0" />
          <span className="flex-1">{advanceError}</span>
          <button onClick={() => setAdvanceError(null)} className="text-red-400/60 hover:text-red-300 transition-colors cursor-pointer">
            <X size={13} />
          </button>
        </div>
      )}

      {/* ── Aug 31 Season Gate Banner ───────────────────────────────────────── */}
      {currentDateStr.endsWith('-08-31') && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-sm">
          <Trophy size={14} className="text-amber-400 shrink-0" />
          <span className="flex-1">
            {team?.league_id === 1
              ? 'The regular season is over! Top 4 from each conference advance to the playoffs. Press "Proceed to Playoffs" to continue.'
              : 'The regular season is over! Press "Proceed to Vacation" to skip to the off-season.'}
          </span>
        </div>
      )}

      {/* ── Dec 31 Season Gate Banner ───────────────────────────────────────── */}
      {currentDateStr.endsWith('-12-31') && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-300 text-sm">
          <Star size={14} className="text-violet-400 shrink-0" />
          <span className="flex-1">The season has ended. Press "Proceed to Next Season" to start a new season with fresh fixtures.</span>
        </div>
      )}

      {/* ── End Season Result Banner ────────────────────────────────────────── */}
      {endSeasonResult && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${endSeasonResult.startsWith('Error')
          ? 'border-red-500/30 bg-red-500/10 text-red-300'
          : 'border-violet-500/30 bg-violet-500/10 text-violet-300'
          }`}>
          {endSeasonResult.startsWith('Error')
            ? <AlertCircle size={14} className="shrink-0" />
            : <CheckCircle2 size={14} className="shrink-0 text-violet-400" />}
          <span className="flex-1">{endSeasonResult}</span>
          <button onClick={() => setEndSeasonResult(null)} className="opacity-60 hover:opacity-100 transition-opacity cursor-pointer">
            <X size={13} />
          </button>
        </div>
      )}

      {/* ── Matchday Results Banner ──────────────────────────────────────────── */}
      {showResultsBanner && matchdayResult && (
        <div className="rounded-2xl border border-white/10 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(10,15,26,0.98) 100%)' }}>
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <Activity size={14} className="text-sky-400" />
              <span className="text-sm font-bold text-white">
                Matchday Results — {formatShortDate(matchdayResult.date)}
              </span>
              <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                {matchdayResult.simulatedCount} matches played
              </span>
            </div>
            <button onClick={() => setShowResultsBanner(false)} className="text-slate-500 hover:text-white transition-colors cursor-pointer p-1 rounded-lg hover:bg-white/5">
              <X size={14} />
            </button>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {matchdayResult.simulated.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-semibold truncate ${r.winner === 'home' ? 'text-white' : 'text-slate-400'}`}>{r.homeTeam}</span>
                    <span className={`text-xs font-black shrink-0 ${r.winner === 'home' ? 'text-emerald-400' : 'text-slate-500'}`}>{r.homeSets}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className={`text-xs font-semibold truncate ${r.winner === 'away' ? 'text-white' : 'text-slate-400'}`}>{r.awayTeam}</span>
                    <span className={`text-xs font-black shrink-0 ${r.winner === 'away' ? 'text-emerald-400' : 'text-slate-500'}`}>{r.awaySets}</span>
                  </div>
                </div>
              </div>
            ))}
            {matchdayResult.userFixtureId && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 col-span-full">
                <AlertCircle size={14} className="text-amber-400 shrink-0" />
                <span className="text-xs text-amber-300 font-medium">
                  Your match vs {matchdayResult.userFixture?.away_team_name ?? matchdayResult.userFixture?.home_team_name} is ready — play it below!
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Stat Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Record', icon: Trophy,
            value: teamData ? `${teamData.won}W – ${teamData.lost}L` : '—',
            sub: teamData ? `${teamData.played} played` : '',
            from: 'from-amber-500/10', border: 'border-amber-500/20', icon_c: 'text-amber-400',
          },
          {
            label: 'Points', icon: Star,
            value: teamData?.points ?? '—',
            sub: teamData ? `SD ${teamData.sets_won - teamData.sets_lost > 0 ? '+' : ''}${teamData.sets_won - teamData.sets_lost}` : '',
            from: 'from-violet-500/10', border: 'border-violet-500/20', icon_c: 'text-violet-400',
          },
          {
            label: 'Avg Rating', icon: Activity,
            value: avgOverall || '—',
            sub: `${players.length} players`,
            from: 'from-sky-500/10', border: 'border-sky-500/20', icon_c: 'text-sky-400',
          },
          {
            label: 'Budget', icon: DollarSign,
            value: teamData ? formatMoney(teamData.team_money) : '—',
            sub: '',
            from: 'from-emerald-500/10', border: 'border-emerald-500/20', icon_c: 'text-emerald-400',
          },
        ].map(c => (
          <div key={c.label}
            className={`p-4 rounded-2xl bg-gradient-to-br ${c.from} to-transparent border ${c.border}`}>
            <div className="flex items-center gap-2 mb-3">
              <c.icon size={13} className={c.icon_c} />
              <span className="text-[9px] uppercase tracking-[0.12em] text-slate-500 font-bold">{c.label}</span>
            </div>
            <div className="text-2xl font-black text-white tracking-tight">{c.value}</div>
            {c.sub && <div className="text-[10px] text-slate-600 mt-1">{c.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Main Grid ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ── Left Column: Calendar + Fixtures ─────────────────────────────── */}
        <div className="space-y-3">

          <div className="rounded-2xl border border-white/[0.08] overflow-hidden shadow-xl flex flex-col"
            style={{
              background: 'linear-gradient(160deg, rgba(15,23,42,0.95) 0%, rgba(10,15,26,0.98) 100%)',
              height: 'clamp(400px, 55vh, 800px)'
            }}>

            {/* Calendar header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.06]"
              style={{ background: 'linear-gradient(90deg, rgba(251,191,36,0.06) 0%, transparent 60%)' }}>
              <button
                onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-150 cursor-pointer">
                <ChevronLeft size={14} />
              </button>
              <div className="flex items-center gap-2">
                <Calendar size={12} className="text-amber-400/80" />
                <span className="text-sm font-bold text-white tracking-wide">{MONTHS[calMonth]} {calYear}</span>
              </div>
              <button
                onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }}
                disabled={currentDateStr.endsWith('-12-31') && calMonth === 11 && calYear === parseInt(currentDateStr.slice(0, 4))}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-150 cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400">
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 px-3 pt-3 pb-1">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 auto-rows-fr gap-1 p-3 flex-1">
              {calCells.map((day, i) => {
                if (!day) return <div key={i} className="h-full min-h-[60px]" />;
                const iso = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const oppName = userMatchOpponent.get(iso);
                const userStatus = userMatchDates.get(iso);
                const hasAnyMatch = matchDates.has(iso);
                const isAfterToday = iso > currentDateStr;
                const isClickable = hasAnyMatch || !!userStatus || isAfterToday;
                return (
                  <div key={i}
                    className={dayCellClasses(day)}
                    onClick={() => { if (isClickable) selectDate(iso); }}
                  >
                    <span className="leading-none z-10 text-xs font-semibold">{day}</span>
                    {oppName && (
                      <span className="text-[8px] leading-none text-amber-300/80 font-bold truncate max-w-full px-0.5 mt-0.5">
                        {oppName.split(' ').map((w: string) => w[0]).join('').slice(0, 3).toUpperCase()}
                      </span>
                    )}
                    <DayDot day={day} />
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 px-4 py-3 border-t border-white/[0.05] flex-wrap"
              style={{ background: 'rgba(255,255,255,0.01)' }}>
              {[
                { color: 'bg-amber-400', label: 'Your Fixture' },
                { color: 'bg-emerald-400', label: 'Win' },
                { color: 'bg-red-400', label: 'Loss' },
                { color: 'bg-sky-500/70', label: 'Matchday' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${l.color}`} />
                  <span className="text-[10px] text-slate-500 font-medium">{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Day Fixtures Panel */}
          {selectedDate && (
            <div className="rounded-2xl border border-white/[0.07] overflow-hidden transition-all"
              style={{ background: 'linear-gradient(160deg, rgba(15,23,42,0.9) 0%, rgba(10,15,26,0.95) 100%)' }}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
                <div className="flex items-center gap-2">
                  <Swords size={12} className="text-amber-400/80" />
                  <span className="text-xs font-bold text-white">Fixtures — {formatDate(selectedDate)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {selectedDate > currentDateStr && (
                    <button
                      onClick={() => handleSimToDate(selectedDate)}
                      disabled={simToDate}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all
                        bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30
                        disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                    >
                      {simToDate ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
                      {simToDate ? 'Simulating…' : 'Simulate to here'}
                    </button>
                  )}
                  {simToDateError && (
                    <span className="text-[10px] text-red-400">{simToDateError}</span>
                  )}
                  <button onClick={() => { setSelectedDate(null); setSimToDateError(null); }}
                    className="text-slate-500 hover:text-white transition-colors cursor-pointer w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white/5">
                    <X size={12} />
                  </button>
                </div>
              </div>

              {loadingDayFixtures ? (
                <div className="flex items-center justify-center gap-2 py-6 text-slate-500 text-xs">
                  <Loader2 size={13} className="animate-spin" /> Loading…
                </div>
              ) : dayFixtures.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-600">No fixtures on this date</div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {dayFixtures.map(f => {
                    const isUserMatch = team && (f.home_team_id === team.id || f.away_team_id === team.id);
                    const completed = f.status === 'completed';
                    return (
                      <div key={f.id}
                        className={`flex items-center gap-3 px-4 py-2.5 ${isUserMatch ? 'bg-amber-500/5' : 'hover:bg-white/[0.02]'} transition-colors`}>
                        {isUserMatch && <div className="w-1 h-7 rounded-full bg-amber-500/60 shrink-0" />}
                        <TeamLogo teamId={f.home_team_id} size={22} />
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <span className={`text-xs font-semibold truncate ${completed && (f.home_sets ?? 0) > (f.away_sets ?? 0) ? 'text-white' : 'text-slate-400'}`}>
                            {f.home_team_name}
                          </span>
                          {completed ? (
                            <span className="text-xs font-black text-white shrink-0 mx-1">{f.home_sets} – {f.away_sets}</span>
                          ) : (
                            <span className="text-[10px] text-slate-600 shrink-0 mx-1">vs</span>
                          )}
                          <span className={`text-xs font-semibold truncate ${completed && (f.away_sets ?? 0) > (f.home_sets ?? 0) ? 'text-white' : 'text-slate-400'}`}>
                            {f.away_team_name}
                          </span>
                        </div>
                        <TeamLogo teamId={f.away_team_id} size={22} />
                        <span className={`text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md shrink-0 ${completed ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/10 text-amber-500/80'
                          }`}>
                          {completed ? 'FT' : f.is_playoff ? 'PO' : `GW${f.game_week}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right Column: Next Match (top) + Recent Results (bottom) ──────── */}
        <div className="space-y-4">

          {/* Next Match */}
          {(nextFixture || gameState?.userFixtureToday) ? (
            <NextMatchCard
              fixture={gameState?.userFixtureToday ?? nextFixture!}
              userTeamId={team?.id ?? null}
              isToday={!!gameState?.userFixtureToday}
              onQuickSim={handleQuickSim}
              simming={simming}
            />
          ) : (
            <div className="p-6 rounded-2xl border border-white/[0.07] flex flex-col items-center justify-center text-center gap-3"
              style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.8) 0%, rgba(10,15,26,0.9) 100%)' }}>
              <CheckCircle2 size={28} className="text-emerald-400/60" />
              <p className="text-sm font-semibold text-slate-300">All matches played!</p>
              <p className="text-xs text-slate-600">No upcoming fixtures scheduled.</p>
            </div>
          )}

          {/* Recent Results */}
          <div className="rounded-2xl border border-white/[0.07] overflow-hidden"
            style={{ background: 'linear-gradient(160deg, rgba(15,23,42,0.9) 0%, rgba(10,15,26,0.95) 100%)' }}>
            <div className="px-5 py-3.5 border-b border-white/[0.05] flex items-center gap-2">
              <TrendingUp size={13} className="text-slate-500" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Recent Results</span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {(gameState?.recentResults ?? []).length === 0 ? (
                <div className="px-5 py-6 text-center text-xs text-slate-600">No matches played yet</div>
              ) : (gameState?.recentResults ?? []).map(f => {
                const badge = getResultBadge(f);
                const userIsHome = f.home_team_id === team?.id;
                const opponent = userIsHome ? f.away_team_name : f.home_team_name;
                const oppTeamId = userIsHome ? f.away_team_id : f.home_team_id;
                return (
                  <div key={f.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.025] transition-colors">
                    <TeamLogo teamId={oppTeamId} size={28} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{opponent}</p>
                      <p className="text-[10px] text-slate-600 mt-0.5">{formatShortDate(f.scheduled_date)} · GW{f.game_week}</p>
                    </div>
                    {badge && (
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 ${badge.won ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                        }`}>
                        {badge.won ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {badge.us}–{badge.them}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Next Match Card ──────────────────────────────────────────────────────────

function NextMatchCard({
  fixture, userTeamId, isToday, onQuickSim, simming,
}: {
  fixture: Fixture;
  userTeamId: number | null;
  isToday: boolean;
  onQuickSim: (id: number) => void;
  simming: boolean;
}) {
  const userIsHome = fixture.home_team_id === userTeamId;
  const userTeamName = userIsHome ? fixture.home_team_name : fixture.away_team_name;
  const oppTeamName = userIsHome ? fixture.away_team_name : fixture.home_team_name;
  const oppTeamId = userIsHome ? fixture.away_team_id : fixture.home_team_id;
  const userTeamIdNum = userIsHome ? fixture.home_team_id : fixture.away_team_id;
  const venue = userIsHome ? 'Home' : 'Away';

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/[0.08]"
      style={{ background: 'linear-gradient(145deg, rgba(251,191,36,0.07) 0%, rgba(249,115,22,0.03) 40%, rgba(8,12,22,0.98) 100%)' }}>

      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
      {/* Subtle corner glow */}
      <div className="absolute top-0 left-0 w-32 h-32 rounded-full bg-amber-500/5 blur-2xl pointer-events-none" />

      <div className="relative px-5 pt-4 pb-5">

        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {isToday ? (
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/15 border border-amber-500/25 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Match Day
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-white/[0.04] border border-white/[0.06] px-2.5 py-1 rounded-full">
                <Clock size={9} className="text-slate-600" />
                Next Match
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${venue === 'Home'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
              }`}>{venue}</span>
            <span className="text-[10px] text-slate-600">{fixture.is_playoff ? 'Playoffs' : `GW${fixture.game_week}`}</span>
          </div>
        </div>

        {/* Teams matchup */}
        <div className="flex items-center gap-3 mb-4">
          {/* User team */}
          <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-amber-500/10 blur-md" />
              <div className="relative w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center p-1.5 overflow-hidden">
                <TeamLogo teamId={userTeamIdNum} size={44} />
              </div>
            </div>
            <span className="text-[11px] font-bold text-white text-center leading-tight line-clamp-2 w-full px-1">{userTeamName}</span>
          </div>

          {/* VS divider */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500/15 to-orange-500/10 border border-amber-500/20 flex items-center justify-center">
              <Swords size={13} className="text-amber-400" />
            </div>
            <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest">vs</span>
          </div>

          {/* Opponent */}
          <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center p-1.5 overflow-hidden">
                <TeamLogo teamId={oppTeamId} size={44} />
              </div>
            </div>
            <span className="text-[11px] font-semibold text-slate-400 text-center leading-tight line-clamp-2 w-full px-1">{oppTeamName}</span>
          </div>
        </div>

        {/* Date strip */}
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05]">
          <Calendar size={11} className="text-slate-600 shrink-0" />
          <span className="text-[10px] text-slate-500 font-medium">{formatDate(fixture.scheduled_date)}</span>
        </div>

        {/* Actions — only on match day */}
        {isToday && (
          <div className="flex gap-2">
            {fixture.is_playoff ? (
              <a href="/playoffs"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold
                  bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400
                  transition-all duration-150 active:scale-95 cursor-pointer shadow-lg shadow-amber-500/25">
                <Play size={11} fill="currentColor" />
                Play Playoff Game
              </a>
            ) : (
              <>
                <a href={`/match?fixtureId=${fixture.id}`}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold
                    bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400
                    transition-all duration-150 active:scale-95 cursor-pointer shadow-lg shadow-amber-500/25">
                  <Play size={11} fill="currentColor" />
                  Play Match
                </a>
                <button
                  onClick={() => onQuickSim(fixture.id)}
                  disabled={simming}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold
                    bg-white/[0.05] border border-white/[0.08] text-slate-300 hover:bg-white/10 hover:text-white
                    transition-all duration-150 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                  {simming ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                  Quick Sim
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
