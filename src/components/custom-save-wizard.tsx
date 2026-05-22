'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useAuth } from '@/contexts/auth-context';
import {
    Loader2, X, ChevronLeft, ChevronRight, Plus, Trash2, Sparkles,
    AlertCircle, Check, Globe, Flag, Trophy, ArrowUpDown, CalendarDays, Users, Shield,
} from 'lucide-react';
import {
    validateCustomWorldConfig, scheduleSummary, planCupRounds,
    ALLOWED_ROUNDS, ALLOWED_TOPN, ALLOWED_SERIES, ALLOWED_CUP_SIZES,
    MAX_PYRAMIDS, MAX_SAVE_NAME, MAX_CUPS, MAX_TEAM_NAME, TEAM_BADGE_COUNT,
    type CustomWorldConfig, type CustomPyramidConfig, type CustomCupConfig, type CustomTeamDef,
} from '@/lib/custom-save';

// ─── Types ──────────────────────────────────────────────────────────────────

interface CatalogTeam {
    id: number; team_name: string; country: string;
    league_id: number; avg_overall: number; player_count: number;
}
interface CatalogLeague {
    id: number; league_name: string; country: string;
    continent: string; tier: number; teams: CatalogTeam[];
}
type PyramidDraft = CustomPyramidConfig & { uid: string };
type CupDraft = CustomCupConfig & { uid: string };

const MONTHS_SHORT = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function lastDayOfMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
}

// ─── Styling helpers ────────────────────────────────────────────────────────

const inputClass = "w-full px-3 py-2 bg-[var(--ink-850)] border border-white/10 rounded text-sm text-[var(--bone)] placeholder-[var(--ink-500)] focus:outline-none focus:border-[var(--volt)]/60 focus:ring-2 focus:ring-[var(--volt)]/15 transition-all font-body";
const labelClass = "block font-mono text-[9px] uppercase tracking-[0.24em] text-[var(--ink-400)] mb-1.5";
const STEPS = ['Save', 'Leagues', 'Teams', 'Cups', 'Review'];

function newCup(index: number): CupDraft {
    const slots: [number, number][] = [[7, 8], [9, 10], [11, 12]];
    const [sm, em] = slots[index % slots.length];
    return {
        uid: crypto.randomUUID(),
        name: '',
        teamIds: [],
        window: { startMonth: sm, startDay: 1, endMonth: em, endDay: lastDayOfMonth(2026, em) },
    };
}

function newPyramid(): PyramidDraft {
    return {
        uid: crypto.randomUUID(),
        name: '', kind: 'domestic', country: '',
        rounds: 2, promotionCount: 2,
        playoffEnabled: true, playoffTopN: 8, seriesLength: 5,
        tier1Name: '', tier2Name: '',
        tier1TeamIds: [], tier2TeamIds: [],
        teamNames: {},
        customTeams: [],
    };
}

/** A random club-badge key (1 … TEAM_BADGE_COUNT). */
function randomBadge(): string {
    return String(1 + Math.floor(Math.random() * TEAM_BADGE_COUNT));
}

/** A small club-badge thumbnail with a graceful fallback to the default crest. */
function BadgeThumb({ badge, size = 26 }: { badge: string | number; size?: number }) {
    const [failed, setFailed] = useState(false);
    return (
        <div className="relative shrink-0 rounded bg-white/[0.05] border border-white/[0.06]"
            style={{ width: size, height: size }}>
            <Image
                src={failed ? '/assets/teams/default.png' : `/assets/teams/${badge}.png`}
                alt="" fill unoptimized className="object-contain p-0.5"
                onError={() => setFailed(true)}
            />
        </div>
    );
}

/** A scrollable grid of every selectable club badge in the teams asset folder. */
function BadgeGrid({ value, onPick }: { value: string; onPick: (v: string) => void }) {
    return (
        <div className="grid grid-cols-8 gap-1.5 max-h-40 overflow-y-auto p-1.5 rounded border border-white/[0.06] bg-[var(--ink-900)]">
            {Array.from({ length: TEAM_BADGE_COUNT }, (_, i) => String(i + 1)).map(b => (
                <button
                    key={b} type="button" onClick={() => onPick(b)}
                    title={`Badge ${b}`}
                    className={`relative aspect-square rounded border transition-all cursor-pointer ${
                        value === b
                            ? 'border-[var(--volt)] bg-[var(--volt)]/15'
                            : 'border-white/[0.06] bg-white/[0.02] hover:border-white/25'}`}
                >
                    <Image src={`/assets/teams/${b}.png`} alt={`Badge ${b}`} fill unoptimized
                        className="object-contain p-1" />
                </button>
            ))}
        </div>
    );
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function CustomSaveWizard({ onClose }: { onClose: () => void }) {
    const { createCustomSave, selectSave } = useAuth();

    const [step, setStep] = useState(0);
    const [saveName, setSaveName] = useState('');
    const [pyramids, setPyramids] = useState<PyramidDraft[]>(() => [newPyramid()]);
    const [cups, setCups] = useState<CupDraft[]>([]);
    const [draftEnabled, setDraftEnabled] = useState(true);
    const [draftPool, setDraftPool] = useState<'existing' | 'generated' | 'mixed'>('existing');
    const [catalog, setCatalog] = useState<CatalogLeague[]>([]);
    const [catalogLoading, setCatalogLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch('/api/catalog')
            .then(r => r.json())
            .then(d => setCatalog(d.leagues ?? []))
            .catch(() => setCatalog([]))
            .finally(() => setCatalogLoading(false));
    }, []);

    // teamId -> CatalogTeam, and teamId -> source league name
    const teamIndex = useMemo(() => {
        const m = new Map<number, CatalogTeam & { leagueName: string }>();
        for (const lg of catalog) for (const t of lg.teams) m.set(t.id, { ...t, leagueName: lg.league_name });
        return m;
    }, [catalog]);

    // Negative synthetic id -> from-scratch custom team, across every pyramid.
    const customTeamIndex = useMemo(() => {
        const m = new Map<number, CustomTeamDef>();
        for (const p of pyramids) for (const ct of p.customTeams) m.set(ct.id, ct);
        return m;
    }, [pyramids]);

    // Hands out unique negative ids for from-scratch teams (-1, -2, -3, …).
    const customIdRef = useRef(-1);
    const nextCustomId = useCallback(() => customIdRef.current--, []);

    const countries = useMemo(
        () => [...new Set(catalog.map(l => l.country))].filter(Boolean).sort(),
        [catalog],
    );

    // Every team id already placed anywhere — a team can only be used once.
    const usedTeamIds = useMemo(() => {
        const s = new Set<number>();
        for (const p of pyramids) { for (const id of p.tier1TeamIds) s.add(id); for (const id of p.tier2TeamIds) s.add(id); }
        return s;
    }, [pyramids]);

    const updatePyramid = useCallback((uid: string, fn: (p: PyramidDraft) => PyramidDraft) => {
        setPyramids(prev => prev.map(p => (p.uid === uid ? fn(p) : p)));
    }, []);

    const updateCup = useCallback((uid: string, fn: (c: CupDraft) => CupDraft) => {
        setCups(prev => prev.map(c => (c.uid === uid ? fn(c) : c)));
    }, []);

    // Teams placed in leagues form the pool a cup can draw from.
    const leagueTeamIds = useMemo(() => Array.from(usedTeamIds), [usedTeamIds]);

    const config: CustomWorldConfig = useMemo(() => ({
        saveName: saveName.trim(),
        startYear: 2026,
        pyramids: pyramids.map((p): CustomPyramidConfig => ({
            name: p.name, kind: p.kind, country: p.country,
            rounds: p.rounds, promotionCount: p.promotionCount,
            playoffEnabled: p.playoffEnabled, playoffTopN: p.playoffTopN, seriesLength: p.seriesLength,
            tier1Name: p.tier1Name, tier2Name: p.tier2Name,
            tier1TeamIds: p.tier1TeamIds, tier2TeamIds: p.tier2TeamIds,
            teamNames: p.teamNames,
            customTeams: p.customTeams,
        })),
        cups: cups.map((c): CustomCupConfig => ({
            name: c.name, teamIds: c.teamIds, window: c.window,
        })),
        draft: { enabled: draftEnabled, pool: draftPool },
    }), [saveName, pyramids, cups, draftEnabled, draftPool]);

    const validationErrors = useMemo(() => validateCustomWorldConfig(config), [config]);

    const handleCreate = async () => {
        setCreating(true); setError('');
        const res = await createCustomSave(config);
        if (!res.success) { setError(res.error || 'Could not build the world'); setCreating(false); return; }
        // Jump straight into the new world (team selection screen).
        await selectSave(res.saveId!);
        // The app re-renders past the picker; no need to reset state.
    };

    const canNext =
        step === 0 ? saveName.trim().length > 0 :
        step === 1 ? pyramids.length > 0 :
        true;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
            <div className="w-full max-w-3xl surface-raised overflow-hidden animate-fade-up flex flex-col" style={{ maxHeight: '92vh' }}>

                {/* Header */}
                <div className="relative px-7 pt-6 pb-5 border-b border-white/[0.06] shrink-0">
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-[var(--epic)]" />
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="eyebrow mb-1 flex items-center gap-1.5">
                                <Sparkles size={11} className="text-[var(--epic)]" /> Custom Save
                            </p>
                            <h2 className="font-display text-2xl tracking-[0.04em] text-[var(--bone)]">CREATE YOUR WORLD</h2>
                        </div>
                        <button onClick={onClose} disabled={creating}
                            className="w-8 h-8 flex items-center justify-center rounded text-[var(--ink-500)] hover:text-[var(--bone)] hover:bg-white/[0.05] transition-all cursor-pointer disabled:opacity-40">
                            <X size={16} />
                        </button>
                    </div>

                    {/* Stepper */}
                    <div className="flex items-center gap-1.5 mt-4">
                        {STEPS.map((s, i) => (
                            <div key={s} className="flex items-center gap-1.5 flex-1">
                                <div className={`flex items-center gap-2 ${i === step ? 'opacity-100' : 'opacity-50'}`}>
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] font-bold shrink-0 ${
                                        i < step ? 'bg-[var(--epic)] text-white'
                                        : i === step ? 'bg-[var(--volt)] text-[var(--ink-950)]'
                                        : 'bg-white/[0.06] text-[var(--ink-400)]'}`}>
                                        {i < step ? <Check size={11} /> : i + 1}
                                    </span>
                                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink-300)] hidden sm:block">{s}</span>
                                </div>
                                {i < STEPS.length - 1 && <div className="flex-1 h-px bg-white/[0.08]" />}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-7 py-6">
                    {catalogLoading ? (
                        <div className="flex items-center justify-center gap-2 py-16 text-[var(--ink-500)] font-mono text-xs uppercase tracking-wider">
                            <Loader2 size={14} className="animate-spin" /> Loading the original teams
                        </div>
                    ) : (
                        <>
                            {step === 0 && (
                                <StepName
                                    saveName={saveName} setSaveName={setSaveName}
                                    draftEnabled={draftEnabled} setDraftEnabled={setDraftEnabled}
                                    draftPool={draftPool} setDraftPool={setDraftPool}
                                />
                            )}
                            {step === 1 && (
                                <StepLeagues
                                    pyramids={pyramids} setPyramids={setPyramids}
                                    updatePyramid={updatePyramid} countries={countries}
                                />
                            )}
                            {step === 2 && (
                                <StepTeams
                                    pyramids={pyramids} updatePyramid={updatePyramid}
                                    catalog={catalog} teamIndex={teamIndex} usedTeamIds={usedTeamIds}
                                    nextCustomId={nextCustomId}
                                />
                            )}
                            {step === 3 && (
                                <StepCups
                                    cups={cups} setCups={setCups} updateCup={updateCup}
                                    leagueTeamIds={leagueTeamIds} teamIndex={teamIndex}
                                    customTeamIndex={customTeamIndex}
                                />
                            )}
                            {step === 4 && (
                                <StepReview
                                    config={config} pyramids={pyramids} cups={cups}
                                    errors={validationErrors} teamIndex={teamIndex}
                                />
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-7 py-4 border-t border-white/[0.06] shrink-0 gap-3">
                    {error && (
                        <span className="flex items-center gap-1.5 text-[var(--loss)] text-xs font-medium min-w-0">
                            <AlertCircle size={13} className="shrink-0" /> <span className="truncate">{error}</span>
                        </span>
                    )}
                    <div className="flex items-center gap-2 ml-auto shrink-0">
                        <button
                            onClick={() => (step === 0 ? onClose() : setStep(s => s - 1))}
                            disabled={creating}
                            className="btn-ghost flex items-center gap-1.5 px-4 disabled:opacity-40"
                        >
                            <ChevronLeft size={14} /> {step === 0 ? 'Cancel' : 'Back'}
                        </button>
                        {step < STEPS.length - 1 ? (
                            <button
                                onClick={() => setStep(s => s + 1)}
                                disabled={!canNext || catalogLoading}
                                className="btn-volt flex items-center gap-1.5"
                            >
                                Next <ChevronRight size={14} />
                            </button>
                        ) : (
                            <button
                                onClick={handleCreate}
                                disabled={creating || validationErrors.length > 0}
                                className="btn-volt flex items-center gap-1.5"
                            >
                                {creating
                                    ? <><Loader2 size={14} className="animate-spin" /> Building world…</>
                                    : <><Sparkles size={14} /> Create World</>}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Step 1: Save name ──────────────────────────────────────────────────────

function StepName({ saveName, setSaveName, draftEnabled, setDraftEnabled, draftPool, setDraftPool }: {
    saveName: string;
    setSaveName: (v: string) => void;
    draftEnabled: boolean;
    setDraftEnabled: (v: boolean) => void;
    draftPool: 'existing' | 'generated' | 'mixed';
    setDraftPool: (v: 'existing' | 'generated' | 'mixed') => void;
}) {
    return (
        <div className="max-w-lg mx-auto py-4 space-y-6">
            <div className="text-center">
                <h3 className="font-display text-xl tracking-wide text-[var(--bone)]">NAME YOUR SAVE</h3>
                <p className="text-sm text-[var(--ink-400)] mt-2">
                    A custom save is its own independent world — separate from your Main Save and any other save.
                </p>
            </div>

            <div>
                <label className={labelClass}>Save Name</label>
                <input
                    type="text" value={saveName} maxLength={MAX_SAVE_NAME} autoFocus
                    onChange={e => setSaveName(e.target.value)}
                    className={inputClass} placeholder="e.g. Mediterranean League"
                />
            </div>

            <div>
                <label className={labelClass}>Rosters</label>
                <div className="grid grid-cols-2 gap-2">
                    {([[true, 'Fantasy Draft', 'Pool every player and snake-draft your squad'],
                       [false, 'Keep Rosters', 'Teams keep their real squads, no draft']] as const).map(([val, title, desc]) => (
                        <button key={String(val)} onClick={() => setDraftEnabled(val)}
                            className={`text-left p-3 rounded border transition-all cursor-pointer ${
                                draftEnabled === val
                                    ? 'border-[var(--epic)]/55 bg-[var(--epic)]/10'
                                    : 'border-white/10 hover:border-white/20'}`}>
                            <span className="flex items-center gap-1.5 font-display text-sm tracking-wide text-[var(--bone)]">
                                {val ? <Sparkles size={12} className="text-[var(--epic)]" /> : <Users size={12} />}
                                {title}
                            </span>
                            <span className="block text-[11px] text-[var(--ink-400)] mt-1">{desc}</span>
                        </button>
                    ))}
                </div>
            </div>

            {draftEnabled && (
                <div>
                    <label className={labelClass}>Draft Player Pool</label>
                    <div className="space-y-1.5">
                        {([['existing', 'Real players', 'Draft the real players from the leagues you picked'],
                           ['generated', 'New players', 'Draft a fresh pool of generated fictional players'],
                           ['mixed', 'Mixed', 'A blend of real players and generated newcomers']] as const).map(([val, title, desc]) => (
                            <button key={val} onClick={() => setDraftPool(val)}
                                className={`w-full flex items-center gap-3 p-2.5 rounded border text-left transition-all cursor-pointer ${
                                    draftPool === val
                                        ? 'border-[var(--volt)]/50 bg-[var(--volt)]/10'
                                        : 'border-white/10 hover:border-white/20'}`}>
                                <span className={`w-4 h-4 rounded-full border-2 shrink-0 ${
                                    draftPool === val ? 'border-[var(--volt)] bg-[var(--volt)]' : 'border-white/25'}`} />
                                <span className="min-w-0">
                                    <span className="block text-sm font-semibold text-[var(--bone)]">{title}</span>
                                    <span className="block text-[11px] text-[var(--ink-400)]">{desc}</span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Step 2: Leagues ────────────────────────────────────────────────────────

function StepLeagues({ pyramids, setPyramids, updatePyramid, countries }: {
    pyramids: PyramidDraft[];
    setPyramids: React.Dispatch<React.SetStateAction<PyramidDraft[]>>;
    updatePyramid: (uid: string, fn: (p: PyramidDraft) => PyramidDraft) => void;
    countries: string[];
}) {
    return (
        <div className="space-y-4">
            <div>
                <h3 className="font-display text-xl tracking-wide text-[var(--bone)]">BUILD YOUR LEAGUES</h3>
                <p className="text-sm text-[var(--ink-400)] mt-1.5">
                    Every league is a <span className="text-[var(--volt)]">2-tier pyramid</span> — a top division and a feeder
                    division, with automatic promotion &amp; relegation between them.
                </p>
            </div>

            {pyramids.map((p, i) => (
                <PyramidCard
                    key={p.uid} pyramid={p} index={i} countries={countries}
                    onChange={fn => updatePyramid(p.uid, fn)}
                    onRemove={pyramids.length > 1 ? () => setPyramids(prev => prev.filter(x => x.uid !== p.uid)) : undefined}
                />
            ))}

            {pyramids.length < MAX_PYRAMIDS && (
                <button
                    onClick={() => setPyramids(prev => [...prev, newPyramid()])}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded border border-dashed border-white/15 text-[var(--ink-400)] hover:text-[var(--volt)] hover:border-[var(--volt)]/40 transition-all cursor-pointer font-mono text-xs uppercase tracking-[0.16em]"
                >
                    <Plus size={14} /> Add Another League
                </button>
            )}
        </div>
    );
}

function PyramidCard({ pyramid: p, index, countries, onChange, onRemove }: {
    pyramid: PyramidDraft;
    index: number;
    countries: string[];
    onChange: (fn: (p: PyramidDraft) => PyramidDraft) => void;
    onRemove?: () => void;
}) {
    const setName = (name: string) => onChange(prev => ({
        ...prev,
        name,
        tier1Name: prev.tier1Name || (name ? `${name} Division 1` : ''),
        tier2Name: prev.tier2Name || (name ? `${name} Division 2` : ''),
    }));

    return (
        <div className="rounded border border-white/[0.08] bg-white/[0.02] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--epic)] font-bold">
                    League {index + 1}
                </span>
                <span className="font-display text-sm tracking-wide text-[var(--bone)] truncate">
                    {p.name || 'Untitled'}
                </span>
                {onRemove && (
                    <button onClick={onRemove}
                        className="ml-auto w-7 h-7 flex items-center justify-center rounded text-[var(--ink-500)] hover:text-[var(--loss)] hover:bg-[var(--loss)]/10 transition-all cursor-pointer">
                        <Trash2 size={13} />
                    </button>
                )}
            </div>

            <div className="p-4 grid sm:grid-cols-2 gap-3">
                <div>
                    <label className={labelClass}>League Name</label>
                    <input type="text" value={p.name} maxLength={40}
                        onChange={e => setName(e.target.value)}
                        className={inputClass} placeholder="e.g. Adriatic" />
                </div>
                <div>
                    <label className={labelClass}>Type</label>
                    <div className="grid grid-cols-2 gap-1.5">
                        {([['domestic', Flag, 'Domestic'], ['international', Globe, 'International']] as const).map(([k, Icon, lbl]) => (
                            <button key={k}
                                onClick={() => onChange(prev => ({ ...prev, kind: k }))}
                                className={`flex items-center justify-center gap-1.5 py-2 rounded text-xs font-semibold transition-all cursor-pointer border ${
                                    p.kind === k
                                        ? 'border-[var(--volt)]/50 bg-[var(--volt)]/10 text-[var(--volt)]'
                                        : 'border-white/10 text-[var(--ink-400)] hover:text-[var(--bone)]'}`}>
                                <Icon size={12} /> {lbl}
                            </button>
                        ))}
                    </div>
                </div>

                {p.kind === 'domestic' ? (
                    <div>
                        <label className={labelClass}>Country</label>
                        <select value={p.country} onChange={e => onChange(prev => ({ ...prev, country: e.target.value }))}
                            className={inputClass}>
                            <option value="">Select a country…</option>
                            {countries.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                ) : (
                    <div>
                        <label className={labelClass}>Country</label>
                        <div className="flex items-center gap-2 px-3 py-2 rounded border border-white/10 bg-[var(--ink-850)] text-xs text-[var(--ink-400)]">
                            <Globe size={12} className="text-[var(--info)]" /> Teams from multiple countries
                        </div>
                    </div>
                )}
                <div>
                    <label className={labelClass}>Games per Season (round-robin ×)</label>
                    <select value={p.rounds} onChange={e => onChange(prev => ({ ...prev, rounds: Number(e.target.value) }))}
                        className={inputClass}>
                        {ALLOWED_ROUNDS.map(r => (
                            <option key={r} value={r}>
                                {r}× {r === 1 ? '(single)' : r === 2 ? '(home & away)' : r === 3 ? '(triple)' : '(quadruple)'}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="sm:col-span-2 grid sm:grid-cols-2 gap-3 pt-1 mt-1 border-t border-white/[0.05]">
                    <div>
                        <label className={labelClass}>Tier 1 — Top Division Name</label>
                        <input type="text" value={p.tier1Name} maxLength={40}
                            onChange={e => onChange(prev => ({ ...prev, tier1Name: e.target.value }))}
                            className={inputClass} placeholder="Top division" />
                    </div>
                    <div>
                        <label className={labelClass}>Tier 2 — Feeder Division Name</label>
                        <input type="text" value={p.tier2Name} maxLength={40}
                            onChange={e => onChange(prev => ({ ...prev, tier2Name: e.target.value }))}
                            className={inputClass} placeholder="Feeder division" />
                    </div>
                </div>

                <div>
                    <label className={labelClass}>
                        <ArrowUpDown size={9} className="inline mr-1" />Promotion / Relegation Count
                    </label>
                    <input type="number" min={1} max={12} value={p.promotionCount}
                        onChange={e => onChange(prev => ({ ...prev, promotionCount: Math.max(1, Number(e.target.value) || 1) }))}
                        className={inputClass} />
                    <p className="font-mono text-[9px] text-[var(--ink-500)] mt-1">
                        Bottom {p.promotionCount} of Tier 1 ↔ Top {p.promotionCount} of Tier 2
                    </p>
                </div>

                <div>
                    <label className={labelClass}>
                        <Trophy size={9} className="inline mr-1" />Tier 1 Playoffs
                    </label>
                    <label className="flex items-center gap-2 px-3 py-2 rounded border border-white/10 bg-[var(--ink-850)] cursor-pointer">
                        <input type="checkbox" checked={p.playoffEnabled}
                            onChange={e => onChange(prev => ({ ...prev, playoffEnabled: e.target.checked }))}
                            className="accent-[var(--volt)]" />
                        <span className="text-xs text-[var(--ink-300)]">Playoff bracket after the regular season</span>
                    </label>
                </div>

                {p.playoffEnabled && (
                    <>
                        <div>
                            <label className={labelClass}>Playoff Teams (top N)</label>
                            <select value={p.playoffTopN} onChange={e => onChange(prev => ({ ...prev, playoffTopN: Number(e.target.value) }))}
                                className={inputClass}>
                                {ALLOWED_TOPN.map(n => <option key={n} value={n}>Top {n}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Series Length (best of)</label>
                            <select value={p.seriesLength} onChange={e => onChange(prev => ({ ...prev, seriesLength: Number(e.target.value) }))}
                                className={inputClass}>
                                {ALLOWED_SERIES.map(n => <option key={n} value={n}>Best of {n}</option>)}
                            </select>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// ─── Step 3: Teams ──────────────────────────────────────────────────────────

function StepTeams({ pyramids, updatePyramid, catalog, teamIndex, usedTeamIds, nextCustomId }: {
    pyramids: PyramidDraft[];
    updatePyramid: (uid: string, fn: (p: PyramidDraft) => PyramidDraft) => void;
    catalog: CatalogLeague[];
    teamIndex: Map<number, CatalogTeam & { leagueName: string }>;
    usedTeamIds: Set<number>;
    nextCustomId: () => number;
}) {
    return (
        <div className="space-y-5">
            <div>
                <h3 className="font-display text-xl tracking-wide text-[var(--bone)]">PICK YOUR TEAMS</h3>
                <p className="text-sm text-[var(--ink-400)] mt-1.5">
                    Add teams from the original leagues, or <span className="text-[var(--epic)]">create your
                    own</span> from scratch with a club badge. Each division needs an even number of teams (4–24).
                </p>
            </div>
            {pyramids.map((p, i) => (
                <div key={p.uid} className="rounded border border-white/[0.08] bg-white/[0.02]">
                    <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center gap-2">
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--epic)] font-bold">League {i + 1}</span>
                        <span className="font-display text-sm tracking-wide text-[var(--bone)]">{p.name || 'Untitled'}</span>
                    </div>
                    <div className="p-4 space-y-4">
                        {([1, 2] as const).map(tier => (
                            <TierTeamPicker
                                key={tier} pyramid={p} tier={tier}
                                catalog={catalog} teamIndex={teamIndex} usedTeamIds={usedTeamIds}
                                nextCustomId={nextCustomId}
                                onChange={fn => updatePyramid(p.uid, fn)}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

function TierTeamPicker({ pyramid: p, tier, catalog, teamIndex, usedTeamIds, nextCustomId, onChange }: {
    pyramid: PyramidDraft;
    tier: 1 | 2;
    catalog: CatalogLeague[];
    teamIndex: Map<number, CatalogTeam & { leagueName: string }>;
    usedTeamIds: Set<number>;
    nextCustomId: () => number;
    onChange: (fn: (p: PyramidDraft) => PyramidDraft) => void;
}) {
    const [adding, setAdding] = useState(false);
    const [creating, setCreating] = useState(false);
    const [sourceLeagueId, setSourceLeagueId] = useState<number | ''>('');
    const [draftName, setDraftName] = useState('');
    const [draftLogo, setDraftLogo] = useState(() => randomBadge());
    const [badgeRowId, setBadgeRowId] = useState<number | null>(null);

    const key = tier === 1 ? 'tier1TeamIds' : 'tier2TeamIds';
    const ids = p[key];
    const tierName = tier === 1 ? p.tier1Name : p.tier2Name;
    const accent = tier === 1 ? 'var(--volt)' : 'var(--info)';
    const customById = useMemo(
        () => new Map(p.customTeams.map(c => [c.id, c])),
        [p.customTeams],
    );

    const toggle = (teamId: number) => onChange(prev => {
        const cur = prev[key];
        const next = cur.includes(teamId) ? cur.filter(x => x !== teamId) : [...cur, teamId];
        return { ...prev, [key]: next };
    });

    // Removes a team from this tier — also drops its definition if it is custom.
    const removeTeam = (teamId: number) => onChange(prev => ({
        ...prev,
        [key]: prev[key].filter(x => x !== teamId),
        customTeams: teamId < 0 ? prev.customTeams.filter(c => c.id !== teamId) : prev.customTeams,
    }));

    const rename = (teamId: number, value: string) => onChange(prev => ({
        ...prev, teamNames: { ...prev.teamNames, [String(teamId)]: value },
    }));

    const renameCustom = (teamId: number, value: string) => onChange(prev => ({
        ...prev,
        customTeams: prev.customTeams.map(c => (c.id === teamId ? { ...c, name: value } : c)),
    }));

    const setBadge = (teamId: number, logo: string) => onChange(prev => ({
        ...prev,
        customTeams: prev.customTeams.map(c => (c.id === teamId ? { ...c, logo } : c)),
    }));

    const addCustomTeam = () => {
        const name = draftName.trim();
        if (!name) return;
        const id = nextCustomId();
        onChange(prev => ({
            ...prev,
            [key]: [...prev[key], id],
            customTeams: [...prev.customTeams, { id, name, logo: draftLogo }],
        }));
        setDraftName('');
        setDraftLogo(randomBadge());
        setCreating(false);
    };

    const sourceLeague = catalog.find(l => l.id === sourceLeagueId);
    const evenWarn = ids.length > 0 && ids.length % 2 !== 0;

    return (
        <div className="rounded border border-white/[0.06]">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.05]">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink-300)]">
                    Tier {tier} · {tierName || (tier === 1 ? 'Top Division' : 'Feeder Division')}
                </span>
                <span className="ml-auto font-mono text-[10px] font-bold tabular"
                    style={{ color: evenWarn ? 'var(--loss)' : accent }}>
                    {ids.length} team{ids.length !== 1 ? 's' : ''}{evenWarn ? ' · must be even' : ''}
                </span>
            </div>

            {/* Selected teams */}
            {ids.length > 0 && (
                <div className="p-2 space-y-1">
                    {ids.map(id => {
                        // From-scratch custom team — editable name + badge.
                        if (id < 0) {
                            const def = customById.get(id);
                            if (!def) return null;
                            return (
                                <div key={id} className="rounded bg-white/[0.02]">
                                    <div className="flex items-center gap-2 px-2 py-1.5">
                                        <button type="button" title="Change club badge"
                                            onClick={() => setBadgeRowId(badgeRowId === id ? null : id)}
                                            className="shrink-0 rounded hover:ring-2 hover:ring-[var(--volt)]/40 transition-all cursor-pointer">
                                            <BadgeThumb badge={def.logo} />
                                        </button>
                                        <input
                                            type="text" value={def.name} maxLength={MAX_TEAM_NAME}
                                            onChange={e => renameCustom(id, e.target.value)}
                                            placeholder="Team name"
                                            className="flex-1 min-w-0 px-2 py-1 bg-[var(--ink-850)] border border-white/10 rounded text-xs text-[var(--bone)] focus:outline-none focus:border-[var(--volt)]/50"
                                        />
                                        <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-[var(--epic)] bg-[var(--epic)]/10 px-1.5 py-0.5 rounded shrink-0">
                                            Custom
                                        </span>
                                        <button onClick={() => removeTeam(id)}
                                            className="w-6 h-6 flex items-center justify-center rounded text-[var(--ink-500)] hover:text-[var(--loss)] hover:bg-[var(--loss)]/10 transition-all cursor-pointer shrink-0">
                                            <X size={12} />
                                        </button>
                                    </div>
                                    {badgeRowId === id && (
                                        <div className="px-2 pb-2">
                                            <BadgeGrid value={def.logo}
                                                onPick={logo => { setBadge(id, logo); setBadgeRowId(null); }} />
                                        </div>
                                    )}
                                </div>
                            );
                        }
                        // Catalog team — editable rename, real badge by catalog id.
                        const t = teamIndex.get(id);
                        const orig = t?.team_name ?? `Team ${id}`;
                        const val = p.teamNames[String(id)];
                        return (
                            <div key={id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/[0.02]">
                                <BadgeThumb badge={id} />
                                <input
                                    type="text"
                                    value={val !== undefined ? String(val) : orig}
                                    onChange={e => rename(id, e.target.value)}
                                    className="flex-1 min-w-0 px-2 py-1 bg-[var(--ink-850)] border border-white/10 rounded text-xs text-[var(--bone)] focus:outline-none focus:border-[var(--volt)]/50"
                                />
                                <span className="font-mono text-[9px] text-[var(--ink-500)] uppercase tracking-wider hidden sm:block shrink-0">
                                    {t?.country ?? '—'} · OVR {t?.avg_overall ?? '—'}
                                </span>
                                <button onClick={() => removeTeam(id)}
                                    className="w-6 h-6 flex items-center justify-center rounded text-[var(--ink-500)] hover:text-[var(--loss)] hover:bg-[var(--loss)]/10 transition-all cursor-pointer shrink-0">
                                    <X size={12} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add-from-catalog panel */}
            {adding && (
                <div className="p-2 border-t border-white/[0.05] space-y-2">
                    <select
                        value={sourceLeagueId}
                        onChange={e => setSourceLeagueId(e.target.value ? Number(e.target.value) : '')}
                        className={inputClass}
                    >
                        <option value="">Choose a source league…</option>
                        {groupByContinent(catalog).map(([continent, leagues]) => (
                            <optgroup key={continent} label={continent}>
                                {leagues.map(l => (
                                    <option key={l.id} value={l.id}>{l.league_name} ({l.country})</option>
                                ))}
                            </optgroup>
                        ))}
                    </select>

                    {sourceLeague && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-52 overflow-y-auto pr-1">
                            {sourceLeague.teams.map(t => {
                                const selectedHere = ids.includes(t.id);
                                const usedElsewhere = usedTeamIds.has(t.id) && !selectedHere;
                                return (
                                    <button
                                        key={t.id}
                                        onClick={() => !usedElsewhere && toggle(t.id)}
                                        disabled={usedElsewhere}
                                        title={usedElsewhere ? 'Already used in this save' : t.team_name}
                                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-left transition-all cursor-pointer border ${
                                            selectedHere
                                                ? 'border-[var(--volt)]/50 bg-[var(--volt)]/10'
                                                : usedElsewhere
                                                    ? 'border-white/[0.04] opacity-35 cursor-not-allowed'
                                                    : 'border-white/[0.07] hover:border-[var(--volt)]/30 hover:bg-white/[0.03]'}`}
                                    >
                                        <BadgeThumb badge={t.id} size={22} />
                                        <span className="min-w-0">
                                            <span className="text-xs font-semibold text-[var(--bone)] truncate w-full flex items-center gap-1">
                                                {selectedHere && <Check size={11} className="text-[var(--volt)] shrink-0" />}
                                                {t.team_name}
                                            </span>
                                            <span className="font-mono text-[9px] text-[var(--ink-500)] uppercase tracking-wider">
                                                OVR {t.avg_overall} · {t.player_count}p
                                            </span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    <button onClick={() => setAdding(false)}
                        className="w-full py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-400)] hover:text-[var(--bone)] transition-colors cursor-pointer">
                        Done
                    </button>
                </div>
            )}

            {/* Create-from-scratch panel */}
            {creating && (
                <div className="p-3 border-t border-white/[0.05] space-y-2.5 bg-[var(--epic)]/[0.03]">
                    <div>
                        <label className={labelClass}>New Team Name</label>
                        <input
                            type="text" value={draftName} maxLength={MAX_TEAM_NAME} autoFocus
                            onChange={e => setDraftName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') addCustomTeam(); }}
                            className={inputClass} placeholder="e.g. Coastal Smashers"
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Club Badge</label>
                        <BadgeGrid value={draftLogo} onPick={setDraftLogo} />
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => { setCreating(false); setDraftName(''); }}
                            className="btn-ghost flex-1 py-1.5 text-xs">
                            Cancel
                        </button>
                        <button onClick={addCustomTeam} disabled={!draftName.trim()}
                            className="btn-volt flex-1 py-1.5 text-xs disabled:opacity-40">
                            Add Team
                        </button>
                    </div>
                </div>
            )}

            {/* Triggers */}
            {!adding && !creating && (
                <div className="flex border-t border-white/[0.05]">
                    <button onClick={() => { setCreating(false); setAdding(true); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[var(--ink-400)] hover:text-[var(--volt)] transition-colors cursor-pointer font-mono text-[10px] uppercase tracking-[0.16em]">
                        <Plus size={12} /> Add Teams
                    </button>
                    <span className="w-px bg-white/[0.05]" />
                    <button onClick={() => { setAdding(false); setCreating(true); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[var(--ink-400)] hover:text-[var(--epic)] transition-colors cursor-pointer font-mono text-[10px] uppercase tracking-[0.16em]">
                        <Shield size={12} /> New Team
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Step 4: Review ─────────────────────────────────────────────────────────

function StepReview({ config, pyramids, cups, errors, teamIndex }: {
    config: CustomWorldConfig;
    pyramids: PyramidDraft[];
    cups: CupDraft[];
    errors: string[];
    teamIndex: Map<number, CatalogTeam & { leagueName: string }>;
}) {
    return (
        <div className="space-y-4">
            <div>
                <h3 className="font-display text-xl tracking-wide text-[var(--bone)]">REVIEW &amp; CREATE</h3>
                <p className="text-sm text-[var(--ink-400)] mt-1.5">
                    Save: <span className="text-[var(--bone)] font-semibold">{config.saveName || '—'}</span>
                </p>
            </div>

            {errors.length > 0 ? (
                <div className="rounded border border-[var(--loss)]/30 bg-[var(--loss)]/[0.07] p-4 space-y-1.5">
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--loss)] font-bold flex items-center gap-1.5">
                        <AlertCircle size={12} /> Fix before creating
                    </p>
                    {errors.map((e, i) => (
                        <p key={i} className="text-xs text-[var(--ink-300)] flex items-start gap-1.5">
                            <span className="text-[var(--loss)]">·</span> {e}
                        </p>
                    ))}
                </div>
            ) : (
                <div className="rounded border border-[var(--win)]/25 bg-[var(--win)]/[0.06] px-4 py-2.5">
                    <p className="text-xs text-[var(--win)] font-medium flex items-center gap-1.5">
                        <Check size={13} /> Everything checks out — ready to build your world.
                    </p>
                </div>
            )}

            {pyramids.map((p, i) => {
                const t1 = scheduleSummary(p.tier1TeamIds.length, p.rounds);
                const t2 = scheduleSummary(p.tier2TeamIds.length, p.rounds);
                return (
                    <div key={p.uid} className="rounded border border-white/[0.08] bg-white/[0.02] p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--epic)] font-bold">League {i + 1}</span>
                            <span className="font-display text-base tracking-wide text-[var(--bone)]">{p.name || 'Untitled'}</span>
                            <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--ink-500)] ml-auto">
                                {p.kind === 'international' ? 'International' : p.country || 'Domestic'}
                            </span>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-3">
                            {([[1, p.tier1Name, p.tier1TeamIds, t1, p.playoffEnabled],
                               [2, p.tier2Name, p.tier2TeamIds, t2, false]] as const).map(([tier, name, tids, sum, playoff]) => (
                                <div key={tier} className="rounded bg-white/[0.02] border border-white/[0.05] p-3">
                                    <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--ink-400)] mb-1">
                                        Tier {tier}
                                    </p>
                                    <p className="font-display text-sm tracking-wide text-[var(--bone)] truncate">{name || '—'}</p>
                                    <div className="mt-2 space-y-0.5 font-mono text-[10px] text-[var(--ink-400)]">
                                        <p>{tids.length} teams · {sum.gameWeeks} game weeks · {sum.fixtures} fixtures</p>
                                        <p className="flex items-center gap-1">
                                            <CalendarDays size={9} /> Regular season Jan–Apr
                                        </p>
                                        {playoff
                                            ? <p className="text-[var(--volt)]">Top {p.playoffTopN} playoff · best of {p.seriesLength}</p>
                                            : <p>No playoffs</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="font-mono text-[10px] text-[var(--ink-500)] mt-2.5 flex items-center gap-1.5">
                            <ArrowUpDown size={10} /> {p.promotionCount} up / {p.promotionCount} down between tiers
                        </p>
                    </div>
                );
            })}
            {cups.length > 0 && (
                <div className="rounded border border-white/[0.08] bg-white/[0.02] p-4">
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--epic)] font-bold mb-2 flex items-center gap-1.5">
                        <Trophy size={11} /> {cups.length} Cup{cups.length !== 1 ? 's' : ''}
                    </p>
                    <div className="space-y-1.5">
                        {cups.map(c => (
                            <div key={c.uid} className="flex items-center gap-2 flex-wrap">
                                <span className="font-display text-sm tracking-wide text-[var(--bone)]">{c.name || 'Untitled'}</span>
                                <span className="font-mono text-[10px] text-[var(--ink-500)]">
                                    {c.teamIds.length} teams · knockout · {MONTHS_SHORT[c.window.startMonth]}–{MONTHS_SHORT[c.window.endMonth]}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* teamIndex referenced to keep rosters resolvable in future review detail */}
            <p className="font-mono text-[9px] text-[var(--ink-600)] text-center">
                {teamIndex.size} original teams available · world builds in a few seconds
            </p>
        </div>
    );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function groupByContinent(catalog: CatalogLeague[]): [string, CatalogLeague[]][] {
    const groups = new Map<string, CatalogLeague[]>();
    for (const l of catalog) {
        const c = l.continent || 'Other';
        if (!groups.has(c)) groups.set(c, []);
        groups.get(c)!.push(l);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

/** Percentage position (0–100) of a date across the Jul 1 – Dec 31 cup block. */
function datePct(dateStr: string): number {
    const d = new Date(dateStr + 'T00:00:00');
    const y = d.getFullYear();
    const jul1 = new Date(y, 6, 1).getTime();
    const dec31 = new Date(y, 11, 31).getTime();
    return Math.max(0, Math.min(100, ((d.getTime() - jul1) / (dec31 - jul1)) * 100));
}

// ─── Step 4: Cups ───────────────────────────────────────────────────────────

function StepCups({ cups, setCups, updateCup, leagueTeamIds, teamIndex, customTeamIndex }: {
    cups: CupDraft[];
    setCups: React.Dispatch<React.SetStateAction<CupDraft[]>>;
    updateCup: (uid: string, fn: (c: CupDraft) => CupDraft) => void;
    leagueTeamIds: number[];
    teamIndex: Map<number, CatalogTeam & { leagueName: string }>;
    customTeamIndex: Map<number, CustomTeamDef>;
}) {
    return (
        <div className="space-y-5">
            <div>
                <h3 className="font-display text-xl tracking-wide text-[var(--bone)]">CUPS &amp; TOURNAMENTS</h3>
                <p className="text-sm text-[var(--ink-400)] mt-1.5">
                    Optional knockout cups played in the Jul–Dec cup block. Give each one a window
                    so they don&apos;t pile onto the same dates — the timeline flags any clashes.
                </p>
            </div>

            {leagueTeamIds.length === 0 ? (
                <div className="rounded border border-white/[0.08] bg-white/[0.02] py-10 text-center">
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--ink-500)]">
                        Add teams to your leagues first
                    </p>
                </div>
            ) : (
                <>
                    {cups.map((c, i) => (
                        <CupCard
                            key={c.uid} cup={c} index={i}
                            leagueTeamIds={leagueTeamIds} teamIndex={teamIndex}
                            customTeamIndex={customTeamIndex}
                            onChange={fn => updateCup(c.uid, fn)}
                            onRemove={() => setCups(prev => prev.filter(x => x.uid !== c.uid))}
                        />
                    ))}
                    {cups.length < MAX_CUPS && (
                        <button
                            onClick={() => setCups(prev => [...prev, newCup(prev.length)])}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded border border-dashed border-white/15 text-[var(--ink-400)] hover:text-[var(--epic)] hover:border-[var(--epic)]/40 transition-all cursor-pointer font-mono text-xs uppercase tracking-[0.16em]"
                        >
                            <Plus size={14} /> Add a Cup
                        </button>
                    )}
                    {cups.length === 0 && (
                        <p className="text-center font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-600)]">
                            Cups are optional — skip this step if you don&apos;t want any
                        </p>
                    )}
                    {cups.length > 0 && <CupTimeline cups={cups} />}
                </>
            )}
        </div>
    );
}

function CupCard({ cup: c, index, leagueTeamIds, teamIndex, customTeamIndex, onChange, onRemove }: {
    cup: CupDraft;
    index: number;
    leagueTeamIds: number[];
    teamIndex: Map<number, CatalogTeam & { leagueName: string }>;
    customTeamIndex: Map<number, CustomTeamDef>;
    onChange: (fn: (c: CupDraft) => CupDraft) => void;
    onRemove: () => void;
}) {
    const count = c.teamIds.length;
    const validSize = ALLOWED_CUP_SIZES.includes(count);

    const toggle = (id: number) => onChange(prev => ({
        ...prev,
        teamIds: prev.teamIds.includes(id) ? prev.teamIds.filter(x => x !== id) : [...prev.teamIds, id],
    }));

    const setWindow = (patch: Partial<CupDraft['window']>) => onChange(prev => {
        const w = { ...prev.window, ...patch };
        w.startDay = 1;
        w.endDay = lastDayOfMonth(2026, w.endMonth);
        return { ...prev, window: w };
    });

    return (
        <div className="rounded border border-white/[0.08] bg-white/[0.02] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
                <Trophy size={13} className="text-[var(--epic)]" />
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--epic)] font-bold">Cup {index + 1}</span>
                <span className="font-display text-sm tracking-wide text-[var(--bone)] truncate">{c.name || 'Untitled'}</span>
                <button onClick={onRemove}
                    className="ml-auto w-7 h-7 flex items-center justify-center rounded text-[var(--ink-500)] hover:text-[var(--loss)] hover:bg-[var(--loss)]/10 transition-all cursor-pointer">
                    <Trash2 size={13} />
                </button>
            </div>
            <div className="p-4 space-y-3">
                <div className="grid sm:grid-cols-3 gap-3">
                    <div>
                        <label className={labelClass}>Cup Name</label>
                        <input type="text" value={c.name} maxLength={40}
                            onChange={e => onChange(prev => ({ ...prev, name: e.target.value }))}
                            className={inputClass} placeholder="e.g. Summer Cup" />
                    </div>
                    <div>
                        <label className={labelClass}>Starts</label>
                        <select value={c.window.startMonth}
                            onChange={e => setWindow({ startMonth: Number(e.target.value) })}
                            className={inputClass}>
                            {[7, 8, 9, 10, 11, 12].map(m => <option key={m} value={m}>{MONTHS_SHORT[m]}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Ends</label>
                        <select value={c.window.endMonth}
                            onChange={e => setWindow({ endMonth: Number(e.target.value) })}
                            className={inputClass}>
                            {[7, 8, 9, 10, 11, 12].map(m => <option key={m} value={m}>{MONTHS_SHORT[m]}</option>)}
                        </select>
                    </div>
                </div>

                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-[var(--ink-400)]">Teams</span>
                        <span className="font-mono text-[10px] font-bold"
                            style={{ color: validSize ? 'var(--win)' : 'var(--loss)' }}>
                            {count} selected {validSize ? '✓' : '· pick 2, 4, 8 or 16'}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto pr-1">
                        {leagueTeamIds.map(id => {
                            const custom = id < 0 ? customTeamIndex.get(id) : undefined;
                            const t = teamIndex.get(id);
                            const name = custom?.name || t?.team_name || `Team ${id}`;
                            const badge = custom ? (custom.logo || 'default') : id;
                            const sel = c.teamIds.includes(id);
                            return (
                                <button key={id} onClick={() => toggle(id)}
                                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-left transition-all cursor-pointer border ${
                                        sel
                                            ? 'border-[var(--epic)]/50 bg-[var(--epic)]/10'
                                            : 'border-white/[0.07] hover:border-[var(--epic)]/30 hover:bg-white/[0.03]'}`}>
                                    {sel
                                        ? <Check size={11} className="text-[var(--epic)] shrink-0" />
                                        : <BadgeThumb badge={badge} size={16} />}
                                    <span className="text-[11px] font-semibold text-[var(--bone)] truncate">
                                        {name}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

function CupTimeline({ cups }: { cups: CupDraft[] }) {
    const plans = cups.map(c => {
        const valid = ALLOWED_CUP_SIZES.includes(c.teamIds.length);
        const dates = valid
            ? planCupRounds(2026, c.teamIds.length, c.window).flatMap(p => p.dates)
            : [];
        return { cup: c, dates };
    });

    const dateMap = new Map<string, string[]>();
    for (const { cup, dates } of plans) {
        for (const d of dates) {
            if (!dateMap.has(d)) dateMap.set(d, []);
            dateMap.get(d)!.push(cup.name || 'Untitled');
        }
    }
    const collisions = [...dateMap.entries()].filter(([, names]) => new Set(names).size > 1);

    return (
        <div className="rounded border border-white/[0.08] bg-white/[0.02] p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--ink-300)] font-bold mb-3 flex items-center gap-1.5">
                <CalendarDays size={11} /> Cup Block Schedule
            </p>

            <div className="relative h-4 mb-1">
                {[7, 8, 9, 10, 11, 12].map((m, i) => (
                    <span key={m}
                        className="absolute font-mono text-[9px] uppercase tracking-wider text-[var(--ink-500)]"
                        style={{ left: `${(i / 6) * 100}%` }}>
                        {MONTHS_SHORT[m]}
                    </span>
                ))}
            </div>

            <div className="space-y-2">
                {plans.map(({ cup, dates }) => {
                    const startPct = datePct(`2026-${String(cup.window.startMonth).padStart(2, '0')}-${String(cup.window.startDay).padStart(2, '0')}`);
                    const endPct = datePct(`2026-${String(cup.window.endMonth).padStart(2, '0')}-${String(cup.window.endDay).padStart(2, '0')}`);
                    return (
                        <div key={cup.uid} className="flex items-center gap-2">
                            <span className="w-24 shrink-0 text-[10px] font-semibold text-[var(--ink-300)] truncate">
                                {cup.name || 'Untitled'}
                            </span>
                            <div className="relative flex-1 h-5 rounded bg-white/[0.03] border border-white/[0.05]">
                                <div className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-[var(--epic)]/30"
                                    style={{ left: `${startPct}%`, width: `${Math.max(2, endPct - startPct)}%` }} />
                                {dates.map((d, i) => (
                                    <div key={i}
                                        className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[var(--epic)] border border-[var(--ink-950)]"
                                        style={{ left: `calc(${datePct(d)}% - 4px)` }}
                                        title={d} />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {collisions.length > 0 && (
                <div className="mt-3 rounded border border-[var(--loss)]/30 bg-[var(--loss)]/[0.07] p-2.5 space-y-1">
                    <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--loss)] font-bold flex items-center gap-1.5">
                        <AlertCircle size={10} /> Date clashes
                    </p>
                    {collisions.slice(0, 4).map(([date, names]) => (
                        <p key={date} className="text-[10px] text-[var(--ink-300)]">
                            {date}: {[...new Set(names)].join(' + ')}
                        </p>
                    ))}
                    <p className="text-[9px] text-[var(--ink-500)]">Shift a cup&apos;s window to spread them out.</p>
                </div>
            )}
        </div>
    );
}
