'use client';
import Image from 'next/image';
import { useState } from 'react';
import { getCountryName, getCountryCode } from '@/lib/country-codes';

interface Player {
    id: number; player_name: string; position: string; age: number; country: string;
    jersey_number: number; overall: number; height?: number;
    attack: number; defense: number; serve: number; block: number; receive: number; setting: number;
    player_value: number; team_name?: string; team_id?: number | null;
    [key: string]: any;
}

function getPositionAbbrev(pos: string) {
    const map: Record<string, string> = { 'Setter': 'S', 'Outside Hitter': 'OH', 'Middle Blocker': 'MB', 'Opposite Hitter': 'OPP', 'Libero': 'L' };
    return map[pos] || pos.substring(0, 2).toUpperCase();
}

type PositionTheme = {
    badge: string;
    ring: string;
    glow: string;
    bar: string;
    text: string;
    bgWash: string;
    photoGlow: string;
    shadowHex: string;
    accent: string;
};

function getPositionTheme(position: string): PositionTheme {
    const map: Record<string, PositionTheme> = {
        'Setter': {
            badge: 'bg-sky-400/15 text-sky-300 border-sky-400/40',
            ring: 'ring-sky-400/40',
            glow: 'from-sky-500/30 via-sky-500/10',
            bar: 'bg-sky-400',
            text: 'text-sky-300',
            bgWash: 'from-sky-500/[0.15] via-sky-500/[0.05]',
            photoGlow: 'bg-sky-500/40',
            shadowHex: '14,165,233',
            accent: 'border-sky-400/50',
        },
        'Outside Hitter': {
            badge: 'bg-rose-400/15 text-rose-300 border-rose-400/40',
            ring: 'ring-rose-400/40',
            glow: 'from-rose-500/30 via-rose-500/10',
            bar: 'bg-rose-400',
            text: 'text-rose-300',
            bgWash: 'from-rose-500/[0.15] via-rose-500/[0.05]',
            photoGlow: 'bg-rose-500/40',
            shadowHex: '244,63,94',
            accent: 'border-rose-400/50',
        },
        'Middle Blocker': {
            badge: 'bg-violet-400/15 text-violet-300 border-violet-400/40',
            ring: 'ring-violet-400/40',
            glow: 'from-violet-500/30 via-violet-500/10',
            bar: 'bg-violet-400',
            text: 'text-violet-300',
            bgWash: 'from-violet-500/[0.15] via-violet-500/[0.05]',
            photoGlow: 'bg-violet-500/40',
            shadowHex: '139,92,246',
            accent: 'border-violet-400/50',
        },
        'Opposite Hitter': {
            badge: 'bg-orange-400/15 text-orange-300 border-orange-400/40',
            ring: 'ring-orange-400/40',
            glow: 'from-orange-500/30 via-orange-500/10',
            bar: 'bg-orange-400',
            text: 'text-orange-300',
            bgWash: 'from-orange-500/[0.15] via-orange-500/[0.05]',
            photoGlow: 'bg-orange-500/40',
            shadowHex: '249,115,22',
            accent: 'border-orange-400/50',
        },
        'Libero': {
            badge: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/40',
            ring: 'ring-emerald-400/40',
            glow: 'from-emerald-500/30 via-emerald-500/10',
            bar: 'bg-emerald-400',
            text: 'text-emerald-300',
            bgWash: 'from-emerald-500/[0.15] via-emerald-500/[0.05]',
            photoGlow: 'bg-emerald-500/40',
            shadowHex: '16,185,129',
            accent: 'border-emerald-400/50',
        },
    };
    return map[position] ?? {
        badge: 'bg-white/10 text-zinc-300 border-white/15',
        ring: 'ring-white/20',
        glow: 'from-white/15 via-white/5',
        bar: 'bg-zinc-400',
        text: 'text-zinc-300',
        bgWash: 'from-white/[0.08] via-white/[0.03]',
        photoGlow: 'bg-white/20',
        shadowHex: '120,120,140',
        accent: 'border-white/20',
    };
}

function overallTone(v: number) {
    if (v >= 85) return { text: 'text-emerald-300', glow: 'shadow-emerald-500/40', tier: 'ELITE' };
    if (v >= 75) return { text: 'text-yellow-300', glow: 'shadow-yellow-500/30', tier: 'STAR' };
    if (v >= 65) return { text: 'text-amber-300', glow: 'shadow-amber-500/25', tier: 'PRO' };
    if (v >= 55) return { text: 'text-zinc-300', glow: 'shadow-zinc-500/20', tier: 'STARTER' };
    return { text: 'text-rose-300', glow: 'shadow-rose-500/20', tier: 'DEV' };
}

function MiniStatBar({ value, bar }: { value: number; bar: string }) {
    return (
        <div className="flex-1 h-[3px] bg-white/[0.06] overflow-hidden rounded-full">
            <div className={`h-full ${bar} transition-all duration-500`} style={{ width: `${value}%` }} />
        </div>
    );
}

function PlayerPhoto({ playerId }: { playerId: number }) {
    const [useFallback, setUseFallback] = useState(false);
    const [finalFallback, setFinalFallback] = useState(false);
    const src = useFallback ? '/assets/players/default.png' : `/assets/players/${playerId}.png`;

    if (finalFallback) {
        return (
            <div className="w-full h-full flex items-end justify-center pb-4">
                <svg viewBox="0 0 80 100" className="w-3/4 h-3/4 opacity-30" fill="none">
                    <ellipse cx="40" cy="28" rx="18" ry="20" fill="#4B5563" />
                    <path d="M10 100 Q10 60 40 58 Q70 60 70 100Z" fill="#4B5563" />
                </svg>
            </div>
        );
    }

    return (
        <Image
            src={src}
            alt="Player"
            fill
            unoptimized
            className="object-cover object-top drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)]"
            onError={() => {
                if (!useFallback) setUseFallback(true);
                else setFinalFallback(true);
            }}
        />
    );
}

function TeamLogo({ teamId }: { teamId?: number | null }) {
    const [useFallback, setUseFallback] = useState(false);
    const [failed, setFailed] = useState(false);
    if (!teamId || failed) return null;
    const src = useFallback ? '/assets/teams/default.png' : `/assets/teams/${teamId}.png`;
    return (
        <div className="relative w-8 h-8">
            <Image src={src} alt="Team" fill unoptimized className="object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                onError={() => { if (!useFallback) setUseFallback(true); else setFailed(true); }} />
        </div>
    );
}

function CountryFlag({ countryCode }: { countryCode: string }) {
    const [failed, setFailed] = useState(false);
    const code = countryCode.length > 2 ? getCountryCode(countryCode) : countryCode.toLowerCase();
    if (failed) return (
        <div className="w-7 h-5 rounded-sm bg-zinc-700 flex items-center justify-center ring-1 ring-white/10">
            <span className="text-[8px] font-bold text-white uppercase">{code}</span>
        </div>
    );
    return (
        <div className="w-7 h-5 rounded-sm overflow-hidden ring-1 ring-white/20 shadow-md">
            <img src={`/assets/flags/${code}.svg`} alt={getCountryName(code)} className="w-full h-full object-cover" loading="lazy" onError={() => setFailed(true)} />
        </div>
    );
}

export default function PlayerCard({ player, onClick, compact = false, onSign, onShortlist, shortlistLabel }: {
    player: Player; onClick?: () => void; compact?: boolean;
    onSign?: (player: Player) => void; onShortlist?: (player: Player) => void; shortlistLabel?: string;
}) {
    const formatMoney = (n: number) => n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n}`;

    if (compact) {
        const countryDisplay = player.country.length > 2 ? player.country : getCountryName(player.country);
        const tone = overallTone(player.overall);
        const theme = getPositionTheme(player.position);
        return (
            <div
                className="group flex items-center gap-3 p-2.5 sm:p-3 rounded-md bg-white/[0.025] border border-white/[0.05] hover:border-yellow-400/40 hover:bg-white/[0.06] transition-all cursor-pointer relative overflow-hidden"
                onClick={onClick}
            >
                <div className={`absolute inset-y-0 left-0 w-[3px] ${theme.bar} opacity-70 group-hover:opacity-100 transition-opacity`} />
                <div className="w-10 h-10 rounded bg-yellow-400/10 border border-yellow-400/25 flex items-center justify-center font-display text-sm text-yellow-300 shrink-0 tabular-nums">
                    {player.jersey_number}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-100 truncate group-hover:text-yellow-300 transition-colors">{player.player_name}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{getPositionAbbrev(player.position)} · {countryDisplay}</p>
                </div>
                <div className={`font-display text-2xl shrink-0 tabular-nums ${tone.text}`}>
                    {player.overall}
                </div>
            </div>
        );
    }

    const theme = getPositionTheme(player.position);
    const tone = overallTone(player.overall);
    const stats = [
        { label: 'ATK', value: player.attack },
        { label: 'DEF', value: player.defense },
        { label: 'SRV', value: player.serve },
        { label: 'BLK', value: player.block },
        { label: 'RCV', value: player.receive },
        { label: 'SET', value: player.setting },
    ];

    return (
        <div
            className={`group relative w-full rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl border ${theme.accent} bg-zinc-950`}
            style={{ boxShadow: `0 0 0 0 rgba(${theme.shadowHex},0)`, transition: 'transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease' }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 20px 60px -10px rgba(${theme.shadowHex},0.35)`)}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = `0 0 0 0 rgba(${theme.shadowHex},0)`)}
            onClick={onClick}
        >
            {/* Top accent line */}
            <div className={`absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-current to-transparent ${theme.text} opacity-90 z-20`} />

            {/* ── PORTRAIT ZONE (dominant, 3:4 aspect ratio) ── */}
            <div className={`relative aspect-[3/4] overflow-hidden bg-gradient-to-b ${theme.bgWash} to-zinc-950`}>
                {/* Radial glow behind player */}
                <div className={`absolute inset-x-0 bottom-0 mx-auto h-40 w-40 rounded-full ${theme.photoGlow} blur-3xl opacity-50 pointer-events-none`} />

                {/* Subtle grid texture */}
                <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
                    style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

                {/* Overall rating — top left glass badge */}
                <div className="absolute top-3 left-3 z-20 flex flex-col items-center">
                    <div className={`px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md ring-1 ${theme.ring} shadow-lg`}>
                        <div className={`font-display text-3xl leading-none tabular-nums ${tone.text}`}>{player.overall}</div>
                    </div>
                    <span className={`mt-1 font-mono text-[8px] font-bold tracking-[0.3em] ${theme.text} bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded-md`}>{tone.tier}</span>
                </div>

                {/* Country flag — top right */}
                <div className="absolute top-3 right-3 z-20">
                    <CountryFlag countryCode={player.country} />
                </div>

                {/* Player photo — fills full 3:4 portrait area edge-to-edge */}
                <div className="absolute inset-0 z-10">
                    <PlayerPhoto playerId={player.id} />
                </div>

                {/* Bottom vignette */}
                <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent pointer-events-none z-10" />
            </div>

            {/* ── NAME + META ── */}
            <div className="relative px-4 pt-3 pb-2 bg-zinc-950">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <h3 className="font-display text-base tracking-wide text-zinc-50 leading-tight truncate">{player.player_name.toUpperCase()}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`font-mono text-[9px] font-bold uppercase tracking-[0.2em] ${theme.text}`}>{player.position}</span>
                            <span className="font-mono text-[9px] text-zinc-600">·</span>
                            <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-wider truncate">{player.country.length > 2 ? player.country : getCountryName(player.country)}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                        <TeamLogo teamId={player.team_id} />
                        <span className={`font-mono text-[11px] font-bold tabular-nums ${theme.text}`}>#{player.jersey_number}</span>
                    </div>
                </div>
            </div>

            {/* ── VITALS ── */}
            <div className="px-4 py-2.5 bg-zinc-950 border-t border-white/[0.04]">
                <div className="grid grid-cols-3 divide-x divide-white/[0.05]">
                    {[
                        { label: 'VAL', value: formatMoney(player.player_value) },
                        { label: 'AGE', value: player.age },
                        { label: 'HT', value: player.height ? `${player.height}` : '—' },
                    ].map(s => (
                        <div key={s.label} className="text-center px-1 first:pl-0 last:pr-0">
                            <div className="font-display text-sm tracking-wider text-zinc-100 leading-none tabular-nums">{s.value}</div>
                            <div className="font-mono text-[8px] uppercase tracking-[0.22em] text-zinc-600 mt-0.5">{s.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── MINI STAT BARS ── */}
            <div className="px-4 pb-3 pt-2.5 bg-zinc-950 border-t border-white/[0.04]">
                <div className="grid grid-cols-3 gap-x-3 gap-y-1.5">
                    {stats.map(s => {
                        const numColor = s.value >= 80 ? 'text-emerald-300' : s.value >= 60 ? 'text-yellow-300' : 'text-rose-300';
                        return (
                            <div key={s.label} className="flex items-center gap-1.5">
                                <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-zinc-500 w-7 shrink-0">{s.label}</span>
                                <MiniStatBar value={s.value} bar={theme.bar} />
                                <span className={`font-mono text-[9px] font-bold tabular-nums w-5 text-right ${numColor}`}>{s.value}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── ACTIONS ── */}
            {(onSign || onShortlist) && (
                <div className="grid grid-cols-2 gap-px bg-black border-t border-white/[0.06]">
                    {onSign && (
                        <button onClick={e => { e.stopPropagation(); onSign(player); }}
                            className="py-2.5 font-display text-[11px] tracking-[0.18em] uppercase bg-yellow-400 text-black hover:bg-yellow-300 transition-colors duration-150 cursor-pointer">
                            Sign Player
                        </button>
                    )}
                    {onShortlist && (
                        <button onClick={e => { e.stopPropagation(); onShortlist(player); }}
                            className={`py-2.5 font-display text-[11px] tracking-[0.18em] uppercase transition-colors duration-150 cursor-pointer ${
                                shortlistLabel && shortlistLabel.startsWith('✓')
                                    ? 'bg-yellow-400/10 text-yellow-300 hover:bg-rose-500/15 hover:text-rose-300'
                                    : 'bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08] hover:text-zinc-50'
                            }`}>
                            {shortlistLabel ?? '+ Shortlist'}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
