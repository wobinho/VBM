'use client';
import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Edit2, Save, X, ArrowRight, Eye, EyeOff, Search, SlidersHorizontal, UserPlus } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { getCountryName, getCountryCode } from '@/lib/country-codes';

interface Column {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: null | string;
  pk: number;
}

interface Table {
  name: string;
  columns: Column[];
  rowCount: number;
}

interface RowData {
  [key: string]: any;
}

const HIDDEN_COLUMNS: Record<string, string[]> = {
  'players': ['speed', 'agility', 'strength', 'endurance', 'jump_serve', 'float_serve', 'spike_power', 'spike_accuracy', 'block_timing', 'dig_technique', 'leadership', 'teamwork', 'concentration', 'pressure_handling', 'consistency'],
  'teams': [],
  'users': ['password_hash'],
};

const DISPLAY_COLUMNS: Record<string, string[]> = {
  'leagues': ['id', 'league_name', 'nation'],
  'teams': ['id', 'team_name', 'league_id', 'nation', 'team_money', 'played', 'won', 'lost', 'points', 'goal_diff'],
  'players': ['id', 'player_name', 'team_id', 'position', 'age', 'country', 'jersey_number', 'overall', 'attack', 'defense', 'serve', 'block', 'receive', 'setting', 'contract_years', 'monthly_wage', 'player_value', 'height', 'experience', 'potential'],
  'users': ['id', 'username', 'email', 'display_name', 'is_admin', 'is_active'],
  'transfers': ['id', 'player_id', 'from_team', 'to_team', 'price', 'transfer_date', 'status'],
};

const SELECT_COLUMNS: Record<string, Record<string, string>> = {
  'teams': { 'league_id': 'leagues' },
  'players': { 'team_id': 'teams' },
  'transfers': { 'player_id': 'players', 'from_team': 'teams', 'to_team': 'teams' },
};

const FOREIGN_KEY_DISPLAY: Record<string, Record<string, string>> = {
  'teams': { 'league_id': 'league_name' },
  'players': { 'team_id': 'player_name' },
  'transfers': { 'player_id': 'player_name', 'from_team': 'team_name', 'to_team': 'team_name' },
};

const POSITIONS = ['Setter', 'Outside Hitter', 'Middle Blocker', 'Opposite Hitter', 'Libero'];

const STAT_GROUPS = [
  {
    label: 'Core Skills',
    headerClass: 'text-amber-400',
    borderClass: 'border-amber-500/10',
    stats: [
      { key: 'attack', label: 'Attack' },
      { key: 'defense', label: 'Defense' },
      { key: 'serve', label: 'Serve' },
      { key: 'block', label: 'Block' },
      { key: 'receive', label: 'Receive' },
      { key: 'setting', label: 'Setting' },
    ],
  },
  {
    label: 'Physical',
    headerClass: 'text-blue-400',
    borderClass: 'border-blue-500/10',
    stats: [
      { key: 'speed', label: 'Speed' },
      { key: 'agility', label: 'Agility' },
      { key: 'strength', label: 'Strength' },
      { key: 'endurance', label: 'Endurance' },
      { key: 'height', label: 'Height (cm)', min: 150, max: 220 },
    ],
  },
  {
    label: 'Mental',
    headerClass: 'text-purple-400',
    borderClass: 'border-purple-500/10',
    stats: [
      { key: 'leadership', label: 'Leadership' },
      { key: 'teamwork', label: 'Teamwork' },
      { key: 'concentration', label: 'Concentration' },
      { key: 'pressure_handling', label: 'Pressure Handling' },
      { key: 'experience', label: 'Experience' },
      { key: 'potential', label: 'Potential' },
      { key: 'consistency', label: 'Consistency' },
    ],
  },
  {
    label: 'Advanced Techniques',
    headerClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/10',
    stats: [
      { key: 'jump_serve', label: 'Jump Serve' },
      { key: 'float_serve', label: 'Float Serve' },
      { key: 'spike_power', label: 'Spike Power' },
      { key: 'spike_accuracy', label: 'Spike Accuracy' },
      { key: 'block_timing', label: 'Block Timing' },
      { key: 'dig_technique', label: 'Dig Technique' },
    ],
  },
];

function calculateOverall(s: Record<string, number>): number {
  const core =
    ((s.attack ?? 50) + (s.defense ?? 50) + (s.serve ?? 50) +
      (s.block ?? 50) + (s.receive ?? 50) + (s.setting ?? 50)) / 6;
  const physical =
    ((s.speed ?? 50) + (s.agility ?? 50) + (s.strength ?? 50) + (s.endurance ?? 50)) / 4;
  const mental =
    ((s.leadership ?? 50) + (s.teamwork ?? 50) + (s.concentration ?? 50) +
      (s.pressure_handling ?? 50) + (s.experience ?? 50) + (s.consistency ?? 50)) / 6;
  return Math.min(99, Math.max(1, Math.round(core * 0.65 + physical * 0.15 + mental * 0.20)));
}

function StatSlider({
  label, value, min = 1, max = 100, onChange,
}: {
  label: string; value: number; min?: number; max?: number; onChange: (v: number) => void;
}) {
  const isHeight = max === 220;
  const colorClass = isHeight
    ? 'text-blue-400'
    : value >= 80 ? 'text-emerald-400' : value >= 60 ? 'text-amber-400' : 'text-red-400';
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-400 capitalize">{label}</span>
        <span className={`text-sm font-bold tabular-nums ${colorClass}`}>{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-amber-500"
        style={{ background: `linear-gradient(to right, rgb(245 158 11) ${((value - min) / (max - min)) * 100}%, rgba(255,255,255,0.1) ${((value - min) / (max - min)) * 100}%)` }}
      />
    </div>
  );
}

function renderCellContent(tableName: string, columnName: string, value: any, showPassword: boolean) {
  if (tableName === 'users' && columnName === 'password_hash') {
    return `${showPassword ? value : '••••••••'}`;
  }
  if ((tableName === 'leagues' || tableName === 'teams') && columnName === 'nation' && value) {
    const code = value.length > 2 ? getCountryCode(value) : value.toLowerCase();
    return (
      <div className="flex items-center gap-2">
        <div className="w-6 h-4 rounded overflow-hidden">
          <img src={`/assets/flags/${code}.svg`} alt={value} className="w-full h-full object-cover" onError={e => { e.currentTarget.src = ''; }} />
        </div>
        <span>{getCountryName(code)}</span>
      </div>
    );
  }
  return String(value ?? '—');
}

const DEFAULT_QUICK_ADD = { player_name: '', team_id: '', position: '', age: '', country: '', jersey_number: '' };

export default function AdminPage() {
  const { isAdmin } = useAuth();
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<RowData>({});
  const [newRow, setNewRow] = useState<RowData>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [allPlayers, setAllPlayers] = useState<RowData[]>([]);
  const [allTeams, setAllTeams] = useState<RowData[]>([]);
  const [allLeagues, setAllLeagues] = useState<RowData[]>([]);
  const [transferData, setTransferData] = useState({ playerId: '', fromTeam: '', toTeam: '', price: '', date: new Date().toISOString().split('T')[0] });
  const [showPasswords, setShowPasswords] = useState<Record<number, boolean>>({});
  const [referenceData, setReferenceData] = useState<Record<string, RowData[]>>({});

  // Quick Add Player
  const [quickAdd, setQuickAdd] = useState(DEFAULT_QUICK_ADD);
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [quickAddSuccess, setQuickAddSuccess] = useState(false);

  // Player Stats Editor
  const [editorSearch, setEditorSearch] = useState('');
  const [editorPlayer, setEditorPlayer] = useState<RowData | null>(null);
  const [editorStats, setEditorStats] = useState<Record<string, number>>({});
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorSuccess, setEditorSuccess] = useState(false);

  const filteredPlayersForEdit = useMemo(() => {
    if (!editorSearch.trim()) return [];
    const term = editorSearch.toLowerCase();
    return allPlayers
      .filter(p =>
        p.player_name?.toLowerCase().includes(term) ||
        p.position?.toLowerCase().includes(term)
      )
      .slice(0, 10);
  }, [editorSearch, allPlayers]);

  const getVisibleColumns = (tableName: string, allColumns: Column[]) => {
    if (DISPLAY_COLUMNS[tableName]) {
      return allColumns.filter(c => DISPLAY_COLUMNS[tableName].includes(c.name));
    }
    return allColumns;
  };

  const isColumnHidden = (tableName: string, columnName: string) => {
    const hidden = HIDDEN_COLUMNS[tableName] || [];
    return hidden.includes(columnName);
  };

  const getSelectOptions = (tableName: string, columnName: string): RowData[] => {
    const selectConfig = SELECT_COLUMNS[tableName];
    if (!selectConfig || !selectConfig[columnName]) return [];
    const refTableName = selectConfig[columnName];
    return referenceData[refTableName] || [];
  };

  const getSelectLabel = (tableName: string, columnName: string): string => {
    const selectConfig = SELECT_COLUMNS[tableName];
    if (!selectConfig || !selectConfig[columnName]) return '';
    const displayConfig = FOREIGN_KEY_DISPLAY[tableName];
    return displayConfig ? displayConfig[columnName] : 'name';
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="text-6xl">🔒</div>
        <h2 className="text-2xl font-bold text-white">Access Denied</h2>
        <p className="text-gray-400">You do not have admin privileges.</p>
      </div>
    );
  }

  useEffect(() => {
    fetchTables();
    const loadReferenceData = async () => {
      const refs: Record<string, RowData[]> = {};
      for (const table of ['players', 'teams', 'leagues']) {
        try {
          const res = await fetch(`/api/admin/table/${table}`);
          const data = await res.json();
          refs[table] = Array.isArray(data) ? data : [];
        } catch {
          refs[table] = [];
        }
      }
      setReferenceData(refs);
      setAllPlayers(refs['players'] || []);
      setAllTeams(refs['teams'] || []);
      setAllLeagues(refs['leagues'] || []);
    };
    loadReferenceData();
  }, []);

  const fetchTables = async () => {
    try {
      const res = await fetch('/api/admin/tables');
      const data = await res.json();
      if (Array.isArray(data)) setTables(data);
    } catch (error) {
      console.error('Error fetching tables:', error);
    }
  };

  const fetchTableData = async (tableName: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/table/${tableName}`);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data)) {
        setTableData([]);
      } else {
        setTableData(data);
      }
      setSelectedTable(tableName);
      setEditingRow(null);
      setShowAddForm(false);
    } catch (error) {
      console.error('Error fetching table data:', error);
      setTableData([]);
    }
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
    } catch { /* silent */ }
  };

  const handleEdit = (rowIndex: number, row: RowData) => {
    setEditingRow(rowIndex);
    setEditValues({ ...row });
  };

  const handleSave = async (rowIndex: number, row: RowData) => {
    if (!selectedTable) return;
    try {
      const res = await fetch(`/api/admin/table/${selectedTable}/${row.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editValues),
      });
      if (res.ok) {
        const updated = [...tableData];
        updated[rowIndex] = { ...row, ...editValues };
        setTableData(updated);
        setEditingRow(null);
      }
    } catch (error) {
      console.error('Error saving row:', error);
    }
  };

  const handleDelete = async (rowIndex: number, row: RowData) => {
    if (!selectedTable || !confirm('Delete this row?')) return;
    try {
      const res = await fetch(`/api/admin/table/${selectedTable}/${row.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setTableData(tableData.filter((_, i) => i !== rowIndex));
      }
    } catch (error) {
      console.error('Error deleting row:', error);
    }
  };

  const handleAddRow = async () => {
    if (!selectedTable) return;
    try {
      const res = await fetch(`/api/admin/table/${selectedTable}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRow),
      });
      if (res.ok) {
        fetchTableData(selectedTable);
        setNewRow({});
        setShowAddForm(false);
      }
    } catch (error) {
      console.error('Error adding row:', error);
    }
  };

  const handleTransfer = async () => {
    if (!transferData.playerId || !transferData.toTeam) {
      alert('Please select both player and destination team');
      return;
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
      } else {
        alert('Error creating transfer');
      }
    } catch (error) {
      console.error('Error creating transfer:', error);
      alert('Error creating transfer');
    }
  };

  // ── Quick Add Player ──────────────────────────────────────────────────────
  const handleQuickAddPlayer = async () => {
    const { player_name, position, age, country, jersey_number } = quickAdd;
    if (!player_name || !position || !age || !country || !jersey_number) {
      alert('Please fill in all required fields (name, position, age, country, jersey number)');
      return;
    }
    setQuickAddLoading(true);
    const ageNum = parseInt(age);
    const jerseyNum = parseInt(jersey_number);
    const overall = 50;
    const payload = {
      player_name,
      team_id: quickAdd.team_id ? parseInt(quickAdd.team_id) : null,
      position,
      age: ageNum,
      country,
      jersey_number: jerseyNum,
      overall,
      attack: 50, defense: 50, serve: 50, block: 50, receive: 50, setting: 50,
      speed: 50, agility: 50, strength: 50, endurance: 50, height: 185,
      leadership: 50, teamwork: 50, concentration: 50, pressure_handling: 50,
      jump_serve: 50, float_serve: 50, spike_power: 50, spike_accuracy: 50,
      block_timing: 50, dig_technique: 50, experience: 50, potential: 50, consistency: 50,
      contract_years: 1,
      monthly_wage: Math.round(overall * 100),
      player_value: overall * 5000,
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
      } else {
        alert('Failed to create player');
      }
    } catch {
      alert('Error creating player');
    }
    setQuickAddLoading(false);
  };

  // ── Player Stats Editor ───────────────────────────────────────────────────
  const selectPlayerForEdit = (player: RowData) => {
    setEditorPlayer(player);
    setEditorSearch('');
    setEditorStats({
      attack: player.attack ?? 50, defense: player.defense ?? 50,
      serve: player.serve ?? 50, block: player.block ?? 50,
      receive: player.receive ?? 50, setting: player.setting ?? 50,
      speed: player.speed ?? 50, agility: player.agility ?? 50,
      strength: player.strength ?? 50, endurance: player.endurance ?? 50,
      height: player.height ?? 185,
      leadership: player.leadership ?? 50, teamwork: player.teamwork ?? 50,
      concentration: player.concentration ?? 50, pressure_handling: player.pressure_handling ?? 50,
      jump_serve: player.jump_serve ?? 50, float_serve: player.float_serve ?? 50,
      spike_power: player.spike_power ?? 50, spike_accuracy: player.spike_accuracy ?? 50,
      block_timing: player.block_timing ?? 50, dig_technique: player.dig_technique ?? 50,
      experience: player.experience ?? 50, potential: player.potential ?? 50,
      consistency: player.consistency ?? 50,
    });
  };

  const handleSaveEditorStats = async () => {
    if (!editorPlayer) return;
    setEditorSaving(true);
    const overall = calculateOverall(editorStats);
    try {
      const res = await fetch(`/api/players/${editorPlayer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editorStats, overall }),
      });
      if (res.ok) {
        setEditorPlayer(prev => prev ? { ...prev, ...editorStats, overall } : null);
        setAllPlayers(prev => prev.map(p => p.id === editorPlayer.id ? { ...p, ...editorStats, overall } : p));
        if (selectedTable === 'players') fetchTableData('players');
        setEditorSuccess(true);
        setTimeout(() => setEditorSuccess(false), 3000);
      } else {
        alert('Failed to save player stats');
      }
    } catch {
      alert('Error saving player stats');
    }
    setEditorSaving(false);
  };

  const liveOverall = editorPlayer ? calculateOverall(editorStats) : null;
  const currentTable = tables.find(t => t.name === selectedTable);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Database Admin</h1>
          <p className="text-gray-400 mt-1">Manage tables and records • {tables.length} tables available</p>
        </div>
      </div>

      {/* ── Table Browser ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Table List */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-2">
            <h2 className="font-semibold text-gray-300 text-sm uppercase tracking-wider px-4 py-2">Tables ({tables.length})</h2>
            <div className="space-y-1 max-h-[calc(100vh-200px)] overflow-y-auto">
              {tables.map(table => (
                <button
                  key={table.name}
                  onClick={() => fetchTableData(table.name)}
                  className={`w-full text-left px-4 py-2.5 rounded-lg transition-all text-sm font-medium flex items-center justify-between ${
                    selectedTable === table.name
                      ? 'bg-amber-500/30 text-amber-300 border border-amber-500/40'
                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <span className="truncate">{table.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-bold flex-shrink-0 ${selectedTable === table.name ? 'bg-amber-500/40' : 'bg-gray-700/50'}`}>
                    {table.rowCount}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table Data */}
        <div className="lg:col-span-4">
          {selectedTable ? (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-white">{selectedTable}</h2>
                  <p className="text-sm text-gray-400 mt-0.5">{tableData.length} record{tableData.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black rounded-lg text-sm font-semibold transition-all shadow-lg shadow-amber-500/20"
                  >
                    <Plus size={16} />
                    New Record
                  </button>
                  {selectedTable === 'transfers' && (
                    <button
                      onClick={() => setShowTransferModal(true)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white rounded-lg text-sm font-semibold transition-all shadow-lg shadow-blue-500/20"
                    >
                      <ArrowRight size={16} />
                      Quick Transfer
                    </button>
                  )}
                </div>
              </div>

              {showAddForm && currentTable && (
                <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-5 space-y-3">
                  <h3 className="font-semibold text-white mb-4">Add New Record</h3>
                  {currentTable.columns
                    .filter(c => c.pk === 0 && !isColumnHidden(selectedTable || '', c.name))
                    .map(col => {
                      const options = getSelectOptions(selectedTable || '', col.name);
                      const isSelect = options.length > 0;
                      const displayKey = getSelectLabel(selectedTable || '', col.name);
                      return (
                        <div key={col.name} className="flex flex-col gap-2">
                          <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{col.name}</label>
                          {isSelect ? (
                            <select
                              value={newRow[col.name] || ''}
                              onChange={e => setNewRow({ ...newRow, [col.name]: e.target.value ? parseInt(e.target.value) : '' })}
                              className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-all"
                            >
                              <option value="">Select {col.name}</option>
                              {options.map(opt => (
                                <option key={opt.id} value={opt.id}>
                                  {opt[displayKey] || `${col.name} #${opt.id}`}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={col.type.includes('INTEGER') || col.type.includes('REAL') ? 'number' : col.name.includes('date') ? 'date' : 'text'}
                              value={newRow[col.name] || ''}
                              onChange={e => setNewRow({ ...newRow, [col.name]: e.target.value })}
                              className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-all"
                              placeholder={`Enter ${col.name}`}
                            />
                          )}
                        </div>
                      );
                    })}
                  <div className="flex gap-2 pt-4">
                    <button
                      onClick={handleAddRow}
                      className="flex-1 px-4 py-2.5 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 rounded-lg text-sm font-medium transition-colors border border-emerald-500/20"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="flex-1 px-4 py-2.5 bg-white/5 text-gray-400 hover:text-white rounded-lg text-sm font-medium transition-colors border border-white/5"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="text-center text-gray-400 py-12">Loading records...</div>
              ) : tableData.length === 0 ? (
                <div className="text-center text-gray-400 py-12">No records in this table</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5">
                        {currentTable?.columns
                          .filter(col => !isColumnHidden(selectedTable || '', col.name))
                          .map(col => (
                            <th key={col.name} className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                              {col.name}
                            </th>
                          ))}
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          {currentTable?.columns
                            .filter(col => !isColumnHidden(selectedTable || '', col.name))
                            .map(col => {
                              const options = getSelectOptions(selectedTable || '', col.name);
                              const isSelect = options.length > 0;
                              const displayKey = getSelectLabel(selectedTable || '', col.name);
                              return (
                                <td key={col.name} className="px-4 py-3 text-gray-300">
                                  {editingRow === rowIndex ? (
                                    isSelect ? (
                                      <select
                                        value={editValues[col.name] || ''}
                                        onChange={e => setEditValues({ ...editValues, [col.name]: e.target.value ? parseInt(e.target.value) : '' })}
                                        disabled={col.pk === 1}
                                        className={`w-full px-2 py-1 bg-gray-800 border border-white/10 rounded text-xs text-white focus:border-amber-500/50 focus:outline-none ${col.pk === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                      >
                                        <option value="">Select {col.name}</option>
                                        {options.map(opt => (
                                          <option key={opt.id} value={opt.id}>
                                            {opt[displayKey] || `${col.name} #${opt.id}`}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <input
                                        type={col.type.includes('INTEGER') || col.type.includes('REAL') ? 'number' : col.name.includes('date') ? 'date' : 'text'}
                                        value={editValues[col.name] || ''}
                                        onChange={e => setEditValues({ ...editValues, [col.name]: e.target.value })}
                                        disabled={col.pk === 1}
                                        className={`w-full px-2 py-1 bg-gray-800 border border-white/10 rounded text-xs text-white focus:border-amber-500/50 focus:outline-none ${col.pk === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                      />
                                    )
                                  ) : (
                                    <span className={col.pk === 1 ? 'text-amber-300 font-semibold' : ''}>
                                      {getSelectOptions(selectedTable || '', col.name).length > 0 ? (
                                        (() => {
                                          const opts = getSelectOptions(selectedTable || '', col.name);
                                          const dk = getSelectLabel(selectedTable || '', col.name);
                                          const selected = opts.find(o => o.id === row[col.name]);
                                          return selected ? selected[dk] || `${col.name} #${row[col.name]}` : `${col.name} #${row[col.name]}`;
                                        })()
                                      ) : selectedTable === 'users' && col.name === 'password_hash' ? (
                                        <div className="flex items-center gap-2">
                                          <code className="text-xs bg-black/30 px-2 py-1 rounded">
                                            {showPasswords[rowIndex] ? row[col.name] : '••••••••'}
                                          </code>
                                          <button
                                            onClick={() => setShowPasswords(prev => ({ ...prev, [rowIndex]: !prev[rowIndex] }))}
                                            className="p-1 text-gray-400 hover:text-white transition-colors"
                                          >
                                            {showPasswords[rowIndex] ? <EyeOff size={14} /> : <Eye size={14} />}
                                          </button>
                                        </div>
                                      ) : (selectedTable === 'leagues' || selectedTable === 'teams') && col.name === 'nation' && row[col.name] ? (
                                        <div className="flex items-center gap-2">
                                          <div className="w-6 h-4 rounded overflow-hidden">
                                            <img src={`/assets/flags/${row[col.name].toLowerCase()}.svg`} alt={row[col.name]} className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
                                          </div>
                                          <span>{getCountryName(row[col.name])}</span>
                                        </div>
                                      ) : (
                                        String(row[col.name] ?? '—').substring(0, 50)
                                      )}
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                          <td className="px-4 py-3 text-right flex justify-end gap-1.5">
                            {editingRow === rowIndex ? (
                              <>
                                <button onClick={() => handleSave(rowIndex, row)} className="p-2 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors cursor-pointer" title="Save">
                                  <Save size={16} />
                                </button>
                                <button onClick={() => setEditingRow(null)} className="p-2 text-gray-400 hover:bg-gray-700/50 rounded-lg transition-colors cursor-pointer" title="Cancel">
                                  <X size={16} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => handleEdit(rowIndex, row)} className="p-2 text-amber-400 hover:bg-amber-500/20 rounded-lg transition-colors cursor-pointer" title="Edit">
                                  <Edit2 size={16} />
                                </button>
                                <button onClick={() => handleDelete(rowIndex, row)} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer" title="Delete">
                                  <Trash2 size={16} />
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-gray-400">Select a table to view and edit records</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Quick Add Player ───────────────────────────────────────────────── */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <UserPlus size={20} className="text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Quick Add Player</h2>
            <p className="text-sm text-gray-400">Creates player with all stats defaulting to 50 — fine-tune in the editor below</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Player Name *</label>
            <input
              type="text"
              value={quickAdd.player_name}
              onChange={e => setQuickAdd({ ...quickAdd, player_name: e.target.value })}
              placeholder="Full name"
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Team</label>
            <select
              value={quickAdd.team_id}
              onChange={e => setQuickAdd({ ...quickAdd, team_id: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-all"
            >
              <option value="">Free Agent</option>
              {allTeams.map(t => (
                <option key={t.id} value={t.id}>{t.team_name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Position *</label>
            <select
              value={quickAdd.position}
              onChange={e => setQuickAdd({ ...quickAdd, position: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-all"
            >
              <option value="">Select position</option>
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Age * (16–50)</label>
            <input
              type="number"
              min={16}
              max={50}
              value={quickAdd.age}
              onChange={e => setQuickAdd({ ...quickAdd, age: e.target.value })}
              placeholder="e.g. 22"
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Country *</label>
            <input
              type="text"
              value={quickAdd.country}
              onChange={e => setQuickAdd({ ...quickAdd, country: e.target.value })}
              placeholder="e.g. US, Japan, Brazil"
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Jersey # * (1–99)</label>
            <input
              type="number"
              min={1}
              max={99}
              value={quickAdd.jersey_number}
              onChange={e => setQuickAdd({ ...quickAdd, jersey_number: e.target.value })}
              placeholder="e.g. 7"
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 pt-1">
          <button
            onClick={handleQuickAddPlayer}
            disabled={quickAddLoading}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-black rounded-lg text-sm font-semibold transition-all shadow-lg shadow-amber-500/20"
          >
            <UserPlus size={16} />
            {quickAddLoading ? 'Creating...' : 'Add Player'}
          </button>
          {quickAddSuccess && (
            <span className="text-sm text-emerald-400 font-medium">✓ Player created — find them in the editor below to set stats</span>
          )}
        </div>
      </div>

      {/* ── Player Stats Editor ────────────────────────────────────────────── */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
              <SlidersHorizontal size={20} className="text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Player Stats Editor</h2>
              <p className="text-sm text-gray-400">Search a player, adjust sliders — overall updates automatically</p>
            </div>
          </div>

          {/* Live Overall Badge */}
          {editorPlayer && liveOverall !== null && (
            <div className={`flex flex-col items-center px-6 py-3 rounded-xl border shrink-0 ${
              liveOverall >= 80
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : liveOverall >= 60
                ? 'bg-amber-500/10 border-amber-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}>
              <span className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Overall</span>
              <span className={`text-4xl font-black tabular-nums leading-none ${
                liveOverall >= 80 ? 'text-emerald-400' : liveOverall >= 60 ? 'text-amber-400' : 'text-red-400'
              }`}>{liveOverall}</span>
              {editorPlayer.overall !== liveOverall && (
                <span className="text-xs text-gray-500 mt-1">
                  was {editorPlayer.overall}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={editorSearch}
              onChange={e => setEditorSearch(e.target.value)}
              placeholder="Search players by name or position..."
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/20 transition-all"
            />
          </div>
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
                    {allTeams.find(t => t.id === p.team_id)?.team_name || 'Free Agent'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {editorPlayer ? (
          <>
            {/* Selected player header */}
            <div className="flex items-center gap-4 py-3 px-4 bg-white/5 rounded-xl border border-white/10">
              <div className="text-2xl font-black text-amber-400 tabular-nums">#{editorPlayer.jersey_number}</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white truncate">{editorPlayer.player_name}</p>
                <p className="text-sm text-gray-400">{editorPlayer.position} • {editorPlayer.country} • Age {editorPlayer.age}</p>
              </div>
              <div className="text-sm text-gray-400 shrink-0 hidden sm:block">
                {allTeams.find(t => t.id === editorPlayer.team_id)?.team_name || 'Free Agent'}
              </div>
              <button
                onClick={() => { setEditorPlayer(null); setEditorStats({}); }}
                className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors shrink-0"
                title="Clear selection"
              >
                <X size={16} />
              </button>
            </div>

            {/* Stat Groups */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {STAT_GROUPS.map(group => (
                <div key={group.label} className={`space-y-3 p-4 rounded-xl bg-white/[0.03] border ${group.borderClass}`}>
                  <h3 className={`text-xs font-bold uppercase tracking-widest ${group.headerClass}`}>{group.label}</h3>
                  <div className="space-y-3">
                    {group.stats.map(stat => (
                      <StatSlider
                        key={stat.key}
                        label={stat.label}
                        value={editorStats[stat.key] ?? (stat.min ?? 50)}
                        min={stat.min}
                        max={stat.max}
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
                onClick={handleSaveEditorStats}
                disabled={editorSaving}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-all shadow-lg shadow-purple-500/20"
              >
                <Save size={16} />
                {editorSaving ? 'Saving...' : 'Save Stats'}
              </button>
              {editorSuccess && (
                <span className="text-sm text-emerald-400 font-medium">✓ Stats saved successfully</span>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-gray-600">
            <SlidersHorizontal size={36} className="mb-3 opacity-30" />
            <p className="text-sm">Search for a player above to start editing their stats</p>
          </div>
        )}
      </div>

      {/* ── Transfer Modal ─────────────────────────────────────────────────── */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-gray-900 border border-white/10 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Quick Player Transfer</h2>
              <button onClick={() => setShowTransferModal(false)} className="p-2 text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Player</label>
                <select
                  value={transferData.playerId}
                  onChange={e => {
                    setTransferData({ ...transferData, playerId: e.target.value });
                    const player = allPlayers.find(p => p.id === parseInt(e.target.value));
                    if (player) setTransferData(prev => ({ ...prev, fromTeam: player.team_id || '' }));
                  }}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:border-blue-500/50 focus:outline-none"
                >
                  <option value="">Select Player</option>
                  {allPlayers.map(p => (
                    <option key={`player-${p.id}`} value={p.id}>
                      {p.player_name} ({p.overall}) - {allTeams.find(t => t.id === p.team_id)?.team_name || 'No Team'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">From Team</label>
                  <select
                    value={transferData.fromTeam}
                    onChange={e => setTransferData({ ...transferData, fromTeam: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:border-blue-500/50 focus:outline-none"
                  >
                    <option value="">No Team</option>
                    {allTeams.map(t => (
                      <option key={`from-${t.id}`} value={t.id}>{t.team_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">To Team</label>
                  <select
                    value={transferData.toTeam}
                    onChange={e => setTransferData({ ...transferData, toTeam: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:border-blue-500/50 focus:outline-none"
                  >
                    <option value="">Select Team</option>
                    {allTeams.map(t => (
                      <option key={`to-${t.id}`} value={t.id}>{t.team_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Transfer Price</label>
                  <input
                    type="number"
                    value={transferData.price}
                    onChange={e => setTransferData({ ...transferData, price: e.target.value })}
                    placeholder="0"
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:border-blue-500/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Transfer Date</label>
                  <input
                    type="date"
                    value={transferData.date}
                    onChange={e => setTransferData({ ...transferData, date: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:border-blue-500/50 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={handleTransfer}
                className="flex-1 px-4 py-2.5 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 rounded-lg text-sm font-medium transition-colors border border-blue-500/20"
              >
                Create Transfer
              </button>
              <button
                onClick={() => setShowTransferModal(false)}
                className="flex-1 px-4 py-2.5 bg-white/5 text-gray-400 hover:text-white rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
