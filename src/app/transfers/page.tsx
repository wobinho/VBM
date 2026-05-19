'use client';
import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { useAuth } from '@/contexts/auth-context';
import PlayerCard from '@/components/player-card';
import PlayerModal from '@/components/player-modal';
import {
    Search, ShoppingCart, Inbox, Send, DollarSign, Filter,
    ChevronDown, ChevronLeft, ChevronRight, X, Bookmark, FileSignature, CheckCircle,
    Plus, Minus, AlertTriangle, Star, Calendar, Sparkles, TrendingUp, Handshake,
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
interface TeamInfo { id: number; team_name: string; league_id: number; country?: string; }
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
            <span className="font-mono text-[10px] font-bold text-[var(--ink-400)] uppercase tracking-[0.22em]">{label}</span>
            <div className="flex items-center gap-3">
                <button onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min}
                    className="w-9 h-9 rounded bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[var(--ink-300)] hover:bg-white/[0.08] hover:border-[var(--volt)]/40 hover:text-[var(--volt)] disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer">
                    <Minus size={14} />
                </button>
                <div className="flex-1 text-center">
                    <span className="font-display text-xl text-[var(--bone)] tabular">{format(value)}</span>
                </div>
                <button onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max}
                    className="w-9 h-9 rounded bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[var(--ink-300)] hover:bg-white/[0.08] hover:border-[var(--volt)]/40 hover:text-[var(--volt)] disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer">
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
                <div key={i} className={`w-3.5 h-3.5 rounded-full border transition-all duration-300 ${i < patience
                    ? 'bg-[var(--win)] border-[var(--win)] shadow-[0_0_8px_rgba(34,197,94,0.55)]'
                    : 'bg-transparent border-[var(--ink-600)]'}`} />
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
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const canAfford = teamMoney >= fee;

    function makeOffer() {
        if (!canAfford) { setResult('no_funds'); return; }
        setResult('thinking');

        setTimeout(() => {
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
    const feeDelta = fee - suggestedFee;
    const feeDeltaPct = suggestedFee > 0 ? (feeDelta / suggestedFee) * 100 : 0;
    const feeStatus = fee >= suggestedFee * 0.9
        ? { label: 'Acceptable', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25' }
        : fee >= suggestedFee * 0.7
            ? { label: 'Low Offer', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/25' }
            : { label: 'Insulting', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/25' };

    if (!mounted) return null;

    const modal = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-up"
            onClick={onClose}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
            <div className="relative w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl border border-amber-400/15 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.95)] bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900"
                onClick={e => e.stopPropagation()}>
                {/* Gold gradient accents */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
                <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-80 h-48 bg-amber-500/10 blur-3xl pointer-events-none" />
                <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/[0.04] blur-3xl pointer-events-none" />

                {/* Header */}
                <div className="relative px-6 pt-6 pb-5 border-b border-white/[0.05] overflow-hidden">
                    <button onClick={onClose}
                        className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-zinc-400 hover:text-amber-300 hover:border-amber-400/30 hover:bg-amber-500/5 transition-all cursor-pointer z-10">
                        <X size={14} />
                    </button>

                    <div className="flex items-end gap-4">
                        <div className="relative shrink-0 w-24 h-28 rounded-xl overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-900 border border-amber-400/10 shadow-lg shadow-black/40">
                            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/40 to-transparent z-10" />
                            <PlayerPhoto playerId={player.id} className="w-full h-full" />
                            {!isFreeAgent && (
                                <div className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-md bg-zinc-950/95 border border-white/15 p-1 shadow-lg z-20">
                                    <TeamLogo teamId={player.team_id} className="w-full h-full" />
                                </div>
                            )}
                        </div>

                        <div className="min-w-0 pb-1 flex-1">
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <Handshake size={11} className="text-amber-400" />
                                <p className="font-mono text-[9.5px] font-bold text-amber-400 uppercase tracking-[0.3em]">Club Negotiation</p>
                            </div>
                            <h2 className="font-display text-2xl tracking-[0.02em] text-zinc-50 truncate leading-tight">{player.player_name}</h2>
                            <div className="flex items-center gap-2 mt-1.5">
                                <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider">{player.position}</span>
                                <span className="w-1 h-1 rounded-full bg-zinc-600" />
                                <span className="font-mono text-[10px] text-zinc-500 truncate uppercase tracking-wider">{isFreeAgent ? 'Free Agent' : player.team_name}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {isFreeAgent ? (
                    <div className="px-6 py-6 space-y-4">
                        <div className="relative rounded-xl bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent border border-emerald-500/25 p-6 text-center overflow-hidden">
                            <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-24 bg-emerald-400/15 blur-3xl" />
                            <Sparkles size={28} className="mx-auto text-emerald-400 mb-2.5 relative" />
                            <p className="font-display text-lg tracking-[0.05em] text-emerald-300 relative">NO TRANSFER FEE</p>
                            <p className="font-mono text-[10px] text-emerald-500/70 mt-1.5 uppercase tracking-wider relative">This player is a free agent</p>
                        </div>
                        <button onClick={() => onAccepted(0)}
                            className="w-full py-3.5 rounded-xl font-display text-sm tracking-[0.12em] uppercase bg-gradient-to-b from-amber-300 to-amber-400 text-black hover:from-amber-200 hover:to-amber-300 shadow-lg shadow-amber-500/25 transition-all cursor-pointer flex items-center justify-center gap-2">
                            <FileSignature size={15} /> Proceed to Contract
                        </button>
                    </div>
                ) : (
                    <div className="px-6 py-5 space-y-4">
                        {/* Market values */}
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { label: 'Market Value', value: fmt(player.player_value), accent: false, icon: TrendingUp },
                                { label: 'Asking Price', value: fmt(suggestedFee), accent: true, icon: Star },
                                { label: 'Contract', value: `${player.contract_years}yr`, accent: false, icon: Calendar },
                            ].map(s => (
                                <div key={s.label}
                                    className={`relative rounded-xl px-2.5 py-3 border text-center overflow-hidden ${s.accent
                                        ? 'bg-gradient-to-b from-amber-500/10 to-amber-500/[0.03] border-amber-500/25 shadow-inner shadow-amber-500/5'
                                        : 'bg-white/[0.02] border-white/[0.05]'}`}>
                                    <s.icon size={10} className={`mx-auto mb-1 ${s.accent ? 'text-amber-400/80' : 'text-zinc-500'}`} />
                                    <p className={`font-mono text-[8.5px] uppercase tracking-widest mb-0.5 ${s.accent ? 'text-amber-500/70' : 'text-zinc-600'}`}>{s.label}</p>
                                    <p className={`font-display text-sm tabular-nums ${s.accent ? 'text-amber-300' : 'text-zinc-200'}`}>{s.value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Patience */}
                        <div className="flex items-center justify-between px-1">
                            <span className="font-mono text-[9.5px] text-zinc-500 uppercase tracking-widest">Club Patience</span>
                            <PatienceDots patience={patience} />
                        </div>

                        {/* Fee Input */}
                        <div className="relative rounded-xl bg-gradient-to-b from-white/[0.03] to-white/[0.01] border border-white/[0.07] p-4 focus-within:border-amber-500/40 focus-within:shadow-lg focus-within:shadow-amber-500/5 transition-all">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <p className="font-mono text-[10px] font-bold text-zinc-100 uppercase tracking-[0.18em]">Your Offer</p>
                                    <p className="font-mono text-[9px] text-zinc-500 mt-0.5">Transfer fee to selling club</p>
                                </div>
                                <span className={`font-mono text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-md border ${feeStatus.bg} ${feeStatus.border} ${feeStatus.color}`}>
                                    {feeStatus.label}
                                </span>
                            </div>
                            <div className="relative flex items-center gap-2">
                                <button onClick={() => setFee(Math.max(0, fee - 50000))}
                                    className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-zinc-300 hover:text-amber-300 hover:border-amber-400/30 hover:bg-amber-500/5 transition-all cursor-pointer">
                                    <Minus size={13} />
                                </button>
                                <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-amber-400">$</span>
                                    <input type="text" value={fee.toLocaleString()}
                                        onChange={(e) => { const raw = e.target.value.replace(/[^0-9]/g, ''); setFee(Math.max(0, parseInt(raw) || 0)); }}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg pl-8 pr-3 py-2.5 text-lg font-bold tabular-nums text-white text-center focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all" />
                                </div>
                                <button onClick={() => setFee(fee + 50000)}
                                    className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-zinc-300 hover:text-amber-300 hover:border-amber-400/30 hover:bg-amber-500/5 transition-all cursor-pointer">
                                    <Plus size={13} />
                                </button>
                            </div>
                            <div className="flex items-center justify-between mt-3 px-0.5">
                                <button onClick={() => setFee(suggestedFee)}
                                    className="font-mono text-[9px] font-bold text-amber-500/60 hover:text-amber-400 uppercase tracking-widest transition-colors cursor-pointer">
                                    ⟲ Match asking price
                                </button>
                                <span className={`font-mono text-[9px] tabular-nums ${feeDelta === 0 ? 'text-zinc-600' : feeDelta > 0 ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>
                                    {feeDelta === 0 ? '—' : `${feeDelta > 0 ? '+' : ''}${feeDeltaPct.toFixed(0)}%`}
                                </span>
                            </div>
                        </div>

                        {/* Rejection message */}
                        {rejectMsg && (
                            <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2.5 animate-fade-up">
                                <AlertTriangle size={12} className="text-rose-400 mt-0.5 shrink-0" />
                                <p className="font-mono text-[10px] text-rose-300 leading-relaxed">{rejectMsg}</p>
                            </div>
                        )}

                        {/* Funds */}
                        <div className="flex items-center justify-between rounded-lg bg-white/[0.02] border border-white/[0.05] px-3 py-2.5">
                            <span className="font-mono text-[9.5px] text-zinc-500 uppercase tracking-widest">Your Funds</span>
                            <span className={`font-display text-sm tabular-nums ${canAfford ? 'text-zinc-200' : 'text-rose-400'}`}>{formatMoney(teamMoney)}</span>
                        </div>

                        {result === 'accepted' ? (
                            <div className="w-full py-3.5 rounded-xl bg-gradient-to-b from-emerald-500/20 to-emerald-500/10 border border-emerald-500/30 flex items-center justify-center gap-2 text-emerald-300 font-display text-sm tracking-[0.08em] uppercase shadow-lg shadow-emerald-500/10 animate-fade-up">
                                <CheckCircle size={15} />Deal Agreed!
                            </div>
                        ) : result === 'rejected' ? (
                            <button onClick={onClose}
                                className="w-full py-3.5 rounded-xl font-display text-sm tracking-[0.08em] uppercase bg-white/[0.04] border border-white/[0.08] text-zinc-400 cursor-pointer hover:bg-white/[0.07] transition-colors">
                                Close
                            </button>
                        ) : (
                            <button onClick={makeOffer} disabled={result === 'thinking' || !canAfford || patience <= 0}
                                className={`w-full py-3.5 rounded-xl font-display text-sm tracking-[0.1em] uppercase transition-all cursor-pointer flex items-center justify-center gap-2
                                    ${result === 'thinking'
                                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                                        : !canAfford || patience <= 0
                                            ? 'bg-white/[0.03] text-zinc-600 border border-white/[0.05] cursor-not-allowed'
                                            : 'bg-gradient-to-b from-amber-300 to-amber-400 text-black hover:from-amber-200 hover:to-amber-300 shadow-lg shadow-amber-500/25'
                                    }`}>
                                <DollarSign size={15} />
                                {result === 'thinking' ? 'Awaiting Response...' : 'Make Offer'}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(modal, document.body);
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
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const totalCost = bonus + wage * years * 12;
    const canAffordBonus = fundsAfterFee >= bonus;
    const wageDelta = player.monthly_wage > 0 ? ((wage - player.monthly_wage) / player.monthly_wage) * 100 : 0;

    function handleSign() {
        if (!canAffordBonus) return;
        setSigning(true);
        setTimeout(() => {
            setSigned(true);
            setTimeout(() => onSigned(years, wage, bonus), 1200);
        }, 600);
    }

    const overallTone = player.overall >= 80
        ? { color: 'text-emerald-300', ring: 'border-emerald-400/30', glow: 'shadow-emerald-500/20', tier: 'ELITE' }
        : player.overall >= 70
            ? { color: 'text-amber-300', ring: 'border-amber-400/30', glow: 'shadow-amber-500/20', tier: 'STAR' }
            : player.overall >= 60
                ? { color: 'text-sky-300', ring: 'border-sky-400/25', glow: 'shadow-sky-500/15', tier: 'PRO' }
                : { color: 'text-zinc-300', ring: 'border-white/15', glow: 'shadow-black/40', tier: 'PROSPECT' };

    if (!mounted) return null;

    const modal = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-up"
            onClick={onClose}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
            <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl border border-amber-400/15 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.95)] bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900"
                onClick={e => e.stopPropagation()}>
                {/* Gold accents */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
                <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-80 h-48 bg-amber-500/10 blur-3xl pointer-events-none" />
                <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/[0.04] blur-3xl pointer-events-none" />

                {/* Header */}
                <div className="relative px-6 pt-6 pb-5 border-b border-white/[0.05] overflow-hidden bg-gradient-to-br from-amber-500/[0.05] via-transparent to-transparent">
                    <button onClick={onClose}
                        className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-zinc-400 hover:text-amber-300 hover:border-amber-400/30 hover:bg-amber-500/5 transition-all cursor-pointer z-10">
                        <X size={14} />
                    </button>

                    <div className="flex items-end gap-5">
                        <div className={`relative shrink-0 w-28 h-32 rounded-xl overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-900 border ${overallTone.ring} shadow-lg ${overallTone.glow}`}>
                            <PlayerPhoto playerId={player.id} className="w-full h-full" />
                            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent" />
                            <div className="absolute bottom-1 left-0 right-0 flex flex-col items-center">
                                <div className={`font-display text-xl tabular-nums leading-none ${overallTone.color} drop-shadow-[0_0_10px_rgba(0,0,0,0.9)]`}>
                                    {player.overall}
                                </div>
                                <div className={`font-mono text-[8px] tracking-[0.2em] mt-0.5 ${overallTone.color} opacity-70`}>
                                    {overallTone.tier}
                                </div>
                            </div>
                        </div>

                        <div className="min-w-0 pb-1 flex-1">
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <FileSignature size={11} className="text-amber-400" />
                                <p className="font-mono text-[9.5px] font-bold text-amber-400 uppercase tracking-[0.3em]">Contract Terms</p>
                            </div>
                            <h2 className="font-display text-2xl tracking-[0.02em] text-zinc-50 truncate leading-tight">{player.player_name}</h2>
                            <p className="font-mono text-[10px] text-zinc-400 mt-1 uppercase tracking-wider">Age {player.age} · {player.position}</p>
                            {transferFee > 0 && (
                                <div className="inline-flex items-center gap-1.5 mt-2 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20">
                                    <DollarSign size={9} className="text-amber-400" />
                                    <p className="font-mono text-[9px] font-bold text-amber-300 uppercase tracking-wider">Fee Paid: {fmt(transferFee)}</p>
                                </div>
                            )}
                            <div className="flex items-center justify-between mt-3">
                                <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest">Player Patience</span>
                                <PatienceDots patience={patience} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="px-6 py-5 space-y-4">
                    {/* Funds summary */}
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { label: 'Current Wage', value: `${formatMoney(player.monthly_wage)}/mo`, accent: false, icon: TrendingUp },
                            { label: 'Available Funds', value: formatMoney(fundsAfterFee), accent: true, icon: DollarSign },
                        ].map(s => (
                            <div key={s.label}
                                className={`relative rounded-xl px-3 py-3 border text-center overflow-hidden ${s.accent
                                    ? 'bg-gradient-to-b from-amber-500/10 to-amber-500/[0.03] border-amber-500/25 shadow-inner shadow-amber-500/5'
                                    : 'bg-white/[0.02] border-white/[0.05]'}`}>
                                <s.icon size={10} className={`mx-auto mb-1 ${s.accent ? 'text-amber-400/80' : 'text-zinc-500'}`} />
                                <p className={`font-mono text-[8.5px] uppercase tracking-widest mb-0.5 ${s.accent ? 'text-amber-500/70' : 'text-zinc-600'}`}>{s.label}</p>
                                <p className={`font-display text-sm tabular-nums ${s.accent ? 'text-amber-300' : 'text-zinc-200'}`}>{s.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Contract length */}
                    <div className="rounded-xl bg-gradient-to-b from-white/[0.03] to-white/[0.01] border border-white/[0.07] p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="font-mono text-[10px] font-bold text-zinc-100 uppercase tracking-[0.18em]">Contract Length</p>
                                <p className="font-mono text-[9px] text-zinc-500 mt-0.5">Duration of new deal</p>
                            </div>
                            <div className="w-7 h-7 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                                <Calendar size={12} className="text-amber-400" />
                            </div>
                        </div>
                        <Stepper label="Years" value={years} min={1} max={5} format={v => `${v} year${v !== 1 ? 's' : ''}`} onChange={setYears} />
                    </div>

                    {/* Monthly Wage */}
                    <div className="rounded-xl bg-gradient-to-b from-white/[0.03] to-white/[0.01] border border-white/[0.07] p-4 focus-within:border-amber-500/40 focus-within:shadow-lg focus-within:shadow-amber-500/5 transition-all">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="font-mono text-[10px] font-bold text-zinc-100 uppercase tracking-[0.18em]">Monthly Wage</p>
                                <p className="font-mono text-[9px] text-zinc-500 mt-0.5">New salary per month</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {player.monthly_wage > 0 && (
                                    <span className={`font-mono text-[9px] tabular-nums px-1.5 py-0.5 rounded ${wageDelta > 0 ? 'text-emerald-400 bg-emerald-500/10' : wageDelta < 0 ? 'text-rose-400 bg-rose-500/10' : 'text-zinc-500 bg-white/[0.03]'}`}>
                                        {wageDelta > 0 ? '+' : ''}{wageDelta.toFixed(0)}%
                                    </span>
                                )}
                                <div className="w-7 h-7 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                                    <DollarSign size={12} className="text-amber-400" />
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setWage(Math.max(500, wage - 500))} disabled={wage <= 500}
                                className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-zinc-300 hover:text-amber-300 hover:border-amber-400/30 hover:bg-amber-500/5 disabled:opacity-20 transition-all cursor-pointer">
                                <Minus size={13} />
                            </button>
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-amber-400">$</span>
                                <input type="text" value={wage.toLocaleString()}
                                    onChange={(e) => { const raw = e.target.value.replace(/[^0-9]/g, ''); setWage(Math.max(0, parseInt(raw) || 0)); }}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg pl-8 pr-3 py-2.5 text-lg font-bold tabular-nums text-white text-center focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all" />
                            </div>
                            <button onClick={() => setWage(Math.min(100000, wage + 500))} disabled={wage >= 100000}
                                className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-zinc-300 hover:text-amber-300 hover:border-amber-400/30 hover:bg-amber-500/5 disabled:opacity-20 transition-all cursor-pointer">
                                <Plus size={13} />
                            </button>
                        </div>
                    </div>

                    {/* Signing Bonus */}
                    <div className="rounded-xl bg-gradient-to-b from-white/[0.03] to-white/[0.01] border border-white/[0.07] p-4 focus-within:border-amber-500/40 focus-within:shadow-lg focus-within:shadow-amber-500/5 transition-all">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="font-mono text-[10px] font-bold text-zinc-100 uppercase tracking-[0.18em]">Signing Bonus</p>
                                <p className="font-mono text-[9px] text-zinc-500 mt-0.5">One-time payment from funds</p>
                            </div>
                            <div className="w-7 h-7 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                                <Star size={12} className="text-amber-400" />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setBonus(Math.max(0, bonus - 5000))} disabled={bonus <= 0}
                                className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-zinc-300 hover:text-amber-300 hover:border-amber-400/30 hover:bg-amber-500/5 disabled:opacity-20 transition-all cursor-pointer">
                                <Minus size={13} />
                            </button>
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-amber-400">$</span>
                                <input type="text" value={bonus.toLocaleString()}
                                    onChange={(e) => { const raw = e.target.value.replace(/[^0-9]/g, ''); setBonus(Math.max(0, parseInt(raw) || 0)); }}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg pl-8 pr-3 py-2.5 text-lg font-bold tabular-nums text-white text-center focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all" />
                            </div>
                            <button onClick={() => setBonus(Math.min(fundsAfterFee, bonus + 5000))} disabled={bonus >= fundsAfterFee}
                                className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-zinc-300 hover:text-amber-300 hover:border-amber-400/30 hover:bg-amber-500/5 disabled:opacity-20 transition-all cursor-pointer">
                                <Plus size={13} />
                            </button>
                        </div>
                        {bonus > 0 && !canAffordBonus && (
                            <p className="font-mono text-[9px] text-rose-400 mt-2 flex items-center gap-1.5">
                                <AlertTriangle size={10} /> Insufficient funds for this bonus
                            </p>
                        )}
                    </div>

                    {/* Cost summary */}
                    <div className="rounded-xl bg-gradient-to-b from-amber-500/[0.06] to-amber-500/[0.02] border border-amber-500/20 px-4 py-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="font-mono text-[9.5px] text-zinc-400 uppercase tracking-wider">Wage · {years} yr{years !== 1 ? 's' : ''}</span>
                            <span className="font-mono text-[10px] font-semibold tabular-nums text-zinc-300">{formatMoney(wage * years * 12)}</span>
                        </div>
                        {bonus > 0 && (
                            <div className="flex items-center justify-between">
                                <span className="font-mono text-[9.5px] text-zinc-400 uppercase tracking-wider">Signing Bonus</span>
                                <span className="font-mono text-[10px] font-semibold tabular-nums text-amber-300">{formatMoney(bonus)}</span>
                            </div>
                        )}
                        <div className="border-t border-amber-500/15 pt-2 flex items-center justify-between">
                            <span className="font-mono text-[10px] font-bold text-amber-300 uppercase tracking-[0.14em]">Total Commitment</span>
                            <span className="font-display text-base text-amber-200 tabular-nums">{formatMoney(totalCost)}</span>
                        </div>
                    </div>

                    {!signed ? (
                        <button onClick={handleSign} disabled={signing || !canAffordBonus}
                            className={`w-full py-3.5 rounded-xl font-display text-sm tracking-[0.1em] uppercase transition-all cursor-pointer flex items-center justify-center gap-2
                                ${signing
                                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                                    : !canAffordBonus
                                        ? 'bg-white/[0.03] text-zinc-600 border border-white/[0.05] cursor-not-allowed'
                                        : 'bg-gradient-to-b from-amber-300 to-amber-400 text-black hover:from-amber-200 hover:to-amber-300 shadow-lg shadow-amber-500/25'
                                }`}>
                            <FileSignature size={15} />
                            {signing ? 'Processing...' : 'Sign Contract'}
                        </button>
                    ) : (
                        <div className="w-full py-3.5 rounded-xl bg-gradient-to-b from-emerald-500/20 to-emerald-500/10 border border-emerald-500/30 flex items-center justify-center gap-2 text-emerald-300 font-display text-sm tracking-[0.08em] uppercase shadow-lg shadow-emerald-500/10 animate-fade-up">
                            <CheckCircle size={15} />Contract Signed!
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(modal, document.body);
}

// ─── Filter helpers ───────────────────────────────────────────────────────────

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button onClick={onClick}
            className={`px-3 py-1.5 rounded font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] transition-all cursor-pointer whitespace-nowrap text-left ${active
                ? 'bg-[var(--volt)] text-[var(--ink-950)]'
                : 'bg-white/[0.025] text-[var(--ink-400)] border border-white/[0.06] hover:border-[var(--volt)]/30 hover:text-[var(--bone)]'}`}>
            {label}
        </button>
    );
}

function CollapsibleSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div>
            <button onClick={() => setOpen(!open)}
                className="flex items-center justify-between w-full font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--ink-400)] font-bold mb-2 cursor-pointer hover:text-[var(--bone)] transition-colors">
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
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 12;

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

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages - 1);
    const pagedPlayers = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

    useEffect(() => { setPage(0); }, [search, selectedPosition, selectedCountry, selectedTeam, selectedLeague, showFreeOnly]);

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
            if (prev.some(p => p.id === player.id)) {
                // Toggle: remove if already shortlisted
                return prev.filter(p => p.id !== player.id);
            }
            return [...prev, player];
        });
    }

    function removeFromShortlist(playerId: number) {
        setShortlist(prev => prev.filter(p => p.id !== playerId));
    }

    function isShortlisted(playerId: number) {
        return shortlist.some(p => p.id === playerId);
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
        <div className="space-y-6 animate-fade-up">
            {/* Page header */}
            <div className="relative flex flex-col sm:flex-row sm:items-end gap-4 sm:justify-between pb-5 border-b border-white/[0.06]">
                <div className="absolute -top-2 left-0 h-[3px] w-16 bg-[var(--volt)]" />
                <div>
                    <p className="eyebrow mb-2">Market · Recruitment</p>
                    <h1 className="font-display text-5xl tracking-[0.02em] text-[var(--bone)] leading-[0.85]">TRANSFER MARKET</h1>
                </div>
                {hasActiveFilters && (
                    <button onClick={clearFilters}
                        className="flex items-center gap-1.5 px-3 py-2 rounded font-mono text-[11px] font-bold uppercase tracking-[0.18em] bg-[var(--loss)]/10 text-[var(--loss)] border border-[var(--loss)]/25 hover:bg-[var(--loss)]/20 transition-all cursor-pointer">
                        <X size={12} />Clear Filters
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1.5 md:gap-2 flex-wrap">
                {tabs.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded font-display tracking-[0.1em] uppercase text-sm transition-all cursor-pointer border ${tab === t.key
                            ? 'bg-[var(--volt)] text-[var(--ink-950)] border-[var(--volt-deep)]'
                            : 'bg-white/[0.03] text-[var(--ink-400)] border-white/[0.06] hover:border-[var(--volt)]/30 hover:text-[var(--bone)]'}`}>
                        <t.icon size={13} />
                        <span className="hidden sm:inline">{t.label}</span>
                        <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold tabular ${tab === t.key ? 'bg-[var(--ink-950)]/15 text-[var(--ink-950)]' : 'bg-white/10 text-[var(--ink-500)]'}`}>{t.count}</span>
                    </button>
                ))}
            </div>

            {/* Market tab */}
            {tab === 'market' && (
                <div className="flex gap-4 items-start">
                    {/* Filters sidebar */}
                    <aside className="hidden lg:flex flex-col w-60 shrink-0 gap-4">
                        <div className="surface-raised p-5 space-y-5">
                            <div className="flex items-center gap-2">
                                <Filter size={14} className="text-[var(--volt)]" />
                                <span className="font-display text-base tracking-[0.05em] text-[var(--bone)]">FILTERS</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="font-mono text-[10.5px] text-[var(--ink-400)] uppercase tracking-[0.18em]">Free Agents Only</span>
                                <button onClick={() => setShowFreeOnly(!showFreeOnly)}
                                    className={`relative w-10 h-5 rounded-full transition-all cursor-pointer ${showFreeOnly ? 'bg-[var(--volt)]' : 'bg-white/10'}`}>
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
                                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-500)]" />
                                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search players…"
                                    className="w-full pl-11 pr-4 py-3 bg-[var(--ink-850)] border border-white/[0.06] rounded text-[var(--bone)] text-sm placeholder-[var(--ink-500)] focus:outline-none focus:border-[var(--volt)]/60 focus:ring-2 focus:ring-[var(--volt)]/15 transition-all" />
                            </div>
                            <button onClick={() => setFiltersOpen(!filtersOpen)}
                                className={`lg:hidden px-3 py-2.5 rounded border transition-all cursor-pointer ${hasActiveFilters ? 'bg-[var(--volt)]/20 text-[var(--volt)] border-[var(--volt)]/35' : 'bg-white/[0.04] text-[var(--ink-400)] border-white/[0.08]'}`}>
                                <Filter size={16} />
                            </button>
                            <button onClick={() => setShowFreeOnly(!showFreeOnly)}
                                className={`lg:hidden px-3 py-2 rounded font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] transition-all shrink-0 cursor-pointer ${showFreeOnly ? 'bg-[var(--win)]/15 text-[var(--win)] border border-[var(--win)]/30' : 'bg-white/[0.04] text-[var(--ink-400)] border border-white/[0.08]'}`}>
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

                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <p className="font-mono text-[11px] text-[var(--ink-400)] uppercase tracking-[0.2em] tabular">
                                <span className="text-[var(--volt)] font-bold">{filtered.length}</span> player{filtered.length !== 1 ? 's' : ''} found
                            </p>
                            {filtered.length > 0 && (
                                <p className="font-mono text-[10px] text-[var(--ink-500)] uppercase tracking-[0.18em] tabular">
                                    Page <span className="text-[var(--bone)] font-bold">{safePage + 1}</span> of <span className="text-[var(--bone)] font-bold">{totalPages}</span>
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
                            {pagedPlayers.map(p => (
                                <PlayerCard key={p.id} player={p as any}
                                    onClick={() => setSelectedPlayer(p as any)}
                                    onSign={handleSignPlayer as any}
                                    onShortlist={handleShortlist as any}
                                    shortlistLabel={isShortlisted(p.id) ? '✓ Shortlisted' : '+ Shortlist'} />
                            ))}
                        </div>

                        {filtered.length === 0 && (
                            <div className="surface text-center py-16 px-6 flex flex-col items-center gap-3">
                                <Search size={32} className="text-[var(--ink-600)]" />
                                <p className="font-display text-xl tracking-wide text-[var(--ink-300)]">NO PLAYERS MATCH</p>
                                <button onClick={clearFilters} className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--volt)] hover:text-[var(--volt-bright)] cursor-pointer">Clear all filters</button>
                            </div>
                        )}

                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 pt-2">
                                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage <= 0}
                                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[var(--ink-300)] font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] hover:bg-[var(--volt)]/10 hover:border-[var(--volt)]/40 hover:text-[var(--volt)] disabled:opacity-25 disabled:cursor-not-allowed transition-all cursor-pointer">
                                    <ChevronLeft size={13} /> Prev
                                </button>

                                <div className="flex items-center gap-1.5 px-2">
                                    {Array.from({ length: totalPages }).map((_, i) => {
                                        // Show first, last, current and neighbors
                                        const isCurrent = i === safePage;
                                        const isEdge = i === 0 || i === totalPages - 1;
                                        const isNear = Math.abs(i - safePage) <= 1;
                                        if (totalPages > 7 && !isCurrent && !isEdge && !isNear) {
                                            if (i === 1 && safePage > 2) return <span key={i} className="font-mono text-[10px] text-[var(--ink-600)]">…</span>;
                                            if (i === totalPages - 2 && safePage < totalPages - 3) return <span key={i} className="font-mono text-[10px] text-[var(--ink-600)]">…</span>;
                                            return null;
                                        }
                                        return (
                                            <button key={i} onClick={() => setPage(i)}
                                                className={`w-8 h-8 rounded-md font-mono text-[11px] font-bold tabular-nums transition-all cursor-pointer ${isCurrent
                                                    ? 'bg-[var(--volt)] text-[var(--ink-950)]'
                                                    : 'bg-white/[0.04] border border-white/[0.08] text-[var(--ink-400)] hover:border-[var(--volt)]/40 hover:text-[var(--volt)]'}`}>
                                                {i + 1}
                                            </button>
                                        );
                                    })}
                                </div>

                                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1}
                                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[var(--ink-300)] font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] hover:bg-[var(--volt)]/10 hover:border-[var(--volt)]/40 hover:text-[var(--volt)] disabled:opacity-25 disabled:cursor-not-allowed transition-all cursor-pointer">
                                    Next <ChevronRight size={13} />
                                </button>
                            </div>
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
