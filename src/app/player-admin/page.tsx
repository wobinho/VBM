'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, SlidersHorizontal, UserPlus, RotateCcw, CheckCircle2, Loader2, Shuffle, Save, X, Trash2, Upload, AlertCircle, Download } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { calculateOverall, POSITION_GROUPINGS, getOtherStats, ALL_STAT_KEYS, type StatKey } from '@/lib/overall';
import { Lock } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface RowData { [key: string]: any; }

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

  // Bulk Import
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResults, setBulkResults] = useState<any>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

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
    const payload = {
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
    };
    try {
      const res = await fetch(`/api/players/${editorPlayer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated = { ...editorPlayer, ...payload };
        setEditorPlayer(updated);
        setAllPlayers(prev => prev.map(p => p.id === editorPlayer.id ? { ...p, ...payload } : p));
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

  // ── Bulk Import ─────────────────────────────────────────────────────────────
  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkImporting(true);
    setBulkError(null);
    setBulkResults(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const res = await fetch('/api/players/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        setBulkError(result.error || 'Import failed');
      } else {
        setBulkResults(result);
        await refreshPlayers();
      }
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : 'Failed to parse JSON file');
    } finally {
      setBulkImporting(false);
      // Reset the input
      if (e.target) e.target.value = '';
    }
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

      {/* ── Bulk Import ──────────────────────────────────────────────────────── */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <Upload size={20} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Bulk Import Players</h2>
            <p className="text-sm text-gray-400">Import players from a JSON file created with the VBM player builder</p>
          </div>
        </div>

        {/* Upload area */}
        <div className="relative">
          <input
            type="file"
            accept=".json"
            onChange={handleBulkImport}
            disabled={bulkImporting}
            className="hidden"
            id="bulk-import-input"
          />
          <label
            htmlFor="bulk-import-input"
            className={`flex items-center justify-center gap-3 p-8 border-2 border-dashed rounded-xl transition-all cursor-pointer ${
              bulkImporting
                ? 'border-gray-600 bg-white/[0.02]'
                : 'border-blue-500/30 bg-blue-500/5 hover:border-blue-500/50 hover:bg-blue-500/10'
            }`}
          >
            <div className="text-center">
              {bulkImporting ? (
                <>
                  <Loader2 size={24} className="text-blue-400 mb-2 animate-spin mx-auto" />
                  <p className="text-sm text-white font-medium">Processing import...</p>
                </>
              ) : (
                <>
                  <Download size={24} className="text-blue-400 mb-2 mx-auto" />
                  <p className="text-sm text-white font-medium">Click to select JSON file</p>
                  <p className="text-xs text-gray-400 mt-1">or drag and drop</p>
                </>
              )}
            </div>
          </label>
        </div>

        {/* Error display */}
        {bulkError && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-3">
            <AlertCircle size={18} className="text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-400">Import Failed</p>
              <p className="text-sm text-red-300 mt-1">{bulkError}</p>
            </div>
          </div>
        )}

        {/* Results display */}
        {bulkResults && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-emerald-400">Import Successful</p>
                <span className={`text-2xl font-bold ${bulkResults.created > 0 ? 'text-emerald-400' : 'text-gray-400'}`}>
                  +{bulkResults.created}
                </span>
              </div>
              <p className="text-xs text-emerald-300">
                Created {bulkResults.created} player{bulkResults.created !== 1 ? 's' : ''}
                {bulkResults.failed > 0 && ` • ${bulkResults.failed} failed`}
              </p>
            </div>

            {/* Success results table */}
            {bulkResults.results && bulkResults.results.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-2 px-3 text-xs font-bold text-gray-400 uppercase">Player</th>
                      <th className="text-left py-2 px-3 text-xs font-bold text-gray-400 uppercase">ID</th>
                      <th className="text-left py-2 px-3 text-xs font-bold text-gray-400 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkResults.results.map((r: any, i: number) => (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/[0.03]">
                        <td className="py-2 px-3 text-white">{r.player_name}</td>
                        <td className="py-2 px-3 text-gray-400">#{r.player_id}</td>
                        <td className="py-2 px-3">
                          <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                            <CheckCircle2 size={12} /> Created
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Error results table */}
            {bulkResults.errors && bulkResults.errors.length > 0 && (
              <div className="overflow-x-auto">
                <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2">Failed Imports</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-red-500/20">
                      <th className="text-left py-2 px-3 text-xs font-bold text-gray-400 uppercase">Player</th>
                      <th className="text-left py-2 px-3 text-xs font-bold text-gray-400 uppercase">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkResults.errors.map((err: any, i: number) => (
                      <tr key={i} className="border-b border-red-500/10">
                        <td className="py-2 px-3 text-white">{err.player_name}</td>
                        <td className="py-2 px-3 text-red-400 text-xs">{err.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <button
              onClick={() => { setBulkResults(null); setBulkError(null); }}
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
