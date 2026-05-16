'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import PlayerCard from '@/components/player-card';
import PlayerModal from '@/components/player-modal';
import { Search, SlidersHorizontal, ArrowUpDown, Users } from 'lucide-react';

interface Player {
    id: number; player_name: string; position: string; age: number; country: string;
    jersey_number: number; overall: number; height?: number; attack: number; defense: number; serve: number;
    block: number; receive: number; setting: number; contract_years: number; monthly_wage: number;
    player_value: number; team_id?: number;
    precision: number; flair: number; digging: number; positioning: number;
    ball_control: number; technique: number; playmaking: number; spin: number;
    speed: number; agility: number; strength: number; endurance: number;
    vertical: number; flexibility: number; torque: number; balance: number;
    leadership: number; teamwork: number; concentration: number; pressure: number;
    consistency: number; vision: number; game_iq: number; intimidation: number;
    team_name?: string;
}

export default function TeamPage() {
    const { team } = useAuth();
    const [players, setPlayers] = useState<Player[]>([]);
    const [filtered, setFiltered] = useState<Player[]>([]);
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [search, setSearch] = useState('');
    const [posFilter, setPosFilter] = useState('all');
    const [sortBy, setSortBy] = useState('overall');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    useEffect(() => {
        if (team) {
            fetch(`/api/players?teamId=${team.id}`).then(r => r.json()).then(data => {
                setPlayers(data);
                setFiltered(data);
            });
        }
    }, [team]);

    useEffect(() => {
        let result = [...players];
        if (search) {
            const s = search.toLowerCase();
            result = result.filter(p =>
                p.player_name.toLowerCase().includes(s) ||
                p.country.toLowerCase().includes(s) ||
                p.jersey_number.toString().includes(s)
            );
        }
        if (posFilter !== 'all') result = result.filter(p => p.position === posFilter);
        result.sort((a, b) => {
            const aVal = a[sortBy as keyof Player] as number;
            const bVal = b[sortBy as keyof Player] as number;
            return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
        });
        setFiltered(result);
    }, [players, search, posFilter, sortBy, sortDir]);

    const positions = ['all', ...new Set(players.map(p => p.position))];

    const avgOverall = players.length > 0
        ? Math.round(players.reduce((s, p) => s + p.overall, 0) / players.length)
        : 0;
    const avgAge = players.length > 0
        ? Math.round(players.reduce((s, p) => s + p.age, 0) / players.length)
        : 0;

    return (
        <div className="space-y-6 animate-fade-up">
            {/* Header */}
            <div className="relative flex flex-col sm:flex-row sm:items-end gap-4 sm:justify-between pb-5 border-b border-white/[0.06]">
                <div className="absolute -top-2 left-0 h-[3px] w-16 bg-[var(--volt)]" />
                <div>
                    <p className="eyebrow mb-2">Roster · Players</p>
                    <h1 className="font-display text-5xl tracking-[0.02em] text-[var(--bone)] leading-[0.85]">
                        {(team?.name || 'TEAM').toUpperCase()} <span className="text-[var(--volt)]">ROSTER</span>
                    </h1>
                </div>
                <div className="flex gap-6 font-mono tabular">
                    <div className="text-right">
                        <div className="text-[9px] uppercase tracking-[0.28em] text-[var(--ink-500)]">Players</div>
                        <div className="font-display text-3xl text-[var(--bone)] leading-none mt-1">{players.length}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-[9px] uppercase tracking-[0.28em] text-[var(--ink-500)]">Avg OVR</div>
                        <div className="font-display text-3xl text-[var(--volt)] leading-none mt-1">{avgOverall || '—'}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-[9px] uppercase tracking-[0.28em] text-[var(--ink-500)]">Avg Age</div>
                        <div className="font-display text-3xl text-[var(--bone)] leading-none mt-1">{avgAge || '—'}</div>
                    </div>
                </div>
            </div>

            {/* Filters bar */}
            <div className="surface p-4 flex flex-col gap-3">
                <div className="relative">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-500)]" />
                    <input
                        type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, country, or jersey…"
                        className="w-full pl-11 pr-4 py-3 bg-[var(--ink-850)] border border-white/[0.06] rounded text-[var(--bone)] text-sm placeholder-[var(--ink-500)] focus:outline-none focus:border-[var(--volt)]/60 focus:ring-2 focus:ring-[var(--volt)]/15 transition-all"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <SlidersHorizontal size={13} className="text-[var(--ink-500)] shrink-0" />
                    <div className="flex flex-wrap gap-1.5">
                        {positions.map(pos => (
                            <button key={pos} onClick={() => setPosFilter(pos)}
                                className={`px-3 py-1.5 rounded font-mono text-[10.5px] font-bold uppercase tracking-[0.18em] transition-all cursor-pointer ${posFilter === pos ? 'bg-[var(--volt)] text-[var(--ink-950)]' : 'bg-white/[0.04] text-[var(--ink-400)] hover:text-[var(--bone)] hover:bg-white/[0.08] border border-white/[0.06]'}`}>
                                {pos === 'all' ? 'All' : pos.split(' ').map(w => w[0]).join('')}
                            </button>
                        ))}
                    </div>

                    <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                        className="px-3 py-1.5 bg-[var(--ink-850)] border border-white/[0.08] rounded font-mono text-xs text-[var(--ink-300)] focus:outline-none focus:border-[var(--volt)]/60 ml-auto cursor-pointer">
                        <option value="overall">Sort: Overall</option>
                        <option value="attack">Sort: Attack</option>
                        <option value="defense">Sort: Defense</option>
                        <option value="serve">Sort: Serve</option>
                        <option value="player_value">Sort: Value</option>
                        <option value="age">Sort: Age</option>
                    </select>

                    <button onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                        className="p-2 bg-[var(--ink-850)] border border-white/[0.08] rounded text-[var(--ink-400)] hover:text-[var(--volt)] hover:border-[var(--volt)]/40 transition-all shrink-0 cursor-pointer">
                        <ArrowUpDown size={14} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                {filtered.map(player => (
                    <PlayerCard key={player.id} player={player} onClick={() => setSelectedPlayer(player)} />
                ))}
            </div>

            {filtered.length === 0 && (
                <div className="surface text-center py-16 flex flex-col items-center gap-4">
                    <Users size={36} className="text-[var(--ink-600)]" />
                    <p className="font-display text-xl tracking-wide text-[var(--ink-300)]">NO PLAYERS MATCH</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-500)]">Try a different filter</p>
                </div>
            )}

            {selectedPlayer && <PlayerModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}
        </div>
    );
}
