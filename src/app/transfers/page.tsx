'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import PlayerCard from '@/components/player-card';
import PlayerModal from '@/components/player-modal';
import { Search, ShoppingCart, Inbox, Send, DollarSign } from 'lucide-react';

interface Player {
    id: number; player_name: string; position: string; age: number; country: string;
    jersey_number: number; overall: number; attack: number; defense: number; serve: number;
    block: number; receive: number; setting: number; contract_years: number; monthly_wage: number;
    player_value: number; speed: number; agility: number; strength: number; endurance: number;
    height: number; leadership: number; teamwork: number; concentration: number;
    pressure_handling: number; jump_serve: number; float_serve: number; spike_power: number;
    spike_accuracy: number; block_timing: number; dig_technique: number; experience: number;
    potential: number; consistency: number; team_name?: string; team_id: number | null;
}

interface Offer {
    id: number; player_name: string; offer_amount: number; status: string;
    from_team_name: string; to_team_name: string; created_at: string;
}

type Tab = 'market' | 'received' | 'sent';

export default function TransfersPage() {
    const { team } = useAuth();
    const [tab, setTab] = useState<Tab>('market');
    const [freeAgents, setFreeAgents] = useState<Player[]>([]);
    const [allPlayers, setAllPlayers] = useState<Player[]>([]);
    const [receivedOffers, setReceivedOffers] = useState<Offer[]>([]);
    const [sentOffers, setSentOffers] = useState<Offer[]>([]);
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [search, setSearch] = useState('');
    const [showFreeOnly, setShowFreeOnly] = useState(false);

    useEffect(() => {
        fetch('/api/players?freeAgents=true').then(r => r.json()).then(setFreeAgents);
        fetch('/api/players').then(r => r.json()).then(setAllPlayers);
        fetch('/api/offers?type=received').then(r => r.json()).then(setReceivedOffers).catch(() => { });
        fetch('/api/offers?type=sent').then(r => r.json()).then(setSentOffers).catch(() => { });
    }, []);

    const marketPlayers = showFreeOnly ? freeAgents : allPlayers.filter(p => p.team_id !== team?.id);
    const filtered = search
        ? marketPlayers.filter(p => p.player_name.toLowerCase().includes(search.toLowerCase()))
        : marketPlayers;

    const fmt = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${(n / 1e3).toFixed(0)}K`;

    const tabs = [
        { key: 'market' as Tab, label: 'Market', icon: ShoppingCart, count: filtered.length },
        { key: 'received' as Tab, label: 'Received', icon: Inbox, count: receivedOffers.length },
        { key: 'sent' as Tab, label: 'Sent', icon: Send, count: sentOffers.length },
    ];

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-white">Transfer Market</h1>
            <div className="flex gap-1 md:gap-2 flex-wrap">
                {tabs.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`flex items-center gap-1 md:gap-2 px-2 md:px-4 py-1.5 md:py-2.5 rounded-xl text-xs md:text-sm font-medium transition-all ${tab === t.key ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-white/5 text-gray-400 border border-white/10'}`}>
                        <t.icon size={12} className="md:w-3.5 md:h-3.5" /><span className="hidden sm:inline">{t.label}</span>
                        <span className="px-1 md:px-1.5 py-0.5 rounded-md text-[9px] md:text-[10px] font-bold bg-white/10 text-gray-500">{t.count}</span>
                    </button>
                ))}
            </div>

            {tab === 'market' && (
                <>
                    <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
                                className="w-full pl-10 pr-4 py-2 md:py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500/50" />
                        </div>
                        <button onClick={() => setShowFreeOnly(!showFreeOnly)}
                            className={`px-3 md:px-4 py-2 rounded-xl text-xs md:text-sm transition-all shrink-0 ${showFreeOnly ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-gray-400 border border-white/10'}`}>
                            Free Agents
                        </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                        {filtered.slice(0, 50).map(p => <PlayerCard key={p.id} player={p} onClick={() => setSelectedPlayer(p)} />)}
                    </div>
                    {filtered.length === 0 && <div className="text-center py-12 text-gray-500">No players found.</div>}
                </>
            )}

            {(tab === 'received' || tab === 'sent') && (
                <div className="space-y-2 md:space-y-3">
                    {(tab === 'received' ? receivedOffers : sentOffers).length === 0 && <div className="text-center py-12 text-gray-500">No offers.</div>}
                    {(tab === 'received' ? receivedOffers : sentOffers).map(o => (
                        <div key={o.id} className="p-3 md:p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                            <div className="min-w-0">
                                <p className="text-xs md:text-sm font-semibold text-white truncate">{o.player_name}</p>
                                <p className="text-[10px] md:text-xs text-gray-500 truncate">{tab === 'received' ? `From: ${o.from_team_name}` : `To: ${o.to_team_name}`}</p>
                            </div>
                            <div className="flex items-center gap-2 md:gap-3 shrink-0">
                                <span className="flex items-center gap-0.5 md:gap-1 text-xs md:text-sm font-bold text-emerald-400"><DollarSign size={12} className="md:w-3.5 md:h-3.5" />{fmt(o.offer_amount)}</span>
                                <span className={`px-1.5 md:px-2 py-0.5 md:py-1 rounded-lg text-[10px] md:text-xs font-bold whitespace-nowrap ${o.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : o.status === 'accepted' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{o.status}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {selectedPlayer && <PlayerModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}
        </div>
    );
}
