'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Eye, EyeOff, LogIn, UserPlus, Loader2, ArrowLeft } from 'lucide-react';

interface Team { id: number; team_name: string; }

const inputClass = "w-full px-4 py-3 bg-[var(--ink-850)] border border-white/10 rounded text-[var(--bone)] placeholder-[var(--ink-500)] focus:outline-none focus:border-[var(--volt)]/60 focus:ring-2 focus:ring-[var(--volt)]/15 transition-all font-body";
const labelClass = "block font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--ink-400)] mb-2";

export default function AuthModal() {
    const { user, team, login, register, createTeam, joinTeam, availableLeagues } = useAuth();
    const [view, setView] = useState<'login' | 'register' | 'team'>('login');
    const [teamView, setTeamView] = useState<'select' | 'create' | 'join'>('select');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [teamName, setTeamName] = useState('');
    const [selectedLeagueId, setSelectedLeagueId] = useState<number | ''>('');
    const [leagueTeams, setLeagueTeams] = useState<Team[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<number | ''>('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    if (user && team) return null;
    if (user && !team && view !== 'team') {
        setView('team');
    }

    useEffect(() => {
        if (selectedLeagueId) {
            fetch(`/api/teams?leagueId=${selectedLeagueId}`)
                .then(res => res.json())
                .then(teams => setLeagueTeams(teams))
                .catch(() => setLeagueTeams([]));
        } else {
            setLeagueTeams([]);
        }
    }, [selectedLeagueId]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); setError('');
        const result = await login(email, password);
        if (!result.success) setError(result.error || 'Login failed');
        setLoading(false);
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); setError('');
        const result = await register({ email, password, username, displayName });
        if (!result.success) setError(result.error || 'Registration failed');
        else setView('team');
        setLoading(false);
    };

    const handleCreateTeam = async () => {
        if (!teamName.trim() || !selectedLeagueId) return;
        setLoading(true); setError('');
        const result = await createTeam(teamName.trim(), Number(selectedLeagueId));
        if (!result.success) setError(result.error || 'Failed to create team');
        setLoading(false);
    };

    const handleJoinTeam = async () => {
        if (!selectedTeamId) return;
        setLoading(true); setError('');
        const result = await joinTeam(Number(selectedTeamId));
        if (!result.success) setError(result.error || 'Failed to join team');
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
            <div className="w-full max-w-md surface-raised overflow-hidden animate-fade-up">
                {/* Header */}
                <div className="relative p-8 text-center border-b border-white/[0.06] overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-[var(--volt)]" />
                    <div className="absolute -top-20 -right-16 w-48 h-48 rounded-full bg-[var(--volt)]/10 blur-3xl" />
                    <div className="relative">
                        <div className="text-5xl mb-3 animate-float inline-block">🏐</div>
                        <h2 className="font-display text-3xl tracking-[0.06em] text-[var(--bone)]">SPIKE DYNASTY</h2>
                        <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-[var(--ink-400)] mt-2">Volleyball Manager · Season 1</p>
                    </div>
                </div>

                <div className="p-7">
                    {error && (
                        <div className="mb-5 p-3.5 rounded border border-[var(--loss)]/40 bg-[var(--loss)]/10 text-[var(--loss)] text-sm font-medium">{error}</div>
                    )}

                    {view === 'team' ? (
                        <div className="space-y-5">
                            {teamView === 'select' ? (
                                <>
                                    <div>
                                        <p className="eyebrow mb-1.5">Step 02</p>
                                        <h3 className="font-display text-2xl tracking-wide text-[var(--bone)]">CHOOSE A TEAM</h3>
                                        <p className="text-sm text-[var(--ink-400)] mt-2">Join an existing squad or build your own dynasty.</p>
                                    </div>
                                    <div>
                                        <label className={labelClass}>League</label>
                                        <select
                                            value={selectedLeagueId}
                                            onChange={e => {
                                                setSelectedLeagueId(e.target.value ? Number(e.target.value) : '');
                                                setSelectedTeamId('');
                                            }}
                                            className={inputClass}
                                        >
                                            <option value="">Select a league...</option>
                                            {availableLeagues.map(l => (
                                                <option key={l.id} value={l.id}>{l.league_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {selectedLeagueId && leagueTeams.length > 0 && (
                                        <div>
                                            <label className={labelClass}>Available Teams</label>
                                            <select
                                                value={selectedTeamId}
                                                onChange={e => setSelectedTeamId(e.target.value ? Number(e.target.value) : '')}
                                                className={inputClass}
                                            >
                                                <option value="">Select a team...</option>
                                                {leagueTeams.map(t => (
                                                    <option key={t.id} value={t.id}>{t.team_name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    {selectedTeamId && (
                                        <button
                                            onClick={handleJoinTeam}
                                            disabled={loading}
                                            className="btn-volt w-full flex items-center justify-center gap-2"
                                        >
                                            {loading ? <><Loader2 size={15} className="animate-spin" /> Joining…</> : <>Join Team</>}
                                        </button>
                                    )}
                                    <div className="flex items-center gap-3 py-2">
                                        <div className="flex-1 h-px bg-white/[0.06]" />
                                        <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[var(--ink-500)]">or</span>
                                        <div className="flex-1 h-px bg-white/[0.06]" />
                                    </div>
                                    <button
                                        onClick={() => { setTeamView('create'); setTeamName(''); }}
                                        className="btn-ghost w-full"
                                    >
                                        Create a New Franchise
                                    </button>
                                </>
                            ) : teamView === 'create' ? (
                                <>
                                    <div>
                                        <p className="eyebrow mb-1.5">New Franchise</p>
                                        <h3 className="font-display text-2xl tracking-wide text-[var(--bone)]">FORGE YOUR DYNASTY</h3>
                                        <p className="text-sm text-[var(--ink-400)] mt-2">Pick a name and league. Make it legendary.</p>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Team Name</label>
                                        <input
                                            type="text"
                                            value={teamName}
                                            onChange={e => setTeamName(e.target.value)}
                                            className={inputClass}
                                            placeholder="e.g. Coastal Thunder"
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>League</label>
                                        <select
                                            value={selectedLeagueId}
                                            onChange={e => setSelectedLeagueId(e.target.value ? Number(e.target.value) : '')}
                                            className={inputClass}
                                        >
                                            <option value="">Select a league...</option>
                                            {availableLeagues.map(l => (
                                                <option key={l.id} value={l.id}>{l.league_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <button
                                        onClick={handleCreateTeam}
                                        disabled={loading || !teamName.trim() || !selectedLeagueId}
                                        className="btn-volt w-full flex items-center justify-center gap-2"
                                    >
                                        {loading ? <><Loader2 size={15} className="animate-spin" /> Creating…</> : <>Create Team</>}
                                    </button>
                                    <button
                                        onClick={() => { setTeamView('select'); setSelectedLeagueId(''); setSelectedTeamId(''); }}
                                        className="w-full flex items-center justify-center gap-2 py-2 text-xs font-mono uppercase tracking-[0.22em] text-[var(--ink-400)] hover:text-[var(--bone)] transition-colors"
                                    >
                                        <ArrowLeft size={12} /> Back
                                    </button>
                                </>
                            ) : null}
                        </div>
                    ) : (
                        <form onSubmit={view === 'login' ? handleLogin : handleRegister} className="space-y-5">
                            <div>
                                <p className="eyebrow mb-1.5">{view === 'login' ? 'Welcome back' : 'New manager'}</p>
                                <h3 className="font-display text-2xl tracking-wide text-[var(--bone)]">
                                    {view === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
                                </h3>
                            </div>

                            {view === 'register' && (
                                <>
                                    <div>
                                        <label className={labelClass}>Username</label>
                                        <input type="text" value={username} onChange={e => setUsername(e.target.value)} required
                                            className={inputClass} placeholder="johndoe" />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Display Name</label>
                                        <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} required
                                            className={inputClass} placeholder="John Doe" />
                                    </div>
                                </>
                            )}
                            <div>
                                <label className={labelClass}>Email</label>
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                                    className={inputClass} placeholder="you@example.com" />
                            </div>
                            <div>
                                <label className={labelClass}>Password</label>
                                <div className="relative">
                                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                                        className={`${inputClass} pr-11`} placeholder="••••••••" />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-500)] hover:text-[var(--bone)] transition-colors">
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                            <button type="submit" disabled={loading}
                                className="btn-volt w-full flex items-center justify-center gap-2">
                                {loading ? <><Loader2 size={15} className="animate-spin" /> Loading…</> : view === 'login' ? <><LogIn size={15} /> Sign In</> : <><UserPlus size={15} /> Create Account</>}
                            </button>
                        </form>
                    )}

                    {view !== 'team' && (
                        <p className="mt-6 text-center text-sm text-[var(--ink-400)]">
                            {view === 'login' ? "Don't have an account? " : 'Already have an account? '}
                            <button onClick={() => { setView(view === 'login' ? 'register' : 'login'); setError(''); }}
                                className="text-[var(--volt)] hover:text-[var(--volt-bright)] font-bold font-mono uppercase tracking-[0.15em] text-xs ml-1">
                                {view === 'login' ? 'Register' : 'Sign In'}
                            </button>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
