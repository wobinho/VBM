'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/auth-context';
import { getCountryCode } from '@/lib/country-codes';
import Image from 'next/image';
import {
    TrendingUp, TrendingDown, DollarSign, Users, Calendar,
    Building2, Star, BarChart3, ChevronUp, ChevronDown,
    Wifi, Trophy, Zap, ArrowUpDown, FileSignature, X, Plus, Minus,
    CheckCircle, Receipt, ArrowRight, Lock, Wrench,
} from 'lucide-react';
import {
    OFFICE_FACILITY_DEFS,
    OFFICE_FACILITY_ORDER,
    OFFICE_LEVEL_MULTIPLIER,
    OFFICE_UPGRADE_COST_TO_LEVEL,
    OFFICE_MAX_LEVEL,
    computeEconomyMultipliers,
    type OfficeFacilityKey,
    type OfficeFacilityDef,
    type EconomyLine,
} from '@/lib/office/facilities';

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

interface OfficeFacility {
    id: number;
    facility_type: string;
    level: number;
    upgradeCost: number | null;
}

type TabType = 'office' | 'financial' | 'staff';

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_PATIENCE = 3;

// Base economy lines — must match runMonthlyEconomy()
const BASE_LINES: Record<EconomyLine, number> = {
    income_matchday: 18_000,
    income_sponsorship: 15_000,
    income_merchandise: 10_000,
    income_broadcast: 7_000,
    expense_staff: 8_000,
    expense_other: 0,
};

const LINE_LABEL: Record<EconomyLine, string> = {
    income_matchday: 'Matchday',
    income_sponsorship: 'Sponsorship',
    income_merchandise: 'Merchandise',
    income_broadcast: 'Broadcast',
    expense_staff: 'Staff Costs',
    expense_other: 'Other Expenses',
};

const POSITION_COLORS: Record<string, string> = {
    'Setter': 'text-[#60a5fa] bg-[#3b82f6]/10 border-[#3b82f6]/30',
    'Outside Hitter': 'text-[#fca5a5] bg-[#ef4444]/10 border-[#ef4444]/30',
    'Middle Blocker': 'text-[#c4b5fd] bg-[#a78bfa]/10 border-[#a78bfa]/30',
    'Opposite Hitter': 'text-[#fdba74] bg-[#fb923c]/10 border-[#fb923c]/30',
    'Libero': 'text-[#86efac] bg-[#22c55e]/10 border-[#22c55e]/30',
};

const POSITION_SHORT: Record<string, string> = {
    'Setter': 'SET',
    'Outside Hitter': 'OH',
    'Middle Blocker': 'MB',
    'Opposite Hitter': 'OPP',
    'Libero': 'LIB',
};

const POSITION_BAR_COLOR: Record<string, string> = {
    'Setter': 'bg-[#3b82f6]',
    'Outside Hitter': 'bg-[#ef4444]',
    'Middle Blocker': 'bg-[#a78bfa]',
    'Opposite Hitter': 'bg-[#fb923c]',
    'Libero': 'bg-[#22c55e]',
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
        ? <TrendingUp size={12} className="text-[var(--win)]" />
        : trend === 'down'
            ? <TrendingDown size={12} className="text-[var(--loss)]" />
            : null;

    return (
        <div className="surface-raised relative p-5 flex flex-col gap-3 card-hover overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-[var(--volt)]/60" />
            <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--ink-400)] font-semibold">{label}</span>
                <div className={`p-2 rounded ${color}`}>
                    <Icon size={15} />
                </div>
            </div>
            <div>
                <p className="font-display text-3xl tracking-wide text-[var(--bone)] leading-none tabular">{value}</p>
                {sub && (
                    <div className="flex items-center gap-1.5 mt-2">
                        {trendIcon}
                        <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-500)]">{sub}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
    const pct = Math.min(100, (value / (max || 1)) * 100);
    return (
        <div className="w-full h-1 bg-white/[0.06] overflow-hidden">
            <div className={`h-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
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
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-400)] font-bold">{label}</span>
            <div className="flex items-center gap-3">
                <button
                    onClick={() => onChange(Math.max(min, value - step))}
                    disabled={value <= min}
                    className="w-9 h-9 rounded bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[var(--ink-300)] hover:bg-white/[0.08] hover:border-[var(--volt)]/40 hover:text-[var(--volt)] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer"
                    aria-label={`Decrease ${label}`}
                >
                    <Minus size={14} />
                </button>
                <div className="flex-1 text-center">
                    <span className="font-display text-xl text-[var(--bone)] tabular">{format(value)}</span>
                </div>
                <button
                    onClick={() => onChange(Math.min(max, value + step))}
                    disabled={value >= max}
                    className="w-9 h-9 rounded bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[var(--ink-300)] hover:bg-white/[0.08] hover:border-[var(--volt)]/40 hover:text-[var(--volt)] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer"
                    aria-label={`Increase ${label}`}
                >
                    <Plus size={14} />
                </button>
            </div>
        </div>
    );
}

function PatienceDots({ patience }: { patience: number }) {
    return (
        <div className="flex items-center gap-1.5">
            {Array.from({ length: MAX_PATIENCE }).map((_, i) => (
                <div
                    key={i}
                    className={`w-3.5 h-3.5 rounded-full border transition-all duration-300 ${i < patience
                        ? 'bg-[var(--win)] border-[var(--win)] shadow-[0_0_8px_rgba(34,197,94,0.55)]'
                        : 'bg-transparent border-[var(--ink-600)]'
                        }`}
                />
            ))}
        </div>
    );
}

// ─── Yearly Cash Flow Row ─────────────────────────────────────────────────────

interface YearlyAggregate {
    year: string;
    totalIncome: number;
    totalExpenses: number;
    net: number;
    months: FinancialTransaction[];
}

function aggregateByYear(transactions: FinancialTransaction[]): YearlyAggregate[] {
    const map: Record<string, YearlyAggregate> = {};
    for (const tx of transactions) {
        const year = tx.month.slice(0, 4);
        if (!map[year]) map[year] = { year, totalIncome: 0, totalExpenses: 0, net: 0, months: [] };
        const income = tx.income_matchday + tx.income_sponsorship + tx.income_merchandise + tx.income_broadcast + tx.income_other;
        const expenses = tx.expense_wages + tx.expense_staff + tx.expense_other;
        map[year].totalIncome += income;
        map[year].totalExpenses += expenses;
        map[year].net += tx.net;
        map[year].months.push(tx);
    }
    return Object.values(map).sort((a, b) => b.year.localeCompare(a.year));
}

// ─── Office Facility Card & Modal ─────────────────────────────────────────────

// Stylized background — SVG pattern + half-bled icon + diagonal ribbon + vignette.
// Patterns mirror the training-page blueprint so the two pages feel like one game.
function OfficeBlueprint({ def, level }: { def: OfficeFacilityDef; level: number }) {
    const c = def.accent;
    const Icon = def.icon;
    const patternId = `office-pat-${def.key}`;

    return (
        <div
            className="relative w-full h-full overflow-hidden"
            style={{
                background: `linear-gradient(160deg, ${c}1a 0%, ${c}05 35%, var(--ink-900) 80%)`,
            }}
        >
            {/* SVG pattern overlay */}
            <svg className="absolute inset-0 w-full h-full opacity-[0.18]" preserveAspectRatio="none">
                <defs>
                    {def.pattern === 'grid' && (
                        <pattern id={patternId} x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
                            <path d="M 22 0 L 0 0 0 22" fill="none" stroke={c} strokeWidth="0.6" />
                        </pattern>
                    )}
                    {def.pattern === 'lines' && (
                        <pattern id={patternId} x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                            <line x1="0" y1="0" x2="0" y2="14" stroke={c} strokeWidth="1.4" />
                        </pattern>
                    )}
                    {def.pattern === 'dots' && (
                        <pattern id={patternId} x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
                            <circle cx="7" cy="7" r="1.4" fill={c} />
                        </pattern>
                    )}
                    {def.pattern === 'wave' && (
                        <pattern id={patternId} x="0" y="0" width="40" height="20" patternUnits="userSpaceOnUse">
                            <path d="M 0 10 Q 10 0 20 10 T 40 10" fill="none" stroke={c} strokeWidth="0.9" />
                        </pattern>
                    )}
                    {def.pattern === 'hex' && (
                        <pattern id={patternId} x="0" y="0" width="28" height="32" patternUnits="userSpaceOnUse">
                            <path d="M14 2 L26 9 L26 23 L14 30 L2 23 L2 9 Z" fill="none" stroke={c} strokeWidth="0.7" />
                        </pattern>
                    )}
                    {def.pattern === 'cross' && (
                        <pattern id={patternId} x="0" y="0" width="18" height="18" patternUnits="userSpaceOnUse">
                            <path d="M 9 4 L 9 14 M 4 9 L 14 9" stroke={c} strokeWidth="0.8" />
                        </pattern>
                    )}
                    {def.pattern === 'arc' && (
                        <pattern id={patternId} x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                            <path d="M 0 40 A 40 40 0 0 1 40 0" fill="none" stroke={c} strokeWidth="0.7" />
                        </pattern>
                    )}
                    {def.pattern === 'noise' && (
                        <pattern id={patternId} x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
                            <circle cx="10" cy="14" r="0.9" fill={c} />
                            <circle cx="38" cy="22" r="0.6" fill={c} />
                            <circle cx="22" cy="40" r="0.7" fill={c} />
                            <circle cx="50" cy="48" r="0.5" fill={c} />
                            <circle cx="6" cy="52" r="0.8" fill={c} />
                        </pattern>
                    )}
                </defs>
                <rect width="100%" height="100%" fill={`url(#${patternId})`} />
            </svg>

            {/* Half-bled tonal icon — bottom-right corner */}
            <div className="absolute -right-6 -bottom-6 opacity-25" style={{ color: c }}>
                <Icon size={140} strokeWidth={1.1} />
            </div>

            {/* Diagonal blueprint ribbon */}
            <div
                className="absolute top-3 -left-12 px-12 py-0.5 font-mono text-[8px] tracking-[0.32em] uppercase rotate-[-30deg]"
                style={{ background: `${c}30`, color: c, border: `1px solid ${c}55` }}
            >
                FACILITY · {def.short}
            </div>

            {/* Level pip column */}
            <div className="absolute bottom-3 left-3 flex flex-col items-center gap-1">
                {[5, 4, 3, 2, 1].map(i => (
                    <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-sm"
                        style={{ background: i <= level ? c : `${c}22`, boxShadow: i <= level ? `0 0 6px ${c}` : 'none' }}
                    />
                ))}
            </div>

            {/* Bottom vignette */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(120% 80% at 50% 110%, var(--ink-950) 0%, transparent 55%)' }}
            />
        </div>
    );
}

function OfficeFacilityCard({
    facilityKey, level, idx, onClick,
}: {
    facilityKey: OfficeFacilityKey;
    level: number;
    idx: number;
    onClick: () => void;
}) {
    const def = OFFICE_FACILITY_DEFS[facilityKey];
    const Icon = def.icon;
    const c = def.accent;
    const isMax = level >= OFFICE_MAX_LEVEL;

    // Headline effect: pick the strongest income line this facility touches.
    const headline = useMemo(() => {
        const incomeEffects = def.effects.filter(e => e.line.startsWith('income_'));
        const pick = incomeEffects.length > 0 ? incomeEffects[0] : def.effects[0];
        return pick;
    }, [def]);

    const headlinePct = headline ? Math.round(headline.perLevel * level * 100) : 0;
    const headlineSign = headlinePct >= 0 ? '+' : '';

    return (
        <button
            onClick={onClick}
            className="group relative overflow-hidden rounded-[14px] surface card-hover animate-fade-up text-left cursor-pointer"
            style={{ animationDelay: `${idx * 50}ms`, borderColor: `${c}25` }}
        >
            <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: c }} />

            {/* Hero — stylized blueprint background */}
            <div className="relative h-[128px] border-b border-white/8">
                <OfficeBlueprint def={def} level={level} />

                {/* Level badge */}
                <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-sm bg-[var(--ink-950)]/85 backdrop-blur-sm border" style={{ borderColor: `${c}55` }}>
                    <span className="font-mono text-[8.5px] tracking-[0.22em] uppercase" style={{ color: c }}>Lv</span>
                    <span className="font-display text-lg leading-none tabular" style={{ color: c }}>{level}</span>
                    <span className="font-mono text-[8.5px] text-[var(--ink-500)]">/{OFFICE_MAX_LEVEL}</span>
                </div>

                {/* Icon chip */}
                <div className="absolute top-2 left-2 w-9 h-9 rounded-md flex items-center justify-center border backdrop-blur-sm" style={{ background: `${c}14`, borderColor: `${c}40` }}>
                    <Icon size={18} style={{ color: c }} />
                </div>

                {/* Headline percent — bottom-right, layered over the blueprint */}
                {level > 0 && (
                    <div className="absolute bottom-2 right-2 flex items-baseline gap-1 px-2 py-0.5 rounded-sm bg-[var(--ink-950)]/80 backdrop-blur-sm border" style={{ borderColor: `${c}40` }}>
                        <span className="font-display text-lg leading-none tabular" style={{ color: c }}>
                            {headlineSign}{headlinePct}%
                        </span>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-3 flex flex-col gap-2.5">
                <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-display text-base leading-tight tracking-wide uppercase text-[var(--bone)] truncate">
                        {def.name}
                    </h3>
                    <span className="font-mono text-[10px] tabular px-1.5 py-0.5 rounded-sm bg-white/5 text-[var(--ink-300)]">
                        {OFFICE_LEVEL_MULTIPLIER[level].toFixed(2)}×
                    </span>
                </div>

                {/* Effect chips */}
                <div className="flex flex-wrap gap-1">
                    {def.effects.slice(0, 3).map(eff => {
                        const isIncome = eff.line.startsWith('income_');
                        const sign = eff.perLevel >= 0 ? '+' : '';
                        const cls = isIncome
                            ? eff.perLevel >= 0 ? 'text-[var(--win)] bg-[var(--win)]/10 border-[var(--win)]/25'
                                                : 'text-[var(--loss)] bg-[var(--loss)]/10 border-[var(--loss)]/25'
                            : eff.perLevel <= 0 ? 'text-[var(--win)] bg-[var(--win)]/10 border-[var(--win)]/25'
                                                : 'text-[var(--loss)] bg-[var(--loss)]/10 border-[var(--loss)]/25';
                        return (
                            <span key={eff.line} className={`font-mono text-[8.5px] tracking-[0.18em] uppercase px-1.5 py-0.5 rounded-sm border ${cls}`}>
                                {LINE_LABEL[eff.line].slice(0, 8)} {sign}{Math.round(eff.perLevel * 100)}%
                            </span>
                        );
                    })}
                </div>

                {/* Level ladder */}
                <div className="flex items-center gap-1 pt-0.5">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div
                            key={i}
                            className="h-1 flex-1 rounded-sm transition-all"
                            style={{ background: i <= level ? c : 'rgba(255,255,255,0.08)' }}
                        />
                    ))}
                </div>

                {/* CTA strip */}
                <div className="mt-1 flex items-center justify-between gap-2 px-2 py-1.5 rounded-sm border border-white/8 bg-white/[0.02] group-hover:bg-white/[0.04] transition">
                    <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-[var(--ink-400)]">
                        {isMax ? 'Maxed' : 'View / Upgrade'}
                    </span>
                    <ArrowRight size={11} className="text-[var(--ink-500)] group-hover:text-[var(--bone)] transition-colors" />
                </div>
            </div>
        </button>
    );
}

function OfficeFacilityDetailModal({
    facilityKey, level, teamMoney, isUpgrading, onUpgrade, onClose,
}: {
    facilityKey: OfficeFacilityKey;
    level: number;
    teamMoney: number;
    isUpgrading: boolean;
    onUpgrade: () => void;
    onClose: () => void;
}) {
    const def = OFFICE_FACILITY_DEFS[facilityKey];
    const Icon = def.icon;
    const c = def.accent;
    const isMax = level >= OFFICE_MAX_LEVEL;
    const nextLevel = isMax ? null : level + 1;
    const nextCost = nextLevel ? (OFFICE_UPGRADE_COST_TO_LEVEL[nextLevel] ?? null) : null;
    const canAfford = nextCost !== null && teamMoney >= nextCost;

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);
    if (!mounted) return null;

    return createPortal((
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in"
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
            onClick={onClose}
        >
            <div
                onClick={e => e.stopPropagation()}
                className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-[18px] surface-raised animate-fade-up"
                style={{
                    border: `1px solid ${c}40`,
                    boxShadow: `0 24px 80px -20px ${c}55, 0 1px 0 rgba(255,255,255,0.06) inset`,
                }}
            >
                <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: c }} />

                {/* Hero strip — stylized blueprint background */}
                <div className="relative h-[160px] border-b border-white/8 overflow-hidden">
                    <OfficeBlueprint def={def} level={level} />
                    <button
                        onClick={onClose}
                        className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center bg-[var(--ink-950)]/85 backdrop-blur-sm border border-white/10 text-[var(--ink-300)] hover:text-[var(--bone)] hover:border-white/30 transition z-10"
                        aria-label="Close"
                    >
                        <X size={15} />
                    </button>
                    <div className="absolute top-3 left-3 flex items-center gap-3 z-10">
                        <div className="w-12 h-12 rounded-md flex items-center justify-center border backdrop-blur-sm" style={{ background: `${c}18`, borderColor: `${c}55` }}>
                            <Icon size={24} style={{ color: c }} />
                        </div>
                        <div>
                            <div className="font-mono text-[8.5px] tracking-[0.32em] uppercase" style={{ color: c }}>Office · {def.short}</div>
                            <h2 className="font-display text-3xl leading-none tracking-wide uppercase text-[var(--bone)] mt-1">{def.name}</h2>
                        </div>
                    </div>
                    <div className="absolute bottom-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-sm bg-[var(--ink-950)]/90 border z-10" style={{ borderColor: `${c}55` }}>
                        <span className="font-mono text-[10px] tracking-[0.22em] uppercase" style={{ color: c }}>Lv</span>
                        <span className="font-display text-2xl tabular leading-none" style={{ color: c }}>{level}</span>
                        <span className="font-mono text-[10px] text-[var(--ink-500)]">/{OFFICE_MAX_LEVEL}</span>
                        <span className="w-1 h-1 rounded-full mx-1" style={{ background: c }} />
                        <span className="font-mono text-[11px] tabular text-[var(--bone)]">{OFFICE_LEVEL_MULTIPLIER[level].toFixed(2)}×</span>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    <p className="text-sm text-[var(--ink-300)] leading-relaxed">{def.description}</p>

                    {/* Effects breakdown — current vs next-level */}
                    <section>
                        <div className="eyebrow mb-2">Monthly Impact</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {def.effects.map(eff => {
                                const base = BASE_LINES[eff.line];
                                const isIncome = eff.line.startsWith('income_');
                                const curMult = 1 + eff.perLevel * level;
                                const nextMult = 1 + eff.perLevel * (level + 1);
                                const curDelta = Math.round(base * (curMult - 1));
                                const nextDelta = Math.round(base * (nextMult - 1));
                                const isBenefit = isIncome ? eff.perLevel > 0 : eff.perLevel < 0;
                                const toneCls = isBenefit ? 'text-[var(--win)]' : 'text-[var(--loss)]';
                                return (
                                    <div
                                        key={eff.line}
                                        className="rounded-sm border bg-white/[0.02] px-3 py-2.5"
                                        style={{ borderColor: `${c}25` }}
                                    >
                                        <div className="flex items-baseline justify-between mb-1.5">
                                            <span className="font-mono text-[10px] tracking-[0.2em] uppercase" style={{ color: c }}>
                                                {LINE_LABEL[eff.line]}
                                            </span>
                                            <span className="font-mono text-[10px] tabular text-[var(--ink-500)]">
                                                {eff.perLevel >= 0 ? '+' : ''}{Math.round(eff.perLevel * 100)}% / lv
                                            </span>
                                        </div>
                                        <div className="flex items-baseline justify-between">
                                            <span className="font-mono text-[10px] uppercase text-[var(--ink-400)]">Current</span>
                                            <span className={`font-mono text-sm tabular ${level === 0 ? 'text-[var(--ink-500)]' : toneCls}`}>
                                                {curDelta === 0 ? '—' : `${curDelta > 0 ? '+' : ''}${formatMoney(Math.abs(curDelta)).replace('$', '')}${curDelta > 0 ? '' : ''}`}
                                            </span>
                                        </div>
                                        {!isMax && (
                                            <div className="flex items-baseline justify-between mt-0.5">
                                                <span className="font-mono text-[10px] uppercase text-[var(--ink-500)]">Next L{level + 1}</span>
                                                <span className={`font-mono text-sm tabular ${toneCls}`}>
                                                    {nextDelta > 0 ? '+' : ''}{formatMoney(Math.abs(nextDelta)).replace('$', '')}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <p className="mt-2 text-[10px] font-mono uppercase tracking-[0.22em] text-[var(--ink-500)]">
                            Deltas shown vs base monthly figures. Effects stack additively across office facilities.
                        </p>
                    </section>

                    {/* Upgrade ladder */}
                    <section>
                        <div className="eyebrow mb-2">Upgrade Ladder</div>
                        <div className="grid grid-cols-6 gap-2">
                            {OFFICE_LEVEL_MULTIPLIER.map((m, i) => {
                                const isCurrent = i === level;
                                const isNext = i === level + 1;
                                const isPast = i < level;
                                return (
                                    <div
                                        key={i}
                                        className="rounded-sm border px-2 py-2 text-center transition-colors"
                                        style={{
                                            borderColor: isCurrent ? c : isNext ? `${c}80` : 'rgba(255,255,255,0.08)',
                                            background: isPast ? `${c}18` : isCurrent ? `${c}28` : isNext ? `${c}10` : 'transparent',
                                        }}
                                    >
                                        <div className="font-mono text-[8.5px] tracking-[0.22em] uppercase" style={{ color: isCurrent ? c : 'var(--ink-500)' }}>L{i}</div>
                                        <div className="font-display text-[15px] tabular mt-0.5" style={{ color: isPast || isCurrent ? c : 'var(--bone)' }}>
                                            {m.toFixed(2)}×
                                        </div>
                                        <div className="font-mono text-[9px] tabular mt-0.5 text-[var(--ink-500)]">
                                            {i === 0 ? '—' : `$${(OFFICE_UPGRADE_COST_TO_LEVEL[i] / 1_000_000).toFixed(i >= 4 ? 0 : 1)}M`}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {/* CTA */}
                    <section className="flex items-center gap-3 pt-4 border-t border-white/8">
                        <div className="flex-1">
                            <div className="font-mono text-[9px] tracking-[0.24em] uppercase text-[var(--ink-500)]">Treasury</div>
                            <div className="font-mono text-base tabular text-[var(--money)]">${teamMoney.toLocaleString()}</div>
                        </div>
                        {isMax ? (
                            <div className="flex items-center justify-center gap-2 px-5 py-3 rounded-sm border" style={{ borderColor: `${c}55`, background: `${c}10` }}>
                                <Lock size={14} style={{ color: c }} />
                                <span className="font-display text-sm tracking-[0.22em] uppercase" style={{ color: c }}>Max Tier</span>
                            </div>
                        ) : (
                            <button
                                onClick={onUpgrade}
                                disabled={!canAfford || isUpgrading}
                                className={`px-5 py-3 rounded-sm font-display text-sm tracking-[0.18em] uppercase flex items-center gap-3 transition-all
                                    ${canAfford && !isUpgrading
                                        ? 'bg-[var(--volt)] text-[var(--ink-950)] hover:bg-[var(--volt-bright)] shadow-[0_3px_0_0_var(--volt-deep)] hover:translate-y-[-1px]'
                                        : 'bg-white/5 text-[var(--ink-500)] cursor-not-allowed border border-white/8'}`}
                            >
                                <span>{isUpgrading ? 'Building…' : `Upgrade → L${nextLevel} · ${OFFICE_LEVEL_MULTIPLIER[nextLevel ?? level].toFixed(2)}×`}</span>
                                <span className="font-mono tabular text-[12px] px-2 py-0.5 rounded bg-black/15">${(nextCost ?? 0).toLocaleString()}</span>
                            </button>
                        )}
                    </section>
                </div>
            </div>
        </div>
    ), document.body);
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
    const [patience] = useState(MAX_PATIENCE);
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
                <div className="relative px-6 pt-6 pb-5 border-b border-white/10"
                    style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.07) 0%, rgba(249,115,22,0.04) 100%)' }}>

                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-150 cursor-pointer"
                        aria-label="Close"
                    >
                        <X size={14} />
                    </button>

                    <p className="font-mono text-[10px] font-bold text-[var(--volt)] uppercase tracking-[0.28em] mb-3">Contract Negotiation</p>

                    <div className="flex items-center gap-4">
                        <div className="relative shrink-0">
                            <PlayerAvatar playerId={player.id} size={64} />
                            <div className={`absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-lg border border-black/40 flex items-center justify-center text-[11px] font-black ${overallColor} bg-gray-900`}>
                                {player.overall}
                            </div>
                        </div>

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

                        <div className="shrink-0 text-right">
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1.5">Patience</p>
                            <PatienceDots patience={patience} />
                        </div>
                    </div>
                </div>

                <div className="px-6 py-5 space-y-5">
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

                    <div className="grid grid-cols-1 gap-4">
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
                        <button
                            onClick={handleSign}
                            disabled={signing || !canAffordBonus}
                            className={`btn-volt w-full flex items-center justify-center gap-2 ${(!canAffordBonus || signing) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <FileSignature size={15} />
                            {signing ? 'Processing…' : 'Sign Contract'}
                        </button>
                    ) : (
                        <div className="w-full py-3.5 rounded bg-[var(--win)]/15 border border-[var(--win)]/30 flex items-center justify-center gap-2 text-[var(--win)] font-display tracking-[0.1em] uppercase">
                            <CheckCircle size={16} />
                            Contract Signed
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
    const [activeTab, setActiveTab] = useState<TabType>('office');
    const [players, setPlayers] = useState<Player[]>([]);
    const [teamMoney, setTeamMoney] = useState<number | null>(null);
    const [sortBy, setSortBy] = useState<SortKey>('monthly_wage');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [negotiating, setNegotiating] = useState<Player | null>(null);
    const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
    const [cashFlowExpanded, setCashFlowExpanded] = useState(true);
    const [officeFacilities, setOfficeFacilities] = useState<OfficeFacility[]>([]);
    const [selectedFacilityKey, setSelectedFacilityKey] = useState<OfficeFacilityKey | null>(null);
    const [upgradingType, setUpgradingType] = useState<string | null>(null);

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
        fetch('/api/office/facility')
            .then(async r => {
                const text = await r.text();
                if (!text) return null;
                try { return JSON.parse(text); } catch { return null; }
            })
            .then((data) => {
                if (!data) return;
                if (data.facilities) setOfficeFacilities(data.facilities);
                if (data.teamMoney !== undefined) setTeamMoney(data.teamMoney);
            });
    }, [team]);

    useEffect(() => { fetchData(); }, [fetchData]);

    async function handleSigned(playerId: number, years: number, wage: number, bonus: number) {
        setNegotiating(null);

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
                }).then(() => setTeamMoney(nextMoney))
                : Promise.resolve(),
        ]);

        fetchData();
    }

    async function handleUpgradeFacility(facilityType: OfficeFacilityKey) {
        setUpgradingType(facilityType);
        try {
            const res = await fetch('/api/office/facility', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ facilityType }),
            });
            if (res.ok) {
                const facRes = await fetch('/api/office/facility');
                if (facRes.ok) {
                    const fac = await facRes.json();
                    setOfficeFacilities(fac.facilities);
                    setTeamMoney(fac.teamMoney);
                }
            }
        } finally {
            setUpgradingType(null);
        }
    }

    // Facility level lookup map
    const facilityLevelsByType = useMemo(() => {
        const m: Record<string, number> = {};
        for (const f of officeFacilities) m[f.facility_type] = f.level;
        return m;
    }, [officeFacilities]);

    // Live multipliers — used to preview totals in the Financial tab.
    const economyMultipliers = useMemo(
        () => computeEconomyMultipliers(facilityLevelsByType as Partial<Record<OfficeFacilityKey, number>>),
        [facilityLevelsByType],
    );

    const projectedIncome = useMemo(() => ({
        matchday: Math.round(BASE_LINES.income_matchday * economyMultipliers.income_matchday),
        sponsorship: Math.round(BASE_LINES.income_sponsorship * economyMultipliers.income_sponsorship),
        merchandise: Math.round(BASE_LINES.income_merchandise * economyMultipliers.income_merchandise),
        broadcast: Math.round(BASE_LINES.income_broadcast * economyMultipliers.income_broadcast),
    }), [economyMultipliers]);

    const totalProjectedIncome = projectedIncome.matchday + projectedIncome.sponsorship + projectedIncome.merchandise + projectedIncome.broadcast;

    const totalWages = useMemo(
        () => players.reduce((sum, p) => sum + (p.monthly_wage ?? 0), 0),
        [players]
    );
    const projectedStaff = Math.round(BASE_LINES.expense_staff * economyMultipliers.expense_staff);
    const projectedExpenses = totalWages + projectedStaff;
    const netCashflow = totalProjectedIncome - projectedExpenses;

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

    const avgFacilityLevel = useMemo(() => {
        if (officeFacilities.length === 0) return '0.0';
        const avg = officeFacilities.reduce((s, f) => s + f.level, 0) / officeFacilities.length;
        return avg.toFixed(1);
    }, [officeFacilities]);

    return (
        <div className="space-y-6 animate-fade-up">
            {/* Header */}
            <header className="relative pb-5 border-b border-white/[0.06]">
                <div className="absolute -top-2 left-0 h-[3px] w-16 bg-[var(--volt)]" />
                <div className="flex flex-col md:flex-row md:items-end gap-4 md:gap-6">
                    <div className="flex-1">
                        <p className="eyebrow mb-2">Office · Boardroom</p>
                        <h1 className="font-display text-5xl md:text-7xl tracking-[0.02em] text-[var(--bone)] leading-[0.85] uppercase">
                            Club <span className="text-[var(--volt)]">/</span> Office
                        </h1>
                        <p className="font-mono text-xs text-[var(--ink-400)] mt-3 tracking-wider">
                            {(team?.name || 'YOUR CLUB').toUpperCase()} {'//'} FINANCIAL & FACILITIES MANAGEMENT
                        </p>
                    </div>

                    {/* Treasury / projected income tiles */}
                    <div className="grid grid-cols-3 gap-2 md:gap-3 shrink-0">
                        <div className="surface-raised px-3 py-2 text-center min-w-[88px]">
                            <div className="font-mono text-[8.5px] tracking-[0.22em] uppercase text-[var(--ink-500)]">Treasury</div>
                            <div className="font-display text-xl tabular text-[var(--money)] leading-tight">
                                {teamMoney !== null ? formatMoney(teamMoney) : '—'}
                            </div>
                        </div>
                        <div className="surface-raised px-3 py-2 text-center min-w-[88px]">
                            <div className="font-mono text-[8.5px] tracking-[0.22em] uppercase text-[var(--ink-500)]">Income / mo</div>
                            <div className="font-display text-xl tabular text-[var(--win)] leading-tight">
                                {formatMoney(totalProjectedIncome)}
                            </div>
                        </div>
                        <div className="surface-raised px-3 py-2 text-center min-w-[88px]">
                            <div className="font-mono text-[8.5px] tracking-[0.22em] uppercase text-[var(--ink-500)]">Avg. Lv.</div>
                            <div className="font-display text-xl tabular text-[var(--volt)] leading-tight">
                                {avgFacilityLevel}
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Tabs */}
            <nav className="flex flex-wrap gap-1 border-b border-white/8">
                {([
                    { id: 'office', label: 'Office', count: officeFacilities.length, Icon: Building2 },
                    { id: 'financial', label: 'Financial', count: transactions.length, Icon: DollarSign },
                    { id: 'staff', label: 'Staff', count: 0, Icon: Users },
                ] as const).map(({ id, label, count, Icon }) => {
                    const active = activeTab === id;
                    return (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            className={`group relative flex items-center gap-2 px-4 py-3 font-display text-base tracking-[0.12em] uppercase transition-colors
                                ${active ? 'text-[var(--bone)]' : 'text-[var(--ink-400)] hover:text-[var(--ink-200)]'}`}
                        >
                            <Icon size={16} className={active ? 'text-[var(--volt)]' : 'text-[var(--ink-500)]'} />
                            <span>{label}</span>
                            <span className={`font-mono text-[10px] tabular px-1.5 py-0.5 rounded ${active ? 'bg-[var(--volt)] text-[var(--ink-950)]' : 'bg-white/5 text-[var(--ink-400)]'}`}>
                                {count}
                            </span>
                            {active && (
                                <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-[var(--volt)]" />
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* ───── OFFICE TAB ──────────────────────────────────────── */}
            {activeTab === 'office' && (
                <section className="space-y-5">
                    <div className="flex items-baseline justify-between">
                        <div>
                            <div className="eyebrow mb-1">Compound</div>
                            <h2 className="font-display text-3xl tracking-wide uppercase text-[var(--bone)]">
                                {OFFICE_FACILITY_ORDER.length} Buildings
                            </h2>
                        </div>
                        <div className="text-right font-mono text-[10px] tracking-[0.24em] uppercase text-[var(--ink-500)]">
                            Click a card to upgrade · Each level shifts a monthly line
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {OFFICE_FACILITY_ORDER.map((key, idx) => {
                            const fac = officeFacilities.find(f => f.facility_type === key);
                            const level = fac?.level ?? 0;
                            return (
                                <OfficeFacilityCard
                                    key={key}
                                    facilityKey={key}
                                    level={level}
                                    idx={idx}
                                    onClick={() => setSelectedFacilityKey(key)}
                                />
                            );
                        })}
                    </div>

                    {/* Live revenue preview from current facility levels */}
                    <div className="surface-raised p-5">
                        <div className="flex items-baseline justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Receipt size={16} className="text-amber-400" />
                                <h3 className="font-display text-lg tracking-[0.05em] text-[var(--bone)]">PROJECTED MONTHLY LINES</h3>
                            </div>
                            <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-[var(--ink-500)]">
                                Applied next 1st of the month
                            </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {([
                                { line: 'income_matchday' as const, label: 'Matchday', base: BASE_LINES.income_matchday, color: 'text-amber-400' },
                                { line: 'income_sponsorship' as const, label: 'Sponsorship', base: BASE_LINES.income_sponsorship, color: 'text-violet-400' },
                                { line: 'income_merchandise' as const, label: 'Merchandise', base: BASE_LINES.income_merchandise, color: 'text-emerald-400' },
                                { line: 'income_broadcast' as const, label: 'Broadcast', base: BASE_LINES.income_broadcast, color: 'text-cyan-400' },
                            ]).map(({ line, label, base, color }) => {
                                const mult = economyMultipliers[line];
                                const projected = Math.round(base * mult);
                                const delta = projected - base;
                                return (
                                    <div key={line} className="surface p-3 border border-white/5">
                                        <div className={`font-mono text-[10px] tracking-[0.22em] uppercase ${color}`}>{label}</div>
                                        <div className="font-display text-xl tabular text-[var(--bone)] mt-1">{formatMoney(projected)}</div>
                                        <div className="flex items-center justify-between mt-1">
                                            <span className="font-mono text-[9px] text-[var(--ink-500)] uppercase">Base {formatMoney(base)}</span>
                                            <span className={`font-mono text-[10px] tabular ${delta > 0 ? 'text-[var(--win)]' : delta < 0 ? 'text-[var(--loss)]' : 'text-[var(--ink-500)]'}`}>
                                                {delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${formatMoney(Math.abs(delta)).replace('$', '$')}`}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>
            )}

            {/* ───── FACILITY MODAL ──────────────────────────────────── */}
            {selectedFacilityKey && (
                <OfficeFacilityDetailModal
                    facilityKey={selectedFacilityKey}
                    level={facilityLevelsByType[selectedFacilityKey] ?? 0}
                    teamMoney={teamMoney ?? 0}
                    isUpgrading={upgradingType === selectedFacilityKey}
                    onUpgrade={() => handleUpgradeFacility(selectedFacilityKey)}
                    onClose={() => setSelectedFacilityKey(null)}
                />
            )}

            {/* ───── FINANCIAL TAB ───────────────────────────────────── */}
            {activeTab === 'financial' && (
                <section className="space-y-6">
                    {/* KPI Row */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        <StatCard label="Club Funds" value={teamMoney !== null ? formatMoney(teamMoney) : '—'} sub="Available budget" icon={DollarSign} color="bg-[var(--volt)]/15 text-[var(--volt)]" trend="neutral" />
                        <StatCard label="Monthly Income" value={formatMoney(totalProjectedIncome)} sub="Matchday + sponsorship + more" icon={TrendingUp} color="bg-[var(--win)]/15 text-[var(--win)]" trend="up" />
                        <StatCard label="Monthly Wages" value={formatMoney(totalWages)} sub={`${players.length} players on payroll`} icon={Users} color="bg-[var(--loss)]/15 text-[var(--loss)]" trend="down" />
                        <StatCard
                            label="Net Cash Flow"
                            value={formatMoney(Math.abs(netCashflow))}
                            sub={netCashflow >= 0 ? 'Monthly surplus' : 'Monthly deficit'}
                            icon={netCashflow >= 0 ? TrendingUp : TrendingDown}
                            color={netCashflow >= 0 ? 'bg-[var(--win)]/15 text-[var(--win)]' : 'bg-[var(--loss)]/15 text-[var(--loss)]'}
                            trend={netCashflow >= 0 ? 'up' : 'down'}
                        />
                    </div>

                    {/* Middle Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="surface-raised p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <BarChart3 size={16} className="text-amber-400" />
                                <h2 className="font-display text-lg tracking-[0.05em] text-[var(--bone)]">WAGE BY POSITION</h2>
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

                        <div className="surface-raised p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Calendar size={16} className="text-cyan-400" />
                                <h2 className="font-display text-lg tracking-[0.05em] text-[var(--bone)]">CONTRACT EXPIRY RISK</h2>
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

                        <div className="surface-raised p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Zap size={16} className="text-violet-400" />
                                <h2 className="font-display text-lg tracking-[0.05em] text-[var(--bone)]">REVENUE STREAMS</h2>
                            </div>
                            <div className="space-y-2.5">
                                {[
                                    { label: 'Matchday Revenue', amount: projectedIncome.matchday, icon: Trophy, color: 'text-amber-400' },
                                    { label: 'Shirt Sponsorship', amount: projectedIncome.sponsorship, icon: Star, color: 'text-violet-400' },
                                    { label: 'Merchandise Sales', amount: projectedIncome.merchandise, icon: ShoppingIcon, color: 'text-cyan-400' },
                                    { label: 'Broadcast Rights', amount: projectedIncome.broadcast, icon: Wifi, color: 'text-emerald-400' },
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

                    {/* Cash Flow History */}
                    <div className="surface-raised overflow-hidden">
                        <div
                            className="px-5 py-4 border-b border-white/10 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors group"
                            onClick={() => setCashFlowExpanded(!cashFlowExpanded)}
                        >
                            <div className="flex items-center gap-2">
                                <Receipt size={16} className="text-amber-400" />
                                <h2 className="font-display text-lg tracking-[0.05em] text-[var(--bone)]">YEARLY CASH FLOW</h2>
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
                                        <div className="grid grid-cols-[1fr_100px_100px_100px] gap-4 px-5 py-2.5 text-[10px] text-gray-600 uppercase tracking-widest font-semibold bg-white/[0.02]">
                                            <span>Year</span>
                                            <span className="text-right">Income</span>
                                            <span className="text-right">Expenses</span>
                                            <span className="text-right">Net</span>
                                        </div>
                                        {aggregateByYear(transactions).map(yearRow => (
                                            <div
                                                key={yearRow.year}
                                                className="grid grid-cols-[1fr_100px_100px_100px] gap-4 px-5 py-4 items-center hover:bg-white/[0.03] transition-colors"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <span className="font-display text-base tracking-wide text-white">{yearRow.year}</span>
                                                    <span className="font-mono text-[10px] text-gray-600 uppercase tracking-wider">{yearRow.months.length} mo</span>
                                                </div>
                                                <span className="text-sm text-emerald-400 font-semibold text-right">{formatMoney(yearRow.totalIncome)}</span>
                                                <span className="text-sm text-red-400 font-semibold text-right">-{formatMoney(yearRow.totalExpenses)}</span>
                                                <span className={`text-sm font-black text-right ${yearRow.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {yearRow.net >= 0 ? '+' : ''}{formatMoney(yearRow.net)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Player Contracts Table */}
                    <div className="surface-raised overflow-hidden">
                        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                            <div>
                                <h2 className="font-display text-lg tracking-[0.05em] text-[var(--bone)]">PLAYER CONTRACTS & WAGES</h2>
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
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <PlayerAvatar playerId={player.id} size={40} />
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

                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1.5">
                                                        <Calendar size={12} className={contractColor} />
                                                        <span className={`text-sm font-semibold ${contractColor}`}>
                                                            {player.contract_years} yr{player.contract_years !== 1 ? 's' : ''}
                                                        </span>
                                                    </div>
                                                </td>

                                                <td className="px-4 py-3">
                                                    <span className="text-white font-semibold">{formatMoney(player.monthly_wage)}</span>
                                                </td>

                                                <td className="px-4 py-3">
                                                    <span className="text-amber-400 font-semibold">{formatMoney(player.player_value)}</span>
                                                </td>

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
                </section>
            )}

            {/* ───── STAFF TAB (placeholder) ─────────────────────────── */}
            {activeTab === 'staff' && (
                <section className="space-y-5">
                    <div className="surface flex flex-col items-center text-center py-20 px-6 gap-4">
                        <div className="w-14 h-14 rounded-full flex items-center justify-center border border-[var(--volt)]/30 bg-[var(--volt)]/8">
                            <Wrench size={22} className="text-[var(--volt)]" />
                        </div>
                        <div className="eyebrow">Coming Soon</div>
                        <h2 className="font-display text-3xl tracking-wide uppercase text-[var(--bone)]">Staff Management</h2>
                        <p className="text-sm text-[var(--ink-400)] max-w-md">
                            Hire scouts, physios, analysts and assistant coaches. Manage non-coaching backroom staff
                            whose performance feeds into recruitment, recovery and tactical prep.
                        </p>
                    </div>
                </section>
            )}

            {/* Contract Negotiation Modal */}
            {negotiating && teamMoney !== null && (
                <ContractNegotiationModal
                    player={negotiating}
                    teamMoney={teamMoney}
                    onClose={() => setNegotiating(null)}
                    onSigned={handleSigned}
                />
            )}
        </div>
    );
}

// Inline SVG for merchandise icon — matches the legacy revenue-streams card style
function ShoppingIcon({ size = 13, className = '' }: { size?: number; className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
            <circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" />
            <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
        </svg>
    );
}
