'use client';
import { useState, useEffect } from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import Image from 'next/image';
import { getCountryName, getCountryCode } from '@/lib/country-codes';

interface League { id: number; league_name: string; }
interface Team {
    id: number; team_name: string; league_id: number; league_name: string; country?: string;
    played: number; won: number; lost: number; points: number; goal_diff: number;
    team_money: number; stadium: string; capacity: number; founded: string;
}

export default function StandingsPage() {
    const [leagues, setLeagues] = useState<League[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [selectedLeague, setSelectedLeague] = useState<number | null>(null);
    const [expandedTeam, setExpandedTeam] = useState<number | null>(null);

    useEffect(() => {
        fetch('/api/leagues').then(r => r.json()).then((data: League[]) => { setLeagues(data); if (data.length) setSelectedLeague(data[0].id); });
        fetch('/api/teams').then(r => r.json()).then(setTeams);
    }, []);

    const leagueTeams = teams
        .filter(t => !selectedLeague || t.league_id === selectedLeague)
        .sort((a, b) => b.points - a.points || b.goal_diff - a.goal_diff);

    const formatMoney = (n: number) => n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}K`;

    function TeamLogo({ teamId }: { teamId: number }) {
        const [src, setSrc] = useState(`/assets/teams/${teamId}.png`);
        const [failed, setFailed] = useState(false);
        if (failed) return null;
        return (
            <div className="relative w-8 h-8 shrink-0">
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

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">League Standings</h1>
                <p className="text-sm text-gray-400">{leagueTeams.length} teams</p>
            </div>

            <div className="flex gap-1 md:gap-2 flex-wrap">
                {leagues.map(league => (
                    <button key={league.id} onClick={() => setSelectedLeague(league.id)}
                        className={`px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-xs md:text-sm font-medium transition-all ${selectedLeague === league.id ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white/5 text-gray-400 hover:text-white border border-white/10'}`}>
                        {league.league_name}
                    </button>
                ))}
            </div>

            <div className="rounded-2xl bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800/60 border border-white/10 overflow-x-auto shadow-xl">
                {/* Table header */}
                <div className="grid grid-cols-[auto_1fr_50px_50px_50px_60px_60px] md:grid-cols-[auto_1fr_60px_60px_60px_80px_80px] gap-3 md:gap-4 px-3 md:px-6 py-3 border-b border-white/[0.06] text-[10px] text-gray-600 uppercase tracking-widest font-semibold min-w-fit bg-white/[0.02]">
                    <span className="w-6 md:w-8">#</span>
                    <span>Team</span>
                    <span className="text-center">P</span>
                    <span className="text-center">W</span>
                    <span className="text-center">L</span>
                    <span className="text-center">GD</span>
                    <span className="text-center">PTS</span>
                </div>

                {leagueTeams.map((team, idx) => (
                    <div key={team.id} className={idx < leagueTeams.length - 1 ? 'border-b border-white/[0.04]' : ''}>
                        <div
                            className={`grid grid-cols-[auto_1fr_50px_50px_50px_60px_60px] md:grid-cols-[auto_1fr_60px_60px_60px_80px_80px] gap-3 md:gap-4 px-3 md:px-6 py-3 md:py-4 items-center hover:bg-white/[0.04] cursor-pointer transition-all min-w-fit ${
                                idx === 0 ? 'border-l-2 border-l-amber-400' : idx < 3 ? 'border-l-2 border-l-amber-400/40' : 'border-l-2 border-l-transparent'
                            }`}
                            onClick={() => setExpandedTeam(expandedTeam === team.id ? null : team.id)}
                        >
                            <span className={`w-6 md:w-8 text-xs md:text-sm font-bold flex items-center justify-center ${idx === 0 ? 'text-amber-400' : idx < 3 ? 'text-amber-400/60' : 'text-gray-600'}`}>
                                {idx === 0 ? <Trophy size={14} className="text-amber-400" /> : idx + 1}
                            </span>
                            <div className="flex items-center gap-2 md:gap-3 min-w-0">
                                <TeamLogo teamId={team.id} />
                                <div className="flex items-center gap-1 md:gap-2 min-w-0">
                                    <span className={`font-semibold text-xs md:text-sm truncate ${idx === 0 ? 'text-amber-300' : 'text-white'}`}>{team.team_name}</span>
                                    <CountryFlag country={team.country} />
                                </div>
                                {expandedTeam === team.id ? <ChevronUp size={14} className="text-gray-500 shrink-0" /> : <ChevronDown size={14} className="text-gray-500 shrink-0" />}
                            </div>
                            <span className="text-center text-xs md:text-sm text-gray-400">{team.played}</span>
                            <span className="text-center text-xs md:text-sm text-emerald-400 font-semibold">{team.won}</span>
                            <span className="text-center text-xs md:text-sm text-red-400 font-semibold">{team.lost}</span>
                            <span className="text-center text-xs md:text-sm font-medium flex items-center justify-center gap-0.5 md:gap-1">
                                {team.goal_diff > 0 ? <TrendingUp size={12} className="text-emerald-400" /> : team.goal_diff < 0 ? <TrendingDown size={12} className="text-red-400" /> : <Minus size={12} className="text-gray-500" />}
                                <span className={team.goal_diff > 0 ? 'text-emerald-400' : team.goal_diff < 0 ? 'text-red-400' : 'text-gray-500'}>
                                    {team.goal_diff > 0 ? '+' : ''}{team.goal_diff}
                                </span>
                            </span>
                            <span className="text-center text-sm md:text-base font-black text-white">{team.points}</span>
                        </div>

                        {expandedTeam === team.id && (
                            <div className="px-3 md:px-6 pb-4 pt-1 grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-3 bg-white/[0.02]">
                                <div className="p-3 rounded-xl bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/[0.06]">
                                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Stadium</div>
                                    <div className="text-sm text-white font-semibold truncate">{team.stadium || 'N/A'}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">{team.capacity?.toLocaleString() || '—'} seats</div>
                                </div>
                                <div className="p-3 rounded-xl bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/[0.06]">
                                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Budget</div>
                                    <div className="text-sm text-emerald-400 font-bold">{formatMoney(team.team_money)}</div>
                                </div>
                                <div className="p-3 rounded-xl bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/[0.06]">
                                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Win Rate</div>
                                    <div className="text-sm text-amber-400 font-bold">{team.played > 0 ? Math.round((team.won / team.played) * 100) : 0}%</div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
