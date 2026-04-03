'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Calendar, ChevronLeft, ChevronRight, Swords, Dumbbell, Trophy, Users, DollarSign } from 'lucide-react';

interface TeamData { id: number; team_name: string; played: number; won: number; lost: number; points: number; team_money: number; }
interface PlayerData { id: number; player_name: string; overall: number; position: string; }

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function DashboardPage() {
  const { team } = useAuth();
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentDay, setCurrentDay] = useState(1);
  const [seasonDay, setSeasonDay] = useState(1);

  useEffect(() => {
    if (team) {
      fetch(`/api/teams/${team.id}`).then(r => r.json()).then(setTeamData);
      fetch(`/api/players?teamId=${team.id}`).then(r => r.json()).then(setPlayers);
    }
  }, [team]);

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
  const calendarDays = [];
  for (let i = 0; i < firstDayOfWeek; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const isMatchDay = (day: number) => day % 4 === 0;
  const isTrainingDay = (day: number) => !isMatchDay(day) && day % 7 !== 0;

  const advanceDay = () => {
    setCurrentDay(prev => {
      const next = prev >= daysInMonth ? 1 : prev + 1;
      if (next === 1) {
        setCurrentMonth(m => m >= 11 ? 0 : m + 1);
        if (currentMonth === 11) setCurrentYear(y => y + 1);
      }
      return next;
    });
    setSeasonDay(prev => prev + 1);
  };

  const avgOverall = players.length > 0 ? Math.round(players.reduce((s, p) => s + p.overall, 0) / players.length) : 0;
  const formatMoney = (n: number) => n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}K`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{team?.name || 'Dashboard'}</h1>
          <p className="text-sm text-gray-400">Season Day {seasonDay} • {isMatchDay(currentDay) ? '⚔️ Match Day' : isTrainingDay(currentDay) ? '💪 Training Day' : '😴 Rest Day'}</p>
        </div>
        <button onClick={advanceDay}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/20">
          Advance Day →
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Record', value: teamData ? `${teamData.won}W – ${teamData.lost}L` : '—', icon: Trophy, from: 'from-amber-500/15', to: 'to-orange-500/5', border: 'border-amber-500/20', iconColor: 'text-amber-400' },
          { label: 'Players', value: `${players.length}`, icon: Users, from: 'from-sky-500/15', to: 'to-blue-500/5', border: 'border-sky-500/20', iconColor: 'text-sky-400' },
          { label: 'Avg Overall', value: `${avgOverall}`, icon: Swords, from: 'from-emerald-500/15', to: 'to-teal-500/5', border: 'border-emerald-500/20', iconColor: 'text-emerald-400' },
          { label: 'Budget', value: teamData ? formatMoney(teamData.team_money) : '—', icon: DollarSign, from: 'from-violet-500/15', to: 'to-purple-500/5', border: 'border-violet-500/20', iconColor: 'text-violet-400' },
        ].map(stat => (
          <div key={stat.label} className={`p-4 rounded-2xl bg-gradient-to-br ${stat.from} ${stat.to} border ${stat.border} shadow-sm`}>
            <div className="flex items-center gap-2 mb-3">
              <stat.icon size={15} className={stat.iconColor} />
              <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">{stat.label}</span>
            </div>
            <div className="text-2xl font-black text-white">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Calendar */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800/80 border border-white/10 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-300 flex items-center gap-2"><Calendar size={14} className="text-amber-400" /> {MONTHS[currentMonth]} {currentYear}</span>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
              <div key={day} className="text-center text-[10px] text-gray-600 py-1 font-semibold">{day}</div>
            ))}
            {calendarDays.map((day, i) => (
              <div key={i} className={`aspect-square flex items-center justify-center rounded-lg text-xs transition-all ${day === null ? '' :
                  day === currentDay ? 'bg-amber-500/30 border border-amber-500/50 text-amber-400 font-bold shadow-sm shadow-amber-500/20' :
                    isMatchDay(day) ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/10' :
                      isTrainingDay(day) ? 'text-gray-400 hover:bg-white/5' :
                        'text-gray-600 hover:bg-white/5'
                }`}>
                {day}
              </div>
            ))}
          </div>
        </div>

        {/* Schedule overview */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800/80 border border-white/10 shadow-sm lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Schedule Overview</h3>
          <div className="space-y-2.5">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-red-500/10 to-transparent border border-red-500/15">
              <Swords size={15} className="text-red-400 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-white">Match Days</div>
                <div className="text-xs text-gray-500">Every 4th day — compete for points</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-blue-500/10 to-transparent border border-blue-500/15">
              <Dumbbell size={15} className="text-blue-400 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-white">Training Days</div>
                <div className="text-xs text-gray-500">Develop your squad's skills</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/15">
              <Trophy size={15} className="text-emerald-400 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-white">Current Day</div>
                <div className="text-xs text-gray-500">Season Day {seasonDay}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isMatchDay(currentDay) && (
        <div className="p-6 rounded-2xl bg-gradient-to-br from-red-500/15 via-orange-500/8 to-transparent border border-red-500/25 shadow-lg shadow-red-900/10">
          <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><Swords size={18} className="text-red-400" /> Match Day</h3>
          <p className="text-sm text-gray-400">Head to the Match Simulation page to play your match!</p>
        </div>
      )}
    </div>
  );
}
