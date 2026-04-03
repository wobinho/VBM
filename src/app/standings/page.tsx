'use client';
import { useState, useEffect } from 'react';
import { 
    Trophy, TrendingUp, TrendingDown, Minus, ChevronDown, 
    ChevronUp, X, MapPin, Users, Calendar, DollarSign,
    Gamepad2, Shield
} from 'lucide-react';
import Image from 'next/image';
import { getCountryName, getCountryCode } from '@/lib/country-codes';
import PlayerModal from '@/components/player-modal';

interface League { id: number; league_name: string; }
interface Team {
    id: number; team_name: string; league_id: number; league_name: string; country?: string;
    played: number; won: number; lost: number; points: number; goal_diff: number;
    team_money: number; stadium: string; capacity: number; founded: string;
}

interface Player {
    id: number; player_name: string; position: string; age: number; country: string;
    jersey_number: number; overall: number; height?: number;
    attack: number; defense: number; serve: number; block: number; receive: number; setting: number;
    contract_years?: number; monthly_wage?: number; player_value?: number;
    team_id?: number | null; team_name?: string;
}

interface TeamWithRank extends Team {
    rank: number;
}

export default function StandingsPage() {
    const [leagues, setLeagues] = useState<League[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [selectedLeague, setSelectedLeague] = useState<number | null>(null);
    const [selectedTeam, setSelectedTeam] = useState<TeamWithRank | null>(null);
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

    useEffect(() => {
        fetch('/api/leagues').then(r => r.json()).then((data: League[]) => { setLeagues(data); if (data.length) setSelectedLeague(data[0].id); });
        fetch('/api/teams').then(r => r.json()).then(setTeams);
    }, []);

    const leagueTeams = teams
        .filter(t => !selectedLeague || t.league_id === selectedLeague)
        .sort((a, b) => b.points - a.points || b.goal_diff - a.goal_diff);

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
                            onClick={() => setSelectedTeam({ ...team, rank: idx + 1 })}
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

                    </div>
                ))}
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
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        fetch(`/api/players?teamId=${team.id}`)
            .then(r => r.json())
            .then(data => {
                setPlayers(data);
                setLoading(false);
            });
    }, [team.id]);

    const formatMoney = (n: number) => n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}K`;

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
                <div className="grid grid-cols-2 md:grid-cols-4 border-b border-white/5 bg-white/[0.02]">
                    {[
                        { label: 'Played', val: team.played, icon: Gamepad2, color: 'text-blue-400' },
                        { label: 'Won', val: team.won, icon: TrendingUp, color: 'text-emerald-400' },
                        { label: 'Lost', val: team.lost, icon: TrendingDown, color: 'text-red-400' },
                        { label: 'Team Budget', val: formatMoney(team.team_money), icon: DollarSign, color: 'text-amber-400' },
                    ].map(s => (
                        <div key={s.label} className="px-6 py-4 border-r border-white/5 last:border-0 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">{s.label}</p>
                                <p className={`text-lg font-bold text-white`}>{s.val}</p>
                            </div>
                            <s.icon size={18} className={`${s.color} opacity-40`} />
                        </div>
                    ))}
                </div>

                {/* Main Content (Roster) */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <Users size={20} className="text-amber-500" />
                            <h3 className="text-xl font-bold text-white tracking-tight">Active Roster</h3>
                        </div>
                        <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                            {players.length} Players Bound
                        </span>
                    </div>

                    {loading ? (
                        <div className="py-20 text-center animate-pulse">
                            <div className="w-10 h-10 bg-amber-500/20 rounded-full mx-auto mb-3" />
                            <p className="text-sm text-gray-500">Retrieving club personnel...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {players.map((p) => {
                                const overallColor = p.overall >= 80 ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : p.overall >= 60 ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' : 'text-red-400 border-red-500/30 bg-red-500/10';
                                
                                return (
                                    <div key={p.id} 
                                        onClick={() => onPlayerClick(p)}
                                        className="group relative flex items-center gap-4 p-3 rounded-2xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-white/20 transition-all cursor-pointer">
                                        
                                        <div className="relative shrink-0">
                                            <div className="w-14 h-14 rounded-xl bg-gray-800/80 overflow-hidden border border-white/5 relative">
                                                <Image 
                                                    src={`/assets/players/${p.id}.png`} 
                                                    alt={p.player_name} 
                                                    fill 
                                                    unoptimized
                                                    className="object-contain object-bottom"
                                                    onError={(e) => { (e.target as HTMLImageElement).src = '/assets/players/default.png'; }} />
                                            </div>
                                            <div className={`absolute -top-1.5 -right-1.5 w-6 h-6 rounded-lg border-2 border-gray-900 flex items-center justify-center text-[10px] font-black ${overallColor}`}>
                                                {p.overall}
                                            </div>
                                        </div>

                                        <div className="min-w-0 pr-4">
                                            <p className="text-sm font-bold text-white truncate leading-tight group-hover:text-amber-300 transition-colors">{p.player_name}</p>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <div className="w-[30px] h-[20px] rounded-sm overflow-hidden shrink-0 border border-white/10 shadow-sm opacity-90 group-hover:opacity-100 transition-opacity">
                                                    <img 
                                                        src={`/assets/flags/${p.country.length === 2 ? p.country.toLowerCase() : getCountryCode(p.country)}.svg`} 
                                                        alt="Flag" 
                                                        className="w-full h-full object-cover" 
                                                        onError={(e) => { (e.target as HTMLImageElement).parentElement?.classList.add('hidden'); }}
                                                    />
                                                </div>
                                                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold truncate">{p.position}</p>
                                            </div>
                                        </div>

                                        <Shield size={12} className="absolute right-4 text-white/10 group-hover:text-amber-500/20 transition-all" />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

