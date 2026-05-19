'use client';
import { useState, useEffect } from 'react';
import { Trophy, Star, Flame, Crown, Shield, Swords, ChevronRight, Loader2, History } from 'lucide-react';
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
    leagueName: string | null;
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
        ? { label: 'Final', cls: 'text-[var(--win)] bg-[var(--win)]/15 border border-[var(--win)]/30' }
        : isLive
        ? { label: 'Live', cls: 'text-[var(--volt)] bg-[var(--volt)]/15 border border-[var(--volt)]/30 animate-pulse' }
        : { label: 'Upcoming', cls: 'text-[var(--ink-400)] bg-white/[0.04] border border-white/[0.08]' };

    const sides = [
        { teamId: series.home_team_id, name: series.home_team_name, wins: series.home_wins, won: homeWon, seed: series.seed_high },
        { teamId: series.away_team_id, name: series.away_team_name, wins: series.away_wins, won: awayWon, seed: series.seed_low },
    ];

    return (
        <div className={`surface-raised relative overflow-hidden transition-all duration-300 cursor-default
            ${isFinal ? 'border-[var(--volt)]/45 shadow-2xl shadow-[var(--volt)]/15'
                : isUserInvolved ? 'border-[var(--volt)]/35 shadow-lg shadow-[var(--volt)]/5'
                : ''
            }
        `}>
            {isFinal && (
                <>
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-[var(--volt)]" />
                    <div className="absolute inset-0 bg-gradient-to-br from-[var(--volt)]/8 via-transparent to-transparent pointer-events-none" />
                </>
            )}
            {isUserInvolved && !isFinal && (
                <div className="absolute inset-0 bg-[var(--volt)]/[0.03] pointer-events-none" />
            )}

            <div className={`relative px-4 py-2.5 flex items-center justify-between border-b
                ${isFinal ? 'border-[var(--volt)]/20' : 'border-white/[0.05]'}
            `}>
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--ink-500)]">
                    {series.conference
                        ? `${series.conference.charAt(0).toUpperCase() + series.conference.slice(1)} // `
                        : ''}
                    #{series.seed_high} vs #{series.seed_low}
                </span>
                <span className={`font-mono text-[10px] font-bold uppercase tracking-[0.18em] px-2 py-0.5 rounded ${statusConfig.cls}`}>
                    {statusConfig.label}
                </span>
            </div>

            <div className="relative px-4 py-4 space-y-2.5">
                {sides.map((side) => (
                    <div key={side.teamId}
                        className={`flex items-center gap-3 rounded px-3 py-2.5 transition-all duration-200
                            ${side.won
                                ? isFinal
                                    ? 'bg-[var(--volt)]/15 border border-[var(--volt)]/30'
                                    : 'bg-[var(--win)]/10 border border-[var(--win)]/25'
                                : isCompleted
                                ? 'opacity-35'
                                : 'bg-white/[0.03] border border-transparent'
                            }
                        `}>
                        <TeamLogo teamId={side.teamId} size={32} />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[10px] text-[var(--ink-500)] font-bold tabular">#{side.seed}</span>
                                <span className={`font-display text-base tracking-wide truncate
                                    ${side.won && isFinal ? 'text-[var(--volt)]' :
                                      side.won ? 'text-[var(--win)]' :
                                      side.teamId === userTeamId ? 'text-[var(--volt)]' :
                                      'text-[var(--bone)]'}`}>
                                    {side.name?.toUpperCase()}
                                </span>
                                {side.won && isFinal && <Crown size={12} className="text-[var(--volt)] shrink-0" />}
                                {side.won && !isFinal && <Trophy size={11} className="text-[var(--win)] shrink-0" />}
                            </div>
                        </div>
                        <div className="flex gap-1.5 items-center">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i}
                                    className={`w-4 h-4 rounded flex items-center justify-center text-[9px] font-black transition-all
                                        ${i < side.wins
                                            ? side.won && isFinal
                                                ? 'bg-[var(--volt)] text-[var(--ink-950)]'
                                                : 'bg-[var(--win)] text-[var(--ink-950)]'
                                            : 'bg-white/[0.04] border border-white/[0.08]'
                                        }`}>
                                    {i < side.wins ? '✓' : ''}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {series.games.filter(g => g.status === 'completed').length > 0 && (
                <div className="relative px-4 pb-3 flex gap-1.5 flex-wrap border-t border-white/[0.04] pt-2.5">
                    {series.games.filter(g => g.status !== 'cancelled').map(g => {
                        const played = g.status === 'completed';
                        const seriesHomeIsGameHome = g.home_team_id === series.home_team_id;
                        const seriesHomeSets = played ? (seriesHomeIsGameHome ? g.home_sets : g.away_sets) : null;
                        const seriesAwaySets = played ? (seriesHomeIsGameHome ? g.away_sets : g.home_sets) : null;
                        const seriesHomeWonGame = seriesHomeSets !== null && seriesAwaySets !== null && seriesHomeSets > seriesAwaySets;
                        return (
                            <div key={g.id} className={`text-center px-2 py-1 rounded font-mono text-[10px] font-bold tabular
                                ${!played ? 'bg-white/5 text-[var(--ink-500)] border border-white/5' :
                                  seriesHomeWonGame ? 'bg-[var(--info)]/15 text-[var(--info)] border border-[var(--info)]/25' : 'bg-[#fb923c]/15 text-[#fdba74] border border-[#fb923c]/25'}
                            `}>
                                <div className="text-[8px] text-[var(--ink-500)] mb-0.5 uppercase tracking-wider">G{g.game_number}</div>
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
            <div className={`w-9 h-9 rounded flex items-center justify-center shrink-0
                ${accent ? 'bg-[var(--volt)]/15 border border-[var(--volt)]/35' : 'bg-white/[0.04] border border-white/[0.08]'}`}>
                <Icon size={16} className={accent ? 'text-[var(--volt)]' : 'text-[var(--ink-400)]'} />
            </div>
            <h2 className={`font-display text-xl uppercase tracking-[0.06em] ${accent ? 'text-[var(--volt)]' : 'text-[var(--bone)]'}`}>
                {label}
            </h2>
            <div className={`flex-1 h-px ${accent ? 'bg-[var(--volt)]/30' : 'bg-white/[0.06]'}`} />
        </div>
    );
}

// ─── Conference column ────────────────────────────────────────────────────────

function ConferenceColumn({ title, series, userTeamId }: { title: string; series: PlayoffSeries[]; userTeamId: number | null }) {
    return (
        <div className="space-y-6">
            <p className="font-mono text-[10px] text-[var(--ink-500)] uppercase tracking-[0.28em] font-bold px-1 flex items-center gap-2">
                <Shield size={11} className="text-[var(--ink-500)]" />
                {title}
            </p>
            {series.length ? series.map(s => (
                <SeriesCard key={s.id} series={s} userTeamId={userTeamId} />
            )) : (
                <div className="surface p-8 text-center">
                    <span className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--ink-600)]">TBD</span>
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

    // Available historical years + selected year (null = live)
    const [availableYears, setAvailableYears] = useState<number[]>([]);
    const [currentYear, setCurrentYear] = useState<number | null>(null);
    const [selectedYear, setSelectedYear] = useState<number | null>(null);

    useEffect(() => {
        fetch('/api/playoffs?list=true')
            .then(r => r.ok ? r.json() : null)
            .then((d: { years: number[]; currentYear: number | null; leagueName: string | null } | null) => {
                if (d) {
                    setAvailableYears(d.years ?? []);
                    setCurrentYear(d.currentYear ?? null);
                }
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        setLoading(true);
        const url = selectedYear !== null ? `/api/playoffs?year=${selectedYear}` : '/api/playoffs';
        fetch(url)
            .then(r => r.ok ? r.json() : null)
            .then((data: PlayoffBracket | null) => { setBracket(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, [selectedYear]);

    const isHistorical = selectedYear !== null;
    const pastYears = availableYears.filter(y => y !== currentYear);

    const yearSelector = (
        <div className="surface-raised px-5 py-3 flex items-center gap-2 flex-wrap">
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

    if (loading) {
        return (
            <div className="space-y-6 animate-fade-up">
                {yearSelector}
                <div className="min-h-[40vh] flex items-center justify-center">
                    <div className="text-center space-y-4">
                        <div className="relative mx-auto w-16 h-16">
                            <div className="absolute inset-0 rounded-full bg-[var(--volt)]/20 animate-ping" />
                            <div className="relative w-16 h-16 rounded-full bg-[var(--volt)]/10 border border-[var(--volt)]/30 flex items-center justify-center">
                                <Loader2 size={26} className="text-[var(--volt)] animate-spin" />
                            </div>
                        </div>
                        <p className="font-mono text-xs uppercase tracking-[0.28em] text-[var(--ink-500)]">Loading bracket…</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!bracket || bracket.status === 'not_started') {
        return (
            <div className="space-y-6 animate-fade-up">
                {yearSelector}
                <div className="relative pb-5 border-b border-white/[0.06]">
                    <div className="absolute -top-2 left-0 h-[3px] w-16 bg-[var(--volt)]" />
                    <p className="eyebrow mb-2">Postseason · Bracket</p>
                    <h1 className="font-display text-5xl tracking-[0.02em] text-[var(--bone)] leading-[0.85]">PLAYOFFS</h1>
                </div>

                <div className="surface-raised relative py-24 px-8 text-center space-y-6 overflow-hidden">
                    <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-[var(--volt)]/8 blur-3xl" />
                    <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-[var(--epic)]/5 blur-3xl" />
                    <div className="relative">
                        <div className="relative mx-auto w-24 h-24 mb-6">
                            <div className="absolute inset-0 rounded-full bg-[var(--volt)]/10 animate-pulse-glow" />
                            <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-[var(--volt)]/20 to-transparent border border-[var(--volt)]/30 flex items-center justify-center">
                                <Trophy size={42} className="text-[var(--volt)]/70 animate-float" />
                            </div>
                        </div>
                        <p className="eyebrow mb-2">Status</p>
                        <h2 className="font-display text-4xl tracking-[0.02em] text-[var(--bone)] mb-3">
                            {isHistorical ? `NO PLAYOFFS FOR ${selectedYear}` : 'PLAYOFFS HAVEN’T STARTED'}
                        </h2>
                        <p className="text-sm text-[var(--ink-400)] max-w-md mx-auto leading-relaxed">
                            {isHistorical
                                ? 'No postseason was recorded for this season.'
                                : 'The playoffs begin after the regular season ends on April 30. Top 4 teams from each conference qualify.'}
                        </p>
                        {!isHistorical && (
                            <div className="flex items-center justify-center gap-6 font-mono text-xs uppercase tracking-[0.18em] text-[var(--ink-500)] mt-6">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--volt)]/60" />
                                    <span>8 teams</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--volt)]/60" />
                                    <span>Best of 5</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--volt)]/60" />
                                    <span>3 rounds</span>
                                </div>
                            </div>
                        )}
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
        <div className="space-y-14 animate-fade-up">

            {yearSelector}

            {/* ── Page Header ── */}
            <div className="relative pb-5 border-b border-white/[0.06]">
                <div className="absolute -top-2 left-0 h-[3px] w-16 bg-[var(--volt)]" />
                <div className="flex items-end justify-between gap-4 flex-wrap">
                    <div>
                        <p className="eyebrow mb-2">Postseason · Bracket</p>
                        <h1 className="font-display text-5xl tracking-[0.02em] text-[var(--bone)] leading-[0.85]">
                            <span className="text-[var(--volt)]">{bracket.year}</span> PLAYOFFS
                        </h1>
                        <p className="font-mono text-xs text-[var(--ink-400)] mt-3 tracking-wider uppercase">
                            {bracket.leagueName ? `${bracket.leagueName} Championship Bracket` : 'Championship Bracket'}
                        </p>
                    </div>
                    <div className={`px-3 py-1.5 rounded font-mono text-[11px] font-bold uppercase tracking-[0.22em] border
                        ${isCompleted
                            ? 'text-[var(--win)] bg-[var(--win)]/10 border-[var(--win)]/25'
                            : 'text-[var(--volt)] bg-[var(--volt)]/10 border-[var(--volt)]/25 animate-pulse'
                        }`}>
                        {isCompleted ? 'Season Complete' : 'In Progress'}
                    </div>
                </div>
            </div>

            {/* ── Champion Banner ── */}
            {bracket.champion && (
                <div className="surface-raised relative overflow-hidden border-[var(--volt)]/35">
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-[var(--volt)]" />
                    <div className="absolute inset-0 bg-gradient-to-r from-[var(--volt)]/10 via-transparent to-transparent" />
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_left,rgba(250,204,21,0.15),transparent_60%)]" />

                    <div className="relative flex items-center gap-5 px-6 py-6">
                        <div className="relative shrink-0">
                            <div className="absolute inset-0 rounded-full bg-[var(--volt)]/25 blur-xl" />
                            <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-[var(--volt)]/25 to-transparent border-2 border-[var(--volt)]/40 flex items-center justify-center">
                                <Crown size={30} className="text-[var(--volt)]" />
                            </div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-mono text-[10px] text-[var(--volt)]/85 uppercase tracking-[0.3em] font-bold mb-1.5">
                                {bracket.year} {bracket.leagueName ? `${bracket.leagueName} ` : ''}Champion
                            </p>
                            <p className="font-display text-3xl tracking-[0.04em] text-[var(--volt)] truncate">
                                {bracket.champion.teamName.toUpperCase()}
                            </p>
                        </div>
                        <div className="shrink-0">
                            <TeamLogo teamId={bracket.champion.teamId} size={64} />
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

            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-3 border-t border-white/[0.04] justify-center">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[var(--win)]/70" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-500)]">Series winner</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[var(--volt)]" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-500)]">Champion</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full border border-[var(--volt)]/50" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-500)]">Your team</span>
                </div>
            </div>
        </div>
    );
}
