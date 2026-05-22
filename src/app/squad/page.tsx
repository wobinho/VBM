'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { GripVertical, RotateCcw, Save, Check, X as XIcon } from 'lucide-react';
import Image from 'next/image';
import PlayerModal from '@/components/player-modal';
import { getCountryName, getCountryCode } from '@/lib/country-codes';

interface Player {
    id: number; player_name: string; position: string; overall: number; jersey_number: number; age: number; country: string; height?: number;
    attack: number; defense: number; serve: number; block: number; receive: number; setting: number;
    contract_years?: number; monthly_wage?: number; player_value?: number;
    precision?: number; flair?: number; digging?: number; positioning?: number;
    ball_control?: number; technique?: number; playmaking?: number; spin?: number;
    speed?: number; agility?: number; strength?: number; endurance?: number;
    vertical?: number; flexibility?: number; torque?: number; balance?: number;
    leadership?: number; teamwork?: number; concentration?: number; pressure?: number;
    consistency?: number; vision?: number; game_iq?: number; intimidation?: number;
    team_id?: number;
}

// Position slot definitions — ordered for visual clarity (front row → back row → libero)
const POSITIONS = [
    { key: 'OH1', label: 'Outside Hitter', row: 0, col: 0 },
    { key: 'MB1', label: 'Middle Blocker', row: 0, col: 1 },
    { key: 'OPP', label: 'Opposite Hitter', row: 0, col: 2 },
    { key: 'S',   label: 'Setter',          row: 1, col: 0 },
    { key: 'MB2', label: 'Middle Blocker',  row: 1, col: 1 },
    { key: 'OH2', label: 'Outside Hitter',  row: 1, col: 2 },
    { key: 'L',   label: 'Libero',          row: 2, col: 1 },
];

// Role descriptions shown on empty slots
const SLOT_DESC: Record<string, string> = {
    OH1: 'Primary attacker & receiver',
    MB1: 'Front-row blocker & quick attack',
    OPP: 'Right-side power hitter',
    S:   'Playmaker & ball distributor',
    MB2: 'Back-row blocker & quick attack',
    OH2: 'Secondary attacker & serve receive',
    L:   'Defensive specialist',
};

type PosTheme = {
    badge: string; border: string; glow: string; slotBg: string; slotBorder: string;
    hex: string; text: string; rail: string; radial: string; chip: string; halo: string;
};

const POS_ACCENT: Record<string, PosTheme> = {
    'Setter':         { badge: 'bg-[#3b82f6]/15 text-[#60a5fa] border-[#3b82f6]/40',     border: 'border-[#3b82f6]/40', glow: 'shadow-[#3b82f6]/20', slotBg: 'bg-[#3b82f6]/[0.04]', slotBorder: 'border-[#3b82f6]/25', hex: '#3b82f6', text: 'text-[#60a5fa]', rail: 'bg-[#3b82f6]', radial: 'from-[#3b82f6]/25 via-[#3b82f6]/[0.06]', chip: 'bg-[#3b82f6] text-black', halo: 'bg-[#3b82f6]/35' },
    'Outside Hitter': { badge: 'bg-[#ef4444]/15 text-[#fca5a5] border-[#ef4444]/40',     border: 'border-[#ef4444]/40', glow: 'shadow-[#ef4444]/20', slotBg: 'bg-[#ef4444]/[0.04]', slotBorder: 'border-[#ef4444]/25', hex: '#ef4444', text: 'text-[#fca5a5]', rail: 'bg-[#ef4444]', radial: 'from-[#ef4444]/25 via-[#ef4444]/[0.06]', chip: 'bg-[#ef4444] text-black', halo: 'bg-[#ef4444]/35' },
    'Middle Blocker': { badge: 'bg-[#a78bfa]/15 text-[#c4b5fd] border-[#a78bfa]/40',     border: 'border-[#a78bfa]/40', glow: 'shadow-[#a78bfa]/20', slotBg: 'bg-[#a78bfa]/[0.04]', slotBorder: 'border-[#a78bfa]/25', hex: '#a78bfa', text: 'text-[#c4b5fd]', rail: 'bg-[#a78bfa]', radial: 'from-[#a78bfa]/25 via-[#a78bfa]/[0.06]', chip: 'bg-[#a78bfa] text-black', halo: 'bg-[#a78bfa]/35' },
    'Opposite Hitter':{ badge: 'bg-[#fb923c]/15 text-[#fdba74] border-[#fb923c]/40',     border: 'border-[#fb923c]/40', glow: 'shadow-[#fb923c]/20', slotBg: 'bg-[#fb923c]/[0.04]', slotBorder: 'border-[#fb923c]/25', hex: '#fb923c', text: 'text-[#fdba74]', rail: 'bg-[#fb923c]', radial: 'from-[#fb923c]/25 via-[#fb923c]/[0.06]', chip: 'bg-[#fb923c] text-black', halo: 'bg-[#fb923c]/35' },
    'Libero':         { badge: 'bg-[#22c55e]/15 text-[#86efac] border-[#22c55e]/40',     border: 'border-[#22c55e]/40', glow: 'shadow-[#22c55e]/20', slotBg: 'bg-[#22c55e]/[0.04]', slotBorder: 'border-[#22c55e]/25', hex: '#22c55e', text: 'text-[#86efac]', rail: 'bg-[#22c55e]', radial: 'from-[#22c55e]/25 via-[#22c55e]/[0.06]', chip: 'bg-[#22c55e] text-black', halo: 'bg-[#22c55e]/35' },
};
function posAccent(pos: string): PosTheme {
    return POS_ACCENT[pos] || { badge: 'bg-white/10 text-[var(--ink-300)] border-white/15', border: 'border-white/15', glow: 'shadow-black/20', slotBg: 'bg-white/[0.03]', slotBorder: 'border-white/15', hex: '#a1a1aa', text: 'text-zinc-300', rail: 'bg-zinc-400', radial: 'from-white/15 via-white/[0.04]', chip: 'bg-zinc-300 text-black', halo: 'bg-white/15' };
}

// Rating tier (FUT-style: Gold/Silver/Bronze) — drives plate finish
function ratingTier(v: number): { name: string; tier: 'elite' | 'gold' | 'silver' | 'bronze'; text: string; ring: string; plate: string } {
    if (v >= 85) return { name: 'ELITE', tier: 'elite', text: 'text-emerald-300', ring: 'ring-emerald-300/45', plate: 'from-emerald-300/25 via-emerald-300/[0.04] to-transparent' };
    if (v >= 75) return { name: 'GOLD',  tier: 'gold',  text: 'text-yellow-300',   ring: 'ring-yellow-300/45',   plate: 'from-yellow-300/22 via-yellow-300/[0.04] to-transparent' };
    if (v >= 65) return { name: 'PRO',   tier: 'gold',  text: 'text-amber-300',     ring: 'ring-amber-300/40',    plate: 'from-amber-300/18 via-amber-300/[0.04] to-transparent' };
    if (v >= 55) return { name: 'SILVER',tier: 'silver',text: 'text-zinc-200',      ring: 'ring-zinc-200/35',     plate: 'from-zinc-200/15 via-zinc-200/[0.04] to-transparent' };
    return         { name: 'BRONZE',tier: 'bronze',text: 'text-orange-300',     ring: 'ring-orange-300/35',   plate: 'from-orange-400/18 via-orange-400/[0.04] to-transparent' };
}
function posAbbrev(pos: string) {
    const m: Record<string, string> = { 'Setter': 'S', 'Outside Hitter': 'OH', 'Middle Blocker': 'MB', 'Opposite Hitter': 'OPP', 'Libero': 'L' };
    return m[pos] || pos.substring(0, 2).toUpperCase();
}
function overallColor(v: number) {
    return v >= 80 ? 'text-[var(--win)]' : v >= 60 ? 'text-[var(--volt)]' : 'text-[var(--loss)]';
}

// Check if a player's position is valid for a given lineup slot
function isValidForSlot(playerPosition: string, slotLabel: string): boolean {
    return playerPosition === slotLabel;
}

/* ── Shared image sub-components ── */
function PlayerPhoto({ playerId, className }: { playerId: number; className?: string }) {
    const [src, setSrc] = useState(`/assets/players/${playerId}.png`);
    const [fallback, setFallback] = useState(false);
    if (fallback) return (
        <div className={`flex items-end justify-center ${className ?? ''}`}>
            <svg viewBox="0 0 80 100" className="w-full h-full opacity-60" fill="none">
                <ellipse cx="40" cy="28" rx="18" ry="20" fill="#4B5563" />
                <path d="M10 100 Q10 60 40 58 Q70 60 70 100Z" fill="#4B5563" />
            </svg>
        </div>
    );
    return (
        <Image src={src} alt="Player" fill unoptimized className="object-contain object-bottom"
            onError={() => { if (src !== '/assets/players/default.png') setSrc('/assets/players/default.png'); else setFallback(true); }} />
    );
}

function FlagImg({ countryCode, size = 'sm' }: { countryCode: string; size?: 'sm' | 'md' }) {
    const [failed, setFailed] = useState(false);
    const dims = size === 'sm' ? 'w-7 h-5' : 'w-9 h-6';
    const code = countryCode.length > 2 ? getCountryCode(countryCode) : countryCode.toLowerCase();
    if (failed) return <span className={size === 'sm' ? 'text-sm' : 'text-base'}>🌍</span>;
    return (
        <div className={`${dims} rounded overflow-hidden shrink-0`}>
            <img src={`/assets/flags/${code}.svg`} alt={getCountryName(code)} className="w-full h-full object-cover"
                onError={() => setFailed(true)} />
        </div>
    );
}

function TeamLogoImg({ teamId, size = 10 }: { teamId?: number; size?: number }) {
    const [src, setSrc] = useState(teamId ? `/api/team-badge/${teamId}` : '');
    const [failed, setFailed] = useState(!teamId);
    if (failed) return null;
    return (
        <div className="relative" style={{ width: size * 4, height: size * 4 }}>
            <Image src={src} alt="Team" fill unoptimized className="object-contain drop-shadow-md"
                onError={() => { if (src !== '/assets/teams/default.png') setSrc('/assets/teams/default.png'); else setFailed(true); }} />
        </div>
    );
}

/* ── Bench mini-card (FUT-style trading card) ── */
function BenchCard({ player, onDragStart, onClick }: { player: Player; onDragStart: () => void; onClick: () => void }) {
    const acc = posAccent(player.position);
    const tier = ratingTier(player.overall);
    return (
        <div
            draggable
            onDragStart={onDragStart}
            onClick={onClick}
            className={`group relative rounded-md overflow-hidden cursor-grab active:cursor-grabbing transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] ring-1 ${tier.ring} hover:ring-2`}
            style={{
                background: `linear-gradient(155deg, ${acc.hex}18 0%, var(--ink-900) 38%, var(--ink-950) 100%)`,
                boxShadow: `0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px -10px ${acc.hex}55`,
            }}
        >
            {/* Position rail */}
            <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${acc.rail}`} />
            {/* Tier plate (gold/silver/bronze tint behind portrait) */}
            <div className={`absolute inset-0 bg-gradient-to-b ${tier.plate} pointer-events-none`} />
            {/* Subtle diagonal grain */}
            <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay pointer-events-none"
                style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.5) 0 1px, transparent 1px 6px)' }} />
            {/* Holographic sheen on hover */}
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-[900ms] ease-out pointer-events-none"
                style={{ background: 'linear-gradient(110deg, transparent 38%, rgba(255,255,255,0.10) 50%, transparent 62%)' }} />

            <div className="relative h-[128px]">
                {/* Top row: rating block + flag */}
                <div className="absolute top-2 left-2 z-20 flex flex-col items-center gap-0">
                    <div className={`font-display text-[34px] leading-[0.85] ${tier.text} tabular drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]`}>
                        {player.overall}
                    </div>
                    <span className={`mt-0.5 px-1.5 py-[1px] rounded-sm text-[8px] font-mono font-black tracking-[0.18em] ${acc.chip}`}>
                        {posAbbrev(player.position)}
                    </span>
                </div>
                <div className="absolute top-1.5 right-1.5 z-20">
                    <FlagImg countryCode={player.country} size="md" />
                </div>
                {/* Team logo, lower-right */}
                <div className="absolute bottom-2 right-1.5 z-20 opacity-80">
                    <TeamLogoImg teamId={player.team_id} size={8} />
                </div>
                {/* Color halo behind portrait */}
                <div className={`absolute left-1/2 bottom-2 -translate-x-1/2 w-20 h-20 rounded-full ${acc.halo} blur-2xl opacity-70 pointer-events-none`} />
                {/* Portrait — 3:4 aspect (w:h) */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[90px] h-[120px]">
                    <PlayerPhoto playerId={player.id} />
                </div>
                {/* Floor fade */}
                <div className="absolute bottom-0 left-0 right-0 h-9 pointer-events-none"
                    style={{ background: 'linear-gradient(to top, var(--ink-950), transparent)' }} />
            </div>

            {/* Name plate */}
            <div className="relative px-2.5 py-1.5 text-center"
                style={{ background: 'linear-gradient(180deg, var(--ink-900) 0%, var(--ink-950) 100%)' }}>
                <div className={`absolute top-0 left-0 right-0 h-px ${acc.rail} opacity-60`} />
                <p className="text-[11.5px] font-bold text-[var(--bone)] truncate leading-tight tracking-wide">
                    {player.player_name.toUpperCase()}
                </p>
                <div className="flex items-center justify-center gap-1.5 mt-0.5">
                    <span className="font-mono text-[8.5px] text-[var(--ink-500)] tabular tracking-wider">#{player.jersey_number}</span>
                    <span className="font-mono text-[7.5px] text-[var(--ink-600)]">·</span>
                    <span className={`font-mono text-[7.5px] font-black tracking-[0.22em] ${tier.text}`}>{tier.name}</span>
                </div>
            </div>
        </div>
    );
}

/* ── Lineup slot card (premium FUT trading card) ── */
function LineupCard({ player, posKey, onDragStart, onClick }: { player: Player; posKey: string; onDragStart: () => void; onClick: () => void }) {
    const acc = posAccent(player.position);
    const tier = ratingTier(player.overall);
    return (
        <div
            draggable
            onDragStart={onDragStart}
            onClick={onClick}
            className={`group relative rounded-md overflow-hidden cursor-grab active:cursor-grabbing hover:-translate-y-1.5 hover:scale-[1.025] transition-all duration-300 ring-1 ${tier.ring} hover:ring-2`}
            style={{
                background: `linear-gradient(160deg, ${acc.hex}22 0%, var(--ink-900) 42%, var(--ink-950) 100%)`,
                boxShadow: `0 1px 0 rgba(255,255,255,0.05) inset, 0 14px 32px -10px ${acc.hex}66, 0 0 0 1px rgba(255,255,255,0.04) inset`,
            }}
        >
            {/* Top accent stripe */}
            <div className={`absolute top-0 inset-x-0 h-[3px] ${acc.rail}`} />
            {/* Side rail */}
            <div className={`absolute left-0 top-1 bottom-1 w-[3px] ${acc.rail} opacity-60`} />
            {/* Tier plate gradient */}
            <div className={`absolute inset-0 bg-gradient-to-b ${tier.plate} pointer-events-none`} />
            {/* Diagonal grain */}
            <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay pointer-events-none"
                style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.5) 0 1px, transparent 1px 6px)' }} />
            {/* Holographic sweep */}
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-[1100ms] ease-out pointer-events-none"
                style={{ background: 'linear-gradient(110deg, transparent 38%, rgba(255,255,255,0.13) 50%, transparent 62%)' }} />

            <div className="relative h-[148px]">
                {/* Rating cluster — large hero number, position chip below */}
                <div className="absolute top-2.5 left-2.5 z-20 flex flex-col items-start">
                    <div className={`font-display text-[44px] leading-[0.82] ${tier.text} tabular drop-shadow-[0_3px_6px_rgba(0,0,0,0.7)]`}>
                        {player.overall}
                    </div>
                    <span className={`mt-1 px-1.5 py-[2px] rounded-sm text-[9px] font-mono font-black tracking-[0.22em] ${acc.chip} shadow-[0_2px_4px_rgba(0,0,0,0.4)]`}>
                        {posAbbrev(player.position)}
                    </span>
                    <span className={`mt-1 font-mono text-[8px] font-black tracking-[0.3em] ${tier.text}`}>
                        {tier.name}
                    </span>
                </div>
                {/* Flag, top-right */}
                <div className="absolute top-2 right-2 z-20">
                    <FlagImg countryCode={player.country} size="md" />
                </div>
                {/* Jersey watermark — huge number behind player */}
                <div className="absolute top-1/2 right-1 -translate-y-1/2 z-0 pointer-events-none select-none"
                    style={{
                        color: acc.hex,
                        opacity: 0.10,
                        fontSize: '92px',
                        fontFamily: 'var(--font-display)',
                        lineHeight: '0.8',
                        letterSpacing: '-0.04em',
                    }}>
                    {String(player.jersey_number).padStart(2, '0')}
                </div>
                {/* Color halo behind portrait */}
                <div className={`absolute left-1/2 bottom-2 -translate-x-1/2 w-28 h-28 rounded-full ${acc.halo} blur-3xl opacity-70 pointer-events-none`} />
                {/* Portrait — 3:4 aspect (w:h) */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[108px] h-[144px] z-10">
                    <PlayerPhoto playerId={player.id} />
                </div>
                {/* Team logo, bottom-left */}
                <div className="absolute bottom-2 left-2.5 z-20 opacity-85">
                    <TeamLogoImg teamId={player.team_id} size={9} />
                </div>
                {/* Floor fade */}
                <div className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none"
                    style={{ background: 'linear-gradient(to top, var(--ink-950), transparent)' }} />
            </div>

            {/* Name plate + stat strip */}
            <div className="relative px-3 pt-2 pb-2.5"
                style={{ background: 'linear-gradient(180deg, var(--ink-900) 0%, var(--ink-950) 100%)' }}>
                <div className={`absolute top-0 left-0 right-0 h-px ${acc.rail} opacity-70`} />
                <p className="text-[13px] font-bold text-[var(--bone)] truncate tracking-wide leading-tight">
                    {player.player_name.toUpperCase()}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-[9.5px] text-[var(--ink-500)] tabular tracking-wider">#{player.jersey_number}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 mt-2 pt-2 border-t border-white/[0.06]">
                    {[['ATK', player.attack], ['DEF', player.defense], ['OVR', player.overall]].map(([l, v]) => (
                        <div key={l as string} className="text-center">
                            <div className="font-mono text-[8px] text-[var(--ink-500)] uppercase tracking-[0.22em]">{l}</div>
                            <div className={`font-display text-base ${overallColor(v as number)} tabular leading-none mt-0.5`}>{v}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ── Empty slot with position label + drag validation visual ── */
function EmptySlot({ posKey, label, isOver, isValid, isDragging }: {
    posKey: string; label: string; isOver: boolean; isValid: boolean; isDragging: boolean;
}) {
    const acc = posAccent(label);
    const borderClass = isOver
        ? isValid
            ? 'border-emerald-400/80 shadow-lg shadow-emerald-500/20'
            : 'border-red-500/80 shadow-lg shadow-red-500/20'
        : isDragging
            ? `${acc.slotBorder} border-dashed`
            : 'border-dashed border-slate-500/30 hover:border-slate-400/40';
    const bgClass = isOver
        ? isValid ? 'bg-emerald-500/10' : 'bg-red-500/10'
        : `${acc.slotBg}`;

    return (
        <div className={`relative rounded-md border transition-all duration-200 flex flex-col cursor-cell overflow-hidden ${borderClass} ${bgClass}`}>
            <div className={`absolute left-0 top-0 bottom-0 w-[2px] ${acc.rail} opacity-30`} />
            <div className="h-[148px] flex flex-col items-center justify-center border-b border-dashed border-white/[0.05] gap-2 px-2">
                {isOver && !isValid ? (
                    <div className="flex flex-col items-center gap-1.5">
                        <div className="w-9 h-9 rounded-full bg-[var(--loss)]/20 border border-[var(--loss)]/40 flex items-center justify-center">
                            <XIcon size={14} className="text-[var(--loss)]" />
                        </div>
                        <p className="font-mono text-[10px] uppercase tracking-wider font-bold text-[var(--loss)] text-center">Wrong position</p>
                        <p className="font-mono text-[9px] text-[var(--loss)]/60 text-center">{label} only</p>
                    </div>
                ) : isOver && isValid ? (
                    <div className="flex flex-col items-center gap-1.5">
                        <div className="w-9 h-9 rounded-full bg-[var(--win)]/20 border border-[var(--win)]/40 flex items-center justify-center">
                            <Check size={14} className="text-[var(--win)]" />
                        </div>
                        <p className="font-mono text-[10px] uppercase tracking-wider font-bold text-[var(--win)] text-center">Drop to place</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2 text-center">
                        <span className={`px-2.5 py-1 rounded text-[10.5px] font-mono font-bold border ${acc.badge}`}>{posKey}</span>
                        <p className="font-display text-sm tracking-wide text-[var(--ink-300)]">{label.toUpperCase()}</p>
                        <p className="font-mono text-[9px] text-[var(--ink-500)] leading-tight">{SLOT_DESC[posKey]}</p>
                    </div>
                )}
            </div>
            <div className="px-3 pt-2 pb-2">
                <div className="h-[14px] rounded bg-white/[0.04] mb-1.5" />
                <div className="h-[11px] rounded bg-white/[0.025] mb-2" />
                <div className="grid grid-cols-3 gap-1 pt-2 border-t border-white/[0.05]">
                    {['ATK', 'DEF', 'OVR'].map(l => (
                        <div key={l} className="text-center">
                            <div className="font-mono text-[8.5px] text-[var(--ink-600)] uppercase tracking-wider">{l}</div>
                            <div className="font-display text-base text-[var(--ink-700)] tabular leading-none mt-0.5">—</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function SquadPage() {
    const { team } = useAuth();
    const [players, setPlayers] = useState<Player[]>([]);
    const [lineup, setLineup] = useState<Record<string, Player | null>>({});
    const [bench, setBench] = useState<Player[]>([]);
    const [draggedPlayer, setDraggedPlayer] = useState<Player | null>(null);
    const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

    useEffect(() => {
        if (team) {
            Promise.all([
                fetch(`/api/players?teamId=${team.id}`).then(r => r.json()),
                fetch(`/api/squad?teamId=${team.id}`).then(r => r.json()),
            ]).then(([data, savedLineup]: [Player[], Record<string, Player | null>]) => {
                setPlayers(data);
                const initial: Record<string, Player | null> = {};
                const inLineup = new Set<number>();
                POSITIONS.forEach(pos => {
                    const saved = savedLineup[pos.key] ?? null;
                    initial[pos.key] = saved;
                    if (saved) inLineup.add(saved.id);
                });
                setLineup(initial);
                setBench(data.filter((p: Player) => !inLineup.has(p.id)));
            });
        }
    }, [team]);

    const handleDragStart = (player: Player) => setDraggedPlayer(player);

    const handleDropOnPosition = useCallback((posKey: string) => {
        if (!draggedPlayer) return;
        setDragOverSlot(null);
        // Hard-block: reject if player position doesn't match slot
        const slotPos = POSITIONS.find(p => p.key === posKey);
        if (!slotPos || !isValidForSlot(draggedPlayer.position, slotPos.label)) {
            setDraggedPlayer(null);
            return;
        }
        setLineup(prev => {
            const newLineup = { ...prev };
            Object.keys(newLineup).forEach(k => { if (newLineup[k]?.id === draggedPlayer.id) newLineup[k] = null; });
            const displaced = newLineup[posKey];
            if (displaced) setBench(b => b.find(p => p.id === displaced.id) ? b : [...b, displaced]);
            newLineup[posKey] = draggedPlayer;
            return newLineup;
        });
        setBench(b => b.filter(p => p.id !== draggedPlayer.id));
        setDraggedPlayer(null);
    }, [draggedPlayer]);

    const handleDropOnBench = useCallback(() => {
        if (!draggedPlayer) return;
        setDragOverSlot(null);
        setLineup(prev => {
            const newLineup = { ...prev };
            Object.keys(newLineup).forEach(k => { if (newLineup[k]?.id === draggedPlayer.id) newLineup[k] = null; });
            return newLineup;
        });
        setBench(prev => prev.find(p => p.id === draggedPlayer.id) ? prev : [...prev, draggedPlayer]);
        setDraggedPlayer(null);
    }, [draggedPlayer]);

    const resetLineup = () => {
        const initial: Record<string, Player | null> = {};
        POSITIONS.forEach(p => { initial[p.key] = null; });
        setLineup(initial);
        setBench(players);
    };

    const autoFill = () => {
        const available = [...players];
        const newLineup: Record<string, Player | null> = {};
        POSITIONS.forEach(pos => {
            const best = available
                .filter(p => isValidForSlot(p.position, pos.label))
                .sort((a, b) => b.overall - a.overall)[0];
            if (best) { newLineup[pos.key] = best; available.splice(available.indexOf(best), 1); }
            else newLineup[pos.key] = null;
        });
        setLineup(newLineup);
        setBench(available);
    };

    const lineupStrength = Object.values(lineup).filter(Boolean).reduce((sum, p) => sum + (p?.overall || 0), 0);
    const lineupCount = Object.values(lineup).filter(Boolean).length;
    const handleSave = async () => {
        if (!team) return;
        const posKeyMap: Record<string, string> = { OH1: 'oh1', MB1: 'mb1', OPP: 'opp', S: 's', MB2: 'mb2', OH2: 'oh2', L: 'l' };
        const lineupData: Record<string, number | null> = {};
        POSITIONS.forEach(pos => { lineupData[posKeyMap[pos.key]] = lineup[pos.key]?.id ?? null; });
        setSaveError(null);
        try {
            const res = await fetch('/api/squad', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamId: team.id, lineup: lineupData }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({} as { error?: string }));
                setSaveError(body.error ?? 'Save failed');
                setTimeout(() => setSaveError(null), 4000);
                return;
            }
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (e) {
            setSaveError(e instanceof Error ? e.message : 'Save error');
            setTimeout(() => setSaveError(null), 4000);
        }
    };

    return (
        <div className="space-y-6 animate-fade-up">
            <div className="relative flex flex-col sm:flex-row sm:items-end gap-4 sm:justify-between pb-5 border-b border-white/[0.06]">
                <div className="absolute -top-2 left-0 h-[3px] w-16 bg-[var(--volt)]" />
                <div>
                    <p className="eyebrow mb-2">Squad · Starting Seven</p>
                    <h1 className="font-display text-5xl tracking-[0.02em] text-[var(--bone)] leading-[0.85]">SQUAD SELECTION</h1>
                    <p className="font-mono text-xs text-[var(--ink-400)] mt-3 tracking-wider tabular">
                        <span className="text-[var(--volt)] font-bold">{lineupCount}</span>/7 POSITIONS // TEAM STRENGTH <span className="text-[var(--volt)] font-bold">{lineupCount > 0 ? Math.round(lineupStrength / lineupCount) : 0}</span> AVG
                    </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-2 flex-wrap">
                        <button onClick={autoFill} className="btn-ghost">Auto Fill</button>
                        <button onClick={resetLineup} className="btn-ghost flex items-center gap-2"><RotateCcw size={13} />Reset</button>
                        <button onClick={handleSave} className="btn-volt flex items-center gap-2">
                            {saved ? <><Check size={14} />Saved</> : <><Save size={14} />Save Lineup</>}
                        </button>
                    </div>
                    {saveError && (
                        <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--loss)]">{saveError}</p>
                    )}
                </div>
            </div>

            {/* ── Squad Stats + Lineup grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:items-stretch">
                {/* Squad Lineup Grid */}
                <div className="lg:col-span-2 surface-raised p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-1 h-6 bg-[var(--volt)]" />
                            <h3 className="font-display text-xl tracking-[0.05em] text-[var(--bone)]">SQUAD LINEUP</h3>
                        </div>
                        <div className="flex items-center gap-4 font-mono text-[9.5px] text-[var(--ink-500)] uppercase tracking-[0.18em]">
                            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[var(--win)] inline-block" />Valid drop</span>
                            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[var(--loss)] inline-block" />Wrong position</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* Row 1: Front row attackers */}
                        <div>
                            <p className="font-mono text-[9px] font-bold text-[var(--ink-500)] uppercase tracking-[0.3em] mb-2 pl-1">Front Row</p>
                            <div className="grid grid-cols-3 gap-3">
                                {['OH1', 'MB1', 'OPP'].map(key => {
                                    const pos = POSITIONS.find(p => p.key === key)!;
                                    const player = lineup[key];
                                    const isOver = dragOverSlot === key;
                                    const isValid = draggedPlayer ? isValidForSlot(draggedPlayer.position, pos.label) : false;
                                    return (
                                        <div key={key}
                                            onDragOver={e => { e.preventDefault(); setDragOverSlot(key); }}
                                            onDragLeave={() => setDragOverSlot(null)}
                                            onDrop={() => handleDropOnPosition(key)}
                                        >
                                            {player ? (
                                                <LineupCard player={player} posKey={key}
                                                    onDragStart={() => handleDragStart(player)}
                                                    onClick={() => setSelectedPlayer(player)} />
                                            ) : (
                                                <EmptySlot posKey={key} label={pos.label} isOver={isOver} isValid={isValid} isDragging={!!draggedPlayer} />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Row 2: Back row */}
                        <div>
                            <p className="font-mono text-[9px] font-bold text-[var(--ink-500)] uppercase tracking-[0.3em] mb-2 pl-1">Back Row</p>
                            <div className="grid grid-cols-3 gap-3">
                                {['S', 'MB2', 'OH2'].map(key => {
                                    const pos = POSITIONS.find(p => p.key === key)!;
                                    const player = lineup[key];
                                    const isOver = dragOverSlot === key;
                                    const isValid = draggedPlayer ? isValidForSlot(draggedPlayer.position, pos.label) : false;
                                    return (
                                        <div key={key}
                                            onDragOver={e => { e.preventDefault(); setDragOverSlot(key); }}
                                            onDragLeave={() => setDragOverSlot(null)}
                                            onDrop={() => handleDropOnPosition(key)}
                                        >
                                            {player ? (
                                                <LineupCard player={player} posKey={key}
                                                    onDragStart={() => handleDragStart(player)}
                                                    onClick={() => setSelectedPlayer(player)} />
                                            ) : (
                                                <EmptySlot posKey={key} label={pos.label} isOver={isOver} isValid={isValid} isDragging={!!draggedPlayer} />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Row 3: Libero — centered */}
                        <div>
                            <p className="font-mono text-[9px] font-bold text-[var(--win)]/70 uppercase tracking-[0.3em] mb-2 pl-1">Libero</p>
                            <div className="grid grid-cols-3 gap-3">
                                <div />
                                {(() => {
                                    const key = 'L';
                                    const pos = POSITIONS.find(p => p.key === key)!;
                                    const player = lineup[key];
                                    const isOver = dragOverSlot === key;
                                    const isValid = draggedPlayer ? isValidForSlot(draggedPlayer.position, pos.label) : false;
                                    return (
                                        <div key={key}
                                            onDragOver={e => { e.preventDefault(); setDragOverSlot(key); }}
                                            onDragLeave={() => setDragOverSlot(null)}
                                            onDrop={() => handleDropOnPosition(key)}
                                        >
                                            {player ? (
                                                <LineupCard player={player} posKey={key}
                                                    onDragStart={() => handleDragStart(player)}
                                                    onClick={() => setSelectedPlayer(player)} />
                                            ) : (
                                                <EmptySlot posKey={key} label={pos.label} isOver={isOver} isValid={isValid} isDragging={!!draggedPlayer} />
                                            )}
                                        </div>
                                    );
                                })()}
                                <div />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Team Overall Stats */}
                <div className="surface-raised p-6 flex flex-col relative overflow-hidden">
                    <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-[var(--volt)]/8 blur-3xl pointer-events-none" />
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-[var(--volt)]" />
                    <div className="relative flex items-center gap-3 mb-6">
                        <div className="w-1 h-6 bg-[var(--volt)]" />
                        <h3 className="font-display text-xl tracking-[0.05em] text-[var(--bone)]">TEAM OVERALL</h3>
                    </div>
                    <div className="relative space-y-6 flex-1">
                        <div className="text-center">
                            <div className={`font-display text-6xl mb-2 tabular ${lineupCount > 0 ? overallColor(lineupStrength / lineupCount) : 'text-[var(--ink-600)]'}`}>
                                {lineupCount > 0 ? Math.round(lineupStrength / lineupCount) : '—'}
                            </div>
                            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--ink-500)]">Average Rating</p>
                        </div>
                        <div className="border-t border-white/[0.06] pt-6 space-y-4">
                            {lineupCount > 0 && (() => {
                                const pp = Object.values(lineup).filter(Boolean) as Player[];
                                const attackers = [lineup.OH1, lineup.OPP, lineup.MB1, lineup.MB2].filter(Boolean) as Player[];
                                const blockers  = [lineup.MB1, lineup.MB2, lineup.OH1, lineup.OH2, lineup.OPP].filter(Boolean) as Player[];
                                const receivers = [lineup.L, lineup.OH1, lineup.OH2].filter(Boolean) as Player[];
                                const avg = (nums: number[]) => nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 50;

                                const setterBonusAdv = lineup.S
                                    ? (lineup.S.setting * 0.5 + (lineup.S.playmaking ?? 50) * 0.3 + (lineup.S.vision ?? 50) * 0.2) * 0.04
                                    : 0;
                                const stats: Record<string, number> = {
                                    'Attack':  avg(attackers.map(p => p.attack * 0.35 + (p.precision ?? 50) * 0.25 + (p.flair ?? 50) * 0.15 + (p.strength ?? 50) * 0.15 + (p.vertical ?? 50) * 0.10)) + setterBonusAdv,
                                    'Defense': avg(pp.map(p => p.defense)),
                                    'Serve':   avg(pp.map(p => p.serve * 0.40 + (p.technique ?? 50) * 0.25 + (p.spin ?? 50) * 0.20 + (p.agility ?? 50) * 0.15)),
                                    'Block':   avg(blockers.map(p => p.block * 0.40 + (p.positioning ?? 50) * 0.25 + (p.vertical ?? 50) * 0.20 + (p.concentration ?? 50) * 0.15)),
                                    'Receive': avg(receivers.map(p => p.receive * 0.35 + (p.digging ?? 50) * 0.25 + (p.ball_control ?? 50) * 0.20 + (p.flexibility ?? 50) * 0.10 + (p.balance ?? 50) * 0.10)),
                                    'Mental':  avg(pp.map(p => (p.pressure ?? 50) * 0.25 + (p.consistency ?? 50) * 0.25 + (p.game_iq ?? 50) * 0.20 + (p.concentration ?? 50) * 0.15 + (p.vision ?? 50) * 0.15)),
                                };
                                return Object.entries(stats).map(([stat, value], idx) => (
                                    <div key={`stat-${idx}-${stat}`}>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-300)]">{stat}</span>
                                            <span className="font-display text-lg text-[var(--volt)] tabular leading-none">{Math.round(value)}</span>
                                        </div>
                                        <div className="w-full h-1 bg-black/40 overflow-hidden">
                                            <div className={`h-full transition-all duration-500 ${value >= 80 ? 'bg-[var(--win)]' : value >= 60 ? 'bg-[var(--volt)]' : 'bg-[var(--loss)]'}`}
                                                style={{ width: `${value}%` }} />
                                        </div>
                                    </div>
                                ));
                            })()}
                            <div className="flex items-center justify-between pt-5 border-t border-white/[0.06]">
                                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-400)]">Players Placed</span>
                                <span className="font-display text-2xl text-[var(--volt)] tabular leading-none">{lineupCount}/7</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:items-stretch">
                {/* ── Bench ── */}
                <div
                    className="lg:col-span-2 surface-raised p-5 flex flex-col"
                    style={{ height: '540px' }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={handleDropOnBench}
                >
                    <h3 className="font-display text-xl tracking-[0.05em] text-[var(--bone)] mb-4 flex items-center gap-2 shrink-0">
                        <div className="w-1 h-6 bg-[var(--volt)]" />
                        <GripVertical size={14} className="text-[var(--ink-500)]" /> BENCH <span className="font-mono text-sm text-[var(--ink-500)] tabular ml-1">[{bench.length}]</span>
                    </h3>
                    <div className="overflow-y-auto flex-1 pr-1">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                            {bench.map(player => (
                                <BenchCard
                                    key={player.id}
                                    player={player}
                                    onDragStart={() => handleDragStart(player)}
                                    onClick={() => setSelectedPlayer(player)}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Formation court ── */}
                <div className="lg:col-span-1 flex flex-col" style={{ height: '540px' }}>
                    <div className="surface-raised p-5 flex flex-col h-full relative overflow-hidden" style={{
                        background: 'linear-gradient(180deg, rgba(34,197,94,0.06) 0%, var(--ink-900) 60%, rgba(34,197,94,0.04) 100%)',
                    }}>
                        <div className="absolute top-0 left-0 right-0 h-[2px] bg-[var(--win)]/40" />
                        <div className="font-display text-sm tracking-[0.32em] text-[var(--win)]/60 text-center mb-5 shrink-0">— NET —</div>
                        <div className="flex flex-col justify-around flex-1 gap-2">
                            {Array.from({ length: 3 }).map((_, row) => (
                                <div key={row} className="grid grid-cols-3 gap-2">
                                    {Array.from({ length: 3 }).map((_, col) => {
                                        const pos = POSITIONS.find(p => p.row === row && p.col === col);
                                        const player = pos ? lineup[pos.key] : null;
                                        if (row === 2 && (col === 0 || col === 2)) return <div key={`${row}-${col}`} />;
                                        const courtIsOver = pos ? dragOverSlot === pos.key : false;
                                        const courtIsValid = pos && draggedPlayer ? isValidForSlot(draggedPlayer.position, pos.label) : false;
                                        return (
                                            <div key={`${row}-${col}`}
                                                onDragOver={e => { e.preventDefault(); if (pos) setDragOverSlot(pos.key); }}
                                                onDragLeave={() => setDragOverSlot(null)}
                                                onDrop={() => pos && handleDropOnPosition(pos.key)}
                                            >
                                                {player ? (
                                                    <div
                                                        draggable
                                                        onDragStart={() => handleDragStart(player)}
                                                        className="relative cursor-grab active:cursor-grabbing text-center"
                                                        title={player.player_name}
                                                    >
                                                        <div className="relative w-24 h-24 mx-auto rounded-full overflow-hidden border-2 border-[var(--volt)]/70 shadow-lg shadow-black/50 hover:scale-110 transition-transform duration-200" style={{ background: 'var(--ink-850)' }}>
                                                            <PlayerPhoto playerId={player.id} />
                                                        </div>
                                                        <div className="mt-2">
                                                            <p className="text-[13px] font-semibold text-[var(--bone)] truncate">{player.player_name}</p>
                                                            <div className="flex items-center justify-center gap-1.5 mt-0.5">
                                                                <p className={`font-display text-base ${overallColor(player.overall)} tabular leading-none`}>{player.overall}</p>
                                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${posAccent(player.position).badge}`}>{posAbbrev(player.position)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : pos ? (
                                                    <div className="text-center">
                                                        <div className={`w-24 h-24 mx-auto rounded-full border-2 flex items-center justify-center cursor-cell transition-all duration-150 ${
                                                            courtIsOver
                                                                ? courtIsValid
                                                                    ? 'border-[var(--win)] bg-[var(--win)]/20 shadow-lg shadow-[var(--win)]/30'
                                                                    : 'border-[var(--loss)] bg-[var(--loss)]/20 shadow-lg shadow-[var(--loss)]/30'
                                                                : 'border-dashed border-[var(--win)]/30 bg-white/[0.03] hover:border-[var(--win)]/50'
                                                        }`}>
                                                            {courtIsOver && !courtIsValid
                                                                ? <XIcon size={16} className="text-[var(--loss)]" />
                                                                : <span className={`font-display text-base tabular ${courtIsOver && courtIsValid ? 'text-[var(--win)]' : 'text-[var(--win)]/60'}`}>{pos.key}</span>
                                                            }
                                                        </div>
                                                        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--win)]/45">{pos.label.split(' ')[0]}</p>
                                                    </div>
                                                ) : null}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {selectedPlayer && <PlayerModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}
        </div>
    );
}
