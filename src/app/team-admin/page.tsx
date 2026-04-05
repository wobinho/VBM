'use client';
import { useState, useEffect } from 'react';
import {
  Plus, Edit2, Save, X, CheckCircle2, Loader2, AlertTriangle,
  ArrowUpDown, Shield, Globe, Trophy, Trash2
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';

interface RowData { [key: string]: any; }

const INPUT_CLS = 'w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-all';
const SELECT_CLS = 'w-full px-3 py-2 bg-[#1a1a2e] border border-white/10 rounded-lg text-sm text-white focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-all';
const LABEL_CLS = 'text-xs font-semibold text-gray-400 uppercase tracking-wider';

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ icon, title, subtitle, children }: {
  icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">{icon}</div>
        <div>
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <p className="text-sm text-gray-400">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// ── Result banner ─────────────────────────────────────────────────────────────
function ResultBanner({ result }: { result: { ok: boolean; message: string } | null }) {
  if (!result) return null;
  return (
    <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border ${
      result.ok
        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
        : 'bg-red-500/10 border-red-500/30 text-red-400'
    }`}>
      {result.ok ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
      {result.message}
    </div>
  );
}

// ── Add Team ──────────────────────────────────────────────────────────────────
function AddTeam({ leagues, onDone }: { leagues: RowData[]; onDone: () => void }) {
  const [form, setForm] = useState({
    id: '', team_name: '', league_id: '', country: '', region: '', team_money: '1000000',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  // Auto-fill country from the selected league
  const handleLeagueChange = (leagueId: string) => {
    set('league_id', leagueId);
    const league = leagues.find(l => String(l.id) === leagueId);
    if (league?.country) set('country', league.country);
  };

  const handleSubmit = async () => {
    if (!form.id || !form.team_name || !form.league_id) {
      setResult({ ok: false, message: 'Team ID, name, and league are required.' });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const body: Record<string, any> = {
        id: Number(form.id),
        team_name: form.team_name.trim(),
        league_id: Number(form.league_id),
        country: form.country.trim() || null,
        team_money: Number(form.team_money) || 1000000,
        played: 0, won: 0, lost: 0, points: 0, score_diff: 0,
        sets_won: 0, sets_lost: 0,
      };
      if (form.region.trim()) body.region = form.region.trim();
      const res = await fetch('/api/admin/table/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setResult({ ok: true, message: `Team "${form.team_name}" created successfully.` });
        setForm({ id: '', team_name: '', league_id: '', country: '', region: '', team_money: '1000000' });
        onDone();
      } else {
        const e = await res.json().catch(() => ({}));
        setResult({ ok: false, message: e.error ?? 'Failed to create team.' });
      }
    } catch (e: any) {
      setResult({ ok: false, message: e.message ?? 'Network error.' });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className={LABEL_CLS}>Team ID</label>
          <input type="number" value={form.id} onChange={e => set('id', e.target.value)} placeholder="e.g. 101" className={INPUT_CLS} />
        </div>
        <div className="space-y-1.5">
          <label className={LABEL_CLS}>Team Name</label>
          <input type="text" value={form.team_name} onChange={e => set('team_name', e.target.value)} placeholder="e.g. Tokyo Spikers" className={INPUT_CLS} />
        </div>
        <div className="space-y-1.5">
          <label className={LABEL_CLS}>League</label>
          <select value={form.league_id} onChange={e => handleLeagueChange(e.target.value)} className={SELECT_CLS}>
            <option value="">— select league —</option>
            {leagues.map(l => <option key={l.id} value={l.id}>{l.league_name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className={LABEL_CLS}>Country <span className="text-gray-600 normal-case font-normal">(auto-filled from league)</span></label>
          <input type="text" value={form.country} onChange={e => set('country', e.target.value)} placeholder="e.g. Italy" className={INPUT_CLS} />
        </div>
        <div className="space-y-1.5">
          <label className={LABEL_CLS}>Region <span className="text-gray-600 normal-case font-normal">(Premier only)</span></label>
          <select value={form.region} onChange={e => set('region', e.target.value)} className={SELECT_CLS}>
            <option value="">— none —</option>
            <option value="north">North</option>
            <option value="south">South</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className={LABEL_CLS}>Team Money</label>
          <input type="number" value={form.team_money} onChange={e => set('team_money', e.target.value)} placeholder="1000000" className={INPUT_CLS} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold
            bg-emerald-500/20 border border-emerald-500/30 text-emerald-400
            hover:bg-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-95"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          {loading ? 'Creating…' : 'Create Team'}
        </button>
        <ResultBanner result={result} />
      </div>
    </div>
  );
}

// ── Team Editor ───────────────────────────────────────────────────────────────
function TeamEditor({ teams, leagues, onDone }: { teams: RowData[]; leagues: RowData[]; onDone: () => void }) {
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setResult(null);
    setDeleteConfirm(false);
    const t = teams.find(t => String(t.id) === id);
    if (t) setForm({ ...t });
    else setForm({});
  };

  const handleSave = async () => {
    if (!selectedId) return;
    setLoading(true);
    setResult(null);
    try {
      const body: Record<string, any> = {
        team_name: form.team_name,
        league_id: Number(form.league_id),
        country: form.country ?? null,
        team_money: Number(form.team_money),
      };
      if (form.region !== undefined) body.region = form.region;
      const res = await fetch(`/api/admin/table/teams/${selectedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setResult({ ok: true, message: 'Team updated successfully.' });
        onDone();
      } else {
        const e = await res.json().catch(() => ({}));
        setResult({ ok: false, message: e.error ?? 'Failed to update team.' });
      }
    } catch (e: any) {
      setResult({ ok: false, message: e.message ?? 'Network error.' });
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/table/teams/${selectedId}`, { method: 'DELETE' });
      if (res.ok) {
        setSelectedId(''); setForm({}); setDeleteConfirm(false);
        onDone();
      } else {
        const e = await res.json().catch(() => ({}));
        setResult({ ok: false, message: e.error ?? 'Failed to delete team.' });
      }
    } catch (e: any) {
      setResult({ ok: false, message: e.message ?? 'Network error.' });
    }
    setDeleting(false);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className={LABEL_CLS}>Select Team to Edit</label>
        <select value={selectedId} onChange={e => handleSelect(e.target.value)} className={SELECT_CLS}>
          <option value="">— select team —</option>
          {[...teams].sort((a, b) => String(a.team_name).localeCompare(String(b.team_name))).map(t => (
            <option key={t.id} value={String(t.id)}>{t.team_name}</option>
          ))}
        </select>
      </div>

      {selectedId && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className={LABEL_CLS}>Team Name</label>
              <input type="text" value={form.team_name ?? ''} onChange={e => set('team_name', e.target.value)} className={INPUT_CLS} />
            </div>
            <div className="space-y-1.5">
              <label className={LABEL_CLS}>League</label>
              <select value={form.league_id ?? ''} onChange={e => set('league_id', e.target.value)} className={SELECT_CLS}>
                <option value="">— select league —</option>
                {leagues.map(l => <option key={l.id} value={l.id}>{l.league_name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={LABEL_CLS}>Country</label>
              <input type="text" value={form.country ?? ''} onChange={e => set('country', e.target.value)} placeholder="e.g. Italy" className={INPUT_CLS} />
            </div>
            <div className="space-y-1.5">
              <label className={LABEL_CLS}>Region</label>
              <select value={form.region ?? ''} onChange={e => set('region', e.target.value)} className={SELECT_CLS}>
                <option value="">— none —</option>
                <option value="north">North</option>
                <option value="south">South</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={LABEL_CLS}>Team Money</label>
              <input type="number" value={form.team_money ?? ''} onChange={e => set('team_money', e.target.value)} className={INPUT_CLS} />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={handleSave} disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30 disabled:opacity-40 transition-all cursor-pointer active:scale-95">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {loading ? 'Saving…' : 'Save Changes'}
              </button>
              <button onClick={() => { setSelectedId(''); setForm({}); setResult(null); setDeleteConfirm(false); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer">
                <X size={14} /> Clear
              </button>
              <ResultBanner result={result} />
            </div>
            {!deleteConfirm ? (
              <button onClick={() => setDeleteConfirm(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all cursor-pointer">
                <Trash2 size={14} /> Delete Team
              </button>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-red-400 font-semibold">Delete {form.team_name}?</span>
                <button onClick={handleDelete} disabled={deleting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg text-sm font-bold transition-all cursor-pointer">
                  <Trash2 size={14} /> {deleting ? 'Deleting…' : 'Confirm'}
                </button>
                <button onClick={() => setDeleteConfirm(false)}
                  className="px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 rounded-lg text-sm transition-all cursor-pointer">
                  Cancel
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Move Team Between Leagues ─────────────────────────────────────────────────
function MoveTeamLeague({ teams, leagues, onDone }: { teams: RowData[]; leagues: RowData[]; onDone: () => void }) {
  const [form, setForm] = useState({ teamId: '', leagueId: '', region: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const handleMove = async () => {
    if (!form.teamId || !form.leagueId) return;
    setLoading(true);
    setResult(null);
    try {
      const body: Record<string, unknown> = { league_id: Number(form.leagueId) };
      if (form.region) body.region = form.region;
      const res = await fetch(`/api/admin/table/teams/${form.teamId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const team = teams.find(t => String(t.id) === form.teamId);
        const league = leagues.find(l => String(l.id) === form.leagueId);
        setResult({ ok: true, message: `${team?.team_name ?? 'Team'} moved to ${league?.league_name ?? `League ${form.leagueId}`}${form.region ? ` (${form.region})` : ''}.` });
        onDone();
      } else {
        const data = await res.json();
        setResult({ ok: false, message: data.error ?? 'Transfer failed.' });
      }
    } catch (e: any) {
      setResult({ ok: false, message: e.message ?? 'Network error.' });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className={LABEL_CLS}>Team</label>
          <select value={form.teamId} onChange={e => set('teamId', e.target.value)} className={SELECT_CLS}>
            <option value="">— select team —</option>
            {[...teams].sort((a, b) => String(a.team_name).localeCompare(String(b.team_name))).map(t => (
              <option key={t.id} value={String(t.id)}>{t.team_name} (League {t.league_id})</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className={LABEL_CLS}>Move to League</label>
          <select value={form.leagueId} onChange={e => set('leagueId', e.target.value)} className={SELECT_CLS}>
            <option value="">— select league —</option>
            {leagues.map(l => <option key={l.id} value={String(l.id)}>{l.league_name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className={LABEL_CLS}>Conference Region <span className="text-gray-600 normal-case font-normal">(Premier only)</span></label>
          <select value={form.region} onChange={e => set('region', e.target.value)} className={SELECT_CLS}>
            <option value="">— unchanged —</option>
            <option value="north">North</option>
            <option value="south">South</option>
          </select>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={handleMove}
          disabled={loading || !form.teamId || !form.leagueId}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold
            bg-amber-500/20 border border-amber-500/30 text-amber-400
            hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-95"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowUpDown size={14} />}
          {loading ? 'Moving…' : 'Move Team'}
        </button>
        <ResultBanner result={result} />
      </div>
    </div>
  );
}

// ── League Creator ────────────────────────────────────────────────────────────
function LeagueCreator({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({ id: '', league_name: '', country: '', tier: '2' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const handleCreate = async () => {
    if (!form.id || !form.league_name) {
      setResult({ ok: false, message: 'League ID and name are required.' });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/table/leagues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: Number(form.id),
          league_name: form.league_name.trim(),
          country: form.country.trim() || null,
          tier: Number(form.tier) || 2,
        }),
      });
      if (res.ok) {
        setResult({ ok: true, message: `League "${form.league_name}" created successfully.` });
        setForm({ id: '', league_name: '', country: '', tier: '2' });
        onDone();
      } else {
        const e = await res.json().catch(() => ({}));
        setResult({ ok: false, message: e.error ?? 'Failed to create league.' });
      }
    } catch (e: any) {
      setResult({ ok: false, message: e.message ?? 'Network error.' });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          <label className={LABEL_CLS}>League ID</label>
          <input type="number" value={form.id} onChange={e => set('id', e.target.value)} placeholder="e.g. 5" className={INPUT_CLS} />
        </div>
        <div className="space-y-1.5">
          <label className={LABEL_CLS}>League Name</label>
          <input type="text" value={form.league_name} onChange={e => set('league_name', e.target.value)} placeholder="e.g. Japan Premier League" className={INPUT_CLS} />
        </div>
        <div className="space-y-1.5">
          <label className={LABEL_CLS}>Country</label>
          <input type="text" value={form.country} onChange={e => set('country', e.target.value)} placeholder="e.g. Japan" className={INPUT_CLS} />
        </div>
        <div className="space-y-1.5">
          <label className={LABEL_CLS}>Tier <span className="text-gray-600 normal-case font-normal">(1=top)</span></label>
          <input type="number" min={1} max={10} value={form.tier} onChange={e => set('tier', e.target.value)} placeholder="2" className={INPUT_CLS} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={handleCreate}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold
            bg-emerald-500/20 border border-emerald-500/30 text-emerald-400
            hover:bg-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-95"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          {loading ? 'Creating…' : 'Create League'}
        </button>
        <ResultBanner result={result} />
      </div>
    </div>
  );
}

// ── League Editor ─────────────────────────────────────────────────────────────
function LeagueEditor({ leagues, onDone }: { leagues: RowData[]; onDone: () => void }) {
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setResult(null);
    setDeleteConfirm(false);
    const l = leagues.find(l => String(l.id) === id);
    if (l) setForm({ ...l });
    else setForm({});
  };

  const handleSave = async () => {
    if (!selectedId) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/table/leagues/${selectedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          league_name: form.league_name,
          country: form.country ?? null,
          tier: Number(form.tier) || 2,
        }),
      });
      if (res.ok) {
        setResult({ ok: true, message: 'League updated successfully.' });
        onDone();
      } else {
        const e = await res.json().catch(() => ({}));
        setResult({ ok: false, message: e.error ?? 'Failed to update league.' });
      }
    } catch (e: any) {
      setResult({ ok: false, message: e.message ?? 'Network error.' });
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/table/leagues/${selectedId}`, { method: 'DELETE' });
      if (res.ok) {
        setSelectedId(''); setForm({}); setDeleteConfirm(false);
        onDone();
      } else {
        const e = await res.json().catch(() => ({}));
        setResult({ ok: false, message: e.error ?? 'Failed to delete league.' });
      }
    } catch (e: any) {
      setResult({ ok: false, message: e.message ?? 'Network error.' });
    }
    setDeleting(false);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className={LABEL_CLS}>Select League to Edit</label>
        <select value={selectedId} onChange={e => handleSelect(e.target.value)} className={SELECT_CLS}>
          <option value="">— select league —</option>
          {leagues.map(l => <option key={l.id} value={String(l.id)}>{l.league_name}</option>)}
        </select>
      </div>

      {selectedId && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className={LABEL_CLS}>League Name</label>
              <input type="text" value={form.league_name ?? ''} onChange={e => set('league_name', e.target.value)} className={INPUT_CLS} />
            </div>
            <div className="space-y-1.5">
              <label className={LABEL_CLS}>Country</label>
              <input type="text" value={form.country ?? ''} onChange={e => set('country', e.target.value)} placeholder="e.g. Italy" className={INPUT_CLS} />
            </div>
            <div className="space-y-1.5">
              <label className={LABEL_CLS}>Tier <span className="text-gray-600 normal-case font-normal">(1=top flight)</span></label>
              <input type="number" min={1} max={10} value={form.tier ?? 2} onChange={e => set('tier', e.target.value)} className={INPUT_CLS} />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={handleSave} disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30 disabled:opacity-40 transition-all cursor-pointer active:scale-95">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {loading ? 'Saving…' : 'Save Changes'}
              </button>
              <button onClick={() => { setSelectedId(''); setForm({}); setResult(null); setDeleteConfirm(false); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer">
                <X size={14} /> Clear
              </button>
              <ResultBanner result={result} />
            </div>
            {!deleteConfirm ? (
              <button onClick={() => setDeleteConfirm(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all cursor-pointer">
                <Trash2 size={14} /> Delete League
              </button>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-red-400 font-semibold">Delete {form.league_name}?</span>
                <button onClick={handleDelete} disabled={deleting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg text-sm font-bold transition-all cursor-pointer">
                  <Trash2 size={14} /> {deleting ? 'Deleting…' : 'Confirm'}
                </button>
                <button onClick={() => setDeleteConfirm(false)}
                  className="px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 rounded-lg text-sm transition-all cursor-pointer">
                  Cancel
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TeamAdminPage() {
  const { isAdmin } = useAuth();
  const [teams, setTeams] = useState<RowData[]>([]);
  const [leagues, setLeagues] = useState<RowData[]>([]);

  const loadData = async () => {
    try {
      const [tr, lr] = await Promise.all([
        fetch('/api/admin/table/teams'),
        fetch('/api/admin/table/leagues'),
      ]);
      if (tr.ok) setTeams(await tr.json());
      if (lr.ok) setLeagues(await lr.json());
    } catch {}
  };

  useEffect(() => { loadData(); }, []);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="text-6xl">🔒</div>
        <h2 className="text-2xl font-bold text-white">Access Denied</h2>
        <p className="text-gray-400">You do not have admin privileges.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Team Admin</h1>
        <p className="text-gray-400 mt-1">Create and manage teams and leagues</p>
      </div>

      {/* Add Team */}
      <Section icon={<Plus size={20} className="text-amber-400" />} title="Add Team" subtitle="Create a new team and assign it to a league">
        <AddTeam leagues={leagues} onDone={loadData} />
      </Section>

      {/* Team Editor */}
      <Section icon={<Edit2 size={20} className="text-amber-400" />} title="Team Editor" subtitle="Edit an existing team's details">
        <TeamEditor teams={teams} leagues={leagues} onDone={loadData} />
      </Section>

      {/* Move Team Between Leagues */}
      <Section icon={<ArrowUpDown size={20} className="text-amber-400" />} title="Move Team Between Leagues" subtitle="Manually transfer any team to a different league and update its conference region">
        <MoveTeamLeague teams={teams} leagues={leagues} onDone={loadData} />
      </Section>

      {/* League Creator */}
      <Section icon={<Trophy size={20} className="text-amber-400" />} title="League Creator" subtitle="Create a new league">
        <LeagueCreator onDone={loadData} />
      </Section>

      {/* League Editor */}
      <Section icon={<Globe size={20} className="text-amber-400" />} title="League Editor" subtitle="Edit an existing league's details">
        <LeagueEditor leagues={leagues} onDone={loadData} />
      </Section>
    </div>
  );
}
