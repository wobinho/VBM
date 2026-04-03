'use client';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import PlayerCard from '@/components/player-card';
import PlayerModal from '@/components/player-modal';
import { Search, ShoppingCart, Inbox, Send, DollarSign, Filter, ChevronDown, X } from 'lucide-react';

interface Player {
    id: number; player_name: string; position: string; age: number; country: string;
    jersey_number: number; overall: number; height?: number; attack: number; defense: number; serve: number;
    block: number; receive: number; setting: number; contract_years: number; monthly_wage: number;
    player_value: number;
    precision: number; flair: number; digging: number; positioning: number;
    ball_control: number; technique: number; playmaking: number; spin: number;
    speed: number; agility: number; strength: number; endurance: number;
    vertical: number; flexibility: number; torque: number; balance: number;
    leadership: number; teamwork: number; concentration: number; pressure: number;
    consistency: number; vision: number; game_iq: number; intimidation: number;
    team_name?: string; team_id: number | null;
}

interface League {
    id: number;
    league_name: string;
}

interface TeamInfo {
    id: number;
    team_name: string;
    league_id: number;
    nation?: string;
}

interface Offer {
    id: number; player_name: string; offer_amount: number; status: string;
    from_team_name: string; to_team_name: string; created_at: string;
}

type Tab = 'market' | 'received' | 'sent';

const POSITIONS = ['All', 'Outside Hitter', 'Middle Blocker', 'Opposite Hitter', 'Setter', 'Libero'];

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button onClick={onClick}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${active
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-white/5 text-gray-400 border border-white/10 hover:border-white/20 hover:text-gray-200'}`}>
            {label}
        </button>
    );
}

function CollapsibleSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div>
            <button onClick={() => setOpen(!open)}
                className="flex items-center justify-between w-full text-[10px] uppercase tracking-widest text-gray-500 font-semibold mb-2 cursor-pointer hover:text-gray-300 transition-colors">
                {title}
                <ChevronDown size={12} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && children}
        </div>
    );
}

export default function TransfersPage() {
    const { team } = useAuth();
    const [tab, setTab] = useState<Tab>('market');
    const [freeAgents, setFreeAgents] = useState<Player[]>([]);
    const [allPlayers, setAllPlayers] = useState<Player[]>([]);
    const [leagues, setLeagues] = useState<League[]>([]);
    const [teams, setTeams] = useState<TeamInfo[]>([]);
    const [receivedOffers, setReceivedOffers] = useState<Offer[]>([]);
    const [sentOffers, setSentOffers] = useState<Offer[]>([]);
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

    // Filter state
    const [search, setSearch] = useState('');
    const [showFreeOnly, setShowFreeOnly] = useState(false);
    const [selectedLeague, setSelectedLeague] = useState<number | null>(null);
    const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
    const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
    const [selectedPosition, setSelectedPosition] = useState<string>('All');
    const [filtersOpen, setFiltersOpen] = useState(true);

    useEffect(() => {
        fetch('/api/players?freeAgents=true').then(r => r.json()).then(setFreeAgents);
        fetch('/api/players').then(r => r.json()).then(setAllPlayers);
        fetch('/api/leagues').then(r => r.json()).then(setLeagues);
        fetch('/api/teams').then(r => r.json()).then(setTeams);
        fetch('/api/offers?type=received').then(r => r.json()).then(setReceivedOffers).catch(() => { });
        fetch('/api/offers?type=sent').then(r => r.json()).then(setSentOffers).catch(() => { });
    }, []);

    // Derive unique countries from all players
    const countries = useMemo(() => {
        const set = new Set(allPlayers.map(p => p.country).filter(Boolean));
        return Array.from(set).sort();
    }, [allPlayers]);

    // Teams filtered by selected league
    const filteredTeams = useMemo(() => {
        if (selectedLeague === null) return teams;
        return teams.filter(t => t.league_id === selectedLeague);
    }, [teams, selectedLeague]);

    // Build a map: teamId → leagueId for fast filtering
    const teamLeagueMap = useMemo(() => {
        const map: Record<number, number> = {};
        for (const t of teams) map[t.id] = t.league_id;
        return map;
    }, [teams]);

    const marketPlayers = showFreeOnly ? freeAgents : allPlayers.filter(p => p.team_id !== team?.id);

    const filtered = useMemo(() => {
        let list = marketPlayers;
        if (search) list = list.filter(p => p.player_name.toLowerCase().includes(search.toLowerCase()));
        if (selectedPosition !== 'All') list = list.filter(p => p.position === selectedPosition);
        if (selectedCountry) list = list.filter(p => p.country === selectedCountry);
        if (selectedTeam !== null) {
            list = list.filter(p => p.team_id === selectedTeam);
        } else if (selectedLeague !== null) {
            list = list.filter(p => p.team_id !== null && teamLeagueMap[p.team_id] === selectedLeague);
        }
        return list;
    }, [marketPlayers, search, selectedPosition, selectedCountry, selectedTeam, selectedLeague, teamLeagueMap]);

    const hasActiveFilters = showFreeOnly || selectedLeague !== null || selectedTeam !== null || selectedCountry !== null || selectedPosition !== 'All';

    function clearFilters() {
        setShowFreeOnly(false);
        setSelectedLeague(null);
        setSelectedTeam(null);
        setSelectedCountry(null);
        setSelectedPosition('All');
    }

    const fmt = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${(n / 1e3).toFixed(0)}K`;

    const tabs = [
        { key: 'market' as Tab, label: 'Market', icon: ShoppingCart, count: filtered.length },
        { key: 'received' as Tab, label: 'Received', icon: Inbox, count: receivedOffers.length },
        { key: 'sent' as Tab, label: 'Sent', icon: Send, count: sentOffers.length },
    ];

    return (
        <div className="space-y-5">
            {/* Page header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">Transfer Market</h1>
                {hasActiveFilters && (
                    <button onClick={clearFilters}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all cursor-pointer">
                        <X size={12} />Clear Filters
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 md:gap-2 flex-wrap">
                {tabs.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`flex items-center gap-1 md:gap-2 px-3 md:px-4 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-medium transition-all cursor-pointer ${tab === t.key
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-sm shadow-amber-900/20'
                            : 'bg-white/5 text-gray-400 border border-white/10 hover:border-white/20'}`}>
                        <t.icon size={12} className="md:w-3.5 md:h-3.5" />
                        <span className="hidden sm:inline">{t.label}</span>
                        <span className="px-1.5 py-0.5 rounded-md text-[9px] md:text-[10px] font-bold bg-white/10 text-gray-500">{t.count}</span>
                    </button>
                ))}
            </div>

            {tab === 'market' && (
                <div className="flex gap-4 items-start">
                    {/* ── Filters sidebar ──────────────────────────────────── */}
                    <aside className="hidden lg:flex flex-col w-56 shrink-0 gap-4">
                        {/* Filter panel */}
                        <div className="rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800/80 border border-white/10 p-4 space-y-5">
                            <div className="flex items-center gap-2">
                                <Filter size={13} className="text-amber-400" />
                                <span className="text-xs font-bold uppercase tracking-wider text-gray-300">Filters</span>
                            </div>

                            {/* Free agents toggle */}
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-400">Free Agents Only</span>
                                <button onClick={() => setShowFreeOnly(!showFreeOnly)}
                                    className={`relative w-10 h-5 rounded-full transition-all cursor-pointer ${showFreeOnly ? 'bg-amber-500' : 'bg-white/10'}`}>
                                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${showFreeOnly ? 'translate-x-5' : ''}`} />
                                </button>
                            </div>

                            {/* Position */}
                            <CollapsibleSection title="Position">
                                <div className="flex flex-col gap-1">
                                    {POSITIONS.map(pos => (
                                        <FilterPill key={pos}
                                            label={pos === 'All' ? 'All Positions' : pos.split(' ').map(w => w[0]).join('') + ' — ' + pos}
                                            active={selectedPosition === pos}
                                            onClick={() => setSelectedPosition(pos)} />
                                    ))}
                                </div>
                            </CollapsibleSection>

                            {/* League */}
                            <CollapsibleSection title="League">
                                <div className="flex flex-col gap-1">
                                    <FilterPill label="All Leagues" active={selectedLeague === null} onClick={() => { setSelectedLeague(null); setSelectedTeam(null); }} />
                                    {leagues.map(l => (
                                        <FilterPill key={l.id} label={l.league_name} active={selectedLeague === l.id}
                                            onClick={() => { setSelectedLeague(selectedLeague === l.id ? null : l.id); setSelectedTeam(null); }} />
                                    ))}
                                </div>
                            </CollapsibleSection>

                            {/* Team (only shown when league selected or always) */}
                            <CollapsibleSection title="Team" defaultOpen={false}>
                                <div className="flex flex-col gap-1 max-h-40 overflow-y-auto pr-1">
                                    <FilterPill label="All Teams" active={selectedTeam === null} onClick={() => setSelectedTeam(null)} />
                                    {filteredTeams.slice(0, 40).map(t => (
                                        <FilterPill key={t.id} label={t.team_name} active={selectedTeam === t.id}
                                            onClick={() => setSelectedTeam(selectedTeam === t.id ? null : t.id)} />
                                    ))}
                                </div>
                            </CollapsibleSection>

                            {/* Country */}
                            <CollapsibleSection title="Nationality" defaultOpen={false}>
                                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
                                    <FilterPill label="All Countries" active={selectedCountry === null} onClick={() => setSelectedCountry(null)} />
                                    {countries.map(c => (
                                        <FilterPill key={c} label={c} active={selectedCountry === c}
                                            onClick={() => setSelectedCountry(selectedCountry === c ? null : c)} />
                                    ))}
                                </div>
                            </CollapsibleSection>
                        </div>
                    </aside>

                    {/* ── Main content ──────────────────────────────────────── */}
                    <div className="flex-1 min-w-0 space-y-4">
                        {/* Search bar + mobile filter toggle */}
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search players..."
                                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-colors" />
                            </div>
                            {/* Mobile filter toggle */}
                            <button onClick={() => setFiltersOpen(!filtersOpen)}
                                className={`lg:hidden px-3 py-2.5 rounded-xl text-sm font-medium border transition-all cursor-pointer ${hasActiveFilters ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-white/5 text-gray-400 border-white/10'}`}>
                                <Filter size={16} />
                            </button>
                            {/* Free agents on mobile */}
                            <button onClick={() => setShowFreeOnly(!showFreeOnly)}
                                className={`lg:hidden px-3 py-2 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer ${showFreeOnly ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-gray-400 border border-white/10'}`}>
                                Free
                            </button>
                        </div>

                        {/* Mobile filters panel */}
                        {filtersOpen && (
                            <div className="lg:hidden rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800/80 border border-white/10 p-4 space-y-4">
                                {/* Position quick pills */}
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mb-2">Position</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {POSITIONS.map(pos => (
                                            <FilterPill key={pos}
                                                label={pos === 'All' ? 'All' : pos.split(' ').map(w => w[0]).join('')}
                                                active={selectedPosition === pos}
                                                onClick={() => setSelectedPosition(pos)} />
                                        ))}
                                    </div>
                                </div>
                                {/* League quick pills */}
                                {leagues.length > 0 && (
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mb-2">League</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            <FilterPill label="All" active={selectedLeague === null} onClick={() => { setSelectedLeague(null); setSelectedTeam(null); }} />
                                            {leagues.map(l => (
                                                <FilterPill key={l.id} label={l.league_name} active={selectedLeague === l.id}
                                                    onClick={() => { setSelectedLeague(selectedLeague === l.id ? null : l.id); setSelectedTeam(null); }} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Active filter chips */}
                        {hasActiveFilters && (
                            <div className="flex flex-wrap gap-2">
                                {showFreeOnly && (
                                    <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 text-[11px] font-medium border border-emerald-500/20">
                                        Free Agents <button onClick={() => setShowFreeOnly(false)} className="cursor-pointer opacity-60 hover:opacity-100"><X size={10} /></button>
                                    </span>
                                )}
                                {selectedPosition !== 'All' && (
                                    <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/15 text-amber-400 text-[11px] font-medium border border-amber-500/20">
                                        {selectedPosition} <button onClick={() => setSelectedPosition('All')} className="cursor-pointer opacity-60 hover:opacity-100"><X size={10} /></button>
                                    </span>
                                )}
                                {selectedLeague !== null && (
                                    <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-500/15 text-sky-400 text-[11px] font-medium border border-sky-500/20">
                                        {leagues.find(l => l.id === selectedLeague)?.league_name}
                                        <button onClick={() => { setSelectedLeague(null); setSelectedTeam(null); }} className="cursor-pointer opacity-60 hover:opacity-100"><X size={10} /></button>
                                    </span>
                                )}
                                {selectedTeam !== null && (
                                    <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-500/15 text-violet-400 text-[11px] font-medium border border-violet-500/20">
                                        {teams.find(t => t.id === selectedTeam)?.team_name}
                                        <button onClick={() => setSelectedTeam(null)} className="cursor-pointer opacity-60 hover:opacity-100"><X size={10} /></button>
                                    </span>
                                )}
                                {selectedCountry !== null && (
                                    <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-500/15 text-orange-400 text-[11px] font-medium border border-orange-500/20">
                                        {selectedCountry}
                                        <button onClick={() => setSelectedCountry(null)} className="cursor-pointer opacity-60 hover:opacity-100"><X size={10} /></button>
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Result count */}
                        <p className="text-xs text-gray-500">
                            {filtered.length} player{filtered.length !== 1 ? 's' : ''} found
                        </p>

                        {/* Player grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                            {filtered.slice(0, 60).map(p => (
                                <PlayerCard key={p.id} player={p} onClick={() => setSelectedPlayer(p)} />
                            ))}
                        </div>

                        {filtered.length === 0 && (
                            <div className="text-center py-16 rounded-2xl bg-white/[0.02] border border-white/5">
                                <Search size={32} className="mx-auto text-gray-700 mb-3" />
                                <p className="text-gray-500 font-medium">No players match your filters</p>
                                <button onClick={clearFilters} className="mt-3 text-xs text-amber-400 hover:text-amber-300 cursor-pointer">Clear all filters</button>
                            </div>
                        )}

                        {filtered.length > 60 && (
                            <p className="text-center text-xs text-gray-600">Showing first 60 results — refine filters to narrow down</p>
                        )}
                    </div>
                </div>
            )}

            {/* Offers tabs */}
            {(tab === 'received' || tab === 'sent') && (
                <div className="space-y-2 md:space-y-3">
                    {(tab === 'received' ? receivedOffers : sentOffers).length === 0 && (
                        <div className="text-center py-12 text-gray-500 rounded-2xl bg-white/[0.02] border border-white/5">No offers.</div>
                    )}
                    {(tab === 'received' ? receivedOffers : sentOffers).map(o => (
                        <div key={o.id} className="p-4 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800/80 border border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:border-white/20 transition-colors">
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-white truncate">{o.player_name}</p>
                                <p className="text-xs text-gray-500 truncate">{tab === 'received' ? `From: ${o.from_team_name}` : `To: ${o.to_team_name}`}</p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                <span className="flex items-center gap-1 text-sm font-bold text-emerald-400">
                                    <DollarSign size={13} />{fmt(o.offer_amount)}
                                </span>
                                <span className={`px-2 py-1 rounded-lg text-[10px] md:text-xs font-bold whitespace-nowrap ${o.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : o.status === 'accepted' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{o.status}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {selectedPlayer && <PlayerModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}
        </div>
    );
}
