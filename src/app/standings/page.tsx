'use client';
import { useState, useEffect } from 'react';
import {
    Trophy, TrendingUp, TrendingDown, Minus, X, MapPin, Users, Calendar,
    BarChart2, Gamepad2, Shield, Swords, DollarSign, Star,
} from 'lucide-react';
import Image from 'next/image';
import { getCountryName, getCountryCode } from '@/lib/country-codes';
import PlayerModal from '@/components/player-modal';
import { useAuth } from '@/contexts/auth-context';

interface League { id: number; league_name: string; }
interface Team {
    id: number; team_name: string; league_id: number; league_name: string; country?: string; region?: string;
    played: number; won: number; lost: number; points: number; sets_won: number; sets_lost: number; goal_diff: number;
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

interface PlayoffGame {
    id: number; series_id: number; game_number: number;
    home_team_id: number; away_team_id: number;
    scheduled_date: string; status: string;
    home_sets: number | null; away_sets: number | null;
    home_team_name?: string; away_team_name?: string;
}

interface PlayoffSeries {
    id: number; round: number; conference: string | null;
    seed_high: number; seed_low: number;
    home_team_id: number; away_team_id: number;
    home_wins: number; away_wins: number;
    winner_team_id: number | null; status: string;
    home_team_name?: string; away_team_name?: string; winner_team_name?: string;
    games: PlayoffGame[];
}

interface PlayoffBracket {
    seasonId: number; year: number;
    round1: PlayoffSeries[];
    round2: PlayoffSeries[];
    round3: PlayoffSeries[];
    champion: { teamId: number; teamName: string } | null;
    status: 'not_started' | 'in_progress' | 'completed';
}

export default function StandingsPage() {
    const { team: userTeam } = useAuth();
    const [leagues, setLeagues] = useState<League[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [selectedLeague, setSelectedLeague] = useState<number | null>(null);
    const [selectedTeam, setSelectedTeam] = useState<TeamWithRank | null>(null);
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [showConference, setShowConference] = useState(false);
    const [activeTab, setActiveTab] = useState<'standings' | 'playoffs'>('standings');
    const [bracket, setBracket] = useState<PlayoffBracket | null>(null);
    const [bracketLoading, setBracketLoading] = useState(false);

    useEffect(() => {
        fetch('/api/leagues').then(r => r.json()).then((data: League[]) => { setLeagues(data); if (data.length) setSelectedLeague(data[0].id); });
        fetch('/api/teams').then(r => r.json()).then(setTeams);
    }, []);

    useEffect(() => {
        if (activeTab !== 'playoffs') return;
        setBracketLoading(true);
        fetch('/api/playoffs')
            .then(r => r.ok ? r.json() : null)
            .then((data: PlayoffBracket | null) => { setBracket(data); setBracketLoading(false); })
            .catch(() => setBracketLoading(false));
    }, [activeTab]);

    const leagueTeams = teams
        .filter(t => !selectedLeague || t.league_id === selectedLeague)
        .sort((a, b) => b.points - a.points || b.won - a.won || a.lost - b.lost);

    const northTeams = leagueTeams.filter(t => (t.region ?? 'north') === 'north');
    const southTeams = leagueTeams.filter(t => t.region === 'south');
    const hasTwoConf = selectedLeague === 1 && northTeams.length > 0 && southTeams.length > 0;

    const formatMoney = (n: number) => n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}K`;

    function TeamLogo({ teamId, size = 32, className = "" }: { teamId: number; size?: number; className?: string }) {
        const [src, setSrc] = useState(`/assets/teams/${teamId}.png`);
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

    function StandingsTable({ conferenceTeams, title }: { conferenceTeams: Team[]; title: string }) {
        const total = conferenceTeams.length;
        return (
            <div>
                <div className="flex items-center gap-3 mb-3">
                    <h2 className="text-base font-bold text-white uppercase tracking-widest">{title}</h2>
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold bg-white/5 px-2 py-0.5 rounded-full border border-white/5">{total} teams</span>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800/60 border border-white/10 overflow-x-auto shadow-xl">
                    {/* Table header */}
                    <div className="grid grid-cols-[auto_1fr_44px_44px_44px_60px_70px] md:grid-cols-[auto_1fr_52px_52px_52px_72px_88px] gap-2 md:gap-3 px-3 md:px-6 py-3 border-b border-white/[0.06] text-[10px] text-gray-600 uppercase tracking-widest font-semibold min-w-fit bg-white/[0.02]">
                        <span className="w-6 md:w-8">#</span>
                        <span>Team</span>
                        <span className="text-center">P</span>
                        <span className="text-center">W</span>
                        <span className="text-center">L</span>
                        <span className="text-center" title="Set Difference">SD</span>
                        <span className="text-center" title="Points">Pts</span>
                    </div>

                    {conferenceTeams.map((team, idx) => {
                        const isTop4 = idx < 4;
                        const isBottom = idx === total - 1;
                        const isUserTeam = userTeam?.id === team.id;
                        const sd = team.sets_won - team.sets_lost;

                        let borderColor = 'border-l-transparent';
                        if (isUserTeam) borderColor = 'border-l-amber-400';
                        else if (idx === 0) borderColor = 'border-l-amber-400';
                        else if (isTop4) borderColor = 'border-l-amber-400/40';
                        else if (isBottom) borderColor = 'border-l-red-500/60';

                        return (
                            <div key={team.id} className={idx < total - 1 ? 'border-b border-white/[0.04]' : ''}>
                                <div
                                    className={`grid grid-cols-[auto_1fr_44px_44px_44px_60px_70px] md:grid-cols-[auto_1fr_52px_52px_52px_72px_88px] gap-2 md:gap-3 px-3 md:px-6 py-3 md:py-4 items-center cursor-pointer transition-all min-w-fit border-l-2 ${borderColor} ${
                                        isUserTeam ? 'bg-amber-500/[0.08] hover:bg-amber-500/[0.13]' : 'hover:bg-white/[0.04]'
                                    }`}
                                    onClick={() => setSelectedTeam({ ...team, rank: idx + 1 })}
                                >
                                    <span className={`w-6 md:w-8 text-xs md:text-sm font-bold flex items-center justify-center ${idx === 0 ? 'text-amber-400' : isTop4 ? 'text-amber-400/60' : isBottom ? 'text-red-400/60' : 'text-gray-600'}`}>
                                        {idx + 1}
                                    </span>
                                    <div className="flex items-center gap-2 md:gap-3 min-w-0">
                                        <TeamLogo teamId={team.id} />
                                        <div className="flex items-center gap-1 md:gap-2 min-w-0">
                                            <span className={`font-semibold text-xs md:text-sm truncate ${isUserTeam ? 'text-amber-300 font-bold' : idx === 0 ? 'text-amber-300' : isBottom ? 'text-red-300/80' : 'text-white'}`}>{team.team_name}</span>
                                            <CountryFlag country={team.country} />
                                        </div>
                                    </div>
                                    <span className="text-center text-xs md:text-sm text-gray-400">{team.played}</span>
                                    <span className="text-center text-xs md:text-sm text-emerald-400 font-semibold">{team.won}</span>
                                    <span className="text-center text-xs md:text-sm text-red-400 font-semibold">{team.lost}</span>
                                    <span className={`text-center text-xs md:text-sm font-semibold ${sd > 0 ? 'text-emerald-400' : sd < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                                        {sd > 0 ? `+${sd}` : sd}
                                    </span>
                                    <span className="text-center font-black text-sm md:text-base flex items-center justify-center">
                                        <span className={team.points > 0 ? 'text-emerald-400' : 'text-gray-500'}>{team.points}</span>
                                    </span>
                                </div>
                            </div>
                        );
                    })}

                    {/* Legend */}
                    <div className="flex flex-wrap gap-x-5 gap-y-1.5 px-4 md:px-6 py-3 border-t border-white/[0.04] bg-white/[0.01]">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-sm bg-amber-400" />
                            <span className="text-[10px] text-gray-500">Top 4 — Playoff</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-sm bg-red-500/60" />
                            <span className="text-[10px] text-gray-500">Relegation</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">League Standings</h1>
                <p className="text-sm text-gray-400">{leagueTeams.length} teams</p>
            </div>

            {/* Controls row: tab switcher + divider + league filters */}
            <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => setActiveTab('standings')}
                    className={`px-4 py-2 rounded-xl text-xs md:text-sm font-semibold uppercase tracking-widest transition-all ${activeTab === 'standings' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white/5 text-gray-400 hover:text-white border border-white/10'}`}>
                    Season
                </button>
                <button onClick={() => setActiveTab('playoffs')}
                    className={`px-4 py-2 rounded-xl text-xs md:text-sm font-semibold uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'playoffs' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white/5 text-gray-400 hover:text-white border border-white/10'}`}>
                    <Trophy size={13} />
                    Playoffs
                </button>

                {activeTab === 'standings' && leagues.length > 0 && (
                    <>
                        <div className="w-px h-5 bg-white/10 mx-1 shrink-0" />
                        {leagues.map(league => (
                            <button key={league.id} onClick={() => setSelectedLeague(league.id)}
                                className={`px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-xs md:text-sm font-medium transition-all ${selectedLeague === league.id ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white/5 text-gray-400 hover:text-white border border-white/10'}`}>
                                {league.league_name}
                            </button>
                        ))}
                    </>
                )}
            </div>

            {activeTab === 'standings' && (
                <>
                    {hasTwoConf ? (
                        <div className="space-y-5">
                            <div className="flex items-center gap-4">
                                <button type="button" onClick={() => setShowConference(false)}
                                    className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all ${!showConference ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'bg-white/5 text-gray-400 hover:text-white border border-white/10'}`}>
                                    Overall
                                </button>
                                <button type="button" onClick={() => setShowConference(true)}
                                    className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all ${showConference ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'bg-white/5 text-gray-400 hover:text-white border border-white/10'}`}>
                                    Conference
                                </button>
                            </div>
                            {showConference ? (
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                    <StandingsTable conferenceTeams={northTeams} title="North Conference" />
                                    <StandingsTable conferenceTeams={southTeams} title="South Conference" />
                                </div>
                            ) : (
                                <StandingsTable conferenceTeams={leagueTeams} title="Overall Standings" />
                            )}
                        </div>
                    ) : (
                        <StandingsTable conferenceTeams={leagueTeams} title="League Standings" />
                    )}
                </>
            )}

            {activeTab === 'playoffs' && (
                <PlayoffBracketView
                    bracket={bracket}
                    loading={bracketLoading}
                    userTeamId={userTeam?.id ?? null}
                />
            )}

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

// ─── Playoff Bracket View ─────────────────────────────────────────────────────

function PlayoffBracketView({ bracket, loading, userTeamId }: {
    bracket: PlayoffBracket | null;
    loading: boolean;
    userTeamId: number | null;
}) {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-20 animate-pulse">
                <div className="text-center">
                    <div className="w-10 h-10 bg-amber-500/20 rounded-full mx-auto mb-3" />
                    <p className="text-sm text-gray-500">Loading bracket...</p>
                </div>
            </div>
        );
    }

    if (!bracket || bracket.status === 'not_started') {
        return (
            <div className="rounded-2xl bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800/60 border border-white/10 p-10 text-center">
                <Trophy size={40} className="text-amber-500/30 mx-auto mb-4" />
                <p className="text-white font-bold text-lg mb-1">Playoffs Haven&apos;t Started</p>
                <p className="text-sm text-gray-500">The playoffs begin after the regular season ends on Aug 31.<br/>Top 4 teams from each conference will qualify.</p>
            </div>
        );
    }

    function SeriesCard({ series }: { series: PlayoffSeries }) {
        const isUserInvolved = userTeamId !== null &&
            (series.home_team_id === userTeamId || series.away_team_id === userTeamId);
        const homeWon = series.winner_team_id === series.home_team_id;
        const awayWon = series.winner_team_id === series.away_team_id;

        return (
            <div className={`rounded-2xl border p-4 space-y-3 transition-all ${isUserInvolved ? 'border-amber-500/40 bg-amber-500/[0.06]' : 'border-white/10 bg-white/[0.03]'}`}>
                {/* Series header */}
                <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">
                        {series.conference ? `${series.conference.charAt(0).toUpperCase() + series.conference.slice(1)} — ` : ''}
                        #{series.seed_high} vs #{series.seed_low}
                    </span>
                    <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full ${
                        series.status === 'completed' ? 'text-emerald-400 bg-emerald-500/10' :
                        series.status === 'in_progress' ? 'text-amber-400 bg-amber-500/10' :
                        'text-gray-500 bg-white/5'
                    }`}>
                        {series.status === 'completed' ? 'Final' : series.status === 'in_progress' ? 'Live' : 'Upcoming'}
                    </span>
                </div>

                {/* Teams + wins */}
                <div className="space-y-2">
                    {[
                        { teamId: series.home_team_id, name: series.home_team_name, wins: series.home_wins, won: homeWon, seed: series.seed_high },
                        { teamId: series.away_team_id, name: series.away_team_name, wins: series.away_wins, won: awayWon, seed: series.seed_low },
                    ].map((side) => (
                        <div key={side.teamId} className={`flex items-center gap-3 p-2 rounded-xl transition-all ${side.won ? 'bg-emerald-500/10' : series.status === 'completed' ? 'opacity-40' : ''}`}>
                            <div className="relative w-8 h-8 shrink-0">
                                <Image src={`/assets/teams/${side.teamId}.png`} alt={side.name ?? ''} fill unoptimized className="object-contain"
                                    onError={(e) => { (e.target as HTMLImageElement).src = '/assets/teams/default.png'; }} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-gray-500 font-bold">#{side.seed}</span>
                                    <span className={`text-sm font-semibold truncate ${side.won ? 'text-emerald-300' : side.teamId === userTeamId ? 'text-amber-300' : 'text-white'}`}>
                                        {side.name}
                                    </span>
                                    {side.won && <Trophy size={11} className="text-amber-400 shrink-0" />}
                                </div>
                            </div>
                            <div className="flex gap-1.5 items-center">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black ${i < side.wins ? 'bg-emerald-500 text-white' : 'bg-white/5 text-gray-700'}`}>
                                        {i < side.wins ? '✓' : ''}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Individual game results */}
                {series.games.filter(g => g.status === 'completed').length > 0 && (
                    <div className="flex gap-1.5 flex-wrap pt-1 border-t border-white/5">
                        {series.games.filter(g => g.status !== 'cancelled').map(g => {
                            const played = g.status === 'completed';
                            const homeWins = played && g.home_sets !== null && g.away_sets !== null && g.home_sets > g.away_sets;
                            return (
                                <div key={g.id} className={`text-center px-2 py-1 rounded-lg text-[10px] font-semibold ${
                                    !played ? 'bg-white/5 text-gray-600' :
                                    homeWins ? 'bg-blue-500/15 text-blue-300' : 'bg-orange-500/15 text-orange-300'
                                }`}>
                                    <div className="text-[9px] text-gray-600 mb-0.5">G{g.game_number}</div>
                                    {played ? `${g.home_sets}-${g.away_sets}` : '·'}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    const northR1 = bracket.round1.filter(s => s.conference === 'north');
    const southR1 = bracket.round1.filter(s => s.conference === 'south');
    const northR2 = bracket.round2.filter(s => s.conference === 'north');
    const southR2 = bracket.round2.filter(s => s.conference === 'south');

    return (
        <div className="space-y-12">
            {/* Champion banner */}
            {bracket.champion && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 flex items-center gap-4">
                    <Trophy size={32} className="text-amber-400 shrink-0" />
                    <div>
                        <p className="text-[10px] text-amber-500/60 uppercase tracking-widest font-semibold mb-0.5">{bracket.year} IVL Champion</p>
                        <p className="text-xl font-black text-amber-300">{bracket.champion.teamName}</p>
                    </div>
                </div>
            )}

            {/* Round 1 — Conference Semifinals */}
            <div>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Conference Semifinals</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-3">
                        <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold px-1">North Conference</p>
                        {northR1.length ? northR1.map(s => <SeriesCard key={s.id} series={s} />) : (
                            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6 text-center text-xs text-gray-600">TBD</div>
                        )}
                    </div>
                    <div className="space-y-3">
                        <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold px-1">South Conference</p>
                        {southR1.length ? southR1.map(s => <SeriesCard key={s.id} series={s} />) : (
                            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6 text-center text-xs text-gray-600">TBD</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Round 2 — Conference Finals */}
            <div>
                <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-px bg-white/[0.06]" />
                    <span className="text-[10px] text-gray-700 uppercase tracking-widest font-semibold">Round 2</span>
                    <div className="flex-1 h-px bg-white/[0.06]" />
                </div>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Conference Finals</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-3">
                        <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold px-1">North Conference</p>
                        {northR2.length ? northR2.map(s => <SeriesCard key={s.id} series={s} />) : (
                            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6 text-center text-xs text-gray-600">
                                {bracket.round1.some(s => s.status !== 'completed') ? 'Awaiting Semis Results' : 'TBD'}
                            </div>
                        )}
                    </div>
                    <div className="space-y-3">
                        <p className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold px-1">South Conference</p>
                        {southR2.length ? southR2.map(s => <SeriesCard key={s.id} series={s} />) : (
                            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6 text-center text-xs text-gray-600">
                                {bracket.round1.some(s => s.status !== 'completed') ? 'Awaiting Semis Results' : 'TBD'}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Round 3 — Grand Final */}
            <div>
                <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-px bg-white/[0.06]" />
                    <span className="text-[10px] text-gray-700 uppercase tracking-widest font-semibold">Round 3</span>
                    <div className="flex-1 h-px bg-white/[0.06]" />
                </div>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Star size={12} className="text-amber-500" />
                    Grand Final
                </h2>
                {bracket.round3.length ? (
                    <div className="max-w-md">
                        {bracket.round3.map(s => <SeriesCard key={s.id} series={s} />)}
                    </div>
                ) : (
                    <div className="max-w-md rounded-xl border border-white/5 bg-white/[0.02] p-6 text-center text-xs text-gray-600">
                        {bracket.round2.some(s => s.status !== 'completed') ? 'Awaiting Conference Finals' : 'TBD'}
                    </div>
                )}
            </div>
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

    useEffect(() => {
        setLoading(true);
        Promise.all([
            fetch(`/api/players?teamId=${team.id}`).then(r => r.json()),
            fetch(`/api/fixtures?teamId=${team.id}&status=completed`).then(r => r.json()),
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

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
            onClick={onClose}>
            <div className="relative w-full max-w-4xl max-h-[90vh] rounded-3xl overflow-hidden border border-white/10 shadow-2xl flex flex-col"
                style={{ background: 'linear-gradient(160deg, #0f1623 0%, #0a0f1a 100%)' }}
                onClick={e => e.stopPropagation()}>

                {/* Header Section */}
                <div className="relative px-8 pt-10 pb-8 border-b border-white/5 shrink-0"
                    style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.08) 0%, rgba(249,115,22,0.04) 100%)' }}>
                    <button onClick={onClose}
                        className="absolute top-6 right-6 w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer">
                        <X size={18} />
                    </button>

                    <div className="flex flex-col md:flex-row md:items-end gap-6 md:gap-8">
                        <div className="relative">
                            <div className="w-28 h-28 md:w-32 md:h-32 rounded-3xl bg-white/[0.03] border border-white/10 p-4 shadow-2xl flex items-center justify-center overflow-hidden">
                                <Image src={`/assets/teams/${team.id}.png`} alt={team.team_name} fill unoptimized
                                    className="object-contain p-4"
                                    onError={(e) => { (e.target as HTMLImageElement).src = '/assets/teams/default.png'; }} />
                            </div>
                            <div className="absolute -top-3 -right-3 w-10 h-10 rounded-xl bg-amber-500 border-2 border-gray-900 flex items-center justify-center text-gray-900 font-black shadow-lg">
                                #{team.rank}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">{team.team_name}</h2>
                                <img src={`/assets/flags/${team.country?.length === 2 ? team.country.toLowerCase() : getCountryCode(team.country || 'un')}.svg`}
                                    alt="Flag" className="w-7 rounded shadow-sm opacity-80" />
                            </div>
                            <div className="flex flex-wrap items-center gap-y-2 gap-x-5 text-sm text-gray-400">
                                <div className="flex items-center gap-2">
                                    <MapPin size={14} className="text-amber-500" />
                                    <span>{team.stadium || 'Unknown Stadium'}</span>
                                </div>
                                <div className="flex items-center gap-2 font-medium">
                                    <Trophy size={14} className="text-amber-500" />
                                    <span className="text-white">{team.points} Points</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Calendar size={14} className="text-amber-500" />
                                    <span>Founded {team.founded || '—'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Substats Row */}
                <div className="grid grid-cols-3 md:grid-cols-5 border-b border-white/5 bg-white/[0.02] shrink-0">
                    {[
                        { label: 'Played',   val: team.played,                                       icon: Gamepad2,    color: 'text-blue-400' },
                        { label: 'Won',      val: team.won,                                           icon: TrendingUp,  color: 'text-emerald-400' },
                        { label: 'Lost',     val: team.lost,                                          icon: TrendingDown, color: 'text-red-400' },
                        { label: 'Set Diff', val: setDiff > 0 ? `+${setDiff}` : `${setDiff}`,        icon: BarChart2,   color: setDiff > 0 ? 'text-emerald-400' : setDiff < 0 ? 'text-red-400' : 'text-gray-400' },
                        { label: 'Points',   val: team.points,                                        icon: Trophy,      color: 'text-amber-400' },
                    ].map(s => (
                        <div key={s.label} className="px-4 py-4 border-r border-white/5 last:border-0 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">{s.label}</p>
                                <p className={`text-lg font-bold ${s.color}`}>{s.val}</p>
                            </div>
                            <s.icon size={18} className={`${s.color} opacity-40`} />
                        </div>
                    ))}
                </div>

                {/* Main Content — two-column layout */}
                {loading ? (
                    <div className="flex-1 flex items-center justify-center animate-pulse">
                        <div className="text-center">
                            <div className="w-10 h-10 bg-amber-500/20 rounded-full mx-auto mb-3" />
                            <p className="text-sm text-gray-500">Retrieving club data...</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-white/5">

                        {/* Left — Active Roster */}
                        <div className="flex flex-col overflow-hidden">
                            <div className="flex items-center justify-between px-6 pt-5 pb-3 shrink-0">
                                <div className="flex items-center gap-2">
                                    <Users size={16} className="text-amber-500" />
                                    <h3 className="text-sm font-bold text-white tracking-tight">Active Roster</h3>
                                </div>
                                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
                                    {players.length} Players
                                </span>
                            </div>
                            <div className="overflow-y-auto px-6 pb-6 custom-scrollbar flex flex-col gap-2">
                                {players.map((p) => {
                                    const overallColor = p.overall >= 80 ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : p.overall >= 60 ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' : 'text-red-400 border-red-500/30 bg-red-500/10';
                                    return (
                                        <div key={p.id}
                                            onClick={() => onPlayerClick(p)}
                                            className="group relative flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-white/20 transition-all cursor-pointer shrink-0">
                                            <div className="relative shrink-0">
                                                <div className="w-12 h-12 rounded-xl bg-gray-800/80 overflow-hidden border border-white/5 relative">
                                                    <Image src={`/assets/players/${p.id}.png`} alt={p.player_name} fill unoptimized className="object-contain object-bottom"
                                                        onError={(e) => { (e.target as HTMLImageElement).src = '/assets/players/default.png'; }} />
                                                </div>
                                                <div className={`absolute -top-1.5 -right-1.5 w-6 h-6 rounded-lg border-2 border-gray-900 flex items-center justify-center text-[10px] font-black ${overallColor}`}>
                                                    {p.overall}
                                                </div>
                                            </div>
                                            <div className="min-w-0 pr-4">
                                                <p className="text-sm font-bold text-white truncate leading-tight group-hover:text-amber-300 transition-colors">{p.player_name}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <div className="w-[28px] h-[18px] rounded-sm overflow-hidden shrink-0 border border-white/10 shadow-sm opacity-90">
                                                        <img src={`/assets/flags/${p.country.length === 2 ? p.country.toLowerCase() : getCountryCode(p.country)}.svg`} alt="Flag" className="w-full h-full object-cover"
                                                            onError={(e) => { (e.target as HTMLImageElement).parentElement?.classList.add('hidden'); }} />
                                                    </div>
                                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold truncate">{p.position}</p>
                                                </div>
                                            </div>
                                            <Shield size={12} className="absolute right-4 text-white/10 group-hover:text-amber-500/20 transition-all" />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Right — Match History */}
                        <div className="flex flex-col overflow-hidden">
                            <div className="flex items-center justify-between px-6 pt-5 pb-3 shrink-0">
                                <div className="flex items-center gap-2">
                                    <Swords size={16} className="text-amber-500" />
                                    <h3 className="text-sm font-bold text-white tracking-tight">Match History</h3>
                                </div>
                                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
                                    {fixtures.length} Matches
                                </span>
                            </div>
                            <div className="overflow-y-auto px-6 pb-6 custom-scrollbar flex flex-col gap-2">
                                {fixtures.length === 0 ? (
                                    <div className="flex items-center justify-center py-12 rounded-2xl bg-white/[0.02] border border-white/5">
                                        <p className="text-sm text-gray-500">No completed matches yet</p>
                                    </div>
                                ) : fixtures.map((f) => {
                                    const isHome = f.home_team_id === team.id;
                                    const teamSets = isHome ? f.home_sets : f.away_sets;
                                    const oppSets = isHome ? f.away_sets : f.home_sets;
                                    const oppName = isHome ? f.away_team_name : f.home_team_name;
                                    const oppId = isHome ? f.away_team_id : f.home_team_id;
                                    const won = teamSets !== null && oppSets !== null && teamSets > oppSets;
                                    const lost = teamSets !== null && oppSets !== null && teamSets < oppSets;
                                    const resultColor = won ? 'text-emerald-400' : lost ? 'text-red-400' : 'text-gray-400';
                                    const resultBg = won ? 'bg-emerald-500/10 border-emerald-500/20' : lost ? 'bg-red-500/10 border-red-500/20' : 'bg-white/5 border-white/10';
                                    const resultLabel = won ? 'W' : lost ? 'L' : 'D';
                                    const [, mm, dd] = f.scheduled_date.split('-');
                                    return (
                                        <div key={f.id} className={`flex items-center gap-3 p-3 rounded-2xl border shrink-0 ${resultBg}`}>
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${resultColor} bg-white/5`}>
                                                {resultLabel}
                                            </div>
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                <div className="relative w-7 h-7 shrink-0">
                                                    <Image src={`/assets/teams/${oppId}.png`} alt={oppName || ''} fill unoptimized className="object-contain"
                                                        onError={(e) => { (e.target as HTMLImageElement).src = '/assets/teams/default.png'; }} />
                                                </div>
                                                <span className="text-sm text-white font-medium truncate">{oppName}</span>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <span className={`text-sm font-black ${resultColor}`}>{teamSets ?? '—'}–{oppSets ?? '—'}</span>
                                                <p className="text-[10px] text-gray-600 mt-0.5">{isHome ? 'Home' : 'Away'} · {dd}/{mm}</p>
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
    );
}
