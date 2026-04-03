'use client';
import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { useAuth } from '@/contexts/auth-context';
import PlayerCard from '@/components/player-card';
import PlayerModal from '@/components/player-modal';
import {
    Search, ShoppingCart, ShoppingBag, Inbox, Send, DollarSign, Filter,
    ChevronDown, X, Bookmark, FileSignature, CheckCircle,
    Plus, Minus, AlertTriangle, Star, Calendar,
} from 'lucide-react';

interface Player {
    id: number; player_name: string; position: string; age: number; country: string;
    jersey_number: number; overall: number; height?: number; attack: number; defense: number; serve: number;
    block: number; receive: number; setting: number; contract_years: number; monthly_wage: number;
    player_value: number;
    precision: number; flair: number; digging: number; positioning: number;
    ball_control: number; technique: number; playmaking: number; spin: number;
    speed: number; agility: number; strength: number; endurance: number;
    vertical: number; flexibility: number; torque: number; balance: number;
    leadership: number; teamwork: number; concentration: number; pressure: number;
    consistency: number; vision: number; game_iq: number; intimidation: number;
    team_name?: string; team_id: number | null;
}

interface League { id: number; league_name: string; }
interface TeamInfo { id: number; team_name: string; league_id: number; nation?: string; }
interface Offer {
    id: number; player_name: string; offer_amount: number; status: string;
    from_team_name: string; to_team_name: string; created_at: string;
}

type Tab = 'market' | 'shortlist' | 'received' | 'sent';

const POSITIONS = ['All', 'Outside Hitter', 'Middle Blocker', 'Opposite Hitter', 'Setter', 'Libero'];
const MAX_PATIENCE = 3;

function fmt(n: number) {
    return n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n}`;
}

function formatMoney(n: number) {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toLocaleString()}`;
}

// Transfer fee formula: base is player_value, modified by contract years left
// Fewer years → closer to value; more years → premium above value
function calcTransferFee(playerValue: number, contractYears: number): number {
    // 1 yr = 0.85x, 2 = 1.0x, 3 = 1.15x, 4 = 1.30x, 5 = 1.45x
    const multiplier = 0.7 + contractYears * 0.15;
    return Math.round(playerValue * multiplier / 1000) * 1000;
}

// ─── Photo/Logo Helpers ──────────────────────────────────────────────────────

function PlayerPhoto({ playerId, className = "" }: { playerId: number; className?: string }) {
    const [useFallback, setUseFallback] = useState(false);
    const src = useFallback ? '/assets/players/default.png' : `/assets/players/${playerId}.png`;
    return (
        <div className={`relative overflow-hidden ${className}`}>
            <Image
                src={src}
                alt="Player"
                fill
                unoptimized
                className="object-contain object-bottom"
                onError={() => setUseFallback(true)}
            />
        </div>
    );
}

function TeamLogo({ teamId, className = "" }: { teamId?: number | null; className?: string }) {
    const [failed, setFailed] = useState(false);
    if (!teamId || failed) return null;
    return (
        <div className={`relative ${className}`}>
            <Image
                src={`/assets/teams/${teamId}.png`}
                alt="Team"
                fill
                unoptimized
                className="object-contain"
                onError={() => setFailed(true)}
            />
        </div>
    );
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ label, value, min, max, step = 1, format, onChange }: {
    label: string; value: number; min: number; max: number;
    step?: number; format: (v: number) => string; onChange: (v: number) => void;
}) {
    return (
        <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">{label}</span>
            <div className="flex items-center gap-3">
                <button onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min}
                    className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-300 hover:bg-white/10 hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer">
                    <Minus size={14} />
                </button>
                <div className="flex-1 text-center">
                    <span className="text-lg font-bold text-white">{format(value)}</span>
                </div>
                <button onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max}
                    className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-300 hover:bg-white/10 hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer">
                    <Plus size={14} />
                </button>
            </div>
        </div>
    );
}

// ─── Patience Dots ────────────────────────────────────────────────────────────

function PatienceDots({ patience }: { patience: number }) {
    return (
        <div className="flex items-center gap-1.5">
            {Array.from({ length: MAX_PATIENCE }).map((_, i) => (
                <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${i < patience
                    ? 'bg-emerald-400 border-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]'
                    : 'bg-transparent border-gray-600'}`} />
            ))}
        </div>
    );
}

// ─── Club Negotiation Modal ───────────────────────────────────────────────────

interface ClubNegotiationProps {
    player: Player;
    teamMoney: number;
    onClose: () => void;
    onAccepted: (fee: number) => void;
}

function ClubNegotiationModal({ player, teamMoney, onClose, onAccepted }: ClubNegotiationProps) {
    const suggestedFee = calcTransferFee(player.player_value, player.contract_years);
    const [fee, setFee] = useState(suggestedFee);
    const [patience, setPatience] = useState(MAX_PATIENCE);
    const [result, setResult] = useState<'idle' | 'thinking' | 'accepted' | 'rejected' | 'no_funds'>('idle');
    const [rejectMsg, setRejectMsg] = useState('');

    const canAfford = teamMoney >= fee;
    const minFee = Math.round(player.player_value * 0.3 / 1000) * 1000;
    const maxFee = Math.round(player.player_value * 3 / 1000) * 1000;

    function makeOffer() {
        if (!canAfford) { setResult('no_funds'); return; }
        setResult('thinking');

        setTimeout(() => {
            // Club accepts if fee >= 90% of suggested. Lower offers lose patience.
            const threshold = suggestedFee * 0.9;
            if (fee >= threshold) {
                setResult('accepted');
                setTimeout(() => onAccepted(fee), 1200);
            } else {
                const newPatience = patience - 1;
                setPatience(newPatience);
                if (newPatience <= 0) {
                    setRejectMsg('The club has ended negotiations.');
                    setResult('rejected');
                } else {
                    setRejectMsg(`The club rejects your offer. They want closer to ${fmt(suggestedFee)}.`);
                    setResult('idle');
                }
            }
        }, 900);
    }

    const isFreeAgent = !player.team_id;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
            onClick={onClose}>
            <div className="relative w-full max-w-md rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
                style={{ background: 'linear-gradient(160deg, #0f1623 0%, #0a0f1a 100%)' }}
                onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="relative px-6 pt-8 pb-5 border-b border-white/10"
                    style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.1) 0%, rgba(249,115,22,0.05) 100%)' }}>
                    <button onClick={onClose}
                        className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer z-10">
                        <X size={14} />
                    </button>

                    <div className="flex items-center gap-5">
                        <div className="relative shrink-0">
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 border border-white/10 overflow-hidden shadow-2xl">
                                <PlayerPhoto playerId={player.id} className="w-full h-full" />
                            </div>
                            {!isFreeAgent && (
                                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-lg bg-gray-900 border border-white/20 p-1 shadow-xl">
                                    <TeamLogo teamId={player.team_id} className="w-full h-full" />
                                </div>
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                <ShoppingBag size={10} /> Club Negotiation
                            </p>
                            <h2 className="text-xl font-black text-white truncate leading-tight">{player.player_name}</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-gray-400 font-medium">{player.position}</span>
                                <span className="w-1 h-1 rounded-full bg-gray-700" />
                                <span className="text-xs text-gray-500 truncate">{isFreeAgent ? 'Free Agent' : player.team_name}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {isFreeAgent ? (
                    // Free agent: skip straight through
                    <div className="px-6 py-6 space-y-4">
                        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center">
                            <CheckCircle size={24} className="mx-auto text-emerald-400 mb-2" />
                            <p className="text-sm font-semibold text-emerald-400">No transfer fee needed</p>
                            <p className="text-xs text-gray-400 mt-1">This player is a free agent.</p>
                        </div>
                        <button onClick={() => onAccepted(0)}
                            className="w-full py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400 transition-all cursor-pointer">
                            Proceed to Contract
                        </button>
                    </div>
                ) : (
                    <div className="px-6 py-5 space-y-5">
                        {/* Value info */}
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-xl bg-white/[0.03] border border-white/5 px-2 py-2.5">
                                <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-0.5">Player Value</p>
                                <p className="text-xs font-bold text-gray-300">{fmt(player.player_value)}</p>
                            </div>
                            <div className="rounded-xl bg-amber-500/5 border border-amber-500/15 px-2 py-2.5">
                                <p className="text-[9px] text-amber-500/60 uppercase tracking-widest mb-0.5">Asking Price</p>
                                <p className="text-xs font-bold text-amber-400">{fmt(suggestedFee)}</p>
                            </div>
                            <div className="rounded-xl bg-white/[0.03] border border-white/5 px-2 py-2.5">
                                <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-0.5">Contract</p>
                                <p className="text-xs font-bold text-gray-300">{player.contract_years}yr</p>
                            </div>
                        </div>

                        {/* Patience */}
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-gray-500 uppercase tracking-widest">Club Patience</span>
                            <PatienceDots patience={patience} />
                        </div>

                        {/* Fee Input */}
                        <div className="rounded-xl bg-white/[0.03] border border-white/8 p-4 focus-within:border-amber-500/30 transition-all">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <p className="text-xs font-bold text-white">Transfer Fee</p>
                                    <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Your offer to the club</p>
                                </div>
                                <div className="px-2 py-1 rounded bg-white/5 border border-white/5">
                                    <DollarSign size={12} className="text-amber-500" />
                                </div>
                            </div>
                            
                            <div className="relative group">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-amber-500 group-focus-within:text-amber-400 transition-colors">$</span>
                                <input 
                                    type="text" 
                                    value={fee.toLocaleString()}
                                    onChange={(e) => {
                                        const raw = e.target.value.replace(/[^0-9]/g, '');
                                        setFee(Math.max(0, parseInt(raw) || 0));
                                    }}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-24 py-3.5 text-xl font-bold text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    <button 
                                        onClick={() => setFee(Math.max(0, fee - 50000))}
                                        className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                                    >
                                        <Minus size={12} />
                                    </button>
                                    <button 
                                        onClick={() => setFee(fee + 50000)}
                                        className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                                    >
                                        <Plus size={12} />
                                    </button>
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-end mt-3 px-1">
                                <button 
                                    onClick={() => setFee(suggestedFee)} 
                                    className="text-[10px] font-bold text-amber-500/70 hover:text-amber-400 uppercase tracking-widest transition-colors"
                                >
                                    Reset to Asking Price
                                </button>
                            </div>
                            {!canAfford && (
                                <p className="text-[10px] text-red-400 mt-2">Insufficient club funds for this fee.</p>
                            )}
                        </div>

                        {/* Rejection message */}
                        {rejectMsg && (
                            <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2.5">
                                <AlertTriangle size={13} className="text-red-400 mt-0.5 shrink-0" />
                                <p className="text-[11px] text-red-300">{rejectMsg}</p>
                            </div>
                        )}

                        {/* Funds display */}
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500">Your funds</span>
                            <span className={`font-semibold ${canAfford ? 'text-gray-300' : 'text-red-400'}`}>{formatMoney(teamMoney)}</span>
                        </div>

                        {result === 'accepted' ? (
                            <div className="w-full py-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm">
                                <CheckCircle size={16} />Deal Agreed!
                            </div>
                        ) : result === 'rejected' ? (
                            <button onClick={onClose}
                                className="w-full py-3.5 rounded-xl font-bold text-sm bg-white/5 border border-white/10 text-gray-400 cursor-pointer">
                                Close
                            </button>
                        ) : (
                            <button onClick={makeOffer} disabled={result === 'thinking' || !canAfford || patience <= 0}
                                className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2
                                    ${result === 'thinking'
                                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20'
                                        : !canAfford || patience <= 0
                                            ? 'bg-white/5 text-gray-600 border border-white/5 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400 shadow-lg shadow-amber-500/20'
                                    }`}>
                                <DollarSign size={16} />
                                {result === 'thinking' ? 'Waiting for response...' : 'Make Offer'}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Contract Signing Modal ───────────────────────────────────────────────────

interface ContractSigningProps {
    player: Player;
    transferFee: number;
    teamMoney: number;
    onClose: () => void;
    onSigned: (years: number, wage: number, bonus: number) => void;
}

function ContractSigningModal({ player, transferFee, teamMoney, onClose, onSigned }: ContractSigningProps) {
    const fundsAfterFee = teamMoney - transferFee;
    const [years, setYears] = useState(2);
    const [wage, setWage] = useState(Math.round(player.monthly_wage * 1.1 / 500) * 500 || 1000);
    const [bonus, setBonus] = useState(0);
    const [patience] = useState(MAX_PATIENCE);
    const [signed, setSigned] = useState(false);
    const [signing, setSigning] = useState(false);

    const totalCost = bonus + wage * years * 12;
    const canAffordBonus = fundsAfterFee >= bonus;

    function handleSign() {
        if (!canAffordBonus) return;
        setSigning(true);
        setTimeout(() => {
            setSigned(true);
            setTimeout(() => onSigned(years, wage, bonus), 1200);
        }, 600);
    }

    const overallColor = player.overall >= 80 ? 'text-emerald-400' : player.overall >= 60 ? 'text-amber-400' : 'text-red-400';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
            onClick={onClose}>
            <div className="relative w-full max-w-lg rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
                style={{ background: 'linear-gradient(160deg, #0f1623 0%, #0a0f1a 100%)' }}
                onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="relative px-6 pt-6 pb-5 border-b border-white/10"
                    style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.07) 0%, rgba(249,115,22,0.04) 100%)' }}>
                    <button onClick={onClose}
                        className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer">
                        <X size={14} />
                    </button>
                    <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-widest mb-3">Contract Negotiation</p>
                    <div className="flex items-center gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-0.5">
                                <h2 className="text-lg font-bold text-white leading-none">{player.player_name}</h2>
                                <span className={`text-sm font-black ${overallColor}`}>{player.overall}</span>
                            </div>
                            <p className="text-xs text-gray-500">Age {player.age} · {player.position}</p>
                            {transferFee > 0 && (
                                <p className="text-[10px] text-amber-400 mt-1">Transfer fee paid: {fmt(transferFee)}</p>
                            )}
                        </div>
                        <div className="ml-auto shrink-0 text-right">
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1.5">Patience</p>
                            <PatienceDots patience={patience} />
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="px-6 py-5 space-y-5">
                    {/* Suggested wage banner */}
                    <div className="grid grid-cols-2 gap-3 text-center">
                        <div className="rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2.5">
                            <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-0.5">Current Wage</p>
                            <p className="text-sm font-bold text-gray-300">{formatMoney(player.monthly_wage)}<span className="text-xs text-gray-600">/mo</span></p>
                        </div>
                        <div className="rounded-xl bg-amber-500/5 border border-amber-500/15 px-3 py-2.5">
                            <p className="text-[10px] text-amber-500/60 uppercase tracking-widest mb-0.5">Available Funds</p>
                            <p className="text-sm font-bold text-amber-400">{formatMoney(fundsAfterFee)}</p>
                        </div>
                    </div>

                    {/* Steppers */}
                    <div className="space-y-3">
                        <div className="rounded-xl bg-white/[0.03] border border-white/8 p-4">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <p className="text-xs font-semibold text-white">Contract Length</p>
                                    <p className="text-[10px] text-gray-500 mt-0.5">Years on new contract</p>
                                </div>
                                <Calendar size={14} className="text-gray-500 mt-0.5 shrink-0" />
                            </div>
                            <Stepper label="Years" value={years} min={1} max={5}
                                format={v => `${v} yr${v !== 1 ? 's' : ''}`} onChange={setYears} />
                        </div>

                        <div className="rounded-xl bg-white/[0.03] border border-white/8 p-4 focus-within:border-amber-500/30 transition-all">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <p className="text-xs font-bold text-white">Monthly Wage</p>
                                    <p className="text-[10px] text-gray-500 mt-0.5 font-medium">New monthly salary offer</p>
                                </div>
                                <DollarSign size={14} className="text-amber-500" />
                            </div>
                            <div className="relative group flex items-center gap-3">
                                <button onClick={() => setWage(Math.max(500, wage - 500))} disabled={wage <= 500}
                                    className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-300 hover:bg-white/10 hover:border-white/20 disabled:opacity-20 transition-all cursor-pointer">
                                    <Minus size={14} />
                                </button>
                                <div className="relative flex-1 group">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-amber-500 group-focus-within:text-amber-400">$</span>
                                    <input 
                                        type="text" 
                                        value={wage.toLocaleString()}
                                        onChange={(e) => {
                                            const raw = e.target.value.replace(/[^0-9]/g, '');
                                            setWage(Math.max(0, parseInt(raw) || 0));
                                        }}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-6 pr-3 py-2.5 text-lg font-bold text-white text-center focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
                                    />
                                </div>
                                <button onClick={() => setWage(Math.min(100000, wage + 500))} disabled={wage >= 100000}
                                    className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-300 hover:bg-white/10 hover:border-white/20 disabled:opacity-20 transition-all cursor-pointer">
                                    <Plus size={14} />
                                </button>
                            </div>
                        </div>

                        <div className="rounded-xl bg-white/[0.03] border border-white/8 p-4 focus-within:border-amber-500/30 transition-all">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <p className="text-xs font-bold text-white">Signing Bonus</p>
                                    <p className="text-[10px] text-gray-500 mt-0.5 font-medium">One-time payment from funds</p>
                                </div>
                                <Star size={14} className="text-amber-500" />
                            </div>
                            <div className="relative group flex items-center gap-3">
                                <button onClick={() => setBonus(Math.max(0, bonus - 5000))} disabled={bonus <= 0}
                                    className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-300 hover:bg-white/10 hover:border-white/20 disabled:opacity-20 transition-all cursor-pointer">
                                    <Minus size={14} />
                                </button>
                                <div className="relative flex-1 group">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-amber-500 group-focus-within:text-amber-400">$</span>
                                    <input 
                                        type="text" 
                                        value={bonus.toLocaleString()}
                                        onChange={(e) => {
                                            const raw = e.target.value.replace(/[^0-9]/g, '');
                                            setBonus(Math.max(0, parseInt(raw) || 0));
                                        }}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-6 pr-3 py-2.5 text-lg font-bold text-white text-center focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
                                    />
                                </div>
                                <button onClick={() => setBonus(Math.min(fundsAfterFee, bonus + 5000))} disabled={bonus >= fundsAfterFee}
                                    className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-300 hover:bg-white/10 hover:border-white/20 disabled:opacity-20 transition-all cursor-pointer">
                                    <Plus size={14} />
                                </button>
                            </div>
                            {bonus > 0 && !canAffordBonus && (
                                <p className="text-[10px] text-red-400 mt-2">Insufficient funds for this bonus.</p>
                            )}
                        </div>
                    </div>

                    {/* Cost summary */}
                    <div className="rounded-xl bg-white/[0.03] border border-white/5 px-4 py-3 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500">Wage over contract ({years} yr{years !== 1 ? 's' : ''})</span>
                            <span className="text-gray-300 font-semibold">{formatMoney(wage * years * 12)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500">Signing bonus (from funds)</span>
                            <span className={`font-semibold ${bonus > 0 ? 'text-amber-400' : 'text-gray-600'}`}>{bonus > 0 ? `-${formatMoney(bonus)}` : '—'}</span>
                        </div>
                        <div className="border-t border-white/5 pt-1.5 flex items-center justify-between text-xs">
                            <span className="text-gray-400 font-medium">Total Commitment</span>
                            <span className="text-white font-bold">{formatMoney(totalCost)}</span>
                        </div>
                    </div>

                    {!signed ? (
                        <button onClick={handleSign} disabled={signing || !canAffordBonus}
                            className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2
                                ${signing
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20'
                                    : !canAffordBonus
                                        ? 'bg-white/5 text-gray-600 border border-white/5 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400 shadow-lg shadow-amber-500/20'
                                }`}>
                            <FileSignature size={16} />
                            {signing ? 'Processing...' : 'Sign Contract'}
                        </button>
                    ) : (
                        <div className="w-full py-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm">
                            <CheckCircle size={16} />Contract Signed!
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Filter helpers ───────────────────────────────────────────────────────────

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button onClick={onClick}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${active
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-white/5 text-gray-400 border border-white/10 hover:border-white/20 hover:text-gray-200'}`}>
            {label}
        </button>
    );
}

function CollapsibleSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div>
            <button onClick={() => setOpen(!open)}
                className="flex items-center justify-between w-full text-[10px] uppercase tracking-widest text-gray-500 font-semibold mb-2 cursor-pointer hover:text-gray-300 transition-colors">
                {title}
                <ChevronDown size={12} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && children}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TransfersPage() {
    const { team } = useAuth();
    const [tab, setTab] = useState<Tab>('market');
    const [freeAgents, setFreeAgents] = useState<Player[]>([]);
    const [allPlayers, setAllPlayers] = useState<Player[]>([]);
    const [leagues, setLeagues] = useState<League[]>([]);
    const [teams, setTeams] = useState<TeamInfo[]>([]);
    const [receivedOffers, setReceivedOffers] = useState<Offer[]>([]);
    const [sentOffers, setSentOffers] = useState<Offer[]>([]);
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [teamMoney, setTeamMoney] = useState(0);

    // Shortlist
    const [shortlist, setShortlist] = useState<Player[]>([]);

    // Signing flow
    const [signingPlayer, setSigningPlayer] = useState<Player | null>(null);
    const [signingStep, setSigningStep] = useState<'club' | 'contract'>('club');
    const [agreedFee, setAgreedFee] = useState(0);

    // Filter state
    const [search, setSearch] = useState('');
    const [showFreeOnly, setShowFreeOnly] = useState(false);
    const [selectedLeague, setSelectedLeague] = useState<number | null>(null);
    const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
    const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
    const [selectedPosition, setSelectedPosition] = useState<string>('All');
    const [filtersOpen, setFiltersOpen] = useState(true);

    useEffect(() => {
        fetch('/api/players?freeAgents=true').then(r => r.json()).then(setFreeAgents);
        fetch('/api/players').then(r => r.json()).then(setAllPlayers);
        fetch('/api/leagues').then(r => r.json()).then(setLeagues);
        fetch('/api/teams').then(r => r.json()).then(setTeams);
        fetch('/api/offers?type=received').then(r => r.json()).then(setReceivedOffers).catch(() => { });
        fetch('/api/offers?type=sent').then(r => r.json()).then(setSentOffers).catch(() => { });
        if (team) {
            fetch(`/api/teams/${team.id}?t=${Date.now()}`).then(r => r.json()).then(d => {
                if (d?.team_money !== undefined) setTeamMoney(d.team_money);
            });
        }
    }, [team]);

    const countries = useMemo(() => {
        const set = new Set(allPlayers.map(p => p.country).filter(Boolean));
        return Array.from(set).sort();
    }, [allPlayers]);

    const filteredTeams = useMemo(() => {
        if (selectedLeague === null) return teams;
        return teams.filter(t => t.league_id === selectedLeague);
    }, [teams, selectedLeague]);

    const teamLeagueMap = useMemo(() => {
        const map: Record<number, number> = {};
        for (const t of teams) map[t.id] = t.league_id;
        return map;
    }, [teams]);

    const marketPlayers = showFreeOnly ? freeAgents : allPlayers.filter(p => p.team_id !== team?.id);

    const filtered = useMemo(() => {
        let list = marketPlayers;
        if (search) list = list.filter(p => p.player_name.toLowerCase().includes(search.toLowerCase()));
        if (selectedPosition !== 'All') list = list.filter(p => p.position === selectedPosition);
        if (selectedCountry) list = list.filter(p => p.country === selectedCountry);
        if (selectedTeam !== null) {
            list = list.filter(p => p.team_id === selectedTeam);
        } else if (selectedLeague !== null) {
            list = list.filter(p => p.team_id !== null && teamLeagueMap[p.team_id] === selectedLeague);
        }
        return list;
    }, [marketPlayers, search, selectedPosition, selectedCountry, selectedTeam, selectedLeague, teamLeagueMap]);

    const hasActiveFilters = showFreeOnly || selectedLeague !== null || selectedTeam !== null || selectedCountry !== null || selectedPosition !== 'All';

    function clearFilters() {
        setShowFreeOnly(false);
        setSelectedLeague(null);
        setSelectedTeam(null);
        setSelectedCountry(null);
        setSelectedPosition('All');
    }

    // ── Shortlist helpers ──────────────────────────────────────────────────────

    function handleShortlist(player: Player) {
        setShortlist(prev => {
            if (prev.some(p => p.id === player.id)) return prev;
            return [...prev, player];
        });
    }

    function removeFromShortlist(playerId: number) {
        setShortlist(prev => prev.filter(p => p.id !== playerId));
    }

    // ── Sign flow ─────────────────────────────────────────────────────────────

    function handleSignPlayer(player: Player) {
        setSigningPlayer(player);
        setSigningStep('club');
        setAgreedFee(0);
    }

    function handleClubAccepted(fee: number) {
        setAgreedFee(fee);
        setSigningStep('contract');
    }

    async function handleContractSigned(years: number, wage: number, bonus: number) {
        if (!signingPlayer || !team) return;

        const currentTeam = await fetch(`/api/teams/${team.id}`).then(r => r.json());
        const currentMoney = currentTeam?.team_money ?? teamMoney;
        const totalDeduction = agreedFee + bonus;
        const nextMoney = currentMoney - totalDeduction;

        await Promise.all([
            // Move player to our team
            fetch(`/api/players/${signingPlayer.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ team_id: team.id, contract_years: years, monthly_wage: wage }),
            }),
            // Deduct transfer fee + bonus from our funds
            fetch(`/api/teams/${team.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ team_money: nextMoney }),
            }).then(() => {
                // Update state manually for immediate feedback
                setTeamMoney(nextMoney);
            }),
        ]);

        // Pay selling club the transfer fee
        if (agreedFee > 0 && signingPlayer.team_id) {
            const sellerTeam = await fetch(`/api/teams/${signingPlayer.team_id}`).then(r => r.json());
            if (sellerTeam?.team_money !== undefined) {
                await fetch(`/api/teams/${signingPlayer.team_id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ team_money: sellerTeam.team_money + agreedFee }),
                });
            }
        }

        // Refresh data (with no-cache)
        const [updatedTeam, updatedPlayers] = await Promise.all([
            fetch(`/api/teams/${team.id}?t=${Date.now()}`).then(r => r.json()),
            fetch('/api/players?t=' + Date.now()).then(r => r.json()),
        ]);
        if (updatedTeam?.team_money !== undefined) setTeamMoney(updatedTeam.team_money);
        setAllPlayers(updatedPlayers);
        // Remove from shortlist if present
        setShortlist(prev => prev.filter(p => p.id !== signingPlayer.id));
        setSigningPlayer(null);
    }

    const tabs = [
        { key: 'market' as Tab, label: 'Market', icon: ShoppingCart, count: filtered.length },
        { key: 'shortlist' as Tab, label: 'Shortlist', icon: Bookmark, count: shortlist.length },
        { key: 'received' as Tab, label: 'Received', icon: Inbox, count: receivedOffers.length },
        { key: 'sent' as Tab, label: 'Sent', icon: Send, count: sentOffers.length },
    ];

    return (
        <div className="space-y-5">
            {/* Page header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">Transfer Market</h1>
                {hasActiveFilters && (
                    <button onClick={clearFilters}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all cursor-pointer">
                        <X size={12} />Clear Filters
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 md:gap-2 flex-wrap">
                {tabs.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`flex items-center gap-1 md:gap-2 px-3 md:px-4 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-medium transition-all cursor-pointer ${tab === t.key
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-sm shadow-amber-900/20'
                            : 'bg-white/5 text-gray-400 border border-white/10 hover:border-white/20'}`}>
                        <t.icon size={12} className="md:w-3.5 md:h-3.5" />
                        <span className="hidden sm:inline">{t.label}</span>
                        <span className="px-1.5 py-0.5 rounded-md text-[9px] md:text-[10px] font-bold bg-white/10 text-gray-500">{t.count}</span>
                    </button>
                ))}
            </div>

            {/* Market tab */}
            {tab === 'market' && (
                <div className="flex gap-4 items-start">
                    {/* Filters sidebar */}
                    <aside className="hidden lg:flex flex-col w-56 shrink-0 gap-4">
                        <div className="rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800/80 border border-white/10 p-4 space-y-5">
                            <div className="flex items-center gap-2">
                                <Filter size={13} className="text-amber-400" />
                                <span className="text-xs font-bold uppercase tracking-wider text-gray-300">Filters</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-400">Free Agents Only</span>
                                <button onClick={() => setShowFreeOnly(!showFreeOnly)}
                                    className={`relative w-10 h-5 rounded-full transition-all cursor-pointer ${showFreeOnly ? 'bg-amber-500' : 'bg-white/10'}`}>
                                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${showFreeOnly ? 'translate-x-5' : ''}`} />
                                </button>
                            </div>
                            <CollapsibleSection title="Position">
                                <div className="flex flex-col gap-1">
                                    {POSITIONS.map(pos => (
                                        <FilterPill key={pos}
                                            label={pos === 'All' ? 'All Positions' : pos.split(' ').map(w => w[0]).join('') + ' — ' + pos}
                                            active={selectedPosition === pos}
                                            onClick={() => setSelectedPosition(pos)} />
                                    ))}
                                </div>
                            </CollapsibleSection>
                            <CollapsibleSection title="League">
                                <div className="flex flex-col gap-1">
                                    <FilterPill label="All Leagues" active={selectedLeague === null} onClick={() => { setSelectedLeague(null); setSelectedTeam(null); }} />
                                    {leagues.map(l => (
                                        <FilterPill key={l.id} label={l.league_name} active={selectedLeague === l.id}
                                            onClick={() => { setSelectedLeague(selectedLeague === l.id ? null : l.id); setSelectedTeam(null); }} />
                                    ))}
                                </div>
                            </CollapsibleSection>
                            <CollapsibleSection title="Team" defaultOpen={false}>
                                <div className="flex flex-col gap-1 max-h-40 overflow-y-auto pr-1">
                                    <FilterPill label="All Teams" active={selectedTeam === null} onClick={() => setSelectedTeam(null)} />
                                    {filteredTeams.slice(0, 40).map(t => (
                                        <FilterPill key={t.id} label={t.team_name} active={selectedTeam === t.id}
                                            onClick={() => setSelectedTeam(selectedTeam === t.id ? null : t.id)} />
                                    ))}
                                </div>
                            </CollapsibleSection>
                            <CollapsibleSection title="Nationality" defaultOpen={false}>
                                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
                                    <FilterPill label="All Countries" active={selectedCountry === null} onClick={() => setSelectedCountry(null)} />
                                    {countries.map(c => (
                                        <FilterPill key={c} label={c} active={selectedCountry === c}
                                            onClick={() => setSelectedCountry(selectedCountry === c ? null : c)} />
                                    ))}
                                </div>
                            </CollapsibleSection>
                        </div>
                    </aside>

                    {/* Main content */}
                    <div className="flex-1 min-w-0 space-y-4">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search players..."
                                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-colors" />
                            </div>
                            <button onClick={() => setFiltersOpen(!filtersOpen)}
                                className={`lg:hidden px-3 py-2.5 rounded-xl text-sm font-medium border transition-all cursor-pointer ${hasActiveFilters ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-white/5 text-gray-400 border-white/10'}`}>
                                <Filter size={16} />
                            </button>
                            <button onClick={() => setShowFreeOnly(!showFreeOnly)}
                                className={`lg:hidden px-3 py-2 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer ${showFreeOnly ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-gray-400 border border-white/10'}`}>
                                Free
                            </button>
                        </div>

                        {/* Mobile filters */}
                        {filtersOpen && (
                            <div className="lg:hidden rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800/80 border border-white/10 p-4 space-y-4">
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mb-2">Position</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {POSITIONS.map(pos => (
                                            <FilterPill key={pos}
                                                label={pos === 'All' ? 'All' : pos.split(' ').map(w => w[0]).join('')}
                                                active={selectedPosition === pos}
                                                onClick={() => setSelectedPosition(pos)} />
                                        ))}
                                    </div>
                                </div>
                                {leagues.length > 0 && (
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mb-2">League</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            <FilterPill label="All" active={selectedLeague === null} onClick={() => { setSelectedLeague(null); setSelectedTeam(null); }} />
                                            {leagues.map(l => (
                                                <FilterPill key={l.id} label={l.league_name} active={selectedLeague === l.id}
                                                    onClick={() => { setSelectedLeague(selectedLeague === l.id ? null : l.id); setSelectedTeam(null); }} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Active filter chips */}
                        {hasActiveFilters && (
                            <div className="flex flex-wrap gap-2">
                                {showFreeOnly && (
                                    <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 text-[11px] font-medium border border-emerald-500/20">
                                        Free Agents <button onClick={() => setShowFreeOnly(false)} className="cursor-pointer opacity-60 hover:opacity-100"><X size={10} /></button>
                                    </span>
                                )}
                                {selectedPosition !== 'All' && (
                                    <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/15 text-amber-400 text-[11px] font-medium border border-amber-500/20">
                                        {selectedPosition} <button onClick={() => setSelectedPosition('All')} className="cursor-pointer opacity-60 hover:opacity-100"><X size={10} /></button>
                                    </span>
                                )}
                                {selectedLeague !== null && (
                                    <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-500/15 text-sky-400 text-[11px] font-medium border border-sky-500/20">
                                        {leagues.find(l => l.id === selectedLeague)?.league_name}
                                        <button onClick={() => { setSelectedLeague(null); setSelectedTeam(null); }} className="cursor-pointer opacity-60 hover:opacity-100"><X size={10} /></button>
                                    </span>
                                )}
                                {selectedTeam !== null && (
                                    <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-500/15 text-violet-400 text-[11px] font-medium border border-violet-500/20">
                                        {teams.find(t => t.id === selectedTeam)?.team_name}
                                        <button onClick={() => setSelectedTeam(null)} className="cursor-pointer opacity-60 hover:opacity-100"><X size={10} /></button>
                                    </span>
                                )}
                                {selectedCountry !== null && (
                                    <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-500/15 text-orange-400 text-[11px] font-medium border border-orange-500/20">
                                        {selectedCountry}
                                        <button onClick={() => setSelectedCountry(null)} className="cursor-pointer opacity-60 hover:opacity-100"><X size={10} /></button>
                                    </span>
                                )}
                            </div>
                        )}

                        <p className="text-xs text-gray-500">
                            {filtered.length} player{filtered.length !== 1 ? 's' : ''} found
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                            {filtered.slice(0, 60).map(p => (
                                <PlayerCard key={p.id} player={p as any}
                                    onClick={() => setSelectedPlayer(p as any)}
                                    onSign={handleSignPlayer as any}
                                    onShortlist={handleShortlist as any} />
                            ))}
                        </div>

                        {filtered.length === 0 && (
                            <div className="text-center py-16 rounded-2xl bg-white/[0.02] border border-white/5">
                                <Search size={32} className="mx-auto text-gray-700 mb-3" />
                                <p className="text-gray-500 font-medium">No players match your filters</p>
                                <button onClick={clearFilters} className="mt-3 text-xs text-amber-400 hover:text-amber-300 cursor-pointer">Clear all filters</button>
                            </div>
                        )}

                        {filtered.length > 60 && (
                            <p className="text-center text-xs text-gray-600">Showing first 60 results — refine filters to narrow down</p>
                        )}
                    </div>
                </div>
            )}

            {/* Shortlist tab */}
            {tab === 'shortlist' && (
                <div className="space-y-4">
                    {shortlist.length === 0 ? (
                        <div className="text-center py-16 rounded-2xl bg-white/[0.02] border border-white/5">
                            <Bookmark size={32} className="mx-auto text-gray-700 mb-3" />
                            <p className="text-gray-500 font-medium">Your shortlist is empty</p>
                            <p className="text-xs text-gray-600 mt-1">Click &quot;+ Shortlist&quot; on any player card to add them here</p>
                        </div>
                    ) : (
                        <>
                            <p className="text-xs text-gray-500">{shortlist.length} player{shortlist.length !== 1 ? 's' : ''} shortlisted</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                                {shortlist.map(p => (
                                    <div key={p.id} className="relative">
                                        <PlayerCard player={p as any}
                                            onClick={() => setSelectedPlayer(p as any)}
                                            onSign={handleSignPlayer as any}
                                            onShortlist={() => removeFromShortlist(p.id) as any}
                                            shortlistLabel="Remove" />
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Offers tabs */}
            {(tab === 'received' || tab === 'sent') && (
                <div className="space-y-2 md:space-y-3">
                    {(tab === 'received' ? receivedOffers : sentOffers).length === 0 && (
                        <div className="text-center py-12 text-gray-500 rounded-2xl bg-white/[0.02] border border-white/5">No offers.</div>
                    )}
                    {(tab === 'received' ? receivedOffers : sentOffers).map(o => (
                        <div key={o.id} className="p-4 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800/80 border border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:border-white/20 transition-colors">
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-white truncate">{o.player_name}</p>
                                <p className="text-xs text-gray-500 truncate">{tab === 'received' ? `From: ${o.from_team_name}` : `To: ${o.to_team_name}`}</p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                <span className="flex items-center gap-1 text-sm font-bold text-emerald-400">
                                    <DollarSign size={13} />{fmt(o.offer_amount)}
                                </span>
                                <span className={`px-2 py-1 rounded-lg text-[10px] md:text-xs font-bold whitespace-nowrap ${o.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : o.status === 'accepted' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{o.status}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Player detail modal */}
            {selectedPlayer && <PlayerModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}

            {/* Club negotiation modal */}
            {signingPlayer && signingStep === 'club' && (
                <ClubNegotiationModal
                    player={signingPlayer}
                    teamMoney={teamMoney}
                    onClose={() => setSigningPlayer(null)}
                    onAccepted={handleClubAccepted} />
            )}

            {/* Contract signing modal */}
            {signingPlayer && signingStep === 'contract' && (
                <ContractSigningModal
                    player={signingPlayer}
                    transferFee={agreedFee}
                    teamMoney={teamMoney}
                    onClose={() => setSigningPlayer(null)}
                    onSigned={handleContractSigned} />
            )}
        </div>
    );
}
