'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    Trophy, TrendingUp, TrendingDown, X, MapPin, Users, Calendar, Award,
    BarChart2, Gamepad2, Shield, Swords, DollarSign, ChevronDown, Globe, History,
} from 'lucide-react';
import Image from 'next/image';
import { getCountryName, getCountryCode } from '@/lib/country-codes';
import PlayerModal from '@/components/player-modal';
import GameSummaryModal from '@/components/game-summary-modal';
import { useAuth } from '@/contexts/auth-context';

// Position theming for the team-detail roster — matches the squad page's FUT cards.
const POS_THEME: Record<string, { hex: string; rail: string; chip: string; text: string; halo: string }> = {
    'Setter':          { hex: '#3b82f6', rail: 'bg-[#3b82f6]', chip: 'bg-[#3b82f6] text-black', text: 'text-[#60a5fa]', halo: 'bg-[#3b82f6]/30' },
    'Outside Hitter':  { hex: '#ef4444', rail: 'bg-[#ef4444]', chip: 'bg-[#ef4444] text-black', text: 'text-[#fca5a5]', halo: 'bg-[#ef4444]/30' },
    'Middle Blocker':  { hex: '#a78bfa', rail: 'bg-[#a78bfa]', chip: 'bg-[#a78bfa] text-black', text: 'text-[#c4b5fd]', halo: 'bg-[#a78bfa]/30' },
    'Opposite Hitter': { hex: '#fb923c', rail: 'bg-[#fb923c]', chip: 'bg-[#fb923c] text-black', text: 'text-[#fdba74]', halo: 'bg-[#fb923c]/30' },
    'Libero':          { hex: '#22c55e', rail: 'bg-[#22c55e]', chip: 'bg-[#22c55e] text-black', text: 'text-[#86efac]', halo: 'bg-[#22c55e]/30' },
};
function posTheme(p: string) {
    return POS_THEME[p] || { hex: '#a1a1aa', rail: 'bg-zinc-400', chip: 'bg-zinc-300 text-black', text: 'text-zinc-300', halo: 'bg-white/15' };
}
function posAbbr(p: string) {
    const m: Record<string, string> = { 'Setter': 'S', 'Outside Hitter': 'OH', 'Middle Blocker': 'MB', 'Opposite Hitter': 'OPP', 'Libero': 'L' };
    return m[p] || p.substring(0, 2).toUpperCase();
}
function ovrTier(v: number): { label: string; text: string; ring: string } {
    if (v >= 85) return { label: 'ELITE',  text: 'text-emerald-300', ring: 'ring-emerald-300/45' };
    if (v >= 75) return { label: 'GOLD',   text: 'text-yellow-300',   ring: 'ring-yellow-300/40' };
    if (v >= 65) return { label: 'PRO',    text: 'text-amber-300',    ring: 'ring-amber-300/35' };
    if (v >= 55) return { label: 'SILVER', text: 'text-zinc-200',     ring: 'ring-zinc-200/30' };
    return         { label: 'BRONZE', text: 'text-orange-300',   ring: 'ring-orange-300/30' };
}

interface League {
    id: number;
    league_name: string;
    format_type?: string | null;
    post_season_type?: string | null;
    playoff_teams?: number;
    promotion_count?: number;
    relegation_count?: number;
}
interface Team {
    id: number; team_name: string; league_id: number; league_name: string; country?: string; region?: string;
    played: number; won: number; lost: number; points: number; sets_won: number; sets_lost: number; score_diff: number;
    team_money: number; stadium: string; capacity: number; founded: string;
}

interface Player {
    id: number; player_name: string; position: string; age: number; country: string;
    jersey_number: number; overall: number; height?: number;
    attack: number; defense: number; serve: number; block: number; receive: number; setting: number;
    contract_years?: number; monthly_wage?: number; player_value?: number;
    team_id?: number | null; team_name?: string;
}

interface Fixture {
    id: number; home_team_id: number; away_team_id: number;
    home_sets: number | null; away_sets: number | null;
    scheduled_date: string; status: string;
    home_team_name?: string; away_team_name?: string;
}

interface TeamWithRank extends Team {
    rank: number;
}

interface HistoricalStanding {
    team_id: number;
    team_name: string;
    league_id: number;
    league_name: string | null;
    country: string | null;
    region: string | null;
    played: number;
    won: number;
    lost: number;
    points: number;
    sets_won: number;
    sets_lost: number;
    score_diff: number;
    final_position: number | null;
    season_year: number;
}


export default function StandingsPage() {
    const { team: userTeam } = useAuth();
    const [leagues, setLeagues] = useState<League[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [selectedTeam, setSelectedTeam] = useState<TeamWithRank | null>(null);
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [showConference, setShowConference] = useState(false);

    // Country → open/closed
    const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set());
    // Country → selected league id
    const [selectedLeagueByCountry, setSelectedLeagueByCountry] = useState<Record<string, number>>({});

    // Historical view: null = live current standings
    const [availableYears, setAvailableYears] = useState<number[]>([]);
    const [selectedYear, setSelectedYear] = useState<number | null>(null);
    const [historicalStandings, setHistoricalStandings] = useState<HistoricalStanding[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    useEffect(() => {
        fetch('/api/leagues').then(r => r.json()).then((data: League[]) => {
            setLeagues(data);
            
            const typedData = data as (League & { country?: string })[];
            const userLeague = userTeam?.league_id ? typedData.find(l => l.id === userTeam.league_id) : undefined;
            const userTeamCountry = userLeague?.country;

            // Default: close all countries, but open user's team's country
            const perCountry: Record<string, number> = {};
            for (const l of typedData) {
                const c = l.country ?? 'Unknown';
                // Always set to user's league for their country
                if (c === userTeamCountry && userTeam?.league_id) {
                    perCountry[c] = userTeam.league_id;
                } else if (!perCountry[c]) {
                    perCountry[c] = l.id;
                }
            }
            setSelectedLeagueByCountry(perCountry);

            // Only expand user's team country
            if (userTeamCountry) {
                setExpandedCountries(new Set([userTeamCountry]));
            }
        });
        fetch('/api/teams').then(r => r.json()).then(setTeams);
    }, [userTeam?.league_id]);

    // Available historical years (one fetch on mount)
    useEffect(() => {
        fetch('/api/standings/history')
            .then(r => r.json())
            .then((data: { years: number[] }) => setAvailableYears(data.years ?? []));
    }, []);

    // Fetch snapshot data when a historical year is selected
    useEffect(() => {
        if (selectedYear === null) {
            setHistoricalStandings([]);
            return;
        }
        setLoadingHistory(true);
        fetch(`/api/standings/history?year=${selectedYear}`)
            .then(r => r.json())
            .then((data: { standings: HistoricalStanding[] }) => {
                setHistoricalStandings(data.standings ?? []);
            })
            .finally(() => setLoadingHistory(false));
    }, [selectedYear]);

    const isHistorical = selectedYear !== null;

    // For historical view, derive a Team[] equivalent from snapshots so the StandingsTable
    // component renders identically. Stats and rank come from the snapshot, not live tables.
    const effectiveTeams: Team[] = isHistorical
        ? historicalStandings.map(s => ({
            id: s.team_id,
            team_name: s.team_name ?? '(Unknown Team)',
            league_id: s.league_id,
            league_name: s.league_name ?? '',
            country: s.country ?? undefined,
            region: s.region ?? undefined,
            played: s.played,
            won: s.won,
            lost: s.lost,
            points: s.points,
            sets_won: s.sets_won,
            sets_lost: s.sets_lost,
            score_diff: s.score_diff,
            team_money: 0,
            stadium: '',
            capacity: 0,
            founded: '',
        }))
        : teams;

    // Group leagues by country
    const countriesWithLeagues: { country: string; leagues: (League & { country?: string })[] }[] = [];
    const leagueList = leagues as (League & { country?: string })[];
    const countryMap = new Map<string, (League & { country?: string })[]>();
    for (const l of leagueList) {
        const c = l.country ?? 'Unknown';
        if (!countryMap.has(c)) countryMap.set(c, []);
        countryMap.get(c)!.push(l);
    }
    countryMap.forEach((ls, c) => countriesWithLeagues.push({ country: c, leagues: ls }));

    const toggleCountry = (country: string) => {
        setExpandedCountries(prev => {
            const next = new Set(prev);
            if (next.has(country)) next.delete(country); else next.add(country);
            return next;
        });
    };

    const formatMoney = (n: number) => n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}K`;

    function TeamLogo({ teamId, size = 32, className = "" }: { teamId: number; size?: number; className?: string }) {
        const [src, setSrc] = useState(`/api/team-badge/${teamId}`);
        const [failed, setFailed] = useState(false);
        if (failed) return null;
        return (
            <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
                <Image src={src} alt="Team" fill unoptimized className="object-contain"
                    onError={() => {
                        if (src !== '/assets/teams/default.png') setSrc('/assets/teams/default.png');
                        else setFailed(true);
                    }} />
            </div>
        );
    }

    function CountryFlag({ country }: { country?: string }) {
        const [failed, setFailed] = useState(false);
        if (!country) return <span className="text-xs">🌍</span>;
        if (failed) return <span className="text-xs">🌍</span>;
        const code = country.length > 2 ? getCountryCode(country) : country.toLowerCase();
        return (
            <div className="w-5 h-3.5 rounded overflow-hidden shrink-0">
                <img src={`/assets/flags/${code}.svg`} alt={getCountryName(code)} className="w-full h-full object-cover"
                    onError={() => setFailed(true)} />
            </div>
        );
    }

    function StandingsTable({ conferenceTeams, title, accentColor = "amber", relegatedTeamIds, playoffCount = 0, promotionCount = 0 }: { conferenceTeams: Team[]; title: string; accentColor?: string; relegatedTeamIds?: Set<number>; playoffCount?: number; promotionCount?: number }) {
        const total = conferenceTeams.length;
        const accent = accentColor === 'sky' ? 'var(--info)' : accentColor === 'violet' ? 'var(--epic)' : 'var(--volt)';
        const accentHex = accentColor === 'sky' ? '#22d3ee' : accentColor === 'violet' ? '#a78bfa' : '#facc15';
        const leader = conferenceTeams[0];
        const totalPoints = conferenceTeams.reduce((s, t) => s + t.points, 0);


        return (
            <div>
                {/* Section header with leader strip */}
                <div className="flex items-end justify-between gap-3 mb-3 pb-3 border-b border-white/[0.05]">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="relative">
                            <div className="w-1.5 h-9" style={{ background: accent }} />
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45" style={{ background: accent }} />
                        </div>
                        <div className="min-w-0">
                            <p className="font-mono text-[8.5px] uppercase tracking-[0.32em] font-black" style={{ color: accent }}>Standings</p>
                            <h2 className="font-display text-xl tracking-[0.06em] text-[var(--bone)] uppercase leading-none mt-1">{title}</h2>
                        </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-3 shrink-0">
                        {leader && leader.points > 0 && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-white/[0.03] border border-white/[0.06]">
                                <Trophy size={11} className="text-yellow-300" />
                                <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--ink-500)] font-bold">Leader</span>
                                <span className="font-display text-xs tracking-wide text-yellow-300 max-w-[140px] truncate">{leader.team_name.toUpperCase()}</span>
                            </div>
                        )}
                        <span className="font-mono text-[9.5px] text-[var(--ink-500)] uppercase tracking-[0.22em] font-bold tabular">{total} teams</span>
                    </div>
                </div>

                {/* Table */}
                <div className="surface-raised overflow-hidden relative">
                    {/* Top accent rail */}
                    <div className="absolute top-0 inset-x-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${accent} 0%, transparent 100%)` }} />

                    <div className="overflow-x-auto">
                        {/* Table header */}
                        <div className="grid grid-cols-[auto_1fr_44px_44px_44px_70px] md:grid-cols-[auto_1fr_52px_52px_52px_88px] gap-2 md:gap-3 px-3 md:px-6 py-3 bg-[var(--ink-950)]/40 border-b border-white/[0.06] font-mono text-[9.5px] text-[var(--ink-500)] uppercase tracking-[0.28em] font-black min-w-fit">
                            <span className="w-6 md:w-8 text-center">#</span>
                            <span>Team</span>
                            <span className="text-center" title="Played">P</span>
                            <span className="text-center" title="Won">W</span>
                            <span className="text-center" title="Lost">L</span>
                            <span className="text-center" title="Points">Pts</span>
                        </div>

                        {conferenceTeams.map((team, idx) => {
                            const isPlayoffSpot = playoffCount > 0 && idx < playoffCount;
                            const isPromotionSpot = promotionCount > 0 && idx < promotionCount;
                            const isBottom = relegatedTeamIds !== undefined && relegatedTeamIds.has(team.id);
                            const isUserTeam = userTeam?.id === team.id;
                            const pointsPct = totalPoints > 0 ? Math.max(4, Math.round((team.points / Math.max(...conferenceTeams.map(t => t.points), 1)) * 100)) : 0;

                            // Row background
                            let bgClass = 'hover:bg-white/[0.045]';
                            if (isUserTeam) bgClass = 'bg-[var(--volt)]/[0.09] hover:bg-[var(--volt)]/[0.14]';
                            else if (isBottom) bgClass = 'hover:bg-[var(--loss)]/[0.06]';

                            // Left rail color
                            let railColor = 'transparent';
                            if (isUserTeam) railColor = 'var(--volt)';
                            else if (isPromotionSpot) railColor = 'rgba(34,197,94,0.65)';
                            else if (isPlayoffSpot) railColor = 'rgba(250,204,21,0.50)';
                            else if (isBottom) railColor = 'rgba(239,68,68,0.65)';

                            return (
                                <div key={team.id}
                                    className={`group relative ${idx < total - 1 ? 'border-b border-white/[0.04]' : ''}`}>
                                    {/* Relegation hazard stripe */}
                                    {isBottom && !isUserTeam && (
                                        <div className="absolute inset-0 opacity-[0.08] pointer-events-none"
                                            style={{ backgroundImage: 'repeating-linear-gradient(135deg, var(--loss) 0 6px, transparent 6px 14px)' }} />
                                    )}
                                    {/* User-team holographic sweep on hover */}
                                    {isUserTeam && (
                                        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-[900ms] ease-out pointer-events-none"
                                            style={{ background: 'linear-gradient(110deg, transparent 40%, rgba(250,204,21,0.08) 50%, transparent 60%)' }} />
                                    )}

                                    <div
                                        className={`relative grid grid-cols-[auto_1fr_44px_44px_44px_70px] md:grid-cols-[auto_1fr_52px_52px_52px_88px] gap-2 md:gap-3 px-3 md:px-6 py-3 md:py-3.5 items-center transition-colors min-w-fit border-l-[3px] ${isHistorical ? '' : 'cursor-pointer'} ${bgClass}`}
                                        style={{ borderLeftColor: railColor }}
                                        onClick={isHistorical ? undefined : () => setSelectedTeam({ ...team, rank: idx + 1 })}
                                    >
                                        {/* Rank */}
                                        <div className="w-6 md:w-8 flex items-center justify-center">
                                            <span className={`font-display text-sm md:text-base tabular leading-none ${
                                                isUserTeam ? 'text-[var(--volt)]' :
                                                isPromotionSpot ? 'text-[var(--win)]/85' :
                                                isPlayoffSpot ? 'text-[var(--volt)]/65' :
                                                isBottom ? 'text-[var(--loss)]/70' :
                                                'text-[var(--ink-500)]'
                                            }`}>{idx + 1}</span>
                                        </div>

                                        {/* Team */}
                                        <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
                                            <TeamLogo teamId={team.id} size={28} />
                                            <div className="flex flex-col min-w-0">
                                                <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
                                                    <span className={`font-semibold text-xs md:text-sm truncate ${
                                                        isUserTeam ? 'text-[var(--volt)] font-bold tracking-wide' :
                                                        isBottom ? 'text-[var(--loss)]/80' :
                                                        'text-[var(--bone)]'
                                                    }`}>{team.team_name}</span>
                                                    <CountryFlag country={team.country} />
                                                </div>
                                                {isUserTeam && (
                                                    <span className="font-mono text-[8px] font-black uppercase tracking-[0.28em] px-1 py-[1px] rounded-[2px] bg-[var(--volt)] text-[var(--ink-950)] mt-0.5 self-start">
                                                        My Club
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <span className="text-center font-mono text-xs md:text-sm text-[var(--ink-400)] tabular">{team.played}</span>
                                        <span className="text-center font-mono text-xs md:text-sm text-[var(--win)] font-bold tabular">{team.won}</span>
                                        <span className="text-center font-mono text-xs md:text-sm text-[var(--loss)] font-bold tabular">{team.lost}</span>

                                        {/* Points cell — bar + value */}
                                        <div className="flex items-center justify-end gap-1.5 md:gap-2">
                                            <div className="hidden md:block w-10 h-[3px] bg-white/[0.05] rounded-full overflow-hidden">
                                                <div className="h-full rounded-full" style={{
                                                    width: `${pointsPct}%`,
                                                    background: isUserTeam ? 'var(--volt)' : isBottom ? 'var(--loss)' : accent,
                                                }} />
                                            </div>
                                            <span className={`font-display text-lg md:text-2xl tabular leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)] ${
                                                isUserTeam ? 'text-[var(--volt)]' :
                                                team.points > 0 ? 'text-[var(--bone)]' :
                                                'text-[var(--ink-500)]'
                                            }`}>{team.points}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Legend */}
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 md:px-6 py-3 border-t border-white/[0.04] bg-[var(--ink-950)]/30">
                            {promotionCount > 0 && (
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-[2px] bg-[var(--win)]/75" />
                                    <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--ink-400)]">Top {promotionCount} · Promotion</span>
                                </div>
                            )}
                            {playoffCount > 0 && (
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-[2px] bg-[var(--volt)]/65" />
                                    <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--ink-400)]">Top {playoffCount} · Playoff</span>
                                </div>
                            )}
                            {relegatedTeamIds !== undefined && relegatedTeamIds.size > 0 && (
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-[2px] bg-[var(--loss)]/65" />
                                <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--ink-400)]">Relegation</span>
                            </div>
                            )}
                            {userTeam && conferenceTeams.some(t => t.id === userTeam.id) && (
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-[2px] bg-[var(--volt)]" />
                                    <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--volt)] font-bold">My Club</span>
                                </div>
                            )}
                            <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--ink-600)] tabular">{total} clubs</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Global stats for the header strip
    const totalCountries = countriesWithLeagues.length;
    const userTeamRow = userTeam ? effectiveTeams.find(t => t.id === userTeam.id) : null;
    const userLeagueTeams = userTeamRow
        ? effectiveTeams.filter(t => t.league_id === userTeamRow.league_id)
            .sort((a, b) => b.points - a.points || b.score_diff - a.score_diff || (b.sets_won - b.sets_lost) - (a.sets_won - a.sets_lost))
        : [];
    const userRank = userTeamRow ? userLeagueTeams.findIndex(t => t.id === userTeamRow.id) + 1 : 0;

    return (
        <div className="space-y-6 animate-fade-up">
            {/* ── HERO HEADER ──────────────────────────────────────────────── */}
            <div className="relative overflow-hidden rounded-lg border border-white/[0.06] bg-gradient-to-br from-[var(--ink-900)] via-[var(--ink-950)] to-[var(--ink-950)]">
                {/* Atmosphere */}
                <div className="absolute -top-20 -left-12 w-72 h-72 rounded-full bg-[var(--volt)]/12 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-20 right-1/4 w-72 h-72 rounded-full bg-[var(--epic)]/8 blur-3xl pointer-events-none" />
                {/* Grid texture */}
                <div className="absolute inset-0 opacity-[0.035] pointer-events-none"
                    style={{
                        backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
                        backgroundSize: '32px 32px',
                    }} />
                {/* Top stripe */}
                <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-[var(--volt)] via-[var(--volt)]/40 to-transparent" />
                <div className="absolute top-0 left-32 w-20 h-1.5 bg-[var(--ink-950)]" />

                <div className="relative px-6 md:px-8 py-6 md:py-7 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-end">
                    {/* Title block */}
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-2.5">
                            <Trophy size={12} className="text-[var(--volt)]" />
                            <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.32em] text-[var(--volt)]">League · Tournament Table</p>
                        </div>
                        <h1 className="font-display text-5xl md:text-6xl tracking-[0.015em] text-[var(--bone)] leading-[0.85]">
                            LEAGUE <span className="text-[var(--volt)]">STANDINGS</span>
                        </h1>
                        <p className="font-mono text-[10.5px] text-[var(--ink-400)] mt-3.5 uppercase tracking-[0.22em]">
                            {isHistorical
                                ? `Archive · Final standings from the ${selectedYear} season`
                                : 'Live competition tables across every active league'}
                        </p>
                    </div>

                    {/* Metric strip */}
                    <div className="grid grid-cols-3 gap-2.5 lg:gap-3 lg:min-w-[420px]">
                        {[
                            { label: 'Clubs', val: effectiveTeams.length, icon: Users, color: 'var(--volt)' },
                            { label: 'Leagues', val: leagues.length, icon: Award, color: 'var(--info)' },
                            { label: 'Nations', val: totalCountries, icon: Globe, color: 'var(--epic)' },
                        ].map((m) => (
                            <div key={m.label} className="relative px-3 py-2.5 rounded-md bg-black/40 border border-white/[0.06] backdrop-blur-sm overflow-hidden">
                                <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: m.color, opacity: 0.65 }} />
                                <div className="flex items-center justify-between mb-1">
                                    <p className="font-mono text-[8.5px] uppercase tracking-[0.28em] font-black" style={{ color: m.color }}>{m.label}</p>
                                    <m.icon size={11} style={{ color: m.color, opacity: 0.55 }} />
                                </div>
                                <p className="font-display text-2xl tabular leading-none" style={{ color: m.color }}>{m.val}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Season selector ribbon — live + archived past seasons */}
                <div className="relative px-6 md:px-8 py-3 border-t border-white/[0.05] bg-black/30 flex items-center gap-2 flex-wrap">
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
                    {availableYears.length === 0 && (
                        <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--ink-600)] italic">
                            No archived seasons yet
                        </span>
                    )}
                    {availableYears.map(y => {
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
                    {loadingHistory && (
                        <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-[var(--ink-500)] ml-1">
                            loading…
                        </span>
                    )}
                    {isHistorical && (
                        <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.24em] text-[var(--epic)] font-black">
                            Read-only archive
                        </span>
                    )}
                </div>

                {/* User team rank ribbon */}
                {userTeam && userTeamRow && userRank > 0 && (
                    <div className="relative px-6 md:px-8 py-3 border-t border-white/[0.05] bg-[var(--volt)]/[0.04] flex items-center gap-3 flex-wrap">
                        <span className="w-1 h-5 bg-[var(--volt)]" />
                        <TeamLogo teamId={userTeam.id} size={24} />
                        <span className="font-mono text-[9.5px] uppercase tracking-[0.28em] text-[var(--ink-400)] font-bold">Your Club</span>
                        <span className="font-display text-base tracking-wide text-[var(--bone)]">{userTeamRow.team_name.toUpperCase()}</span>
                        <span className="font-mono text-[9px] text-[var(--ink-600)]">·</span>
                        <span className={`font-mono text-[10.5px] font-black uppercase tracking-[0.22em] tabular ${
                            userRank === 1 ? 'text-yellow-300' :
                            userRank <= 3 ? 'text-[var(--bone)]' :
                            userRank <= 4 ? 'text-[var(--volt)]' :
                            userRank === userLeagueTeams.length ? 'text-[var(--loss)]' :
                            'text-[var(--ink-300)]'
                        }`}>
                            #{userRank} / {userLeagueTeams.length}
                        </span>
                        <span className="font-mono text-[9px] text-[var(--ink-600)]">·</span>
                        <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] tabular">
                            <span className="text-[var(--volt)] font-bold">{userTeamRow.points}</span>
                            <span className="text-[var(--ink-500)] ml-1">PTS</span>
                        </span>
                        <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.24em] text-[var(--ink-500)]">
                            {userTeamRow.won}W · {userTeamRow.lost}L
                        </span>
                    </div>
                )}
            </div>

            {/* Country groups */}
            <div className="space-y-4">
                {countriesWithLeagues.map(({ country, leagues: countryLeagues }) => {
                    const isExpanded = expandedCountries.has(country);
                    const selectedLeagueId = selectedLeagueByCountry[country] ?? countryLeagues[0]?.id ?? null;
                    const selectedLeague = countryLeagues.find(l => l.id === selectedLeagueId) ?? countryLeagues[0];
                    const leagueTeams = effectiveTeams
                        .filter(t => t.league_id === selectedLeagueId)
                        .sort((a, b) => b.points - a.points || b.score_diff - a.score_diff || (b.sets_won - b.sets_lost) - (a.sets_won - a.sets_lost));

                    const isMultiConference = (selectedLeague as League)?.format_type === 'multi_conference';
                    const northTeams = isMultiConference ? leagueTeams.filter(t => (t.region ?? 'north') === 'north') : [];
                    const southTeams = isMultiConference ? leagueTeams.filter(t => t.region === 'south') : [];
                    const hasTwoConf = isMultiConference && northTeams.length > 0 && southTeams.length > 0;

                    const countryCode = country.length > 2 ? getCountryCode(country) : country.toLowerCase();

                    const countryTeamCount = effectiveTeams.filter(t => countryLeagues.some(l => l.id === t.league_id)).length;
                    const hasUserClubInCountry = !!(userTeam && countryLeagues.some(l => l.id === userTeam.league_id));

                    return (
                        <div key={country} className={`relative rounded-lg overflow-hidden border transition-colors ${
                            hasUserClubInCountry
                                ? 'border-[var(--volt)]/35 bg-[var(--volt)]/[0.025]'
                                : 'border-white/[0.06] bg-[var(--ink-900)]/40'
                        }`}>
                            {/* Country header */}
                            <button
                                onClick={() => toggleCountry(country)}
                                className="group relative w-full flex items-center gap-4 px-5 py-4 hover:bg-white/[0.025] transition-colors cursor-pointer overflow-hidden"
                            >
                                {/* Ghosted flag backdrop on the right */}
                                <div className="absolute right-0 top-0 bottom-0 w-44 opacity-[0.07] pointer-events-none"
                                    style={{
                                        backgroundImage: `url(/assets/flags/${countryCode}.svg)`,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                        maskImage: 'linear-gradient(to left, black 0%, transparent 100%)',
                                        WebkitMaskImage: 'linear-gradient(to left, black 0%, transparent 100%)',
                                    }} />

                                {/* Live flag plaque */}
                                <div className={`relative w-12 h-8 rounded-sm overflow-hidden shrink-0 ring-1 shadow-md ${hasUserClubInCountry ? 'ring-[var(--volt)]/40' : 'ring-white/10'}`}>
                                    <img src={`/assets/flags/${countryCode}.svg`} alt={country}
                                        className="w-full h-full object-cover"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                </div>

                                {/* Title cluster */}
                                <div className="relative flex-1 min-w-0 text-left">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <Globe size={10} className="text-[var(--ink-500)]" />
                                        <span className="font-mono text-[8.5px] uppercase tracking-[0.3em] text-[var(--ink-500)] font-bold">Nation</span>
                                        {hasUserClubInCountry && (
                                            <span className="font-mono text-[8px] font-black uppercase tracking-[0.28em] px-1 py-[1px] rounded-[2px] bg-[var(--volt)] text-[var(--ink-950)]">
                                                Home
                                            </span>
                                        )}
                                    </div>
                                    <span className="block font-display text-lg md:text-xl tracking-[0.05em] text-[var(--bone)] leading-none truncate">
                                        {country.toUpperCase()}
                                    </span>
                                </div>

                                {/* Right meta */}
                                <div className="relative flex items-center gap-2 shrink-0">
                                    <div className="hidden sm:flex flex-col items-end">
                                        <span className="font-mono text-[8.5px] uppercase tracking-[0.28em] text-[var(--ink-500)] font-black">Leagues</span>
                                        <span className="font-display text-base text-[var(--bone)] tabular leading-none mt-0.5">{countryLeagues.length}</span>
                                    </div>
                                    <span className="hidden sm:block w-px h-7 bg-white/[0.08]" />
                                    <div className="hidden sm:flex flex-col items-end">
                                        <span className="font-mono text-[8.5px] uppercase tracking-[0.28em] text-[var(--ink-500)] font-black">Clubs</span>
                                        <span className="font-display text-base text-[var(--bone)] tabular leading-none mt-0.5">{countryTeamCount}</span>
                                    </div>
                                    <div className={`w-7 h-7 ml-1.5 rounded-sm flex items-center justify-center border transition-all ${
                                        isExpanded ? 'bg-[var(--volt)]/15 border-[var(--volt)]/40 text-[var(--volt)]' : 'bg-white/[0.04] border-white/[0.08] text-[var(--ink-400)] group-hover:text-[var(--volt)] group-hover:border-[var(--volt)]/30'
                                    }`}>
                                        <ChevronDown size={13} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                    </div>
                                </div>
                            </button>

                            {isExpanded && (
                                <div className="relative border-t border-white/[0.05] bg-[var(--ink-950)]/30">
                                    {/* League switcher — tactical chips */}
                                    {countryLeagues.length > 1 && (
                                        <div className="flex items-center gap-2 flex-wrap px-5 pt-4 pb-1">
                                            <span className="font-mono text-[8.5px] uppercase tracking-[0.3em] text-[var(--ink-500)] font-black mr-1">Tier</span>
                                            {countryLeagues.map(l => {
                                                const isSel = l.id === selectedLeagueId;
                                                const isUserLeague = userTeam?.league_id === l.id;
                                                return (
                                                    <button key={l.id}
                                                        onClick={() => setSelectedLeagueByCountry(prev => ({ ...prev, [country]: l.id }))}
                                                        className={`group/chip relative px-3 py-1.5 rounded-sm font-mono text-[10.5px] font-black uppercase tracking-[0.18em] transition-all cursor-pointer overflow-hidden ${
                                                            isSel
                                                                ? 'bg-[var(--volt)] text-[var(--ink-950)] shadow-[0_3px_0_0_rgba(0,0,0,0.4)]'
                                                                : 'bg-white/[0.04] text-[var(--ink-300)] hover:text-[var(--bone)] border border-white/[0.08] hover:border-white/15'
                                                        }`}
                                                    >
                                                        <span className="relative flex items-center gap-1.5">
                                                            {isUserLeague && <span className={`w-1.5 h-1.5 rounded-full ${isSel ? 'bg-[var(--ink-950)]' : 'bg-[var(--volt)]'}`} />}
                                                            {l.league_name}
                                                            {(l as any).tier && <span className={`text-[8px] opacity-70 ml-0.5`}>T{(l as any).tier}</span>}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Overall/Conference toggle — segmented */}
                                    {hasTwoConf && (
                                        <div className="flex items-center gap-2 px-5 pt-3 pb-1">
                                            <span className="font-mono text-[8.5px] uppercase tracking-[0.3em] text-[var(--ink-500)] font-black mr-1">View</span>
                                            <div className="inline-flex gap-1 bg-black/40 border border-white/[0.06] rounded-sm p-1">
                                                <button onClick={() => setShowConference(false)}
                                                    className={`px-3 py-1 rounded-[2px] font-mono text-[10px] font-black uppercase tracking-[0.2em] transition-colors cursor-pointer ${!showConference ? 'bg-[var(--volt)] text-[var(--ink-950)]' : 'text-[var(--ink-400)] hover:text-[var(--bone)]'}`}>
                                                    Overall
                                                </button>
                                                <button onClick={() => setShowConference(true)}
                                                    className={`px-3 py-1 rounded-[2px] font-mono text-[10px] font-black uppercase tracking-[0.2em] transition-colors cursor-pointer ${showConference ? 'bg-[var(--epic)] text-black' : 'text-[var(--ink-400)] hover:text-[var(--bone)]'}`}>
                                                    Split by Conf
                                                </button>
                                            </div>
                                            <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--ink-500)] ml-2 hidden sm:inline">
                                                <span className="text-[var(--info)] font-bold">North {northTeams.length}</span>
                                                <span className="text-[var(--ink-700)] mx-1.5">/</span>
                                                <span className="text-[var(--epic)] font-bold">South {southTeams.length}</span>
                                            </span>
                                        </div>
                                    )}

                                    {/* Standings table(s) */}
                                    <div className="p-4 pt-3 md:p-5 md:pt-3">
                                        {(() => {
                                            const sel = selectedLeague as League | undefined;
                                            const playoffCount = sel?.playoff_teams ?? 0;
                                            const promotionCount = sel?.promotion_count ?? 0;
                                            const relegationCount = sel?.relegation_count ?? 0;
                                            // For multi-conference, relegate last N of each conference (N = relegation_count / 2)
                                            // For single-table, relegate last N of the whole table.
                                            if (hasTwoConf && showConference) {
                                                const perConfRel = Math.max(1, Math.floor(relegationCount / 2));
                                                const northRel = relegationCount > 0
                                                    ? new Set(northTeams.slice(-perConfRel).map(t => t.id))
                                                    : new Set<number>();
                                                const southRel = relegationCount > 0
                                                    ? new Set(southTeams.slice(-perConfRel).map(t => t.id))
                                                    : new Set<number>();
                                                return (
                                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 xl:gap-8">
                                                        <StandingsTable conferenceTeams={northTeams} title="North Conference" accentColor="sky"
                                                            playoffCount={playoffCount} promotionCount={promotionCount} relegatedTeamIds={northRel} />
                                                        <StandingsTable conferenceTeams={southTeams} title="South Conference" accentColor="violet"
                                                            playoffCount={playoffCount} promotionCount={promotionCount} relegatedTeamIds={southRel} />
                                                    </div>
                                                );
                                            }
                                            if (hasTwoConf) {
                                                const perConfRel = relegationCount > 0 ? Math.max(1, Math.floor(relegationCount / 2)) : 0;
                                                const relIds = new Set<number>([
                                                    ...(perConfRel > 0 ? northTeams.slice(-perConfRel).map(t => t.id) : []),
                                                    ...(perConfRel > 0 ? southTeams.slice(-perConfRel).map(t => t.id) : []),
                                                ]);
                                                return (
                                                    <StandingsTable
                                                        conferenceTeams={leagueTeams}
                                                        title={selectedLeague?.league_name ?? 'Standings'}
                                                        playoffCount={playoffCount}
                                                        promotionCount={promotionCount}
                                                        relegatedTeamIds={relIds}
                                                    />
                                                );
                                            }
                                            const relIds = relegationCount > 0
                                                ? new Set(leagueTeams.slice(-relegationCount).map(t => t.id))
                                                : new Set<number>();
                                            return (
                                                <StandingsTable
                                                    conferenceTeams={leagueTeams}
                                                    title={selectedLeague?.league_name ?? 'Standings'}
                                                    playoffCount={playoffCount}
                                                    promotionCount={promotionCount}
                                                    relegatedTeamIds={relIds}
                                                />
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {selectedTeam && (
                <TeamDetailsModal
                    team={selectedTeam}
                    onClose={() => setSelectedTeam(null)}
                    onPlayerClick={(p) => setSelectedPlayer(p)}
                />
            )}

            {selectedPlayer && (
                <PlayerModal
                    player={selectedPlayer as any}
                    onClose={() => setSelectedPlayer(null)}
                />
            )}
        </div>
    );
}

// ─── Team Details Modal ───────────────────────────────────────────────────────

function TeamDetailsModal({ team, onClose, onPlayerClick }: {
    team: TeamWithRank;
    onClose: () => void;
    onPlayerClick: (p: Player) => void;
}) {
    const [players, setPlayers] = useState<Player[]>([]);
    const [fixtures, setFixtures] = useState<Fixture[]>([]);
    const [loading, setLoading] = useState(true);
    const [summaryFixtureId, setSummaryFixtureId] = useState<number | null>(null);

    useEffect(() => {
        setLoading(true);
        Promise.all([
            fetch(`/api/players?teamId=${team.id}`).then(r => r.json()),
            fetch(`/api/fixtures?teamId=${team.id}&status=completed&currentSeasonOnly=true`).then(r => r.json()),
        ]).then(([playerData, fixtureData]) => {
            setPlayers(playerData);
            const sorted = (Array.isArray(fixtureData) ? fixtureData as Fixture[] : [])
                .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));
            setFixtures(sorted);
            setLoading(false);
        });
    }, [team.id]);

    const formatMoney = (n: number) => n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}K`;
    const setDiff = team.sets_won - team.sets_lost;

    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);
    if (!mounted) return null;

    // Form string from the last 5 matches (oldest → newest reading order: W L W L W)
    const form = (() => {
        const last5 = [...fixtures].slice(0, 5).reverse();
        return last5.map(f => {
            const isHome = f.home_team_id === team.id;
            const ts = isHome ? f.home_sets : f.away_sets;
            const os = isHome ? f.away_sets : f.home_sets;
            if (ts === null || os === null) return 'D';
            return ts > os ? 'W' : 'L';
        });
    })();
    const winRate = team.played > 0 ? Math.round((team.won / team.played) * 100) : 0;
    const setsForRate = team.sets_won + team.sets_lost > 0
        ? Math.round((team.sets_won / (team.sets_won + team.sets_lost)) * 100)
        : 0;

    const avgOverall = players.length > 0
        ? Math.round(players.reduce((s, p) => s + p.overall, 0) / players.length)
        : 0;

    return createPortal((
        <>
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)' }}
            onClick={onClose}>
            <div className="relative w-full max-w-5xl max-h-[92vh] rounded-lg overflow-hidden surface-raised flex flex-col animate-fade-up"
                onClick={e => e.stopPropagation()}>

                {/* Top accent stripe */}
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[var(--volt)] via-[var(--volt-bright,var(--volt))] to-transparent z-30" />
                {/* Notch like trading cards */}
                <div className="absolute top-0 left-24 w-24 h-1.5 bg-[var(--ink-950)] z-30" />

                {/* ── HERO ─────────────────────────────────────────────────────── */}
                <div className="relative shrink-0 overflow-hidden">
                    {/* Background atmosphere */}
                    <div className="absolute inset-0 bg-gradient-to-br from-[var(--volt)]/[0.07] via-transparent to-transparent" />
                    <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-[var(--volt)]/12 blur-3xl" />
                    <div className="absolute -bottom-32 left-1/3 w-72 h-72 rounded-full bg-[var(--epic)]/8 blur-3xl" />
                    {/* Grid overlay */}
                    <div className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay"
                        style={{
                            backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
                            backgroundSize: '28px 28px',
                        }} />
                    {/* Ghosted oversized logo backdrop */}
                    <div className="absolute -right-10 -top-6 w-[300px] h-[300px] opacity-[0.06] pointer-events-none">
                        <Image src={`/api/team-badge/${team.id}`} alt="" fill unoptimized className="object-contain"
                            onError={(e) => { (e.target as HTMLImageElement).src = '/assets/teams/default.png'; }} />
                    </div>

                    {/* Close */}
                    <button onClick={onClose}
                        className="absolute top-5 right-5 w-10 h-10 rounded-md bg-black/50 backdrop-blur-md border border-white/[0.10] flex items-center justify-center text-[var(--ink-300)] hover:text-[var(--volt)] hover:border-[var(--volt)]/50 transition-all cursor-pointer z-30">
                        <X size={16} />
                    </button>

                    <div className="relative px-8 pt-9 pb-7">
                        <div className="flex flex-col md:flex-row md:items-end gap-7">
                            {/* Logo plaque */}
                            <div className="relative shrink-0">
                                <div className="absolute -inset-2 bg-[var(--volt)]/15 blur-xl rounded-lg" />
                                <div className="relative w-32 h-32 md:w-36 md:h-36 rounded-md bg-gradient-to-br from-white/[0.06] to-white/[0.01] border border-white/[0.10] p-4 flex items-center justify-center overflow-hidden shadow-[0_20px_50px_-15px_rgba(0,0,0,0.7)]">
                                    <Image src={`/api/team-badge/${team.id}`} alt={team.team_name} fill unoptimized
                                        className="object-contain p-5"
                                        onError={(e) => { (e.target as HTMLImageElement).src = '/assets/teams/default.png'; }} />
                                    {/* corner ticks */}
                                    <span className="absolute top-1 left-1 w-2 h-2 border-t border-l border-[var(--volt)]/60" />
                                    <span className="absolute top-1 right-1 w-2 h-2 border-t border-r border-[var(--volt)]/60" />
                                    <span className="absolute bottom-1 left-1 w-2 h-2 border-b border-l border-[var(--volt)]/60" />
                                    <span className="absolute bottom-1 right-1 w-2 h-2 border-b border-r border-[var(--volt)]/60" />
                                </div>
                                {/* Rank plaque */}
                                <div className="absolute -top-4 -right-4 min-w-[60px] h-12 px-2.5 rounded-md bg-[var(--volt)] border-2 border-[var(--ink-950)] flex flex-col items-center justify-center text-[var(--ink-950)] shadow-[0_8px_20px_rgba(0,0,0,0.5)]">
                                    <span className="font-mono text-[7.5px] font-black uppercase tracking-[0.22em] leading-none">Rank</span>
                                    <span className="font-display text-xl tracking-wider leading-none tabular mt-0.5">#{team.rank}</span>
                                </div>
                            </div>

                            {/* Identity */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2.5">
                                    <span className="w-1 h-3 bg-[var(--volt)]" />
                                    <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.32em] text-[var(--volt)]">Franchise Dossier</p>
                                </div>
                                <div className="flex items-end gap-3 flex-wrap">
                                    <h2 className="font-display text-4xl md:text-5xl tracking-[0.015em] text-[var(--bone)] leading-[0.9]">
                                        {team.team_name.toUpperCase()}
                                    </h2>
                                    <img src={`/assets/flags/${team.country?.length === 2 ? team.country.toLowerCase() : getCountryCode(team.country || 'un')}.svg`}
                                        alt="Flag" className="w-9 h-6 rounded-sm shadow-md ring-1 ring-white/15 object-cover" />
                                </div>

                                {/* Quick chips */}
                                <div className="flex flex-wrap items-center gap-2 mt-4">
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-white/[0.04] border border-white/[0.08]">
                                        <MapPin size={11} className="text-[var(--volt)]" />
                                        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-300)]">{team.stadium || 'Unknown Stadium'}</span>
                                    </div>
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-white/[0.04] border border-white/[0.08]">
                                        <Calendar size={11} className="text-[var(--volt)]" />
                                        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-300)] tabular">Founded {team.founded || '—'}</span>
                                    </div>
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-[var(--volt)]/12 border border-[var(--volt)]/30">
                                        <Trophy size={11} className="text-[var(--volt)]" />
                                        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--volt)] font-bold tabular">{team.points} PTS</span>
                                    </div>
                                    {team.team_money !== undefined && (
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-[var(--money)]/12 border border-[var(--money)]/25">
                                            <DollarSign size={11} className="text-[var(--money)]" />
                                            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--money)] font-bold tabular">{formatMoney(team.team_money)}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Form ribbon */}
                                {form.length > 0 && (
                                    <div className="mt-4 flex items-center gap-3">
                                        <span className="font-mono text-[8.5px] font-black uppercase tracking-[0.3em] text-[var(--ink-500)]">Last 5</span>
                                        <div className="flex gap-1">
                                            {form.map((r, i) => (
                                                <span key={i}
                                                    className={`w-6 h-6 flex items-center justify-center rounded-sm font-display text-xs tabular tracking-wider ${
                                                        r === 'W' ? 'bg-[var(--win)]/20 text-[var(--win)] ring-1 ring-[var(--win)]/35'
                                                        : r === 'L' ? 'bg-[var(--loss)]/20 text-[var(--loss)] ring-1 ring-[var(--loss)]/35'
                                                        : 'bg-white/[0.05] text-[var(--ink-400)] ring-1 ring-white/10'
                                                    }`}>{r}</span>
                                            ))}
                                            {Array.from({ length: 5 - form.length }).map((_, i) => (
                                                <span key={`e${i}`} className="w-6 h-6 rounded-sm border border-dashed border-white/[0.08]" />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── STATS STRIP ──────────────────────────────────────────────── */}
                <div className="relative grid grid-cols-3 md:grid-cols-6 border-y border-white/[0.06] shrink-0 bg-[var(--ink-950)]/60">
                    {[
                        { label: 'Played',   val: team.played,                                  icon: Gamepad2,    color: 'var(--info)' },
                        { label: 'Won',      val: team.won,                                     icon: TrendingUp,  color: 'var(--win)' },
                        { label: 'Lost',     val: team.lost,                                    icon: TrendingDown,color: 'var(--loss)' },
                        { label: 'Win %',    val: `${winRate}%`,                                icon: BarChart2,   color: winRate >= 60 ? 'var(--win)' : winRate >= 40 ? 'var(--volt)' : 'var(--loss)' },
                        { label: 'Set Diff', val: setDiff > 0 ? `+${setDiff}` : `${setDiff}`,   icon: Swords,      color: setDiff > 0 ? 'var(--win)' : setDiff < 0 ? 'var(--loss)' : 'var(--ink-400)' },
                        { label: 'Points',   val: team.points,                                  icon: Trophy,      color: 'var(--volt)' },
                    ].map((s, i) => (
                        <div key={s.label}
                            className="relative px-4 py-4 border-r border-white/[0.05] last:border-0 overflow-hidden group">
                            <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: s.color, opacity: 0.55 }} />
                            <div className="flex items-center justify-between mb-1">
                                <p className="font-mono text-[8.5px] uppercase tracking-[0.3em] font-black" style={{ color: s.color }}>{s.label}</p>
                                <s.icon size={13} style={{ color: s.color, opacity: 0.45 }} />
                            </div>
                            <p className="font-display text-3xl tabular leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]" style={{ color: s.color }}>{s.val}</p>
                        </div>
                    ))}
                </div>

                {/* Secondary metrics row */}
                <div className="grid grid-cols-3 border-b border-white/[0.06] shrink-0 bg-[var(--ink-900)]/40">
                    {[
                        { label: 'Sets Won',  val: team.sets_won,   accent: 'text-[var(--win)]' },
                        { label: 'Sets Lost', val: team.sets_lost,  accent: 'text-[var(--loss)]' },
                        { label: 'Set Win %', val: `${setsForRate}%`, accent: 'text-[var(--volt)]' },
                    ].map(s => (
                        <div key={s.label} className="px-4 py-2.5 border-r border-white/[0.04] last:border-0 flex items-baseline justify-between">
                            <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-[var(--ink-500)]">{s.label}</span>
                            <span className={`font-display text-base tabular leading-none ${s.accent}`}>{s.val}</span>
                        </div>
                    ))}
                </div>

                {/* ── BODY — Roster + Match History ──────────────────────────────── */}
                {loading ? (
                    <div className="flex-1 flex items-center justify-center py-16">
                        <div className="text-center space-y-3">
                            <div className="w-10 h-10 mx-auto rounded-full border-2 border-[var(--volt)] border-t-transparent animate-spin" />
                            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--ink-500)]">Retrieving Club Data</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-white/5">

                        {/* ── ACTIVE ROSTER ── */}
                        <div className="flex flex-col overflow-hidden min-h-[300px]">
                            <div className="flex items-center justify-between px-6 pt-5 pb-3 shrink-0 border-b border-white/[0.04]">
                                <div className="flex items-center gap-2.5">
                                    <span className="w-1 h-5 bg-[var(--volt)]" />
                                    <Users size={14} className="text-[var(--volt)]" />
                                    <h3 className="font-display text-lg tracking-[0.06em] text-[var(--bone)]">ACTIVE ROSTER</h3>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-mono text-[9.5px] text-[var(--ink-500)] uppercase tracking-[0.22em] font-bold">
                                        {players.length} <span className="text-[var(--ink-600)]">·</span> AVG <span className="text-[var(--volt)] tabular">{avgOverall || '—'}</span>
                                    </span>
                                </div>
                            </div>
                            <div className="overflow-y-auto px-4 pb-5 pt-3 flex flex-col gap-1.5">
                                {[...players].sort((a, b) => b.overall - a.overall).map((p) => {
                                    const pt = posTheme(p.position);
                                    const tier = ovrTier(p.overall);
                                    return (
                                        <div key={p.id}
                                            onClick={() => onPlayerClick(p)}
                                            className={`group relative flex items-center gap-3 pl-3.5 pr-3 py-2.5 rounded-md bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.15] transition-all duration-200 cursor-pointer shrink-0 ring-1 ring-transparent hover:${tier.ring} overflow-hidden`}>
                                            {/* Position rail */}
                                            <span className={`absolute left-0 top-1 bottom-1 w-[3px] ${pt.rail}`} />
                                            {/* Holographic sweep on hover */}
                                            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-[900ms] ease-out pointer-events-none"
                                                style={{ background: 'linear-gradient(110deg, transparent 40%, rgba(255,255,255,0.06) 50%, transparent 60%)' }} />

                                            {/* Avatar */}
                                            <div className="relative shrink-0 z-10">
                                                <div className={`absolute -inset-1 rounded-md ${pt.halo} blur-md opacity-50 group-hover:opacity-80 transition-opacity`} />
                                                <div className="relative w-11 h-14 rounded-sm bg-[var(--ink-900)] overflow-hidden border border-white/[0.08]">
                                                    <Image src={`/assets/players/${p.id}.png`} alt={p.player_name} fill unoptimized className="object-contain object-bottom"
                                                        onError={(e) => { (e.target as HTMLImageElement).src = '/assets/players/default.png'; }} />
                                                </div>
                                            </div>

                                            {/* OVR plate */}
                                            <div className="relative shrink-0 flex flex-col items-center z-10">
                                                <span className={`font-display text-2xl ${tier.text} tabular leading-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)]`}>{p.overall}</span>
                                                <span className={`mt-0.5 px-1 py-[1px] rounded-[2px] font-mono text-[7.5px] font-black tracking-[0.18em] ${pt.chip}`}>{posAbbr(p.position)}</span>
                                            </div>

                                            {/* Identity */}
                                            <div className="min-w-0 flex-1 z-10">
                                                <p className="text-sm font-bold text-[var(--bone)] truncate leading-tight tracking-wide group-hover:text-[var(--volt)] transition-colors">{p.player_name.toUpperCase()}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <div className="w-[22px] h-[14px] rounded-[2px] overflow-hidden shrink-0 ring-1 ring-white/10">
                                                        <img src={`/assets/flags/${p.country.length === 2 ? p.country.toLowerCase() : getCountryCode(p.country)}.svg`} alt="Flag" className="w-full h-full object-cover"
                                                            onError={(e) => { (e.target as HTMLImageElement).parentElement?.classList.add('hidden'); }} />
                                                    </div>
                                                    <p className={`font-mono text-[9.5px] uppercase tracking-[0.2em] font-bold truncate ${pt.text}`}>{p.position}</p>
                                                    <span className="font-mono text-[8.5px] text-[var(--ink-600)] tracking-[0.18em] font-bold">{tier.label}</span>
                                                </div>
                                            </div>

                                            <ChevronDown size={12} className="rotate-[-90deg] text-[var(--ink-600)] group-hover:text-[var(--volt)] transition-colors z-10" />
                                        </div>
                                    );
                                })}
                                {players.length === 0 && (
                                    <div className="flex items-center justify-center py-12 rounded bg-white/[0.02] border border-white/[0.05]">
                                        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--ink-500)]">No players signed</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── MATCH HISTORY ── */}
                        <div className="flex flex-col overflow-hidden min-h-[300px]">
                            <div className="flex items-center justify-between px-6 pt-5 pb-3 shrink-0 border-b border-white/[0.04]">
                                <div className="flex items-center gap-2.5">
                                    <span className="w-1 h-5 bg-[var(--volt)]" />
                                    <Swords size={14} className="text-[var(--volt)]" />
                                    <h3 className="font-display text-lg tracking-[0.06em] text-[var(--bone)]">MATCH HISTORY</h3>
                                </div>
                                <span className="font-mono text-[9.5px] text-[var(--ink-500)] uppercase tracking-[0.22em] font-bold">
                                    {fixtures.length} <span className="text-[var(--ink-600)]">·</span> {team.won}W <span className="text-[var(--ink-600)]">/</span> {team.lost}L
                                </span>
                            </div>
                            <div className="overflow-y-auto px-4 pb-5 pt-3 flex flex-col gap-1.5">
                                {fixtures.length === 0 ? (
                                    <div className="flex items-center justify-center py-12 rounded bg-white/[0.02] border border-white/[0.05]">
                                        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--ink-500)]">No completed matches yet</p>
                                    </div>
                                ) : fixtures.map((f) => {
                                    const isHome = f.home_team_id === team.id;
                                    const teamSets = isHome ? f.home_sets : f.away_sets;
                                    const oppSets = isHome ? f.away_sets : f.home_sets;
                                    const oppName = isHome ? f.away_team_name : f.home_team_name;
                                    const oppId = isHome ? f.away_team_id : f.home_team_id;
                                    const won = teamSets !== null && oppSets !== null && teamSets > oppSets;
                                    const lost = teamSets !== null && oppSets !== null && teamSets < oppSets;
                                    const resultColor = won ? 'text-[var(--win)]' : lost ? 'text-[var(--loss)]' : 'text-[var(--ink-400)]';
                                    const resultLabel = won ? 'W' : lost ? 'L' : 'D';
                                    const railColor = won ? 'bg-[var(--win)]' : lost ? 'bg-[var(--loss)]' : 'bg-[var(--ink-500)]';
                                    const [, mm, dd] = f.scheduled_date.split('-');
                                    return (
                                        <div key={f.id}
                                            className="group relative flex items-center gap-3 pl-3.5 pr-3 py-2.5 rounded-md bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.15] transition-all duration-200 cursor-pointer shrink-0 overflow-hidden"
                                            onClick={() => setSummaryFixtureId(f.id)}
                                            title="Click to view match summary">
                                            {/* Result rail */}
                                            <span className={`absolute left-0 top-1 bottom-1 w-[3px] ${railColor}`} />
                                            {/* Sweep */}
                                            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-[900ms] ease-out pointer-events-none"
                                                style={{ background: 'linear-gradient(110deg, transparent 40%, rgba(255,255,255,0.05) 50%, transparent 60%)' }} />

                                            {/* W/L glyph */}
                                            <div className={`relative w-9 h-9 rounded-sm flex items-center justify-center font-display text-lg shrink-0 ${resultColor} ${won ? 'bg-[var(--win)]/15' : lost ? 'bg-[var(--loss)]/15' : 'bg-white/[0.05]'} ring-1 ${won ? 'ring-[var(--win)]/25' : lost ? 'ring-[var(--loss)]/25' : 'ring-white/10'} tabular`}>
                                                {resultLabel}
                                            </div>

                                            {/* Opponent */}
                                            <div className="flex items-center gap-2 min-w-0 flex-1 z-10">
                                                <div className="relative w-7 h-7 shrink-0">
                                                    <Image src={`/api/team-badge/${oppId}`} alt={oppName || ''} fill unoptimized className="object-contain"
                                                        onError={(e) => { (e.target as HTMLImageElement).src = '/assets/teams/default.png'; }} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[13px] text-[var(--bone)] font-bold truncate leading-tight">{oppName}</p>
                                                    <p className="font-mono text-[9px] text-[var(--ink-500)] mt-0.5 uppercase tracking-[0.2em] tabular">
                                                        {isHome
                                                            ? <span className="text-[var(--win)]/80">HOME</span>
                                                            : <span className="text-[var(--info)]/80">AWAY</span>
                                                        } <span className="text-[var(--ink-600)]">·</span> {dd}/{mm}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Score */}
                                            <div className="shrink-0 text-right z-10">
                                                <div className={`font-display text-xl ${resultColor} tabular leading-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.4)]`}>{teamSets ?? '—'}<span className="text-[var(--ink-600)] mx-0.5">–</span>{oppSets ?? '—'}</div>
                                                <p className={`font-mono text-[8.5px] mt-1 uppercase tracking-[0.22em] tabular font-bold ${resultColor} opacity-80`}>
                                                    {won ? 'VICTORY' : lost ? 'DEFEAT' : 'DRAW'}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                    </div>
                )}
            </div>
        </div>

        {summaryFixtureId && (
            <GameSummaryModal
                fixtureId={summaryFixtureId}
                perspectiveTeamId={team.id}
                onClose={() => setSummaryFixtureId(null)}
            />
        )}
        </>
    ), document.body);
}
