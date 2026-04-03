'use client';
import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Edit2, Save, X, ArrowRight, Eye, EyeOff, Search, SlidersHorizontal, UserPlus, Database } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { getCountryName, getCountryCode } from '@/lib/country-codes';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Column {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: null | string;
  pk: number;
}
interface Table { name: string; columns: Column[]; rowCount: number; }
interface RowData { [key: string]: any; }

// ── Column visibility config ──────────────────────────────────────────────────
// Players table: show ALL columns (we handle them all properly now)
const DISPLAY_COLUMNS: Record<string, string[]> = {
  leagues:   ['id', 'league_name', 'nation'],
  teams:     ['id', 'team_name', 'league_id', 'nation', 'team_money', 'played', 'won', 'lost', 'points', 'goal_diff'],
  players:   [
    'id', 'player_name', 'team_id', 'position', 'age', 'country', 'jersey_number', 'height', 'potential', 'overall',
    'attack', 'defense', 'serve', 'block', 'receive', 'setting',
    'precision', 'flair', 'digging', 'positioning', 'ball_control', 'technique', 'playmaking', 'spin',
    'speed', 'agility', 'strength', 'endurance', 'vertical', 'flexibility', 'torque', 'balance',
    'leadership', 'teamwork', 'concentration', 'pressure', 'consistency', 'vision', 'game_iq', 'intimidation',
    'contract_years', 'monthly_wage', 'player_value',
  ],
  users:     ['id', 'username', 'email', 'display_name', 'is_admin', 'is_active'],
  transfers: ['id', 'player_id', 'from_team', 'to_team', 'price', 'transfer_date', 'status'],
};

// Columns that render as a <select> pointing to another table
const SELECT_COLUMNS: Record<string, Record<string, string>> = {
  teams:     { league_id: 'leagues' },
  players:   { team_id: 'teams' },
  transfers: { player_id: 'players', from_team: 'teams', to_team: 'teams' },
};
const FOREIGN_KEY_DISPLAY: Record<string, Record<string, string>> = {
  teams:     { league_id: 'league_name' },
  players:   { team_id: 'team_name' },
  transfers: { player_id: 'player_name', from_team: 'team_name', to_team: 'team_name' },
};

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

// ── Overall calculation — must match queries.ts exactly ───────────────────────
// Core 55% (position-weighted) + Technical 15% + Physical 15% + Mental 15%
function coreSkillByPosition(position: string, s: Record<string, number>): number {
  const { attack: a, defense: d, serve: sv, block: b, receive: r, setting: st } = s;
  switch (position) {
    case 'Libero':           return r * 0.40 + d * 0.40 + st * 0.20;
    case 'Setter':           return st * 0.50 + a * 0.10 + d * 0.10 + sv * 0.10 + b * 0.10;
    case 'Middle Blocker':   return a * 0.30 + d * 0.30 + b * 0.25 + sv * 0.10 + st * 0.05;
    case 'Outside Hitter':
    case 'Opposite Hitter':  return a * 0.25 + d * 0.25 + sv * 0.15 + b * 0.15 + r * 0.15 + st * 0.05;
    default:                 return (a + d + sv + b + r + st) / 6;
  }
}

function calculateOverall(s: Record<string, number>, position: string): number {
  const core = coreSkillByPosition(position, s);
  const technical =
    (s.precision + s.flair + s.digging + s.positioning +
     s.ball_control + s.technique + s.playmaking + s.spin) / 8;
  const physical =
    (s.speed + s.agility + s.strength + s.endurance +
     s.vertical + s.flexibility + s.torque + s.balance) / 8;
  const mental =
    (s.leadership + s.teamwork + s.concentration + s.pressure +
     s.consistency + s.vision + s.game_iq + s.intimidation) / 8;
  return Math.min(99, Math.max(1, Math.round(
    core * 0.55 + technical * 0.15 + physical * 0.15 + mental * 0.15
  )));
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

const INPUT_CLS = 'w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-all';
const SELECT_CLS = 'w-full px-3 py-2 bg-[#1a1a2e] border border-white/10 rounded-lg text-sm text-white focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-all';
const LABEL_CLS = 'text-xs font-semibold text-gray-400 uppercase tracking-wider';

const DEFAULT_QUICK_ADD = { player_id: '', player_name: '', team_id: '', position: '', age: '', country: '', jersey_number: '' };

// ── Main Component ────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { isAdmin } = useAuth();

  // Table browser state
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<RowData>({});
  const [newRow, setNewRow] = useState<RowData>({});
  const [showAddForm, setShowAddForm] = useState(false);

  // Reference data
  const [allPlayers, setAllPlayers] = useState<RowData[]>([]);
  const [allTeams, setAllTeams] = useState<RowData[]>([]);
  const [referenceData, setReferenceData] = useState<Record<string, RowData[]>>({});
  const [showPasswords, setShowPasswords] = useState<Record<number, boolean>>({});

  // Transfer modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferData, setTransferData] = useState({ playerId: '', fromTeam: '', toTeam: '', price: '', date: new Date().toISOString().split('T')[0] });

  // Quick Add Player
  const [quickAdd, setQuickAdd] = useState(DEFAULT_QUICK_ADD);
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [quickAddSuccess, setQuickAddSuccess] = useState(false);

  // Player Editor
  const [editorSearch, setEditorSearch] = useState('');
  const [editorPlayer, setEditorPlayer] = useState<RowData | null>(null);
  const [editorInfo, setEditorInfo] = useState<RowData>({});
  const [editorStats, setEditorStats] = useState<Record<string, number>>({});
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorSuccess, setEditorSuccess] = useState(false);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="text-6xl">🔒</div>
        <h2 className="text-2xl font-bold text-white">Access Denied</h2>
        <p className="text-gray-400">You do not have admin privileges.</p>
      </div>
    );
  }

  // ── Data fetching ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetchTables();
    loadReferenceData();
  }, []);

  const loadReferenceData = async () => {
    const refs: Record<string, RowData[]> = {};
    for (const table of ['players', 'teams', 'leagues']) {
      try {
        const res = await fetch(`/api/admin/table/${table}`);
        if (res.ok) refs[table] = await res.json();
        else refs[table] = [];
      } catch { refs[table] = []; }
    }
    setReferenceData(refs);
    setAllPlayers(refs.players ?? []);
    setAllTeams(refs.teams ?? []);
  };

  const fetchTables = async () => {
    try {
      const res = await fetch('/api/admin/tables');
      if (res.ok) { const d = await res.json(); if (Array.isArray(d)) setTables(d); }
    } catch {}
  };

  const fetchTableData = async (tableName: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/table/${tableName}`);
      const data = await res.json();
      setTableData(res.ok && Array.isArray(data) ? data : []);
      setSelectedTable(tableName);
      setEditingRow(null);
      setShowAddForm(false);
    } catch { setTableData([]); }
    setLoading(false);
  };

  const refreshPlayers = async () => {
    try {
      const res = await fetch('/api/admin/table/players');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setAllPlayers(data);
          setReferenceData(prev => ({ ...prev, players: data }));
        }
      }
    } catch {}
  };

  const handleEdit = (rowIndex: number, row: RowData) => {
    if (selectedTable === 'players') {
      selectPlayerForEdit(row);
      setTimeout(() => {
        document.getElementById('player-editor-container')?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
      return;
    }
    setEditingRow(rowIndex);
    setEditValues({ ...row });
  };

  const handleSave = async (rowIndex: number, row: RowData) => {
    if (!selectedTable) return;
    // Strip read-only / joined fields
    const body: RowData = {};
    for (const [k, v] of Object.entries(editValues)) {
      if (k !== 'id' && k !== 'created_at' && k !== 'updated_at' && k !== 'team_name' && k !== 'league_name' && k !== 'team_country') {
        body[k] = v;
      }
    }
    try {
      const res = await fetch(`/api/admin/table/${selectedTable}/${row.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated = [...tableData];
        updated[rowIndex] = { ...row, ...editValues };
        setTableData(updated);
        setEditingRow(null);
        if (selectedTable === 'players') {
          setAllPlayers(prev => prev.map(p => p.id === row.id ? { ...p, ...body } : p));
          setReferenceData(prev => ({ ...prev, players: (prev.players ?? []).map(p => p.id === row.id ? { ...p, ...body } : p) }));
        }
      } else {
        const err = await res.json().catch(() => ({}));
        alert('Save failed: ' + (err.error ?? res.statusText));
      }
    } catch { alert('Error saving row'); }
  };

  const handleDelete = async (rowIndex: number, row: RowData) => {
    if (!selectedTable || !confirm('Delete this row?')) return;
    try {
      const res = await fetch(`/api/admin/table/${selectedTable}/${row.id}`, { method: 'DELETE' });
      if (res.ok) setTableData(tableData.filter((_, i) => i !== rowIndex));
    } catch { alert('Error deleting row'); }
  };

  const handleAddRow = async () => {
    if (!selectedTable) return;
    try {
      const res = await fetch(`/api/admin/table/${selectedTable}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRow),
      });
      if (res.ok) { fetchTableData(selectedTable); setNewRow({}); setShowAddForm(false); }
      else { const e = await res.json().catch(() => ({})); alert('Error: ' + (e.error ?? 'Failed to create row')); }
    } catch { alert('Error adding row'); }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const getVisibleColumns = (tableName: string, allColumns: Column[]) => {
    const display = DISPLAY_COLUMNS[tableName];
    if (!display) return allColumns;
    return display
      .map(name => allColumns.find(c => c.name === name))
      .filter(Boolean) as Column[];
  };

  const getSelectOptions = (tableName: string, columnName: string): RowData[] => {
    const ref = SELECT_COLUMNS[tableName]?.[columnName];
    return ref ? (referenceData[ref] ?? []) : [];
  };

  const getSelectLabel = (tableName: string, columnName: string): string =>
    FOREIGN_KEY_DISPLAY[tableName]?.[columnName] ?? 'name';

  const currentTable = tables.find(t => t.name === selectedTable);

  // ── Transfer ────────────────────────────────────────────────────────────────
  const handleTransfer = async () => {
    if (!transferData.playerId || !transferData.toTeam) {
      alert('Please select both player and destination team'); return;
    }
    try {
      const res = await fetch('/api/admin/table/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: parseInt(transferData.playerId),
          from_team: transferData.fromTeam ? parseInt(transferData.fromTeam) : null,
          to_team: parseInt(transferData.toTeam),
          price: transferData.price ? parseFloat(transferData.price) : 0,
          transfer_date: transferData.date,
          status: 'pending',
        }),
      });
      if (res.ok) {
        alert('Transfer created successfully!');
        setShowTransferModal(false);
        setTransferData({ playerId: '', fromTeam: '', toTeam: '', price: '', date: new Date().toISOString().split('T')[0] });
        if (selectedTable === 'transfers') fetchTableData('transfers');
      } else { alert('Error creating transfer'); }
    } catch { alert('Error creating transfer'); }
  };

  // ── Quick Add Player ────────────────────────────────────────────────────────
  const handleQuickAddPlayer = async () => {
    const { player_id, player_name, position, age, country, jersey_number } = quickAdd;
    if (!player_name || !position || !age || !country || !jersey_number) {
      alert('Please fill in all required fields (name, position, age, country, jersey number)'); return;
    }
    setQuickAddLoading(true);
    const ageNum = parseInt(age), jerseyNum = parseInt(jersey_number);
    const payload = {
      ...(player_id ? { id: parseInt(player_id) } : {}),
      player_name, position, age: ageNum, country, jersey_number: jerseyNum,
      team_id: quickAdd.team_id ? parseInt(quickAdd.team_id) : null,
      overall: 50,
      attack: 50, defense: 50, serve: 50, block: 50, receive: 50, setting: 50,
      precision: 50, flair: 50, digging: 50, positioning: 50, ball_control: 50, technique: 50, playmaking: 50, spin: 50,
      speed: 50, agility: 50, strength: 50, endurance: 50, vertical: 50, flexibility: 50, torque: 50, balance: 50,
      leadership: 50, teamwork: 50, concentration: 50, pressure: 50, consistency: 50, vision: 50, game_iq: 50, intimidation: 50,
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
        await refreshPlayers();
        if (selectedTable === 'players') fetchTableData('players');
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
    // Info fields
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
    // Stat sliders
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
        setReferenceData(prev => ({ ...prev, players: (prev.players ?? []).map(p => p.id === editorPlayer.id ? { ...p, ...payload } : p) }));
        if (selectedTable === 'players') fetchTableData('players');
        setEditorSuccess(true);
        setTimeout(() => setEditorSuccess(false), 3000);
      } else {
        const err = await res.json().catch(() => ({}));
        alert('Failed to save: ' + (err.error ?? res.statusText));
      }
    } catch { alert('Error saving player'); }
    setEditorSaving(false);
  };

  const liveOverall = editorPlayer
    ? calculateOverall(editorStats, editorInfo.position || editorPlayer.position)
    : null;

  // ── Render helpers ──────────────────────────────────────────────────────────
  const renderCellValue = (tableName: string, col: Column, value: any, rowIndex: number) => {
    if (tableName === 'users' && col.name === 'password_hash') {
      return (
        <div className="flex items-center gap-2">
          <code className="text-xs bg-black/30 px-2 py-1 rounded">
            {showPasswords[rowIndex] ? value : '••••••••'}
          </code>
          <button onClick={() => setShowPasswords(prev => ({ ...prev, [rowIndex]: !prev[rowIndex] }))} className="p-1 text-gray-400 hover:text-white">
            {showPasswords[rowIndex] ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      );
    }
    if (((tableName === 'leagues' || tableName === 'teams') && col.name === 'nation' && value) ||
        (tableName === 'players' && col.name === 'country' && value)) {
      const code = value.length > 2 ? getCountryCode(value) : value.toLowerCase();
      return (
        <div className="flex items-center gap-2">
          <div className="w-6 h-4 rounded overflow-hidden">
            <img src={`/assets/flags/${code}.svg`} alt={value} className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
          </div>
          <span>{getCountryName(code)}</span>
        </div>
      );
    }
    const opts = getSelectOptions(tableName, col.name);
    if (opts.length > 0) {
      const dk = getSelectLabel(tableName, col.name);
      const found = opts.find(o => o.id === value);
      return found ? (found[dk] ?? `#${value}`) : (value != null ? `#${value}` : '—');
    }
    return String(value ?? '—').substring(0, 60);
  };

  const renderEditCell = (tableName: string, col: Column) => {
    if (col.pk === 1) {
      return <span className="text-amber-300 font-semibold text-xs px-2">{editValues[col.name]}</span>;
    }
    const opts = getSelectOptions(tableName, col.name);
    const dk = getSelectLabel(tableName, col.name);
    if (opts.length > 0) {
      return (
        <select
          value={editValues[col.name] ?? ''}
          onChange={e => setEditValues(prev => ({ ...prev, [col.name]: e.target.value ? parseInt(e.target.value) : null }))}
          className="w-full min-w-[120px] px-2 py-1 bg-gray-900 border border-white/20 rounded text-xs text-white focus:border-amber-500/60 focus:outline-none"
        >
          <option value="">— none —</option>
          {opts.map(opt => <option key={opt.id} value={opt.id}>{opt[dk] ?? `#${opt.id}`}</option>)}
        </select>
      );
    }
    const isNum = col.type.includes('INTEGER') || col.type.includes('REAL');
    const isDate = col.name.includes('date');
    return (
      <input
        type={isNum ? 'number' : isDate ? 'date' : 'text'}
        value={editValues[col.name] ?? ''}
        onChange={e => setEditValues(prev => ({ ...prev, [col.name]: e.target.value }))}
        className="w-full min-w-[80px] px-2 py-1 bg-gray-900 border border-white/20 rounded text-xs text-white focus:border-amber-500/60 focus:outline-none"
      />
    );
  };

  // ── JSX ─────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Database Admin</h1>
        <p className="text-gray-400 mt-1">Manage tables and records • {tables.length} tables available</p>
      </div>

      {/* ── Table Browser ──────────────────────────────────────────────────── */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <Database size={20} className="text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Table Browser</h2>
            <p className="text-sm text-gray-400">View and edit raw database records</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Table list */}
          <div className="lg:col-span-1 space-y-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1 pb-1">Tables</p>
            {tables.map(table => (
              <button
                key={table.name}
                onClick={() => fetchTableData(table.name)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-all text-sm font-medium flex items-center justify-between ${
                  selectedTable === table.name
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <span className="truncate">{table.name}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${selectedTable === table.name ? 'bg-amber-500/30 text-amber-300' : 'bg-white/10 text-gray-500'}`}>
                  {table.rowCount}
                </span>
              </button>
            ))}
          </div>

          {/* Table content */}
          <div className="lg:col-span-4">
            {!selectedTable ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-600 border border-white/5 rounded-xl">
                <Database size={32} className="mb-3 opacity-30" />
                <p className="text-sm">Select a table to browse records</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Table toolbar */}
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-white">{selectedTable}</span>
                    <span className="text-gray-500 text-sm ml-2">{tableData.length} records</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowAddForm(!showAddForm)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-sm font-medium transition-colors border border-amber-500/20"
                    >
                      <Plus size={14} /> New Record
                    </button>
                    {selectedTable === 'transfers' && (
                      <button
                        onClick={() => setShowTransferModal(true)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg text-sm font-medium transition-colors border border-blue-500/20"
                      >
                        <ArrowRight size={14} /> Quick Transfer
                      </button>
                    )}
                  </div>
                </div>

                {/* Add form */}
                {showAddForm && currentTable && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-gray-300">New Record</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {currentTable.columns
                        .filter(c => c.pk === 0 && c.name !== 'created_at' && c.name !== 'updated_at')
                        .map(col => {
                          const opts = getSelectOptions(selectedTable, col.name);
                          const dk = getSelectLabel(selectedTable, col.name);
                          return (
                            <div key={col.name} className="space-y-1">
                              <label className={LABEL_CLS}>{col.name}</label>
                              {opts.length > 0 ? (
                                <select
                                  value={newRow[col.name] ?? ''}
                                  onChange={e => setNewRow(prev => ({ ...prev, [col.name]: e.target.value ? parseInt(e.target.value) : null }))}
                                  className={SELECT_CLS}
                                >
                                  <option value="">— none —</option>
                                  {opts.map(opt => <option key={opt.id} value={opt.id}>{opt[dk] ?? `#${opt.id}`}</option>)}
                                </select>
                              ) : (
                                <input
                                  type={col.type.includes('INTEGER') || col.type.includes('REAL') ? 'number' : col.name.includes('date') ? 'date' : 'text'}
                                  value={newRow[col.name] ?? ''}
                                  onChange={e => setNewRow(prev => ({ ...prev, [col.name]: e.target.value }))}
                                  placeholder={col.dflt_value ? `default: ${col.dflt_value}` : col.name}
                                  className={INPUT_CLS}
                                />
                              )}
                            </div>
                          );
                        })}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={handleAddRow} className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg text-sm font-medium transition-colors border border-emerald-500/20">
                        Create
                      </button>
                      <button onClick={() => setShowAddForm(false)} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg text-sm font-medium transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Table */}
                {loading ? (
                  <div className="text-center text-gray-500 py-12">Loading…</div>
                ) : tableData.length === 0 ? (
                  <div className="text-center text-gray-500 py-12">No records</div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-white/10">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-white/5 border-b border-white/10">
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                          {getVisibleColumns(selectedTable, currentTable?.columns ?? []).map(col => (
                            <th key={col.name} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                              {col.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tableData.map((row, rowIndex) => (
                          <tr key={rowIndex} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                            <td className="px-3 py-2">
                              <div className="flex justify-start gap-1">
                                {editingRow === rowIndex ? (
                                  <>
                                    <button onClick={() => handleSave(rowIndex, row)} className="p-1.5 text-emerald-400 hover:bg-emerald-500/20 rounded transition-colors" title="Save"><Save size={14} /></button>
                                    <button onClick={() => setEditingRow(null)} className="p-1.5 text-gray-400 hover:bg-white/10 rounded transition-colors" title="Cancel"><X size={14} /></button>
                                  </>
                                ) : (
                                  <>
                                    <button onClick={() => handleEdit(rowIndex, row)} className="p-1.5 text-amber-400 hover:bg-amber-500/20 rounded transition-colors" title="Edit"><Edit2 size={14} /></button>
                                    <button onClick={() => handleDelete(rowIndex, row)} className="p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-colors" title="Delete"><Trash2 size={14} /></button>
                                  </>
                                )}
                              </div>
                            </td>
                            {getVisibleColumns(selectedTable, currentTable?.columns ?? []).map(col => (
                              <td key={col.name} className="px-3 py-2 text-gray-300 max-w-[160px]">
                                {editingRow === rowIndex
                                  ? renderEditCell(selectedTable, col)
                                  : <span className={col.pk === 1 ? 'text-amber-300 font-semibold' : ''}>
                                      {renderCellValue(selectedTable, col, row[col.name], rowIndex)}
                                    </span>
                                }
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Quick Add Player ────────────────────────────────────────────────── */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <UserPlus size={20} className="text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Quick Add Player</h2>
            <p className="text-sm text-gray-400">Creates a player with all stats defaulting to 50 — fine-tune in the editor below</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { key: 'player_id', label: 'Player ID (Optional)', type: 'number', placeholder: 'Auto-assigned if empty' },
            { key: 'player_name', label: 'Player Name *', type: 'text', placeholder: 'Full name' },
          ].map(f => (
            <div key={f.key} className="space-y-1.5">
              <label className={LABEL_CLS}>{f.label}</label>
              <input
                type={f.type}
                value={(quickAdd as any)[f.key]}
                onChange={e => setQuickAdd(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className={INPUT_CLS}
              />
            </div>
          ))}
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
            <label className={LABEL_CLS}>Age * (16–50)</label>
            <input type="number" min={16} max={50} value={quickAdd.age} onChange={e => setQuickAdd(prev => ({ ...prev, age: e.target.value }))} placeholder="e.g. 22" className={INPUT_CLS} />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL_CLS}>Country *</label>
            <input type="text" value={quickAdd.country} onChange={e => setQuickAdd(prev => ({ ...prev, country: e.target.value }))} placeholder="e.g. Japan" className={INPUT_CLS} />
          </div>
          <div className="space-y-1.5">
            <label className={LABEL_CLS}>Jersey # * (1–99)</label>
            <input type="number" min={1} max={99} value={quickAdd.jersey_number} onChange={e => setQuickAdd(prev => ({ ...prev, jersey_number: e.target.value }))} placeholder="e.g. 7" className={INPUT_CLS} />
          </div>
        </div>

        <div className="flex items-center gap-4 pt-1">
          <button
            onClick={handleQuickAddPlayer}
            disabled={quickAddLoading}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-black rounded-lg text-sm font-semibold transition-all shadow-lg shadow-amber-500/20"
          >
            <UserPlus size={16} />
            {quickAddLoading ? 'Creating…' : 'Add Player'}
          </button>
          {quickAddSuccess && <span className="text-sm text-emerald-400 font-medium">✓ Player created — find them in the editor below</span>}
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

            {/* Save bar */}
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleSavePlayer}
                disabled={editorSaving}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-all shadow-lg shadow-purple-500/20"
              >
                <Save size={16} />
                {editorSaving ? 'Saving…' : 'Save Player'}
              </button>
              {editorSuccess && <span className="text-sm text-emerald-400 font-medium">✓ Saved successfully</span>}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-gray-600">
            <SlidersHorizontal size={36} className="mb-3 opacity-30" />
            <p className="text-sm">Search for a player above to start editing</p>
          </div>
        )}
      </div>

      {/* ── Transfer Modal ──────────────────────────────────────────────────── */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-gray-900 border border-white/10 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Quick Transfer</h2>
              <button onClick={() => setShowTransferModal(false)} className="p-2 text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className={LABEL_CLS}>Player</label>
                <select
                  value={transferData.playerId}
                  onChange={e => {
                    const pid = e.target.value;
                    const player = allPlayers.find(p => p.id === parseInt(pid));
                    setTransferData(prev => ({ ...prev, playerId: pid, fromTeam: player?.team_id ? String(player.team_id) : '' }));
                  }}
                  className={SELECT_CLS}
                >
                  <option value="">Select Player</option>
                  {allPlayers.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.player_name} ({p.overall}) — {allTeams.find(t => t.id === p.team_id)?.team_name ?? 'Free Agent'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={LABEL_CLS}>From Team</label>
                  <select value={transferData.fromTeam} onChange={e => setTransferData(prev => ({ ...prev, fromTeam: e.target.value }))} className={SELECT_CLS}>
                    <option value="">No Team</option>
                    {allTeams.map(t => <option key={t.id} value={t.id}>{t.team_name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className={LABEL_CLS}>To Team</label>
                  <select value={transferData.toTeam} onChange={e => setTransferData(prev => ({ ...prev, toTeam: e.target.value }))} className={SELECT_CLS}>
                    <option value="">Select Team</option>
                    {allTeams.map(t => <option key={t.id} value={t.id}>{t.team_name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={LABEL_CLS}>Price</label>
                  <input type="number" value={transferData.price} onChange={e => setTransferData(prev => ({ ...prev, price: e.target.value }))} placeholder="0" className={INPUT_CLS} />
                </div>
                <div className="space-y-1.5">
                  <label className={LABEL_CLS}>Date</label>
                  <input type="date" value={transferData.date} onChange={e => setTransferData(prev => ({ ...prev, date: e.target.value }))} className={INPUT_CLS} />
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleTransfer} className="flex-1 px-4 py-2.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg text-sm font-medium transition-colors border border-blue-500/20">
                Create Transfer
              </button>
              <button onClick={() => setShowTransferModal(false)} className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg text-sm font-medium transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
