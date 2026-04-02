'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Swords, Play, Trophy, RotateCcw } from 'lucide-react';

interface Team { id: number; team_name: string; played: number; won: number; lost: number; points: number; }
interface Player { id: number; player_name: string; overall: number; attack: number; defense: number; serve: number; block: number; }

function simulateSet(homeStr: number, awayStr: number): [number, number] {
    let h = 0, a = 0;
    const target = 25;
    while (h < target && a < target) {
        const r = Math.random();
        const homeProb = homeStr / (homeStr + awayStr) + (Math.random() * 0.1 - 0.05);
        if (r < homeProb) h++; else a++;
    }
    if (Math.abs(h - a) < 2) {
        while (Math.abs(h - a) < 2) {
            if (Math.random() < homeStr / (homeStr + awayStr)) h++; else a++;
        }
    }
    return [h, a];
}

export default function MatchPage() {
    const { team } = useAuth();
    const [opponents, setOpponents] = useState<Team[]>([]);
    const [selectedOpp, setSelectedOpp] = useState<Team | null>(null);
    const [myPlayers, setMyPlayers] = useState<Player[]>([]);
    const [oppPlayers, setOppPlayers] = useState<Player[]>([]);
    const [result, setResult] = useState<{ sets: [number, number][]; winner: string } | null>(null);
    const [simulating, setSimulating] = useState(false);

    useEffect(() => {
        fetch('/api/teams').then(r => r.json()).then((teams: Team[]) => {
            setOpponents(teams.filter(t => t.id !== team?.id));
        });
        if (team) fetch(`/api/players?teamId=${team.id}`).then(r => r.json()).then(setMyPlayers);
    }, [team]);

    useEffect(() => {
        if (selectedOpp) fetch(`/api/players?teamId=${selectedOpp.id}`).then(r => r.json()).then(setOppPlayers);
    }, [selectedOpp]);

    const calcStrength = (players: Player[]) => {
        if (!players.length) return 50;
        return Math.round(players.reduce((s, p) => s + p.overall * 0.4 + p.attack * 0.2 + p.defense * 0.15 + p.serve * 0.15 + p.block * 0.1, 0) / players.length);
    };

    const runMatch = async () => {
        if (!selectedOpp || !team) return;
        setSimulating(true);
        setResult(null);
        const homeStr = calcStrength(myPlayers);
        const awayStr = calcStrength(oppPlayers);

        await new Promise(r => setTimeout(r, 1500));

        const sets: [number, number][] = [];
        let homeWins = 0, awayWins = 0;
        const bestOf = 5;
        const winTarget = 3;

        while (homeWins < winTarget && awayWins < winTarget && sets.length < bestOf) {
            const [h, a] = simulateSet(homeStr, awayStr);
            sets.push([h, a]);
            if (h > a) homeWins++; else awayWins++;
        }

        const winner = homeWins > awayWins ? team.name : selectedOpp.team_name;
        setResult({ sets, winner });

        // Update team stats
        const myWon = homeWins > awayWins;
        await fetch(`/api/teams/${team.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ played: (myPlayers.length > 0 ? 1 : 0), won: myWon ? 1 : 0, lost: myWon ? 0 : 1 }),
        });

        setSimulating(false);
    };

    const homeStr = calcStrength(myPlayers);
    const awayStr = selectedOpp ? calcStrength(oppPlayers) : 0;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Swords className="text-amber-400" />Match Simulation</h1>

            {!result ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                        <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center">
                            <div className="w-16 h-16 mx-auto rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/30 border border-amber-500/30 flex items-center justify-center text-2xl font-bold text-amber-400 mb-3">
                                {team?.name?.charAt(0) || '?'}
                            </div>
                            <h3 className="font-bold text-white">{team?.name || 'Your Team'}</h3>
                            <p className="text-sm text-gray-500">{myPlayers.length} players</p>
                            <div className="mt-2 text-2xl font-black text-amber-400">{homeStr}</div>
                            <p className="text-xs text-gray-500">Team Strength</p>
                        </div>

                        <div className="text-center text-4xl font-black text-gray-600">VS</div>

                        <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center">
                            {selectedOpp ? (
                                <>
                                    <div className="w-16 h-16 mx-auto rounded-xl bg-gradient-to-br from-red-500/30 to-pink-500/30 border border-red-500/30 flex items-center justify-center text-2xl font-bold text-red-400 mb-3">
                                        {selectedOpp.team_name.charAt(0)}
                                    </div>
                                    <h3 className="font-bold text-white">{selectedOpp.team_name}</h3>
                                    <p className="text-sm text-gray-500">{oppPlayers.length} players</p>
                                    <div className="mt-2 text-2xl font-black text-red-400">{awayStr}</div>
                                    <p className="text-xs text-gray-500">Team Strength</p>
                                </>
                            ) : (
                                <p className="text-gray-500 py-8">Select opponent</p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {opponents.map(opp => (
                            <button key={opp.id} onClick={() => setSelectedOpp(opp)}
                                className={`p-3 rounded-xl text-left transition-all ${selectedOpp?.id === opp.id ? 'bg-red-500/20 border border-red-500/30 text-red-400' : 'bg-white/5 border border-white/10 text-gray-300 hover:border-white/20'}`}>
                                <p className="font-semibold text-sm">{opp.team_name}</p>
                                <p className="text-xs text-gray-500">{opp.won}W-{opp.lost}L</p>
                            </button>
                        ))}
                    </div>

                    <button onClick={runMatch} disabled={!selectedOpp || simulating}
                        className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-lg disabled:opacity-30 hover:from-amber-400 hover:to-orange-400 transition-all flex items-center justify-center gap-2">
                        {simulating ? <><div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />Simulating...</> : <><Play size={20} />Play Match</>}
                    </button>
                </>
            ) : (
                <div className="p-8 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 text-center space-y-6">
                    <Trophy size={48} className="mx-auto text-amber-400" />
                    <h2 className="text-3xl font-black text-white">{result.winner} Wins!</h2>

                    <div className="flex justify-center gap-8 items-center">
                        <span className="text-lg font-bold text-white">{team?.name}</span>
                        <div className="flex gap-2">
                            {result.sets.map((s, i) => (
                                <div key={i} className="w-14 text-center p-2 rounded-lg bg-black/20 border border-white/5">
                                    <div className="text-[10px] text-gray-500">Set {i + 1}</div>
                                    <div className="font-bold text-white">{s[0]}-{s[1]}</div>
                                </div>
                            ))}
                        </div>
                        <span className="text-lg font-bold text-white">{selectedOpp?.team_name}</span>
                    </div>

                    <button onClick={() => { setResult(null); setSelectedOpp(null); }}
                        className="px-6 py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-all flex items-center gap-2 mx-auto">
                        <RotateCcw size={16} />New Match
                    </button>
                </div>
            )}
        </div>
    );
}
