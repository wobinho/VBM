'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import {
    Loader2, Sparkles, Check, AlertCircle, Trophy, Users, ChevronRight, Zap,
} from 'lucide-react';
import { DRAFT_QUOTA } from '@/lib/custom-save';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DraftPlayer {
    id: number; player_name: string; position: string; age: number; country: string;
    overall: number; potential: number;
    attack: number; block: number; serve: number; receive: number; setting: number; digging: number;
}
interface DraftTeam { id: number; team_name: string; league_name: string; }
interface DraftData { done: boolean; poolMode?: string; pool?: DraftPlayer[]; teams?: DraftTeam[]; userTeamId?: number | null; }

const POS_SHORT: Record<string, string> = {
    'Outside Hitter': 'OH', 'Middle Blocker': 'MB', 'Opposite Hitter': 'OPP', 'Setter': 'S', 'Libero': 'L',
};
const ROSTER_SIZE = 7;
const AI_PICK_DELAY = 70; // ms

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/** Positions a roster still needs to satisfy the quota. */
function needsOf(roster: number[], byId: Map<number, DraftPlayer>): Set<string> {
    const count: Record<string, number> = {};
    for (const pid of roster) {
        const pos = byId.get(pid)?.position;
        if (pos) count[pos] = (count[pos] ?? 0) + 1;
    }
    const needs = new Set<string>();
    for (const [pos, q] of Object.entries(DRAFT_QUOTA)) {
        if ((count[pos] ?? 0) < q) needs.add(pos);
    }
    return needs;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function DraftScreen() {
    const { refresh, activeSave } = useAuth();

    const [data, setData] = useState<DraftData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [order, setOrder] = useState<number[]>([]);
    const [rosters, setRosters] = useState<Record<number, number[]>>({});
    const [picks, setPicks] = useState<{ teamId: number; player: DraftPlayer }[]>([]);
    const [pickIndex, setPickIndex] = useState(0);
    const [posFilter, setPosFilter] = useState<string>('ALL');
    const [submitting, setSubmitting] = useState(false);
    const logRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetch('/api/draft')
            .then(r => r.json())
            .then((d: DraftData) => {
                if (d.done) { refresh(); return; }
                setData(d);
                setOrder(shuffle((d.teams ?? []).map(t => t.id)));
                setRosters(Object.fromEntries((d.teams ?? []).map(t => [t.id, [] as number[]])));
            })
            .catch(() => setError('Could not load the draft'))
            .finally(() => setLoading(false));
    }, [refresh]);

    const pool = data?.pool ?? [];
    const teams = data?.teams ?? [];
    const userTeamId = data?.userTeamId ?? null;
    const T = teams.length;
    const totalPicks = T * ROSTER_SIZE;

    const byId = useMemo(() => new Map(pool.map(p => [p.id, p])), [pool]);
    const teamById = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams]);

    const pickedIds = useMemo(() => {
        const s = new Set<number>();
        for (const list of Object.values(rosters)) for (const id of list) s.add(id);
        return s;
    }, [rosters]);

    const done = pickIndex >= totalPicks && totalPicks > 0;
    const round = T > 0 ? Math.floor(pickIndex / T) : 0;
    const posInRound = T > 0 ? pickIndex % T : 0;
    const currentTeamId = T > 0 && !done
        ? (round % 2 === 0 ? order[posInRound] : order[T - 1 - posInRound])
        : null;
    const isUserTurn = !done && currentTeamId !== null && currentTeamId === userTeamId;

    const available = useMemo(() => pool.filter(p => !pickedIds.has(p.id)), [pool, pickedIds]);

    const currentNeeds = useMemo(
        () => (currentTeamId !== null ? needsOf(rosters[currentTeamId] ?? [], byId) : new Set<string>()),
        [currentTeamId, rosters, byId],
    );

    const commitPick = useCallback((teamId: number, playerId: number) => {
        const player = byId.get(playerId);
        if (!player) return;
        setRosters(prev => ({ ...prev, [teamId]: [...(prev[teamId] ?? []), playerId] }));
        setPicks(prev => [...prev, { teamId, player }]);
        setPickIndex(i => i + 1);
    }, [byId]);

    // Auto-advance AI picks.
    useEffect(() => {
        if (done || isUserTurn || currentTeamId === null || loading) return;
        const t = setTimeout(() => {
            const pickable = available
                .filter(p => currentNeeds.has(p.position))
                .sort((a, b) => b.overall - a.overall);
            if (pickable.length === 0) return;
            // Pick from the top few for a little variety.
            const choice = pickable[Math.floor(Math.random() * Math.min(3, pickable.length))];
            commitPick(currentTeamId, choice.id);
        }, AI_PICK_DELAY);
        return () => clearTimeout(t);
    }, [pickIndex, done, isUserTurn, currentTeamId, loading, available, currentNeeds, commitPick]);

    useEffect(() => {
        logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
    }, [picks]);

    const handleComplete = async () => {
        setSubmitting(true); setError('');
        try {
            const res = await fetch('/api/draft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assignments: rosters }),
            });
            const d = await res.json();
            if (!d.success) { setError(d.error || 'Could not save the draft'); setSubmitting(false); return; }
            await refresh();
        } catch {
            setError('Could not save the draft'); setSubmitting(false);
        }
    };

    // ─── Render ──────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <Overlay>
                <div className="flex items-center gap-2 text-[var(--ink-500)] font-mono text-xs uppercase tracking-wider">
                    <Loader2 size={14} className="animate-spin" /> Loading the draft
                </div>
            </Overlay>
        );
    }
    if (!data) {
        return (
            <Overlay>
                <div className="text-center space-y-3">
                    <AlertCircle size={28} className="text-[var(--loss)] mx-auto" />
                    <p className="text-sm text-[var(--ink-300)]">{error || 'The draft is unavailable.'}</p>
                </div>
            </Overlay>
        );
    }

    const userTeam = userTeamId !== null ? teamById.get(userTeamId) : undefined;
    const userRoster = userTeamId !== null ? (rosters[userTeamId] ?? []) : [];
    const userNeeds = needsOf(userRoster, byId);
    const pickablePositions = isUserTurn ? currentNeeds : new Set<string>();

    const filtered = available
        .filter(p => posFilter === 'ALL' || p.position === posFilter)
        .slice(0, 120);

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-[var(--ink-950)]">
            {/* Header */}
            <div className="relative px-6 py-4 border-b border-white/[0.07] shrink-0">
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-[var(--epic)]" />
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <p className="eyebrow flex items-center gap-1.5">
                            <Sparkles size={11} className="text-[var(--epic)]" /> {activeSave?.name ?? 'Custom Save'}
                        </p>
                        <h1 className="font-display text-3xl tracking-[0.04em] text-[var(--bone)] leading-none mt-1">
                            FANTASY DRAFT
                        </h1>
                    </div>
                    {!done ? (
                        <div className={`flex items-center gap-3 px-4 py-2.5 rounded border ${
                            isUserTurn
                                ? 'border-[var(--volt)]/50 bg-[var(--volt)]/10 animate-pulse-glow'
                                : 'border-white/[0.08] bg-white/[0.03]'}`}>
                            {isUserTurn
                                ? <Zap size={15} className="text-[var(--volt)]" />
                                : <Loader2 size={14} className="text-[var(--ink-400)] animate-spin" />}
                            <div>
                                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--ink-500)]">
                                    Round {round + 1}/{ROSTER_SIZE} · Pick {pickIndex + 1}/{totalPicks}
                                </p>
                                <p className={`font-display text-base tracking-wide ${isUserTurn ? 'text-[var(--volt)]' : 'text-[var(--bone)]'}`}>
                                    {isUserTurn ? 'YOUR PICK' : (currentTeamId !== null ? teamById.get(currentTeamId)?.team_name?.toUpperCase() : '')}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-4 py-2.5 rounded border border-[var(--win)]/40 bg-[var(--win)]/10">
                            <Check size={15} className="text-[var(--win)]" />
                            <span className="font-display text-base tracking-wide text-[var(--win)]">DRAFT COMPLETE</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 p-4 lg:p-6 overflow-hidden">

                {/* Pool */}
                <div className="flex-1 min-h-0 flex flex-col surface-raised overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] flex-wrap">
                        <Users size={13} className="text-[var(--ink-400)]" />
                        <span className="font-display text-sm tracking-wide text-[var(--bone)]">
                            AVAILABLE · {available.length}
                        </span>
                        <div className="flex gap-1 ml-auto flex-wrap">
                            {['ALL', ...Object.keys(DRAFT_QUOTA)].map(p => (
                                <button key={p} onClick={() => setPosFilter(p)}
                                    className={`px-2 py-1 rounded font-mono text-[9px] uppercase tracking-[0.12em] font-bold transition-colors cursor-pointer ${
                                        posFilter === p
                                            ? 'bg-[var(--volt)] text-[var(--ink-950)]'
                                            : 'bg-white/[0.04] text-[var(--ink-400)] hover:text-[var(--bone)]'}`}>
                                    {p === 'ALL' ? 'All' : POS_SHORT[p]}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04]">
                        {done ? (
                            <div className="py-16 text-center font-mono text-xs uppercase tracking-[0.2em] text-[var(--ink-500)]">
                                Every player has been drafted
                            </div>
                        ) : filtered.map(p => {
                            const pickable = isUserTurn && pickablePositions.has(p.position);
                            return (
                                <button
                                    key={p.id}
                                    onClick={() => { if (pickable && currentTeamId !== null) commitPick(currentTeamId, p.id); }}
                                    disabled={!pickable}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                        pickable
                                            ? 'cursor-pointer hover:bg-[var(--volt)]/[0.08]'
                                            : isUserTurn ? 'opacity-35 cursor-not-allowed' : 'cursor-default'}`}
                                >
                                    <span className="w-9 text-center font-display text-xl text-[var(--bone)] tabular shrink-0">
                                        {p.overall}
                                    </span>
                                    <span className="w-9 shrink-0 font-mono text-[9px] font-bold uppercase tracking-wider text-center py-1 rounded bg-white/[0.05] text-[var(--ink-300)]">
                                        {POS_SHORT[p.position] ?? '?'}
                                    </span>
                                    <span className="flex-1 min-w-0">
                                        <span className="block text-sm font-semibold text-[var(--bone)] truncate">{p.player_name}</span>
                                        <span className="block font-mono text-[10px] text-[var(--ink-500)] uppercase tracking-wider">
                                            {p.country} · age {p.age} · POT {p.potential}
                                        </span>
                                    </span>
                                    {pickable && <ChevronRight size={15} className="text-[var(--volt)] shrink-0" />}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Sidebar */}
                <div className="w-full lg:w-80 shrink-0 flex flex-col gap-4 min-h-0">
                    {/* Your roster */}
                    <div className="surface-raised overflow-hidden shrink-0">
                        <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center gap-2">
                            <Trophy size={12} className="text-[var(--volt)]" />
                            <span className="font-display text-sm tracking-wide text-[var(--bone)] truncate">
                                {userTeam?.team_name?.toUpperCase() ?? 'YOUR TEAM'}
                            </span>
                            <span className="ml-auto font-mono text-[10px] text-[var(--ink-500)] tabular">
                                {userRoster.length}/{ROSTER_SIZE}
                            </span>
                        </div>
                        <div className="p-2 space-y-1">
                            {Array.from({ length: ROSTER_SIZE }).map((_, i) => {
                                const pid = userRoster[i];
                                const p = pid !== undefined ? byId.get(pid) : undefined;
                                return (
                                    <div key={i} className={`flex items-center gap-2 px-2 py-1.5 rounded ${p ? 'bg-white/[0.03]' : 'bg-white/[0.01] border border-dashed border-white/[0.06]'}`}>
                                        {p ? (
                                            <>
                                                <span className="w-7 font-mono text-[9px] font-bold uppercase text-center py-0.5 rounded bg-white/[0.06] text-[var(--ink-300)]">
                                                    {POS_SHORT[p.position]}
                                                </span>
                                                <span className="flex-1 text-xs font-semibold text-[var(--bone)] truncate">{p.player_name}</span>
                                                <span className="font-display text-sm text-[var(--volt)] tabular">{p.overall}</span>
                                            </>
                                        ) : (
                                            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--ink-600)] px-1">Empty</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {!done && userNeeds.size > 0 && (
                            <div className="px-3 py-2 border-t border-white/[0.05] font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--ink-500)]">
                                Still need: {[...userNeeds].map(n => POS_SHORT[n]).join(' · ')}
                            </div>
                        )}
                    </div>

                    {/* Draft log */}
                    <div className="surface-raised overflow-hidden flex-1 min-h-0 flex flex-col">
                        <div className="px-4 py-2.5 border-b border-white/[0.06]">
                            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--ink-400)] font-bold">Draft Log</span>
                        </div>
                        <div ref={logRef} className="flex-1 overflow-y-auto p-2 space-y-0.5">
                            {picks.length === 0 ? (
                                <p className="py-4 text-center font-mono text-[10px] uppercase tracking-wider text-[var(--ink-600)]">
                                    No picks yet
                                </p>
                            ) : picks.map((pk, i) => {
                                const isUser = pk.teamId === userTeamId;
                                return (
                                    <div key={i} className={`flex items-center gap-2 px-2 py-1 rounded text-[11px] ${isUser ? 'bg-[var(--volt)]/[0.08]' : ''}`}>
                                        <span className="font-mono text-[9px] text-[var(--ink-600)] tabular w-7 shrink-0">{i + 1}</span>
                                        <span className={`flex-1 min-w-0 truncate ${isUser ? 'text-[var(--volt)]' : 'text-[var(--ink-300)]'}`}>
                                            <span className="font-semibold">{pk.player.player_name}</span>
                                        </span>
                                        <span className="font-mono text-[9px] text-[var(--ink-500)] truncate max-w-[90px] shrink-0">
                                            {teamById.get(pk.teamId)?.team_name}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-white/[0.07] shrink-0 flex items-center gap-4">
                {error && (
                    <span className="flex items-center gap-1.5 text-[var(--loss)] text-xs font-medium">
                        <AlertCircle size={13} /> {error}
                    </span>
                )}
                <div className="ml-auto flex items-center gap-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-500)]">
                        {data.poolMode === 'generated' ? 'Generated players'
                            : data.poolMode === 'mixed' ? 'Mixed pool' : 'Real players'}
                    </span>
                    <button
                        onClick={handleComplete}
                        disabled={!done || submitting}
                        className="btn-volt flex items-center gap-2"
                    >
                        {submitting
                            ? <><Loader2 size={14} className="animate-spin" /> Starting…</>
                            : <><Check size={14} /> Complete Draft</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

function Overlay({ children }: { children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ink-950)]">
            {children}
        </div>
    );
}
