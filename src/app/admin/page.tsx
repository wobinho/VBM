'use client';
import { useState, useEffect } from 'react';
import { ChevronDown, Plus, Trash2, Edit2, Save, X, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';

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
  'users': [],
};

const DISPLAY_COLUMNS: Record<string, string[]> = {
  'players': ['id', 'player_name', 'position', 'age', 'country', 'jersey_number', 'overall', 'attack', 'defense', 'serve', 'block', 'receive', 'setting', 'contract_years', 'monthly_wage', 'player_value', 'height', 'experience', 'potential'],
};

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
  }, []);

  const fetchTables = async () => {
    try {
      const res = await fetch('/api/admin/tables');
      const data = await res.json();
      if (Array.isArray(data)) {
        setTables(data);
      }
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
        console.error('Error fetching table data:', data?.error || 'Invalid response');
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

  const currentTable = tables.find(t => t.name === selectedTable);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Database Admin</h1>
          <p className="text-gray-400 mt-1">Manage tables and records • {tables.length} tables available</p>
        </div>
      </div>

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
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black rounded-lg text-sm font-semibold transition-all shadow-lg shadow-amber-500/20"
                >
                  <Plus size={16} />
                  New Record
                </button>
              </div>

              {showAddForm && currentTable && (
                <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-5 space-y-3">
                  <h3 className="font-semibold text-white mb-4">Add New Record</h3>
                  {currentTable.columns
                    .filter(c => c.pk === 0 && !isColumnHidden(selectedTable || '', c.name))
                    .map(col => (
                      <div key={col.name} className="flex flex-col gap-2">
                        <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{col.name}</label>
                        <input
                          type={col.type.includes('INTEGER') || col.type.includes('REAL') ? 'number' : 'text'}
                          value={newRow[col.name] || ''}
                          onChange={e => setNewRow({ ...newRow, [col.name]: e.target.value })}
                          className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-all"
                          placeholder={`Enter ${col.name}`}
                        />
                      </div>
                    ))}
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
                            .map(col => (
                            <td key={col.name} className="px-4 py-3 text-gray-300">
                              {editingRow === rowIndex ? (
                                <input
                                  type={col.type.includes('INTEGER') || col.type.includes('REAL') ? 'number' : 'text'}
                                  value={editValues[col.name] || ''}
                                  onChange={e => setEditValues({ ...editValues, [col.name]: e.target.value })}
                                  disabled={col.pk === 1}
                                  className={`w-full px-2 py-1 bg-gray-800 border border-white/10 rounded text-xs text-white focus:border-amber-500/50 focus:outline-none ${
                                    col.pk === 1 ? 'opacity-50 cursor-not-allowed' : ''
                                  }`}
                                />
                              ) : (
                                <span className={col.pk === 1 ? 'text-amber-300 font-semibold' : ''}>
                                  {String(row[col.name] ?? '—').substring(0, 50)}
                                </span>
                              )}
                            </td>
                          ))}
                          <td className="px-4 py-3 text-right flex justify-end gap-1.5">
                            {editingRow === rowIndex ? (
                              <>
                                <button
                                  onClick={() => handleSave(rowIndex, row)}
                                  className="p-2 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors cursor-pointer"
                                  title="Save"
                                >
                                  <Save size={16} />
                                </button>
                                <button
                                  onClick={() => setEditingRow(null)}
                                  className="p-2 text-gray-400 hover:bg-gray-700/50 rounded-lg transition-colors cursor-pointer"
                                  title="Cancel"
                                >
                                  <X size={16} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleEdit(rowIndex, row)}
                                  className="p-2 text-amber-400 hover:bg-amber-500/20 rounded-lg transition-colors cursor-pointer"
                                  title="Edit"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => handleDelete(rowIndex, row)}
                                  className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer"
                                  title="Delete"
                                >
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
    </div>
  );
}
