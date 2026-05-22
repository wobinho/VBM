'use client';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useAuth, SaveSummary } from '@/contexts/auth-context';
import {
    Loader2, Plus, Trash2, LogOut, Sparkles, Clock,
    ChevronRight, X, Gamepad2, AlertCircle,
} from 'lucide-react';
import CustomSaveWizard from '@/components/custom-save-wizard';

const inputClass = "w-full px-4 py-3 bg-[var(--ink-850)] border border-white/10 rounded text-[var(--bone)] placeholder-[var(--ink-500)] focus:outline-none focus:border-[var(--volt)]/60 focus:ring-2 focus:ring-[var(--volt)]/15 transition-all font-body";

function formatWhen(save: SaveSummary): string {
    const raw = save.last_played ?? save.created_at;
    if (!raw) return 'Never played';
    // SQLite datetime('now') yields "YYYY-MM-DD HH:MM:SS" in UTC.
    const d = new Date(raw.replace(' ', 'T') + 'Z');
    if (isNaN(d.getTime())) return raw;
    const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    return save.last_played ? `Last played ${label}` : `Created ${label}`;
}

export default function SavePicker() {
    const { user, saves, loadSaves, selectSave, createSave, deleteSave, logout } = useAuth();
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [showNewForm, setShowNewForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [error, setError] = useState('');
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [showWizard, setShowWizard] = useState(false);

    useEffect(() => {
        loadSaves().finally(() => setLoading(false));
    }, [loadSaves]);

    const handleSelect = async (id: string) => {
        if (busyId) return;
        setBusyId(id); setError('');
        const res = await selectSave(id);
        // On success the app re-renders past the picker; on failure, recover.
        if (!res.success) { setError(res.error || 'Could not open this save'); setBusyId(null); }
    };

    const handleCreate = async () => {
        const name = newName.trim();
        if (!name || creating) return;
        setCreating(true); setError('');
        const res = await createSave(name);
        setCreating(false);
        if (res.success) { setNewName(''); setShowNewForm(false); }
        else setError(res.error || 'Could not create save');
    };

    const handleDelete = async (id: string) => {
        if (busyId) return;
        setBusyId(id); setError('');
        const res = await deleteSave(id);
        setBusyId(null); setConfirmDelete(null);
        if (!res.success) setError(res.error || 'Could not delete this save');
    };

    return (
        <>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
            <div className="w-full max-w-lg surface-raised overflow-hidden animate-fade-up">

                {/* Header */}
                <div className="relative p-8 text-center border-b border-white/[0.06] overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-[var(--volt)]" />
                    <div className="absolute -top-20 -right-16 w-48 h-48 rounded-full bg-[var(--volt)]/10 blur-3xl" />
                    <div className="relative">
                        <div className="mb-3 inline-block animate-float">
                            <Image src="/assets/vbm_logo.png" alt="VBM" width={84} height={84} priority className="object-contain" />
                        </div>
                        <h2 className="font-display text-3xl tracking-[0.06em] text-[var(--bone)]">SELECT A SAVE</h2>
                        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--ink-400)] mt-2">
                            Each save is its own independent world
                        </p>
                    </div>
                </div>

                <div className="p-7 space-y-5">
                    {error && (
                        <div className="flex items-center gap-2.5 p-3.5 rounded border border-[var(--loss)]/40 bg-[var(--loss)]/10 text-[var(--loss)] text-sm font-medium">
                            <AlertCircle size={14} className="shrink-0" />
                            <span className="flex-1">{error}</span>
                            <button onClick={() => setError('')} className="opacity-60 hover:opacity-100 transition-opacity">
                                <X size={13} />
                            </button>
                        </div>
                    )}

                    {/* Save list */}
                    {loading ? (
                        <div className="flex items-center justify-center gap-2 py-10 text-[var(--ink-500)] font-mono text-xs uppercase tracking-wider">
                            <Loader2 size={14} className="animate-spin" /> Loading saves
                        </div>
                    ) : (
                        <div className="space-y-2.5 max-h-[42vh] overflow-y-auto pr-1">
                            {saves.map(save => {
                                const isMain = save.id === user?.id;
                                const isCustom = save.save_type === 'custom';
                                const isBusy = busyId === save.id;
                                const isCreating = save.status === 'creating';
                                const accent = isCustom ? 'var(--epic)' : 'var(--volt)';

                                if (confirmDelete === save.id) {
                                    return (
                                        <div key={save.id}
                                            className="flex items-center gap-3 p-4 rounded border border-[var(--loss)]/40 bg-[var(--loss)]/10">
                                            <Trash2 size={16} className="text-[var(--loss)] shrink-0" />
                                            <span className="flex-1 text-sm text-[var(--bone)] font-medium">
                                                Delete <span className="font-bold">{save.name}</span>? This cannot be undone.
                                            </span>
                                            <button
                                                onClick={() => handleDelete(save.id)}
                                                disabled={isBusy}
                                                className="px-3 py-1.5 rounded font-mono text-[10px] uppercase tracking-[0.16em] font-bold bg-[var(--loss)] text-white hover:opacity-90 disabled:opacity-50 cursor-pointer"
                                            >
                                                {isBusy ? <Loader2 size={12} className="animate-spin" /> : 'Delete'}
                                            </button>
                                            <button
                                                onClick={() => setConfirmDelete(null)}
                                                disabled={isBusy}
                                                className="px-3 py-1.5 rounded font-mono text-[10px] uppercase tracking-[0.16em] font-bold border border-white/10 text-[var(--ink-300)] hover:text-[var(--bone)] cursor-pointer"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={save.id} className="group relative">
                                        <button
                                            onClick={() => handleSelect(save.id)}
                                            disabled={!!busyId || isCreating}
                                            className="w-full flex items-center gap-3.5 p-4 rounded text-left bg-white/[0.02] border border-white/[0.07] hover:border-[var(--volt)]/40 hover:bg-white/[0.04] transition-all duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r" style={{ background: accent }} />
                                            <div className="w-10 h-10 rounded flex items-center justify-center shrink-0"
                                                style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)` }}>
                                                {isCustom
                                                    ? <Sparkles size={17} style={{ color: accent }} />
                                                    : <Gamepad2 size={17} style={{ color: accent }} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-display text-lg tracking-wide text-[var(--bone)] truncate">
                                                        {save.name.toUpperCase()}
                                                    </span>
                                                    {isMain && (
                                                        <span className="font-mono text-[8px] uppercase tracking-[0.16em] font-bold px-1.5 py-0.5 rounded bg-[var(--volt)]/15 text-[var(--volt)]">
                                                            Main
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink-500)] mt-1 flex items-center gap-1.5">
                                                    <Clock size={9} />
                                                    {isCreating ? 'Building world…' : formatWhen(save)}
                                                    <span className="text-[var(--ink-700)]">·</span>
                                                    {isCustom ? 'Custom' : 'Classic'}
                                                </p>
                                            </div>
                                            {isBusy ? (
                                                <Loader2 size={16} className="animate-spin text-[var(--volt)] shrink-0" />
                                            ) : (
                                                <ChevronRight size={16} className="text-[var(--ink-500)] group-hover:text-[var(--volt)] transition-colors shrink-0" />
                                            )}
                                        </button>
                                        {!isMain && !isCreating && (
                                            <button
                                                onClick={() => setConfirmDelete(save.id)}
                                                disabled={!!busyId}
                                                title="Delete save"
                                                className="absolute right-11 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded text-[var(--ink-600)] opacity-0 group-hover:opacity-100 hover:text-[var(--loss)] hover:bg-[var(--loss)]/10 transition-all cursor-pointer"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* New save */}
                    {!loading && (showNewForm ? (
                        <div className="space-y-3 p-4 rounded border border-[var(--volt)]/25 bg-[var(--volt)]/[0.04]">
                            <label className="block font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--ink-400)]">
                                New Classic Save
                            </label>
                            <input
                                type="text"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
                                maxLength={40}
                                autoFocus
                                className={inputClass}
                                placeholder="e.g. Second Career"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCreate}
                                    disabled={creating || !newName.trim()}
                                    className="btn-volt flex-1 flex items-center justify-center gap-2"
                                >
                                    {creating
                                        ? <><Loader2 size={14} className="animate-spin" /> Building world…</>
                                        : <>Create Save</>}
                                </button>
                                <button
                                    onClick={() => { setShowNewForm(false); setNewName(''); }}
                                    disabled={creating}
                                    className="btn-ghost px-4"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2.5">
                            <button onClick={() => { setShowNewForm(true); setError(''); }} className="btn-ghost flex items-center justify-center gap-2">
                                <Plus size={14} /> New Classic Save
                            </button>
                            <button
                                onClick={() => { setShowWizard(true); setError(''); }}
                                className="flex items-center justify-center gap-2 px-4 py-3 rounded border border-[var(--epic)]/30 bg-[var(--epic)]/[0.06] text-[var(--epic)] hover:bg-[var(--epic)]/[0.14] hover:border-[var(--epic)]/50 transition-all cursor-pointer font-mono text-xs uppercase tracking-[0.14em]"
                            >
                                <Sparkles size={13} /> Custom Save
                            </button>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-7 py-4 border-t border-white/[0.06]">
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-500)] truncate">
                        {user?.displayName}
                    </span>
                    <button
                        onClick={logout}
                        className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-400)] hover:text-[var(--loss)] transition-colors cursor-pointer"
                    >
                        <LogOut size={12} /> Sign Out
                    </button>
                </div>
            </div>
        </div>
        {showWizard && <CustomSaveWizard onClose={() => setShowWizard(false)} />}
        </>
    );
}
