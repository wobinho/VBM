'use client';
import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, ArrowRight, Eye, EyeOff, Database, RotateCcw, AlertTriangle, CheckCircle2, Loader2, ArrowUpDown } from 'lucide-react';
// (Move Team Between Leagues has been moved to /team-admin)
import { useAuth } from '@/contexts/auth-context';
import { getCountryName, getCountryCode } from '@/lib/country-codes';
// (Quick Add Player and Player Editor have been moved to /player-admin)

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
  teams:     ['id', 'team_name', 'league_id', 'nation', 'team_money', 'played', 'won', 'lost', 'points', 'score_diff'],
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

const INPUT_CLS = 'w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-all';
const SELECT_CLS = 'w-full px-3 py-2 bg-[#1a1a2e] border border-white/10 rounded-lg text-sm text-white focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-all';
const LABEL_CLS = 'text-xs font-semibold text-gray-400 uppercase tracking-wider';

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

  // Season reset
  const [resetConfirm, setResetConfirm]   = useState(false);
  const [resetting,    setResetting]      = useState(false);
  const [resetResult,  setResetResult]    = useState<{ ok: boolean; message: string } | null>(null);

  // Promotion / relegation
  const [promoConfirm, setPromoConfirm]   = useState(false);
  const [promoting,    setPromoting]      = useState(false);
  const [promoResult,  setPromoResult]    = useState<{ ok: boolean; message: string } | null>(null);


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

  const handleEdit = (rowIndex: number, row: RowData) => {
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

  // ── Season reset ────────────────────────────────────────────────────────────
  const handleResetSeason = async () => {
    setResetting(true);
    setResetResult(null);
    try {
      const res = await fetch('/api/admin/reset-season', { method: 'POST' });
      const data = await res.json();
      setResetResult({ ok: res.ok, message: data.message ?? data.error ?? 'Unknown response' });
      if (res.ok) {
        fetchTables(); // refresh row counts
        setResetConfirm(false);
      }
    } catch (e: any) {
      setResetResult({ ok: false, message: e.message ?? 'Network error' });
    }
    setResetting(false);
  };

  // ── Promotion / relegation ──────────────────────────────────────────────────
  const handleProcessPromotion = async () => {
    setPromoting(true);
    setPromoResult(null);
    try {
      const res = await fetch('/api/admin/process-promotion', { method: 'POST' });
      const data = await res.json();
      setPromoResult({ ok: res.ok, message: data.message ?? data.error ?? 'Unknown response' });
      if (res.ok) {
        fetchTables();
        setPromoConfirm(false);
      }
    } catch (e: any) {
      setPromoResult({ ok: false, message: e.message ?? 'Network error' });
    }
    setPromoting(false);
  };

  // ── JSX ─────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Database Admin</h1>
          <p className="text-gray-400 mt-1">Manage tables and records • {tables.length} tables available</p>
        </div>

        {/* ── Reset Season ──────────────────────────────────────────────────── */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          {!resetConfirm ? (
            <button
              onClick={() => { setResetConfirm(true); setResetResult(null); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold
                bg-red-500/10 border border-red-500/30 text-red-400
                hover:bg-red-500/20 hover:text-red-300 transition-all cursor-pointer active:scale-95"
            >
              <RotateCcw size={14} />
              Reset Season
            </button>
          ) : (
            <div className="flex flex-col items-end gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
              <div className="flex items-center gap-2 text-red-300 text-sm font-semibold">
                <AlertTriangle size={14} className="text-red-400" />
                This clears ALL match results, playoffs, and rewinds the calendar. Continue?
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setResetConfirm(false); setResetResult(null); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetSeason}
                  disabled={resetting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold
                    bg-red-500/20 border border-red-500/40 text-red-300
                    hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  {resetting ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                  {resetting ? 'Resetting…' : 'Confirm Reset'}
                </button>
              </div>
            </div>
          )}
          {resetResult && (
            <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border ${
              resetResult.ok
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              {resetResult.ok ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
              {resetResult.message}
            </div>
          )}
        </div>

        {/* ── Promotion / Relegation ────────────────────────────────────────── */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          {!promoConfirm ? (
            <button
              onClick={() => { setPromoConfirm(true); setPromoResult(null); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold
                bg-amber-500/10 border border-amber-500/30 text-amber-400
                hover:bg-amber-500/20 hover:text-amber-300 transition-all cursor-pointer active:scale-95"
            >
              <ArrowUpDown size={14} />
              Process Promotion / Relegation
            </button>
          ) : (
            <div className="flex flex-col items-end gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-center gap-2 text-amber-300 text-sm font-semibold">
                <AlertTriangle size={14} className="text-amber-400" />
                This moves teams between leagues based on current standings. Continue?
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setPromoConfirm(false); setPromoResult(null); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProcessPromotion}
                  disabled={promoting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold
                    bg-amber-500/20 border border-amber-500/40 text-amber-300
                    hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  {promoting ? <Loader2 size={12} className="animate-spin" /> : <ArrowUpDown size={12} />}
                  {promoting ? 'Processing…' : 'Confirm'}
                </button>
              </div>
            </div>
          )}
          {promoResult && (
            <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border ${
              promoResult.ok
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              {promoResult.ok ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
              {promoResult.message}
            </div>
          )}
        </div>
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
