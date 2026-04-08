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
  played: number; won: number; lost: number; points: number;
  sets_won: number; sets_lost: number; score_diff: number;
}

interface SeasonStats {
  played: number; won: number; lost: number; points: number;
  sets_won: number; sets_lost: number; score_diff: number;
  points_for: number; points_against: number;
  position: number | null; cup_result: string;
}

interface Accolade { type: string; name: string; year: number; }

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
  'Setter': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'Outside Hitter': 'bg-red-500/20 text-red-300 border-red-500/30',
  'Middle Blocker': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'Opposite Hitter': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  'Libero': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
};

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-white/5 border border-white/8 rounded-xl p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
        <Icon size={16} />
      </div>
      <div>
        <p className="text-lg font-bold text-white leading-tight">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

// ─── Team Overview Tab ────────────────────────────────────────────────────────

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
  const [data, setData] = useState<{ seasonStats: SeasonStats | null; accolades: Accolade[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const url = `/api/stats/team?teamId=${teamId}${selectedYear !== 'overall' ? `&year=${selectedYear}` : ''}`;
    fetch(url).then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [teamId, selectedYear]);

  const stats = selectedYear === 'overall' ? team : data?.seasonStats;
  const accolades = data?.accolades ?? [];

  // Group accolades by type+name
  const accoladeSummary = useMemo(() => {
    const map: Record<string, { name: string; type: string; count: number; years: number[] }> = {};
    for (const a of accolades) {
      const key = `${a.type}:${a.name}`;
      if (!map[key]) map[key] = { name: a.name, type: a.type, count: 0, years: [] };
      map[key].count++;
      map[key].years.push(a.year);
    }
    return Object.values(map);
  }, [accolades]);

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* Year filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['overall', ...years.map(String)] as string[]).map(y => (
          <button
            key={y}
            onClick={() => onYearChange(y)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer border ${
              selectedYear === y
                ? 'bg-amber-500 border-amber-500 text-black'
                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
            }`}
          >
            {y === 'overall' ? 'Overall' : y}
          </button>
        ))}
      </div>

      {/* Team stats grid */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Played" value={stats.played} icon={BarChart2} color="bg-blue-500/20 text-blue-400" />
          <StatCard label="Wins" value={stats.won} icon={TrendingUp} color="bg-emerald-500/20 text-emerald-400" />
          <StatCard label="Losses" value={stats.lost} icon={ChevronRight} color="bg-red-500/20 text-red-400" />
          <StatCard label="Points" value={stats.points} icon={Star} color="bg-amber-500/20 text-amber-400" />
          <StatCard label="Score Diff" value={(stats.score_diff > 0 ? '+' : '') + stats.score_diff} icon={Zap} color="bg-purple-500/20 text-purple-400" />
          <StatCard label="Set Diff" value={`${stats.sets_won}–${stats.sets_lost}`} icon={Swords} color="bg-cyan-500/20 text-cyan-400" />
        </div>
      )}

      {/* Season-specific: position + cup */}
      {selectedYear !== 'overall' && data?.seasonStats && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/5 border border-white/8 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">League Position</p>
            <p className="text-3xl font-bold text-white">
              {data.seasonStats.position != null ? `#${data.seasonStats.position}` : '—'}
            </p>
          </div>
          <div className="bg-white/5 border border-white/8 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Cup Result</p>
            <p className="text-xl font-bold text-amber-400">{data.seasonStats.cup_result}</p>
          </div>
        </div>
      )}

      {/* Accolades */}
      {selectedYear === 'overall' && (
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Award size={14} className="text-amber-400" /> Accolades
          </h3>
          {accoladeSummary.length === 0 ? (
            <p className="text-gray-600 text-sm italic">No accolades yet.</p>
          ) : (
            <div className="space-y-2">
              {accoladeSummary.map((a, i) => (
                <div key={i} className="flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-4 py-3">
                  <Trophy size={16} className={a.type === 'cup' ? 'text-amber-400' : 'text-blue-400'} />
                  <div className="flex-1">
                    <span className="text-sm text-white font-medium">{a.name}</span>
                    <span className="ml-2 text-xs text-gray-500">{a.years.join(', ')}</span>
                  </div>
                  <span className="text-lg font-bold text-amber-400">{a.count}×</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Player Stats Tab ─────────────────────────────────────────────────────────

function PlayerStatsTab({ teamId, years }: { teamId: number; years: number[] }) {
  const [selectedYear, setSelectedYear] = useState<string>('overall');
  const [players, setPlayers] = useState<PlayerStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    const url = `/api/stats/players?teamId=${teamId}${selectedYear !== 'overall' ? `&year=${selectedYear}` : ''}`;
    fetch(url).then(r => r.json()).then(d => { setPlayers(d.players ?? []); setLoading(false); }).catch(() => setLoading(false));
  }, [teamId, selectedYear]);

  const sorted = useMemo(() => [...players].sort((a, b) => (b.stats?.points ?? 0) - (a.stats?.points ?? 0)), [players]);

  return (
    <div className="space-y-5">
      {/* Year filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['overall', ...years.map(String)] as string[]).map(y => (
          <button
            key={y}
            onClick={() => { setSelectedYear(y); setExpanded(null); }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer border ${
              selectedYear === y
                ? 'bg-amber-500 border-amber-500 text-black'
                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
            }`}
          >
            {y === 'overall' ? 'Overall' : y}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : sorted.length === 0 ? (
        <p className="text-gray-600 text-sm italic text-center py-10">No player stats available yet.</p>
      ) : (
        <div className="space-y-2">
          {/* Header */}
          <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-4 py-2 text-xs text-gray-500 uppercase tracking-wider font-medium">
            <span>Player</span>
            <span className="text-center">Points</span>
            <span className="text-center">Spikes</span>
            <span className="text-center">Blocks</span>
            <span className="text-center">Aces</span>
            <span className="text-center">Digs</span>
          </div>

          {sorted.map((p, idx) => (
            <div key={p.id}>
              <button
                onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                className="w-full text-left bg-white/4 hover:bg-white/7 border border-white/8 hover:border-white/15 rounded-xl transition-all duration-200 cursor-pointer"
              >
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-4 py-3 items-center">
                  {/* Player info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-bold text-gray-600 w-5 shrink-0">#{idx + 1}</span>
                    <div className="relative w-10 h-10 shrink-0 overflow-hidden">
                      <Image
                        src={`/assets/players/${p.id}.png`}
                        alt={p.player_name} fill unoptimized className="object-contain object-bottom"
                        onError={(e) => { (e.target as HTMLImageElement).src = '/assets/players/default.png'; }}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{p.player_name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Flag country={p.country} />
                        <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${POSITION_COLORS[p.position] ?? 'bg-gray-500/20 text-gray-300 border-gray-500/30'}`}>
                          {p.position.split(' ').map(w => w[0]).join('')}
                        </span>
                        {p.current_team_name && p.team_id !== teamId && (
                          <span className="text-xs text-gray-600 truncate">{p.current_team_name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Stat columns */}
                  <div className="text-center">
                    <span className="text-sm font-bold text-amber-400">{p.stats?.points ?? 0}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-sm text-gray-300">{p.stats?.spikes ?? 0}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-sm text-gray-300">{p.stats?.blocks ?? 0}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-sm text-gray-300">{p.stats?.aces ?? 0}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-sm text-gray-300">{p.stats?.digs ?? 0}</span>
                  </div>
                </div>
              </button>

              {/* Expanded detail */}
              {expanded === p.id && (
                <div className="mx-1 mb-2 bg-gray-900/80 border border-white/10 border-t-0 rounded-b-xl px-5 py-4 space-y-5">
                  {/* Season-by-season breakdown (only stats while at this team) */}
                  <div>
                    <h4 className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3 flex items-center gap-1.5">
                      <BarChart2 size={12} className="text-amber-400" />
                      {selectedYear === 'overall' ? 'Season Breakdown (at this team)' : `${selectedYear} Breakdown`}
                    </h4>
                    {p.seasonBreakdown.length === 0 ? (
                      <p className="text-xs text-gray-600 italic">No stats recorded yet.</p>
                    ) : (
                      <div>
                        {/* Table header */}
                        <div className="grid grid-cols-[3rem_1fr_1fr_1fr_1fr_1fr] gap-2 px-2 py-1 text-xs text-gray-600 uppercase tracking-wider font-medium mb-1">
                          <span>Year</span>
                          <span className="text-center">Pts</span>
                          <span className="text-center">Spk</span>
                          <span className="text-center">Blk</span>
                          <span className="text-center">Ace</span>
                          <span className="text-center">Dig</span>
                        </div>
                        <div className="space-y-1">
                          {(selectedYear === 'overall' ? p.seasonBreakdown : p.seasonBreakdown.filter(s => s.season_year === parseInt(selectedYear))).map(s => (
                            <div key={s.season_year} className="grid grid-cols-[3rem_1fr_1fr_1fr_1fr_1fr] gap-2 px-2 py-1.5 rounded-lg bg-white/4 text-sm items-center">
                              <span className="text-xs font-bold text-amber-500/80">{s.season_year}</span>
                              <span className="text-center font-bold text-amber-400">{s.points}</span>
                              <span className="text-center text-gray-300">{s.spikes}</span>
                              <span className="text-center text-gray-300">{s.blocks}</span>
                              <span className="text-center text-gray-300">{s.aces}</span>
                              <span className="text-center text-gray-300">{s.digs}</span>
                            </div>
                          ))}
                          {/* Total row for overall view */}
                          {selectedYear === 'overall' && p.seasonBreakdown.length > 1 && (
                            <div className="grid grid-cols-[3rem_1fr_1fr_1fr_1fr_1fr] gap-2 px-2 py-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 text-sm items-center mt-1">
                              <span className="text-xs font-bold text-gray-500">Total</span>
                              <span className="text-center font-bold text-amber-400">{p.stats?.points ?? 0}</span>
                              <span className="text-center text-gray-300">{p.stats?.spikes ?? 0}</span>
                              <span className="text-center text-gray-300">{p.stats?.blocks ?? 0}</span>
                              <span className="text-center text-gray-300">{p.stats?.aces ?? 0}</span>
                              <span className="text-center text-gray-300">{p.stats?.digs ?? 0}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Team history */}
                  <div>
                    <h4 className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3 flex items-center gap-1.5">
                      <History size={12} className="text-amber-400" /> Career History
                    </h4>
                    {p.teamHistory.length === 0 ? (
                      <p className="text-xs text-gray-600 italic">No history recorded yet.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {p.teamHistory.map((h, i) => (
                          <div key={i} className="flex items-center gap-2.5 py-1.5 border-b border-white/5 last:border-0">
                            <span className="text-xs font-bold text-amber-500/70 w-10 shrink-0">{h.season_year}</span>
                            <TeamLogo teamId={h.team_id} size={20} />
                            <span className="text-sm text-gray-300">{h.team_name}</span>
                            {h.team_id === teamId && (
                              <span className="ml-auto text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-medium">This team</span>
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const { team: userTeam } = useAuth();
  const [allTeams, setAllTeams] = useState<TeamInfo[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>('overall');
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [tab, setTab] = useState<'overview' | 'players'>('overview');
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);

  // Load all teams
  useEffect(() => {
    fetch('/api/teams').then(r => r.json()).then((d: TeamInfo[]) => {
      setAllTeams(d);
    });
  }, []);

  // Default to user team
  useEffect(() => {
    if (!selectedTeamId && userTeam?.id) {
      setSelectedTeamId(userTeam.id);
    }
  }, [userTeam, selectedTeamId]);

  // Load available years for selected team
  useEffect(() => {
    if (!selectedTeamId) return;
    fetch(`/api/stats/team?teamId=${selectedTeamId}`)
      .then(r => r.json())
      .then(d => setAvailableYears(d.availableYears ?? []));
  }, [selectedTeamId]);

  const selectedTeam = allTeams.find(t => t.id === selectedTeamId);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BarChart2 size={22} className="text-amber-400" /> Stats
        </h1>
        <p className="text-sm text-gray-500 mt-1">Track team performance and player contributions across seasons.</p>
      </div>

      {/* Team selector */}
      <div className="relative">
        <button
          onClick={() => setTeamDropdownOpen(v => !v)}
          className="flex items-center gap-3 bg-white/5 border border-white/10 hover:border-white/20 rounded-xl px-4 py-3 min-w-[260px] cursor-pointer transition-colors"
        >
          <TeamLogo teamId={selectedTeamId} size={28} />
          <div className="flex-1 text-left">
            <p className="text-xs text-gray-500">Viewing stats for</p>
            <p className="text-sm font-semibold text-white">{selectedTeam?.team_name ?? 'Select a team…'}</p>
          </div>
          <ChevronDown size={16} className={`text-gray-400 transition-transform ${teamDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {teamDropdownOpen && (
          <div className="absolute top-full left-0 mt-2 w-72 bg-gray-900 border border-white/15 rounded-xl shadow-2xl z-50 max-h-72 overflow-y-auto">
            {allTeams.map(t => (
              <button
                key={t.id}
                onClick={() => { setSelectedTeamId(t.id); setSelectedYear('overall'); setTab('overview'); setTeamDropdownOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 cursor-pointer transition-colors text-left ${t.id === selectedTeamId ? 'bg-amber-500/10' : ''}`}
              >
                <TeamLogo teamId={t.id} size={22} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{t.team_name}</p>
                  <p className="text-xs text-gray-500">{t.league_name}</p>
                </div>
                {t.id === userTeam?.id && <span className="ml-auto text-xs text-amber-400 font-semibold shrink-0">My Team</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedTeam && selectedTeamId && (
        <>
          {/* Team identity bar */}
          <div className="flex items-center gap-4 bg-gradient-to-r from-white/5 to-transparent border border-white/8 rounded-2xl px-5 py-4">
            <TeamLogo teamId={selectedTeamId} size={48} />
            <div>
              <h2 className="text-xl font-bold text-white">{selectedTeam.team_name}</h2>
              <p className="text-sm text-gray-500">{selectedTeam.league_name}</p>
            </div>
            {selectedTeamId === userTeam?.id && (
              <span className="ml-auto px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wide">My Team</span>
            )}
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-fit">
            {([
              { key: 'overview', label: 'Team Overview', icon: Shield },
              { key: 'players', label: 'Player Stats', icon: Users },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  tab === key
                    ? 'bg-amber-500 text-black'
                    : 'text-gray-400 hover:text-white'
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

      {/* Click-away to close dropdown */}
      {teamDropdownOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setTeamDropdownOpen(false)} />
      )}
    </div>
  );
}
