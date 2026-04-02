'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import PlayerCard from '@/components/player-card';
import PlayerModal from '@/components/player-modal';
import { Search, SlidersHorizontal, ArrowUpDown } from 'lucide-react';

interface Player {
    id: number; player_name: string; position: string; age: number; country: string;
    jersey_number: number; overall: number; attack: number; defense: number; serve: number;
    block: number; receive: number; setting: number; contract_years: number; monthly_wage: number;
    player_value: number; team_id?: number; speed: number; agility: number; strength: number; endurance: number;
    height: number; leadership: number; teamwork: number; concentration: number;
    pressure_handling: number; jump_serve: number; float_serve: number; spike_power: number;
    spike_accuracy: number; block_timing: number; dig_technique: number; experience: number;
    potential: number; consistency: number; team_name?: string;
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

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">{team?.name || 'Team'} Roster</h1>
                <p className="text-sm text-gray-400">{players.length} players total</p>
            </div>

            <div className="flex flex-col gap-3">
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                        type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search players..."
                        className="w-full pl-10 pr-4 py-2 md:py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-all"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <SlidersHorizontal size={14} className="text-gray-500 shrink-0" />
                    <div className="flex flex-wrap gap-1.5">
                        {positions.map(pos => (
                            <button key={pos} onClick={() => setPosFilter(pos)}
                                className={`px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-[11px] md:text-xs font-medium transition-all ${posFilter === pos ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'}`}>
                                {pos === 'all' ? 'All' : pos.split(' ').map(w => w[0]).join('')}
                            </button>
                        ))}
                    </div>

                    <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                        className="px-2 md:px-3 py-1.5 md:py-2 bg-white/5 border border-white/10 rounded-xl text-xs md:text-sm text-gray-300 focus:outline-none ml-auto">
                        <option value="overall">Overall</option>
                        <option value="attack">Attack</option>
                        <option value="defense">Defense</option>
                        <option value="serve">Serve</option>
                        <option value="player_value">Value</option>
                        <option value="age">Age</option>
                    </select>

                    <button onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                        className="p-1.5 md:p-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white transition-all shrink-0">
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
                <div className="text-center py-12 text-gray-500">No players found matching your criteria.</div>
            )}

            {selectedPlayer && <PlayerModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}
        </div>
    );
}
