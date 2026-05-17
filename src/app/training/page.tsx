'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import {
  Dumbbell, Building2, Users, TrendingUp, Lock, Zap, Target, Brain, Shield, Flame,
  Heart, Crosshair, BookOpen, Activity, X, Hand, Sparkles, Mountain, Wind, Lightbulb,
  Film, ArrowRight, CalendarDays,
} from 'lucide-react';
import { TRAINING_PLANS } from '@/lib/training/plans';
import {
  FACILITY_DEFS, FACILITY_ORDER, STAT_TO_FACILITIES,
  LEVEL_MULTIPLIER, UPGRADE_COST_TO_LEVEL, MAX_LEVEL,
  facilityMultiplier as facilityLevelMultiplier,
  stackedStatMultiplier, stackedBreakdown,
  type FacilityKey,
} from '@/lib/training/facilities';
import { projectSeason } from '@/lib/training/estimates';
import { useAuth } from '@/contexts/auth-context';

/* ────────────────────────────────────────────────────────────────────
   TYPES
   ──────────────────────────────────────────────────────────────────── */

type TabType = 'development' | 'facilities' | 'coaches';

interface Player {
  id: number;
  player_name: string;
  position: string;
  age: number;
  overall: number;
  potential: number;
  jersey_number?: number;
  country?: string;
  [key: string]: any;
}

interface Assignment {
  id: number;
  player_id: number;
  plan_key: string;
  stat_progress: string;
  player_name: string;
  position: string;
  age: number;
  overall: number;
  potential: number;
}

interface Facility {
  id: number;
  facility_type: string;
  level: number;
  upgradeCost: number | null;
}

interface Coach {
  id: number;
  coach_name: string;
  specialty: string;
  quality: number;
  monthly_wage: number;
  stars?: number;
}

interface PoolCoach {
  name: string;
  specialty: string;
  quality: number;
  hireCost: number;
  monthlyWage: number;
  stars: number;
}

/* ────────────────────────────────────────────────────────────────────
   DESIGN TOKENS — positions, tiers, facility theming
   ──────────────────────────────────────────────────────────────────── */

interface PosTheme { hex: string; chip: string; rail: string; halo: string; text: string; }

const POS_ACCENT: Record<string, PosTheme> = {
  'Setter':          { hex: '#3b82f6', chip: 'bg-[#3b82f6] text-black',  rail: 'bg-[#3b82f6]', halo: 'bg-[#3b82f6]/35', text: 'text-[#60a5fa]' },
  'Outside Hitter':  { hex: '#ef4444', chip: 'bg-[#ef4444] text-black',  rail: 'bg-[#ef4444]', halo: 'bg-[#ef4444]/35', text: 'text-[#fca5a5]' },
  'Middle Blocker':  { hex: '#a78bfa', chip: 'bg-[#a78bfa] text-black',  rail: 'bg-[#a78bfa]', halo: 'bg-[#a78bfa]/35', text: 'text-[#c4b5fd]' },
  'Opposite Hitter': { hex: '#fb923c', chip: 'bg-[#fb923c] text-black',  rail: 'bg-[#fb923c]', halo: 'bg-[#fb923c]/35', text: 'text-[#fdba74]' },
  'Libero':          { hex: '#22c55e', chip: 'bg-[#22c55e] text-black',  rail: 'bg-[#22c55e]', halo: 'bg-[#22c55e]/35', text: 'text-[#86efac]' },
};
function posAccent(pos: string): PosTheme {
  return POS_ACCENT[pos] || { hex: '#a1a1aa', chip: 'bg-zinc-300 text-black', rail: 'bg-zinc-400', halo: 'bg-white/15', text: 'text-zinc-300' };
}
function posAbbrev(pos: string): string {
  const m: Record<string, string> = { 'Setter': 'S', 'Outside Hitter': 'OH', 'Middle Blocker': 'MB', 'Opposite Hitter': 'OPP', 'Libero': 'L' };
  return m[pos] || pos.slice(0, 2).toUpperCase();
}
function ratingTier(v: number): { name: string; text: string; ring: string; plate: string } {
  if (v >= 85) return { name: 'ELITE',  text: 'text-emerald-300', ring: 'ring-emerald-300/45', plate: 'from-emerald-300/25 via-emerald-300/[0.04] to-transparent' };
  if (v >= 75) return { name: 'GOLD',   text: 'text-yellow-300',  ring: 'ring-yellow-300/45',  plate: 'from-yellow-300/22 via-yellow-300/[0.04] to-transparent' };
  if (v >= 65) return { name: 'PRO',    text: 'text-amber-300',   ring: 'ring-amber-300/40',   plate: 'from-amber-300/18 via-amber-300/[0.04] to-transparent' };
  if (v >= 55) return { name: 'SILVER', text: 'text-zinc-200',    ring: 'ring-zinc-200/35',    plate: 'from-zinc-200/15 via-zinc-200/[0.04] to-transparent' };
  return         { name: 'BRONZE', text: 'text-orange-300',  ring: 'ring-orange-300/35',  plate: 'from-orange-400/18 via-orange-400/[0.04] to-transparent' };
}

/* ── Facility meta — derived from shared catalog in lib/training/facilities ── */
const ICON_MAP: Record<string, typeof Dumbbell> = {
  Heart, Dumbbell, Crosshair, BookOpen, Shield, Flame, Target, Brain,
  Zap, Activity, Film, Hand, Sparkles, Mountain, Wind, Lightbulb,
};

interface FacilityMeta {
  key: FacilityKey;
  name: string;
  short: string;
  Icon: typeof Dumbbell;
  stats: string[];
  accent: string;
  pattern: 'grid' | 'lines' | 'dots' | 'wave' | 'hex' | 'cross' | 'arc' | 'noise';
  description: string;
}

const FACILITY_META: Record<string, FacilityMeta> = (() => {
  const m: Record<string, FacilityMeta> = {};
  for (const key of FACILITY_ORDER) {
    const def = FACILITY_DEFS[key];
    m[key] = {
      key: def.key,
      name: def.name,
      short: def.short,
      Icon: ICON_MAP[def.icon] || Dumbbell,
      stats: def.stats,
      accent: def.accent,
      pattern: def.pattern,
      description: def.description,
    };
  }
  return m;
})();

/* ────────────────────────────────────────────────────────────────────
   PORTRAIT (shared pattern from squad page)
   ──────────────────────────────────────────────────────────────────── */

function PlayerPhoto({ playerId }: { playerId: number }) {
  const [src, setSrc] = useState(`/assets/players/${playerId}.png`);
  const [fallback, setFallback] = useState(false);
  if (fallback) {
    return (
      <div className="flex items-end justify-center w-full h-full">
        <svg viewBox="0 0 80 100" className="w-full h-full opacity-50" fill="none">
          <ellipse cx="40" cy="28" rx="18" ry="20" fill="#4B5563" />
          <path d="M10 100 Q10 60 40 58 Q70 60 70 100Z" fill="#4B5563" />
        </svg>
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt="Player"
      fill
      unoptimized
      className="object-contain object-bottom"
      onError={() => { if (src !== '/assets/players/default.png') setSrc('/assets/players/default.png'); else setFallback(true); }}
    />
  );
}

/* ────────────────────────────────────────────────────────────────────
   FACILITY BLUEPRINT PLACEHOLDER — SVG patterns themed per facility
   ──────────────────────────────────────────────────────────────────── */

function FacilityBlueprint({ meta, level }: { meta: FacilityMeta; level: number }) {
  const c = meta.accent;
  const Icon = meta.Icon;

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{
        background: `linear-gradient(160deg, ${c}1a 0%, ${c}05 35%, var(--ink-900) 80%)`,
      }}
    >
      {/* Pattern overlay per facility */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.18]" preserveAspectRatio="none">
        <defs>
          {meta.pattern === 'grid' && (
            <pattern id={`pat-${meta.short}`} x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
              <path d="M 22 0 L 0 0 0 22" fill="none" stroke={c} strokeWidth="0.6" />
            </pattern>
          )}
          {meta.pattern === 'lines' && (
            <pattern id={`pat-${meta.short}`} x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="14" stroke={c} strokeWidth="1.4" />
            </pattern>
          )}
          {meta.pattern === 'dots' && (
            <pattern id={`pat-${meta.short}`} x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
              <circle cx="7" cy="7" r="1.4" fill={c} />
            </pattern>
          )}
          {meta.pattern === 'wave' && (
            <pattern id={`pat-${meta.short}`} x="0" y="0" width="40" height="20" patternUnits="userSpaceOnUse">
              <path d="M 0 10 Q 10 0 20 10 T 40 10" fill="none" stroke={c} strokeWidth="0.9" />
            </pattern>
          )}
          {meta.pattern === 'hex' && (
            <pattern id={`pat-${meta.short}`} x="0" y="0" width="28" height="32" patternUnits="userSpaceOnUse">
              <path d="M14 2 L26 9 L26 23 L14 30 L2 23 L2 9 Z" fill="none" stroke={c} strokeWidth="0.7" />
            </pattern>
          )}
          {meta.pattern === 'cross' && (
            <pattern id={`pat-${meta.short}`} x="0" y="0" width="18" height="18" patternUnits="userSpaceOnUse">
              <path d="M 9 4 L 9 14 M 4 9 L 14 9" stroke={c} strokeWidth="0.8" />
            </pattern>
          )}
          {meta.pattern === 'arc' && (
            <pattern id={`pat-${meta.short}`} x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 0 40 A 40 40 0 0 1 40 0" fill="none" stroke={c} strokeWidth="0.7" />
            </pattern>
          )}
          {meta.pattern === 'noise' && (
            <pattern id={`pat-${meta.short}`} x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              <circle cx="10" cy="14" r="0.9" fill={c} />
              <circle cx="38" cy="22" r="0.6" fill={c} />
              <circle cx="22" cy="40" r="0.7" fill={c} />
              <circle cx="50" cy="48" r="0.5" fill={c} />
              <circle cx="6" cy="52" r="0.8" fill={c} />
            </pattern>
          )}
        </defs>
        <rect width="100%" height="100%" fill={`url(#pat-${meta.short})`} />
      </svg>

      {/* Big tonal icon — half-bled corner */}
      <div className="absolute -right-6 -bottom-6 opacity-25" style={{ color: c }}>
        <Icon size={140} strokeWidth={1.1} />
      </div>

      {/* Diagonal blueprint stamp ribbon */}
      <div
        className="absolute top-3 -left-12 px-12 py-0.5 font-mono text-[8px] tracking-[0.32em] uppercase rotate-[-30deg]"
        style={{ background: `${c}30`, color: c, border: `1px solid ${c}55` }}
      >
        FACILITY · {meta.short}
      </div>

      {/* Level pip column */}
      <div className="absolute bottom-3 left-3 flex flex-col items-center gap-1">
        {[5,4,3,2,1].map(i => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-sm"
            style={{ background: i <= level ? c : `${c}22`, boxShadow: i <= level ? `0 0 6px ${c}` : 'none' }}
          />
        ))}
      </div>

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(120% 80% at 50% 110%, var(--ink-950) 0%, transparent 55%)',
      }} />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   PAGE
   ──────────────────────────────────────────────────────────────────── */

/* Each stat is touched by exactly 3 facilities; pick the strongest-leveled one
   for the per-stat indicator (color+L#). Falls back to the first listed. */
function primaryFacilityForStat(statKey: string, levels: Record<string, number>): FacilityKey | null {
  const facs = STAT_TO_FACILITIES[statKey];
  if (!facs || facs.length === 0) return null;
  let best = facs[0];
  let bestLevel = levels[best] ?? 0;
  for (const f of facs) {
    const lvl = levels[f] ?? 0;
    if (lvl > bestLevel) { best = f; bestLevel = lvl; }
  }
  return best;
}

const STAT_LABEL: Record<string, string> = {
  speed:'SPD',agility:'AGI',endurance:'STM',flexibility:'FLEX',
  strength:'STR',torque:'TRQ',vertical:'VER',
  precision:'PRE',technique:'TEC',flair:'FLR',spin:'SPN',
  game_iq:'IQ',vision:'VIS',playmaking:'PLM',teamwork:'TMW',
  block:'BLK',defense:'DEF',positioning:'POS',digging:'DIG',balance:'BAL',
  attack:'ATK',receive:'REC',setting:'SET',
  serve:'SRV',ball_control:'BC',
  leadership:'LDR',concentration:'CON',pressure:'PRS',consistency:'CST',intimidation:'INT',
};

function ageBand(age: number): { label: string; text: string } {
  if (age <= 20) return { label: 'PRODIGY', text: 'text-emerald-300' };
  if (age <= 23) return { label: 'RISING',  text: 'text-emerald-300' };
  if (age <= 26) return { label: 'PRIME',   text: 'text-[var(--volt)]' };
  if (age <= 29) return { label: 'PRIME',   text: 'text-[var(--volt)]' };
  if (age <= 32) return { label: 'VETERAN', text: 'text-orange-300' };
  if (age <= 35) return { label: 'VETERAN', text: 'text-orange-400' };
  return { label: 'TWILIGHT', text: 'text-red-400' };
}

export default function TrainingPage() {
  const { team, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('development');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [hiredCoaches, setHiredCoaches] = useState<Coach[]>([]);
  const [coachPool, setCoachPool] = useState<PoolCoach[]>([]);
  const [teamMoney, setTeamMoney] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedPlans, setSelectedPlans] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [upgradingType, setUpgradingType] = useState<string | null>(null);
  const [selectedFacilityKey, setSelectedFacilityKey] = useState<FacilityKey | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!team) { setLoading(false); return; }
    const teamId = team.id;

    (async () => {
      try {
        const [assRes, facRes, coachRes, playersRes] = await Promise.all([
          fetch(`/api/training/assignments?teamId=${teamId}`),
          fetch(`/api/training/facility`),
          fetch(`/api/training/coaches`),
          fetch(`/api/players?teamId=${teamId}`),
        ]);

        if (assRes.ok) {
          const ass = await assRes.json();
          setAssignments(ass);
          setSelectedPlans(ass.reduce((acc: Record<number, string>, p: Assignment) => ({ ...acc, [p.player_id]: p.plan_key }), {}));
        }
        if (facRes.ok) {
          const fac = await facRes.json();
          setFacilities(fac.facilities);
          setTeamMoney(fac.teamMoney);
        }
        if (coachRes.ok) {
          const coach = await coachRes.json();
          setHiredCoaches(coach.hired);
          setCoachPool(coach.pool);
          setTeamMoney(coach.teamMoney);
        }
        if (playersRes.ok) {
          const playersData = await playersRes.json();
          setAllPlayers(playersData);
        }
      } catch (e) {
        console.error('Error fetching training data:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [team, authLoading]);

  const handlePlanChange = (playerId: number, planKey: string) => {
    setSelectedPlans(p => ({ ...p, [playerId]: planKey }));
  };

  const handleSavePlan = async (playerId: number) => {
    const planKey = selectedPlans[playerId];
    if (!planKey || !team) return;
    setSavingId(playerId);
    try {
      if (planKey === '') {
        await fetch(`/api/training/assignments?playerId=${playerId}`, { method: 'DELETE' });
      } else {
        await fetch(`/api/training/assignments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId, planKey }),
        });
      }
      const assRes = await fetch(`/api/training/assignments?teamId=${team.id}`);
      if (assRes.ok) setAssignments(await assRes.json());
    } catch (e) {
      console.error('Error saving plan:', e);
    } finally {
      setSavingId(null);
    }
  };

  const handleUpgradeFacility = async (facilityType: string) => {
    setUpgradingType(facilityType);
    try {
      const res = await fetch(`/api/training/facility`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facilityType }),
      });
      if (res.ok) {
        const facRes = await fetch(`/api/training/facility`);
        if (facRes.ok) {
          const fac = await facRes.json();
          setFacilities(fac.facilities);
          setTeamMoney(fac.teamMoney);
        }
      }
    } catch (e) {
      console.error('Error upgrading facility:', e);
    } finally {
      setUpgradingType(null);
    }
  };

  const handleHireCoach = async (coach: PoolCoach) => {
    try {
      const res = await fetch(`/api/training/coaches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: coach.name, specialty: coach.specialty, quality: coach.quality }),
      });
      if (res.ok) {
        const data = await res.json();
        setHiredCoaches([...hiredCoaches, data.coach]);
        setTeamMoney(data.newTeamMoney);
      }
    } catch (e) {
      console.error('Error hiring coach:', e);
    }
  };

  const handleFireCoach = async (coachId: number) => {
    try {
      const res = await fetch(`/api/training/coaches?coachId=${coachId}`, { method: 'DELETE' });
      if (res.ok) setHiredCoaches(hiredCoaches.filter(c => c.id !== coachId));
    } catch (e) {
      console.error('Error firing coach:', e);
    }
  };

  /* ─── Derived ─── */
  const facilityLevelsByType = useMemo(() => {
    const m: Record<string, number> = {};
    for (const f of facilities) m[f.facility_type] = f.level;
    return m;
  }, [facilities]);

  const coachSpecialties = useMemo(() => new Set(hiredCoaches.map(c => c.specialty)), [hiredCoaches]);
  const coachMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of hiredCoaches) m.set(c.specialty, c.quality);
    return m;
  }, [hiredCoaches]);

  const sortedPlayers = useMemo(() => {
    const assignedIds = new Set(assignments.map(a => a.player_id));
    return [...allPlayers].sort((a, b) => {
      const aA = assignedIds.has(a.id) ? 0 : 1;
      const bA = assignedIds.has(b.id) ? 0 : 1;
      if (aA !== bA) return aA - bA;
      return b.overall - a.overall;
    });
  }, [allPlayers, assignments]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="font-mono text-xs tracking-[0.3em] uppercase text-[var(--ink-500)] animate-pulse">
          // Loading facility data
        </div>
      </div>
    );
  }
  if (!team) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Dumbbell size={32} className="text-[var(--ink-500)]" />
        <div className="text-[var(--ink-300)]">You need to join or create a team to access training.</div>
      </div>
    );
  }

  const playersInTraining = assignments.length;
  const totalPlayers = allPlayers.length;
  const coachCount = hiredCoaches.length;
  const maxCoaches = 3;
  const avgFacility = facilities.length > 0
    ? (facilities.reduce((s, f) => s + f.level, 0) / facilities.length).toFixed(1)
    : '1.0';

  return (
    <div className="flex flex-col gap-8 pb-12 animate-fade-up">

      {/* ───── HERO HEADER ─────────────────────────────────────────── */}
      <header className="relative overflow-hidden surface-raised edge-tape px-6 py-6 md:px-8 md:py-7">
        {/* Background motif: tonal grid */}
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{ backgroundImage: 'repeating-linear-gradient(90deg, var(--volt) 0 1px, transparent 1px 64px), repeating-linear-gradient(0deg, var(--volt) 0 1px, transparent 1px 64px)' }} />
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-[0.08] blur-3xl" style={{ background: 'var(--volt)' }} />

        <div className="relative flex flex-col md:flex-row md:items-end gap-6 md:gap-10">
          <div className="flex-1">
            <div className="eyebrow mb-2">Stadium Complex · Development Wing</div>
            <h1 className="font-display text-5xl md:text-7xl leading-[0.85] tracking-wide text-[var(--bone)] uppercase">
              Training <span className="text-[var(--volt)]">/</span> Atelier
            </h1>
            <p className="mt-3 text-sm text-[var(--ink-300)] max-w-xl">
              Forge talent through programmed regimens. Upgrade facilities. Recruit specialists. Every tick of the calendar refines your roster.
            </p>
          </div>

          {/* Scoreboard tiles */}
          <div className="grid grid-cols-3 gap-2 md:gap-3 shrink-0">
            <ScoreTile label="In Camp"   value={`${playersInTraining}/${totalPlayers}`} accent="--volt" />
            <ScoreTile label="Coaches"   value={`${coachCount}/${maxCoaches}`}        accent="--info" />
            <ScoreTile label="Avg. Lv."  value={avgFacility}                          accent="--money" />
          </div>
        </div>

        {/* Budget strip */}
        <div className="relative mt-6 flex items-center justify-between gap-3 pt-4 border-t border-white/8">
          <div className="flex items-center gap-3">
            <span className="eyebrow">Treasury</span>
            <span className="font-mono tabular text-2xl text-[var(--money)] font-semibold tracking-tight">
              ${teamMoney.toLocaleString()}
            </span>
          </div>
          <div className="hidden md:flex items-center gap-4 font-mono text-[10px] tracking-[0.28em] uppercase text-[var(--ink-500)]">
            <span>Spike Dynasty</span>
            <span className="w-1 h-1 rounded-full bg-[var(--ink-600)]" />
            <span>{team.name}</span>
          </div>
        </div>
      </header>

      {/* ───── TABS ────────────────────────────────────────────────── */}
      <nav className="flex flex-wrap gap-1 border-b border-white/8">
        {([
          { id: 'development', label: 'Player Development', count: playersInTraining, Icon: TrendingUp },
          { id: 'facilities',  label: 'Facilities',         count: facilities.length, Icon: Building2 },
          { id: 'coaches',     label: 'Coaching Staff',     count: coachCount,        Icon: Users },
        ] as const).map(({ id, label, count, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`group relative flex items-center gap-2 px-4 py-3 font-display text-base tracking-[0.12em] uppercase transition-colors
                ${active ? 'text-[var(--bone)]' : 'text-[var(--ink-400)] hover:text-[var(--ink-200)]'}`}
            >
              <Icon size={16} className={active ? 'text-[var(--volt)]' : 'text-[var(--ink-500)]'} />
              <span>{label}</span>
              <span className={`font-mono text-[10px] tabular px-1.5 py-0.5 rounded ${active ? 'bg-[var(--volt)] text-[var(--ink-950)]' : 'bg-white/5 text-[var(--ink-400)]'}`}>
                {count}
              </span>
              {active && (
                <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-[var(--volt)]" />
              )}
            </button>
          );
        })}
      </nav>

      {/* ───── DEVELOPMENT TAB ─────────────────────────────────────── */}
      {activeTab === 'development' && (
        <section className="space-y-4">
          {sortedPlayers.length === 0 && (
            <EmptyState icon={TrendingUp} title="No players on roster" hint="Sign players to start training." />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {sortedPlayers.map((player, idx) => {
              const assignment = assignments.find(a => a.player_id === player.id);
              const selected = selectedPlans[player.id] ?? assignment?.plan_key ?? '';
              const changed = selected !== (assignment?.plan_key ?? '');
              return (
                <PlayerDevCard
                  key={player.id}
                  player={player}
                  assignment={assignment}
                  selectedPlan={selected}
                  hasChange={changed}
                  saving={savingId === player.id}
                  onChange={(plan) => handlePlanChange(player.id, plan)}
                  onSave={() => handleSavePlan(player.id)}
                  facilityLevels={facilityLevelsByType}
                  coachSpecialties={coachSpecialties}
                  coachMap={coachMap}
                  idx={idx}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* ───── FACILITIES TAB ──────────────────────────────────────── */}
      {activeTab === 'facilities' && (
        <section className="space-y-5">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="eyebrow mb-1">Compound</div>
              <h2 className="font-display text-3xl tracking-wide uppercase text-[var(--bone)]">16 Buildings</h2>
            </div>
            <div className="text-right font-mono text-[10px] tracking-[0.24em] uppercase text-[var(--ink-500)]">
              Click a card for details · Each stat appears in three facilities
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {FACILITY_ORDER.map((type, idx) => {
              const facility = facilities.find(f => f.facility_type === type);
              const level = facility?.level ?? 0;
              const meta = FACILITY_META[type];
              if (!meta) return null;
              return (
                <FacilityCard
                  key={type}
                  meta={meta}
                  level={level}
                  idx={idx}
                  onClick={() => setSelectedFacilityKey(type)}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* ───── FACILITY DETAIL MODAL ───────────────────────────────── */}
      {selectedFacilityKey && (
        <FacilityDetailModal
          facilityKey={selectedFacilityKey}
          facility={facilities.find(f => f.facility_type === selectedFacilityKey)}
          facilityLevels={facilityLevelsByType}
          teamMoney={teamMoney}
          isUpgrading={upgradingType === selectedFacilityKey}
          onUpgrade={() => handleUpgradeFacility(selectedFacilityKey)}
          onClose={() => setSelectedFacilityKey(null)}
        />
      )}

      {/* ───── COACHES TAB ─────────────────────────────────────────── */}
      {activeTab === 'coaches' && (
        <section className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Hired roster — wider */}
            <div className="lg:col-span-3 space-y-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="eyebrow mb-1">Staff Room</div>
                  <h2 className="font-display text-3xl tracking-wide uppercase text-[var(--bone)]">Current Staff</h2>
                </div>
                <span className="font-mono text-xs tabular text-[var(--ink-400)]">{coachCount}/{maxCoaches}</span>
              </div>

              {hiredCoaches.length === 0 ? (
                <EmptyState icon={Users} title="No coaches hired" hint="Hire specialists to boost training speed for matching plans." />
              ) : (
                <div className="space-y-3">
                  {hiredCoaches.map((coach, i) => (
                    <HiredCoachCard
                      key={coach.id}
                      coach={coach}
                      onFire={() => handleFireCoach(coach.id)}
                      idx={i}
                    />
                  ))}
                  {Array.from({ length: maxCoaches - hiredCoaches.length }).map((_, i) => (
                    <div
                      key={`empty-${i}`}
                      className="surface-raised border border-dashed border-white/10 px-4 py-5 flex items-center justify-center gap-3 text-[var(--ink-500)] font-mono text-[10px] tracking-[0.28em] uppercase"
                    >
                      <Lock size={12} />
                      Vacant Slot
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Available pool */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="eyebrow mb-1">Free Agency</div>
                  <h2 className="font-display text-3xl tracking-wide uppercase text-[var(--bone)]">Recruit</h2>
                </div>
                <span className="font-mono text-xs tabular text-[var(--ink-400)]">{coachPool.length} listed</span>
              </div>

              <div className="surface-raised p-2 max-h-[640px] overflow-y-auto space-y-2">
                {coachPool.map((coach, i) => {
                  const isHired = hiredCoaches.some(c => c.coach_name === coach.name);
                  const canHire = coachCount < maxCoaches && teamMoney >= coach.hireCost && !isHired;
                  return (
                    <PoolCoachRow
                      key={`${coach.name}-${i}`}
                      coach={coach}
                      isHired={isHired}
                      canHire={canHire}
                      onHire={() => handleHireCoach(coach)}
                      idx={i}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   COMPONENTS
   ──────────────────────────────────────────────────────────────────── */

function ScoreTile({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="surface px-3 py-2 min-w-[88px]">
      <div className="font-mono text-[8.5px] tracking-[0.28em] uppercase text-[var(--ink-500)] mb-0.5">{label}</div>
      <div className="font-display text-2xl tabular leading-none" style={{ color: `var(${accent})` }}>{value}</div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, hint }: { icon: typeof Dumbbell; title: string; hint: string }) {
  return (
    <div className="surface flex flex-col items-center text-center py-12 px-6 gap-3">
      <Icon size={28} className="text-[var(--ink-500)]" />
      <div className="font-display text-xl tracking-wide uppercase text-[var(--bone)]">{title}</div>
      <div className="text-sm text-[var(--ink-400)]">{hint}</div>
    </div>
  );
}

/* ── Player Development Card ───────────────────────────────────────── */
function PlayerDevCard({
  player, assignment, selectedPlan, hasChange, saving, onChange, onSave,
  facilityLevels, coachSpecialties, coachMap, idx,
}: {
  player: Player;
  assignment?: Assignment;
  selectedPlan: string;
  hasChange: boolean;
  saving: boolean;
  onChange: (planKey: string) => void;
  onSave: () => void;
  facilityLevels: Record<string, number>;
  coachSpecialties: Set<string>;
  coachMap: Map<string, number>;
  idx: number;
}) {
  const acc = posAccent(player.position);
  const tier = ratingTier(player.overall);
  const band = ageBand(player.age);

  const activePlanKey = assignment?.plan_key as keyof typeof TRAINING_PLANS | undefined;
  const previewPlanKey = (selectedPlan || activePlanKey) as keyof typeof TRAINING_PLANS | undefined;
  const previewPlan = previewPlanKey ? TRAINING_PLANS[previewPlanKey] : null;
  const hasCoachMatch = previewPlanKey ? coachSpecialties.has(previewPlanKey) : false;

  // Read progress accumulator
  let progress: Record<string, number> = {};
  try { progress = assignment ? JSON.parse(assignment.stat_progress || '{}') : {}; } catch {}

  // Season projection — 240-day forward sim under current plan + facilities + coaches
  const projection = useMemo(() => {
    if (!previewPlanKey) return null;
    return projectSeason(player, previewPlanKey, facilityLevels, coachMap, 240);
  }, [player, previewPlanKey, facilityLevels, coachMap]);

  const daysToNextOvr = useMemo(() => {
    if (!previewPlanKey || !projection) return null;
    if (projection.deltaOverall <= 0) return null;
    // First OVR tick happens at this fraction of the season:
    // Approximate by scanning targeted-stat daily gain — fastest stat to next +1
    const plan = TRAINING_PLANS[previewPlanKey];
    if (!plan) return null;
    let minDays: number | null = null;
    for (const s of plan.stats as readonly string[]) {
      const stat = (player as any)[s] ?? 0;
      if (stat >= player.potential) continue;
      const daily = projection.stats.find(p => p.statKey === s)?.dailyGain ?? 0;
      if (daily <= 0) continue;
      const d = Math.ceil(1 / daily);
      if (minDays === null || d < minDays) minDays = d;
    }
    return minDays;
  }, [previewPlanKey, projection, player]);

  return (
    <article
      className="group relative overflow-hidden rounded-[14px] animate-fade-up"
      style={{
        animationDelay: `${idx * 40}ms`,
        background: `linear-gradient(150deg, ${acc.hex}1a 0%, var(--ink-900) 38%, var(--ink-950) 100%)`,
        border: `1px solid ${acc.hex}30`,
        boxShadow: `0 1px 0 rgba(255,255,255,0.04) inset, 0 18px 40px -22px ${acc.hex}55`,
      }}
    >
      {/* Position rail */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${acc.rail}`} />
      {/* Tier plate wash */}
      <div className={`absolute inset-0 bg-gradient-to-br ${tier.plate} pointer-events-none`} />
      {/* Diagonal grain */}
      <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay pointer-events-none"
        style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.5) 0 1px, transparent 1px 6px)' }} />
      {/* Sheen on hover */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-[1100ms] ease-out pointer-events-none"
        style={{ background: 'linear-gradient(110deg, transparent 38%, rgba(255,255,255,0.08) 50%, transparent 62%)' }} />

      <div className="relative grid grid-cols-[112px_1fr] gap-4 p-3">
        {/* ── Portrait pane ───────────────────────────────────── */}
        <div className="relative h-[150px] rounded-md overflow-hidden ring-1 ring-white/8"
          style={{ background: `radial-gradient(120% 80% at 50% 100%, ${acc.hex}25 0%, transparent 60%), var(--ink-900)` }}>
          <div className={`absolute left-1/2 bottom-1 -translate-x-1/2 w-20 h-20 rounded-full ${acc.halo} blur-2xl opacity-70 pointer-events-none`} />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[96px] h-[128px]">
            <PlayerPhoto playerId={player.id} />
          </div>
          {/* Floor fade */}
          <div className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none"
            style={{ background: 'linear-gradient(to top, var(--ink-950), transparent)' }} />
          {/* OVR plate */}
          <div className="absolute top-1.5 left-1.5 flex flex-col items-center">
            <span className={`font-display text-[26px] leading-[0.85] tabular ${tier.text} drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]`}>
              {player.overall}
            </span>
            <span className={`mt-0.5 px-1.5 py-[1px] rounded-sm text-[8px] font-mono font-black tracking-[0.18em] ${acc.chip}`}>
              {posAbbrev(player.position)}
            </span>
          </div>
          {/* Potential micro-pip */}
          <div className="absolute top-1.5 right-1.5 flex flex-col items-end">
            <span className="font-mono text-[8px] tracking-[0.2em] text-[var(--ink-400)]">POT</span>
            <span className="font-display text-base leading-none text-[var(--bone)] tabular">{player.potential}</span>
          </div>
        </div>

        {/* ── Right pane ──────────────────────────────────────── */}
        <div className="flex flex-col min-w-0">
          {/* Name row */}
          <div className="flex items-baseline justify-between gap-2 pr-1 mb-1">
            <div className="min-w-0">
              <h3 className="font-display text-lg leading-tight tracking-wide text-[var(--bone)] uppercase truncate">
                {player.player_name}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`font-mono text-[9px] font-black tracking-[0.18em] ${band.text}`}>{band.label}</span>
                <span className="w-1 h-1 rounded-full bg-[var(--ink-600)]" />
                <span className="font-mono text-[10px] tabular text-[var(--ink-400)]">AGE {player.age}</span>
                <span className="w-1 h-1 rounded-full bg-[var(--ink-600)]" />
                <span className={`font-mono text-[9px] font-bold tracking-[0.18em] ${tier.text}`}>{tier.name}</span>
              </div>
            </div>
            {assignment && (
              <span className="shrink-0 font-mono text-[8.5px] tracking-[0.22em] uppercase px-1.5 py-0.5 rounded-sm bg-[var(--volt)]/15 text-[var(--volt)] border border-[var(--volt)]/30">
                In Camp
              </span>
            )}
          </div>

          {/* Plan selector + save */}
          <div className="flex items-center gap-1.5 mb-2">
            <div className="relative flex-1">
              <select
                value={selectedPlan}
                onChange={e => onChange(e.target.value)}
                className="appearance-none w-full px-2.5 py-1.5 pr-7 font-mono text-[11px] uppercase tracking-[0.08em] rounded
                  bg-[var(--ink-900)] border border-white/10 text-[var(--bone)]
                  focus:outline-none focus:border-[var(--volt)] focus:bg-[var(--ink-850)]"
                style={{ borderColor: previewPlan ? `${acc.hex}40` : undefined }}
              >
                <option value="">— No Active Plan —</option>
                {Object.entries(TRAINING_PLANS).map(([key, plan]) => (
                  <option key={key} value={key}>{plan.name}</option>
                ))}
              </select>
              <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--ink-400)] pointer-events-none" viewBox="0 0 12 12">
                <path d="M2 4 L6 8 L10 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
            <button
              onClick={onSave}
              disabled={!hasChange || saving}
              className={`px-2.5 py-1.5 rounded font-display text-[11px] tracking-[0.14em] uppercase transition-all
                ${hasChange && !saving
                  ? 'bg-[var(--volt)] text-[var(--ink-950)] hover:bg-[var(--volt-bright)] shadow-[0_3px_0_0_var(--volt-deep)]'
                  : 'bg-white/5 text-[var(--ink-500)] cursor-not-allowed'}`}
            >
              {saving ? '…' : (hasChange ? 'Save' : '✓')}
            </button>
          </div>

          {/* Targeted stats / accumulator bars */}
          {previewPlan ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[8.5px] tracking-[0.28em] uppercase text-[var(--ink-500)]">Regimen Targets</span>
                {hasCoachMatch && (
                  <span className="font-mono text-[8.5px] tracking-[0.22em] uppercase text-[var(--volt)] flex items-center gap-1">
                    <Zap size={9} /> Coach Matched
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {previewPlan.stats.map((statKey: string) => {
                  const stat = (player as any)[statKey] ?? 0;
                  const pot = player.potential ?? 99;
                  const facKey = primaryFacilityForStat(statKey, facilityLevels);
                  const facMeta = facKey ? FACILITY_META[facKey] : null;
                  const acc2 = facMeta?.accent ?? '#facc15';
                  const stackedMult = stackedStatMultiplier(statKey, facilityLevels);
                  const projected = projection?.stats.find(p => p.statKey === statKey)?.projected ?? stat;
                  const pctOfPot = Math.max(0, Math.min(1, stat / pot));
                  const pctProjected = Math.max(0, Math.min(1, projected / pot));
                  const progressFrac = Math.max(0, Math.min(1, progress[statKey] ?? 0));
                  const atCap = stat >= pot;
                  const delta = projected - stat;
                  return (
                    <div key={statKey} className="flex items-center gap-2">
                      <span className="font-mono text-[9px] tracking-[0.16em] uppercase text-[var(--ink-400)] w-9 text-right">{STAT_LABEL[statKey] ?? statKey.slice(0,3).toUpperCase()}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-white/[0.04] overflow-hidden relative">
                        {/* Projection (faded) underlay */}
                        <div className="absolute inset-y-0 left-0 opacity-40" style={{ width: `${pctProjected * 100}%`, background: `linear-gradient(90deg, ${acc2}55, ${acc2}aa)` }} />
                        {/* Current value */}
                        <div className="absolute inset-y-0 left-0 transition-all" style={{ width: `${pctOfPot * 100}%`, background: `linear-gradient(90deg, ${acc2}90, ${acc2})` }} />
                        {/* Pulse marker for tick progress */}
                        {!atCap && progressFrac > 0 && (
                          <div className="absolute top-0 bottom-0 w-px bg-[var(--volt)]" style={{ left: `${pctOfPot * 100}%` }} />
                        )}
                      </div>
                      <span className="font-mono text-[10px] tabular text-[var(--bone)] w-12 text-right">
                        {stat}<span className="text-[var(--ink-500)]">/{pot}</span>
                      </span>
                      <span className={`font-mono text-[9px] tabular w-9 text-right ${delta > 0 ? 'text-emerald-300' : 'text-[var(--ink-500)]'}`}>
                        {delta > 0 ? `+${delta}` : '·'}
                      </span>
                      <span className="font-mono text-[8.5px] text-[var(--ink-500)] w-9 text-right tabular" title="Stacked multiplier across the 3 facilities affecting this stat">
                        {stackedMult.toFixed(2)}×
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Season projection summary + days-to-next-OVR */}
              {projection && (
                <div className="mt-2 pt-2 border-t border-white/8 grid grid-cols-3 gap-2">
                  <div className="px-2 py-1.5 rounded-sm bg-white/[0.025] border border-white/8">
                    <div className="font-mono text-[8px] tracking-[0.24em] uppercase text-[var(--ink-500)]">End-of-Season</div>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="font-display text-base tabular text-[var(--bone)]">{projection.projectedOverall}</span>
                      <span className="font-mono text-[9px] text-[var(--ink-500)]">OVR</span>
                      {projection.deltaOverall > 0 && (
                        <span className="font-mono text-[9px] text-emerald-300 tabular">+{projection.deltaOverall}</span>
                      )}
                    </div>
                  </div>
                  <div className="px-2 py-1.5 rounded-sm bg-white/[0.025] border border-white/8">
                    <div className="font-mono text-[8px] tracking-[0.24em] uppercase text-[var(--ink-500)] flex items-center gap-1">
                      <CalendarDays size={8} /> Next OVR
                    </div>
                    <div className="mt-0.5">
                      {daysToNextOvr !== null ? (
                        <span className="font-display text-base tabular text-[var(--volt)]">~{daysToNextOvr}<span className="font-mono text-[9px] text-[var(--ink-500)] ml-1">days</span></span>
                      ) : (
                        <span className="font-mono text-[10px] text-[var(--ink-500)] uppercase tracking-[0.18em]">—</span>
                      )}
                    </div>
                  </div>
                  <div className="px-2 py-1.5 rounded-sm bg-white/[0.025] border border-white/8">
                    <div className="font-mono text-[8px] tracking-[0.24em] uppercase text-[var(--ink-500)]">Passive Δ</div>
                    <div className="mt-0.5">
                      {(() => {
                        const passiveDelta = projection.stats
                          .filter(s => !s.isTrained)
                          .reduce((sum, s) => sum + s.delta, 0);
                        const cls = passiveDelta > 0 ? 'text-emerald-300' : passiveDelta < 0 ? 'text-red-300' : 'text-[var(--ink-300)]';
                        return (
                          <span className={`font-display text-base tabular ${cls}`}>
                            {passiveDelta > 0 ? '+' : ''}{passiveDelta}
                            <span className="font-mono text-[9px] text-[var(--ink-500)] ml-1">pts</span>
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="border border-dashed border-white/10 rounded px-3 py-2.5 text-center">
              <span className="font-mono text-[10px] tracking-[0.24em] uppercase text-[var(--ink-500)]">
                Idle · Awaiting Regimen
              </span>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

/* ── Facility Card (summary, click to open modal) ──────────────────── */
function FacilityCard({ meta, level, idx, onClick }: {
  meta: FacilityMeta;
  level: number;
  idx: number;
  onClick: () => void;
}) {
  const Icon = meta.Icon;
  const c = meta.accent;
  const mult = facilityLevelMultiplier(level);
  const isMax = level >= MAX_LEVEL;

  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-[14px] surface card-hover animate-fade-up text-left cursor-pointer"
      style={{ animationDelay: `${idx * 50}ms`, borderColor: `${c}25` }}
    >
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: c }} />

      <div className="relative h-[128px] border-b border-white/8">
        <FacilityBlueprint meta={meta} level={level} />
        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-sm bg-[var(--ink-950)]/85 backdrop-blur-sm border" style={{ borderColor: `${c}55` }}>
          <span className="font-mono text-[8.5px] tracking-[0.22em] uppercase" style={{ color: c }}>Lv</span>
          <span className="font-display text-lg leading-none tabular" style={{ color: c }}>{level}</span>
          <span className="font-mono text-[8.5px] text-[var(--ink-500)]">/{MAX_LEVEL}</span>
        </div>
        <div className="absolute top-2 left-2 w-9 h-9 rounded-md flex items-center justify-center border" style={{ background: `${c}14`, borderColor: `${c}40` }}>
          <Icon size={18} style={{ color: c }} />
        </div>
      </div>

      <div className="p-3 flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-display text-base leading-tight tracking-wide uppercase text-[var(--bone)] truncate">
            {meta.name}
          </h3>
          <span className="font-mono text-[10px] tabular px-1.5 py-0.5 rounded-sm bg-white/5 text-[var(--ink-300)]">
            {mult.toFixed(2)}×
          </span>
        </div>

        <div className="flex flex-wrap gap-1">
          {meta.stats.slice(0, 5).map(s => (
            <span
              key={s}
              className="font-mono text-[8.5px] tracking-[0.18em] uppercase px-1.5 py-0.5 rounded-sm"
              style={{ background: `${c}14`, color: c, border: `1px solid ${c}30` }}
            >
              {STAT_LABEL[s] ?? s.slice(0,3).toUpperCase()}
            </span>
          ))}
          {meta.stats.length > 5 && (
            <span className="font-mono text-[8.5px] tracking-[0.18em] uppercase px-1.5 py-0.5 rounded-sm bg-white/5 text-[var(--ink-400)]">
              +{meta.stats.length - 5}
            </span>
          )}
        </div>

        {/* Level dot ladder (0-5, 6 segments) */}
        <div className="flex items-center gap-1 pt-0.5">
          {[1,2,3,4,5].map(i => (
            <div
              key={i}
              className="h-1 flex-1 rounded-sm transition-all"
              style={{ background: i <= level ? c : 'rgba(255,255,255,0.08)' }}
            />
          ))}
        </div>

        {/* CTA strip */}
        <div className="mt-1 flex items-center justify-between gap-2 px-2 py-1.5 rounded-sm border border-white/8 bg-white/[0.02] group-hover:bg-white/[0.04] transition">
          <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-[var(--ink-400)]">
            {isMax ? 'Maxed' : 'View / Upgrade'}
          </span>
          <ArrowRight size={11} className="text-[var(--ink-500)] group-hover:text-[var(--bone)] transition-colors" />
        </div>
      </div>
    </button>
  );
}

/* ── Facility Detail Modal ─────────────────────────────────────────── */
function FacilityDetailModal({
  facilityKey, facility, facilityLevels, teamMoney, isUpgrading, onUpgrade, onClose,
}: {
  facilityKey: FacilityKey;
  facility: Facility | undefined;
  facilityLevels: Record<string, number>;
  teamMoney: number;
  isUpgrading: boolean;
  onUpgrade: () => void;
  onClose: () => void;
}) {
  const meta = FACILITY_META[facilityKey];
  const Icon = meta.Icon;
  const c = meta.accent;
  const level = facility?.level ?? 0;
  const isMax = level >= MAX_LEVEL;
  const nextLevel = isMax ? null : level + 1;
  const nextCost = nextLevel ? (UPGRADE_COST_TO_LEVEL[nextLevel] ?? null) : null;
  const canAfford = nextCost !== null && teamMoney >= nextCost;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  return createPortal((
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-[18px] surface-raised animate-fade-up"
        style={{
          border: `1px solid ${c}40`,
          boxShadow: `0 24px 80px -20px ${c}55, 0 1px 0 rgba(255,255,255,0.06) inset`,
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: c }} />

        {/* Hero strip */}
        <div className="relative h-[160px] border-b border-white/8 overflow-hidden">
          <FacilityBlueprint meta={meta} level={level} />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center bg-[var(--ink-950)]/85 backdrop-blur-sm border border-white/10 text-[var(--ink-300)] hover:text-[var(--bone)] hover:border-white/30 transition"
            aria-label="Close"
          >
            <X size={15} />
          </button>
          <div className="absolute top-3 left-3 flex items-center gap-3">
            <div className="w-12 h-12 rounded-md flex items-center justify-center border" style={{ background: `${c}18`, borderColor: `${c}55` }}>
              <Icon size={24} style={{ color: c }} />
            </div>
            <div>
              <div className="font-mono text-[8.5px] tracking-[0.32em] uppercase" style={{ color: c }}>Facility · {meta.short}</div>
              <h2 className="font-display text-3xl leading-none tracking-wide uppercase text-[var(--bone)] mt-1">{meta.name}</h2>
            </div>
          </div>
          <div className="absolute bottom-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-sm bg-[var(--ink-950)]/90 border" style={{ borderColor: `${c}55` }}>
            <span className="font-mono text-[10px] tracking-[0.22em] uppercase" style={{ color: c }}>Lv</span>
            <span className="font-display text-2xl tabular leading-none" style={{ color: c }}>{level}</span>
            <span className="font-mono text-[10px] text-[var(--ink-500)]">/{MAX_LEVEL}</span>
            <span className="w-1 h-1 rounded-full mx-1" style={{ background: c }} />
            <span className="font-mono text-[11px] tabular text-[var(--bone)]">{facilityLevelMultiplier(level).toFixed(2)}×</span>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          <p className="text-sm text-[var(--ink-300)] leading-relaxed">{meta.description}</p>

          {/* Stat coverage */}
          <section>
            <div className="eyebrow mb-2">Boosted Stats · {meta.stats.length}</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {meta.stats.map(s => {
                const stacked = stackedStatMultiplier(s, facilityLevels);
                return (
                  <div
                    key={s}
                    className="flex items-center justify-between px-2.5 py-2 rounded-sm border bg-white/[0.02]"
                    style={{ borderColor: `${c}25` }}
                  >
                    <div className="flex flex-col">
                      <span className="font-mono text-[10px] tracking-[0.2em] uppercase" style={{ color: c }}>
                        {STAT_LABEL[s] ?? s.slice(0,3).toUpperCase()}
                      </span>
                      <span className="font-mono text-[8.5px] text-[var(--ink-500)] uppercase tracking-[0.16em]">{s.replace(/_/g, ' ')}</span>
                    </div>
                    <span className="font-mono text-[11px] tabular text-[var(--bone)]" title="Effective stacked multiplier across all 3 facilities for this stat">
                      {stacked.toFixed(2)}×
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] font-mono uppercase tracking-[0.22em] text-[var(--ink-500)]">
              Stacked multiplier shown reflects combined contribution from all three facilities affecting that stat.
            </p>
          </section>

          {/* Upgrade ladder */}
          <section>
            <div className="eyebrow mb-2">Upgrade Ladder</div>
            <div className="grid grid-cols-6 gap-2">
              {LEVEL_MULTIPLIER.map((m, i) => {
                const isCurrent = i === level;
                const isNext = i === level + 1;
                const isPast = i < level;
                return (
                  <div
                    key={i}
                    className="rounded-sm border px-2 py-2 text-center transition-colors"
                    style={{
                      borderColor: isCurrent ? c : isNext ? `${c}80` : 'rgba(255,255,255,0.08)',
                      background: isPast ? `${c}18` : isCurrent ? `${c}28` : isNext ? `${c}10` : 'transparent',
                    }}
                  >
                    <div className="font-mono text-[8.5px] tracking-[0.22em] uppercase" style={{ color: isCurrent ? c : 'var(--ink-500)' }}>L{i}</div>
                    <div className="font-display text-[15px] tabular mt-0.5" style={{ color: isPast || isCurrent ? c : 'var(--bone)' }}>
                      {m.toFixed(2)}×
                    </div>
                    <div className="font-mono text-[9px] tabular mt-0.5 text-[var(--ink-500)]">
                      {i === 0 ? '—' : `$${(UPGRADE_COST_TO_LEVEL[i] / 1_000_000).toFixed(i >= 4 ? 0 : 1)}M`}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* CTA */}
          <section className="flex items-center gap-3 pt-1 border-t border-white/8 pt-4">
            <div className="flex-1">
              <div className="font-mono text-[9px] tracking-[0.24em] uppercase text-[var(--ink-500)]">Treasury</div>
              <div className="font-mono text-base tabular text-[var(--money)]">${teamMoney.toLocaleString()}</div>
            </div>
            {isMax ? (
              <div className="flex items-center justify-center gap-2 px-5 py-3 rounded-sm border" style={{ borderColor: `${c}55`, background: `${c}10` }}>
                <Lock size={14} style={{ color: c }} />
                <span className="font-display text-sm tracking-[0.22em] uppercase" style={{ color: c }}>Max Tier</span>
              </div>
            ) : (
              <button
                onClick={onUpgrade}
                disabled={!canAfford || isUpgrading}
                className={`px-5 py-3 rounded-sm font-display text-sm tracking-[0.18em] uppercase flex items-center gap-3 transition-all
                  ${canAfford && !isUpgrading
                    ? 'bg-[var(--volt)] text-[var(--ink-950)] hover:bg-[var(--volt-bright)] shadow-[0_3px_0_0_var(--volt-deep)] hover:translate-y-[-1px]'
                    : 'bg-white/5 text-[var(--ink-500)] cursor-not-allowed border border-white/8'}`}
              >
                <span>{isUpgrading ? 'Building…' : `Upgrade → L${nextLevel} · ${LEVEL_MULTIPLIER[nextLevel ?? level].toFixed(2)}×`}</span>
                <span className="font-mono tabular text-[12px] px-2 py-0.5 rounded bg-black/15">${(nextCost ?? 0).toLocaleString()}</span>
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  ), document.body);
}

/* ── Hired Coach Card ──────────────────────────────────────────────── */
function HiredCoachCard({ coach, onFire, idx }: { coach: Coach; onFire: () => void; idx: number }) {
  const stars = coach.stars ?? Math.ceil((coach.quality / 100) * 5);
  const plan = (TRAINING_PLANS as Record<string, any>)[coach.specialty];
  return (
    <article
      className="relative overflow-hidden surface-raised animate-fade-up"
      style={{ animationDelay: `${idx * 50}ms` }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--volt)]" />
      <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full opacity-[0.06] blur-3xl bg-[var(--volt)]" />

      <div className="relative grid grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-3">
        {/* Initials medallion */}
        <div className="w-14 h-14 rounded-md flex items-center justify-center border border-[var(--volt)]/35 bg-[var(--volt)]/8">
          <span className="font-display text-xl tabular text-[var(--volt)]">
            {coach.coach_name.split(' ').map(n => n[0]).slice(0, 2).join('')}
          </span>
        </div>

        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <h3 className="font-display text-xl leading-tight tracking-wide uppercase text-[var(--bone)] truncate">
              {coach.coach_name}
            </h3>
            <div className="flex tabular gap-[1px]">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className={i < stars ? 'text-[var(--volt)]' : 'text-[var(--ink-700)]'}>★</span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono text-[9px] tracking-[0.22em] uppercase px-1.5 py-0.5 rounded-sm bg-[var(--volt)]/10 text-[var(--volt)] border border-[var(--volt)]/25">
              {plan?.name ?? coach.specialty}
            </span>
            <span className="font-mono text-[10px] tabular text-[var(--ink-400)]">
              Q{coach.quality}
            </span>
            <span className="w-1 h-1 rounded-full bg-[var(--ink-600)]" />
            <span className="font-mono text-[10px] tabular text-[var(--money)]">
              ${(coach.monthly_wage || 0).toLocaleString()}/mo
            </span>
          </div>
        </div>

        <button
          onClick={onFire}
          className="font-display text-[11px] tracking-[0.18em] uppercase px-3 py-1.5 rounded-sm border border-red-500/25 text-red-400/80 hover:border-red-500/60 hover:text-red-300 hover:bg-red-500/8 transition-colors"
        >
          Fire
        </button>
      </div>
    </article>
  );
}

/* ── Pool Coach Row ────────────────────────────────────────────────── */
function PoolCoachRow({ coach, isHired, canHire, onHire, idx }: {
  coach: PoolCoach; isHired: boolean; canHire: boolean; onHire: () => void; idx: number;
}) {
  const plan = (TRAINING_PLANS as Record<string, any>)[coach.specialty];
  const tierText = coach.stars >= 4 ? 'text-emerald-300' : coach.stars >= 3 ? 'text-[var(--volt)]' : coach.stars >= 2 ? 'text-zinc-300' : 'text-orange-300';
  return (
    <div
      className={`relative grid grid-cols-[auto_1fr_auto] items-center gap-2.5 px-2 py-2 rounded transition-colors animate-fade-up
        ${isHired ? 'bg-white/[0.02] opacity-40' : 'bg-white/[0.025] hover:bg-white/[0.05] border border-white/5'}`}
      style={{ animationDelay: `${idx * 25}ms` }}
    >
      {/* Avatar */}
      <div className="w-9 h-9 rounded flex items-center justify-center bg-white/5 border border-white/8">
        <span className="font-display text-sm tabular text-[var(--bone)]">
          {coach.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
        </span>
      </div>

      <div className="min-w-0">
        <div className="font-mono text-[11px] font-bold text-[var(--bone)] truncate uppercase tracking-wide">
          {coach.name}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`font-mono text-[8.5px] tracking-[0.18em] uppercase ${tierText}`}>
            {'★'.repeat(coach.stars)}
          </span>
          <span className="font-mono text-[9px] text-[var(--ink-400)] truncate">
            {plan?.name ?? coach.specialty}
          </span>
        </div>
        <div className="font-mono text-[8.5px] tabular text-[var(--ink-500)] mt-0.5">
          ${coach.monthlyWage.toLocaleString()}/mo
        </div>
      </div>

      {isHired ? (
        <span className="font-mono text-[8.5px] tracking-[0.24em] uppercase text-[var(--ink-500)] px-1.5">Hired</span>
      ) : (
        <button
          onClick={onHire}
          disabled={!canHire}
          className={`px-2 py-1.5 rounded-sm font-display text-[11px] tracking-[0.14em] uppercase whitespace-nowrap transition-all
            ${canHire
              ? 'bg-[var(--volt)] text-[var(--ink-950)] hover:bg-[var(--volt-bright)] shadow-[0_2px_0_0_var(--volt-deep)]'
              : 'bg-white/5 text-[var(--ink-600)] cursor-not-allowed'}`}
        >
          <div className="text-[9px] leading-none tracking-[0.18em]">Hire</div>
          <div className="font-mono text-[10px] tabular leading-tight mt-0.5">${coach.hireCost.toLocaleString()}</div>
        </button>
      )}
    </div>
  );
}
