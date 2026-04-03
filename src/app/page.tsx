'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import {
  Calendar, ChevronLeft, ChevronRight, Swords, Trophy, Users, DollarSign,
  Play, Zap, TrendingUp, TrendingDown, Minus, Clock, Star, Activity,
  ChevronRight as ArrowRight, AlertCircle, CheckCircle2, X, Loader2,
} from 'lucide-react';
import Image from 'next/image';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeamData {
  id: number; team_name: string;
  played: number; won: number; lost: number; points: number;
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

interface AdvanceResult {
  done: boolean; message?: string;
  previousDate?: string; newDate?: string;
  userFixtureId?: number | null;
  userFixture?: Fixture | null;
  simulatedCount?: number;
  simulated?: SimResult[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];
const DAYS   = ['S','M','T','W','T','F','S'];

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${MONTHS[parseInt(m) - 1]} ${parseInt(d)}, ${y}`;
}

function formatShortDate(iso: string) {
  const [, m, d] = iso.split('-');
  return `${MONTHS[parseInt(m) - 1].slice(0,3)} ${parseInt(d)}`;
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
  const [teamData, setTeamData]   = useState<TeamData | null>(null);
  const [players, setPlayers]     = useState<{ overall: number }[]>([]);

  // Calendar
  const [calYear,  setCalYear]  = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [matchDates,     setMatchDates]     = useState<Set<string>>(new Set());
  const [userMatchDates, setUserMatchDates] = useState<Map<string, 'scheduled'|'win'|'loss'>>(new Map());

  // Day fixtures panel
  const [selectedDate,        setSelectedDate]        = useState<string | null>(null);
  const [dayFixtures,         setDayFixtures]         = useState<Fixture[]>([]);
  const [loadingDayFixtures,  setLoadingDayFixtures]  = useState(false);

  // Advance state
  const [advancing,         setAdvancing]         = useState(false);
  const [lastAdvance,       setLastAdvance]       = useState<AdvanceResult | null>(null);
  const [showResultsBanner, setShowResultsBanner] = useState(false);

  // Quick-sim state
  const [simming, setSimming] = useState(false);

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

  const loadMatchDates = useCallback(async (seasonId?: number) => {
    if (!seasonId) return;
    const res = await fetch(`/api/fixtures?datesOnly=true&seasonId=${seasonId}`);
    if (!res.ok) return;
    const { dates } = await res.json();
    setMatchDates(new Set(dates as string[]));
  }, []);

  const loadUserMatchDates = useCallback(async () => {
    if (!team) return;
    const res = await fetch(`/api/fixtures?teamId=${team.id}`);
    if (!res.ok) return;
    const fixtures: Fixture[] = await res.json();
    const map = new Map<string, 'scheduled'|'win'|'loss'>();
    for (const f of fixtures) {
      if (f.status === 'completed') {
        const userIsHome = f.home_team_id === team.id;
        const userSets = userIsHome ? (f.home_sets ?? 0) : (f.away_sets ?? 0);
        const oppSets  = userIsHome ? (f.away_sets ?? 0) : (f.home_sets ?? 0);
        map.set(f.scheduled_date, userSets > oppSets ? 'win' : 'loss');
      } else {
        if (!map.has(f.scheduled_date)) map.set(f.scheduled_date, 'scheduled');
      }
    }
    setUserMatchDates(map);
  }, [team]);

  useEffect(() => {
    loadGameState();
  }, [loadGameState]);

  useEffect(() => {
    loadTeamData();
    loadUserMatchDates();
  }, [loadTeamData, loadUserMatchDates]);

  useEffect(() => {
    if (gameState?.season?.id) {
      loadMatchDates(gameState.season.id);
      // Sync calendar to current game date
      const [y, m] = gameState.currentDate.split('-');
      setCalYear(parseInt(y));
      setCalMonth(parseInt(m) - 1);
    }
  }, [gameState?.season?.id, gameState?.currentDate, loadMatchDates]);

  // ─── Day fixtures ──────────────────────────────────────────────────────────

  const selectDate = useCallback(async (dateStr: string) => {
    if (selectedDate === dateStr) { setSelectedDate(null); return; }
    setSelectedDate(dateStr);
    setDayFixtures([]);
    setLoadingDayFixtures(true);
    const res = await fetch(`/api/fixtures?date=${dateStr}`);
    if (res.ok) setDayFixtures(await res.json());
    setLoadingDayFixtures(false);
  }, [selectedDate]);

  // ─── Advance time ──────────────────────────────────────────────────────────

  const handleAdvance = async () => {
    setAdvancing(true);
    setLastAdvance(null);
    setShowResultsBanner(false);
    const res = await fetch('/api/game-state', { method: 'POST' });
    const data: AdvanceResult = await res.json();
    setLastAdvance(data);
    if (!data.done) setShowResultsBanner(true);
    await Promise.all([loadGameState(), loadTeamData(), loadUserMatchDates()]);
    setAdvancing(false);
    // Auto-select the new match date on the calendar
    if (data.newDate) {
      const [y, m] = data.newDate.split('-');
      setCalYear(parseInt(y)); setCalMonth(parseInt(m) - 1);
      selectDate(data.newDate);
    }
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
  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const calCells    = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const currentDateStr = gameState?.currentDate ?? '';
  const [cy, cm] = currentDateStr.split('-');
  const todayIsInView = parseInt(cy) === calYear && parseInt(cm) - 1 === calMonth;

  function dayCellClasses(day: number | null): string {
    if (!day) return '';
    const iso = `${calYear}-${String(calMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const isToday      = iso === currentDateStr && todayIsInView;
    const isSelected   = iso === selectedDate;
    const userStatus   = userMatchDates.get(iso);
    const hasAnyMatch  = matchDates.has(iso);

    let base = 'relative aspect-square flex flex-col items-center justify-center rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer select-none ';

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
    const iso = `${calYear}-${String(calMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const userStatus  = userMatchDates.get(iso);
    const hasAnyMatch = matchDates.has(iso);

    if (userStatus === 'win')       return <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-400" />;
    if (userStatus === 'loss')      return <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-red-400" />;
    if (userStatus === 'scheduled') return <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-400" />;
    if (hasAnyMatch)                return <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-sky-500/60" />;
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

        <button
          onClick={handleAdvance}
          disabled={advancing}
          className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-150 shadow-lg
            bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400
            disabled:opacity-60 disabled:cursor-not-allowed shadow-amber-500/25 active:scale-95 cursor-pointer"
        >
          {advancing ? (
            <><Loader2 size={15} className="animate-spin" /> Simulating…</>
          ) : (
            <><Zap size={15} /> Advance to Next Match Day</>
          )}
        </button>
      </div>

      {/* ── Advance Results Banner ───────────────────────────────────────────── */}
      {showResultsBanner && lastAdvance && !lastAdvance.done && (
        <div className="rounded-2xl border border-white/10 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(10,15,26,0.98) 100%)' }}>
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <Activity size={14} className="text-sky-400" />
              <span className="text-sm font-bold text-white">
                Matchday Results — {lastAdvance.newDate ? formatShortDate(lastAdvance.newDate) : ''}
              </span>
              <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                {lastAdvance.simulatedCount} matches played
              </span>
            </div>
            <button onClick={() => setShowResultsBanner(false)} className="text-slate-500 hover:text-white transition-colors cursor-pointer p-1 rounded-lg hover:bg-white/5">
              <X size={14} />
            </button>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {(lastAdvance.simulated ?? []).map(r => (
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
            {lastAdvance.userFixtureId && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 col-span-full">
                <AlertCircle size={14} className="text-amber-400 shrink-0" />
                <span className="text-xs text-amber-300 font-medium">
                  Your match vs {lastAdvance.userFixture?.away_team_name ?? lastAdvance.userFixture?.home_team_name} is ready — play it below!
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
            sub: teamData ? `GD ${teamData.goal_diff > 0 ? '+' : ''}${teamData.goal_diff}` : '',
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
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* ── Left Column (2/5) ─────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

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
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 ${
                        badge.won ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                      }`}>
                        {badge.won ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}
                        {badge.us}–{badge.them}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* ── Right Column: Calendar (3/5) ──────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-3">
          <div className="rounded-2xl border border-white/[0.07] overflow-hidden"
            style={{ background: 'linear-gradient(160deg, rgba(15,23,42,0.9) 0%, rgba(10,15,26,0.95) 100%)' }}>

            {/* Calendar header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
              <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer">
                <ChevronLeft size={16} />
              </button>
              <div className="flex items-center gap-2.5">
                <Calendar size={14} className="text-amber-400/70" />
                <span className="text-sm font-bold text-white">{MONTHS[calMonth]} {calYear}</span>
              </div>
              <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer">
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-white/[0.04] px-3">
              {DAYS.map((d, i) => (
                <div key={i} className="py-2 text-center text-[10px] font-bold text-slate-600 uppercase tracking-wider">{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1 p-3">
              {calCells.map((day, i) => (
                <div key={i}
                  className={day ? dayCellClasses(day) : 'aspect-square'}
                  onClick={() => {
                    if (!day) return;
                    const iso = `${calYear}-${String(calMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                    if (matchDates.has(iso) || userMatchDates.has(iso)) selectDate(iso);
                  }}
                >
                  {day && (
                    <>
                      <span className="leading-none z-10">{day}</span>
                      <DayDot day={day} />
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 px-5 py-3 border-t border-white/[0.04] flex-wrap">
              {[
                { color: 'bg-amber-400', label: 'Your fixture' },
                { color: 'bg-emerald-400', label: 'Win' },
                { color: 'bg-red-400', label: 'Loss' },
                { color: 'bg-sky-500/70', label: 'League match' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${l.color}`} />
                  <span className="text-[10px] text-slate-600">{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Day Fixtures Panel */}
          {selectedDate && (
            <div className="rounded-2xl border border-white/[0.07] overflow-hidden transition-all"
              style={{ background: 'linear-gradient(160deg, rgba(15,23,42,0.9) 0%, rgba(10,15,26,0.95) 100%)' }}>
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.05]">
                <div className="flex items-center gap-2">
                  <Swords size={13} className="text-amber-400/80" />
                  <span className="text-xs font-bold text-white">Fixtures — {formatDate(selectedDate)}</span>
                </div>
                <button onClick={() => setSelectedDate(null)}
                  className="text-slate-500 hover:text-white transition-colors cursor-pointer w-6 h-6 flex items-center justify-center rounded-lg hover:bg-white/5">
                  <X size={12} />
                </button>
              </div>

              {loadingDayFixtures ? (
                <div className="flex items-center justify-center gap-2 py-8 text-slate-500 text-sm">
                  <Loader2 size={14} className="animate-spin" /> Loading…
                </div>
              ) : dayFixtures.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-600">No fixtures on this date</div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {dayFixtures.map(f => {
                    const isUserMatch = team && (f.home_team_id === team.id || f.away_team_id === team.id);
                    const completed   = f.status === 'completed';
                    const badge       = completed ? getResultBadge(f) : null;
                    return (
                      <div key={f.id}
                        className={`flex items-center gap-3 px-4 py-3 ${isUserMatch ? 'bg-amber-500/5' : 'hover:bg-white/[0.02]'} transition-colors`}>
                        {isUserMatch && <div className="w-1 h-8 rounded-full bg-amber-500/60 shrink-0" />}
                        <TeamLogo teamId={f.home_team_id} size={24} />
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <span className={`text-xs font-semibold truncate ${completed && (f.home_sets ?? 0) > (f.away_sets ?? 0) ? 'text-white' : 'text-slate-400'}`}>
                            {f.home_team_name}
                          </span>
                          {completed ? (
                            <span className="text-xs font-black text-white shrink-0 mx-1">
                              {f.home_sets} – {f.away_sets}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-600 shrink-0 mx-1">vs</span>
                          )}
                          <span className={`text-xs font-semibold truncate ${completed && (f.away_sets ?? 0) > (f.home_sets ?? 0) ? 'text-white' : 'text-slate-400'}`}>
                            {f.away_team_name}
                          </span>
                        </div>
                        <TeamLogo teamId={f.away_team_id} size={24} />
                        <span className={`text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md shrink-0 ${
                          completed
                            ? 'bg-emerald-500/15 text-emerald-500'
                            : 'bg-amber-500/10 text-amber-500/80'
                        }`}>
                          {completed ? 'FT' : `GW${f.game_week}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
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
  const userIsHome    = fixture.home_team_id === userTeamId;
  const userTeamName  = userIsHome ? fixture.home_team_name : fixture.away_team_name;
  const oppTeamName   = userIsHome ? fixture.away_team_name : fixture.home_team_name;
  const oppTeamId     = userIsHome ? fixture.away_team_id : fixture.home_team_id;
  const userTeamIdNum = userIsHome ? fixture.home_team_id : fixture.away_team_id;

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/[0.07]"
      style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.08) 0%, rgba(249,115,22,0.04) 50%, rgba(10,15,26,0.97) 100%)' }}>

      {/* Accent glow */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />

      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-2 mb-4">
          {isToday ? (
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/15 border border-amber-500/25 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Match Day
            </span>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Next Match</span>
          )}
          <span className="text-[10px] text-slate-600 ml-auto">GW{fixture.game_week} · {formatShortDate(fixture.scheduled_date)}</span>
        </div>

        {/* Teams */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center gap-2 flex-1">
            <TeamLogo teamId={userTeamIdNum} size={52} />
            <span className="text-[11px] font-bold text-white text-center leading-tight line-clamp-2">{userTeamName}</span>
          </div>
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <Swords size={14} className="text-amber-400/80" />
            </div>
            <span className="text-[9px] text-slate-600 font-bold uppercase tracking-wider">vs</span>
          </div>
          <div className="flex flex-col items-center gap-2 flex-1">
            <TeamLogo teamId={oppTeamId} size={52} />
            <span className="text-[11px] font-bold text-slate-300 text-center leading-tight line-clamp-2">{oppTeamName}</span>
          </div>
        </div>

        {/* Actions */}
        {isToday && (
          <div className="flex gap-2 mt-4">
            <a href={`/match`}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold
                bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400
                transition-all active:scale-95 cursor-pointer shadow-lg shadow-amber-500/20">
              <Play size={12} fill="currentColor" />
              Play Match
            </a>
            <button
              onClick={() => onQuickSim(fixture.id)}
              disabled={simming}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold
                bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white
                transition-all active:scale-95 cursor-pointer disabled:opacity-50">
              {simming ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
              Quick Sim
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
