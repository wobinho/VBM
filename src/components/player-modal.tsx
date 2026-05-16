'use client';
import Image from 'next/image';
import { X, History, TrendingUp, Calendar, DollarSign, Ruler, Cake, FileSignature } from 'lucide-react';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getCountryName, getCountryCode } from '@/lib/country-codes';

interface Player {
    id: number; player_name: string; position: string; age: number; country: string;
    jersey_number: number; overall: number; height?: number;
    attack: number; defense: number; serve: number; block: number; receive: number; setting: number;
    precision?: number; flair?: number; digging?: number; positioning?: number;
    ball_control?: number; technique?: number; playmaking?: number; spin?: number;
    speed?: number; agility?: number; strength?: number; endurance?: number;
    vertical?: number; flexibility?: number; torque?: number; balance?: number;
    leadership?: number; teamwork?: number; concentration?: number; pressure?: number;
    consistency?: number; vision?: number; game_iq?: number; intimidation?: number;
    contract_years?: number; monthly_wage?: number; player_value?: number;
    team_id?: number | null; team_name?: string; team_country?: string;
}

type Theme = {
    badge: string; badgeSolid: string; bar: string; text: string;
    ring: string; glow: string; photoGlow: string; radial: string;
};

function getTheme(position: string): Theme {
    const map: Record<string, Theme> = {
        'Setter': { badge: 'bg-sky-400/15 text-sky-300 border-sky-400/40', badgeSolid: 'bg-sky-400 text-black', bar: 'bg-sky-400', text: 'text-sky-300', ring: 'ring-sky-400/40', glow: 'shadow-sky-500/30', photoGlow: 'bg-sky-500/35', radial: 'from-sky-500/25 via-sky-500/[0.06]' },
        'Outside Hitter': { badge: 'bg-rose-400/15 text-rose-300 border-rose-400/40', badgeSolid: 'bg-rose-400 text-black', bar: 'bg-rose-400', text: 'text-rose-300', ring: 'ring-rose-400/40', glow: 'shadow-rose-500/30', photoGlow: 'bg-rose-500/35', radial: 'from-rose-500/25 via-rose-500/[0.06]' },
        'Middle Blocker': { badge: 'bg-violet-400/15 text-violet-300 border-violet-400/40', badgeSolid: 'bg-violet-400 text-black', bar: 'bg-violet-400', text: 'text-violet-300', ring: 'ring-violet-400/40', glow: 'shadow-violet-500/30', photoGlow: 'bg-violet-500/35', radial: 'from-violet-500/25 via-violet-500/[0.06]' },
        'Opposite Hitter': { badge: 'bg-orange-400/15 text-orange-300 border-orange-400/40', badgeSolid: 'bg-orange-400 text-black', bar: 'bg-orange-400', text: 'text-orange-300', ring: 'ring-orange-400/40', glow: 'shadow-orange-500/30', photoGlow: 'bg-orange-500/35', radial: 'from-orange-500/25 via-orange-500/[0.06]' },
        'Libero': { badge: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/40', badgeSolid: 'bg-emerald-400 text-black', bar: 'bg-emerald-400', text: 'text-emerald-300', ring: 'ring-emerald-400/40', glow: 'shadow-emerald-500/30', photoGlow: 'bg-emerald-500/35', radial: 'from-emerald-500/25 via-emerald-500/[0.06]' },
    };
    return map[position] ?? { badge: 'bg-white/10 text-zinc-300 border-white/15', badgeSolid: 'bg-zinc-300 text-black', bar: 'bg-zinc-400', text: 'text-zinc-300', ring: 'ring-white/20', glow: 'shadow-black/40', photoGlow: 'bg-white/15', radial: 'from-white/15 via-white/[0.04]' };
}

function overallTone(v: number) {
    if (v >= 85) return { text: 'text-emerald-300', tier: 'ELITE', glow: 'drop-shadow-[0_0_24px_rgba(16,185,129,0.5)]' };
    if (v >= 75) return { text: 'text-yellow-300', tier: 'STAR', glow: 'drop-shadow-[0_0_24px_rgba(250,204,21,0.5)]' };
    if (v >= 65) return { text: 'text-amber-300', tier: 'PRO', glow: 'drop-shadow-[0_0_18px_rgba(251,191,36,0.4)]' };
    if (v >= 55) return { text: 'text-zinc-200', tier: 'STARTER', glow: 'drop-shadow-[0_0_14px_rgba(228,228,231,0.3)]' };
    return { text: 'text-rose-300', tier: 'PROSPECT', glow: 'drop-shadow-[0_0_14px_rgba(244,63,94,0.3)]' };
}

// Section-specific color palettes
const SECTION_COLORS = {
    core: { bar: 'bg-amber-400', text: 'text-amber-300', label: 'text-amber-400/70', header: 'text-amber-300', divider: 'border-amber-400/20', pill: 'bg-amber-400/10 text-amber-300 border-amber-400/25' },
    technical: { bar: 'bg-sky-400', text: 'text-sky-300', label: 'text-sky-400/70', header: 'text-sky-300', divider: 'border-sky-400/20', pill: 'bg-sky-400/10 text-sky-300 border-sky-400/25' },
    physical: { bar: 'bg-rose-400', text: 'text-rose-300', label: 'text-rose-400/70', header: 'text-rose-300', divider: 'border-rose-400/20', pill: 'bg-rose-400/10 text-rose-300 border-rose-400/25' },
    mental: { bar: 'bg-purple-400', text: 'text-purple-300', label: 'text-purple-400/70', header: 'text-purple-300', divider: 'border-purple-400/20', pill: 'bg-purple-400/10 text-purple-300 border-purple-400/25' },
};

function StatBar({ label, value, sectionKey }: { label: string; value: number; sectionKey: keyof typeof SECTION_COLORS }) {
    const sc = SECTION_COLORS[sectionKey];
    const numColor = value >= 80 ? 'text-emerald-300' : value >= 60 ? 'text-yellow-300' : 'text-rose-300';
    return (
        <div className="flex items-center gap-3 group/stat">
            <span className={`font-mono text-[10px] uppercase tracking-[0.16em] ${sc.label} w-28 shrink-0 group-hover/stat:text-zinc-200 transition-colors`}>{label}</span>
            <div className="flex-1 h-[4px] bg-white/[0.06] rounded-full overflow-hidden">
                <div className={`h-full ${sc.bar} transition-all duration-700 ease-out relative`} style={{ width: `${value}%` }}>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                </div>
            </div>
            <span className={`font-mono text-xs font-bold tabular-nums w-7 text-right ${numColor}`}>{value}</span>
        </div>
    );
}

function ModalPlayerPhoto({ playerId }: { playerId: number }) {
    const [useFallback, setUseFallback] = useState(false);
    const [finalFallback, setFinalFallback] = useState(false);
    const src = useFallback ? '/assets/players/default.png' : `/assets/players/${playerId}.png`;

    if (finalFallback) {
        return (
            <div className="w-full h-full flex items-end justify-center pb-0">
                <svg viewBox="0 0 80 100" className="w-48 h-60 opacity-60" fill="none">
                    <ellipse cx="40" cy="28" rx="18" ry="20" fill="#6B7280" />
                    <path d="M10 100 Q10 60 40 58 Q70 60 70 100Z" fill="#6B7280" />
                </svg>
            </div>
        );
    }
    return (
        <Image src={src} alt="Player" fill unoptimized
            className="object-contain object-bottom drop-shadow-[0_20px_40px_rgba(0,0,0,0.7)]"
            onError={() => { if (!useFallback) setUseFallback(true); else setFinalFallback(true); }} />
    );
}

function ModalTeamBackground({ teamId }: { teamId?: number | null }) {
    const [useFallback, setUseFallback] = useState(false);
    const [failed, setFailed] = useState(false);
    if (!teamId || failed) return null;
    const src = useFallback ? '/assets/team-backgrounds/default.png' : `/assets/team-backgrounds/${teamId}.png`;
    return (
        <Image src={src} alt="" fill unoptimized
            className="object-cover object-center opacity-[0.07] mix-blend-luminosity"
            onError={() => { if (!useFallback) setUseFallback(true); else setFailed(true); }} />
    );
}

function ModalTeamLogo({ teamId }: { teamId?: number | null }) {
    const [useFallback, setUseFallback] = useState(false);
    const [failed, setFailed] = useState(false);
    if (!teamId || failed) return null;
    const src = useFallback ? '/assets/teams/default.png' : `/assets/teams/${teamId}.png`;
    return (
        <div className="relative w-14 h-14">
            <Image src={src} alt="Team" fill unoptimized className="object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.7)]"
                onError={() => { if (!useFallback) setUseFallback(true); else setFailed(true); }} />
        </div>
    );
}

function ModalCountryFlag({ countryCode }: { countryCode: string }) {
    const [failed, setFailed] = useState(false);
    const code = countryCode.length > 2 ? getCountryCode(countryCode) : countryCode.toLowerCase();
    if (failed) return (
        <div className="w-14 h-9 rounded-sm bg-zinc-700 flex items-center justify-center ring-1 ring-white/15">
            <span className="text-[10px] font-bold text-white uppercase">{code}</span>
        </div>
    );
    return (
        <div className="w-14 h-9 rounded-sm overflow-hidden shadow-lg shrink-0 ring-1 ring-white/20">
            <img src={`/assets/flags/${code}.svg`} alt={getCountryName(code)} className="w-full h-full object-cover" onError={() => setFailed(true)} />
        </div>
    );
}

function TeamCountryFlag({ code }: { code: string }) {
    const [failed, setFailed] = useState(false);
    if (failed) return null;
    return (
        <div className="w-5 h-3.5 rounded-[2px] overflow-hidden shrink-0 ring-1 ring-white/10">
            <img src={`/assets/flags/${code}.svg`} alt={getCountryName(code)} className="w-full h-full object-cover" onError={() => setFailed(true)} />
        </div>
    );
}

function VitalTile({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
    return (
        <div className="group relative flex flex-col items-start gap-1 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05] hover:border-white/[0.10] transition-colors overflow-hidden">
            <div className="flex items-center gap-1.5 text-zinc-500 group-hover:text-zinc-400 transition-colors">
                <Icon size={10} strokeWidth={2} />
                <span className="font-mono text-[9px] uppercase tracking-[0.22em] font-medium">{label}</span>
            </div>
            <div className="font-display text-lg text-zinc-50 tabular-nums leading-none">{value}</div>
        </div>
    );
}

function StatSection({ title, eyebrow, sectionKey, children }: { title: string; eyebrow?: string; sectionKey: keyof typeof SECTION_COLORS; children: React.ReactNode }) {
    const sc = SECTION_COLORS[sectionKey];
    return (
        <div>
            <div className={`flex items-baseline gap-3 mb-3 pb-1.5 border-b ${sc.divider}`}>
                <h4 className={`font-display text-base tracking-[0.06em] ${sc.header}`}>{title.toUpperCase()}</h4>
                {eyebrow && <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-zinc-600">{eyebrow}</span>}
                <div className="flex-1" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-1.5">
                {children}
            </div>
        </div>
    );
}

function TeamLogoSmall({ teamId }: { teamId?: number | null }) {
    const [failed, setFailed] = useState(false);
    if (!teamId || failed) return <div className="w-5 h-5 rounded bg-white/5 shrink-0" />;
    return (
        <div className="relative w-5 h-5 shrink-0">
            <Image src={`/assets/teams/${teamId}.png`} alt="" fill unoptimized className="object-contain" onError={() => setFailed(true)} />
        </div>
    );
}

function PlayerTeamHistory({ playerId, currentTeamId, theme }: { playerId: number; currentTeamId?: number | null; theme: Theme }) {
    const [history, setHistory] = useState<{ season_year: number; team_name: string; team_id: number | null }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/stats/players?teamId=0&playerId=${playerId}`)
            .then(r => r.ok ? r.json() : { history: [] })
            .then(d => { setHistory(d.history ?? []); setLoading(false); })
            .catch(() => setLoading(false));
    }, [playerId]);

    return (
        <div>
            <div className="flex items-baseline gap-3 mb-3 pb-1.5 border-b border-white/[0.06]">
                <h4 className="font-display text-base tracking-[0.06em] text-zinc-100 flex items-center gap-2">
                    <History size={13} className={theme.text} />
                    CAREER ARC
                </h4>
                <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-zinc-600">By season</span>
            </div>
            {loading ? (
                <div className="py-6 flex justify-center">
                    <div className={`w-5 h-5 border-2 ${theme.bar.replace('bg-', 'border-')} border-t-transparent rounded-full animate-spin`} />
                </div>
            ) : history.length === 0 ? (
                <p className="py-4 text-xs text-zinc-600 font-mono uppercase tracking-wider">No team history recorded</p>
            ) : (
                <div className="relative pl-6">
                    <div className="absolute left-[7px] top-1 bottom-1 w-px bg-white/[0.08]" />
                    <div className="space-y-2.5">
                        {history.map((h, i) => {
                            const isCurrent = h.team_id === currentTeamId;
                            return (
                                <div key={i} className="relative">
                                    <span className={`absolute -left-[22px] top-2.5 w-[9px] h-[9px] rounded-full ring-2 ring-zinc-950 ${isCurrent ? theme.bar : 'bg-zinc-600'}`} />
                                    <div className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors ${isCurrent ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'}`}>
                                        <span className={`font-mono text-xs font-bold tabular-nums ${isCurrent ? theme.text : 'text-zinc-500'} w-12`}>{h.season_year}</span>
                                        <TeamLogoSmall teamId={h.team_id} />
                                        <span className={`text-sm flex-1 truncate ${isCurrent ? 'text-zinc-100 font-semibold' : 'text-zinc-400'}`}>{h.team_name}</span>
                                        {isCurrent && (
                                            <span className={`font-mono text-[9px] font-bold uppercase tracking-[0.22em] px-1.5 py-0.5 rounded-sm ${theme.badgeSolid}`}>Current</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function PlayerModal({ player, onClose }: { player: Player; onClose: () => void }) {
    const formatMoney = (n: number) => n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n}`;

    const tone = overallTone(player.overall);
    const theme = getTheme(player.position);

    const physicals = [player.speed, player.agility, player.strength, player.endurance, player.vertical, player.flexibility, player.torque, player.balance].filter((v): v is number => typeof v === 'number');
    const technicals = [player.precision, player.flair, player.digging, player.positioning, player.ball_control, player.technique, player.playmaking, player.spin].filter((v): v is number => typeof v === 'number');
    const mentals = [player.leadership, player.teamwork, player.concentration, player.pressure, player.consistency, player.vision, player.game_iq, player.intimidation].filter((v): v is number => typeof v === 'number');
    const core = [player.attack, player.defense, player.serve, player.block, player.receive, player.setting];
    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

    const summary = [
        { label: 'Core', value: avg(core), sectionKey: 'core' as const, sc: SECTION_COLORS.core },
        { label: 'Technical', value: avg(technicals), sectionKey: 'technical' as const, sc: SECTION_COLORS.technical },
        { label: 'Physical', value: avg(physicals), sectionKey: 'physical' as const, sc: SECTION_COLORS.physical },
        { label: 'Mental', value: avg(mentals), sectionKey: 'mental' as const, sc: SECTION_COLORS.mental },
    ];

    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);
    if (!mounted) return null;

    return createPortal((
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
            onClick={onClose}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
            <div
                className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-xl border border-white/[0.08] shadow-[0_32px_80px_-15px_rgba(0,0,0,0.9)] bg-zinc-950"
                onClick={e => e.stopPropagation()}
            >
                {/* Position-tint top line */}
                <div className={`absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-current to-transparent ${theme.text} z-30 rounded-t-xl`} />

                {/* Close button */}
                <button onClick={onClose}
                    className="absolute top-4 right-4 z-40 w-9 h-9 rounded-lg bg-black/70 hover:bg-black/90 backdrop-blur-md ring-1 ring-white/15 hover:ring-white/30 flex items-center justify-center text-zinc-300 hover:text-white transition-all cursor-pointer"
                    aria-label="Close">
                    <X size={16} />
                </button>

                {/* ── HERO: split portrait + identity ── */}
                <div className="relative">
                    <div className={`absolute inset-0 bg-gradient-to-br ${theme.radial} to-transparent pointer-events-none`} />
                    <div className="absolute inset-0 pointer-events-none"><ModalTeamBackground teamId={player.team_id} /></div>
                    <div className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay"
                        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

                    <div className="relative grid grid-cols-1 md:grid-cols-[320px_1fr] gap-0 items-stretch">
                        {/* LEFT — Portrait (dominant); stretches to match identity column */}
                        <div className="relative min-h-[380px] overflow-hidden">
                            {/* Big glow halo */}
                            <div className={`absolute left-1/2 bottom-8 -translate-x-1/2 w-56 h-56 rounded-full ${theme.photoGlow} blur-3xl opacity-60`} />
                            {/* Player image — fills the full available height, 3:4 friendly via object-contain */}
                            <div className="absolute inset-x-0 inset-y-0 flex justify-center">
                                <div className="relative w-full h-full max-w-[340px]">
                                    <ModalPlayerPhoto playerId={player.id} />
                                </div>
                            </div>
                            {/* Floor fade */}
                            <div className="absolute bottom-0 left-0 right-0 h-36 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent pointer-events-none" />
                            {/* Side fade */}
                            <div className="absolute top-0 bottom-0 right-0 w-16 bg-gradient-to-l from-zinc-950 to-transparent pointer-events-none hidden md:block" />
                        </div>

                        {/* RIGHT — Identity */}
                        <div className="relative px-6 md:px-8 py-6 md:py-8 flex flex-col gap-5 min-w-0">
                            {/* Top meta */}
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <ModalTeamLogo teamId={player.team_id} />
                                    {player.team_name && (
                                        <div className="min-w-0">
                                            <p className="font-mono text-[9.5px] uppercase tracking-[0.28em] text-zinc-500 font-medium">Club</p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                {player.team_country && (() => {
                                                    const code = player.team_country!.length > 2 ? getCountryCode(player.team_country!) : player.team_country!.toLowerCase();
                                                    return <TeamCountryFlag code={code} />;
                                                })()}
                                                <p className="text-sm font-semibold text-zinc-200 truncate">{player.team_name}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {/* Overall + flag cluster */}
                                <div className="flex items-center gap-3 shrink-0">
                                    <div className="flex flex-col items-end">
                                        <span className="font-mono text-[9px] font-bold uppercase tracking-[0.32em] text-zinc-500">Overall</span>
                                        <div className="flex items-baseline gap-2 mt-0.5">
                                            <span className={`font-display text-5xl leading-[0.85] tabular-nums ${tone.text} ${tone.glow}`}>
                                                {player.overall}
                                            </span>
                                            <span className={`font-mono text-[9px] font-bold tracking-[0.28em] px-1.5 py-0.5 rounded-sm ${theme.badgeSolid}`}>{tone.tier}</span>
                                        </div>
                                    </div>
                                    <ModalCountryFlag countryCode={player.country} />
                                </div>
                            </div>

                            {/* Eyebrow + name */}
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`font-mono text-[10px] font-bold uppercase tracking-[0.32em] ${theme.text}`}>{player.position}</span>
                                    <span className="font-mono text-[10px] text-zinc-600">/</span>
                                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-400">#{player.jersey_number}</span>
                                    <span className="font-mono text-[10px] text-zinc-600">/</span>
                                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-400">
                                        {player.country.length > 2 ? player.country : getCountryName(player.country)}
                                    </span>
                                </div>
                                <h2 className="font-display text-5xl md:text-6xl tracking-[0.01em] text-zinc-50 leading-[0.95]">
                                    {player.player_name.toUpperCase()}
                                </h2>
                            </div>

                            {/* Top strengths radar */}
                            {(() => {
                                const allAttrs: { label: string; value: number; sec: 'core' | 'technical' | 'physical' | 'mental' }[] = [
                                    { label: 'Attack', value: player.attack, sec: 'core' },
                                    { label: 'Defense', value: player.defense, sec: 'core' },
                                    { label: 'Serve', value: player.serve, sec: 'core' },
                                    { label: 'Block', value: player.block, sec: 'core' },
                                    { label: 'Receive', value: player.receive, sec: 'core' },
                                    { label: 'Setting', value: player.setting, sec: 'core' },
                                    ...(player.precision != null ? [
                                        { label: 'Precision', value: player.precision ?? 0, sec: 'technical' as const },
                                        { label: 'Flair', value: player.flair ?? 0, sec: 'technical' as const },
                                        { label: 'Digging', value: player.digging ?? 0, sec: 'technical' as const },
                                        { label: 'Positioning', value: player.positioning ?? 0, sec: 'technical' as const },
                                        { label: 'Ball Control', value: player.ball_control ?? 0, sec: 'technical' as const },
                                        { label: 'Technique', value: player.technique ?? 0, sec: 'technical' as const },
                                        { label: 'Playmaking', value: player.playmaking ?? 0, sec: 'technical' as const },
                                        { label: 'Spin', value: player.spin ?? 0, sec: 'technical' as const },
                                    ] : []),
                                    ...(player.speed != null ? [
                                        { label: 'Speed', value: player.speed, sec: 'physical' as const },
                                        { label: 'Agility', value: player.agility ?? 0, sec: 'physical' as const },
                                        { label: 'Strength', value: player.strength ?? 0, sec: 'physical' as const },
                                        { label: 'Endurance', value: player.endurance ?? 0, sec: 'physical' as const },
                                        { label: 'Vertical', value: player.vertical ?? 0, sec: 'physical' as const },
                                    ] : []),
                                    ...(player.leadership != null ? [
                                        { label: 'Leadership', value: player.leadership, sec: 'mental' as const },
                                        { label: 'Game IQ', value: player.game_iq ?? 0, sec: 'mental' as const },
                                        { label: 'Pressure', value: player.pressure ?? 0, sec: 'mental' as const },
                                        { label: 'Concentration', value: player.concentration ?? 0, sec: 'mental' as const },
                                    ] : []),
                                ];
                                const sorted = [...allAttrs].sort((a, b) => b.value - a.value);
                                const top5 = sorted.slice(0, 5);
                                const weakest = sorted[sorted.length - 1];
                                return (
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-1 h-3.5 ${theme.bar}`} />
                                                <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.28em] text-zinc-400">Signature Strengths</span>
                                            </div>
                                            <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-zinc-600">Top 5</span>
                                        </div>
                                        <div className="space-y-1.5">
                                            {top5.map((a) => {
                                                const sc = SECTION_COLORS[a.sec];
                                                return (
                                                    <div key={a.label} className="flex items-center gap-2.5">
                                                        <span className={`font-mono text-[9.5px] uppercase tracking-[0.18em] ${sc.label} w-24 shrink-0`}>{a.label}</span>
                                                        <div className="flex-1 h-[3px] bg-white/[0.05] rounded-full overflow-hidden">
                                                            <div className={`h-full ${sc.bar} relative`} style={{ width: `${a.value}%` }}>
                                                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                                                            </div>
                                                        </div>
                                                        <span className={`font-mono text-[11px] font-bold tabular-nums w-7 text-right ${a.value >= 80 ? 'text-emerald-300' : a.value >= 60 ? 'text-yellow-300' : 'text-rose-300'}`}>{a.value}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-white/[0.05]">
                                            <span className="font-mono text-[8.5px] uppercase tracking-[0.22em] text-zinc-600">Hot</span>
                                            <span className={`font-mono text-[9.5px] font-bold uppercase tracking-[0.18em] px-1.5 py-0.5 rounded-sm ${SECTION_COLORS[top5[0].sec].pill}`}>{top5[0].label} {top5[0].value}</span>
                                            <span className="font-mono text-[8.5px] uppercase tracking-[0.22em] text-zinc-600 ml-1">Cold</span>
                                            <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.18em] px-1.5 py-0.5 rounded-sm bg-rose-400/10 text-rose-300 border border-rose-400/25">{weakest.label} {weakest.value}</span>
                                        </div>
                                    </div>
                                );
                            })()}

                        </div>
                    </div>
                </div>

                {/* ── VITALS STRIP ── */}
                <div className="relative grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 px-6 md:px-8 py-5 border-y border-white/[0.06] bg-zinc-950/80">
                    <VitalTile icon={DollarSign} label="Value" value={player.player_value ? formatMoney(player.player_value) : '—'} />
                    <VitalTile icon={FileSignature} label="Wage / mo" value={player.monthly_wage ? formatMoney(player.monthly_wage) : '—'} />
                    <VitalTile icon={Calendar} label="Contract" value={player.contract_years ? `${player.contract_years} yr` : '—'} />
                    <VitalTile icon={Cake} label="Age" value={String(player.age)} />
                    <VitalTile icon={Ruler} label="Height" value={player.height ? `${player.height} cm` : '—'} />
                </div>

                {/* ── ATTRIBUTE SUMMARY DASHBOARD ── */}
                <div className="px-6 md:px-8 py-6 border-b border-white/[0.06] bg-gradient-to-b from-white/[0.012] to-transparent">
                    <div className="flex items-baseline gap-3 mb-4">
                        <h3 className="font-display text-base tracking-[0.06em] text-zinc-100 flex items-center gap-2">
                            <TrendingUp size={14} className={theme.text} />
                            ATTRIBUTE BREAKDOWN
                        </h3>
                        <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-zinc-600">Section averages</span>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {summary.map(s => {
                            const filled = Math.max(0, Math.min(100, s.value));
                            return (
                                <div key={s.label} className={`relative rounded-lg border ${s.sc.pill.includes('border') ? '' : 'border-white/[0.05]'} bg-white/[0.02] p-3.5 overflow-hidden border-white/[0.05]`}>
                                    <div className={`absolute bottom-0 left-0 right-0 h-[2px] ${s.sc.bar}`} style={{ opacity: filled / 100 }} />
                                    <div className="flex items-baseline justify-between mb-2">
                                        <span className={`font-mono text-[10px] uppercase tracking-[0.22em] font-bold ${s.sc.text}`}>{s.label}</span>
                                    </div>
                                    <div className={`font-display text-4xl tabular-nums leading-none ${s.value >= 80 ? 'text-emerald-300' : s.value >= 60 ? 'text-yellow-300' : 'text-rose-300'}`}>
                                        {s.value || '—'}
                                    </div>
                                    <div className="mt-3 flex gap-[3px] h-2">
                                        {Array.from({ length: 10 }).map((_, i) => (
                                            <div key={i} className={`flex-1 rounded-[1px] ${i < Math.round(s.value / 10) ? s.sc.bar : 'bg-white/[0.06]'}`} />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── STAT GRID ── */}
                <div className="px-6 md:px-8 py-6 space-y-7">
                    <StatSection title="Core Skills" eyebrow="On-court fundamentals" sectionKey="core">
                        <StatBar label="Attack"  value={player.attack}  sectionKey="core" />
                        <StatBar label="Defense" value={player.defense} sectionKey="core" />
                        <StatBar label="Serve"   value={player.serve}   sectionKey="core" />
                        <StatBar label="Block"   value={player.block}   sectionKey="core" />
                        <StatBar label="Receive" value={player.receive} sectionKey="core" />
                        <StatBar label="Setting" value={player.setting} sectionKey="core" />
                    </StatSection>

                    {player.precision != null && (
                        <StatSection title="Technical" eyebrow="Skill & finesse" sectionKey="technical">
                            <StatBar label="Precision"    value={player.precision}        sectionKey="technical" />
                            <StatBar label="Flair"        value={player.flair ?? 0}        sectionKey="technical" />
                            <StatBar label="Digging"      value={player.digging ?? 0}      sectionKey="technical" />
                            <StatBar label="Positioning"  value={player.positioning ?? 0}  sectionKey="technical" />
                            <StatBar label="Ball Control" value={player.ball_control ?? 0} sectionKey="technical" />
                            <StatBar label="Technique"    value={player.technique ?? 0}    sectionKey="technical" />
                            <StatBar label="Playmaking"   value={player.playmaking ?? 0}   sectionKey="technical" />
                            <StatBar label="Spin"         value={player.spin ?? 0}         sectionKey="technical" />
                        </StatSection>
                    )}

                    {player.speed != null && (
                        <StatSection title="Physical" eyebrow="Body & athletic capacity" sectionKey="physical">
                            <StatBar label="Speed"       value={player.speed}            sectionKey="physical" />
                            <StatBar label="Agility"     value={player.agility ?? 0}     sectionKey="physical" />
                            <StatBar label="Strength"    value={player.strength ?? 0}    sectionKey="physical" />
                            <StatBar label="Endurance"   value={player.endurance ?? 0}   sectionKey="physical" />
                            <StatBar label="Vertical"    value={player.vertical ?? 0}    sectionKey="physical" />
                            <StatBar label="Flexibility" value={player.flexibility ?? 0} sectionKey="physical" />
                            <StatBar label="Torque"      value={player.torque ?? 0}      sectionKey="physical" />
                            <StatBar label="Balance"     value={player.balance ?? 0}     sectionKey="physical" />
                        </StatSection>
                    )}

                    {player.leadership != null && (
                        <StatSection title="Mental" eyebrow="Mindset & composure" sectionKey="mental">
                            <StatBar label="Leadership"    value={player.leadership}           sectionKey="mental" />
                            <StatBar label="Teamwork"      value={player.teamwork ?? 0}        sectionKey="mental" />
                            <StatBar label="Concentration" value={player.concentration ?? 0}   sectionKey="mental" />
                            <StatBar label="Pressure"      value={player.pressure ?? 0}        sectionKey="mental" />
                            <StatBar label="Consistency"   value={player.consistency ?? 0}     sectionKey="mental" />
                            <StatBar label="Vision"        value={player.vision ?? 0}          sectionKey="mental" />
                            <StatBar label="Game IQ"       value={player.game_iq ?? 0}         sectionKey="mental" />
                            <StatBar label="Intimidation"  value={player.intimidation ?? 0}    sectionKey="mental" />
                        </StatSection>
                    )}

                    <PlayerTeamHistory playerId={player.id} currentTeamId={player.team_id} theme={theme} />
                </div>
            </div>
        </div>
    ), document.body);
}
