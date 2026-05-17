'use client';
import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { useAuth } from '@/contexts/auth-context';
import {
  BarChart2, Trophy, Users, ChevronDown, Shield, Swords, Zap,
  TrendingUp, Award, History, Star, ChevronRight, Filter,
} from 'lucide-react';
import { getCountryCode } from '@/lib/country-codes';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeamInfo {
  id: number; team_name: string; league_id: number; league_name: string;
  region?: string | null;
  played: number; won: number; lost: number; points: number;
  sets_won: number; sets_lost: number; score_diff: number;
}

interface LeagueInfo {
  id: number; league_name: string; country?: string;
  format_type?: string | null;
}

interface SeasonStats {
  played: number; won: number; lost: number; points: number;
  sets_won: number; sets_lost: number; score_diff: number;
  points_for: number; points_against: number;
  position: number | null; cup_result: string;
}

interface Accolade { type: string; name: string; year: number; position?: number; }
interface CupHistoryEntry { name: string; year: number; max_round: number; round_reached: string; won: number; }
interface LeagueHistoryEntry { year: number; league_name: string; position: number | null; played: number; won: number; lost: number; points: number; }

interface SeasonBreakdownRow {
  season_year: number;
  points: number; spikes: number; blocks: number; aces: number; digs: number;
}

interface PlayerStat {
  id: number; player_name: string; position: string; overall: number;
  country: string; team_id: number | null; current_team_name?: string;
  stats: { points: number; spikes: number; blocks: number; aces: number; digs: number };
  seasonBreakdown: SeasonBreakdownRow[];
  teamHistory: { season_year: number; team_name: string; team_id: number | null }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function PlayerPhoto({ playerId, className = '' }: { playerId: number; className?: string }) {
  const [fallback, setFallback] = useState(false);
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image
        src={fallback ? '/assets/players/default.png' : `/assets/players/${playerId}.png`}
        alt="Player" fill unoptimized className="object-contain object-bottom"
        onError={() => setFallback(true)}
      />
    </div>
  );
}

function TeamLogo({ teamId, size = 32 }: { teamId?: number | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!teamId || failed) return <div style={{ width: size, height: size }} className="rounded bg-white/5" />;
  return (
    <div style={{ width: size, height: size }} className="relative shrink-0">
      <Image src={`/assets/teams/${teamId}.png`} alt="" fill unoptimized className="object-contain" onError={() => setFailed(true)} />
    </div>
  );
}

function Flag({ country }: { country: string }) {
  const [failed, setFailed] = useState(false);
  const code = country.length > 2 ? getCountryCode(country) : country.toLowerCase();
  if (failed) return null;
  return (
    <div className="w-5 h-3.5 rounded-sm overflow-hidden shrink-0">
      <img src={`/assets/flags/${code}.svg`} alt="" className="w-full h-full object-cover" onError={() => setFailed(true)} />
    </div>
  );
}

const POSITION_COLORS: Record<string, string> = {
  'Setter': 'bg-[#3b82f6]/15 text-[#60a5fa] border-[#3b82f6]/30',
  'Outside Hitter': 'bg-[#ef4444]/15 text-[#fca5a5] border-[#ef4444]/30',
  'Middle Blocker': 'bg-[#a78bfa]/15 text-[#c4b5fd] border-[#a78bfa]/30',
  'Opposite Hitter': 'bg-[#fb923c]/15 text-[#fdba74] border-[#fb923c]/30',
  'Libero': 'bg-[#22c55e]/15 text-[#86efac] border-[#22c55e]/30',
};

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <div className="surface-raised p-4 flex items-center gap-3 card-hover">
      <div className={`w-10 h-10 rounded flex items-center justify-center ${color}`}>
        <Icon size={16} />
      </div>
      <div>
        <p className="font-display text-2xl text-[var(--bone)] leading-tight tabular">{value}</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-500)]">{label}</p>
      </div>
    </div>
  );
}

// ─── Team Overview Tab ────────────────────────────────────────────────────────

function positionLabel(pos: number | null): string {
  if (pos == null) return '—';
  if (pos === 1) return 'Champions';
  if (pos === 2) return '2nd Place';
  if (pos === 3) return '3rd Place';
  return `${pos}th Place`;
}

function positionColor(pos: number | null): string {
  if (pos === 1) return 'text-[var(--volt)]';
  if (pos != null && pos <= 4) return 'text-[var(--info)]';
  if (pos != null && pos <= 8) return 'text-[var(--ink-300)]';
  return 'text-[var(--ink-500)]';
}

function TeamOverviewTab({
  team, teamId, selectedYear, years,
  onYearChange,
}: {
  team: TeamInfo;
  teamId: number;
  selectedYear: string;
  years: number[];
  onYearChange: (y: string) => void;
}) {
  const [data, setData] = useState<{ seasonStats: SeasonStats | null; accolades: Accolade[]; cupHistory: CupHistoryEntry[]; leagueHistory: LeagueHistoryEntry[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const [expandedAccolade, setExpandedAccolade] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const url = `/api/stats/team?teamId=${teamId}${selectedYear !== 'overall' ? `&year=${selectedYear}` : ''}`;
    fetch(url).then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [teamId, selectedYear]);

  const stats = selectedYear === 'overall' ? team : data?.seasonStats;
  const accolades = data?.accolades ?? [];
  const cupHistory = data?.cupHistory ?? [];
  const leagueHistory = data?.leagueHistory ?? [];

  // Group cup wins by competition name, group cup history by competition name
  const accoladeSummary = useMemo(() => {
    const cupWinMap: Record<string, { name: string; count: number; years: number[] }> = {};
    for (const a of accolades) {
      if (a.type === 'cup') {
        if (!cupWinMap[a.name]) cupWinMap[a.name] = { name: a.name, count: 0, years: [] };
        cupWinMap[a.name].count++;
        cupWinMap[a.name].years.push(a.year);
      }
    }
    // Group cup history by name
    const cupHistoryMap: Record<string, CupHistoryEntry[]> = {};
    for (const h of cupHistory) {
      if (!cupHistoryMap[h.name]) cupHistoryMap[h.name] = [];
      cupHistoryMap[h.name].push(h);
    }
    // All unique cup names participated in
    const allCupNames = Array.from(new Set(cupHistory.map(h => h.name)));
    return { cupWinMap, cupHistoryMap, allCupNames };
  }, [accolades, cupHistory]);

  // Group league history by league name
  const leagueHistoryByName = useMemo(() => {
    const map: Record<string, LeagueHistoryEntry[]> = {};
    for (const h of leagueHistory) {
      if (!map[h.league_name]) map[h.league_name] = [];
      map[h.league_name].push(h);
    }
    return map;
  }, [leagueHistory]);

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-[var(--volt)] border-t-transparent rounded-full animate-spin" /></div>;

  const yearOptions = ['overall', ...years.map(String)] as string[];
  const hasLeagueHistory = leagueHistory.length > 0;
  const hasCupHistory = cupHistory.length > 0;
  const hasAnyHistory = hasLeagueHistory || hasCupHistory;

  return (
    <div className="space-y-6">
      <div className="relative w-fit">
        <button
          onClick={() => setYearDropdownOpen(v => !v)}
          className="flex items-center gap-2 bg-[var(--ink-850)] border border-white/[0.08] hover:border-[var(--volt)]/40 rounded px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--bone)] cursor-pointer transition-colors min-w-[160px]"
        >
          <Filter size={13} className="text-[var(--volt)] shrink-0" />
          <span className="flex-1 text-left">{selectedYear === 'overall' ? 'Overall' : `Season ${selectedYear}`}</span>
          <ChevronDown size={14} className={`text-[var(--ink-400)] transition-transform shrink-0 ${yearDropdownOpen ? 'rotate-180' : ''}`} />
        </button>
        {yearDropdownOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setYearDropdownOpen(false)} />
            <div className="absolute top-full left-0 mt-1 surface-raised z-50 max-h-64 overflow-y-auto min-w-[180px]">
              {yearOptions.map(y => (
                <button
                  key={y}
                  onClick={() => { onYearChange(y); setYearDropdownOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors cursor-pointer ${
                    selectedYear === y
                      ? 'bg-[var(--volt)]/15 text-[var(--volt)] font-bold'
                      : 'text-[var(--ink-300)] hover:bg-white/[0.04] hover:text-[var(--bone)]'
                  }`}
                >
                  {y === 'overall' ? 'Overall' : `Season ${y}`}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Played" value={stats.played} icon={BarChart2} color="bg-[var(--info)]/15 text-[var(--info)]" />
          <StatCard label="Wins" value={stats.won} icon={TrendingUp} color="bg-[var(--win)]/15 text-[var(--win)]" />
          <StatCard label="Losses" value={stats.lost} icon={ChevronRight} color="bg-[var(--loss)]/15 text-[var(--loss)]" />
          <StatCard label="Points" value={stats.points} icon={Star} color="bg-[var(--volt)]/15 text-[var(--volt)]" />
          <StatCard label="Score Diff" value={(stats.score_diff > 0 ? '+' : '') + stats.score_diff} icon={Zap} color="bg-[var(--epic)]/15 text-[var(--epic)]" />
          <StatCard label="Set Diff" value={`${stats.sets_won}–${stats.sets_lost}`} icon={Swords} color="bg-[#22d3ee]/15 text-[#22d3ee]" />
        </div>
      )}

      {selectedYear !== 'overall' && data?.seasonStats && (
        <div className="grid grid-cols-2 gap-3">
          <div className="surface-raised p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-500)] mb-1.5">League Position</p>
            <p className="font-display text-4xl text-[var(--bone)] tabular leading-none">
              {data.seasonStats.position != null ? `#${data.seasonStats.position}` : '—'}
            </p>
          </div>
          <div className="surface-raised p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-500)] mb-1.5">Cup Result</p>
            <p className="font-display text-xl text-amber-400">{data.seasonStats.cup_result}</p>
          </div>
        </div>
      )}

      {selectedYear === 'overall' && (
        <div className="space-y-6">
          {/* ── Cup Competitions ── */}
          {hasCupHistory && (
            <div>
              <h3 className="font-display text-xl tracking-[0.05em] text-[var(--bone)] mb-3 flex items-center gap-2">
                <Trophy size={15} className="text-[var(--volt)]" /> CUP COMPETITIONS
              </h3>
              <div className="space-y-2">
                {accoladeSummary.allCupNames.map(cupName => {
                  const wins = accoladeSummary.cupWinMap[cupName];
                  const history = accoladeSummary.cupHistoryMap[cupName] ?? [];
                  const isExpanded = expandedAccolade === `cup:${cupName}`;
                  return (
                    <div key={cupName} className="surface-raised overflow-hidden">
                      <button
                        onClick={() => setExpandedAccolade(isExpanded ? null : `cup:${cupName}`)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors cursor-pointer"
                      >
                        <Trophy size={15} className={wins ? 'text-[var(--volt)]' : 'text-[var(--ink-500)]'} />
                        <div className="flex-1 text-left">
                          <span className="font-display text-base tracking-wide text-[var(--bone)]">{cupName.toUpperCase()}</span>
                          {wins && (
                            <span className="ml-2 font-mono text-[10px] text-[var(--volt)] font-bold uppercase tracking-wider">
                              {wins.count}× Winner
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-mono text-[10px] text-[var(--ink-500)] uppercase tracking-[0.18em]">{history.length} season{history.length !== 1 ? 's' : ''}</span>
                          <ChevronDown size={14} className={`text-[var(--ink-400)] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="border-t border-white/[0.06] divide-y divide-white/[0.04]">
                          <div className="grid grid-cols-[60px_1fr_120px] gap-3 px-4 py-2 bg-white/[0.02] font-mono text-[9px] uppercase tracking-widest text-[var(--ink-500)]">
                            <span>Year</span>
                            <span>Round Reached</span>
                            <span className="text-right">Result</span>
                          </div>
                          {history.sort((a, b) => b.year - a.year).map(h => {
                            const isWin = h.won === 1;
                            return (
                              <div key={h.year} className="grid grid-cols-[60px_1fr_120px] gap-3 px-4 py-2.5 items-center">
                                <span className="font-display text-base text-[var(--volt)]/75 tabular leading-none">{h.year}</span>
                                <span className="text-sm text-[var(--ink-300)]">{h.round_reached}</span>
                                <div className="text-right">
                                  {isWin ? (
                                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--volt)]/15 text-[var(--volt)] border border-[var(--volt)]/30">
                                      Winner
                                    </span>
                                  ) : (
                                    <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-500)]">
                                      Eliminated
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── League History ── */}
          {hasLeagueHistory && (
            <div>
              <h3 className="font-display text-xl tracking-[0.05em] text-[var(--bone)] mb-3 flex items-center gap-2">
                <Award size={15} className="text-[var(--volt)]" /> LEAGUE HISTORY
              </h3>
              <div className="space-y-2">
                {Object.entries(leagueHistoryByName).map(([leagueName, seasons]) => {
                  const isExpanded = expandedAccolade === `league:${leagueName}`;
                  const titles = seasons.filter(s => s.position === 1).length;
                  return (
                    <div key={leagueName} className="surface-raised overflow-hidden">
                      <button
                        onClick={() => setExpandedAccolade(isExpanded ? null : `league:${leagueName}`)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors cursor-pointer"
                      >
                        <Shield size={15} className={titles > 0 ? 'text-[var(--volt)]' : 'text-[var(--ink-500)]'} />
                        <div className="flex-1 text-left">
                          <span className="font-display text-base tracking-wide text-[var(--bone)]">{leagueName.toUpperCase()}</span>
                          {titles > 0 && (
                            <span className="ml-2 font-mono text-[10px] text-[var(--volt)] font-bold uppercase tracking-wider">
                              {titles}× Champion
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-mono text-[10px] text-[var(--ink-500)] uppercase tracking-[0.18em]">{seasons.length} season{seasons.length !== 1 ? 's' : ''}</span>
                          <ChevronDown size={14} className={`text-[var(--ink-400)] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="border-t border-white/[0.06] divide-y divide-white/[0.04]">
                          <div className="grid grid-cols-[60px_1fr_80px_80px_80px] gap-3 px-4 py-2 bg-white/[0.02] font-mono text-[9px] uppercase tracking-widest text-[var(--ink-500)]">
                            <span>Year</span>
                            <span>Result</span>
                            <span className="text-center">W</span>
                            <span className="text-center">L</span>
                            <span className="text-right">Pts</span>
                          </div>
                          {seasons.sort((a, b) => b.year - a.year).map(s => {
                            const isChamp = s.position === 1;
                            const isTop4 = s.position != null && s.position <= 4;
                            return (
                              <div key={s.year} className="grid grid-cols-[60px_1fr_80px_80px_80px] gap-3 px-4 py-2.5 items-center">
                                <span className="font-display text-base text-[var(--volt)]/75 tabular leading-none">{s.year}</span>
                                <div className="flex items-center gap-2">
                                  {s.position != null && (
                                    <span className={`font-mono text-[10px] font-bold tabular px-1.5 py-0.5 rounded ${
                                      isChamp ? 'bg-[var(--volt)]/15 text-[var(--volt)] border border-[var(--volt)]/30' :
                                      isTop4 ? 'bg-[var(--info)]/15 text-[var(--info)]' : 'bg-white/5 text-[var(--ink-400)]'
                                    }`}>#{s.position}</span>
                                  )}
                                  <span className={`text-sm font-medium ${positionColor(s.position)}`}>
                                    {positionLabel(s.position)}
                                  </span>
                                </div>
                                <span className="text-center font-mono text-sm text-[var(--win)] tabular">{s.won}</span>
                                <span className="text-center font-mono text-sm text-[var(--loss)] tabular">{s.lost}</span>
                                <span className="text-right font-display text-base text-[var(--volt)] tabular">{s.points}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!hasAnyHistory && (
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--ink-500)]">No competition history yet</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Player Stats Tab ─────────────────────────────────────────────────────────

const STAT_LABELS = [
  { key: 'points', label: 'PTS', color: 'text-[var(--volt)]' },
  { key: 'spikes', label: 'SPK', color: 'text-[var(--ink-300)]' },
  { key: 'blocks', label: 'BLK', color: 'text-[var(--ink-300)]' },
  { key: 'aces', label: 'ACE', color: 'text-[var(--ink-300)]' },
] as const;

function PlayerStatsTab({ teamId, years }: { teamId: number; years: number[] }) {
  const [selectedYear, setSelectedYear] = useState<string>(() => years.length > 0 ? String(Math.max(...years)) : 'overall');
  const [players, setPlayers] = useState<PlayerStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);

  // When years load, default to the most recent season
  useEffect(() => {
    if (years.length > 0) {
      setSelectedYear(String(Math.max(...years)));
    }
  }, [teamId]);

  useEffect(() => {
    setLoading(true);
    const url = `/api/stats/players?teamId=${teamId}${selectedYear !== 'overall' ? `&year=${selectedYear}` : ''}`;
    fetch(url).then(r => r.json()).then(d => { setPlayers(d.players ?? []); setLoading(false); }).catch(() => setLoading(false));
  }, [teamId, selectedYear]);

  const sorted = useMemo(() => [...players].sort((a, b) => (b.stats?.points ?? 0) - (a.stats?.points ?? 0)), [players]);

  const yearOptions = ['overall', ...years.map(String)] as string[];

  return (
    <div className="space-y-4">
      <div className="relative w-fit">
        <button
          onClick={() => setYearDropdownOpen(v => !v)}
          className="flex items-center gap-2 bg-[var(--ink-850)] border border-white/[0.08] hover:border-[var(--volt)]/40 rounded px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--bone)] cursor-pointer transition-colors min-w-[160px]"
        >
          <Filter size={13} className="text-[var(--volt)] shrink-0" />
          <span className="flex-1 text-left">{selectedYear === 'overall' ? 'Overall' : `Season ${selectedYear}`}</span>
          <ChevronDown size={14} className={`text-[var(--ink-400)] transition-transform shrink-0 ${yearDropdownOpen ? 'rotate-180' : ''}`} />
        </button>
        {yearDropdownOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setYearDropdownOpen(false)} />
            <div className="absolute top-full left-0 mt-1 surface-raised z-50 max-h-64 overflow-y-auto min-w-[180px]">
              {yearOptions.map(y => (
                <button
                  key={y}
                  onClick={() => { setSelectedYear(y); setExpanded(null); setYearDropdownOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors cursor-pointer ${
                    selectedYear === y
                      ? 'bg-[var(--volt)]/15 text-[var(--volt)] font-bold'
                      : 'text-[var(--ink-300)] hover:bg-white/[0.04] hover:text-[var(--bone)]'
                  }`}
                >
                  {y === 'overall' ? 'Overall' : `Season ${y}`}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-[var(--volt)] border-t-transparent rounded-full animate-spin" /></div>
      ) : sorted.length === 0 ? (
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--ink-500)] text-center py-10">No player stats available yet</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((p, idx) => (
            <div key={p.id} className="surface rounded overflow-hidden hover:border-[var(--volt)]/30 transition-colors">
              <button
                onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                className="w-full text-left hover:bg-white/[0.03] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="font-mono text-xs font-bold text-[var(--ink-500)] w-6 shrink-0 text-right tabular">#{idx + 1}</span>
                  <div className="relative w-11 h-11 shrink-0 overflow-hidden rounded bg-[var(--ink-850)]">
                    <Image
                      src={`/assets/players/${p.id}.png`}
                      alt={p.player_name} fill unoptimized className="object-contain object-bottom"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/assets/players/default.png'; }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--bone)] truncate leading-tight">{p.player_name}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Flag country={p.country} />
                      <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border font-bold tracking-wider ${POSITION_COLORS[p.position] ?? 'bg-white/10 text-[var(--ink-300)] border-white/15'}`}>
                        {p.position.split(' ').map(w => w[0]).join('')}
                      </span>
                      {p.team_id && p.current_team_name && (
                        <div className="flex items-center gap-1">
                          <TeamLogo teamId={p.team_id} size={16} />
                          <span className="font-mono text-[10px] text-[var(--ink-500)] truncate hidden sm:inline uppercase tracking-wider">{p.current_team_name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-5 shrink-0">
                    {STAT_LABELS.map(({ key, label, color }) => (
                      <div key={key} className="text-center hidden sm:block">
                        <p className={`font-display text-lg leading-tight tabular ${color}`}>{p.stats?.[key] ?? 0}</p>
                        <p className="font-mono text-[9.5px] text-[var(--ink-500)] uppercase tracking-[0.18em]">{label}</p>
                      </div>
                    ))}
                    <div className="text-center sm:hidden">
                      <p className="font-display text-lg text-[var(--volt)] leading-tight tabular">{p.stats?.points ?? 0}</p>
                      <p className="font-mono text-[9.5px] text-[var(--ink-500)] uppercase tracking-[0.18em]">PTS</p>
                    </div>
                    <ChevronDown size={14} className={`text-[var(--ink-500)] transition-transform ml-1 ${expanded === p.id ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              </button>

              {expanded === p.id && (
                <div className="bg-black/30 border-t border-white/[0.05] px-5 py-5 space-y-6">
                  <div>
                    <h4 className="font-mono text-[10px] text-[var(--ink-400)] uppercase tracking-[0.22em] font-bold mb-3 flex items-center gap-1.5">
                      <BarChart2 size={12} className="text-[var(--volt)]" />
                      {selectedYear === 'overall' ? 'Season Breakdown (at this team)' : `${selectedYear} Breakdown`}
                    </h4>
                    {p.seasonBreakdown.length === 0 ? (
                      <p className="font-mono text-[11px] text-[var(--ink-500)] uppercase tracking-wider">No stats recorded yet</p>
                    ) : (
                      <div className="space-y-2">
                        {(selectedYear === 'overall' ? p.seasonBreakdown : p.seasonBreakdown.filter(s => s.season_year === parseInt(selectedYear))).map(s => (
                          <div key={s.season_year} className="flex items-center gap-2 bg-white/[0.03] rounded px-3 py-2.5">
                            <span className="font-display text-base text-[var(--volt)]/85 w-12 shrink-0 tabular leading-none">{s.season_year}</span>
                            <div className="flex items-center gap-5 flex-1 justify-end">
                              {([
                                { val: s.points, label: 'PTS', color: 'text-[var(--volt)]' },
                                { val: s.spikes, label: 'SPK', color: 'text-[var(--ink-300)]' },
                                { val: s.blocks, label: 'BLK', color: 'text-[var(--ink-300)]' },
                                { val: s.aces,   label: 'ACE', color: 'text-[var(--ink-300)]' },
                              ] as const).map(({ val, label, color }) => (
                                <div key={label} className="text-center min-w-[2.5rem]">
                                  <p className={`font-display text-base leading-tight tabular ${color}`}>{val}</p>
                                  <p className="font-mono text-[9.5px] text-[var(--ink-500)] uppercase tracking-[0.18em]">{label}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        {selectedYear === 'overall' && p.seasonBreakdown.length > 1 && (
                          <div className="flex items-center gap-2 border border-[var(--volt)]/30 bg-[var(--volt)]/5 rounded px-3 py-2.5 mt-1">
                            <span className="font-mono text-[10px] uppercase tracking-[0.2em] font-bold text-[var(--ink-400)] w-12 shrink-0">Total</span>
                            <div className="flex items-center gap-5 flex-1 justify-end">
                              {([
                                { val: p.stats?.points ?? 0, label: 'PTS', color: 'text-[var(--volt)]' },
                                { val: p.stats?.spikes ?? 0, label: 'SPK', color: 'text-[var(--ink-300)]' },
                                { val: p.stats?.blocks ?? 0, label: 'BLK', color: 'text-[var(--ink-300)]' },
                                { val: p.stats?.aces   ?? 0, label: 'ACE', color: 'text-[var(--ink-300)]' },
                              ] as const).map(({ val, label, color }) => (
                                <div key={label} className="text-center min-w-[2.5rem]">
                                  <p className={`font-display text-base leading-tight tabular ${color}`}>{val}</p>
                                  <p className="font-mono text-[9.5px] text-[var(--ink-500)] uppercase tracking-[0.18em]">{label}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="font-mono text-[10px] text-[var(--ink-400)] uppercase tracking-[0.22em] font-bold mb-3 flex items-center gap-1.5">
                      <History size={12} className="text-[var(--volt)]" /> Career History
                    </h4>
                    {p.teamHistory.length === 0 ? (
                      <p className="font-mono text-[11px] text-[var(--ink-500)] uppercase tracking-wider">No history recorded yet</p>
                    ) : (
                      <div className="space-y-1.5">
                        {p.teamHistory.map((h, i) => (
                          <div key={i} className="flex items-center gap-2.5 py-2 border-b border-white/[0.04] last:border-0">
                            <span className="font-display text-base text-[var(--volt)]/75 w-12 shrink-0 tabular leading-none">{h.season_year}</span>
                            <TeamLogo teamId={h.team_id} size={20} />
                            <span className="text-sm text-[var(--ink-300)]">{h.team_name}</span>
                            {h.team_id === teamId && (
                              <span className="ml-auto font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--volt)]/15 text-[var(--volt)] border border-[var(--volt)]/30 uppercase tracking-wider">This team</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── League / Conference Stats Tab ───────────────────────────────────────────

type LeaderKey = 'points' | 'spikes' | 'blocks' | 'aces';
const LEADER_BOARDS: { key: LeaderKey; title: string; eyebrow: string; icon: React.ElementType; accent: string; bar: string }[] = [
  { key: 'points', title: 'Top Scorers',   eyebrow: 'Total Points', icon: Trophy,    accent: 'text-[var(--volt)]',   bar: 'bg-[var(--volt)]' },
  { key: 'spikes', title: 'Top Spikers',   eyebrow: 'Kills',         icon: Swords,    accent: 'text-[#ef4444]',        bar: 'bg-[#ef4444]' },
  { key: 'blocks', title: 'Top Blockers',  eyebrow: 'Blocks',        icon: Shield,    accent: 'text-[#a78bfa]',        bar: 'bg-[#a78bfa]' },
  { key: 'aces',   title: 'Ace Kings',     eyebrow: 'Aces',          icon: Zap,       accent: 'text-[#22d3ee]',        bar: 'bg-[#22d3ee]' },
];

interface LeagueStatPlayer {
  id: number; player_name: string; position: string; overall: number;
  country: string; team_id: number | null; current_team_name?: string;
  in_league_now: boolean;
  stats: { points: number; spikes: number; blocks: number; aces: number; digs: number };
}

function LeagueStatsTab({
  leagueId, region, regionsAvailable, years, selectedYear, onYearChange, onRegionChange,
}: {
  leagueId: number;
  region: string | null;
  regionsAvailable: string[];
  years: number[];
  selectedYear: string;
  onYearChange: (y: string) => void;
  onRegionChange: (r: string | null) => void;
}) {
  const [players, setPlayers] = useState<LeagueStatPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [yearOpen, setYearOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ leagueId: String(leagueId) });
    if (selectedYear !== 'overall') params.set('year', selectedYear);
    if (region) params.set('region', region);
    fetch(`/api/stats/players?${params.toString()}`)
      .then(r => r.json())
      .then(d => { setPlayers(d.players ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [leagueId, region, selectedYear]);

  const yearOptions = ['overall', ...years.map(String)] as string[];

  // Build top-N for each stat
  const topByStat = useMemo(() => {
    const map: Record<LeaderKey, LeagueStatPlayer[]> = { points: [], spikes: [], blocks: [], aces: [] };
    for (const k of Object.keys(map) as LeaderKey[]) {
      map[k] = [...players]
        .filter(p => (p.stats?.[k] ?? 0) > 0)
        .sort((a, b) => (b.stats?.[k] ?? 0) - (a.stats?.[k] ?? 0))
        .slice(0, 10);
    }
    return map;
  }, [players]);

  return (
    <div className="space-y-5">
      {/* Year + Conference filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative w-fit">
          <button
            onClick={() => setYearOpen(v => !v)}
            className="flex items-center gap-2 bg-[var(--ink-850)] border border-white/[0.08] hover:border-[var(--volt)]/40 rounded px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] font-bold text-[var(--bone)] cursor-pointer transition-colors min-w-[160px]"
          >
            <Filter size={13} className="text-[var(--volt)] shrink-0" />
            <span className="flex-1 text-left">{selectedYear === 'overall' ? 'Overall' : `Season ${selectedYear}`}</span>
            <ChevronDown size={14} className={`text-[var(--ink-400)] transition-transform shrink-0 ${yearOpen ? 'rotate-180' : ''}`} />
          </button>
          {yearOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setYearOpen(false)} />
              <div className="absolute top-full left-0 mt-1 surface-raised z-50 max-h-64 overflow-y-auto min-w-[180px]">
                {yearOptions.map(y => (
                  <button key={y}
                    onClick={() => { onYearChange(y); setYearOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors cursor-pointer ${
                      selectedYear === y ? 'bg-[var(--volt)]/15 text-[var(--volt)] font-bold' : 'text-[var(--ink-300)] hover:bg-white/[0.04] hover:text-[var(--bone)]'
                    }`}>
                    {y === 'overall' ? 'Overall' : `Season ${y}`}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {regionsAvailable.length > 1 && (
          <div className="flex items-center gap-1 bg-[var(--ink-850)] border border-white/[0.06] rounded p-1">
            <button
              onClick={() => onRegionChange(null)}
              className={`px-3 py-1.5 rounded font-mono text-[10.5px] font-bold uppercase tracking-[0.18em] transition-colors cursor-pointer ${region === null ? 'bg-[var(--volt)] text-[var(--ink-950)]' : 'text-[var(--ink-400)] hover:text-[var(--bone)]'}`}>
              All Conf
            </button>
            {regionsAvailable.map(r => (
              <button key={r}
                onClick={() => onRegionChange(r)}
                className={`px-3 py-1.5 rounded font-mono text-[10.5px] font-bold uppercase tracking-[0.18em] transition-colors cursor-pointer ${region === r
                  ? r === 'north' ? 'bg-[#22d3ee] text-black' : 'bg-[#a78bfa] text-black'
                  : 'text-[var(--ink-400)] hover:text-[var(--bone)]'}`}>
                {r}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-[var(--volt)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : players.length === 0 ? (
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--ink-500)] text-center py-10">
          No stats recorded for this {region ? 'conference' : 'league'} yet
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {LEADER_BOARDS.map(board => {
            const top = topByStat[board.key];
            const max = top[0]?.stats?.[board.key] ?? 0;
            return (
              <div key={board.key} className="surface-raised overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.05]">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-1 h-5 ${board.bar}`} />
                    <board.icon size={14} className={board.accent} />
                    <div>
                      <p className="font-mono text-[8.5px] uppercase tracking-[0.3em] text-[var(--ink-500)] font-bold">{board.eyebrow}</p>
                      <h3 className="font-display text-base tracking-[0.06em] text-[var(--bone)] leading-none mt-0.5">{board.title.toUpperCase()}</h3>
                    </div>
                  </div>
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--ink-500)] font-bold">Top {top.length}</span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {top.length === 0 ? (
                    <div className="px-5 py-6 font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--ink-500)] text-center">
                      No data
                    </div>
                  ) : top.map((p, idx) => {
                    const val = p.stats?.[board.key] ?? 0;
                    const pct = max > 0 ? Math.round((val / max) * 100) : 0;
                    const rankColor = idx === 0 ? 'text-[var(--volt)]' : idx === 1 ? 'text-[var(--ink-300)]' : idx === 2 ? 'text-orange-300' : 'text-[var(--ink-500)]';
                    return (
                      <div key={p.id} className="relative flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03] transition-colors group overflow-hidden">
                        <span className={`absolute left-0 top-0 bottom-0 ${board.bar} opacity-10 transition-all`} style={{ width: `${pct}%` }} />
                        <span className={`relative font-display text-lg ${rankColor} tabular w-6 shrink-0 text-right leading-none`}>{idx + 1}</span>
                        <div className="relative w-9 h-9 shrink-0 overflow-hidden rounded bg-[var(--ink-850)]">
                          <Image src={`/assets/players/${p.id}.png`} alt={p.player_name} fill unoptimized className="object-contain object-bottom"
                            onError={(e) => { (e.target as HTMLImageElement).src = '/assets/players/default.png'; }} />
                        </div>
                        <div className="relative min-w-0 flex-1">
                          <p className="text-[12.5px] font-bold text-[var(--bone)] truncate leading-tight">{p.player_name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Flag country={p.country} />
                            <span className={`font-mono text-[9px] px-1 py-[1px] rounded border font-bold tracking-wider ${POSITION_COLORS[p.position] ?? 'bg-white/10 text-[var(--ink-300)] border-white/15'}`}>
                              {p.position.split(' ').map(w => w[0]).join('')}
                            </span>
                            {p.team_id && p.current_team_name && (
                              <div className="flex items-center gap-1">
                                <TeamLogo teamId={p.team_id} size={14} />
                                <span className="font-mono text-[9px] text-[var(--ink-500)] truncate uppercase tracking-wider hidden sm:inline">{p.current_team_name}</span>
                              </div>
                            )}
                            {!p.in_league_now && (
                              <span className="font-mono text-[8.5px] text-[var(--ink-600)] uppercase tracking-wider italic">moved</span>
                            )}
                          </div>
                        </div>
                        <span className={`relative font-display text-xl ${board.accent} tabular leading-none shrink-0`}>{val}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const { team: userTeam } = useAuth();
  const [allTeams, setAllTeams] = useState<TeamInfo[]>([]);
  const [allLeagues, setAllLeagues] = useState<LeagueInfo[]>([]);
  const [scope, setScope] = useState<'team' | 'league'>('team');
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>('overall');
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [tab, setTab] = useState<'overview' | 'players'>('overview');
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);
  const [leagueDropdownOpen, setLeagueDropdownOpen] = useState(false);

  // Load all teams
  useEffect(() => {
    fetch('/api/teams').then(r => r.json()).then((d: TeamInfo[]) => {
      setAllTeams(d);
    });
    fetch('/api/leagues').then(r => r.json()).then((d: LeagueInfo[]) => {
      setAllLeagues(d);
    });
  }, []);

  // Default to user team
  useEffect(() => {
    if (!selectedTeamId && userTeam?.id) {
      setSelectedTeamId(userTeam.id);
    }
  }, [userTeam, selectedTeamId]);

  // Default selectedLeagueId to user's team's league once both are available
  useEffect(() => {
    if (!selectedLeagueId && userTeam?.id && allTeams.length > 0) {
      const ut = allTeams.find(t => t.id === userTeam.id);
      if (ut?.league_id) setSelectedLeagueId(ut.league_id);
    }
  }, [userTeam, allTeams, selectedLeagueId]);

  // Load available years for selected team. In league scope we reuse the first
  // team in the league as a proxy for available season years (the API only
  // exposes this on the team endpoint, and the year set is league-wide anyway).
  useEffect(() => {
    if (scope === 'team') {
      if (!selectedTeamId) return;
      fetch(`/api/stats/team?teamId=${selectedTeamId}`)
        .then(r => r.json())
        .then(d => setAvailableYears(d.availableYears ?? []));
    } else {
      const probeTeam = allTeams.find(t => t.league_id === selectedLeagueId);
      if (!probeTeam) { setAvailableYears([]); return; }
      fetch(`/api/stats/team?teamId=${probeTeam.id}`)
        .then(r => r.json())
        .then(d => setAvailableYears(d.availableYears ?? []));
    }
  }, [scope, selectedTeamId, selectedLeagueId, allTeams]);

  const selectedTeam = allTeams.find(t => t.id === selectedTeamId);
  const selectedLeague = allLeagues.find(l => l.id === selectedLeagueId);
  const leagueTeams = allTeams.filter(t => t.league_id === selectedLeagueId);
  const isMultiConference = selectedLeague?.format_type === 'multi_conference';
  const regionsInLeague = isMultiConference
    ? Array.from(new Set(leagueTeams.map(t => t.region ?? 'north').filter(Boolean))) as string[]
    : [];

  // Reset region whenever league changes (or scope leaves league mode)
  useEffect(() => {
    setSelectedRegion(null);
  }, [selectedLeagueId, scope]);

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Page header */}
      <div className="relative pb-5 border-b border-white/[0.06]">
        <div className="absolute -top-2 left-0 h-[3px] w-16 bg-[var(--volt)]" />
        <p className="eyebrow mb-2">Analytics · Performance</p>
        <h1 className="font-display text-5xl tracking-[0.02em] text-[var(--bone)] leading-[0.85] flex items-center gap-3">
          <BarChart2 size={36} className="text-[var(--volt)]" /> STATS
        </h1>
        <p className="font-mono text-xs text-[var(--ink-400)] mt-3 uppercase tracking-wider">Track team performance and player contributions across seasons</p>
      </div>

      {/* Scope toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-[var(--ink-850)] border border-white/[0.06] rounded p-1">
          {([
            { key: 'team',   label: 'Team',           icon: Shield },
            { key: 'league', label: 'League · Conf',  icon: Award },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button key={key}
              onClick={() => setScope(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded font-mono text-[10.5px] uppercase tracking-[0.18em] font-bold transition-colors cursor-pointer ${
                scope === key ? 'bg-[var(--volt)] text-[var(--ink-950)]' : 'text-[var(--ink-400)] hover:text-[var(--bone)]'
              }`}>
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>

        {/* Team selector — only when scope is 'team' */}
        {scope === 'team' && (
          <div className="relative">
            <button
              onClick={() => setTeamDropdownOpen(v => !v)}
              className="flex items-center gap-3 surface-raised hover:border-[var(--volt)]/40 rounded px-4 py-3 min-w-[280px] cursor-pointer transition-colors"
            >
              <TeamLogo teamId={selectedTeamId} size={32} />
              <div className="flex-1 text-left">
                <p className="font-mono text-[9.5px] uppercase tracking-[0.28em] text-[var(--ink-500)]">Viewing stats for</p>
                <p className="font-display text-base tracking-wide text-[var(--bone)] mt-0.5">{selectedTeam?.team_name?.toUpperCase() ?? 'SELECT A TEAM…'}</p>
              </div>
              <ChevronDown size={16} className={`text-[var(--ink-400)] transition-transform ${teamDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {teamDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-80 surface-raised z-50 overflow-hidden">
                <div className="overflow-y-auto max-h-[26rem] [&::-webkit-scrollbar]:w-0 [scrollbar-width:none]">
                {allTeams.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setSelectedTeamId(t.id); setSelectedYear('overall'); setTab('overview'); setTeamDropdownOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] cursor-pointer transition-colors text-left ${t.id === selectedTeamId ? 'bg-[var(--volt)]/10' : ''}`}
                  >
                    <TeamLogo teamId={t.id} size={24} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--bone)] truncate">{t.team_name}</p>
                      <p className="font-mono text-[10px] text-[var(--ink-500)] uppercase tracking-wider truncate">{t.league_name}</p>
                    </div>
                    {t.id === userTeam?.id && <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--volt)] font-bold shrink-0">My Team</span>}
                  </button>
                ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* League selector — only when scope is 'league' */}
        {scope === 'league' && (
          <div className="relative">
            <button
              onClick={() => setLeagueDropdownOpen(v => !v)}
              className="flex items-center gap-3 surface-raised hover:border-[var(--volt)]/40 rounded px-4 py-3 min-w-[280px] cursor-pointer transition-colors"
            >
              <div className="w-8 h-8 rounded bg-[var(--volt)]/10 border border-[var(--volt)]/25 flex items-center justify-center shrink-0">
                <Award size={14} className="text-[var(--volt)]" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-mono text-[9.5px] uppercase tracking-[0.28em] text-[var(--ink-500)]">Leaderboards for</p>
                <p className="font-display text-base tracking-wide text-[var(--bone)] mt-0.5">{selectedLeague?.league_name?.toUpperCase() ?? 'SELECT A LEAGUE…'}</p>
              </div>
              <ChevronDown size={16} className={`text-[var(--ink-400)] transition-transform ${leagueDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {leagueDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-80 surface-raised z-50 overflow-hidden">
                <div className="overflow-y-auto max-h-[26rem] [&::-webkit-scrollbar]:w-0 [scrollbar-width:none]">
                  {allLeagues.map(l => (
                    <button
                      key={l.id}
                      onClick={() => { setSelectedLeagueId(l.id); setSelectedYear('overall'); setLeagueDropdownOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] cursor-pointer transition-colors text-left ${l.id === selectedLeagueId ? 'bg-[var(--volt)]/10' : ''}`}
                    >
                      <Award size={14} className="text-[var(--volt)]/60 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--bone)] truncate">{l.league_name}</p>
                        {l.format_type === 'multi_conference' && (
                          <p className="font-mono text-[10px] text-[var(--epic)] uppercase tracking-wider">Multi-Conference</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {scope === 'team' && selectedTeam && selectedTeamId && (
        <>
          {/* Team identity bar */}
          <div className="surface-raised flex items-center gap-4 px-5 py-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-[var(--volt)]" />
            <TeamLogo teamId={selectedTeamId} size={52} />
            <div>
              <p className="eyebrow">Franchise</p>
              <h2 className="font-display text-2xl tracking-wide text-[var(--bone)]">{selectedTeam.team_name.toUpperCase()}</h2>
              <p className="font-mono text-[10px] text-[var(--ink-500)] uppercase tracking-wider mt-0.5">{selectedTeam.league_name}</p>
            </div>
            {selectedTeamId === userTeam?.id && (
              <span className="ml-auto px-3 py-1.5 rounded bg-[var(--volt)]/15 border border-[var(--volt)]/30 text-[var(--volt)] font-mono text-[11px] font-bold uppercase tracking-[0.22em]">My Team</span>
            )}
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 bg-[var(--ink-850)] border border-white/[0.06] rounded p-1 w-fit">
            {([
              { key: 'overview', label: 'Team Overview', icon: Shield },
              { key: 'players', label: 'Player Stats', icon: Users },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded font-display tracking-[0.1em] uppercase text-sm transition-all cursor-pointer ${
                  tab === key
                    ? 'bg-[var(--volt)] text-[var(--ink-950)]'
                    : 'text-[var(--ink-400)] hover:text-[var(--bone)]'
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === 'overview' ? (
            <TeamOverviewTab
              team={selectedTeam}
              teamId={selectedTeamId}
              selectedYear={selectedYear}
              years={availableYears}
              onYearChange={setSelectedYear}
            />
          ) : (
            <PlayerStatsTab teamId={selectedTeamId} years={availableYears} />
          )}
        </>
      )}

      {scope === 'league' && selectedLeague && selectedLeagueId && (
        <>
          {/* League identity bar */}
          <div className="surface-raised flex items-center gap-4 px-5 py-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-[var(--volt)]" />
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-[var(--volt)]/10 blur-3xl pointer-events-none" />
            <div className="w-14 h-14 rounded bg-[var(--volt)]/10 border border-[var(--volt)]/25 flex items-center justify-center shrink-0">
              <Award size={26} className="text-[var(--volt)]" />
            </div>
            <div className="min-w-0">
              <p className="eyebrow">League · Leaderboards</p>
              <h2 className="font-display text-2xl tracking-wide text-[var(--bone)] truncate">{selectedLeague.league_name.toUpperCase()}</h2>
              <p className="font-mono text-[10px] text-[var(--ink-500)] uppercase tracking-wider mt-0.5 tabular">
                {leagueTeams.length} teams
                {isMultiConference && regionsInLeague.length > 1 && (
                  <span> <span className="text-[var(--ink-600)]">·</span> <span className="text-[var(--epic)]">Multi-Conference</span></span>
                )}
              </p>
            </div>
          </div>

          <LeagueStatsTab
            leagueId={selectedLeagueId}
            region={selectedRegion}
            regionsAvailable={regionsInLeague}
            years={availableYears}
            selectedYear={selectedYear}
            onYearChange={setSelectedYear}
            onRegionChange={setSelectedRegion}
          />
        </>
      )}

      {/* Click-away to close dropdowns */}
      {teamDropdownOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setTeamDropdownOpen(false)} />
      )}
      {leagueDropdownOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setLeagueDropdownOpen(false)} />
      )}
    </div>
  );
}
