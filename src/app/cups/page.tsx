'use client';

import { useState, useEffect } from 'react';
import { Trophy, Calendar, Swords, ChevronRight, Loader2, Shield, Crown } from 'lucide-react';
import Image from 'next/image';

interface CupFixture {
  id: number;
  home_team_id: number;
  away_team_id: number;
  home_sets: number | null;
  away_sets: number | null;
  status: string;
  scheduled_date: string;
  home_team_name: string;
  away_team_name: string;
  winner_team_id: number | null;
}

interface CupRound {
  id: number;
  round_number: number;
  round_name: string;
  start_date: string;
  end_date: string;
  status: string;
  fixtures: CupFixture[];
}

interface CupData {
  cup: {
    id: number;
    name: string;
    year: number;
  };
  rounds: CupRound[];
}

function TeamLogo({ teamId, size = 32 }: { teamId: number; size?: number }) {
  const [src, setSrc] = useState(`/assets/teams/${teamId}.png`);
  const [failed, setFailed] = useState(false);
  if (failed) return <div style={{ width: size, height: size }} className="rounded-full bg-white/5 border border-white/10 shrink-0" />;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <Image 
        src={src} 
        alt="Team" 
        fill 
        unoptimized 
        className="object-contain"
        onError={() => {
          if (src !== '/assets/teams/default.png') setSrc('/assets/teams/default.png');
          else setFailed(true);
        }} 
      />
    </div>
  );
}

export default function CupsPage() {
  const [data, setData] = useState<CupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRoundIdx, setActiveRoundIdx] = useState(0);

  useEffect(() => {
    fetch('/api/cups')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        setData(d);
        if (d && d.rounds) {
          // Set active round to the first one that's not completed
          const idx = d.rounds.findIndex((r: any) => r.status !== 'completed');
          setActiveRoundIdx(idx !== -1 ? idx : d.rounds.length - 1);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  if (!data || !data.rounds.length) {
    return (
      <div className="text-center py-20 bg-gray-900/50 rounded-3xl border border-white/5">
        <Trophy className="w-16 h-16 text-gray-700 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">No Active Cups</h2>
        <p className="text-gray-500">The Copa Italia will be generated after June 30.</p>
      </div>
    );
  }

  const activeRound = data.rounds[activeRoundIdx];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
              <Trophy className="text-amber-500" size={24} />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">{data.cup.name}</h1>
          </div>
          <p className="text-gray-500 ml-1">National Tournament · {data.cup.year}</p>
        </div>

        {/* Round Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {data.rounds.map((round, idx) => (
            <button
              key={round.id}
              onClick={() => setActiveRoundIdx(idx)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shrink-0
                ${activeRoundIdx === idx 
                  ? 'bg-amber-500 text-gray-950 shadow-lg shadow-amber-500/20' 
                  : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-white'
                }`}
            >
              {round.round_name}
            </button>
          ))}
        </div>
      </div>

      {/* Active Round View */}
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${activeRound.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              {activeRound.status.replace('_', ' ')}
            </span>
          </div>
          <div className="h-px flex-1 bg-white/5" />
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Calendar size={14} />
            <span>{new Date(activeRound.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {activeRound.fixtures.map((fixture) => {
            const homeWon = fixture.status === 'completed' && fixture.home_sets! > fixture.away_sets!;
            const awayWon = fixture.status === 'completed' && fixture.away_sets! > fixture.home_sets!;
            
            return (
              <div 
                key={fixture.id} 
                className="group relative bg-gray-900/40 border border-white/5 rounded-2xl p-4 hover:border-white/20 transition-all hover:bg-gray-900/60"
              >
                <div className="space-y-3">
                  {/* Home Team */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <TeamLogo teamId={fixture.home_team_id} />
                      <span className={`text-sm font-bold truncate ${homeWon ? 'text-amber-400' : 'text-gray-300'}`}>
                        {fixture.home_team_name}
                      </span>
                    </div>
                    {fixture.status === 'completed' && (
                      <span className={`text-lg font-black tabular-nums ${homeWon ? 'text-amber-400' : 'text-gray-600'}`}>
                        {fixture.home_sets}
                      </span>
                    )}
                  </div>

                  {/* Away Team */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <TeamLogo teamId={fixture.away_team_id} />
                      <span className={`text-sm font-bold truncate ${awayWon ? 'text-amber-400' : 'text-gray-300'}`}>
                        {fixture.away_team_name}
                      </span>
                    </div>
                    {fixture.status === 'completed' && (
                      <span className={`text-lg font-black tabular-nums ${awayWon ? 'text-amber-400' : 'text-gray-600'}`}>
                        {fixture.away_sets}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Footer */}
                <div className="mt-4 pt-3 border-t border-white/[0.03] flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-gray-600">
                    {fixture.status === 'completed' ? 'Final' : 'Scheduled'}
                  </span>
                  {fixture.status !== 'completed' && (
                    <span className="text-[9px] text-gray-700 font-medium">
                      {new Date(fixture.scheduled_date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                    </span>
                  )}
                  {fixture.status === 'completed' && (
                    <div className="flex items-center gap-1.5">
                      <Crown size={10} className="text-amber-500/50" />
                      <span className="text-[9px] font-black text-amber-500/50 uppercase">Winner</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bracket Progress */}
      <div className="mt-12 p-8 bg-gray-900/30 border border-white/5 rounded-3xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Shield size={160} />
        </div>
        <div className="relative">
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-500 mb-8">Tournament Roadmap</h3>
          <div className="flex items-center justify-between gap-4 max-w-2xl mx-auto">
            {data.rounds.map((round, idx) => (
              <div key={round.id} className="flex items-center gap-2 group cursor-pointer" onClick={() => setActiveRoundIdx(idx)}>
                <div className={`w-3 h-3 rounded-full transition-all duration-500 
                  ${idx <= activeRoundIdx ? 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.4)]' : 'bg-gray-800'}`} 
                />
                {idx < data.rounds.length - 1 && (
                  <div className={`w-8 md:w-16 h-0.5 rounded-full transition-all duration-700
                    ${idx < activeRoundIdx ? 'bg-amber-500/40' : 'bg-gray-800'}`} 
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between max-w-2xl mx-auto mt-4">
             <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Start</span>
             <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest text-center">
               {data.rounds[Math.floor(data.rounds.length/2)].round_name}
             </span>
             <span className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">Final</span>
          </div>
        </div>
      </div>
    </div>
  );
}
