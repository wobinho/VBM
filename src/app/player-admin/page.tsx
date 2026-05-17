'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, SlidersHorizontal, UserPlus, RotateCcw, CheckCircle2, Loader2, Shuffle, Save, X, Trash2, AlertCircle, Users, Plus, Copy, ChevronDown, ChevronUp, Bookmark, Pencil, BookmarkPlus } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { calculateOverall, POSITION_GROUPINGS, getOtherStats, ALL_STAT_KEYS, type StatKey } from '@/lib/overall';
import { Lock } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface RowData { [key: string]: any; }

interface BatchRow {
  rowId: string;
  info: { player_id: string; player_name: string; team_id: string; position: string; age: string; country: string; jersey_number: string };
  stats: Record<string, number>;
  expanded: boolean;
}

interface StatPreset {
  id: string;
  name: string;
  position: string;
  stats: Record<string, number>;
}

interface PresetEditor {
  id: string | null;
  name: string;
  position: string;
  stats: Record<string, number>;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const POSITIONS = ['Setter', 'Outside Hitter', 'Middle Blocker', 'Opposite Hitter', 'Libero'];

const STAT_GROUPS = [
  {
    label: 'Core Skills', headerClass: 'text-amber-400', borderClass: 'border-amber-500/20',
    stats: [
      { key: 'attack',   label: 'Attack' },
      { key: 'defense',  label: 'Defense' },
      { key: 'serve',    label: 'Serve' },
      { key: 'block',    label: 'Block' },
      { key: 'receive',  label: 'Receive' },
      { key: 'setting',  label: 'Setting' },
    ],
  },
  {
    label: 'Technical', headerClass: 'text-emerald-400', borderClass: 'border-emerald-500/20',
    stats: [
      { key: 'precision',    label: 'Precision' },
      { key: 'flair',        label: 'Flair' },
      { key: 'digging',      label: 'Digging' },
      { key: 'positioning',  label: 'Positioning' },
      { key: 'ball_control', label: 'Ball Control' },
      { key: 'technique',    label: 'Technique' },
      { key: 'playmaking',   label: 'Playmaking' },
      { key: 'spin',         label: 'Spin' },
    ],
  },
  {
    label: 'Physical', headerClass: 'text-blue-400', borderClass: 'border-blue-500/20',
    stats: [
      { key: 'speed',       label: 'Speed' },
      { key: 'agility',     label: 'Agility' },
      { key: 'strength',    label: 'Strength' },
      { key: 'endurance',   label: 'Endurance' },
      { key: 'vertical',    label: 'Vertical' },
      { key: 'flexibility', label: 'Flexibility' },
      { key: 'torque',      label: 'Torque' },
      { key: 'balance',     label: 'Balance' },
    ],
  },
  {
    label: 'Mental', headerClass: 'text-purple-400', borderClass: 'border-purple-500/20',
    stats: [
      { key: 'leadership',    label: 'Leadership' },
      { key: 'teamwork',      label: 'Teamwork' },
      { key: 'concentration', label: 'Concentration' },
      { key: 'pressure',      label: 'Pressure' },
      { key: 'consistency',   label: 'Consistency' },
      { key: 'vision',        label: 'Vision' },
      { key: 'game_iq',       label: 'Game IQ' },
      { key: 'intimidation',  label: 'Intimidation' },
    ],
  },
];

const STAT_LABEL: Record<string, string> = {
  attack: 'Attack', defense: 'Defense', serve: 'Serve', block: 'Block', receive: 'Receive', setting: 'Setting',
  precision: 'Precision', flair: 'Flair', digging: 'Digging', positioning: 'Positioning',
  ball_control: 'Ball Control', technique: 'Technique', playmaking: 'Playmaking', spin: 'Spin',
  speed: 'Speed', agility: 'Agility', strength: 'Strength', endurance: 'Endurance',
  vertical: 'Vertical', flexibility: 'Flexibility', torque: 'Torque', balance: 'Balance',
  leadership: 'Leadership', teamwork: 'Teamwork', concentration: 'Concentration', pressure: 'Pressure',
  consistency: 'Consistency', vision: 'Vision', game_iq: 'Game IQ', intimidation: 'Intimidation',
};

const INPUT_CLS = 'w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-all';
const SELECT_CLS = 'w-full px-3 py-2 bg-[#1a1a2e] border border-white/10 rounded-lg text-sm text-white focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-all';
const LABEL_CLS = 'text-xs font-semibold text-gray-400 uppercase tracking-wider';

const POSITION_COLORS: Record<string, { text: string; badge: string; border: string; accent: string }> = {
  'Setter':          { text: 'text-purple-400', badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30', border: 'border-l-purple-500',  accent: 'rgb(168 85 247)' },
  'Outside Hitter':  { text: 'text-amber-400',  badge: 'bg-amber-500/15  text-amber-300  border-amber-500/30',  border: 'border-l-amber-500',   accent: 'rgb(245 158 11)' },
  'Middle Blocker':  { text: 'text-blue-400',   badge: 'bg-blue-500/15   text-blue-300   border-blue-500/30',   border: 'border-l-blue-500',    accent: 'rgb(59 130 246)' },
  'Opposite Hitter': { text: 'text-red-400',    badge: 'bg-red-500/15    text-red-300    border-red-500/30',    border: 'border-l-red-500',     accent: 'rgb(239 68 68)' },
  'Libero':          { text: 'text-teal-400',   badge: 'bg-teal-500/15   text-teal-300   border-teal-500/30',   border: 'border-l-teal-500',    accent: 'rgb(20 184 166)' },
};

const CORE_STAT_KEYS = ['attack', 'defense', 'serve', 'block', 'receive', 'setting'] as const;

const PRESETS_STORAGE_KEY = 'vbm_stat_presets';
function loadPresetsFromStorage(): StatPreset[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(PRESETS_STORAGE_KEY) ?? '[]'); } catch { return []; }
}
function persistPresets(p: StatPreset[]) {
  localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(p));
}

const DEFAULT_QUICK_ADD = { player_id: '', player_name: '', team_id: '', position: '', age: '', country: '', jersey_number: '' };

function defaultStats(value = 75): Record<string, number> {
  const s: Record<string, number> = {};
  for (const k of ALL_STAT_KEYS) s[k] = value;
  return s;
}

function clampStat(v: number): number { return Math.max(1, Math.min(99, Math.round(v))); }

function nudgeStat(v: number): number {
  return clampStat(v + Math.floor(Math.random() * 11) - 5);
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const colorClass = value >= 80 ? 'text-emerald-400' : value >= 60 ? 'text-amber-400' : 'text-red-400';
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-400">{label}</span>
        <span className={`text-sm font-bold tabular-nums ${colorClass}`}>{value}</span>
      </div>
      <input
        type="range" min={1} max={100} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-amber-500"
        style={{ background: `linear-gradient(to right, rgb(245 158 11) ${((value - 1) / 99) * 100}%, rgba(255,255,255,0.1) ${((value - 1) / 99) * 100}%)` }}
      />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function PlayerAdminPage() {
  const { isAdmin } = useAuth();

  // Reference data
  const [allPlayers, setAllPlayers] = useState<RowData[]>([]);
  const [allTeams, setAllTeams] = useState<RowData[]>([]);

  // Quick Add Player
  const [quickAdd, setQuickAdd] = useState(DEFAULT_QUICK_ADD);
  const [quickAddStats, setQuickAddStats] = useState<Record<string, number>>(defaultStats);
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [quickAddSuccess, setQuickAddSuccess] = useState(false);

  // Player Editor
  const [editorSearch, setEditorSearch] = useState('');
  const [editorPlayer, setEditorPlayer] = useState<RowData | null>(null);
  const [editorInfo, setEditorInfo] = useState<RowData>({});
  const [editorStats, setEditorStats] = useState<Record<string, number>>({});
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorSuccess, setEditorSuccess] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Batch Add Queue
  const [batchRows, setBatchRows] = useState<BatchRow[]>([]);
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [batchResults, setBatchResults] = useState<{ name: string; success: boolean; error?: string }[] | null>(null);
  const [batchPresetOpen, setBatchPresetOpen] = useState<string | null>(null);
  const [addFromPresetOpen, setAddFromPresetOpen] = useState(false);

  // Stat Presets
  const [presets, setPresets] = useState<StatPreset[]>([]);
  const [presetEditor, setPresetEditor] = useState<PresetEditor | null>(null);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Lock size={48} className="text-gray-600" />
        <h2 className="text-2xl font-bold text-white">Access Denied</h2>
        <p className="text-gray-400">You do not have admin privileges.</p>
      </div>
    );
  }

  // ── Data fetching ───────────────────────────────────────────────────────────
  useEffect(() => {
    loadReferenceData();
    setPresets(loadPresetsFromStorage());
  }, []);

  const loadReferenceData = async () => {
    try {
      const [playersRes, teamsRes] = await Promise.all([
        fetch('/api/admin/table/players'),
        fetch('/api/admin/table/teams'),
      ]);
      if (playersRes.ok) setAllPlayers(await playersRes.json());
      if (teamsRes.ok) setAllTeams(await teamsRes.json());
    } catch {}
  };

  const refreshPlayers = async () => {
    try {
      const res = await fetch('/api/admin/table/players');
      if (res.ok) setAllPlayers(await res.json());
    } catch {}
  };

  // ── Quick Add Player ────────────────────────────────────────────────────────
  const quickAddGrouping = POSITION_GROUPINGS[quickAdd.position] ?? null;
  const quickAddOvr = quickAddGrouping ? calculateOverall(quickAddStats, quickAdd.position) : null;

  const randomizeGroup = useCallback((keys: string[]) => {
    setQuickAddStats(prev => {
      const next = { ...prev };
      for (const k of keys) next[k] = nudgeStat(prev[k] ?? 75);
      return next;
    });
  }, []);

  const handleQuickAddPlayer = async () => {
    const { player_id, player_name, position, age, country, jersey_number } = quickAdd;
    if (!player_name || !position || !age || !country || !jersey_number) {
      alert('Please fill in all required fields (name, position, age, country, jersey number)'); return;
    }
    setQuickAddLoading(true);
    const ageNum = parseInt(age), jerseyNum = parseInt(jersey_number);
    const overall = calculateOverall(quickAddStats, position);
    const payload = {
      ...(player_id ? { id: parseInt(player_id) } : {}),
      player_name, position, age: ageNum, country, jersey_number: jerseyNum,
      team_id: quickAdd.team_id ? parseInt(quickAdd.team_id) : null,
      overall,
      ...quickAddStats,
      contract_years: 1,
      monthly_wage: 5000,
      player_value: 250000,
    };
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setQuickAdd(DEFAULT_QUICK_ADD);
        setQuickAddStats(defaultStats());
        await refreshPlayers();
        setQuickAddSuccess(true);
        setTimeout(() => setQuickAddSuccess(false), 3000);
      } else { alert('Failed to create player'); }
    } catch { alert('Error creating player'); }
    setQuickAddLoading(false);
  };

  // ── Player Editor ───────────────────────────────────────────────────────────
  const filteredPlayersForEdit = useMemo(() => {
    if (!editorSearch.trim()) return [];
    const term = editorSearch.toLowerCase();
    return allPlayers
      .filter(p => p.player_name?.toLowerCase().includes(term) || p.position?.toLowerCase().includes(term))
      .slice(0, 10);
  }, [editorSearch, allPlayers]);

  const selectPlayerForEdit = (player: RowData) => {
    setEditorPlayer(player);
    setEditorSearch('');
    setDeleteConfirm(false);
    setEditorInfo({
      player_id:      player.id ?? '',
      player_name:    player.player_name ?? '',
      team_id:        player.team_id ?? '',
      position:       player.position ?? '',
      age:            player.age ?? '',
      country:        player.country ?? '',
      jersey_number:  player.jersey_number ?? '',
      height:         player.height ?? '',
      potential:      player.potential ?? '',
      contract_years: player.contract_years ?? 1,
      monthly_wage:   player.monthly_wage ?? 0,
      player_value:   player.player_value ?? 0,
    });
    setEditorStats({
      attack: player.attack ?? 50, defense: player.defense ?? 50,
      serve: player.serve ?? 50, block: player.block ?? 50,
      receive: player.receive ?? 50, setting: player.setting ?? 50,
      precision: player.precision ?? 50, flair: player.flair ?? 50,
      digging: player.digging ?? 50, positioning: player.positioning ?? 50,
      ball_control: player.ball_control ?? 50, technique: player.technique ?? 50,
      playmaking: player.playmaking ?? 50, spin: player.spin ?? 50,
      speed: player.speed ?? 50, agility: player.agility ?? 50,
      strength: player.strength ?? 50, endurance: player.endurance ?? 50,
      vertical: player.vertical ?? 50, flexibility: player.flexibility ?? 50,
      torque: player.torque ?? 50, balance: player.balance ?? 50,
      leadership: player.leadership ?? 50, teamwork: player.teamwork ?? 50,
      concentration: player.concentration ?? 50, pressure: player.pressure ?? 50,
      consistency: player.consistency ?? 50, vision: player.vision ?? 50,
      game_iq: player.game_iq ?? 50, intimidation: player.intimidation ?? 50,
    });
  };

  const handleSavePlayer = async () => {
    if (!editorPlayer) return;
    setEditorSaving(true);
    const position = editorInfo.position || editorPlayer.position;
    const overall = calculateOverall(editorStats, position);
    const newId = editorInfo.player_id !== '' && Number(editorInfo.player_id) !== editorPlayer.id
      ? Number(editorInfo.player_id) : undefined;
    const payload: Record<string, unknown> = {
      ...editorStats,
      overall,
      player_name:    editorInfo.player_name,
      team_id:        editorInfo.team_id === '' ? null : Number(editorInfo.team_id),
      position,
      age:            Number(editorInfo.age),
      country:        editorInfo.country,
      jersey_number:  Number(editorInfo.jersey_number),
      height:         editorInfo.height === '' ? null : Number(editorInfo.height),
      potential:      editorInfo.potential === '' ? null : Number(editorInfo.potential),
      contract_years: Number(editorInfo.contract_years),
      monthly_wage:   Number(editorInfo.monthly_wage),
      player_value:   Number(editorInfo.player_value),
      ...(newId !== undefined ? { new_id: newId } : {}),
    };
    try {
      const res = await fetch(`/api/players/${editorPlayer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const finalId = newId ?? editorPlayer.id;
        const updated = { ...editorPlayer, ...payload, id: finalId };
        setEditorPlayer(updated);
        setAllPlayers(prev => prev.map(p => p.id === editorPlayer.id ? { ...p, ...payload, id: finalId } : p));
        setEditorSuccess(true);
        setTimeout(() => setEditorSuccess(false), 3000);
      } else {
        const err = await res.json().catch(() => ({}));
        alert('Failed to save: ' + (err.error ?? res.statusText));
      }
    } catch { alert('Error saving player'); }
    setEditorSaving(false);
  };

  const handleDeletePlayer = async () => {
    if (!editorPlayer) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/players/${editorPlayer.id}`, { method: 'DELETE' });
      if (res.ok) {
        setAllPlayers(prev => prev.filter(p => p.id !== editorPlayer.id));
        setEditorPlayer(null);
        setEditorStats({});
        setEditorInfo({});
        setDeleteConfirm(false);
      } else {
        const err = await res.json().catch(() => ({}));
        alert('Failed to delete: ' + (err.error ?? res.statusText));
      }
    } catch { alert('Error deleting player'); }
    setDeleting(false);
  };

  const liveOverall = editorPlayer
    ? calculateOverall(editorStats, editorInfo.position || editorPlayer.position)
    : null;

  // ── Stat Presets ────────────────────────────────────────────────────────────
  const openNewPreset = () => setPresetEditor({ id: null, name: '', position: '', stats: defaultStats() });

  const openEditPreset = (preset: StatPreset) =>
    setPresetEditor({ id: preset.id, name: preset.name, position: preset.position, stats: { ...preset.stats } });

  const handleSavePreset = () => {
    if (!presetEditor) return;
    if (!presetEditor.name.trim() || !presetEditor.position) { alert('Preset name and position are required'); return; }
    let updated: StatPreset[];
    if (presetEditor.id) {
      updated = presets.map(p => p.id === presetEditor.id
        ? { ...p, name: presetEditor.name.trim(), position: presetEditor.position, stats: presetEditor.stats }
        : p);
    } else {
      updated = [...presets, { id: crypto.randomUUID(), name: presetEditor.name.trim(), position: presetEditor.position, stats: { ...presetEditor.stats } }];
    }
    setPresets(updated);
    persistPresets(updated);
    setPresetEditor(null);
  };

  const handleDeletePreset = (id: string) => {
    const updated = presets.filter(p => p.id !== id);
    setPresets(updated);
    persistPresets(updated);
    if (presetEditor?.id === id) setPresetEditor(null);
  };

  const applyPresetToBatchRow = (rowId: string, preset: StatPreset) => {
    setBatchRows(prev => prev.map(r =>
      r.rowId === rowId ? { ...r, info: { ...r.info, position: preset.position }, stats: { ...preset.stats } } : r
    ));
    setBatchPresetOpen(null);
  };

  const addRowFromPreset = (preset: StatPreset) => {
    const row: BatchRow = {
      rowId: crypto.randomUUID(),
      info: { ...DEFAULT_QUICK_ADD, position: preset.position },
      stats: { ...preset.stats },
      expanded: false,
    };
    setBatchRows(prev => [...prev, row]);
    setAddFromPresetOpen(false);
  };

  // ── Batch Add Queue ─────────────────────────────────────────────────────────
  const newBatchRow = (): BatchRow => ({
    rowId: crypto.randomUUID(),
    info: { ...DEFAULT_QUICK_ADD },
    stats: defaultStats(),
    expanded: false,
  });

  const updateBatchRowInfo = (rowId: string, key: string, value: string) =>
    setBatchRows(prev => prev.map(r => r.rowId === rowId ? { ...r, info: { ...r.info, [key]: value } } : r));

  const updateBatchRowStat = (rowId: string, key: string, value: number) =>
    setBatchRows(prev => prev.map(r => r.rowId === rowId ? { ...r, stats: { ...r.stats, [key]: clampStat(value) } } : r));

  const toggleBatchRow = (rowId: string) =>
    setBatchRows(prev => prev.map(r => r.rowId === rowId ? { ...r, expanded: !r.expanded } : r));

  const removeBatchRow = (rowId: string) =>
    setBatchRows(prev => prev.filter(r => r.rowId !== rowId));

  const duplicateBatchRow = (rowId: string) =>
    setBatchRows(prev => {
      const idx = prev.findIndex(r => r.rowId === rowId);
      if (idx === -1) return prev;
      const copy: BatchRow = { ...prev[idx], rowId: crypto.randomUUID(), expanded: false };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });

  const randomizeBatchGroup = (rowId: string, keys: string[]) =>
    setBatchRows(prev => prev.map(r => {
      if (r.rowId !== rowId) return r;
      const next = { ...r.stats };
      for (const k of keys) next[k] = nudgeStat(r.stats[k] ?? 75);
      return { ...r, stats: next };
    }));

  const handleBatchSubmit = async () => {
    if (batchRows.length === 0) return;
    const invalid = batchRows.filter(r => !r.info.player_name || !r.info.position || !r.info.age || !r.info.country || !r.info.jersey_number);
    if (invalid.length > 0) { alert(`${invalid.length} row(s) are missing required fields (name, position, age, country, jersey #)`); return; }

    setBatchSubmitting(true);
    setBatchResults(null);
    const results: { name: string; success: boolean; error?: string }[] = [];

    for (const row of batchRows) {
      const overall = calculateOverall(row.stats, row.info.position);
      const payload = {
        ...(row.info.player_id ? { id: parseInt(row.info.player_id) } : {}),
        player_name: row.info.player_name,
        position: row.info.position,
        age: parseInt(row.info.age),
        country: row.info.country,
        jersey_number: parseInt(row.info.jersey_number),
        team_id: row.info.team_id ? parseInt(row.info.team_id) : null,
        overall,
        ...row.stats,
        contract_years: 1,
        monthly_wage: 5000,
        player_value: 250000,
      };
      try {
        const res = await fetch('/api/players', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (res.ok) results.push({ name: row.info.player_name, success: true });
        else { const err = await res.json().catch(() => ({})); results.push({ name: row.info.player_name, success: false, error: err.error ?? 'Failed' }); }
      } catch { results.push({ name: row.info.player_name, success: false, error: 'Network error' }); }
    }

    const failedNames = new Set(results.filter(r => !r.success).map(r => r.name));
    setBatchRows(prev => prev.filter(r => failedNames.has(r.info.player_name)));
    setBatchResults(results);
    await refreshPlayers();
    setBatchSubmitting(false);
  };

  // ── JSX ─────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Player Admin</h1>
        <p className="text-gray-400 mt-1">Create new players and edit existing player stats</p>
      </div>

      {/* ── Quick Add Player ────────────────────────────────────────────────── */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
        {/* Header + live OVR */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <UserPlus size={20} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Quick Add Player</h2>
              <p className="text-sm text-gray-400">Select a position, randomize stats, then save</p>
            </div>
          </div>
          {quickAddOvr !== null && (
            <div className={`flex flex-col items-center px-6 py-3 rounded-xl border shrink-0 ${
              quickAddOvr >= 80 ? 'bg-emerald-500/10 border-emerald-500/30' :
              quickAddOvr >= 60 ? 'bg-amber-500/10 border-amber-500/30' :
              'bg-red-500/10 border-red-500/30'
            }`}>
              <span className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Overall</span>
              <span className={`text-4xl font-black tabular-nums leading-none ${
                quickAddOvr >= 80 ? 'text-emerald-400' : quickAddOvr >= 60 ? 'text-amber-400' : 'text-red-400'
              }`}>{quickAddOvr}</span>
            </div>
          )}
        </div>

        {/* Player identity fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className={LABEL_CLS}>Player ID (Optional)</label>
            <input type="number" value={quickAdd.player_id} onChange={e => setQuickAdd(prev => ({ ...prev, player_id: e.target.value }))} placeholder="Auto-assigned if empty" className={INPUT_CLS} />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL_CLS}>Player Name *</label>
            <input type="text" value={quickAdd.player_name} onChange={e => setQuickAdd(prev => ({ ...prev, player_name: e.target.value }))} placeholder="Full name" className={INPUT_CLS} />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL_CLS}>Team</label>
            <select value={quickAdd.team_id} onChange={e => setQuickAdd(prev => ({ ...prev, team_id: e.target.value }))} className={SELECT_CLS}>
              <option value="">Free Agent</option>
              {allTeams.map(t => <option key={t.id} value={t.id}>{t.team_name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className={LABEL_CLS}>Position *</label>
            <select value={quickAdd.position} onChange={e => setQuickAdd(prev => ({ ...prev, position: e.target.value }))} className={SELECT_CLS}>
              <option value="">Select position</option>
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className={LABEL_CLS}>Age * (16-50)</label>
            <input type="number" min={16} max={50} value={quickAdd.age} onChange={e => setQuickAdd(prev => ({ ...prev, age: e.target.value }))} placeholder="e.g. 22" className={INPUT_CLS} />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL_CLS}>Country *</label>
            <input type="text" value={quickAdd.country} onChange={e => setQuickAdd(prev => ({ ...prev, country: e.target.value }))} placeholder="e.g. Japan" className={INPUT_CLS} />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL_CLS}>Jersey # * (1-99)</label>
            <input type="number" min={1} max={99} value={quickAdd.jersey_number} onChange={e => setQuickAdd(prev => ({ ...prev, jersey_number: e.target.value }))} placeholder="e.g. 7" className={INPUT_CLS} />
          </div>
        </div>

        {/* Position-grouped stat roller */}
        {quickAddGrouping ? (() => {
          const otherKeys = getOtherStats(quickAddGrouping);
          const groups: { title: string; color: string; border: string; weight: string; keys: StatKey[] }[] = [
            { title: 'Main 1', color: 'text-red-400', border: 'border-red-500/30', weight: '40%', keys: [quickAddGrouping.main1] },
            { title: 'Main 2', color: 'text-orange-400', border: 'border-orange-500/30', weight: '35%', keys: [quickAddGrouping.main2] },
            { title: 'Secondary', color: 'text-cyan-400', border: 'border-cyan-500/30', weight: '20%', keys: quickAddGrouping.secondary },
            { title: 'Other', color: 'text-gray-400', border: 'border-white/10', weight: '5%', keys: otherKeys },
          ];
          return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {groups.map(g => (
                <div key={g.title} className={`p-4 rounded-xl bg-white/[0.03] border ${g.border} space-y-3`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className={`text-xs font-bold uppercase tracking-widest ${g.color}`}>{g.title}</h3>
                      <span className="text-[10px] text-gray-600 font-mono">{g.weight}</span>
                    </div>
                    <button
                      onClick={() => randomizeGroup(g.keys)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all
                        bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 ${g.color} cursor-pointer active:scale-95`}
                    >
                      <Shuffle size={12} /> Randomize
                    </button>
                  </div>
                  <div className={`space-y-2.5 ${g.keys.length > 6 ? 'max-h-[320px] overflow-y-auto pr-1' : ''}`}>
                    {g.keys.map(k => (
                      <StatSlider
                        key={k}
                        label={STAT_LABEL[k] ?? k}
                        value={quickAddStats[k] ?? 75}
                        onChange={v => setQuickAddStats(prev => ({ ...prev, [k]: clampStat(v) }))}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })() : (
          <div className="flex flex-col items-center justify-center py-10 text-gray-600 border border-white/5 rounded-xl">
            <UserPlus size={28} className="mb-2 opacity-30" />
            <p className="text-sm">Select a position above to reveal stats</p>
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center gap-4 pt-1">
          <button
            onClick={handleQuickAddPlayer}
            disabled={quickAddLoading || !quickAdd.position}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-black rounded-lg text-sm font-semibold transition-all shadow-lg shadow-amber-500/20 cursor-pointer active:scale-95"
          >
            <UserPlus size={16} />
            {quickAddLoading ? 'Creating...' : 'Add Player'}
          </button>
          <button
            onClick={() => { setQuickAddStats(defaultStats()); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg text-sm font-medium transition-all cursor-pointer"
          >
            <RotateCcw size={14} /> Reset to 75
          </button>
          {quickAddSuccess && <span className="text-sm text-emerald-400 font-medium flex items-center gap-1.5"><CheckCircle2 size={14} /> Player created successfully</span>}
        </div>
      </div>

      {/* ── Player Editor ───────────────────────────────────────────────────── */}
      <div id="player-editor-container" className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
        {/* Header + live overall badge */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
              <SlidersHorizontal size={20} className="text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Player Editor</h2>
              <p className="text-sm text-gray-400">Edit player info and stats — overall recalculates live</p>
            </div>
          </div>
          {editorPlayer && liveOverall !== null && (
            <div className={`flex flex-col items-center px-6 py-3 rounded-xl border shrink-0 ${
              liveOverall >= 80 ? 'bg-emerald-500/10 border-emerald-500/30' :
              liveOverall >= 60 ? 'bg-amber-500/10 border-amber-500/30' :
              'bg-red-500/10 border-red-500/30'
            }`}>
              <span className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Overall</span>
              <span className={`text-4xl font-black tabular-nums leading-none ${
                liveOverall >= 80 ? 'text-emerald-400' : liveOverall >= 60 ? 'text-amber-400' : 'text-red-400'
              }`}>{liveOverall}</span>
              {editorPlayer.overall !== liveOverall && (
                <span className="text-xs text-gray-500 mt-1">was {editorPlayer.overall}</span>
              )}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={editorSearch}
            onChange={e => setEditorSearch(e.target.value)}
            placeholder="Search players by name or position…"
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/20 transition-all"
          />
          {filteredPlayersForEdit.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-white/10 rounded-xl overflow-hidden z-20 shadow-2xl">
              {filteredPlayersForEdit.map(p => (
                <button
                  key={p.id}
                  onClick={() => selectPlayerForEdit(p)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-0"
                >
                  <span className="text-xs font-bold text-amber-400 w-8 shrink-0 tabular-nums">#{p.jersey_number}</span>
                  <span className="text-sm text-white font-medium flex-1 truncate">{p.player_name}</span>
                  <span className="text-xs text-gray-400 shrink-0">{p.position}</span>
                  <span className={`text-xs font-bold tabular-nums px-2 py-0.5 rounded shrink-0 ${
                    p.overall >= 80 ? 'bg-emerald-500/20 text-emerald-400' :
                    p.overall >= 60 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
                  }`}>{p.overall}</span>
                  <span className="text-xs text-gray-500 shrink-0 hidden sm:block">
                    {allTeams.find(t => t.id === p.team_id)?.team_name ?? 'Free Agent'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {editorPlayer ? (
          <>
            {/* Player identity bar */}
            <div className="flex items-center gap-4 py-3 px-4 bg-white/5 rounded-xl border border-white/10">
              <div className="text-2xl font-black text-amber-400 tabular-nums">
                #{editorInfo.jersey_number !== '' ? editorInfo.jersey_number : editorPlayer.jersey_number}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white truncate">{editorInfo.player_name || editorPlayer.player_name}</p>
                <p className="text-sm text-gray-400">
                  {editorInfo.position || editorPlayer.position} • {editorInfo.country || editorPlayer.country} • Age {editorInfo.age !== '' ? editorInfo.age : editorPlayer.age}
                </p>
              </div>
              <div className="text-sm text-gray-400 shrink-0 hidden sm:block">
                {allTeams.find(t => t.id === Number(editorInfo.team_id))?.team_name ?? 'Free Agent'}
              </div>
              <button
                onClick={() => { setEditorPlayer(null); setEditorStats({}); setEditorInfo({}); }}
                className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            {/* ── Info fields ── */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Player Info</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className={LABEL_CLS}>Player ID</label>
                  <input type="number" min={1} value={editorInfo.player_id ?? ''} onChange={e => setEditorInfo((p: RowData) => ({ ...p, player_id: e.target.value }))} className={INPUT_CLS} />
                </div>
                <div className="space-y-1">
                  <label className={LABEL_CLS}>Name</label>
                  <input type="text" value={editorInfo.player_name ?? ''} onChange={e => setEditorInfo((p: RowData) => ({ ...p, player_name: e.target.value }))} className={INPUT_CLS} />
                </div>
                <div className="space-y-1">
                  <label className={LABEL_CLS}>Team</label>
                  <select value={editorInfo.team_id ?? ''} onChange={e => setEditorInfo((p: RowData) => ({ ...p, team_id: e.target.value }))} className={SELECT_CLS}>
                    <option value="">Free Agent</option>
                    {allTeams.map(t => <option key={t.id} value={t.id}>{t.team_name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className={LABEL_CLS}>Position</label>
                  <select value={editorInfo.position ?? ''} onChange={e => setEditorInfo((p: RowData) => ({ ...p, position: e.target.value }))} className={SELECT_CLS}>
                    <option value="">Select…</option>
                    {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className={LABEL_CLS}>Age</label>
                  <input type="number" min={16} max={50} value={editorInfo.age ?? ''} onChange={e => setEditorInfo((p: RowData) => ({ ...p, age: e.target.value }))} className={INPUT_CLS} />
                </div>
                <div className="space-y-1">
                  <label className={LABEL_CLS}>Country</label>
                  <input type="text" value={editorInfo.country ?? ''} onChange={e => setEditorInfo((p: RowData) => ({ ...p, country: e.target.value }))} className={INPUT_CLS} />
                </div>
                <div className="space-y-1">
                  <label className={LABEL_CLS}>Jersey #</label>
                  <input type="number" min={1} max={99} value={editorInfo.jersey_number ?? ''} onChange={e => setEditorInfo((p: RowData) => ({ ...p, jersey_number: e.target.value }))} className={INPUT_CLS} />
                </div>
                <div className="space-y-1">
                  <label className={LABEL_CLS}>Height (cm)</label>
                  <input type="number" min={150} max={230} value={editorInfo.height ?? ''} onChange={e => setEditorInfo((p: RowData) => ({ ...p, height: e.target.value }))} className={INPUT_CLS} />
                </div>
                <div className="space-y-1">
                  <label className={LABEL_CLS}>Potential</label>
                  <input type="number" min={1} max={100} value={editorInfo.potential ?? ''} onChange={e => setEditorInfo((p: RowData) => ({ ...p, potential: e.target.value }))} className={INPUT_CLS} />
                </div>
                <div className="space-y-1">
                  <label className={LABEL_CLS}>Contract Yrs</label>
                  <input type="number" min={1} max={10} value={editorInfo.contract_years ?? ''} onChange={e => setEditorInfo((p: RowData) => ({ ...p, contract_years: e.target.value }))} className={INPUT_CLS} />
                </div>
                <div className="space-y-1">
                  <label className={LABEL_CLS}>Monthly Wage</label>
                  <input type="number" min={0} value={editorInfo.monthly_wage ?? ''} onChange={e => setEditorInfo((p: RowData) => ({ ...p, monthly_wage: e.target.value }))} className={INPUT_CLS} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className={LABEL_CLS}>Player Value</label>
                  <input type="number" min={0} value={editorInfo.player_value ?? ''} onChange={e => setEditorInfo((p: RowData) => ({ ...p, player_value: e.target.value }))} className={INPUT_CLS} />
                </div>
              </div>
            </div>

            {/* ── Stat groups ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {STAT_GROUPS.map(group => (
                <div key={group.label} className={`space-y-3 p-4 rounded-xl bg-white/[0.03] border ${group.borderClass}`}>
                  <h3 className={`text-xs font-bold uppercase tracking-widest ${group.headerClass}`}>{group.label}</h3>
                  <div className="space-y-3">
                    {group.stats.map(stat => (
                      <StatSlider
                        key={stat.key}
                        label={stat.label}
                        value={editorStats[stat.key] ?? 50}
                        onChange={v => setEditorStats(prev => ({ ...prev, [stat.key]: v }))}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Save / Delete bar */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSavePlayer}
                  disabled={editorSaving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-all shadow-lg shadow-purple-500/20 cursor-pointer"
                >
                  <Save size={16} />
                  {editorSaving ? 'Saving…' : 'Save Player'}
                </button>
                {editorSuccess && <span className="text-sm text-emerald-400 font-medium flex items-center gap-1"><CheckCircle2 size={14} /> Saved</span>}
              </div>
              {/* Delete — confirm-then-act pattern */}
              {!deleteConfirm ? (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 hover:border-red-500/50 text-red-400 rounded-lg text-sm font-semibold transition-all cursor-pointer"
                >
                  <Trash2 size={15} /> Delete Player
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-400 font-semibold">Permanently delete {editorPlayer?.player_name}?</span>
                  <button
                    onClick={handleDeletePlayer}
                    disabled={deleting}
                    className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg text-sm font-bold transition-all cursor-pointer"
                  >
                    <Trash2 size={14} /> {deleting ? 'Deleting…' : 'Confirm Delete'}
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(false)}
                    className="px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 rounded-lg text-sm transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-gray-600">
            <SlidersHorizontal size={36} className="mb-3 opacity-30" />
            <p className="text-sm">Search for a player above to start editing</p>
          </div>
        )}
      </div>

      {/* ── Stat Presets ─────────────────────────────────────────────────────── */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-500/10 rounded-lg border border-violet-500/20">
              <Bookmark size={20} className="text-violet-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Stat Presets</h2>
              <p className="text-sm text-gray-400">Save position + stat builds and load them instantly when batch-adding players</p>
            </div>
          </div>
          <button
            onClick={openNewPreset}
            className="flex items-center gap-2 px-4 py-2 bg-violet-500/10 border border-violet-500/30 hover:bg-violet-500/20 text-violet-400 rounded-lg text-sm font-semibold transition-all cursor-pointer active:scale-95 shrink-0"
          >
            <BookmarkPlus size={16} /> New Preset
          </button>
        </div>

        {/* Preset cards grid */}
        {presets.length === 0 && !presetEditor ? (
          <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-white/10 rounded-xl text-gray-600">
            <Bookmark size={32} className="mb-3 opacity-20" />
            <p className="text-sm">No presets yet — click "New Preset" to create your first build</p>
          </div>
        ) : presets.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {presets.map(preset => {
              const pc = POSITION_COLORS[preset.position];
              const ovr = preset.position ? calculateOverall(preset.stats, preset.position) : 0;
              const isEditing = presetEditor?.id === preset.id;
              return (
                <div
                  key={preset.id}
                  className={`relative border-l-4 ${pc?.border ?? 'border-l-white/20'} bg-white/[0.04] border border-white/10 rounded-xl p-4 space-y-3 transition-all ${isEditing ? 'ring-1 ring-violet-500/40 bg-violet-500/5' : 'hover:bg-white/[0.06]'}`}
                >
                  {/* Top row: name + OVR */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-white text-sm leading-tight truncate">{preset.name}</p>
                      <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${pc?.badge ?? 'bg-white/10 text-gray-400 border-white/10'}`}>
                        {preset.position}
                      </span>
                    </div>
                    <div className={`flex flex-col items-center px-3 py-1.5 rounded-lg shrink-0 ${
                      ovr >= 80 ? 'bg-emerald-500/10 border border-emerald-500/20' :
                      ovr >= 60 ? 'bg-amber-500/10 border border-amber-500/20' :
                      'bg-red-500/10 border border-red-500/20'
                    }`}>
                      <span className="text-[9px] text-gray-500 uppercase tracking-wider leading-none mb-0.5">OVR</span>
                      <span className={`text-xl font-black tabular-nums leading-none ${ovr >= 80 ? 'text-emerald-400' : ovr >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{ovr}</span>
                    </div>
                  </div>

                  {/* Core stat mini-bars */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {CORE_STAT_KEYS.map(k => {
                      const v = preset.stats[k] ?? 75;
                      const barColor = pc?.accent ?? 'rgb(245 158 11)';
                      return (
                        <div key={k} className="flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-500 w-7 shrink-0 uppercase font-mono">{k.slice(0, 3).toUpperCase()}</span>
                          <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${v}%`, background: barColor, opacity: 0.7 }} />
                          </div>
                          <span className={`text-[10px] tabular-nums font-semibold w-5 text-right ${v >= 80 ? 'text-emerald-400' : v >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{v}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                    <button
                      onClick={() => isEditing ? setPresetEditor(null) : openEditPreset(preset)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        isEditing
                          ? 'bg-violet-500/20 border border-violet-500/40 text-violet-300'
                          : 'bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300'
                      }`}
                    >
                      <Pencil size={11} /> {isEditing ? 'Editing…' : 'Edit'}
                    </button>
                    <button
                      onClick={() => handleDeletePreset(preset.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/5 border border-red-500/20 hover:bg-red-500/15 text-red-400 transition-all cursor-pointer"
                    >
                      <Trash2 size={11} /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Preset Editor panel */}
        {presetEditor && (
          <div className="border border-violet-500/20 bg-violet-500/5 rounded-2xl p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-violet-300 uppercase tracking-wider">
                {presetEditor.id ? 'Edit Preset' : 'New Preset'}
              </h3>
              <button onClick={() => setPresetEditor(null)} className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer">
                <X size={15} />
              </button>
            </div>

            {/* Name + Position */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={LABEL_CLS}>Preset Name *</label>
                <input
                  type="text"
                  value={presetEditor.name}
                  onChange={e => setPresetEditor(prev => prev ? { ...prev, name: e.target.value } : null)}
                  placeholder="e.g. Attacking Setter"
                  className="w-full px-3 py-2 bg-white/5 border border-violet-500/20 rounded-lg text-sm text-white placeholder-gray-600 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/20 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className={LABEL_CLS}>Position *</label>
                <select
                  value={presetEditor.position}
                  onChange={e => setPresetEditor(prev => prev ? { ...prev, position: e.target.value } : null)}
                  className="w-full px-3 py-2 bg-[#1a1a2e] border border-violet-500/20 rounded-lg text-sm text-white focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/20 transition-all"
                >
                  <option value="">Select position</option>
                  {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            {/* Live OVR preview */}
            {presetEditor.position && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">Live Overall:</span>
                {(() => {
                  const ovr = calculateOverall(presetEditor.stats, presetEditor.position);
                  return (
                    <span className={`text-2xl font-black tabular-nums ${ovr >= 80 ? 'text-emerald-400' : ovr >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{ovr}</span>
                  );
                })()}
              </div>
            )}

            {/* Position-grouped stat sliders */}
            {presetEditor.position ? (() => {
              const grouping = POSITION_GROUPINGS[presetEditor.position] ?? null;
              if (!grouping) return null;
              const otherKeys = getOtherStats(grouping);
              const groups: { title: string; color: string; border: string; weight: string; keys: StatKey[] }[] = [
                { title: 'Main 1',    color: 'text-red-400',    border: 'border-red-500/30',    weight: '40%', keys: [grouping.main1] },
                { title: 'Main 2',    color: 'text-orange-400', border: 'border-orange-500/30', weight: '35%', keys: [grouping.main2] },
                { title: 'Secondary', color: 'text-cyan-400',   border: 'border-cyan-500/30',   weight: '20%', keys: grouping.secondary },
                { title: 'Other',     color: 'text-gray-400',   border: 'border-white/10',      weight: '5%',  keys: otherKeys },
              ];
              return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {groups.map(g => (
                    <div key={g.title} className={`p-4 rounded-xl bg-white/[0.03] border ${g.border} space-y-3`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h4 className={`text-xs font-bold uppercase tracking-widest ${g.color}`}>{g.title}</h4>
                          <span className="text-[10px] text-gray-600 font-mono">{g.weight}</span>
                        </div>
                        <button
                          onClick={() => setPresetEditor(prev => {
                            if (!prev) return null;
                            const next = { ...prev.stats };
                            for (const k of g.keys) next[k] = nudgeStat(prev.stats[k] ?? 75);
                            return { ...prev, stats: next };
                          })}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 hover:bg-white/10 ${g.color} cursor-pointer active:scale-95`}
                        >
                          <Shuffle size={12} /> Randomize
                        </button>
                      </div>
                      <div className={`space-y-2.5 ${g.keys.length > 6 ? 'max-h-[320px] overflow-y-auto pr-1' : ''}`}>
                        {g.keys.map(k => (
                          <StatSlider
                            key={k}
                            label={STAT_LABEL[k] ?? k}
                            value={presetEditor.stats[k] ?? 75}
                            onChange={v => setPresetEditor(prev => prev ? { ...prev, stats: { ...prev.stats, [k]: clampStat(v) } } : null)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })() : (
              <div className="flex flex-col items-center justify-center py-8 border border-dashed border-white/10 rounded-xl text-gray-600">
                <p className="text-sm">Select a position above to configure stats</p>
              </div>
            )}

            {/* Save / Cancel */}
            <div className="flex items-center gap-3 pt-1 border-t border-white/10">
              <button
                onClick={handleSavePreset}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400 text-white rounded-lg text-sm font-semibold transition-all shadow-lg shadow-violet-500/20 cursor-pointer active:scale-95"
              >
                <Bookmark size={15} /> {presetEditor.id ? 'Update Preset' : 'Save Preset'}
              </button>
              <button
                onClick={() => setPresetEditor(null)}
                className="px-4 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 rounded-lg text-sm font-medium transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Batch Add Queue ──────────────────────────────────────────────────── */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg border border-green-500/20">
              <Users size={20} className="text-green-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Batch Add Queue</h2>
              <p className="text-sm text-gray-400">Queue multiple players, expand any row to fine-tune stats, then submit all at once</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {presets.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setAddFromPresetOpen(o => !o)}
                  className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-semibold transition-all cursor-pointer active:scale-95 ${addFromPresetOpen ? 'bg-violet-500/20 border-violet-500/40 text-violet-300' : 'bg-violet-500/10 border-violet-500/30 hover:bg-violet-500/20 text-violet-400'}`}
                >
                  <BookmarkPlus size={16} /> From Preset
                </button>
                {addFromPresetOpen && (
                  <div className="absolute right-0 top-full mt-1 w-64 bg-[#13131f] border border-violet-500/20 rounded-xl shadow-2xl z-30 overflow-hidden">
                    <p className="px-3 py-2 text-[10px] font-bold text-violet-400 uppercase tracking-wider border-b border-white/10">Add Row from Preset</p>
                    {presets.map(preset => {
                      const pc = POSITION_COLORS[preset.position];
                      const ovr = preset.position ? calculateOverall(preset.stats, preset.position) : 0;
                      return (
                        <button
                          key={preset.id}
                          onClick={() => addRowFromPreset(preset)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-0"
                        >
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${pc?.text.replace('text-', 'bg-') ?? 'bg-gray-400'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-white truncate">{preset.name}</p>
                            <p className="text-[10px] text-gray-500">{preset.position}</p>
                          </div>
                          <span className={`text-xs font-black tabular-nums shrink-0 ${ovr >= 80 ? 'text-emerald-400' : ovr >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{ovr}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => setBatchRows(prev => [...prev, newBatchRow()])}
              className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 text-green-400 rounded-lg text-sm font-semibold transition-all cursor-pointer active:scale-95"
            >
              <Plus size={16} /> Add Row
            </button>
          </div>
        </div>

        {batchRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-white/10 rounded-xl text-gray-600">
            <Users size={32} className="mb-3 opacity-20" />
            <p className="text-sm">No players in queue — click "Add Row" to start</p>
          </div>
        ) : (
          <div className="space-y-2">
            {batchRows.map((row, idx) => {
              const grouping = POSITION_GROUPINGS[row.info.position] ?? null;
              const ovr = grouping ? calculateOverall(row.stats, row.info.position) : null;
              const otherKeys = grouping ? getOtherStats(grouping) : [];
              const statGroups: { title: string; color: string; border: string; weight: string; keys: StatKey[] }[] = grouping ? [
                { title: 'Main 1',    color: 'text-red-400',    border: 'border-red-500/30',    weight: '40%', keys: [grouping.main1] },
                { title: 'Main 2',    color: 'text-orange-400', border: 'border-orange-500/30', weight: '35%', keys: [grouping.main2] },
                { title: 'Secondary', color: 'text-cyan-400',   border: 'border-cyan-500/30',   weight: '20%', keys: grouping.secondary },
                { title: 'Other',     color: 'text-gray-400',   border: 'border-white/10',      weight: '5%',  keys: otherKeys },
              ] : [];

              return (
                <div key={row.rowId} className="border border-white/10 rounded-xl overflow-hidden">
                  {/* Compact info row */}
                  <div className="flex items-center gap-2 p-3 bg-white/[0.03]">
                    <span className="text-xs text-gray-600 w-5 text-center shrink-0 tabular-nums">{idx + 1}</span>

                    <input
                      type="number"
                      min={1}
                      value={row.info.player_id}
                      onChange={e => updateBatchRowInfo(row.rowId, 'player_id', e.target.value)}
                      placeholder="ID"
                      className="w-14 px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:border-green-500/50 focus:outline-none transition-all shrink-0"
                    />

                    <input
                      type="text"
                      value={row.info.player_name}
                      onChange={e => updateBatchRowInfo(row.rowId, 'player_name', e.target.value)}
                      placeholder="Player name *"
                      className="flex-1 min-w-[110px] px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:border-green-500/50 focus:outline-none focus:ring-1 focus:ring-green-500/20 transition-all"
                    />

                    <select
                      value={row.info.position}
                      onChange={e => updateBatchRowInfo(row.rowId, 'position', e.target.value)}
                      className="w-36 px-2 py-1.5 bg-[#1a1a2e] border border-white/10 rounded-lg text-sm text-white focus:border-green-500/50 focus:outline-none transition-all shrink-0"
                    >
                      <option value="">Position *</option>
                      {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>

                    <input
                      type="number"
                      min={16} max={50}
                      value={row.info.age}
                      onChange={e => updateBatchRowInfo(row.rowId, 'age', e.target.value)}
                      placeholder="Age *"
                      className="w-16 px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:border-green-500/50 focus:outline-none transition-all shrink-0"
                    />

                    <input
                      type="text"
                      value={row.info.country}
                      onChange={e => updateBatchRowInfo(row.rowId, 'country', e.target.value)}
                      placeholder="Country *"
                      className="w-24 px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:border-green-500/50 focus:outline-none transition-all shrink-0"
                    />

                    <input
                      type="number"
                      min={1} max={99}
                      value={row.info.jersey_number}
                      onChange={e => updateBatchRowInfo(row.rowId, 'jersey_number', e.target.value)}
                      placeholder="# *"
                      className="w-14 px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:border-green-500/50 focus:outline-none transition-all shrink-0"
                    />

                    <select
                      value={row.info.team_id}
                      onChange={e => updateBatchRowInfo(row.rowId, 'team_id', e.target.value)}
                      className="w-32 px-2 py-1.5 bg-[#1a1a2e] border border-white/10 rounded-lg text-sm text-white focus:border-green-500/50 focus:outline-none transition-all shrink-0 hidden sm:block"
                    >
                      <option value="">Free Agent</option>
                      {allTeams.map(t => <option key={t.id} value={t.id}>{t.team_name}</option>)}
                    </select>

                    {ovr !== null && (
                      <span className={`text-sm font-black tabular-nums w-8 text-center shrink-0 ${ovr >= 80 ? 'text-emerald-400' : ovr >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                        {ovr}
                      </span>
                    )}

                    <div className="flex items-center gap-1 shrink-0 relative">
                      {/* Preset loader */}
                      {presets.length > 0 && (
                        <div className="relative">
                          <button
                            onClick={() => setBatchPresetOpen(batchPresetOpen === row.rowId ? null : row.rowId)}
                            title="Load preset"
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer text-xs font-bold ${batchPresetOpen === row.rowId ? 'text-violet-400 bg-violet-500/15' : 'text-gray-500 hover:text-violet-400 hover:bg-violet-500/10'}`}
                          >
                            <Bookmark size={13} />
                          </button>
                          {batchPresetOpen === row.rowId && (
                            <div className="absolute right-0 top-full mt-1 w-56 bg-[#13131f] border border-violet-500/20 rounded-xl shadow-2xl z-30 overflow-hidden">
                              <p className="px-3 py-2 text-[10px] font-bold text-violet-400 uppercase tracking-wider border-b border-white/10">Load Preset</p>
                              {presets.map(preset => {
                                const pc = POSITION_COLORS[preset.position];
                                const ovr = preset.position ? calculateOverall(preset.stats, preset.position) : 0;
                                return (
                                  <button
                                    key={preset.id}
                                    onClick={() => applyPresetToBatchRow(row.rowId, preset)}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-0"
                                  >
                                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${pc?.text.replace('text-', 'bg-') ?? 'bg-gray-400'}`} />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-semibold text-white truncate">{preset.name}</p>
                                      <p className="text-[10px] text-gray-500">{preset.position}</p>
                                    </div>
                                    <span className={`text-xs font-black tabular-nums shrink-0 ${ovr >= 80 ? 'text-emerald-400' : ovr >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{ovr}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                      <button
                        onClick={() => duplicateBatchRow(row.rowId)}
                        title="Duplicate row"
                        className="p-1.5 text-gray-500 hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors cursor-pointer"
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        onClick={() => toggleBatchRow(row.rowId)}
                        title={row.expanded ? 'Collapse stats' : 'Expand stats'}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${row.expanded ? 'text-green-400 bg-green-500/10' : 'text-gray-500 hover:text-green-400 hover:bg-green-500/10'}`}
                      >
                        {row.expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                      <button
                        onClick={() => removeBatchRow(row.rowId)}
                        title="Remove row"
                        className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded stats */}
                  {row.expanded && (
                    <div className="p-4 border-t border-white/10 bg-white/[0.02]">
                      {grouping ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {statGroups.map(g => (
                            <div key={g.title} className={`p-4 rounded-xl bg-white/[0.03] border ${g.border} space-y-3`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <h3 className={`text-xs font-bold uppercase tracking-widest ${g.color}`}>{g.title}</h3>
                                  <span className="text-[10px] text-gray-600 font-mono">{g.weight}</span>
                                </div>
                                <button
                                  onClick={() => randomizeBatchGroup(row.rowId, g.keys)}
                                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 ${g.color} cursor-pointer active:scale-95`}
                                >
                                  <Shuffle size={12} /> Randomize
                                </button>
                              </div>
                              <div className={`space-y-2.5 ${g.keys.length > 6 ? 'max-h-[320px] overflow-y-auto pr-1' : ''}`}>
                                {g.keys.map(k => (
                                  <StatSlider
                                    key={k}
                                    label={STAT_LABEL[k] ?? k}
                                    value={row.stats[k] ?? 75}
                                    onChange={v => updateBatchRowStat(row.rowId, k, v)}
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600 text-center py-4">Select a position above to tune stats</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Submit bar */}
        {batchRows.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/10">
            <button
              onClick={handleBatchSubmit}
              disabled={batchSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 disabled:opacity-50 text-black rounded-lg text-sm font-semibold transition-all shadow-lg shadow-green-500/20 cursor-pointer active:scale-95"
            >
              {batchSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
              {batchSubmitting ? 'Creating players…' : `Add ${batchRows.length} Player${batchRows.length !== 1 ? 's' : ''}`}
            </button>
            <button
              onClick={() => { setBatchRows([]); setBatchResults(null); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg text-sm font-medium transition-all cursor-pointer"
            >
              <X size={14} /> Clear All
            </button>
            <span className="text-xs text-gray-600">{batchRows.length} player{batchRows.length !== 1 ? 's' : ''} queued</span>
          </div>
        )}

        {/* Results */}
        {batchResults && (
          <div className="space-y-3">
            <div className={`p-4 rounded-lg border ${batchResults.every(r => r.success) ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
              <div className="flex items-center justify-between mb-1">
                <p className={`text-sm font-semibold ${batchResults.every(r => r.success) ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {batchResults.filter(r => r.success).length} of {batchResults.length} players created
                </p>
                {batchResults.some(r => !r.success) && (
                  <span className="text-xs text-red-400">{batchResults.filter(r => !r.success).length} failed — rows kept in queue</span>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 px-3 text-xs font-bold text-gray-400 uppercase">Player</th>
                    <th className="text-left py-2 px-3 text-xs font-bold text-gray-400 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {batchResults.map((r, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/[0.03]">
                      <td className="py-2 px-3 text-white">{r.name}</td>
                      <td className="py-2 px-3">
                        {r.success
                          ? <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-semibold"><CheckCircle2 size={12} /> Created</span>
                          : <span className="inline-flex items-center gap-1 text-red-400 text-xs font-semibold"><AlertCircle size={12} /> {r.error}</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={() => setBatchResults(null)}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 rounded-lg text-sm font-medium transition-all cursor-pointer"
            >
              Clear Results
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
