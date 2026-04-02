'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Eye, EyeOff, LogIn, UserPlus, Loader2 } from 'lucide-react';

interface Team { id: number; team_name: string; }

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md mx-4 bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                <div className="p-8 text-center border-b border-white/10 bg-gradient-to-br from-amber-500/10 to-orange-500/10">
                    <div className="text-4xl mb-3">🏐</div>
                    <h2 className="text-2xl font-bold text-white">Spike Dynasty</h2>
                    <p className="text-sm text-gray-400 mt-1">Volleyball Manager</p>
                </div>

                <div className="p-6">
                    {error && (
                        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
                    )}

                    {view === 'team' ? (
                        <div className="space-y-4">
                            {teamView === 'select' ? (
                                <>
                                    <div>
                                        <h3 className="text-lg font-semibold text-white">Choose a Team</h3>
                                        <p className="text-sm text-gray-400 mt-1">Join an existing team or create a new one.</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wide mb-1.5">League</label>
                                        <select
                                            value={selectedLeagueId}
                                            onChange={e => {
                                                setSelectedLeagueId(e.target.value ? Number(e.target.value) : '');
                                                setSelectedTeamId('');
                                            }}
                                            className="w-full px-4 py-3 bg-gray-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
                                        >
                                            <option value="">Select a league...</option>
                                            {availableLeagues.map(l => (
                                                <option key={l.id} value={l.id}>{l.league_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {selectedLeagueId && leagueTeams.length > 0 && (
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wide mb-1.5">Available Teams</label>
                                            <select
                                                value={selectedTeamId}
                                                onChange={e => setSelectedTeamId(e.target.value ? Number(e.target.value) : '')}
                                                className="w-full px-4 py-3 bg-gray-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
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
                                            className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold hover:from-green-400 hover:to-emerald-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {loading ? <><Loader2 size={16} className="animate-spin" /> Joining...</> : <>✓ Join Team</>}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => {
                                            setTeamView('create');
                                            setTeamName('');
                                        }}
                                        className="w-full py-2 text-sm text-amber-400 hover:text-amber-300 font-medium border border-amber-500/30 rounded-xl hover:bg-amber-500/10 transition-all"
                                    >
                                        Or Create a New Team
                                    </button>
                                </>
                            ) : teamView === 'create' ? (
                                <>
                                    <div>
                                        <h3 className="text-lg font-semibold text-white">Create Your Team</h3>
                                        <p className="text-sm text-gray-400 mt-1">Choose a name and league for your new team.</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wide mb-1.5">Team Name</label>
                                        <input
                                            type="text"
                                            value={teamName}
                                            onChange={e => setTeamName(e.target.value)}
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
                                            placeholder="e.g. Coastal Thunder"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wide mb-1.5">League</label>
                                        <select
                                            value={selectedLeagueId}
                                            onChange={e => setSelectedLeagueId(e.target.value ? Number(e.target.value) : '')}
                                            className="w-full px-4 py-3 bg-gray-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
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
                                        className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold hover:from-amber-400 hover:to-orange-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {loading ? <><Loader2 size={16} className="animate-spin" /> Creating...</> : <>🏐 Create Team</>}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setTeamView('select');
                                            setSelectedLeagueId('');
                                            setSelectedTeamId('');
                                        }}
                                        className="w-full py-2 text-sm text-gray-400 hover:text-gray-300 font-medium transition-all"
                                    >
                                        Back
                                    </button>
                                </>
                            ) : null}
                        </div>
                    ) : (
                        <form onSubmit={view === 'login' ? handleLogin : handleRegister} className="space-y-4">
                            {view === 'register' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Username</label>
                                        <input type="text" value={username} onChange={e => setUsername(e.target.value)} required
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all" placeholder="johndoe" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Display Name</label>
                                        <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} required
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all" placeholder="John Doe" />
                                    </div>
                                </>
                            )}
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all" placeholder="you@example.com" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1.5">Password</label>
                                <div className="relative">
                                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all pr-10" placeholder="••••••••" />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                            <button type="submit" disabled={loading}
                                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold hover:from-amber-400 hover:to-orange-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                                {loading ? 'Loading...' : view === 'login' ? <><LogIn size={16} /> Sign In</> : <><UserPlus size={16} /> Create Account</>}
                            </button>
                        </form>
                    )}

                    {view !== 'team' && (
                        <p className="mt-4 text-center text-sm text-gray-500">
                            {view === 'login' ? "Don't have an account? " : 'Already have an account? '}
                            <button onClick={() => { setView(view === 'login' ? 'register' : 'login'); setError(''); }}
                                className="text-amber-400 hover:text-amber-300 font-medium">
                                {view === 'login' ? 'Register' : 'Sign In'}
                            </button>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
