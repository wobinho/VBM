'use client';
import Image from 'next/image';
import { X } from 'lucide-react';
import { useState } from 'react';

interface Player {
    id: number; player_name: string; position: string; age: number; country: string;
    jersey_number: number; overall: number; attack: number; defense: number; serve: number;
    block: number; receive: number; setting: number; contract_years?: number; monthly_wage?: number;
    player_value?: number; team_id?: number | null; speed?: number; agility?: number; strength?: number;
    endurance?: number; height?: number; leadership?: number; teamwork?: number;
    concentration?: number; pressure_handling?: number; jump_serve?: number; float_serve?: number;
    spike_power?: number; spike_accuracy?: number; block_timing?: number; dig_technique?: number;
    experience?: number; potential?: number; consistency?: number; team_name?: string;
}

function getCountryFlag(country: string): string {
    const flags: Record<string, string> = {
        'USA': '🇺🇸', 'Brazil': '🇧🇷', 'Japan': '🇯🇵', 'China': '🇨🇳', 'Russia': '🇷🇺',
        'France': '🇫🇷', 'Italy': '🇮🇹', 'Germany': '🇩🇪', 'Poland': '🇵🇱', 'Argentina': '🇦🇷',
        'Mexico': '🇲🇽', 'Spain': '🇪🇸', 'Netherlands': '🇳🇱', 'Australia': '🇦🇺', 'Canada': '🇨🇦',
        'South Korea': '🇰🇷', 'Turkey': '🇹🇷', 'Thailand': '🇹🇭', 'Serbia': '🇷🇸', 'Montenegro': '🇲🇪',
        'Croatia': '🇭🇷', 'Greece': '🇬🇷', 'Portugal': '🇵🇹', 'Czech Republic': '🇨🇿', 'Hungary': '🇭🇺',
        'England': '🇬🇧', 'Scotland': '🇬🇧', 'Wales': '🇬🇧', 'Ireland': '🇮🇪', 'Belgium': '🇧🇪',
        'Sweden': '🇸🇪', 'Norway': '🇳🇴', 'Denmark': '🇩🇰', 'Finland': '🇫🇮', 'Iceland': '🇮🇸',
    };
    return flags[country] || '🌍';
}

function getCountrySlug(country: string): string {
    return country.toLowerCase().replace(/\s+/g, '-');
}

function getPositionAccent(position: string): { badge: string; glow: string; bar: string } {
    const colors: Record<string, { badge: string; glow: string; bar: string }> = {
        'Setter':         { badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',     glow: 'from-blue-900/40',    bar: 'bg-blue-500' },
        'Outside Hitter': { badge: 'bg-red-500/20 text-red-300 border-red-500/40',        glow: 'from-red-900/40',     bar: 'bg-red-500' },
        'Middle Blocker': { badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40', glow: 'from-purple-900/40', bar: 'bg-purple-500' },
        'Opposite Hitter':{ badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40', glow: 'from-orange-900/40', bar: 'bg-orange-500' },
        'Libero':         { badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', glow: 'from-emerald-900/40', bar: 'bg-emerald-500' },
    };
    return colors[position] || { badge: 'bg-gray-500/20 text-gray-300 border-gray-500/40', glow: 'from-gray-900/40', bar: 'bg-gray-500' };
}

function StatBar({ label, value, color = 'amber' }: { label: string; value: number; color?: string }) {
    const colorMap: Record<string, string> = {
        amber: 'bg-amber-500', green: 'bg-emerald-500', blue: 'bg-blue-500',
        purple: 'bg-purple-500', red: 'bg-red-500', cyan: 'bg-cyan-500',
    };
    const numColor = value >= 80 ? 'text-emerald-400' : value >= 60 ? 'text-amber-400' : 'text-red-400';
    return (
        <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-28 shrink-0">{label}</span>
            <div className="flex-1 h-[5px] bg-white/5 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full ${colorMap[color] || colorMap.amber} transition-all duration-500`}
                    style={{ width: `${value}%` }}
                />
            </div>
            <span className={`text-xs font-bold w-7 text-right ${numColor}`}>{value}</span>
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
                <svg viewBox="0 0 80 100" className="w-40 h-52 opacity-70" fill="none">
                    <ellipse cx="40" cy="28" rx="18" ry="20" fill="#6B7280" />
                    <path d="M10 100 Q10 60 40 58 Q70 60 70 100Z" fill="#6B7280" />
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
            className="object-contain object-bottom"
            onError={() => {
                if (!useFallback) setUseFallback(true);
                else setFinalFallback(true);
            }}
        />
    );
}

function ModalTeamBackground({ teamId }: { teamId?: number | null }) {
    const [useFallback, setUseFallback] = useState(false);
    const [failed, setFailed] = useState(false);

    if (!teamId || failed) return null;
    const src = useFallback ? '/assets/team-backgrounds/default.png' : `/assets/team-backgrounds/${teamId}.png`;

    return (
        <Image
            src={src}
            alt=""
            fill
            unoptimized
            className="object-cover object-center opacity-[0.07]"
            onError={() => {
                if (!useFallback) setUseFallback(true);
                else setFailed(true);
            }}
        />
    );
}

function ModalTeamLogo({ teamId }: { teamId?: number | null }) {
    const [useFallback, setUseFallback] = useState(false);
    const [failed, setFailed] = useState(false);

    if (!teamId || failed) return null;
    const src = useFallback ? '/assets/teams/default.png' : `/assets/teams/${teamId}.png`;

    return (
        <div className="relative w-[84px] h-[84px]">
            <Image
                src={src}
                alt="Team"
                fill
                unoptimized
                className="object-contain drop-shadow-lg"
                onError={() => {
                    if (!useFallback) setUseFallback(true);
                    else setFailed(true);
                }}
            />
        </div>
    );
}

function ModalCountryFlag({ country }: { country: string }) {
    const slug = getCountrySlug(country);
    const [useFallback, setUseFallback] = useState(false);
    const [failed, setFailed] = useState(false);

    if (failed) {
        return <span className="text-4xl leading-none">{getCountryFlag(country)}</span>;
    }

    const src = useFallback ? '/assets/flags/default.png' : `/assets/flags/${slug}.png`;

    return (
        <div className="relative w-[72px] h-12 rounded-md overflow-hidden shadow-lg shrink-0">
            <Image
                src={src}
                alt={country}
                fill
                unoptimized
                className="object-cover"
                onError={() => {
                    if (!useFallback) setUseFallback(true);
                    else setFailed(true);
                }}
            />
        </div>
    );
}

function InfoTile({ label, value, accent }: { label: string; value: string; accent?: string }) {
    return (
        <div className="relative rounded-xl py-2.5 px-2 text-center overflow-hidden border border-white/8"
            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)' }}>
            {accent && <div className={`absolute inset-0 opacity-10 ${accent}`} />}
            <div className="relative text-[16px] font-bold text-white leading-tight">{value}</div>
            <div className="relative text-[11px] text-gray-500 mt-1 uppercase tracking-widest">{label}</div>
        </div>
    );
}

function StatSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-white/6 overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)' }}>
            <div className="px-4 py-2.5 border-b border-white/6"
                style={{ background: 'rgba(255,255,255,0.03)' }}>
                <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">{title}</h4>
            </div>
            <div className="px-4 py-3 space-y-2.5">
                {children}
            </div>
        </div>
    );
}

export default function PlayerModal({ player, onClose }: { player: Player; onClose: () => void }) {
    const formatMoney = (n: number) => n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n}`;

    const convertCmToFeet = (cm: number) => {
        const totalInches = Math.round(cm / 2.54);
        const feet = Math.floor(totalInches / 12);
        const inches = totalInches % 12;
        return `${feet}'${inches}"`;
    };

    const overallColor = player.overall >= 80 ? 'text-emerald-400' : player.overall >= 60 ? 'text-amber-400' : 'text-red-400';
    const accent = getPositionAccent(player.position);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-white/10 shadow-2xl"
                style={{ background: '#0d1117' }}
                onClick={e => e.stopPropagation()}
            >
                {/* ── HERO HEADER ── */}
                <div className="relative h-[300px] overflow-hidden rounded-t-2xl" style={{ background: `linear-gradient(160deg, #111827 0%, #0d1117 100%)` }}>
                    {/* Position colour tint */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${accent.glow} to-transparent opacity-60 pointer-events-none`} />

                    {/* Team watermark */}
                    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
                        <ModalTeamBackground teamId={player.team_id} />
                    </div>

                    {/* Close button */}
                    <button
                        onClick={onClose}
                        className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all cursor-pointer"
                        aria-label="Close"
                    >
                        <X size={15} />
                    </button>

                    {/* Overall + team logo — top left */}
                    <div className="absolute top-4 left-5 z-10 flex items-start gap-3">
                        <div>
                            <div className={`text-7xl font-black leading-none ${overallColor}`} style={{ textShadow: '0 0 32px currentColor' }}>
                                {player.overall}
                            </div>
                            <div className="text-[9px] font-semibold tracking-[0.2em] text-gray-500 uppercase mt-1">Overall</div>
                        </div>
                        <div className="mt-1">
                            <ModalTeamLogo teamId={player.team_id} />
                        </div>
                    </div>

                    {/* Country flag — top right (left of close btn) */}
                    <div className="absolute top-4 right-14 z-10">
                        <ModalCountryFlag country={player.country} />
                    </div>

                    {/* Player photo — centered, 50% bigger: was 160×190 → 240×285 */}
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[240px] h-[285px]">
                        <ModalPlayerPhoto playerId={player.id} />
                    </div>

                    {/* Fade to card bg */}
                    <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none" style={{ background: 'linear-gradient(to top, #0d1117, transparent)' }} />
                </div>

                {/* ── PLAYER IDENTITY ── */}
                <div className="px-6 pt-4 pb-5 text-center border-b border-white/5">
                    <h2 className="text-2xl font-bold text-white">{player.player_name}</h2>
                    <div className="flex items-center justify-center gap-3 mt-2.5 flex-wrap">
                        <span className={`px-3 py-1 rounded-md text-sm font-bold border ${accent.badge}`}>
                            {player.position}
                        </span>
                        <span className="text-base text-gray-400 font-semibold">#{player.jersey_number}</span>
                        <span className="text-base text-gray-500">{player.country}</span>
                    </div>
                </div>

                {/* ── STATS BODY ── */}
                <div className="p-6 space-y-4">
                    {/* Info row — 5 tiles in one line */}
                    <div className="grid grid-cols-5 gap-2">
                        <InfoTile label="Value"    value={player.player_value ? formatMoney(player.player_value) : '—'} accent="bg-emerald-500" />
                        <InfoTile label="Wage/mo"  value={player.monthly_wage ? formatMoney(player.monthly_wage) : '—'} accent="bg-amber-500" />
                        <InfoTile label="Contract" value={player.contract_years ? `${player.contract_years}y` : '—'}    accent="bg-blue-500" />
                        <InfoTile label="Age"      value={String(player.age)}                                            accent="bg-purple-500" />
                        <InfoTile label="Height"   value={player.height ? convertCmToFeet(player.height) : '—'}         accent="bg-cyan-500" />
                    </div>

                    {/* Core Skills */}
                    <StatSection title="Core Skills">
                        <StatBar label="Attack"  value={player.attack}  color="red" />
                        <StatBar label="Defense" value={player.defense} color="blue" />
                        <StatBar label="Serve"   value={player.serve}   color="green" />
                        <StatBar label="Block"   value={player.block}   color="purple" />
                        <StatBar label="Receive" value={player.receive} color="cyan" />
                        <StatBar label="Setting" value={player.setting} color="amber" />
                    </StatSection>

                    {/* Physical Attributes */}
                    {player.speed != null && (
                        <StatSection title="Physical Attributes">
                            <StatBar label="Speed"     value={player.speed}            color="green" />
                            <StatBar label="Agility"   value={player.agility ?? 0}    color="cyan" />
                            <StatBar label="Strength"  value={player.strength ?? 0}   color="red" />
                            <StatBar label="Endurance" value={player.endurance ?? 0}  color="blue" />
                        </StatSection>
                    )}

                    {/* Mental */}
                    {player.leadership != null && (
                        <StatSection title="Mental">
                            <StatBar label="Leadership"   value={player.leadership}              color="amber" />
                            <StatBar label="Teamwork"     value={player.teamwork ?? 0}           color="green" />
                            <StatBar label="Concentration" value={player.concentration ?? 0}    color="blue" />
                            <StatBar label="Pressure"     value={player.pressure_handling ?? 0} color="purple" />
                        </StatSection>
                    )}

                    {/* Development */}
                    {player.potential != null && (
                        <StatSection title="Development">
                            <StatBar label="Potential"   value={player.potential}          color="green" />
                            <StatBar label="Experience"  value={player.experience ?? 0}   color="amber" />
                            <StatBar label="Consistency" value={player.consistency ?? 0}  color="blue" />
                        </StatSection>
                    )}
                </div>
            </div>
        </div>
    );
}
