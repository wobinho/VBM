'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Trophy, Calendar, Loader2, Crown, LayoutList, Share2,
  Star, Flame, Swords, Shield, ChevronRight, History,
} from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/contexts/auth-context';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CupFixture {
  id: number;
  home_team_id: number;
  away_team_id: number;
  home_sets: number | null;
  away_sets: number | null;
  status: string;
  scheduled_date: string;
  home_team_name: string;
  away_team_name: string;
  winner_team_id: number | null;
}

interface CupRound {
  id: number;
  round_number: number;
  round_name: string;
  start_date: string;
  end_date: string;
  status: string;
  fixtures: CupFixture[];
}

interface CupData {
  cup: { id: number; name: string; year: number; status: string };
  rounds: CupRound[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

// These MUST stay in sync with the CSS sizing of BracketFixtureCard
const CARD_H = 76;   // px — total height of one fixture card
const CARD_GAP = 10; // px — gap-[10px] between cards
const COL_HEADER_H = 52; // px — column header block height
const COL_W = 260;   // px — width of each round column

const ROUND_META: Record<string, { icon: React.ElementType; shortLabel: string; accent: string }> = {
  'Round 1':     { icon: Swords, shortLabel: 'R1',  accent: 'gray'   },
  'Round 2':     { icon: Swords, shortLabel: 'R2',  accent: 'gray'   },
  'Round of 16': { icon: Shield, shortLabel: 'R16', accent: 'gray'   },
  'Quarter Finals': { icon: Flame, shortLabel: 'QF',  accent: 'gray' },
  'Semi Finals': { icon: Flame, shortLabel: 'SF',  accent: 'gray' },
  'Grand Final': { icon: Star, shortLabel: 'GF',  accent: 'gold'   },
};

function getRoundMeta(name: string) {
  return ROUND_META[name] ?? { icon: Swords, shortLabel: '?', accent: 'gray' };
}

// Accent color classes per round theme
const ACCENT_CLASSES = {
  gray:   { tab: 'border-white/10 text-gray-400',           tabActive: 'bg-white/10 border-white/25 text-white shadow-lg',          badge: 'bg-white/10 text-gray-400',         col: 'border-white/6' },
  blue:   { tab: 'border-blue-500/20 text-blue-400/70',     tabActive: 'bg-blue-500/15 border-blue-500/40 text-blue-200 shadow-blue-500/10 shadow-lg', badge: 'bg-blue-500/20 text-blue-400', col: 'border-blue-500/10' },
  orange: { tab: 'border-orange-500/20 text-orange-400/70', tabActive: 'bg-orange-500/15 border-orange-500/40 text-orange-200 shadow-orange-500/10 shadow-lg', badge: 'bg-orange-500/20 text-orange-400', col: 'border-orange-500/10' },
  gold:   { tab: 'border-amber-500/30 text-amber-500/70',   tabActive: 'bg-amber-500/20 border-amber-500/50 text-amber-200 shadow-amber-500/15 shadow-xl', badge: 'bg-amber-500/25 text-amber-300', col: 'border-amber-500/20' },
};

// ─── TeamLogo ─────────────────────────────────────────────────────────────────

function TeamLogo({ teamId, size = 32 }: { teamId: number; size?: number }) {
  const [src, setSrc] = useState(`/assets/teams/${teamId}.png`);
  const [failed, setFailed] = useState(false);
  if (failed) return (
    <div
      style={{ width: size, height: size }}
      className="rounded-lg bg-gradient-to-br from-slate-700/50 to-slate-800/30 border border-white/8 shrink-0"
    />
  );
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <Image src={src} alt="Team" fill unoptimized className="object-contain"
        onError={() => { if (src !== '/assets/teams/default.png') setSrc('/assets/teams/default.png'); else setFailed(true); }}
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CupsPage() {
  const { team: userTeam } = useAuth();
  const [data, setData] = useState<CupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'bracket'>('bracket');

  // Available historical years + currently-selected year (null = live)
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [currentYear, setCurrentYear] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  // Fetch list of years once on mount
  useEffect(() => {
    fetch('/api/cups?list=true')
      .then(r => r.ok ? r.json() : null)
      .then((d: { years: number[]; currentYear: number | null } | null) => {
        if (d) {
          setAvailableYears(d.years ?? []);
          setCurrentYear(d.currentYear ?? null);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch cup data — live (no year) or historical (year=X)
  useEffect(() => {
    setLoading(true);
    const url = selectedYear !== null ? `/api/cups?year=${selectedYear}` : '/api/cups';
    fetch(url).then(r => r.ok ? r.json() : null).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [selectedYear]);

  const isHistorical = selectedYear !== null;
  // Past years are those NOT equal to the current in-game year
  const pastYears = availableYears.filter(y => y !== currentYear);

  const yearSelector = (
    <div className="flex items-center gap-2 flex-wrap">
      <History size={12} className={isHistorical ? 'text-[var(--epic)]' : 'text-[var(--ink-500)]'} />
      <span className="font-mono text-[9.5px] uppercase tracking-[0.28em] text-[var(--ink-400)] font-bold mr-1">Season</span>
      <button
        onClick={() => setSelectedYear(null)}
        className={`px-3 py-1.5 rounded-sm font-mono text-[10px] font-black uppercase tracking-[0.2em] transition-colors cursor-pointer ${
          !isHistorical
            ? 'bg-[var(--volt)] text-[var(--ink-950)] shadow-[0_2px_0_0_rgba(0,0,0,0.4)]'
            : 'bg-white/[0.04] text-[var(--ink-300)] hover:text-[var(--bone)] border border-white/[0.08]'
        }`}
      >
        Live
      </button>
      {pastYears.length === 0 && (
        <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--ink-600)] italic">
          No archived seasons yet
        </span>
      )}
      {pastYears.map(y => {
        const isSel = selectedYear === y;
        return (
          <button key={y}
            onClick={() => setSelectedYear(y)}
            className={`px-3 py-1.5 rounded-sm font-mono text-[10px] font-black uppercase tracking-[0.2em] transition-colors cursor-pointer tabular ${
              isSel
                ? 'bg-[var(--epic)] text-black shadow-[0_2px_0_0_rgba(0,0,0,0.4)]'
                : 'bg-white/[0.04] text-[var(--ink-300)] hover:text-[var(--bone)] border border-white/[0.08]'
            }`}
          >
            {y}
          </button>
        );
      })}
      {isHistorical && (
        <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.24em] text-[var(--epic)] font-black">
          Read-only archive
        </span>
      )}
    </div>
  );

  if (loading) return (
    <div className="space-y-6 animate-fade-up">
      <div className="surface-raised px-5 py-3">{yearSelector}</div>
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 text-[var(--volt)] animate-spin mx-auto" />
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-[var(--ink-500)]">Loading bracket…</p>
        </div>
      </div>
    </div>
  );

  if (!data?.rounds?.length) return (
    <div className="space-y-6 animate-fade-up">
      <div className="surface-raised px-5 py-3">{yearSelector}</div>
      <div className="surface-raised text-center py-24 px-8 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-[var(--volt)]/8 blur-3xl" />
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-[var(--volt)]/15 border border-[var(--volt)]/30 flex items-center justify-center mx-auto mb-6">
            <Trophy className="w-10 h-10 text-[var(--volt)]" />
          </div>
          <p className="eyebrow mb-2">Cup Block</p>
          <h2 className="font-display text-4xl tracking-[0.02em] text-[var(--bone)] mb-2">
            {isHistorical ? `NO CUP FOR ${selectedYear}` : 'NO ACTIVE CUPS'}
          </h2>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--ink-500)]">
            {isHistorical ? 'No cup competition was recorded for this year' : 'Copa Italia generates after June 30'}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-up">
      {/* ── Season selector ── */}
      <div className="surface-raised px-5 py-3">{yearSelector}</div>

      {/* ── Hero ── */}
      <div className="surface-raised relative overflow-hidden p-8">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-[var(--volt)]" />
        <div className="absolute inset-0 overflow-hidden">
          <Image src="/assets/team-backgrounds/copa_italia_bg.png" alt="Copa Italia Background" fill unoptimized className="object-cover opacity-40 mix-blend-overlay" />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_0%_50%,rgba(250,204,21,0.10),transparent)]" />

        <div className="relative flex items-center justify-between gap-6 my-4">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded bg-[var(--volt)]/30 blur-2xl" />
            <div className="relative w-[100px] h-[100px] rounded bg-gradient-to-br from-[var(--volt)]/25 to-transparent border-2 border-[var(--volt)]/40 flex items-center justify-center shadow-2xl shadow-[var(--volt)]/20 overflow-hidden">
              <Image src="/assets/flags/it.svg" alt="Italian Flag" width={60} height={60} className="object-cover" />
            </div>
          </div>
          <div className="flex-1 min-w-0 px-2">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--volt)] mb-2">National Championship</p>
            <h1 className="font-display text-4xl md:text-5xl tracking-[0.02em] text-[var(--bone)] leading-none">{data.cup.name.toUpperCase()}</h1>
            <p className="font-mono text-xs text-[var(--ink-400)] mt-2 uppercase tracking-wider tabular">{data.cup.year} SEASON</p>
          </div>
          <div className="hidden sm:flex shrink-0 items-center">
            <div className={`inline-flex items-center gap-2 px-3.5 py-2 rounded font-mono text-[11px] font-bold uppercase tracking-[0.22em] border ${
              data.cup.status === 'completed'
                ? 'bg-[var(--ink-850)] border-white/[0.08] text-[var(--ink-400)]'
                : 'bg-[var(--win)]/10 border-[var(--win)]/30 text-[var(--win)]'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${data.cup.status === 'completed' ? 'bg-[var(--ink-400)]' : 'bg-[var(--win)] animate-pulse'}`} />
              {data.cup.status === 'completed' ? 'Completed' : 'Active'}
            </div>
          </div>
        </div>
      </div>

      {/* ── View Toggle ── */}
      <div className="flex gap-2">
        {(['list', 'bracket'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded font-display tracking-[0.12em] uppercase text-sm transition-all duration-200 cursor-pointer border ${
              viewMode === mode
                ? 'bg-[var(--volt)] text-[var(--ink-950)] border-[var(--volt-deep)]'
                : 'bg-white/[0.03] text-[var(--ink-400)] border-white/[0.06] hover:bg-white/[0.06] hover:text-[var(--bone)]'
            }`}
          >
            {mode === 'list' ? <LayoutList size={15} /> : <Share2 size={15} className="rotate-90" />}
            {mode}
          </button>
        ))}
      </div>

      {viewMode === 'list'
        ? <ListViewContainer rounds={data.rounds} />
        : <BracketViewContainer rounds={data.rounds} userTeamId={userTeam?.id ?? null} cupStatus={data.cup.status} />
      }
    </div>
  );
}

// ─── List View ────────────────────────────────────────────────────────────────

function ListViewContainer({ rounds }: { rounds: CupRound[] }) {
  const [activeIdx, setActiveIdx] = useState(0);
  return (
    <div className="space-y-5">
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {rounds.map((r, i) => {
          const meta = getRoundMeta(r.round_name);
          const ac = ACCENT_CLASSES[meta.accent as keyof typeof ACCENT_CLASSES];
          return (
            <button key={r.id} onClick={() => setActiveIdx(i)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest shrink-0 transition-all duration-200 cursor-pointer border ${activeIdx === i ? ac.tabActive : ac.tab} `}>
              <meta.icon size={12} />
              {r.round_name}
              {r.status === 'completed' && <span className="ml-1 opacity-60">✓</span>}
            </button>
          );
        })}
      </div>
      <ListView activeRound={rounds[activeIdx]} />
    </div>
  );
}

function ListView({ activeRound }: { activeRound: CupRound }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className={`px-3 py-1.5 rounded flex items-center gap-2 border font-mono text-[10px] font-bold uppercase tracking-[0.22em] ${
          activeRound.status === 'completed' ? 'bg-[var(--win)]/10 border-[var(--win)]/25 text-[var(--win)]' : 'bg-[var(--volt)]/10 border-[var(--volt)]/25 text-[var(--volt)]'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${activeRound.status === 'completed' ? 'bg-[var(--win)]' : 'bg-[var(--volt)] animate-pulse'}`} />
          {activeRound.status === 'completed' ? 'Completed' : 'In Progress'}
        </div>
        <div className="h-px flex-1 bg-white/[0.05]" />
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--ink-500)] uppercase tracking-wider tabular">
          <Calendar size={12} />
          {new Date(activeRound.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {activeRound.fixtures.map(f => <ListFixtureCard key={f.id} fixture={f} />)}
      </div>
    </div>
  );
}

function ListFixtureCard({ fixture: f }: { fixture: CupFixture }) {
  const homeWon = f.status === 'completed' && f.home_sets! > f.away_sets!;
  const awayWon = f.status === 'completed' && f.away_sets! > f.home_sets!;
  return (
    <div className="surface-raised overflow-hidden card-hover cursor-pointer group">
      {[
        { id: f.home_team_id, name: f.home_team_name, sets: f.home_sets, won: homeWon },
        { id: f.away_team_id, name: f.away_team_name, sets: f.away_sets, won: awayWon },
      ].map((side, i) => (
        <div key={i}>
          <div className={`flex items-center gap-3 px-4 py-3 ${side.won ? 'bg-[var(--volt)]/[0.07]' : ''}`}>
            <TeamLogo teamId={side.id} size={36} />
            <span className={`text-sm font-bold flex-1 truncate ${side.won ? 'text-[var(--volt)]' : f.status === 'completed' ? 'text-[var(--ink-400)]' : 'text-[var(--bone)]'}`}>{side.name}</span>
            {f.status === 'completed' && <span className={`font-display text-2xl tabular ${side.won ? 'text-[var(--volt)]' : 'text-[var(--ink-500)]'}`}>{side.sets}</span>}
            {side.won && <div className="w-[3px] h-5 rounded-full bg-[var(--volt)] ml-1" />}
          </div>
          {i === 0 && <div className="mx-4 h-px bg-white/[0.05]" />}
        </div>
      ))}
      <div className="px-4 py-2.5 border-t border-white/[0.05] flex items-center justify-between">
        <span className={`font-mono text-[10px] font-bold uppercase tracking-[0.22em] ${f.status === 'completed' ? 'text-[var(--win)]' : 'text-[var(--volt)]/70'}`}>
          {f.status === 'completed' ? 'Final' : 'Scheduled'}
        </span>
        {f.status !== 'completed' && <span className="font-mono text-[10px] text-[var(--ink-500)] uppercase tracking-wider tabular">{new Date(f.scheduled_date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</span>}
        {f.status === 'completed' && <Trophy size={11} className="text-[var(--volt)]/60" />}
      </div>
    </div>
  );
}

// ─── Bracket View ─────────────────────────────────────────────────────────────

function BracketViewContainer({ rounds, userTeamId, cupStatus }: { rounds: CupRound[]; userTeamId: number | null; cupStatus: string }) {
  return <CupBracket rounds={rounds} userTeamId={userTeamId} cupStatus={cupStatus} />;
}

function CupBracket({ rounds, userTeamId, cupStatus }: { rounds: CupRound[]; userTeamId: number | null; cupStatus: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeRound, setActiveRound] = useState<number>(() => {
    // Start on furthest progressed round
    let last = 0;
    for (let i = 0; i < rounds.length; i++) {
      if (rounds[i].fixtures.some(f => f.status === 'completed')) last = i;
    }
    return last;
  });

  // Champion
  const lastRound = rounds[rounds.length - 1];
  const ft0 = lastRound.fixtures[0];
  const team1 = ft0?.home_team_id;
  const team2 = ft0?.away_team_id;
  const wins1 = lastRound.fixtures.filter(f => f.status === 'completed' && f.winner_team_id === team1).length;
  const wins2 = lastRound.fixtures.filter(f => f.status === 'completed' && f.winner_team_id === team2).length;
  const championId = wins1 >= 2 ? team1 : wins2 >= 2 ? team2 : undefined;
  const championName = wins1 >= 2 ? ft0?.home_team_name : wins2 >= 2 ? ft0?.away_team_name : undefined;

  const handleTabClick = (idx: number) => {
    setActiveRound(idx);
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-round-col="${idx}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };

  return (
    <div className="space-y-4">
      {/* Champion Banner */}
      {cupStatus === 'completed' && championId && (
        <div className="surface-raised relative overflow-hidden border-[var(--volt)]/40">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-[var(--volt)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_100%_at_30%_50%,rgba(250,204,21,0.15),transparent)]" />
          <div className="relative flex items-center gap-5 px-6 py-5">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-full bg-[var(--volt)]/30 blur-xl" />
              <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-[var(--volt)]/25 to-transparent border-2 border-[var(--volt)]/40 flex items-center justify-center">
                <Crown size={24} className="text-[var(--volt)]" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--volt)]/85 mb-1.5">Copa Italia Champion</p>
              <p className="font-display text-2xl tracking-[0.04em] text-[var(--volt)] truncate">{championName?.toUpperCase()}</p>
            </div>
            <TeamLogo teamId={championId} size={56} />
          </div>
        </div>
      )}

      {/* Round Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
        {rounds.map((round, idx) => {
          const meta = getRoundMeta(round.round_name);
          const ac = ACCENT_CLASSES[meta.accent as keyof typeof ACCENT_CLASSES];
          const isActive = activeRound === idx;
          const isDone = round.status === 'completed';
          return (
            <button key={round.id} onClick={() => handleTabClick(idx)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider shrink-0 transition-all duration-200 cursor-pointer border ${isActive ? ac.tabActive : ac.tab} hover:opacity-100`}>
              <meta.icon size={12} />
              <span>{round.round_name}</span>
              {isDone && (
                <span className={`w-4 h-4 rounded-md flex items-center justify-center text-[9px] font-black ${ac.badge}`}>✓</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Bracket Canvas ── */}
      <div
        ref={scrollRef}
        className="overflow-x-auto rounded-2xl bg-[#080808]"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}
      >
        <div className="flex items-start min-w-max p-0 gap-0">
          {rounds.map((round, roundIdx) => {
            const isFinal = round.round_name === 'Grand Final';
            const meta = getRoundMeta(round.round_name);
            const ac = ACCENT_CLASSES[meta.accent as keyof typeof ACCENT_CLASSES];
            const isActive = activeRound === roundIdx;


            return (
              <div key={round.id} data-round-col={roundIdx} className="flex items-start">
                {/* Column */}
                <div
                  style={{ width: COL_W }}
                  className={`shrink-0 transition-all duration-250 cursor-pointer ${isActive ? 'opacity-100' : 'opacity-50 hover:opacity-75'}`}
                  onClick={() => setActiveRound(roundIdx)}
                >
                  {/* Column header */}
                  <div
                    style={{ height: COL_HEADER_H }}
                    className={`flex items-center gap-2.5 mb-3 px-3 rounded-xl border ${ac.col} ${
                      isFinal ? 'bg-amber-950/30' : isActive ? 'bg-white/[0.04]' : 'bg-white/[0.015]'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${ac.col} ${isFinal ? 'bg-amber-500/15' : 'bg-white/5'}`}>
                      <meta.icon size={13} className={isFinal ? 'text-amber-400' : round.status === 'completed' ? 'text-gray-500' : 'text-gray-400'} />
                    </div>
                    <span className={`text-[11px] font-bold uppercase tracking-wider flex-1 ${isFinal ? 'text-amber-300' : round.status === 'completed' ? 'text-gray-500' : 'text-gray-300'}`}>
                      {round.round_name}
                    </span>
                    {round.status === 'completed' && (
                      <span className={`text-[9px] font-black uppercase ${isFinal ? 'text-amber-500' : 'text-emerald-500/70'}`}>
                        {isFinal ? 'Final' : 'Done'}
                      </span>
                    )}
                  </div>

                  {/* Fixtures */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: CARD_GAP }}>
                    {isFinal ? (
                      <GrandFinalPanel round={round} userTeamId={userTeamId} />
                    ) : round.fixtures.length > 0 ? (
                      round.fixtures.map(f => (
                        <BracketCard key={f.id} fixture={f} userTeamId={userTeamId} />
                      ))
                    ) : (
                      <TBDCard />
                    )}
                  </div>
                </div>

                {/* Spacer between columns */}
                {roundIdx < rounds.length - 1 && (
                  <div style={{ width: 16 }} className="shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


// ─── Bracket Card ─────────────────────────────────────────────────────────────

function BracketCard({ fixture: f, userTeamId }: { fixture: CupFixture; userTeamId: number | null }) {
  const isUser = userTeamId !== null && (f.home_team_id === userTeamId || f.away_team_id === userTeamId);
  const homeWon = f.status === 'completed' && f.home_sets! > f.away_sets!;
  const awayWon = f.status === 'completed' && f.away_sets! > f.home_sets!;
  const done = f.status === 'completed';

  return (
    <div
      style={{ height: CARD_H }}
      className={`relative rounded border overflow-hidden transition-all duration-200 cursor-pointer ${
        isUser
          ? 'bg-[var(--ink-900)] border-[var(--volt)]/45 hover:border-[var(--volt)]/65 shadow-lg shadow-[var(--volt)]/10'
          : done
            ? 'bg-[var(--ink-900)] border-white/[0.08] hover:border-white/[0.18]'
            : 'bg-[var(--ink-850)] border-white/[0.05] hover:border-white/[0.12]'
      }`}
    >
      <div className={`flex items-center gap-2 px-2.5 transition-colors ${homeWon ? 'bg-[var(--volt)]/[0.08]' : ''}`} style={{ height: CARD_H / 2 - 0.5 }}>
        <TeamLogo teamId={f.home_team_id} size={24} />
        <span className={`text-[11px] font-semibold truncate flex-1 leading-tight ${homeWon ? 'text-[var(--volt)]' : done ? 'text-[var(--ink-400)]' : 'text-[var(--ink-300)]'}`}>
          {f.home_team_name}
        </span>
        {done && <span className={`font-mono text-xs font-bold tabular mr-1 ${homeWon ? 'text-[var(--volt)]' : 'text-[var(--ink-500)]'}`}>{f.home_sets}</span>}
        {homeWon && <div className="w-[3px] h-4 rounded-full bg-[var(--volt)] shrink-0" />}
        {!homeWon && done && <div className="w-[3px] h-4 shrink-0" />}
      </div>

      <div className="h-px bg-white/[0.05] mx-2.5" />

      <div className={`flex items-center gap-2 px-2.5 transition-colors ${awayWon ? 'bg-[var(--volt)]/[0.08]' : ''}`} style={{ height: CARD_H / 2 - 0.5 }}>
        <TeamLogo teamId={f.away_team_id} size={24} />
        <span className={`text-[11px] font-semibold truncate flex-1 leading-tight ${awayWon ? 'text-[var(--volt)]' : done ? 'text-[var(--ink-400)]' : 'text-[var(--ink-300)]'}`}>
          {f.away_team_name}
        </span>
        {done && <span className={`font-mono text-xs font-bold tabular mr-1 ${awayWon ? 'text-[var(--volt)]' : 'text-[var(--ink-500)]'}`}>{f.away_sets}</span>}
        {awayWon && <div className="w-[3px] h-4 rounded-full bg-[var(--volt)] shrink-0" />}
        {!awayWon && done && <div className="w-[3px] h-4 shrink-0" />}
      </div>

      {!done && (
        <div className="absolute bottom-1 right-2">
          <span className="font-mono text-[9px] text-[var(--ink-600)] uppercase tracking-wider">
            {new Date(f.scheduled_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        </div>
      )}
    </div>
  );
}

function TBDCard() {
  return (
    <div style={{ height: CARD_H }} className="rounded border border-white/[0.04] bg-white/[0.01] flex items-center justify-center">
      <span className="font-mono text-[10px] font-bold text-[var(--ink-600)] uppercase tracking-[0.22em]">TBD</span>
    </div>
  );
}

// ─── Grand Final Panel ────────────────────────────────────────────────────────

function GrandFinalPanel({ round, userTeamId }: { round: CupRound; userTeamId: number | null }) {
  if (round.fixtures.length === 0) return <TBDCard />;

  const f0 = round.fixtures[0];
  const team1 = f0.home_team_id;
  const team2 = f0.away_team_id;
  const wins1 = round.fixtures.filter(f => f.status === 'completed' && f.winner_team_id === team1).length;
  const wins2 = round.fixtures.filter(f => f.status === 'completed' && f.winner_team_id === team2).length;
  const isOver = wins1 >= 2 || wins2 >= 2;
  const isUserInvolved = userTeamId !== null && (team1 === userTeamId || team2 === userTeamId);
  const sides = [
    { id: team1, name: f0.home_team_name, wins: wins1, won: wins1 >= 2 },
    { id: team2, name: f0.away_team_name, wins: wins2, won: wins2 >= 2 },
  ];

  return (
    <div className={`rounded-2xl border overflow-hidden ${
      isOver
        ? 'bg-gradient-to-b from-amber-950/40 via-[#0d0a00] to-[#0d0d0d] border-amber-500/35'
        : 'bg-[#0d0d0d] border-white/8'
    } ${isUserInvolved ? 'border-amber-500/40' : ''}`}>

      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-2.5 border-b ${isOver ? 'bg-amber-500/8 border-amber-500/15' : 'bg-white/[0.02] border-white/5'}`}>
        <div className="flex items-center gap-2">
          <Star size={12} className={isOver ? 'text-amber-400' : 'text-gray-600'} />
          <span className={`text-[10px] font-bold uppercase tracking-[0.15em] ${isOver ? 'text-amber-400' : 'text-gray-600'}`}>
            Best-of-3 Series
          </span>
        </div>
        {isOver && (
          <div className="flex items-center gap-1.5">
            <Trophy size={10} className="text-amber-500" />
            <span className="text-[9px] font-black uppercase tracking-widest text-amber-500">Complete</span>
          </div>
        )}
      </div>

      {/* Teams */}
      <div className="p-3 space-y-2">
        {sides.map(side => (
          <div key={side.id}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
              side.won
                ? 'bg-gradient-to-r from-amber-500/15 to-amber-500/5 border-amber-500/30'
                : 'bg-white/[0.02] border-white/6'
            }`}>
            <TeamLogo teamId={side.id} size={30} />
            <span className={`text-xs font-bold flex-1 truncate ${side.won ? 'text-amber-300' : 'text-gray-300'}`}>
              {side.name}
            </span>
            {/* Win pips */}
            <div className="flex gap-1.5 shrink-0">
              {[0, 1, 2].map(i => (
                <div key={i}
                  className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black transition-all ${
                    i < side.wins
                      ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/25'
                      : 'bg-white/6 border border-white/10 text-gray-700'
                  }`}>
                  {i < side.wins ? '✓' : i + 1}
                </div>
              ))}
            </div>
            {side.won && <ChevronRight size={14} className="text-amber-400 shrink-0 ml-0.5" />}
          </div>
        ))}
      </div>

      {/* Game-by-game scores */}
      {round.fixtures.some(f => f.status === 'completed') && (
        <div className="px-3 pb-3 flex gap-2">
          {round.fixtures.map((f, i) => (
            <div key={f.id}
              className={`flex-1 py-2 rounded-xl border text-center ${
                f.status === 'completed' ? 'bg-amber-500/8 border-amber-500/20' : 'bg-white/[0.015] border-white/6'
              }`}>
              <div className="text-[9px] font-bold uppercase text-gray-600 mb-0.5">G{i + 1}</div>
              <div className={`text-xs font-black ${f.status === 'completed' ? 'text-amber-300' : 'text-gray-700'}`}>
                {f.status === 'completed' ? `${f.home_sets}–${f.away_sets}` : '–'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
