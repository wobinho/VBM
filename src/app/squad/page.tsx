'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { GripVertical, RotateCcw, Save, Check } from 'lucide-react';
import Image from 'next/image';
import PlayerModal from '@/components/player-modal';
import { getCountryName, getCountryCode } from '@/lib/country-codes';

interface Player {
    id: number; player_name: string; position: string; overall: number; jersey_number: number; age: number; country: string;
    attack: number; defense: number; serve: number; block: number; receive: number; setting: number;
    contract_years?: number; monthly_wage?: number; player_value?: number; speed?: number; agility?: number;
    strength?: number; endurance?: number; height?: number; leadership?: number; teamwork?: number;
    concentration?: number; pressure_handling?: number; potential?: number; experience?: number; consistency?: number;
    jump_serve?: number; float_serve?: number; spike_power?: number; spike_accuracy?: number;
    block_timing?: number; dig_technique?: number; team_id?: number;
}

const POSITIONS = [
    { key: 'OH1', label: 'Outside Hitter', row: 0, col: 0 },
    { key: 'MB1', label: 'Middle Blocker', row: 0, col: 1 },
    { key: 'OPP', label: 'Opposite Hitter', row: 0, col: 2 },
    { key: 'S',   label: 'Setter',          row: 1, col: 0 },
    { key: 'MB2', label: 'Middle Blocker',  row: 1, col: 1 },
    { key: 'OH2', label: 'Outside Hitter',  row: 1, col: 2 },
    { key: 'L',   label: 'Libero',          row: 2, col: 1 },
];


const POS_ACCENT: Record<string, { badge: string; border: string; glow: string }> = {
    'Setter':         { badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',    border: 'border-blue-500/40',    glow: 'shadow-blue-500/20' },
    'Outside Hitter': { badge: 'bg-red-500/20 text-red-300 border-red-500/40',       border: 'border-red-500/40',     glow: 'shadow-red-500/20' },
    'Middle Blocker': { badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40', border: 'border-purple-500/40', glow: 'shadow-purple-500/20' },
    'Opposite Hitter':{ badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40', border: 'border-orange-500/40', glow: 'shadow-orange-500/20' },
    'Libero':         { badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', border: 'border-emerald-500/40', glow: 'shadow-emerald-500/20' },
};
function posAccent(pos: string) {
    return POS_ACCENT[pos] || { badge: 'bg-gray-500/20 text-gray-300 border-gray-500/40', border: 'border-gray-500/40', glow: 'shadow-gray-500/20' };
}
function posAbbrev(pos: string) {
    const m: Record<string, string> = { 'Setter': 'S', 'Outside Hitter': 'OH', 'Middle Blocker': 'MB', 'Opposite Hitter': 'OPP', 'Libero': 'L' };
    return m[pos] || pos.substring(0, 2).toUpperCase();
}
function overallColor(v: number) {
    return v >= 80 ? 'text-emerald-400' : v >= 60 ? 'text-amber-400' : 'text-red-400';
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
    const [src, setSrc] = useState(teamId ? `/assets/teams/${teamId}.png` : '');
    const [failed, setFailed] = useState(!teamId);
    if (failed) return null;
    return (
        <div className="relative" style={{ width: size * 4, height: size * 4 }}>
            <Image src={src} alt="Team" fill unoptimized className="object-contain drop-shadow-md"
                onError={() => { if (src !== '/assets/teams/default.png') setSrc('/assets/teams/default.png'); else setFailed(true); }} />
        </div>
    );
}

/* ── Bench mini-card ── */
function BenchCard({ player, onDragStart, onClick }: { player: Player; onDragStart: () => void; onClick: () => void }) {
    const acc = posAccent(player.position);
    return (
        <div
            draggable
            onDragStart={onDragStart}
            onClick={onClick}
            className={`relative rounded-xl border overflow-hidden cursor-grab active:cursor-grabbing transition-all duration-200 shadow-lg ${acc.glow} ${acc.border}`}
            style={{ background: '#0d1117' }}
        >
            {/* Photo zone */}
            <div className="relative h-[120px]" style={{ background: 'linear-gradient(160deg, #111827 0%, #0d1117 100%)' }}>
                {/* Team logo — top left */}
                <div className="absolute top-1.5 left-1.5 z-20">
                    <TeamLogoImg teamId={player.team_id} size={9} />
                </div>
                {/* Overall — top center */}
                <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-10 text-center">
                    <div className={`text-2xl font-black leading-none ${overallColor(player.overall)}`} style={{ textShadow: '0 0 10px currentColor' }}>{player.overall}</div>
                </div>
                {/* Flag — top right */}
                <div className="absolute top-1 right-1 z-10">
                    <FlagImg countryCode={player.country} size="md" />
                </div>
                {/* Photo */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[90px] h-[108px]">
                    <PlayerPhoto playerId={player.id} />
                </div>
                {/* Fade */}
                <div className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none" style={{ background: 'linear-gradient(to top, #0d1117, transparent)' }} />
            </div>

            {/* Identity */}
            <div className="px-2 pt-1.5 pb-2 text-center">
                <p className="text-[11px] font-bold text-white truncate leading-tight">{player.player_name}</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${acc.badge}`}>{posAbbrev(player.position)}</span>
                    <span className="text-[9px] text-gray-500">#{player.jersey_number}</span>
                </div>
            </div>
        </div>
    );
}

/* ── Lineup slot card ── */
function LineupCard({ player, posKey, onDragStart, onClick }: { player: Player; posKey: string; onDragStart: () => void; onClick: () => void }) {
    const acc = posAccent(player.position);
    return (
        <div
            draggable
            onDragStart={onDragStart}
            onClick={onClick}
            className={`relative rounded-xl border overflow-hidden cursor-grab active:cursor-grabbing hover:scale-[1.02] transition-all duration-200 shadow-lg ${acc.border}`}
            style={{ background: '#0d1117' }}
        >
            {/* Photo zone */}
            <div className="relative h-[130px]" style={{ background: 'linear-gradient(160deg, #111827 0%, #0d1117 100%)' }}>
                {/* Overall + position badge top-left */}
                <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5">
                    <div className={`text-3xl font-black leading-none ${overallColor(player.overall)}`} style={{ textShadow: '0 0 12px currentColor' }}>{player.overall}</div>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${acc.badge}`}>{posAbbrev(player.position)}</span>
                </div>
                {/* Flag */}
                <div className="absolute bottom-2 right-2 z-10">
                    <FlagImg countryCode={player.country} size="sm" />
                </div>
                {/* Photo */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[110px] h-[125px]">
                    <PlayerPhoto playerId={player.id} />
                </div>
                {/* Fade */}
                <div className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none" style={{ background: 'linear-gradient(to top, #0d1117, transparent)' }} />
            </div>

            {/* Identity + quick stats */}
            <div className="px-3 pt-2 pb-2">
                <p className="text-[14px] font-bold text-white truncate">{player.player_name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[9px] text-gray-500">#{player.jersey_number}</span>
                </div>
                <div className="grid grid-cols-3 gap-1 mt-2 pt-2 border-t border-white/5">
                    {[['ATK', player.attack], ['DEF', player.defense], ['OVR', player.overall]].map(([l, v]) => (
                        <div key={l as string} className="text-center">
                            <div className="text-[8px] text-gray-500 uppercase">{l}</div>
                            <div className={`text-[11px] font-black ${overallColor(v as number)}`}>{v}</div>
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
    const [saved, setSaved] = useState(false);
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
            const best = available.filter(p => p.position.includes(pos.label.split(' ')[0]) || available.length === players.length)
                .sort((a, b) => b.overall - a.overall)[0] || available.sort((a, b) => b.overall - a.overall)[0];
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
        try {
            const res = await fetch('/api/squad', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamId: team.id, lineup: lineupData }),
            });
            if (!res.ok) {
                console.error('Save failed:', await res.text());
                return;
            }
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (e) {
            console.error('Save error:', e);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Squad Selection</h1>
                    <p className="text-sm text-gray-400">{lineupCount}/7 positions filled • Team Strength: {lineupCount > 0 ? Math.round(lineupStrength / lineupCount) : 0} AVG</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={autoFill} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer">Auto Fill</button>
                    <button onClick={resetLineup} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-all flex items-center gap-1.5 cursor-pointer"><RotateCcw size={14} />Reset</button>
                    <button onClick={handleSave} className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black text-sm font-semibold hover:from-amber-400 hover:to-orange-400 transition-all flex items-center gap-1.5 cursor-pointer">
                        {saved ? <><Check size={14} />Saved!</> : <><Save size={14} />Save</>}
                    </button>
                </div>
            </div>

            {/* ── Squad Stats + Lineup grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:items-stretch">
                {/* Squad Lineup Grid — FM-style cards (moved first) */}
                <div className="lg:col-span-2 rounded-xl bg-gradient-to-br from-slate-900/40 via-slate-800/30 to-slate-900/40 border border-slate-500/30 p-6">
                    <h3 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">Squad Lineup</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {POSITIONS.map(pos => {
                            const player = lineup[pos.key];
                            return (
                                <div key={pos.key}
                                    onDragOver={e => e.preventDefault()}
                                    onDrop={() => handleDropOnPosition(pos.key)}
                                >
                                    {player ? (
                                        <LineupCard
                                            player={player}
                                            posKey={pos.key}
                                            onDragStart={() => handleDragStart(player)}
                                            onClick={() => setSelectedPlayer(player)}
                                        />
                                    ) : (
                                        <div className="rounded-xl border border-dashed border-slate-500/30 hover:border-slate-400/50 transition-colors flex flex-col bg-white/[0.02] cursor-cell">
                                            {/* Mirrors LineupCard photo zone h-[130px] */}
                                            <div className="h-[130px] flex items-center justify-center border-b border-dashed border-slate-500/20">
                                                <div className="text-center">
                                                    <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">{pos.key}</div>
                                                    <p className="text-xs text-slate-500">Drop here</p>
                                                </div>
                                            </div>
                                            {/* Mirrors LineupCard identity + stats zone */}
                                            <div className="px-3 pt-2 pb-2">
                                                <div className="h-[14px] rounded bg-slate-700/20 mb-1.5" />
                                                <div className="h-[18px] rounded bg-slate-700/10 mb-2" />
                                                <div className="grid grid-cols-3 gap-1 pt-2 border-t border-white/5">
                                                    {['ATK', 'DEF', 'OVR'].map(l => (
                                                        <div key={l} className="text-center">
                                                            <div className="text-[8px] text-slate-600 uppercase">{l}</div>
                                                            <div className="text-[11px] font-black text-slate-700">—</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Team Overall Stats (moved to right side) */}
                <div className="rounded-xl bg-gradient-to-br from-amber-900/30 via-orange-900/20 to-red-900/30 border border-amber-500/30 p-6 flex flex-col">
                    <h3 className="text-sm font-semibold text-amber-300 mb-6 uppercase tracking-wider">Team Overall</h3>
                    <div className="space-y-6 flex-1">
                        <div className="text-center">
                            <div className={`text-4xl font-black mb-1 ${lineupCount > 0 ? overallColor(lineupStrength / lineupCount) : 'text-gray-500'}`}>
                                {lineupCount > 0 ? Math.round(lineupStrength / lineupCount) : '-'}
                            </div>
                            <p className="text-xs text-gray-400">Average Rating</p>
                        </div>
                        <div className="border-t border-amber-500/20 pt-6 space-y-4">
                            {lineupCount > 0 && (() => {
                                const pp = Object.values(lineup).filter(Boolean) as Player[];
                                const attackers = [lineup.OH1, lineup.OPP, lineup.MB1, lineup.MB2].filter(Boolean) as Player[];
                                const blockers  = [lineup.MB1, lineup.MB2, lineup.OH1, lineup.OH2, lineup.OPP].filter(Boolean) as Player[];
                                const receivers = [lineup.L, lineup.OH1, lineup.OH2].filter(Boolean) as Player[];
                                const setterBonus = lineup.S ? lineup.S.setting * 0.04 : 0;

                                const avg = (nums: number[]) => nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 50;

                                const stats: Record<string, number> = {
                                    'Attack':  avg(attackers.map(p => p.attack * 0.4 + (p.spike_power ?? 50) * 0.35 + (p.spike_accuracy ?? 50) * 0.25)) + setterBonus,
                                    'Defense': avg(pp.map(p => p.defense)),
                                    'Serve':   avg(pp.map(p => p.serve * 0.5 + (p.jump_serve ?? 50) * 0.3 + (p.float_serve ?? 50) * 0.2)),
                                    'Block':   avg(blockers.map(p => p.block * 0.5 + (p.block_timing ?? 50) * 0.5)),
                                    'Receive': avg(receivers.map(p => p.receive * 0.5 + (p.dig_technique ?? 50) * 0.5)),
                                    'Chemistry': 75,
                                };
                                return Object.entries(stats).map(([stat, value], idx) => (
                                    <div key={`stat-${idx}-${stat}`}>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs font-semibold text-gray-300">{stat}</span>
                                            <span className="text-sm font-bold text-amber-400">{Math.round(value)}</span>
                                        </div>
                                        <div className="w-full h-1.5 rounded-full bg-black/30 border border-white/5 overflow-hidden">
                                            <div className={`h-full rounded-full transition-all duration-500 ${value >= 80 ? 'bg-emerald-500' : value >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                style={{ width: `${value}%` }} />
                                        </div>
                                    </div>
                                ));
                            })()}
                            <div className="flex items-center justify-between pt-4 border-t border-amber-500/20">
                                <span className="text-xs text-gray-400">Players Placed</span>
                                <span className="text-lg font-bold text-amber-400">{lineupCount}/7</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:items-stretch">
                {/* ── Bench ── (moved first, takes up 2 columns) */}
                <div
                    className="lg:col-span-2 rounded-xl bg-white/5 border border-white/10 p-4 flex flex-col"
                    style={{ height: '540px' }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={handleDropOnBench}
                >
                    <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2 shrink-0">
                        <GripVertical size={14} className="text-gray-500" /> Bench ({bench.length})
                    </h3>
                    <div className="overflow-y-auto flex-1">
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

                {/* ── Formation court ── (moved to right side) */}
                <div className="lg:col-span-1 flex flex-col" style={{ height: '540px' }}>
                    <div className="rounded-xl bg-gradient-to-b from-green-900/30 via-green-800/20 to-green-900/30 border border-green-500/30 p-4 flex flex-col h-full">
                        <div className="text-xs font-bold text-green-500/50 text-center mb-4 uppercase tracking-wider shrink-0">Net</div>
                        <div className="flex flex-col justify-around flex-1 gap-2">
                            {Array.from({ length: 3 }).map((_, row) => (
                                <div key={row} className="grid grid-cols-3 gap-2">
                                    {Array.from({ length: 3 }).map((_, col) => {
                                        const pos = POSITIONS.find(p => p.row === row && p.col === col);
                                        const player = pos ? lineup[pos.key] : null;
                                        if (row === 2 && (col === 0 || col === 2)) return <div key={`${row}-${col}`} />;
                                        return (
                                            <div key={`${row}-${col}`}
                                                onDragOver={e => e.preventDefault()}
                                                onDrop={() => pos && handleDropOnPosition(pos.key)}
                                            >
                                                {player ? (
                                                    <div
                                                        draggable
                                                        onDragStart={() => handleDragStart(player)}
                                                        className="relative cursor-grab active:cursor-grabbing text-center"
                                                        title={player.player_name}
                                                    >
                                                        <div className="relative w-24 h-24 mx-auto rounded-full overflow-hidden border-2 border-amber-400/60 shadow-lg shadow-black/40 hover:scale-110 transition-transform duration-200" style={{ background: '#111827' }}>
                                                            <PlayerPhoto playerId={player.id} />
                                                        </div>
                                                        <div className="mt-2">
                                                            <p className="text-[13px] font-semibold text-white truncate">{player.player_name}</p>
                                                            <div className="flex items-center justify-center gap-1 mt-0.5">
                                                                <p className={`text-[13px] font-black ${overallColor(player.overall)}`}>{player.overall}</p>
                                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${posAccent(player.position).badge}`}>{posAbbrev(player.position)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : pos ? (
                                                    <div className="text-center">
                                                        <div className="w-24 h-24 mx-auto rounded-full border-2 border-dashed border-green-500/30 flex items-center justify-center bg-white/5 cursor-cell hover:border-green-500/50 transition-colors">
                                                            <span className="text-sm font-bold text-green-500/60">{pos.key}</span>
                                                        </div>
                                                        <p className="mt-2 text-[12px] text-green-500/40">Empty</p>
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
