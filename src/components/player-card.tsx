'use client';
import Image from 'next/image';
import { useState } from 'react';
import { getCountryName, getCountryCode } from '@/lib/country-codes';

interface Player {
    id: number; player_name: string; position: string; age: number; country: string;
    jersey_number: number; overall: number; attack: number; defense: number; serve: number;
    block: number; receive: number; setting: number; player_value: number; team_name?: string;
    team_id?: number | null;
}

function getPositionAbbrev(pos: string) {
    const map: Record<string, string> = { 'Setter': 'S', 'Outside Hitter': 'OH', 'Middle Blocker': 'MB', 'Opposite Hitter': 'OPP', 'Libero': 'L' };
    return map[pos] || pos.substring(0, 2).toUpperCase();
}

function getPositionAccent(position: string) {
    const colors: Record<string, { badge: string; glow: string }> = {
        'Setter': { badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30', glow: 'shadow-blue-500/10' },
        'Outside Hitter': { badge: 'bg-red-500/20 text-red-300 border-red-500/30', glow: 'shadow-red-500/10' },
        'Middle Blocker': { badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30', glow: 'shadow-purple-500/10' },
        'Opposite Hitter': { badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30', glow: 'shadow-orange-500/10' },
        'Libero': { badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', glow: 'shadow-emerald-500/10' },
    };
    return colors[position] || { badge: 'bg-gray-500/20 text-gray-300 border-gray-500/30', glow: 'shadow-gray-500/10' };
}

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
    const colorMap: Record<string, string> = {
        red: 'bg-red-500', blue: 'bg-blue-500', green: 'bg-emerald-500',
        purple: 'bg-purple-500', cyan: 'bg-cyan-500', amber: 'bg-amber-500',
    };
    const numColor = value >= 80 ? 'text-emerald-400' : value >= 60 ? 'text-amber-400' : 'text-red-400';
    return (
        <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-[10px] sm:text-[11px] text-gray-400 w-16 sm:w-20 shrink-0">{label}</span>
            <div className="flex-1 h-1 sm:h-[5px] bg-white/5 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full ${colorMap[color] || colorMap.amber}`}
                    style={{ width: `${value}%` }}
                />
            </div>
            <span className={`text-[10px] sm:text-[11px] font-bold w-5 text-right ${numColor}`}>{value}</span>
        </div>
    );
}

function PlayerPhoto({ playerId }: { playerId: number }) {
    const [useFallback, setUseFallback] = useState(false);
    const src = useFallback ? '/assets/players/default.png' : `/assets/players/${playerId}.png`;
    const [finalFallback, setFinalFallback] = useState(false);

    if (finalFallback) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <svg viewBox="0 0 80 100" className="w-24 h-28 opacity-60" fill="none">
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
            className="object-contain object-bottom"
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
        <div className="relative w-16 h-16">
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

function CountryFlag({ countryCode }: { countryCode: string }) {
    const [failed, setFailed] = useState(false);

    // Convert country name to code if needed
    const code = countryCode.length > 2 ? getCountryCode(countryCode) : countryCode.toLowerCase();

    if (failed) {
        return (
            <div className="w-10 h-7 rounded overflow-hidden shadow-md bg-gray-700 flex items-center justify-center flex-shrink-0">
                <span className="text-[9px] font-bold text-white uppercase">{code}</span>
            </div>
        );
    }

    return (
        <div className="w-10 h-7 rounded overflow-hidden shadow-md flex-shrink-0">
            <img
                src={`/assets/flags/${code}.svg`}
                alt={getCountryName(code)}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={() => setFailed(true)}
            />
        </div>
    );
}

export default function PlayerCard({ player, onClick, compact = false }: { player: Player; onClick?: () => void; compact?: boolean }) {
    const formatMoney = (n: number) => n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n}`;

    if (compact) {
        // Handle both country codes and country names
        const countryDisplay = player.country.length > 2 ? player.country : getCountryName(player.country);
        return (
            <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl bg-white/5 border border-white/5 hover:border-amber-500/30 hover:bg-white/[0.08] transition-all cursor-pointer group" onClick={onClick}>
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center text-xs sm:text-sm font-bold text-amber-400 shrink-0">
                    {player.jersey_number}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-white truncate group-hover:text-amber-400 transition-colors">{player.player_name}</p>
                    <p className="text-[10px] sm:text-xs text-gray-500">{getPositionAbbrev(player.position)} • {countryDisplay}</p>
                </div>
                <div className={`text-base sm:text-lg font-black shrink-0 ${player.overall >= 80 ? 'text-emerald-400' : player.overall >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                    {player.overall}
                </div>
            </div>
        );
    }

    const accent = getPositionAccent(player.position);
    const overallColor = player.overall >= 80 ? 'text-emerald-400' : player.overall >= 60 ? 'text-amber-400' : 'text-red-400';

    return (
        <div
            className={`relative w-full rounded-2xl overflow-hidden border border-white/8 cursor-pointer hover:border-white/30 hover:shadow-2xl hover:scale-105 transition-all duration-300 shadow-xl ${accent.glow} hover:${accent.glow}`}
            style={{
                background: '#0d1117',
                boxShadow: `0 0 30px ${accent.glow.includes('blue') ? 'rgba(59, 130, 246, 0.2)' : accent.glow.includes('red') ? 'rgba(239, 68, 68, 0.2)' : accent.glow.includes('purple') ? 'rgba(168, 85, 247, 0.2)' : accent.glow.includes('orange') ? 'rgba(249, 115, 22, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`
            }}
            onClick={onClick}
        >
            {/* ── HEADER ZONE ── */}
            <div className="relative h-40 sm:h-48 md:h-52 overflow-hidden" style={{ background: 'linear-gradient(160deg, #111827 0%, #0d1117 100%)' }}>
                {/* Team logo — top left, allowed to overlap other elements */}
                <div className="absolute top-1.5 left-1.5 z-20">
                    <TeamLogo teamId={player.team_id} />
                </div>

                {/* Overall rating — top center */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 text-center z-10">
                    <div className={`text-4xl sm:text-5xl font-black leading-none ${overallColor}`} style={{ textShadow: '0 0 20px currentColor' }}>
                        {player.overall}
                    </div>
                    <div className="text-[8px] sm:text-[9px] font-semibold tracking-[0.2em] text-gray-500 uppercase mt-0.5">Overall</div>
                </div>

                {/* Country flag — top right */}
                <div className="absolute top-2 right-2 z-10">
                    <CountryFlag countryCode={player.country} />
                </div>

                {/* Player photo */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-28 h-32 sm:w-32 sm:h-40 md:w-36 md:h-44">
                    <PlayerPhoto playerId={player.id} />
                </div>

                {/* Bottom gradient fade */}
                <div className="absolute bottom-0 left-0 right-0 h-12 sm:h-16 pointer-events-none" style={{ background: 'linear-gradient(to top, #0d1117, transparent)' }} />
            </div>

            {/* ── PLAYER IDENTITY ── */}
            <div className="px-3 sm:px-4 pt-2 sm:pt-3 pb-1.5 sm:pb-2 text-center">
                <h3 className="text-sm sm:text-[15px] font-bold text-white leading-tight truncate">{player.player_name}</h3>
                <div className="flex items-center justify-center gap-1 sm:gap-2 mt-1 sm:mt-1.5 flex-wrap">
                    <span className={`px-1.5 sm:px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold border ${accent.badge}`}>
                        {getPositionAbbrev(player.position)}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-gray-400">#{player.jersey_number}</span>
                    <span className="text-[10px] sm:text-[11px] text-gray-500 hidden sm:inline">{player.country.length > 2 ? player.country : getCountryName(player.country)}</span>
                </div>
            </div>

            {/* ── INFO GRID ── */}
            <div className="px-2 sm:px-3 pb-2 sm:pb-3">
                <div className="grid grid-cols-3 gap-1 sm:gap-1.5 mb-2 sm:mb-3">
                    <div className="rounded-lg p-1.5 sm:p-2 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <div className="text-[11px] sm:text-[12px] font-bold text-white leading-tight">{formatMoney(player.player_value)}</div>
                        <div className="text-[8px] sm:text-[9px] text-gray-500 mt-0.5">Value</div>
                    </div>
                    <div className="rounded-lg p-1.5 sm:p-2 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <div className="text-[11px] sm:text-[12px] font-bold text-white leading-tight">{player.age}</div>
                        <div className="text-[8px] sm:text-[9px] text-gray-500 mt-0.5">Age</div>
                    </div>
                    <div className="rounded-lg p-1.5 sm:p-2 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <div className={`text-[11px] sm:text-[12px] font-bold leading-tight ${overallColor}`}>{player.overall}</div>
                        <div className="text-[8px] sm:text-[9px] text-gray-500 mt-0.5">OVR</div>
                    </div>
                </div>

                {/* ── STAT BARS ── */}
                <div className="space-y-1 sm:space-y-[6px]">
                    <StatBar label="Attack" value={player.attack} color="red" />
                    <StatBar label="Defense" value={player.defense} color="blue" />
                    <StatBar label="Serve" value={player.serve} color="green" />
                    <StatBar label="Block" value={player.block} color="purple" />
                    <StatBar label="Receive" value={player.receive} color="cyan" />
                    <StatBar label="Setting" value={player.setting} color="amber" />
                </div>
            </div>
        </div>
    );
}
