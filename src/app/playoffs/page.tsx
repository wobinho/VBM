'use client';
import { useState, useEffect } from 'react';
import { Trophy, Star, Flame, Crown, Shield, Swords, ChevronRight, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/contexts/auth-context';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlayoffGame {
    id: number;
    series_id: number;
    game_number: number;
    home_team_id: number;
    away_team_id: number;
    scheduled_date: string;
    status: string;
    home_sets: number | null;
    away_sets: number | null;
    home_team_name?: string;
    away_team_name?: string;
}

interface PlayoffSeries {
    id: number;
    round: number;
    conference: string | null;
    seed_high: number;
    seed_low: number;
    home_team_id: number;
    away_team_id: number;
    home_wins: number;
    away_wins: number;
    winner_team_id: number | null;
    status: string;
    home_team_name?: string;
    away_team_name?: string;
    winner_team_name?: string;
    games: PlayoffGame[];
}

interface PlayoffBracket {
    seasonId: number;
    year: number;
    round1: PlayoffSeries[];
    round2: PlayoffSeries[];
    round3: PlayoffSeries[];
    champion: { teamId: number; teamName: string } | null;
    status: 'not_started' | 'in_progress' | 'completed';
}

// ─── Team Logo ────────────────────────────────────────────────────────────────

function TeamLogo({ teamId, size = 40 }: { teamId: number; size?: number }) {
    const [src, setSrc] = useState(`/assets/teams/${teamId}.png`);
    const [failed, setFailed] = useState(false);
    if (failed) return <div style={{ width: size, height: size }} className="rounded-full bg-white/5 border border-white/10" />;
    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            <Image src={src} alt="Team" fill unoptimized className="object-contain"
                onError={() => {
                    if (src !== '/assets/teams/default.png') setSrc('/assets/teams/default.png');
                    else setFailed(true);
                }} />
        </div>
    );
}

// ─── Series Card ──────────────────────────────────────────────────────────────

function SeriesCard({
    series,
    userTeamId,
    isFinal = false,
}: {
    series: PlayoffSeries;
    userTeamId: number | null;
    isFinal?: boolean;
}) {
    const isUserInvolved = userTeamId !== null &&
        (series.home_team_id === userTeamId || series.away_team_id === userTeamId);
    const homeWon = series.winner_team_id === series.home_team_id;
    const awayWon = series.winner_team_id === series.away_team_id;
    const isCompleted = series.status === 'completed';
    const isLive = series.status === 'in_progress';

    const statusConfig = isCompleted
        ? { label: 'Final', cls: 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30' }
        : isLive
        ? { label: 'Live', cls: 'text-amber-400 bg-amber-500/15 border border-amber-500/30 animate-pulse' }
        : { label: 'Upcoming', cls: 'text-gray-500 bg-white/5 border border-white/10' };

    const sides = [
        { teamId: series.home_team_id, name: series.home_team_name, wins: series.home_wins, won: homeWon, seed: series.seed_high },
        { teamId: series.away_team_id, name: series.away_team_name, wins: series.away_wins, won: awayWon, seed: series.seed_low },
    ];

    return (
        <div className={`relative rounded-2xl border overflow-hidden transition-all duration-300 cursor-default
            ${isFinal
                ? 'border-amber-500/40 shadow-xl shadow-amber-500/10'
                : isUserInvolved
                ? 'border-amber-400/30 shadow-lg shadow-amber-500/5'
                : 'border-white/10'
            }
        `}>
            {/* glow bg for final */}
            {isFinal && (
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent pointer-events-none" />
            )}
            {isUserInvolved && !isFinal && (
                <div className="absolute inset-0 bg-amber-500/[0.04] pointer-events-none" />
            )}

            {/* Card top bar */}
            <div className={`relative px-4 py-2.5 flex items-center justify-between border-b
                ${isFinal ? 'border-amber-500/20 bg-amber-500/5' : 'border-white/5 bg-white/[0.02]'}
            `}>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500">
                    {series.conference
                        ? `${series.conference.charAt(0).toUpperCase() + series.conference.slice(1)} · `
                        : ''}
                    #{series.seed_high} vs #{series.seed_low}
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${statusConfig.cls}`}>
                    {statusConfig.label}
                </span>
            </div>

            {/* Teams */}
            <div className="relative px-4 py-4 space-y-2.5">
                {sides.map((side) => (
                    <div key={side.teamId}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200
                            ${side.won
                                ? isFinal
                                    ? 'bg-amber-500/15 border border-amber-500/25'
                                    : 'bg-emerald-500/10 border border-emerald-500/20'
                                : isCompleted
                                ? 'opacity-35'
                                : 'bg-white/[0.03] border border-transparent'
                            }
                        `}>
                        <TeamLogo teamId={side.teamId} size={32} />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-gray-600 font-bold tabular-nums">#{side.seed}</span>
                                <span className={`text-sm font-bold truncate
                                    ${side.won && isFinal ? 'text-amber-300' :
                                      side.won ? 'text-emerald-300' :
                                      side.teamId === userTeamId ? 'text-amber-300' :
                                      'text-white'}`}>
                                    {side.name}
                                </span>
                                {side.won && isFinal && <Crown size={11} className="text-amber-400 shrink-0" />}
                                {side.won && !isFinal && <Trophy size={10} className="text-emerald-400 shrink-0" />}
                            </div>
                        </div>
                        {/* Win pips */}
                        <div className="flex gap-1.5 items-center">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i}
                                    className={`w-4 h-4 rounded-md flex items-center justify-center text-[9px] font-black transition-all
                                        ${i < side.wins
                                            ? side.won && isFinal
                                                ? 'bg-amber-500 text-gray-900 shadow-sm shadow-amber-500/40'
                                                : 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                                            : 'bg-white/5 border border-white/[0.08]'
                                        }`}>
                                    {i < side.wins ? '✓' : ''}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Game results strip */}
            {series.games.filter(g => g.status === 'completed').length > 0 && (
                <div className="relative px-4 pb-3 flex gap-1.5 flex-wrap border-t border-white/[0.04] pt-2">
                    {series.games.filter(g => g.status !== 'cancelled').map(g => {
                        const played = g.status === 'completed';
                        const seriesHomeIsGameHome = g.home_team_id === series.home_team_id;
                        const seriesHomeSets = played ? (seriesHomeIsGameHome ? g.home_sets : g.away_sets) : null;
                        const seriesAwaySets = played ? (seriesHomeIsGameHome ? g.away_sets : g.home_sets) : null;
                        const seriesHomeWonGame = seriesHomeSets !== null && seriesAwaySets !== null && seriesHomeSets > seriesAwaySets;
                        return (
                            <div key={g.id} className={`text-center px-2 py-1 rounded-lg text-[9px] font-bold
                                ${!played ? 'bg-white/5 text-gray-600 border border-white/5' :
                                  seriesHomeWonGame ? 'bg-blue-500/15 text-blue-300 border border-blue-500/20' : 'bg-orange-500/15 text-orange-300 border border-orange-500/20'}
                            `}>
                                <div className="text-[8px] text-gray-600 mb-0.5 uppercase tracking-wider">G{g.game_number}</div>
                                {played ? `${seriesHomeSets}-${seriesAwaySets}` : '·'}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ─── Round Header ─────────────────────────────────────────────────────────────

function RoundHeader({ label, icon: Icon, accent = false }: { label: string; icon: React.ElementType; accent?: boolean }) {
    return (
        <div className={`flex items-center gap-3 mb-6`}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0
                ${accent ? 'bg-amber-500/20 border border-amber-500/30' : 'bg-white/5 border border-white/10'}`}>
                <Icon size={16} className={accent ? 'text-amber-400' : 'text-gray-400'} />
            </div>
            <div>
                <h2 className={`text-sm font-black uppercase tracking-[0.2em]
                    ${accent ? 'text-amber-400' : 'text-gray-400'}`}>
                    {label}
                </h2>
            </div>
            <div className={`flex-1 h-px ${accent ? 'bg-amber-500/20' : 'bg-white/5'}`} />
        </div>
    );
}

// ─── Conference column ────────────────────────────────────────────────────────

function ConferenceColumn({ title, series, userTeamId }: { title: string; series: PlayoffSeries[]; userTeamId: number | null }) {
    return (
        <div className="space-y-6">
            <p className="text-[10px] text-gray-600 uppercase tracking-[0.2em] font-bold px-1 flex items-center gap-2">
                <Shield size={10} className="text-gray-600" />
                {title}
            </p>
            {series.length ? series.map(s => (
                <SeriesCard key={s.id} series={s} userTeamId={userTeamId} />
            )) : (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-8 text-center">
                    <span className="text-xs text-gray-700">TBD</span>
                </div>
            )}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PlayoffsPage() {
    const { team: userTeam } = useAuth();
    const [bracket, setBracket] = useState<PlayoffBracket | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/playoffs')
            .then(r => r.ok ? r.json() : null)
            .then((data: PlayoffBracket | null) => { setBracket(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="relative mx-auto w-16 h-16">
                        <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-ping" />
                        <div className="relative w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                            <Loader2 size={28} className="text-amber-400 animate-spin" />
                        </div>
                    </div>
                    <p className="text-sm text-gray-500 font-medium">Loading bracket...</p>
                </div>
            </div>
        );
    }

    if (!bracket || bracket.status === 'not_started') {
        return (
            <div className="space-y-6">
                {/* Page header */}
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Trophy size={22} className="text-amber-400" />
                        <h1 className="text-2xl font-black text-white tracking-tight">Playoffs</h1>
                    </div>
                    <p className="text-sm text-gray-500">Championship bracket</p>
                </div>

                {/* Not started state */}
                <div className="relative rounded-3xl border border-white/10 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-orange-500/5" />
                    <div className="relative py-24 px-8 text-center space-y-6">
                        <div className="relative mx-auto w-20 h-20">
                            <div className="absolute inset-0 rounded-full bg-amber-500/10 animate-pulse" />
                            <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/20 flex items-center justify-center">
                                <Trophy size={36} className="text-amber-400/60" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-black text-white">Playoffs Haven&apos;t Started</h2>
                            <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
                                The playoffs begin after the regular season ends on Aug 31.
                                Top 4 teams from each conference will qualify.
                            </p>
                        </div>
                        <div className="flex items-center justify-center gap-6 text-xs text-gray-600">
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500/60" />
                                <span>8 teams compete</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500/60" />
                                <span>Best-of-5 series</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500/60" />
                                <span>3 rounds</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const northR1 = bracket.round1.filter(s => s.conference === 'north');
    const southR1 = bracket.round1.filter(s => s.conference === 'south');
    const northR2 = bracket.round2.filter(s => s.conference === 'north');
    const southR2 = bracket.round2.filter(s => s.conference === 'south');
    const userTeamId = userTeam?.id ?? null;
    const isCompleted = bracket.status === 'completed';

    return (
        <div className="space-y-14">

            {/* ── Page Header ── */}
            <div className="relative pb-24 mb-8">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <div className="flex items-center gap-2.5 mb-6">
                            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                                <Trophy size={20} className="text-amber-400" />
                            </div>
                            <h1 className="text-2xl font-black text-white tracking-tight">
                                {bracket.year} Playoffs
                            </h1>
                        </div>
                        <p className="text-sm text-gray-500 pl-[52px]">IVL Championship Bracket</p>
                    </div>
                    <div className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border
                        ${isCompleted
                            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                            : 'text-amber-400 bg-amber-500/10 border-amber-500/20 animate-pulse'
                        }`}>
                        {isCompleted ? 'Season Complete' : 'In Progress'}
                    </div>
                </div>
            </div>

            {/* ── Champion Banner ── */}
            {bracket.champion && (
                <div className="relative rounded-2xl overflow-hidden border border-amber-500/30">
                    {/* Background layers */}
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/5" />
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_left,rgba(251,191,36,0.12),transparent_60%)]" />

                    <div className="relative flex items-center gap-5 px-6 py-5">
                        {/* Trophy icon */}
                        <div className="relative shrink-0">
                            <div className="absolute inset-0 rounded-2xl bg-amber-500/20 blur-md" />
                            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400/20 to-orange-500/10 border border-amber-500/30 flex items-center justify-center">
                                <Crown size={28} className="text-amber-400" />
                            </div>
                        </div>
                        {/* Champion info */}
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-amber-500/70 uppercase tracking-[0.2em] font-bold mb-1">
                                {bracket.year} IVL Champion
                            </p>
                            <p className="text-2xl font-black text-amber-300 truncate">
                                {bracket.champion.teamName}
                            </p>
                        </div>
                        {/* Team logo */}
                        <div className="shrink-0 opacity-80">
                            <TeamLogo teamId={bracket.champion.teamId} size={56} />
                        </div>
                    </div>
                </div>
            )}

            {/* ── Round 1 — Conference Semifinals ── */}
            <div>
                <RoundHeader label="Conference Semifinals" icon={Swords} />
                <div className="flex w-full">
                    <div className="flex-1 min-w-0 pr-6 lg:pr-10">
                        <ConferenceColumn title="North Conference" series={northR1} userTeamId={userTeamId} />
                    </div>
                    <div className="w-px bg-white/[0.06] shrink-0 my-2" />
                    <div className="flex-1 min-w-0 pl-6 lg:pl-10">
                        <ConferenceColumn title="South Conference" series={southR1} userTeamId={userTeamId} />
                    </div>
                </div>
            </div>

            {/* ── Connector arrow ── */}
            <div className="flex items-center justify-center -my-4">
                <div className="flex flex-col items-center gap-1.5">
                    <div className="w-px h-8 bg-gradient-to-b from-transparent to-white/15" />
                    <ChevronRight size={18} className="text-gray-600 rotate-90" />
                    <div className="w-px h-8 bg-gradient-to-b from-white/15 to-transparent" />
                </div>
            </div>

            {/* ── Round 2 — Conference Finals ── */}
            <div>
                <RoundHeader label="Conference Finals" icon={Flame} />
                <div className="flex w-full">
                    <div className="flex-1 min-w-0 pr-6 lg:pr-10">
                        <ConferenceColumn
                            title="North Conference"
                            series={northR2.length ? northR2 : []}
                            userTeamId={userTeamId}
                        />
                    </div>
                    <div className="w-px bg-white/[0.06] shrink-0 my-2" />
                    <div className="flex-1 min-w-0 pl-6 lg:pl-10">
                        <ConferenceColumn
                            title="South Conference"
                            series={southR2.length ? southR2 : []}
                            userTeamId={userTeamId}
                        />
                    </div>
                </div>
                {!northR2.length && !southR2.length && (
                    <p className="text-center text-xs text-gray-700 mt-4">
                        {bracket.round1.some(s => s.status !== 'completed') ? 'Awaiting Semifinal results' : 'TBD'}
                    </p>
                )}
            </div>

            {/* ── Connector arrow ── */}
            <div className="flex items-center justify-center -my-4">
                <div className="flex flex-col items-center gap-1.5">
                    <div className="w-px h-8 bg-gradient-to-b from-transparent to-amber-500/25" />
                    <ChevronRight size={18} className="text-amber-600 rotate-90" />
                    <div className="w-px h-8 bg-gradient-to-b from-amber-500/25 to-transparent" />
                </div>
            </div>

            {/* ── Round 3 — Grand Final ── */}
            <div>
                <RoundHeader label="Grand Final" icon={Star} accent />
                {bracket.round3.length ? (
                    <div className="max-w-lg mx-auto">
                        {bracket.round3.map(s => (
                            <SeriesCard key={s.id} series={s} userTeamId={userTeamId} isFinal />
                        ))}
                    </div>
                ) : (
                    <div className="max-w-lg mx-auto rounded-2xl border border-amber-500/10 bg-amber-500/[0.02] p-10 text-center">
                        <Crown size={28} className="text-amber-500/20 mx-auto mb-3" />
                        <p className="text-xs text-gray-700 font-medium">
                            {bracket.round2.some(s => s.status !== 'completed') ? 'Awaiting Conference Finals' : 'TBD'}
                        </p>
                    </div>
                )}
            </div>

            {/* ── Legend ── */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 border-t border-white/[0.04] justify-center">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-emerald-500/60" />
                    <span className="text-[11px] text-gray-600">Series winner</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-amber-500/60" />
                    <span className="text-[11px] text-gray-600">Champion</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded border border-amber-400/30 bg-amber-500/[0.04]" />
                    <span className="text-[11px] text-gray-600">Your team</span>
                </div>
            </div>
        </div>
    );
}
