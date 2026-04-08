'use client';
import { useState, useEffect } from 'react';
import { X, Trophy, Swords, TrendingUp, TrendingDown, Shield, Calendar, MapPin } from 'lucide-react';
import Image from 'next/image';

interface FixtureSummary {
    id: number;
    home_team_id: number;
    away_team_id: number;
    home_team_name?: string;
    away_team_name?: string;
    home_sets: number | null;
    away_sets: number | null;
    home_points: number | null;
    away_points: number | null;
    scheduled_date: string;
    game_week?: number;
    status: string;
    season_name?: string;
}

interface Props {
    fixtureId: number;
    fixtureType?: 'regular' | 'playoff' | 'cup';
    /** Optional: if provided, highlights this team's perspective */
    perspectiveTeamId?: number;
    onClose: () => void;
}

function TeamLogo({ teamId, size = 48 }: { teamId: number; size?: number }) {
    const [src, setSrc] = useState(`/assets/teams/${teamId}.png`);
    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            <Image src={src} alt="Team" fill unoptimized className="object-contain drop-shadow-lg"
                onError={() => setSrc('/assets/teams/default.png')} />
        </div>
    );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(iso: string) {
    const [y, m, d] = iso.split('-');
    return `${MONTHS[parseInt(m) - 1]} ${parseInt(d)}, ${y}`;
}

export default function GameSummaryModal({ fixtureId, fixtureType = 'regular', perspectiveTeamId, onClose }: Props) {
    const [fixture, setFixture] = useState<FixtureSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        const typeParam = fixtureType !== 'regular' ? `?type=${fixtureType}` : '';
        fetch(`/api/fixtures/${fixtureId}${typeParam}`)
            .then(r => r.json())
            .then(data => {
                if (data.error) { setError(data.error); } else { setFixture(data); }
                setLoading(false);
            })
            .catch(() => { setError('Failed to load match data.'); setLoading(false); });
    }, [fixtureId, fixtureType]);

    const homeSets  = fixture?.home_sets  ?? 0;
    const awaySets  = fixture?.away_sets  ?? 0;
    const homePoints = fixture?.home_points ?? 0;
    const awayPoints = fixture?.away_points ?? 0;

    const homeWon = homeSets > awaySets;
    const perspIsHome = perspectiveTeamId ? perspectiveTeamId === fixture?.home_team_id : true;
    const userWon = perspectiveTeamId
        ? (perspIsHome ? homeWon : !homeWon)
        : homeWon;

    // Reconstruct approximate set scores from total sets and points
    // Since we don't store per-set breakdown, show available aggregate data
    const totalSets = homeSets + awaySets;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)' }}
            onClick={onClose}>
            <div className="relative w-full max-w-lg rounded-3xl overflow-hidden border border-white/10 shadow-2xl"
                style={{ background: 'linear-gradient(160deg, #0d1117 0%, #0a0d14 100%)' }}
                onClick={e => e.stopPropagation()}>

                {/* Close */}
                <button onClick={onClose}
                    className="absolute top-4 right-4 z-10 w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer">
                    <X size={16} />
                </button>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
                        <Shield size={32} className="text-red-500/40" />
                        <p className="text-red-400 text-sm">{error}</p>
                    </div>
                ) : fixture && (
                    <>
                        {/* Result header */}
                        <div className={`relative px-6 pt-8 pb-6 text-center overflow-hidden ${
                            perspectiveTeamId
                                ? userWon ? 'bg-gradient-to-b from-emerald-500/10 to-transparent' : 'bg-gradient-to-b from-red-500/10 to-transparent'
                                : 'bg-gradient-to-b from-amber-500/8 to-transparent'
                        }`}>
                            {/* Decorative top line */}
                            <div className={`absolute top-0 left-0 right-0 h-[2px] ${
                                perspectiveTeamId
                                    ? userWon ? 'bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent' : 'bg-gradient-to-r from-transparent via-red-400/60 to-transparent'
                                    : 'bg-gradient-to-r from-transparent via-amber-400/40 to-transparent'
                            }`} />

                            <div className="flex items-center justify-between gap-4">
                                {/* Home team */}
                                <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                                    <TeamLogo teamId={fixture.home_team_id} size={52} />
                                    <p className="text-xs font-bold text-white text-center leading-tight truncate w-full px-1">
                                        {fixture.home_team_name ?? `Team ${fixture.home_team_id}`}
                                    </p>
                                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                        fixture.home_team_id === perspectiveTeamId ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white/5 text-gray-500'
                                    }`}>HOME</span>
                                </div>

                                {/* Score */}
                                <div className="flex flex-col items-center gap-1 shrink-0">
                                    <div className="flex items-center gap-3">
                                        <span className={`text-5xl font-black tabular-nums ${homeWon ? 'text-white' : 'text-gray-500'}`}>{homeSets}</span>
                                        <span className="text-2xl font-bold text-gray-700">:</span>
                                        <span className={`text-5xl font-black tabular-nums ${!homeWon ? 'text-white' : 'text-gray-500'}`}>{awaySets}</span>
                                    </div>
                                    <span className="text-[10px] uppercase tracking-widest text-gray-600 font-semibold">Sets</span>
                                    {/* Result badge */}
                                    {perspectiveTeamId && (
                                        <div className={`mt-1 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${
                                            userWon
                                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                                                : 'bg-red-500/15 text-red-400 border border-red-500/25'
                                        }`}>
                                            {userWon ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                            {userWon ? 'VICTORY' : 'DEFEAT'}
                                        </div>
                                    )}
                                    {!perspectiveTeamId && (
                                        <div className="mt-1 flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-black">
                                            <Trophy size={10} /> {homeWon ? (fixture.home_team_name ?? 'Home') : (fixture.away_team_name ?? 'Away')} Win
                                        </div>
                                    )}
                                </div>

                                {/* Away team */}
                                <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                                    <TeamLogo teamId={fixture.away_team_id} size={52} />
                                    <p className="text-xs font-bold text-white text-center leading-tight truncate w-full px-1">
                                        {fixture.away_team_name ?? `Team ${fixture.away_team_id}`}
                                    </p>
                                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                        fixture.away_team_id === perspectiveTeamId ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white/5 text-gray-500'
                                    }`}>AWAY</span>
                                </div>
                            </div>
                        </div>

                        {/* Stats grid */}
                        <div className="px-6 py-4 space-y-3 border-t border-white/[0.06]">
                            {/* Points row */}
                            <div className="flex items-center gap-3">
                                <div className="flex-1 text-right">
                                    <span className={`text-lg font-black tabular-nums ${homePoints > awayPoints ? 'text-amber-400' : 'text-gray-500'}`}>{homePoints}</span>
                                </div>
                                <div className="w-24 text-center">
                                    <p className="text-[9px] uppercase tracking-widest text-gray-600 font-bold">Total Points</p>
                                    {/* Split bar */}
                                    <div className="mt-1.5 h-1.5 rounded-full bg-white/5 overflow-hidden flex">
                                        {(homePoints + awayPoints) > 0 && <>
                                            <div className="h-full bg-amber-400/70 rounded-full" style={{ width: `${(homePoints / (homePoints + awayPoints)) * 100}%` }} />
                                            <div className="h-full bg-sky-400/70 rounded-full flex-1" />
                                        </>}
                                    </div>
                                </div>
                                <div className="flex-1 text-left">
                                    <span className={`text-lg font-black tabular-nums ${awayPoints > homePoints ? 'text-sky-400' : 'text-gray-500'}`}>{awayPoints}</span>
                                </div>
                            </div>

                            {/* Sets row */}
                            <div className="flex items-center gap-3">
                                <div className="flex-1 text-right">
                                    <span className={`text-lg font-black tabular-nums ${homeSets > awaySets ? 'text-amber-400' : 'text-gray-500'}`}>{homeSets}</span>
                                </div>
                                <div className="w-24 text-center">
                                    <p className="text-[9px] uppercase tracking-widest text-gray-600 font-bold">Sets Won</p>
                                    <div className="mt-1.5 flex justify-center gap-1">
                                        {Array.from({ length: totalSets }).map((_, i) => {
                                            const isHomePt = i < homeSets;
                                            return <div key={i} className={`w-3 h-1.5 rounded-full ${isHomePt ? 'bg-amber-400/70' : 'bg-sky-400/70'}`} />;
                                        })}
                                    </div>
                                </div>
                                <div className="flex-1 text-left">
                                    <span className={`text-lg font-black tabular-nums ${awaySets > homeSets ? 'text-sky-400' : 'text-gray-500'}`}>{awaySets}</span>
                                </div>
                            </div>

                            {/* Win margin */}
                            <div className="flex items-center gap-3">
                                <div className="flex-1 text-right">
                                    <span className={`text-sm font-bold tabular-nums ${homePoints > awayPoints ? 'text-amber-400/80' : 'text-gray-600'}`}>
                                        {homePoints > awayPoints ? `+${homePoints - awayPoints}` : homePoints - awayPoints}
                                    </span>
                                </div>
                                <div className="w-24 text-center">
                                    <p className="text-[9px] uppercase tracking-widest text-gray-600 font-bold">Point Diff</p>
                                </div>
                                <div className="flex-1 text-left">
                                    <span className={`text-sm font-bold tabular-nums ${awayPoints > homePoints ? 'text-sky-400/80' : 'text-gray-600'}`}>
                                        {awayPoints > homePoints ? `+${awayPoints - homePoints}` : awayPoints - homePoints}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Match info footer */}
                        <div className="px-6 py-4 border-t border-white/[0.05] flex items-center justify-between gap-4">
                            <div className="flex items-center gap-1.5 text-[10px] text-gray-600">
                                <Calendar size={11} className="text-gray-600" />
                                {fmtDate(fixture.scheduled_date)}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-gray-600">
                                <Swords size={11} className="text-gray-600" />
                                {fixture.season_name ?? 'Regular Season'}
                                {fixture.game_week ? ` · MD${fixture.game_week}` : ''}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
