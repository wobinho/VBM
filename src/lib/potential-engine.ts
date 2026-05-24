/**
 * Per-stat potential engine.
 *
 * Each player has 30 per-stat potentials (one ceiling per stat). The
 * "potential overall" is derived from these via the same position-weighted
 * OVR formula in `overall.ts`.
 *
 * Two responsibilities:
 *   1. `generateInitialStatPotentials` — used when creating a new player
 *      (seed files, player-gen, custom save) and when migrating existing
 *      single-`potential` players to the per-stat model.
 *   2. `recalculateSeasonPotentials` — runs at end-of-season. Each player's
 *      per-stat potentials drift based on age and last season's match output
 *      (spikes / blocks / aces / digs / matches played / team success).
 *      Young players trend up, peak players hover, older players trend down.
 *      Stats the player actually used get bigger bumps. If a potential drops
 *      below the current stat value, the actual stat decays one tick toward
 *      the new ceiling.
 */
import type Database from 'better-sqlite3';
import {
  ALL_STAT_KEYS,
  POSITION_GROUPINGS,
  potentialKeyFor,
  type StatKey,
} from './overall';

/* ───────────────────────── helpers ──────────────────────────── */

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/* ───────────────────── initial generation ───────────────────── */

/**
 * Age-based headroom — how far above the current stat value a generated
 * potential can sit. Mirrors the headroom shape used by the legacy single-
 * potential generator but applied per-stat so each stat carries its own
 * ceiling.
 */
function headroomForAge(age: number): [number, number] {
  if (age <= 20) return [8, 20];
  if (age <= 23) return [5, 14];
  if (age <= 26) return [2, 9];
  if (age <= 30) return [0, 5];
  return [0, 2];
}

/**
 * Extra headroom for stats the player's position actually uses — gives
 * young prospects more ceiling on the stats that matter for their role.
 */
function positionBoost(stat: StatKey, position: string): number {
  const g = POSITION_GROUPINGS[position];
  if (!g) return 0;
  if (stat === g.main1) return randFloat(2, 4);
  if (stat === g.main2) return randFloat(1, 3);
  if (g.secondary.includes(stat)) return randFloat(0, 2);
  return 0;
}

/**
 * Generate the full set of `{stat}_potential` values for a player.
 *
 * @param currentStats   The player's current 30 stat values (post-OVR-calc).
 * @param age            Used to scale headroom — younger players climb more.
 * @param position       Used to bias headroom toward position-relevant stats.
 */
export function generateInitialStatPotentials(
  currentStats: Record<string, number>,
  age: number,
  position: string,
): Record<string, number> {
  const [hMin, hMax] = headroomForAge(age);
  const out: Record<string, number> = {};
  for (const stat of ALL_STAT_KEYS) {
    const cur = currentStats[stat] ?? 50;
    const headroom = randFloat(hMin, hMax);
    const boost = positionBoost(stat, position);
    const noise = randFloat(-1.5, 1.5);
    const pot = Math.round(cur + headroom + boost + noise);
    out[potentialKeyFor(stat)] = clamp(pot, Math.max(1, cur), 100);
  }
  return out;
}

/**
 * Mirror of `generateInitialStatPotentials` but deterministically clamped to
 * a target overall potential. Used by the custom-save wizard where the user
 * specifies a single "target potential overall" value — we distribute it
 * across the 30 stat potentials proportional to position relevance.
 *
 * Strategy: start by setting every stat-potential to the target, then add
 * small per-stat noise. The OVR formula will land very close to the target
 * since each stat contributes roughly its position-weighted share.
 */
export function generateStatPotentialsFromTarget(
  currentStats: Record<string, number>,
  targetOverall: number,
  position: string,
): Record<string, number> {
  const g = POSITION_GROUPINGS[position];
  const out: Record<string, number> = {};
  for (const stat of ALL_STAT_KEYS) {
    const cur = currentStats[stat] ?? 50;
    let base = targetOverall;
    if (g) {
      if (stat === g.main1) base = targetOverall + randFloat(0, 3);
      else if (stat === g.main2) base = targetOverall + randFloat(0, 2);
      else if (g.secondary.includes(stat)) base = targetOverall + randFloat(-1, 1);
      else base = targetOverall + randFloat(-3, 0);
    }
    const noise = randFloat(-1, 1);
    out[potentialKeyFor(stat)] = clamp(Math.round(base + noise), Math.max(1, cur), 100);
  }
  return out;
}

/* ───────────────────── season recalculation ─────────────────── */

interface SeasonStatRow {
  player_id: number;
  team_id: number | null;
  matches_played: number;
  spikes: number;
  blocks: number;
  aces: number;
  digs: number;
}

interface TeamGrade {
  team_id: number;
  win_rate: number;          // 0..1
  matches_total: number;     // for "minutes_perf" denominator
}

/**
 * Age-based base shift applied to every stat potential before performance
 * modifiers kick in. Young players trend up, peak players hover, older
 * players trend down. Range is roughly ±4 on the strongest ages, modulated
 * to ±2 after performance terms are added.
 */
function baseAgeShift(age: number): number {
  if (age <= 19) return randFloat(2.0, 4.0);
  if (age <= 22) return randFloat(0.8, 2.8);
  if (age <= 25) return randFloat(-0.3, 1.5);
  if (age <= 28) return randFloat(-0.8, 0.5);
  if (age <= 31) return randFloat(-1.8, -0.2);
  if (age <= 34) return randFloat(-3.0, -0.8);
  return randFloat(-4.0, -1.5);
}

/**
 * Normalize a per-match rate into a 0..1 grade. `target` is the level at which
 * the grade saturates to 1; players at half that produce 0.5 (average).
 */
function gradePerMatch(total: number, matches: number, target: number): number {
  if (matches <= 0) return 0.5;
  const perMatch = total / matches;
  return clamp(perMatch / (target * 2), 0, 1);
}

/** Per-stat performance shift in OVR-potential points. */
function performanceShift(
  stat: StatKey,
  perf: {
    attack: number;
    block: number;
    serve: number;
    dig: number;
    general: number;     // team success, 0..1
    minutes: number;     // share of season played, 0..1
  },
): number {
  const center = (g: number) => g - 0.5;       // -0.5..0.5
  switch (stat) {
    case 'attack':       return center(perf.attack) * 8;
    case 'precision':    return center(perf.attack) * 4;
    case 'spin':         return center(perf.attack) * 4;
    case 'technique':    return center(perf.attack) * 3;
    case 'flair':        return center(perf.attack) * 2;
    case 'vertical':     return center((perf.attack + perf.block) / 2) * 4;
    case 'strength':     return center((perf.attack + perf.block) / 2) * 3;
    case 'block':        return center(perf.block) * 8;
    case 'positioning':  return center(perf.block) * 3;
    case 'serve':        return center(perf.serve) * 8;
    case 'digging':      return center(perf.dig) * 8;
    case 'receive':      return center(perf.dig) * 8;
    case 'agility':      return center(perf.dig) * 3;
    case 'balance':      return center(perf.dig) * 3;
    case 'flexibility':  return center(perf.dig) * 2;
    case 'endurance':    return center(perf.minutes) * 4;
    case 'consistency':  return center((perf.minutes + perf.general) / 2) * 3;
    case 'concentration':return center((perf.minutes + perf.general) / 2) * 3;
    case 'setting':      return center(perf.general) * 2;
    case 'playmaking':   return center(perf.general) * 2;
    case 'vision':       return center(perf.general) * 2;
    case 'game_iq':      return center(perf.general) * 2;
    case 'leadership':   return center(perf.general) * 2;
    case 'teamwork':     return center(perf.general) * 2;
    case 'pressure':     return center(perf.general) * 2;
    case 'intimidation': return center(perf.general) * 1.5;
    case 'defense':      return center((perf.block + perf.dig) / 2) * 3;
    case 'speed':        return center(perf.minutes) * 2;
    case 'torque':       return center(perf.attack) * 2;
    case 'ball_control': return center((perf.dig + perf.general) / 2) * 2;
    default:             return center(perf.general) * 1;
  }
}

/**
 * For positions that don't accumulate spike/block/ace/dig stats (Setter)
 * fall back to team success + minutes-played as the dominant signal. The
 * `perf` returned still has all four buckets so the per-stat formulas above
 * remain uniform.
 */
function gradesForPlayer(
  position: string,
  s: SeasonStatRow,
  teamGrade: TeamGrade,
): {
  attack: number; block: number; serve: number; dig: number;
  general: number; minutes: number;
} {
  const matches = s.matches_played;
  const minutes = teamGrade.matches_total > 0
    ? clamp(matches / teamGrade.matches_total, 0, 1)
    : 0.5;
  const general = teamGrade.win_rate;

  if (position === 'Setter') {
    // No reliable spike/block/ace/dig signal — collapse everything to team play.
    return { attack: general, block: general, serve: general, dig: general, general, minutes };
  }
  if (position === 'Libero') {
    // Liberos still serve (occasionally) but mostly receive/dig.
    return {
      attack: general,
      block: general,
      serve: gradePerMatch(s.aces, matches, 0.5),
      dig:   gradePerMatch(s.digs, matches, 6),
      general,
      minutes,
    };
  }
  // Outside, Opposite, Middle — full stat-line.
  return {
    attack: gradePerMatch(s.spikes, matches, 8),
    block:  gradePerMatch(s.blocks, matches, 1.5),
    serve:  gradePerMatch(s.aces,   matches, 0.8),
    dig:    gradePerMatch(s.digs,   matches, 2),
    general,
    minutes,
  };
}

interface PlayerRow extends Record<string, unknown> {
  id: number;
  position: string;
  age: number;
  team_id: number | null;
}

/**
 * Recalculate per-stat potentials for every player based on the season that
 * just ended. Pure side-effect: writes updated `{stat}_potential` columns
 * back to the players row, and decays the actual stat by 1 toward potential
 * when potential drops below current.
 *
 * Designed to be called inside `endSeason()` AFTER snapshotting and BEFORE
 * ageing players — so the `age` field still reflects the season just played.
 */
export function recalculateSeasonPotentials(
  db: Database.Database,
  seasonYear: number,
): { playersUpdated: number; decays: number } {
  // 1. Per-team win-rate, used as a proxy for general play quality and as
  // the denominator for "minutes played" (a player on a 30-match team who
  // played 28 → 0.93 minutes_perf).
  const teamSnapshots = db.prepare(`
    SELECT team_id, won, played
    FROM team_season_snapshots
    WHERE season_year = ?
  `).all(seasonYear) as { team_id: number; won: number; played: number }[];

  const teamGrades = new Map<number, TeamGrade>();
  for (const t of teamSnapshots) {
    teamGrades.set(t.team_id, {
      team_id: t.team_id,
      win_rate: t.played > 0 ? t.won / t.played : 0.5,
      matches_total: t.played,
    });
  }

  // 2. Aggregate per-player season output. Only league/playoff/cup rows for
  // the given season_year — a player who joined mid-season is naturally
  // scored on partial matches_played.
  const statRows = db.prepare(`
    SELECT player_id, MAX(team_id) AS team_id,
           COUNT(*) AS matches_played,
           COALESCE(SUM(spikes), 0) AS spikes,
           COALESCE(SUM(blocks), 0) AS blocks,
           COALESCE(SUM(aces),   0) AS aces,
           COALESCE(SUM(digs),   0) AS digs
    FROM player_match_stats
    WHERE season_year = ?
    GROUP BY player_id
  `).all(seasonYear) as SeasonStatRow[];
  const statsByPlayer = new Map<number, SeasonStatRow>();
  for (const r of statRows) statsByPlayer.set(r.player_id, r);

  // 3. Pull every player. Players without match rows still get an age-only
  // recalc (treats them as "no minutes" → minutes_perf = 0).
  const players = db.prepare(
    'SELECT * FROM players'
  ).all() as PlayerRow[];

  const potentialCols = ALL_STAT_KEYS.map(s => `${potentialKeyFor(s)} = @${potentialKeyFor(s)}`).join(', ');
  const statCols      = ALL_STAT_KEYS.map(s => `${s} = @${s}`).join(', ');
  const updateAll = db.prepare(`UPDATE players SET ${potentialCols}, ${statCols} WHERE id = @id`);

  let playersUpdated = 0;
  let decays = 0;
  const empty: SeasonStatRow = {
    player_id: 0, team_id: null, matches_played: 0,
    spikes: 0, blocks: 0, aces: 0, digs: 0,
  };

  const txn = db.transaction(() => {
    for (const p of players) {
      const seasonStats = statsByPlayer.get(p.id) ?? empty;
      const teamGrade = p.team_id != null
        ? teamGrades.get(p.team_id) ?? { team_id: -1, win_rate: 0.5, matches_total: 0 }
        : { team_id: -1, win_rate: 0.5, matches_total: 0 };

      const perf = gradesForPlayer(p.position, seasonStats, teamGrade);
      const base = baseAgeShift(p.age);

      const update: Record<string, unknown> = { id: p.id };

      for (const stat of ALL_STAT_KEYS) {
        const potKey = potentialKeyFor(stat);
        const oldPot = typeof p[potKey] === 'number' ? (p[potKey] as number) : 70;
        const shift = base + performanceShift(stat, perf);
        const newPot = clamp(Math.round(oldPot + shift), 1, 100);
        update[potKey] = newPot;

        // Decay: if new potential dropped below the current stat, pull the
        // stat one tick down toward the new ceiling. One tick per season
        // keeps decline gentle; passive training drift handles the rest for
        // players in an active plan.
        const curStat = typeof p[stat] === 'number' ? (p[stat] as number) : 50;
        if (newPot < curStat) {
          update[stat] = Math.max(newPot, curStat - 1);
          decays++;
        } else {
          update[stat] = curStat;
        }
      }

      updateAll.run(update);
      playersUpdated++;
    }
  });
  txn();

  return { playersUpdated, decays };
}
