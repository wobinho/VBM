'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { getCountryCode } from '@/lib/country-codes';
import Image from 'next/image';
import {
    TrendingUp, TrendingDown, DollarSign, Users, Calendar,
    Building2, Star, ShieldCheck, BarChart3, ChevronUp, ChevronDown,
    Wifi, Trophy, Zap, ArrowUpDown, FileSignature, X, Plus, Minus,
    CheckCircle, Receipt,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Player {
    id: number;
    player_name: string;
    position: string;
    age: number;
    country: string;
    overall: number;
    contract_years: number;
    monthly_wage: number;
    player_value: number;
}

interface FinancialTransaction {
    id: number;
    team_id: number;
    month: string;
    income_matchday: number;
    income_sponsorship: number;
    income_merchandise: number;
    income_broadcast: number;
    income_other: number;
    expense_wages: number;
    expense_staff: number;
    expense_other: number;
    net: number;
    created_at: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MONTHLY_INCOME = 50_000;
const MAX_PATIENCE = 3; // patience dots, MM3-style

const POSITION_COLORS: Record<string, string> = {
    'Setter': 'text-violet-400 bg-violet-400/10 border-violet-400/20',
    'Outside Hitter': 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    'Middle Blocker': 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
    'Opposite Hitter': 'text-orange-400 bg-orange-400/10 border-orange-400/20',
    'Libero': 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
};

const POSITION_SHORT: Record<string, string> = {
    'Setter': 'SET',
    'Outside Hitter': 'OH',
    'Middle Blocker': 'MB',
    'Opposite Hitter': 'OPP',
    'Libero': 'LIB',
};

const POSITION_BAR_COLOR: Record<string, string> = {
    'Setter': 'bg-violet-500',
    'Outside Hitter': 'bg-amber-500',
    'Middle Blocker': 'bg-cyan-500',
    'Opposite Hitter': 'bg-orange-500',
    'Libero': 'bg-emerald-500',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMoney(n: number) {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toLocaleString()}`;
}

function countryFlagSrc(country: string) {
    const code = country.length > 2 ? getCountryCode(country) : country.toLowerCase();
    return `/assets/flags/${code}.svg`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlayerAvatar({ playerId, size = 40 }: { playerId: number; size?: number }) {
    const [src, setSrc] = useState(`/assets/players/${playerId}.png`);
    const [failed, setFailed] = useState(false);

    const handleError = useCallback(() => {
        if (src !== '/assets/players/default.png') {
            setSrc('/assets/players/default.png');
        } else {
            setFailed(true);
        }
    }, [src]);

    if (failed) {
        return (
            <div
                style={{ width: size, height: size }}
                className="rounded-xl bg-gradient-to-br from-gray-700 to-gray-800 border border-white/10 flex items-center justify-center shrink-0"
            >
                <svg viewBox="0 0 40 50" style={{ width: size * 0.6, height: size * 0.7 }} fill="none">
                    <ellipse cx="20" cy="14" rx="9" ry="10" fill="#4B5563" />
                    <path d="M5 50 Q5 30 20 29 Q35 30 35 50Z" fill="#4B5563" />
                </svg>
            </div>
        );
    }

    return (
        <div
            style={{ width: size, height: size }}
            className="relative rounded-xl overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900 border border-white/10 shrink-0"
        >
            <Image
                src={src}
                alt="Player"
                fill
                unoptimized
                className="object-cover object-top"
                onError={handleError}
            />
        </div>
    );
}

function CountryFlag({ country, small = false }: { country: string; small?: boolean }) {
    const [failed, setFailed] = useState(false);
    const code = country.length > 2 ? getCountryCode(country) : country.toLowerCase();
    const cls = small ? 'w-4 h-3' : 'w-5 h-3.5';

    if (failed) {
        return (
            <span className={`${cls} rounded-sm bg-gray-700 inline-flex items-center justify-center text-[8px] font-bold text-white uppercase`}>
                {code.slice(0, 2)}
            </span>
        );
    }

    return (
        <img
            src={countryFlagSrc(country)}
            alt={code}
            className={`${cls} rounded-sm object-cover inline-block`}
            loading="lazy"
            onError={() => setFailed(true)}
        />
    );
}

function StatCard({
    label, value, sub, icon: Icon, color, trend,
}: {
    label: string; value: string; sub?: string;
    icon: React.ElementType; color: string; trend?: 'up' | 'down' | 'neutral';
}) {
    const trendIcon = trend === 'up'
        ? <TrendingUp size={12} className="text-emerald-400" />
        : trend === 'down'
            ? <TrendingDown size={12} className="text-red-400" />
            : null;

    return (
        <div className="rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800/80 border border-white/10 p-5 flex flex-col gap-3 hover:border-white/20 transition-all duration-200">
            <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 uppercase tracking-widest font-medium">{label}</span>
                <div className={`p-2 rounded-xl ${color}`}>
                    <Icon size={16} />
                </div>
            </div>
            <div>
                <p className="text-2xl font-bold text-white leading-none">{value}</p>
                {sub && (
                    <div className="flex items-center gap-1 mt-1.5">
                        {trendIcon}
                        <p className="text-xs text-gray-500">{sub}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
    const pct = Math.min(100, (value / (max || 1)) * 100);
    return (
        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
        </div>
    );
}

// ─── Stepper (MM3-style +/- control) ─────────────────────────────────────────

function Stepper({
    label, value, min, max, step = 1, format, onChange,
}: {
    label: string; value: number; min: number; max: number;
    step?: number; format: (v: number) => string; onChange: (v: number) => void;
}) {
    return (
        <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">{label}</span>
            <div className="flex items-center gap-3">
                <button
                    onClick={() => onChange(Math.max(min, value - step))}
                    disabled={value <= min}
                    className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-300 hover:bg-white/10 hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer"
                    aria-label={`Decrease ${label}`}
                >
                    <Minus size={14} />
                </button>
                <div className="flex-1 text-center">
                    <span className="text-lg font-bold text-white">{format(value)}</span>
                </div>
                <button
                    onClick={() => onChange(Math.min(max, value + step))}
                    disabled={value >= max}
                    className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-300 hover:bg-white/10 hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer"
                    aria-label={`Increase ${label}`}
                >
                    <Plus size={14} />
                </button>
            </div>
        </div>
    );
}

// ─── Patience Dots (MM3-style) ─────────────────────────────────────────────────

function PatienceDots({ patience }: { patience: number }) {
    return (
        <div className="flex items-center gap-1.5">
            {Array.from({ length: MAX_PATIENCE }).map((_, i) => (
                <div
                    key={i}
                    className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${i < patience
                        ? 'bg-emerald-400 border-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]'
                        : 'bg-transparent border-gray-600'
                        }`}
                />
            ))}
        </div>
    );
}

// ─── Cash Flow Breakdown Modal ────────────────────────────────────────────────

function CashFlowModal({ tx, onClose }: { tx: FinancialTransaction; onClose: () => void }) {
    const monthLabel = new Date(tx.month + '-02').toLocaleString('default', { month: 'long', year: 'numeric' });
    const totalIncome = tx.income_matchday + tx.income_sponsorship + tx.income_merchandise + tx.income_broadcast + tx.income_other;
    const totalExpenses = tx.expense_wages + tx.expense_staff + tx.expense_other;

    const incomeRows = [
        { label: 'Matchday Revenue', value: tx.income_matchday },
        { label: 'Shirt Sponsorship', value: tx.income_sponsorship },
        { label: 'Merchandise Sales', value: tx.income_merchandise },
        { label: 'Broadcast Rights', value: tx.income_broadcast },
        ...(tx.income_other > 0 ? [{ label: 'Other Income', value: tx.income_other }] : []),
    ];

    const expenseRows = [
        { label: 'Player Wages', value: tx.expense_wages },
        { label: 'Staff Costs', value: tx.expense_staff },
        ...(tx.expense_other > 0 ? [{ label: 'Other Expenses', value: tx.expense_other }] : []),
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
            onClick={onClose}>
            <div className="relative w-full max-w-md rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
                style={{ background: 'linear-gradient(160deg, #0f1623 0%, #0a0f1a 100%)' }}
                onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="relative px-6 pt-6 pb-5 border-b border-white/10"
                    style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.07) 0%, rgba(249,115,22,0.04) 100%)' }}>
                    <button onClick={onClose}
                        className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer">
                        <X size={14} />
                    </button>
                    <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-widest mb-1">Cash Flow Breakdown</p>
                    <h2 className="text-xl font-bold text-white">{monthLabel}</h2>
                </div>

                <div className="px-6 py-5 space-y-5">
                    {/* Income */}
                    <div>
                        <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest mb-2">Income</p>
                        <div className="rounded-xl bg-white/[0.03] border border-white/8 overflow-hidden">
                            {incomeRows.map((row, i) => (
                                <div key={row.label} className={`flex items-center justify-between px-4 py-2.5 ${i < incomeRows.length - 1 ? 'border-b border-white/5' : ''}`}>
                                    <span className="text-sm text-gray-400">{row.label}</span>
                                    <span className="text-sm font-semibold text-emerald-400">{formatMoney(row.value)}</span>
                                </div>
                            ))}
                            <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-500/5 border-t border-emerald-500/20">
                                <span className="text-sm font-bold text-white">Total Income</span>
                                <span className="text-sm font-black text-emerald-400">{formatMoney(totalIncome)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Expenses */}
                    <div>
                        <p className="text-[10px] font-semibold text-red-400 uppercase tracking-widest mb-2">Expenses</p>
                        <div className="rounded-xl bg-white/[0.03] border border-white/8 overflow-hidden">
                            {expenseRows.map((row, i) => (
                                <div key={row.label} className={`flex items-center justify-between px-4 py-2.5 ${i < expenseRows.length - 1 ? 'border-b border-white/5' : ''}`}>
                                    <span className="text-sm text-gray-400">{row.label}</span>
                                    <span className="text-sm font-semibold text-red-400">-{formatMoney(row.value)}</span>
                                </div>
                            ))}
                            <div className="flex items-center justify-between px-4 py-2.5 bg-red-500/5 border-t border-red-500/20">
                                <span className="text-sm font-bold text-white">Total Expenses</span>
                                <span className="text-sm font-black text-red-400">-{formatMoney(totalExpenses)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Net */}
                    <div className={`rounded-xl px-4 py-3 border flex items-center justify-between ${tx.net >= 0 ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-red-500/10 border-red-500/25'}`}>
                        <span className="text-sm font-bold text-white">Net Cash Flow</span>
                        <span className={`text-lg font-black ${tx.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {tx.net >= 0 ? '+' : ''}{formatMoney(tx.net)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Contract Negotiation Modal ───────────────────────────────────────────────

interface NegotiationModalProps {
    player: Player;
    teamMoney: number;
    onClose: () => void;
    onSigned: (playerId: number, years: number, wage: number, bonus: number) => void;
}

function ContractNegotiationModal({ player, teamMoney, onClose, onSigned }: NegotiationModalProps) {
    const [years, setYears] = useState(player.contract_years || 1);
    const [wage, setWage] = useState(player.monthly_wage);
    const [bonus, setBonus] = useState(0);
    const [patience] = useState(MAX_PATIENCE); // always full — logic added later
    const [signed, setSigned] = useState(false);
    const [signing, setSigning] = useState(false);

    const suggestedWage = Math.round(player.monthly_wage * 1.05 / 100) * 100;
    const totalCost = bonus + wage * years * 12;
    const canAffordBonus = teamMoney >= bonus;

    function handleSign() {
        if (!canAffordBonus) return;
        setSigning(true);
        setTimeout(() => {
            setSigned(true);
            setTimeout(() => {
                onSigned(player.id, years, wage, bonus);
            }, 1200);
        }, 600);
    }

    const overallColor = player.overall >= 80 ? 'text-emerald-400' : player.overall >= 60 ? 'text-amber-400' : 'text-red-400';

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-lg rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
                style={{ background: 'linear-gradient(160deg, #0f1623 0%, #0a0f1a 100%)' }}
                onClick={e => e.stopPropagation()}
            >
                {/* ── Header band ── */}
                <div className="relative px-6 pt-6 pb-5 border-b border-white/10"
                    style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.07) 0%, rgba(249,115,22,0.04) 100%)' }}>

                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-150 cursor-pointer"
                        aria-label="Close"
                    >
                        <X size={14} />
                    </button>

                    <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-widest mb-3">Contract Negotiation</p>

                    <div className="flex items-center gap-4">
                        {/* Player portrait */}
                        <div className="relative shrink-0">
                            <PlayerAvatar playerId={player.id} size={64} />
                            {/* Overall badge */}
                            <div className={`absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-lg border border-black/40 flex items-center justify-center text-[11px] font-black ${overallColor} bg-gray-900`}>
                                {player.overall}
                            </div>
                        </div>

                        {/* Name + meta */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                                <h2 className="text-lg font-bold text-white leading-none truncate">{player.player_name}</h2>
                                <CountryFlag country={player.country} />
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${POSITION_COLORS[player.position] ?? 'text-gray-400 bg-white/5 border-white/10'}`}>
                                    {POSITION_SHORT[player.position] ?? player.position}
                                </span>
                                <span className="text-xs text-gray-500">Age {player.age}</span>
                                <span className="text-xs text-gray-600">·</span>
                                <span className="text-xs text-gray-500">{formatMoney(player.player_value)} value</span>
                            </div>
                        </div>

                        {/* Patience */}
                        <div className="shrink-0 text-right">
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1.5">Patience</p>
                            <PatienceDots patience={patience} />
                        </div>
                    </div>
                </div>

                {/* ── Negotiation Controls ── */}
                <div className="px-6 py-5 space-y-5">
                    {/* Current vs Offer banner */}
                    <div className="grid grid-cols-2 gap-3 text-center">
                        <div className="rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2.5">
                            <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-0.5">Current Wage</p>
                            <p className="text-sm font-bold text-gray-300">{formatMoney(player.monthly_wage)}<span className="text-xs text-gray-600">/mo</span></p>
                        </div>
                        <div className="rounded-xl bg-amber-500/5 border border-amber-500/15 px-3 py-2.5">
                            <p className="text-[10px] text-amber-500/60 uppercase tracking-widest mb-0.5">Suggested Offer</p>
                            <p className="text-sm font-bold text-amber-400">{formatMoney(suggestedWage)}<span className="text-xs text-amber-600">/mo</span></p>
                        </div>
                    </div>

                    {/* Steppers */}
                    <div className="grid grid-cols-1 gap-4">
                        {/* Years to extend */}
                        <div className="rounded-xl bg-white/[0.03] border border-white/8 p-4">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <p className="text-xs font-semibold text-white">Contract Length</p>
                                    <p className="text-[10px] text-gray-500 mt-0.5">Years before renewal is required</p>
                                </div>
                                <Calendar size={14} className="text-gray-500 mt-0.5 shrink-0" />
                            </div>
                            <Stepper
                                label="Years"
                                value={years}
                                min={1}
                                max={5}
                                format={v => `${v} yr${v !== 1 ? 's' : ''}`}
                                onChange={setYears}
                            />
                        </div>

                        {/* New wage */}
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

                        {/* Signing bonus */}
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
                                <button onClick={() => setBonus(Math.min(teamMoney, bonus + 5000))} disabled={bonus >= teamMoney}
                                    className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-300 hover:bg-white/10 hover:border-white/20 disabled:opacity-20 transition-all cursor-pointer">
                                    <Plus size={14} />
                                </button>
                            </div>
                            {bonus > 0 && !canAffordBonus && (
                                <p className="text-[10px] text-red-400 mt-2">Insufficient club funds for this bonus.</p>
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

                    {/* Sign button */}
                    {!signed ? (
                        <button
                            onClick={handleSign}
                            disabled={signing || !canAffordBonus}
                            className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-200 cursor-pointer flex items-center justify-center gap-2
                                ${signing
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20'
                                    : !canAffordBonus
                                        ? 'bg-white/5 text-gray-600 border border-white/5 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400 shadow-lg shadow-amber-500/20'
                                }`}
                        >
                            <FileSignature size={16} />
                            {signing ? 'Processing...' : 'Sign Contract'}
                        </button>
                    ) : (
                        <div className="w-full py-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm">
                            <CheckCircle size={16} />
                            Contract Signed!
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Sort helpers ─────────────────────────────────────────────────────────────

type SortKey = 'player_name' | 'contract_years' | 'monthly_wage' | 'player_value';

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OfficePage() {
    const { team } = useAuth();
    const [players, setPlayers] = useState<Player[]>([]);
    const [teamMoney, setTeamMoney] = useState<number | null>(null);
    const [sortBy, setSortBy] = useState<SortKey>('monthly_wage');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [negotiating, setNegotiating] = useState<Player | null>(null);
    const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
    const [selectedTx, setSelectedTx] = useState<FinancialTransaction | null>(null);
    const [cashFlowExpanded, setCashFlowExpanded] = useState(true);

    const fetchData = useCallback(() => {
        if (!team) return;
        fetch(`/api/players?teamId=${team.id}`)
            .then(r => r.json())
            .then((data: Player[]) => setPlayers(data));
        fetch(`/api/teams/${team.id}?t=${Date.now()}`)
            .then(r => r.json())
            .then((data) => {
                if (data?.team_money !== undefined) setTeamMoney(data.team_money);
            });
        fetch('/api/finances')
            .then(r => r.json())
            .then((data: FinancialTransaction[]) => { if (Array.isArray(data)) setTransactions(data); });
    }, [team]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Handle contract signed: PATCH player + PATCH team funds
    async function handleSigned(playerId: number, years: number, wage: number, bonus: number) {
        setNegotiating(null);

        // Fetch current team money to ensure we have the latest value (no-cache)
        const currentTeam = await fetch(`/api/teams/${team!.id}?t=${Date.now()}`).then(r => r.json());
        const currentMoney = currentTeam?.team_money ?? teamMoney ?? 0;
        const nextMoney = currentMoney - bonus;

        await Promise.all([
            fetch(`/api/players/${playerId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contract_years: years, monthly_wage: wage }),
            }),
            bonus > 0
                ? fetch(`/api/teams/${team!.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ team_money: nextMoney }),
                }).then(() => {
                    // Update state manually for immediate feedback
                    setTeamMoney(nextMoney);
                })
                : Promise.resolve(),
        ]);

        fetchData();
    }

    const totalWages = useMemo(
        () => players.reduce((sum, p) => sum + (p.monthly_wage ?? 0), 0),
        [players]
    );

    const netCashflow = MONTHLY_INCOME - totalWages;

    const sorted = useMemo(() => {
        return [...players].sort((a, b) => {
            const av = a[sortBy];
            const bv = b[sortBy];
            if (typeof av === 'string' && typeof bv === 'string')
                return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
            return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
        });
    }, [players, sortBy, sortDir]);

    function toggleSort(key: SortKey) {
        if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortBy(key); setSortDir('desc'); }
    }

    const SortIcon = ({ col }: { col: SortKey }) => {
        if (sortBy !== col) return <ArrowUpDown size={12} className="text-gray-600" />;
        return sortDir === 'desc'
            ? <ChevronDown size={12} className="text-amber-400" />
            : <ChevronUp size={12} className="text-amber-400" />;
    };

    const wageByPosition = useMemo(() => {
        const map: Record<string, number> = {};
        players.forEach(p => { map[p.position] = (map[p.position] ?? 0) + p.monthly_wage; });
        return Object.entries(map).sort((a, b) => b[1] - a[1]);
    }, [players]);

    const expiryBuckets = useMemo(() => {
        const b = { soon: 0, mid: 0, long: 0 };
        players.forEach(p => {
            if (p.contract_years <= 1) b.soon++;
            else if (p.contract_years <= 2) b.mid++;
            else b.long++;
        });
        return b;
    }, [players]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">Club Office</h1>
                <p className="text-sm text-gray-400 mt-0.5">{team?.name || 'Your Club'} — Financial Management</p>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <StatCard label="Club Funds" value={teamMoney !== null ? formatMoney(teamMoney) : '—'} sub="Total available budget" icon={DollarSign} color="bg-amber-500/15 text-amber-400" trend="neutral" />
                <StatCard label="Monthly Income" value={formatMoney(MONTHLY_INCOME)} sub="Matchday + sponsorship" icon={TrendingUp} color="bg-emerald-500/15 text-emerald-400" trend="up" />
                <StatCard label="Monthly Wages" value={formatMoney(totalWages)} sub={`${players.length} players on payroll`} icon={Users} color="bg-red-500/15 text-red-400" trend="down" />
                <StatCard
                    label="Net Cash Flow"
                    value={formatMoney(Math.abs(netCashflow))}
                    sub={netCashflow >= 0 ? 'Monthly surplus' : 'Monthly deficit'}
                    icon={netCashflow >= 0 ? TrendingUp : TrendingDown}
                    color={netCashflow >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}
                    trend={netCashflow >= 0 ? 'up' : 'down'}
                />
            </div>

            {/* Middle Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Wage by Position */}
                <div className="rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800/80 border border-white/10 p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <BarChart3 size={16} className="text-amber-400" />
                        <h2 className="text-sm font-semibold text-white">Wage by Position</h2>
                    </div>
                    <div className="space-y-3">
                        {wageByPosition.length === 0
                            ? <p className="text-xs text-gray-600">No data</p>
                            : wageByPosition.map(([pos, total]) => (
                                <div key={pos}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${POSITION_COLORS[pos] ?? 'text-gray-400 bg-white/5 border-white/10'}`}>
                                            {POSITION_SHORT[pos] ?? pos}
                                        </span>
                                        <span className="text-xs text-gray-400">{formatMoney(total)}</span>
                                    </div>
                                    <MiniBar value={total} max={totalWages} color={POSITION_BAR_COLOR[pos] ?? 'bg-gray-500'} />
                                </div>
                            ))}
                    </div>
                </div>

                {/* Contract Expiry Risk */}
                <div className="rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800/80 border border-white/10 p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Calendar size={16} className="text-cyan-400" />
                        <h2 className="text-sm font-semibold text-white">Contract Expiry Risk</h2>
                    </div>
                    <div className="space-y-3">
                        {[
                            { label: 'Expiring (≤ 1 yr)', count: expiryBuckets.soon, color: 'bg-red-500', text: 'text-red-400' },
                            { label: 'Mid-term (2 yrs)', count: expiryBuckets.mid, color: 'bg-amber-500', text: 'text-amber-400' },
                            { label: 'Long-term (3+ yrs)', count: expiryBuckets.long, color: 'bg-emerald-500', text: 'text-emerald-400' },
                        ].map(({ label, count, color, text }) => (
                            <div key={label}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs text-gray-400">{label}</span>
                                    <span className={`text-xs font-bold ${text}`}>{count}</span>
                                </div>
                                <MiniBar value={count} max={players.length} color={color} />
                            </div>
                        ))}
                        {players.length > 0 && (
                            <p className="text-[10px] text-gray-600 pt-1 border-t border-white/5">
                                {expiryBuckets.soon} player{expiryBuckets.soon !== 1 ? 's' : ''} need{expiryBuckets.soon === 1 ? 's' : ''} renewal soon
                            </p>
                        )}
                    </div>
                </div>

                {/* Revenue Streams */}
                <div className="rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800/80 border border-white/10 p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Zap size={16} className="text-violet-400" />
                        <h2 className="text-sm font-semibold text-white">Revenue Streams</h2>
                    </div>
                    <div className="space-y-2.5">
                        {[
                            { label: 'Matchday Revenue', amount: 18_000, icon: Trophy, color: 'text-amber-400' },
                            { label: 'Shirt Sponsorship', amount: 15_000, icon: Star, color: 'text-violet-400' },
                            { label: 'Merchandise Sales', amount: 10_000, icon: WifiIcon, color: 'text-cyan-400' },
                            { label: 'Broadcast Rights', amount: 7_000, icon: Wifi, color: 'text-emerald-400' },
                        ].map(({ label, amount, icon: Icon, color }) => (
                            <div key={label} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                                <div className="flex items-center gap-2">
                                    <Icon size={13} className={color} />
                                    <span className="text-xs text-gray-400">{label}</span>
                                </div>
                                <span className="text-xs font-semibold text-white">{formatMoney(amount)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Facility widgets */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Stadium', val: 'Home Arena', sub: 'Capacity: 5,000', icon: Building2, color: 'text-amber-400 bg-amber-400/10' },
                    { label: 'Facility Grade', val: 'B+', sub: 'Upgrade available', icon: ShieldCheck, color: 'text-cyan-400 bg-cyan-400/10' },
                    { label: 'Fan Rating', val: '72 / 100', sub: '+4 this season', icon: Star, color: 'text-violet-400 bg-violet-400/10' },
                    { label: 'Staff Costs', val: formatMoney(8_000), sub: 'Per month', icon: Users, color: 'text-red-400 bg-red-400/10' },
                ].map(({ label, val, sub, icon: Icon, color }) => (
                    <div key={label} className="rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800/80 border border-white/10 p-4 hover:border-white/20 transition-all duration-200 cursor-default">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-3 ${color}`}>
                            <Icon size={16} />
                        </div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">{label}</p>
                        <p className="text-sm font-bold text-white">{val}</p>
                        <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>
                    </div>
                ))}
            </div>

            {/* Cash Flow History */}
            <div className="rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800/80 border border-white/10 overflow-hidden">
                <div 
                    className="px-5 py-4 border-b border-white/10 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors group"
                    onClick={() => setCashFlowExpanded(!cashFlowExpanded)}
                >
                    <div className="flex items-center gap-2">
                        <Receipt size={16} className="text-amber-400" />
                        <h2 className="text-sm font-semibold text-white">Monthly Cash Flow</h2>
                    </div>
                    <div className="text-gray-500 group-hover:text-gray-300 transition-colors">
                        {cashFlowExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                </div>

                {cashFlowExpanded && (
                    <>
                        {transactions.length === 0 ? (
                            <div className="px-5 py-10 text-center">
                                <p className="text-sm text-gray-600">No transactions yet — cash flow updates on the 1st of each month.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {/* Column headers */}
                                <div className="grid grid-cols-[1fr_100px_100px_100px] gap-4 px-5 py-2.5 text-[10px] text-gray-600 uppercase tracking-widest font-semibold bg-white/[0.02]">
                                    <span>Period</span>
                                    <span className="text-right">Income</span>
                                    <span className="text-right">Expenses</span>
                                    <span className="text-right">Net</span>
                                </div>
                                {transactions.map(tx => {
                                    const monthLabel = new Date(tx.month + '-02').toLocaleString('default', { month: 'long', year: 'numeric' });
                                    const totalIncome = tx.income_matchday + tx.income_sponsorship + tx.income_merchandise + tx.income_broadcast + tx.income_other;
                                    const totalExpenses = tx.expense_wages + tx.expense_staff + tx.expense_other;
                                    return (
                                        <div key={tx.id}
                                            onClick={() => setSelectedTx(tx)}
                                            className="grid grid-cols-[1fr_100px_100px_100px] gap-4 px-5 py-3.5 items-center cursor-pointer hover:bg-white/[0.03] transition-colors">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${tx.net >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                                <span className="text-sm font-medium text-white">{monthLabel}</span>
                                            </div>
                                            <span className="text-sm text-emerald-400 font-semibold text-right">{formatMoney(totalIncome)}</span>
                                            <span className="text-sm text-red-400 font-semibold text-right">-{formatMoney(totalExpenses)}</span>
                                            <span className={`text-sm font-black text-right ${tx.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {tx.net >= 0 ? '+' : ''}{formatMoney(tx.net)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Player Contracts Table */}
            <div className="rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800/80 border border-white/10 overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-semibold text-white">Player Contracts & Wages</h2>
                        <p className="text-[11px] text-gray-500 mt-0.5">{players.length} players — Click columns to sort</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest">Total Payroll</p>
                        <p className="text-sm font-bold text-red-400">{formatMoney(totalWages)}/mo</p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/5">
                                {([
                                    { key: 'player_name', label: 'Player' },
                                    { key: 'contract_years', label: 'Contract' },
                                    { key: 'monthly_wage', label: 'Wages / mo' },
                                    { key: 'player_value', label: 'Market Value' },
                                ] as { key: SortKey; label: string }[]).map(col => (
                                    <th
                                        key={col.key}
                                        onClick={() => toggleSort(col.key)}
                                        className="px-4 py-3 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-300 transition-colors select-none"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            {col.label}
                                            <SortIcon col={col.key} />
                                        </div>
                                    </th>
                                ))}
                                <th className="px-4 py-3 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">Wage Share</th>
                                <th className="px-4 py-3 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wider">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {sorted.map((player) => {
                                const wagePct = totalWages > 0 ? (player.monthly_wage / totalWages) * 100 : 0;
                                const contractColor = player.contract_years <= 1 ? 'text-red-400' : player.contract_years <= 2 ? 'text-amber-400' : 'text-emerald-400';
                                const overallColor = player.overall >= 80 ? 'text-emerald-400' : player.overall >= 60 ? 'text-amber-400' : 'text-red-400';

                                return (
                                    <tr key={player.id} className="hover:bg-white/[0.02] transition-colors group">
                                        {/* Player cell — photo + name + country + position + OVR */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                {/* Photo */}
                                                <PlayerAvatar playerId={player.id} size={40} />

                                                {/* Name + meta */}
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5 mb-0.5">
                                                        <p className="text-white font-semibold text-sm leading-none truncate">{player.player_name}</p>
                                                        <CountryFlag country={player.country} small />
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${POSITION_COLORS[player.position] ?? 'text-gray-400 bg-white/5 border-white/10'}`}>
                                                            {POSITION_SHORT[player.position] ?? player.position}
                                                        </span>
                                                        <span className={`text-[11px] font-bold ${overallColor}`}>{player.overall} OVR</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Contract */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5">
                                                <Calendar size={12} className={contractColor} />
                                                <span className={`text-sm font-semibold ${contractColor}`}>
                                                    {player.contract_years} yr{player.contract_years !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Wage */}
                                        <td className="px-4 py-3">
                                            <span className="text-white font-semibold">{formatMoney(player.monthly_wage)}</span>
                                        </td>

                                        {/* Value */}
                                        <td className="px-4 py-3">
                                            <span className="text-amber-400 font-semibold">{formatMoney(player.player_value)}</span>
                                        </td>

                                        {/* Wage Share bar */}
                                        <td className="px-4 py-3 min-w-[120px]">
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
                                                        style={{ width: `${wagePct}%` }}
                                                    />
                                                </div>
                                                <span className="text-[11px] text-gray-500 w-8 text-right shrink-0">{wagePct.toFixed(0)}%</span>
                                            </div>
                                        </td>

                                        {/* Negotiate button */}
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => setNegotiating(player)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/30 transition-all duration-150 cursor-pointer whitespace-nowrap"
                                            >
                                                <FileSignature size={12} />
                                                Negotiate
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {players.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-gray-600 text-sm">
                                        No players found. Sign players via the Transfer Market.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {players.length > 0 && (
                    <div className="px-5 py-3 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-xs text-gray-500">
                        <span>{players.length} players</span>
                        <div className="flex items-center gap-6">
                            <span>Total wages: <span className="text-red-400 font-semibold">{formatMoney(totalWages)}/mo</span></span>
                            <span>Total value: <span className="text-amber-400 font-semibold">{formatMoney(players.reduce((s, p) => s + p.player_value, 0))}</span></span>
                        </div>
                    </div>
                )}
            </div>

            {/* Contract Negotiation Modal */}
            {negotiating && teamMoney !== null && (
                <ContractNegotiationModal
                    player={negotiating}
                    teamMoney={teamMoney}
                    onClose={() => setNegotiating(null)}
                    onSigned={handleSigned}
                />
            )}

            {/* Cash Flow Breakdown Modal */}
            {selectedTx && (
                <CashFlowModal tx={selectedTx} onClose={() => setSelectedTx(null)} />
            )}
        </div>
    );
}

// Inline SVG for merchandise icon (avoids lucide ShoppingCart import conflict)
function WifiIcon({ size = 13, className = '' }: { size?: number; className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
            <circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" />
            <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
        </svg>
    );
}
