import { getDb } from './index';
import { generatePlayoffSchedule, getPlayoffRoundDates } from '../schedule-engine';
import { generateScheduleForLeague, generatePostSeason, shouldGeneratePostSeason, processPromotionRelegationByConfig } from '../league-engine';
import { calculateOverall as calcOvr, ALL_STAT_KEYS } from '../overall';

// ==================== TYPES ====================
export interface League { id: number; league_name: string; country?: string; tier?: number; created_at: string; updated_at: string; }
export interface Team { id: number; team_name: string; league_id: number; team_money: number; played: number; won: number; lost: number; points: number; sets_won: number; sets_lost: number; score_diff: number; stadium: string; capacity: number; founded: string; country?: string; region?: string; created_at: string; updated_at: string; league_name?: string; win_rate?: number; }
export interface Player {
    id: number; player_name: string; team_id: number | null; position: string; age: number; country: string;
    jersey_number: number; overall: number; height?: number; potential?: number;
    // Core Skills
    attack: number; defense: number; serve: number; block: number; receive: number; setting: number;
    // Technical Skills
    precision: number; flair: number; digging: number; positioning: number;
    ball_control: number; technique: number; playmaking: number; spin: number;
    // Physical Skills
    speed: number; agility: number; strength: number; endurance: number;
    vertical: number; flexibility: number; torque: number; balance: number;
    // Mental Skills
    leadership: number; teamwork: number; concentration: number; pressure: number;
    consistency: number; vision: number; game_iq: number; intimidation: number;
    // Contract
    contract_years: number; monthly_wage: number; player_value: number;
    created_at: string; updated_at: string; team_name?: string;
}
export interface Transfer { id: number; player_id: number; from_team: number | null; to_team: number | null; price: number; transfer_date: string; status: string; created_at: string; updated_at: string; player_name?: string; from_team_name?: string; to_team_name?: string; }
export interface User { id: string; email: string; username: string; password_hash: string; display_name: string; created_at: string; updated_at: string; last_login: string | null; is_active: number; is_admin: number; }
export interface UserTeam { id: number; user_id: string; team_id: number; is_primary: number; created_at: string; updated_at: string; }
export interface TransferOffer { id: number; player_id: number; from_user_id: string; to_user_id: string; offer_amount: number; message: string | null; status: string; expires_at: string; created_at: string; updated_at: string; responded_at: string | null; player_name?: string; from_team_name?: string; to_team_name?: string; }

// ==================== OVERALL & PLAYER VALUE ====================
// Position-weighted formula: Main1 40% + Main2 35% + SecondaryAvg 20% + OtherAvg 5%
// Implemented in src/lib/overall.ts — re-exported here for backward compat.
export { calculateOverall } from '../overall';

/** Legacy-compatible overload: accepts individual stat args and delegates to the shared calc. */
export function calculateOverallFromArgs(
    attack: number, defense: number, serve: number, block: number, receive: number, setting: number,
    speed: number, agility: number, strength: number, endurance: number, vertical: number, flexibility: number, torque: number, balance: number,
    leadership: number, teamwork: number, concentration: number, pressure: number, consistency: number, vision: number, game_iq: number, intimidation: number,
    position: string,
    precision: number, flair: number, digging: number, positioning: number,
    ball_control: number, technique: number, playmaking: number, spin: number,
): number {
    return calcOvr({
        attack, defense, serve, block, receive, setting,
        precision, flair, digging, positioning, ball_control, technique, playmaking, spin,
        speed, agility, strength, endurance, vertical, flexibility, torque, balance,
        leadership, teamwork, concentration, pressure, consistency, vision, game_iq, intimidation,
    }, position);
}

export function calculatePlayerValue(overall: number, age: number) {
    const baseValue = overall * 5000;
    let ageMod = 1.0;
    if (age < 22) ageMod = 1.3;
    else if (age < 25) ageMod = 1.1;
    else if (age < 30) ageMod = 1.0;
    else if (age < 35) ageMod = 0.8;
    else ageMod = 0.6;
    return Math.round(baseValue * ageMod);
}

function recomputeOverall(player: Player): Player {
    const stats: Record<string, number> = {};
    for (const k of ALL_STAT_KEYS) {
        stats[k] = (player as unknown as Record<string, number>)[k] ?? 50;
    }
    const overall = calcOvr(stats, player.position ?? '');
    return { ...player, overall };
}

// ==================== LEAGUES ====================
export function getLeagues(): League[] {
    return getDb().prepare('SELECT * FROM leagues ORDER BY id').all() as League[];
}

export function getLeagueById(id: number): League | undefined {
    return getDb().prepare('SELECT * FROM leagues WHERE id = ?').get(id) as League | undefined;
}

// ==================== TEAMS ====================
export function getTeams(): Team[] {
    const teams = getDb().prepare(`
    SELECT t.*, l.league_name FROM teams t
    LEFT JOIN leagues l ON t.league_id = l.id
    ORDER BY t.points DESC
  `).all() as Team[];
    return teams.map(t => ({ ...t, win_rate: t.played > 0 ? Math.round((t.won / t.played) * 100) : 0 }));
}

export function getTeamById(id: number): Team | undefined {
    return getDb().prepare(`
    SELECT t.*, l.league_name FROM teams t
    LEFT JOIN leagues l ON t.league_id = l.id
    WHERE t.id = ?
  `).get(id) as Team | undefined;
}

export function getTeamsByLeague(leagueId: number): Team[] {
    return getDb().prepare(`
    SELECT t.*, l.league_name FROM teams t
    LEFT JOIN leagues l ON t.league_id = l.id
    WHERE t.league_id = ?
    ORDER BY t.points DESC
  `).all(leagueId) as Team[];
}

export function updateTeamMoney(teamId: number, amount: number) {
    return getDb().prepare("UPDATE teams SET team_money = ? WHERE id = ?").run(amount, teamId);
}

export function updateTeamStats(teamId: number, data: Partial<Team>) {
    const fields = Object.keys(data).filter(k => k !== 'id').map(k => `${k} = @${k}`).join(', ');
    return getDb().prepare(`UPDATE teams SET ${fields} WHERE id = @id`).run({ ...data, id: teamId });
}

// ==================== PLAYERS ====================
export function getPlayers(teamId?: number): Player[] {
    if (teamId) {
        const rows = getDb().prepare(`
      SELECT p.*, t.team_name, t.country as team_country FROM players p
      LEFT JOIN teams t ON p.team_id = t.id
      WHERE p.team_id = ?
      ORDER BY p.overall DESC
    `).all(teamId) as Player[];
        return rows.map(recomputeOverall);
    }
    const rows = getDb().prepare(`
    SELECT p.*, t.team_name, t.country as team_country FROM players p
    LEFT JOIN teams t ON p.team_id = t.id
    ORDER BY p.overall DESC
  `).all() as Player[];
    return rows.map(recomputeOverall);
}

export function getPlayerById(id: number): Player | undefined {
    const row = getDb().prepare(`
    SELECT p.*, t.team_name, t.country as team_country FROM players p
    LEFT JOIN teams t ON p.team_id = t.id
    WHERE p.id = ?
  `).get(id) as Player | undefined;
    return row ? recomputeOverall(row) : undefined;
}

export function getFreeAgents(): Player[] {
    const rows = getDb().prepare('SELECT * FROM players WHERE team_id IS NULL ORDER BY overall DESC').all() as Player[];
    return rows.map(recomputeOverall);
}

export function searchPlayers(term: string): Player[] {
    const like = `%${term}%`;
    const rows = getDb().prepare(`
    SELECT p.*, t.team_name, t.country as team_country FROM players p
    LEFT JOIN teams t ON p.team_id = t.id
    WHERE p.player_name LIKE ? OR p.country LIKE ? OR p.position LIKE ?
    ORDER BY p.overall DESC
  `).all(like, like, like) as Player[];
    return rows.map(recomputeOverall);
}

export function createPlayer(data: Omit<Player, 'id' | 'created_at' | 'updated_at' | 'team_name'> & { id?: number }): number {
    const hasCustomId = data.id !== undefined;
    const cols = `player_name, team_id, position, age, country, jersey_number, overall,
          attack, defense, serve, block, receive, setting,
          precision, flair, digging, positioning, ball_control, technique, playmaking, spin,
          speed, agility, strength, endurance, vertical, flexibility, torque, balance,
          leadership, teamwork, concentration, pressure, consistency, vision, game_iq, intimidation,
          contract_years, monthly_wage, player_value`;
    const vals = `@player_name, @team_id, @position, @age, @country, @jersey_number, @overall,
          @attack, @defense, @serve, @block, @receive, @setting,
          @precision, @flair, @digging, @positioning, @ball_control, @technique, @playmaking, @spin,
          @speed, @agility, @strength, @endurance, @vertical, @flexibility, @torque, @balance,
          @leadership, @teamwork, @concentration, @pressure, @consistency, @vision, @game_iq, @intimidation,
          @contract_years, @monthly_wage, @player_value`;

    if (hasCustomId) {
        getDb().prepare(`INSERT INTO players (id, ${cols}) VALUES (@id, ${vals})`).run(data);
        return data.id!;
    } else {
        const result = getDb().prepare(`INSERT INTO players (${cols}) VALUES (${vals})`).run(data);
        return Number(result.lastInsertRowid);
    }
}

export function updatePlayer(id: number, data: Partial<Player>) {
    const allowedFields = [
        'player_name', 'team_id', 'position', 'age', 'country', 'jersey_number', 'overall',
        'height', 'potential',
        'attack', 'defense', 'serve', 'block', 'receive', 'setting',
        'precision', 'flair', 'digging', 'positioning', 'ball_control', 'technique', 'playmaking', 'spin',
        'speed', 'agility', 'strength', 'endurance', 'vertical', 'flexibility', 'torque', 'balance',
        'leadership', 'teamwork', 'concentration', 'pressure', 'consistency', 'vision', 'game_iq', 'intimidation',
        'contract_years', 'monthly_wage', 'player_value',
    ];
    const updates: Record<string, unknown> = {};
    for (const key of allowedFields) {
        if (key in data) updates[key] = (data as Record<string, unknown>)[key];
    }
    if (Object.keys(updates).length === 0) return;
    const fields = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
    return getDb().prepare(`UPDATE players SET ${fields}, updated_at = datetime('now') WHERE id = @id`).run({ ...updates, id });
}

export function deletePlayer(id: number) {
    return getDb().prepare('DELETE FROM players WHERE id = ?').run(id);
}

// ==================== TRANSFERS ====================
export function getTransfers(): Transfer[] {
    return getDb().prepare(`
    SELECT tr.*, p.player_name,
      ft.team_name as from_team_name, tt.team_name as to_team_name
    FROM transfers tr
    LEFT JOIN players p ON tr.player_id = p.id
    LEFT JOIN teams ft ON tr.from_team = ft.id
    LEFT JOIN teams tt ON tr.to_team = tt.id
    ORDER BY tr.created_at DESC
  `).all() as Transfer[];
}

export function createTransfer(data: { player_id: number; from_team: number | null; to_team: number | null; price: number; transfer_date: string; status?: string }) {
    return getDb().prepare(`
    INSERT INTO transfers (player_id, from_team, to_team, price, transfer_date, status)
    VALUES (@player_id, @from_team, @to_team, @price, @transfer_date, @status)
  `).run({ ...data, status: data.status || 'completed' });
}

export function updateTransferStatus(id: number, status: string) {
    return getDb().prepare("UPDATE transfers SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
}

// ==================== USERS ====================
export function getUserByEmail(email: string): User | undefined {
    return getDb().prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
}

export function getUserByUsername(username: string): User | undefined {
    return getDb().prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;
}

export function getUserById(id: string): User | undefined {
    return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
}

export function getUserByTeamId(teamId: number): User | undefined {
    return getDb().prepare(`
        SELECT u.* FROM users u
        JOIN user_teams ut ON u.id = ut.user_id
        WHERE ut.team_id = ? AND ut.is_primary = 1
        LIMIT 1
    `).get(teamId) as User | undefined;
}

export function createUser(data: { id: string; email: string; username: string; password_hash: string; display_name: string; is_admin?: number }) {
    return getDb().prepare(`
    INSERT INTO users (id, email, username, password_hash, display_name, is_admin)
    VALUES (@id, @email, @username, @password_hash, @display_name, @is_admin)
  `).run({ ...data, is_admin: data.is_admin ?? 0 });
}

// ==================== USER TEAMS ====================
export function getUserTeam(userId: string): (UserTeam & { team_name: string; league_id: number }) | undefined {
    return getDb().prepare(`
    SELECT ut.*, t.team_name, t.league_id FROM user_teams ut
    JOIN teams t ON ut.team_id = t.id
    WHERE ut.user_id = ? AND ut.is_primary = 1
  `).get(userId) as (UserTeam & { team_name: string; league_id: number }) | undefined;
}

export function assignTeam(userId: string, teamId: number) {
    // Clear existing primary teams
    getDb().prepare('UPDATE user_teams SET is_primary = 0 WHERE user_id = ?').run(userId);
    // Check if assignment exists
    const existing = getDb().prepare('SELECT id FROM user_teams WHERE user_id = ? AND team_id = ?').get(userId, teamId);
    if (existing) {
        return getDb().prepare('UPDATE user_teams SET is_primary = 1 WHERE user_id = ? AND team_id = ?').run(userId, teamId);
    }
    return getDb().prepare('INSERT INTO user_teams (user_id, team_id, is_primary) VALUES (?, ?, 1)').run(userId, teamId);
}

export function getAvailableTeams(): Team[] {
    return getDb().prepare(`
    SELECT t.*, l.league_name FROM teams t
    LEFT JOIN leagues l ON t.league_id = l.id
    WHERE t.id NOT IN (SELECT team_id FROM user_teams WHERE is_primary = 1)
    ORDER BY t.team_name
  `).all() as Team[];
}

export function createTeam(data: { team_name: string; league_id: number }): number {
    const result = getDb().prepare(
        "INSERT INTO teams (team_name, league_id) VALUES (@team_name, @league_id)"
    ).run(data);
    return Number(result.lastInsertRowid);
}

// ==================== TRANSFER OFFERS ====================
export function getReceivedOffers(userId: string): TransferOffer[] {
    return getDb().prepare(`
    SELECT o.*, p.player_name,
      ft.team_name as from_team_name, tt.team_name as to_team_name
    FROM transfer_offers o
    LEFT JOIN players p ON o.player_id = p.id
    LEFT JOIN user_teams fut ON o.from_user_id = fut.user_id AND fut.is_primary = 1
    LEFT JOIN teams ft ON fut.team_id = ft.id
    LEFT JOIN user_teams tut ON o.to_user_id = tut.user_id AND tut.is_primary = 1
    LEFT JOIN teams tt ON tut.team_id = tt.id
    WHERE o.to_user_id = ?
    ORDER BY o.created_at DESC
  `).all(userId) as TransferOffer[];
}

export function getSentOffers(userId: string): TransferOffer[] {
    return getDb().prepare(`
    SELECT o.*, p.player_name,
      ft.team_name as from_team_name, tt.team_name as to_team_name
    FROM transfer_offers o
    LEFT JOIN players p ON o.player_id = p.id
    LEFT JOIN user_teams fut ON o.from_user_id = fut.user_id AND fut.is_primary = 1
    LEFT JOIN teams ft ON fut.team_id = ft.id
    LEFT JOIN user_teams tut ON o.to_user_id = tut.user_id AND tut.is_primary = 1
    LEFT JOIN teams tt ON tut.team_id = tt.id
    WHERE o.from_user_id = ?
    ORDER BY o.created_at DESC
  `).all(userId) as TransferOffer[];
}

export function createOffer(data: { player_id: number; from_user_id: string; to_user_id: string; offer_amount: number; message?: string }) {
    return getDb().prepare(`
    INSERT INTO transfer_offers (player_id, from_user_id, to_user_id, offer_amount, message)
    VALUES (@player_id, @from_user_id, @to_user_id, @offer_amount, @message)
  `).run({ ...data, message: data.message || null });
}

export function updateOfferStatus(id: number, status: string) {
    return getDb().prepare("UPDATE transfer_offers SET status = ?, updated_at = datetime('now'), responded_at = datetime('now') WHERE id = ?").run(status, id);
}

export function getOfferById(id: number): TransferOffer | undefined {
    return getDb().prepare('SELECT * FROM transfer_offers WHERE id = ?').get(id) as TransferOffer | undefined;
}

// ==================== SQUAD LINEUPS ====================
export interface SquadLineup {
  id: number;
  team_id: number;
  oh1_player_id: number | null;
  mb1_player_id: number | null;
  opp_player_id: number | null;
  s_player_id: number | null;
  mb2_player_id: number | null;
  oh2_player_id: number | null;
  l_player_id: number | null;
  updated_at: string;
}

export function getSquadLineup(teamId: number): SquadLineup | undefined {
  return getDb().prepare('SELECT * FROM squad_lineups WHERE team_id = ?').get(teamId) as SquadLineup | undefined;
}

export function saveSquadLineup(teamId: number, lineup: {
  oh1: number | null; mb1: number | null; opp: number | null;
  s: number | null; mb2: number | null; oh2: number | null; l: number | null;
}) {
  const db = getDb();
  const exists = db.prepare('SELECT id FROM squad_lineups WHERE team_id = ?').get(teamId);
  if (exists) {
    return db.prepare(`
      UPDATE squad_lineups SET
        oh1_player_id = @oh1, mb1_player_id = @mb1, opp_player_id = @opp,
        s_player_id = @s, mb2_player_id = @mb2, oh2_player_id = @oh2,
        l_player_id = @l, updated_at = datetime('now')
      WHERE team_id = @teamId
    `).run({ ...lineup, teamId });
  }
  return db.prepare(`
    INSERT INTO squad_lineups (team_id, oh1_player_id, mb1_player_id, opp_player_id, s_player_id, mb2_player_id, oh2_player_id, l_player_id)
    VALUES (@teamId, @oh1, @mb1, @opp, @s, @mb2, @oh2, @l)
  `).run({ ...lineup, teamId });
}

export function getSquadLineupWithPlayers(teamId: number): Record<string, Player | null> {
  const lineup = getSquadLineup(teamId);
  const empty = { OH1: null, MB1: null, OPP: null, S: null, MB2: null, OH2: null, L: null };
  if (!lineup) return empty;

  const posMap: Record<string, number | null> = {
    OH1: lineup.oh1_player_id, MB1: lineup.mb1_player_id, OPP: lineup.opp_player_id,
    S: lineup.s_player_id, MB2: lineup.mb2_player_id, OH2: lineup.oh2_player_id, L: lineup.l_player_id,
  };

  const result: Record<string, Player | null> = {};
  for (const [pos, playerId] of Object.entries(posMap)) {
    result[pos] = playerId ? (getPlayerById(playerId) ?? null) : null;
  }
  return result;
}

// ==================== SEASONS ====================
export interface Season {
  id: number;
  league_id: number;
  year: number;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
}

export function getSeasons(leagueId?: number): Season[] {
  if (leagueId) {
    return getDb().prepare('SELECT * FROM seasons WHERE league_id = ? ORDER BY year DESC').all(leagueId) as Season[];
  }
  return getDb().prepare('SELECT * FROM seasons ORDER BY year DESC').all() as Season[];
}

export function getActiveSeason(leagueId: number): Season | undefined {
  return getDb().prepare(
    "SELECT * FROM seasons WHERE league_id = ? AND status = 'active' ORDER BY year DESC LIMIT 1"
  ).get(leagueId) as Season | undefined;
}

export function getSeasonById(id: number): Season | undefined {
  return getDb().prepare('SELECT * FROM seasons WHERE id = ?').get(id) as Season | undefined;
}

export function createSeason(data: { league_id: number; year: number; name: string; start_date: string; end_date: string }): number {
  const result = getDb().prepare(`
    INSERT INTO seasons (league_id, year, name, start_date, end_date)
    VALUES (@league_id, @year, @name, @start_date, @end_date)
  `).run(data);
  return Number(result.lastInsertRowid);
}

// ==================== FIXTURES ====================
export interface Fixture {
  id: number;
  season_id: number;
  league_id: number;
  home_team_id: number;
  away_team_id: number;
  game_week: number;
  scheduled_date: string;
  status: string;
  home_sets: number | null;
  away_sets: number | null;
  home_points: number | null;
  away_points: number | null;
  played_at: string | null;
  created_at: string;
  // Joined
  home_team_name?: string;
  away_team_name?: string;
  season_name?: string;
}

const FIXTURE_JOIN = `
  SELECT f.*,
    ht.team_name AS home_team_name,
    at.team_name AS away_team_name,
    s.name AS season_name
  FROM fixtures f
  JOIN teams ht ON f.home_team_id = ht.id
  JOIN teams at ON f.away_team_id = at.id
  JOIN seasons s ON f.season_id = s.id
`;

export function getFixtures(opts: {
  seasonId?: number;
  leagueId?: number;
  date?: string;
  teamId?: number;
  status?: string;
  gameWeek?: number;
  limit?: number;
} = {}): Fixture[] {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  if (opts.seasonId)  { clauses.push('f.season_id = @seasonId');    params.seasonId  = opts.seasonId; }
  if (opts.leagueId)  { clauses.push('f.league_id = @leagueId');    params.leagueId  = opts.leagueId; }
  if (opts.date)      { clauses.push('f.scheduled_date = @date');   params.date      = opts.date; }
  if (opts.teamId)    { clauses.push('(f.home_team_id = @teamId OR f.away_team_id = @teamId)'); params.teamId = opts.teamId; }
  if (opts.status)    { clauses.push('f.status = @status');         params.status    = opts.status; }
  if (opts.gameWeek)  { clauses.push('f.game_week = @gameWeek');    params.gameWeek  = opts.gameWeek; }

  const where  = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const limit  = opts.limit ? `LIMIT ${opts.limit}` : '';
  const sql    = `${FIXTURE_JOIN} ${where} ORDER BY f.scheduled_date ASC, f.game_week ASC ${limit}`;

  return getDb().prepare(sql).all(params) as Fixture[];
}

export function getFixtureById(id: number): Fixture | undefined {
  return getDb().prepare(`${FIXTURE_JOIN} WHERE f.id = ?`).get(id) as Fixture | undefined;
}

export function getUpcomingFixtures(teamId: number, afterDate: string, limit = 5): Fixture[] {
  return getDb().prepare(`
    ${FIXTURE_JOIN}
    WHERE (f.home_team_id = ? OR f.away_team_id = ?)
      AND f.status = 'scheduled'
      AND f.scheduled_date >= ?
    ORDER BY f.scheduled_date ASC
    LIMIT ?
  `).all(teamId, teamId, afterDate, limit) as Fixture[];
}

export function getRecentResults(teamId: number, limit = 5): Fixture[] {
  return getDb().prepare(`
    ${FIXTURE_JOIN}
    WHERE (f.home_team_id = ? OR f.away_team_id = ?)
      AND f.status = 'completed'
    ORDER BY f.played_at DESC
    LIMIT ?
  `).all(teamId, teamId, limit) as Fixture[];
}

export function getFixturesByDate(date: string, leagueId?: number): Fixture[] {
  if (leagueId) {
    return getDb().prepare(`
      ${FIXTURE_JOIN}
      WHERE f.scheduled_date = ? AND f.league_id = ?
      ORDER BY f.id ASC
    `).all(date, leagueId) as Fixture[];
  }
  return getDb().prepare(`
    ${FIXTURE_JOIN}
    WHERE f.scheduled_date = ?
    ORDER BY f.id ASC
  `).all(date) as Fixture[];
}

export function getScheduledDatesForSeason(seasonId: number): string[] {
  const rows = getDb().prepare(
    "SELECT DISTINCT scheduled_date FROM fixtures WHERE season_id = ? ORDER BY scheduled_date ASC"
  ).all(seasonId) as { scheduled_date: string }[];
  return rows.map(r => r.scheduled_date);
}

export function insertFixtures(fixtures: {
  season_id: number;
  league_id: number;
  home_team_id: number;
  away_team_id: number;
  game_week: number;
  scheduled_date: string;
}[]): void {
  const stmt = getDb().prepare(`
    INSERT INTO fixtures (season_id, league_id, home_team_id, away_team_id, game_week, scheduled_date)
    VALUES (@season_id, @league_id, @home_team_id, @away_team_id, @game_week, @scheduled_date)
  `);
  const insertMany = getDb().transaction((rows: typeof fixtures) => {
    for (const row of rows) stmt.run(row);
  });
  insertMany(fixtures);
}

export function updateFixtureResult(
  id: number,
  result: { home_sets: number; away_sets: number; home_points: number; away_points: number },
): void {
  getDb().prepare(`
    UPDATE fixtures
    SET status = 'completed',
        home_sets = @home_sets,
        away_sets = @away_sets,
        home_points = @home_points,
        away_points = @away_points,
        played_at = datetime('now')
    WHERE id = @id
  `).run({ ...result, id });
}

/**
 * Volleyball points system:
 *   Win 3-0, 3-1, 3-2 → 3 pts  |  Lose 2-3 → 1 pt  |  Lose 0-3, 1-3 → 0 pts
 */
function matchPoints(winnerSets: number, loserSets: number): { winPts: number; losePts: number } {
  if (loserSets === 2) return { winPts: 3, losePts: 1 }; // 3-2 / 2-3
  return { winPts: 3, losePts: 0 };                       // 3-0 or 3-1
}

export function updateTeamStatsAfterMatch(
  homeTeamId: number,
  awayTeamId: number,
  homeSets: number,
  awaySets: number,
  homeTotalPoints: number = 0,
  awayTotalPoints: number = 0,
): void {
  const isHomeWin = homeSets > awaySets;
  const { winPts, losePts } = matchPoints(
    isHomeWin ? homeSets : awaySets,
    isHomeWin ? awaySets : homeSets,
  );

  const db = getDb();
  db.transaction(() => {
    db.prepare(`
      UPDATE teams SET
        played    = played + 1,
        won       = won  + @won,
        lost      = lost + @lost,
        points    = points + @pts,
        sets_won  = sets_won  + @sw,
        sets_lost = sets_lost + @sl,
        score_diff = score_diff + @pd
      WHERE id = @id
    `).run({ id: homeTeamId, won: isHomeWin ? 1 : 0, lost: isHomeWin ? 0 : 1, pts: isHomeWin ? winPts : losePts, sw: homeSets, sl: awaySets, pd: homeTotalPoints - awayTotalPoints });

    db.prepare(`
      UPDATE teams SET
        played    = played + 1,
        won       = won  + @won,
        lost      = lost + @lost,
        points    = points + @pts,
        sets_won  = sets_won  + @sw,
        sets_lost = sets_lost + @sl,
        score_diff = score_diff + @pd
      WHERE id = @id
    `).run({ id: awayTeamId, won: isHomeWin ? 0 : 1, lost: isHomeWin ? 1 : 0, pts: isHomeWin ? losePts : winPts, sw: awaySets, sl: homeSets, pd: awayTotalPoints - homeTotalPoints });
  })();
}

/**
 * Recompute all team stats (played/won/lost/points) from scratch
 * using completed fixtures for the given season. Resets all teams in the
 * season's league to 0 first, then replays every completed result.
 */
export function recomputeTeamStatsFromFixtures(seasonId: number): void {
  const db = getDb();

  // Get league for this season
  const season = db.prepare('SELECT league_id FROM seasons WHERE id = ?').get(seasonId) as { league_id: number } | undefined;
  if (!season) return;

  // Reset all teams in this league
  db.prepare(`
    UPDATE teams SET played = 0, won = 0, lost = 0, points = 0, sets_won = 0, sets_lost = 0
    WHERE league_id = ?
  `).run(season.league_id);

  // Replay all completed fixtures
  const completed = db.prepare(`
    SELECT home_team_id, away_team_id, home_sets, away_sets,
           COALESCE(home_points, 0) AS home_points, COALESCE(away_points, 0) AS away_points
    FROM fixtures
    WHERE season_id = ? AND status = 'completed'
      AND home_sets IS NOT NULL AND away_sets IS NOT NULL
  `).all(seasonId) as { home_team_id: number; away_team_id: number; home_sets: number; away_sets: number; home_points: number; away_points: number }[];

  db.transaction(() => {
    const stmt = db.prepare(`
      UPDATE teams SET
        played    = played + 1,
        won       = won  + @won,
        lost      = lost + @lost,
        points    = points + @diff,
        sets_won  = sets_won  + @sw,
        sets_lost = sets_lost + @sl,
        score_diff = score_diff + @pd
      WHERE id = @id
    `);
    for (const f of completed) {
      const isHomeWin = f.home_sets > f.away_sets;
      const { winPts, losePts } = matchPoints(
        isHomeWin ? f.home_sets : f.away_sets,
        isHomeWin ? f.away_sets : f.home_sets,
      );
      stmt.run({ id: f.home_team_id, won: isHomeWin ? 1 : 0, lost: isHomeWin ? 0 : 1, diff: isHomeWin ? winPts : losePts, sw: f.home_sets, sl: f.away_sets, pd: f.home_points - f.away_points });
      stmt.run({ id: f.away_team_id, won: isHomeWin ? 0 : 1, lost: isHomeWin ? 1 : 0, diff: isHomeWin ? losePts : winPts, sw: f.away_sets, sl: f.home_sets, pd: f.away_points - f.home_points });
    }
  })();
}

// ==================== GAME STATE ====================
export interface GameState {
  id: number;
  current_date: string;
  season_id: number | null;
  updated_at: string;
}

export function getGameState(): GameState | undefined {
  return getDb().prepare('SELECT * FROM game_state WHERE id = 1').get() as GameState | undefined;
}

export function setGameState(currentDate: string, seasonId: number | null): void {
  const existing = getDb().prepare('SELECT id FROM game_state WHERE id = 1').get();
  if (existing) {
    getDb().prepare(`
      UPDATE game_state SET current_date = ?, season_id = ?, updated_at = datetime('now') WHERE id = 1
    `).run(currentDate, seasonId);
  } else {
    getDb().prepare(`
      INSERT INTO game_state (id, current_date, season_id) VALUES (1, ?, ?)
    `).run(currentDate, seasonId);
  }
}

export function advanceGameDate(newDate: string): void {
  getDb().prepare(`
    UPDATE game_state SET current_date = ?, updated_at = datetime('now') WHERE id = 1
  `).run(newDate);
}

// ==================== DATA SUMMARY ====================
export function getDataSummary() {
    const db = getDb();
    return {
        leagues: (db.prepare('SELECT COUNT(*) as count FROM leagues').get() as { count: number }).count,
        teams: (db.prepare('SELECT COUNT(*) as count FROM teams').get() as { count: number }).count,
        players: (db.prepare('SELECT COUNT(*) as count FROM players').get() as { count: number }).count,
        transfers: (db.prepare('SELECT COUNT(*) as count FROM transfers').get() as { count: number }).count,
        users: (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count,
    };
}

// ==================== SEASON RESET ====================
/**
 * Resets ALL active seasons across all leagues:
 *  - Regenerates fixture dates using the updated schedule engine (Fri primary, Tue fallback, front-loaded)
 *  - Marks all fixtures as 'scheduled', clears scores
 *  - Resets all team stats (played/won/lost/points) to 0
 *  - Rewinds game_state calendar to the earliest season start_date (Jan 1)
 */
export function resetSeasonForTesting(): { seasonId: number; startDate: string; fixturesReset: number } {
  const db = getDb();

  // Find the original (minimum) season year — this is the seed year we want to go back to.
  const minYearRow = db.prepare('SELECT MIN(year) as y FROM seasons').get() as { y: number | null };
  if (!minYearRow.y) throw new Error('No seasons found');
  const originYear = minYearRow.y;

  // Null out game_state.season_id before deleting newer seasons to avoid FK constraint.
  db.prepare("UPDATE game_state SET season_id = NULL WHERE id = 1").run();

  // Delete all seasons newer than the origin year (fixtures/playoffs cascade-delete via FK).
  db.prepare("DELETE FROM seasons WHERE year > ?").run(originYear);

  // Restore original seasons to active.
  db.prepare("UPDATE seasons SET status = 'active' WHERE year = ?").run(originYear);

  const originSeasons = db.prepare(
    "SELECT id, league_id, year, start_date FROM seasons WHERE year = ? ORDER BY id ASC"
  ).all(originYear) as { id: number; league_id: number; year: number; start_date: string }[];

  if (!originSeasons.length) throw new Error('Original seasons not found after restore');

  // Restore each team's league_id to what it was in the original season.
  // The original season's fixtures know exactly which league_id each team played in.
  const teamLeagueMap = new Map<number, number>();
  for (const season of originSeasons) {
    const fixtureTeams = db.prepare(`
      SELECT DISTINCT home_team_id as team_id, league_id FROM fixtures WHERE season_id = ?
      UNION
      SELECT DISTINCT away_team_id as team_id, league_id FROM fixtures WHERE season_id = ?
    `).all(season.id, season.id) as { team_id: number; league_id: number }[];
    for (const row of fixtureTeams) {
      teamLeagueMap.set(row.team_id, row.league_id);
    }
  }
  const updateTeamLeague = db.prepare('UPDATE teams SET league_id = ? WHERE id = ?');
  db.transaction(() => {
    for (const [teamId, leagueId] of teamLeagueMap) {
      updateTeamLeague.run(leagueId, teamId);
    }
  })();

  let totalFixturesReset = 0;

  for (const season of originSeasons) {
    // Regenerate the schedule to get fresh dates
    const teams = db.prepare(
      'SELECT id FROM teams WHERE league_id = ? ORDER BY id'
    ).all(season.league_id) as { id: number }[];
    const teamIds = teams.map(t => t.id);
    const slots = generateScheduleForLeague(season.league_id, teamIds, season.year);

    // Build a map from game_week → scheduled_date for fast lookup
    const dateByWeek = new Map<number, string>();
    for (const slot of slots) {
      if (!dateByWeek.has(slot.game_week)) {
        dateByWeek.set(slot.game_week, slot.scheduled_date);
      }
    }

    // Reset all fixtures for this season
    const existingFixtures = db.prepare(
      'SELECT id, game_week FROM fixtures WHERE season_id = ? ORDER BY game_week ASC, id ASC'
    ).all(season.id) as { id: number; game_week: number }[];

    const updateFixture = db.prepare(`
      UPDATE fixtures
      SET status = 'scheduled',
          scheduled_date = @scheduled_date,
          home_sets = NULL, away_sets = NULL,
          home_points = NULL, away_points = NULL,
          played_at = NULL
      WHERE id = @id
    `);

    db.transaction(() => {
      for (const f of existingFixtures) {
        const newDate = dateByWeek.get(f.game_week) ?? season.start_date;
        updateFixture.run({ id: f.id, scheduled_date: newDate });
      }
    })();

    totalFixturesReset += existingFixtures.length;

    // Reset all team stats
    db.prepare(`
      UPDATE teams SET played = 0, won = 0, lost = 0, points = 0, sets_won = 0, sets_lost = 0, score_diff = 0
      WHERE league_id = ?
    `).run(season.league_id);
  }

  // Clear all playoff data for origin seasons (in case playoffs ran during season 1)
  for (const season of originSeasons) {
    const seriesIds = db.prepare('SELECT id FROM playoff_series WHERE season_id = ?')
      .all(season.id) as { id: number }[];
    for (const s of seriesIds) {
      db.prepare('DELETE FROM playoff_games WHERE series_id = ?').run(s.id);
    }
    db.prepare('DELETE FROM playoff_series WHERE season_id = ?').run(season.id);
  }

  // Rewind game_state to Jan 1 of the origin year
  const startDate = `${originYear}-01-01`;
  const firstSeason = originSeasons[0];
  db.prepare(`
    UPDATE game_state SET current_date = ?, season_id = ?, updated_at = datetime('now') WHERE id = 1
  `).run(startDate, firstSeason.id);

  return { seasonId: firstSeason.id, startDate, fixturesReset: totalFixturesReset };
}

// ==================== FINANCIAL TRANSACTIONS ====================

export interface FinancialTransaction {
  id: number;
  team_id: number;
  month: string; // e.g. "2026-01"
  income_matchday: number;
  income_sponsorship: number;
  income_merchandise: number;
  income_broadcast: number;
  income_other: number;
  expense_wages: number;
  expense_staff: number;
  expense_other: number;
  net: number;
  created_at: string;
}

export function getFinancialTransactions(teamId: number): FinancialTransaction[] {
  return getDb().prepare(`
    SELECT * FROM financial_transactions WHERE team_id = ? ORDER BY month DESC
  `).all(teamId) as FinancialTransaction[];
}

/**
 * Run the monthly economy cycle for a single team.
 * Called on the 1st of each month from advance-day.
 * Inserts a transaction record and updates team_money.
 */
export function runMonthlyEconomy(teamId: number, month: string): FinancialTransaction {
  const db = getDb();

  // Fixed income streams (matching office page constants)
  const income_matchday    = 18_000;
  const income_sponsorship = 15_000;
  const income_merchandise = 10_000;
  const income_broadcast   =  7_000;
  const income_other       =      0;
  const totalIncome = income_matchday + income_sponsorship + income_merchandise + income_broadcast + income_other;

  // Wages: sum all players on this team
  const wageRow = db.prepare(`
    SELECT COALESCE(SUM(monthly_wage), 0) as total FROM players WHERE team_id = ?
  `).get(teamId) as { total: number };
  const expense_wages = wageRow.total;
  const expense_staff = 8_000; // fixed staff costs
  const expense_other = 0;
  const totalExpenses = expense_wages + expense_staff + expense_other;

  const net = totalIncome - totalExpenses;

  // Upsert transaction record
  db.prepare(`
    INSERT INTO financial_transactions
      (team_id, month, income_matchday, income_sponsorship, income_merchandise,
       income_broadcast, income_other, expense_wages, expense_staff, expense_other, net)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(team_id, month) DO UPDATE SET
      income_matchday    = excluded.income_matchday,
      income_sponsorship = excluded.income_sponsorship,
      income_merchandise = excluded.income_merchandise,
      income_broadcast   = excluded.income_broadcast,
      income_other       = excluded.income_other,
      expense_wages      = excluded.expense_wages,
      expense_staff      = excluded.expense_staff,
      expense_other      = excluded.expense_other,
      net                = excluded.net
  `).run(teamId, month,
    income_matchday, income_sponsorship, income_merchandise,
    income_broadcast, income_other,
    expense_wages, expense_staff, expense_other, net);

  // Apply net to team_money
  const team = db.prepare('SELECT team_money FROM teams WHERE id = ?').get(teamId) as { team_money: number } | undefined;
  if (team) {
    db.prepare('UPDATE teams SET team_money = ? WHERE id = ?').run(team.team_money + net, teamId);
  }

  return db.prepare('SELECT * FROM financial_transactions WHERE team_id = ? AND month = ?')
    .get(teamId, month) as FinancialTransaction;
}

// ==================== END OF SEASON ====================

export interface EndSeasonResult {
  oldYear: number;
  newYear: number;
  promotion: PromotionRelegationResult;
  seasonsCreated: number;
  fixturesGenerated: number;
}

/**
 * End the current season:
 *  1. Mark all active seasons as 'completed'
 *  2. Process promotion / relegation
 *  3. Create new seasons for all leagues (year + 1)
 *  4. Generate fixtures for each league using the updated team rosters
 *  5. Advance game_state to Jan 1 of the new year
 */
export function endSeason(): EndSeasonResult {
  const db = getDb();

  // Determine current year from active seasons
  const activeSeasons = db.prepare(
    "SELECT id, league_id, year FROM seasons WHERE status = 'active' ORDER BY id ASC"
  ).all() as { id: number; league_id: number; year: number }[];

  if (!activeSeasons.length) throw new Error('No active seasons found');

  const oldYear = activeSeasons[0].year;
  const newYear = oldYear + 1;

  // Guard: playoffs must be fully complete for all tier-2 leagues before ending the season
  const tier2SeasonIds = (db.prepare(`
    SELECT s.id FROM seasons s
    JOIN leagues l ON s.league_id = l.id
    WHERE s.status = 'active' AND l.tier = 2
  `).all() as { id: number }[]).map(r => r.id);

  for (const sid of tier2SeasonIds) {
    const totalSeries = db.prepare('SELECT COUNT(*) as c FROM playoff_series WHERE season_id = ?').get(sid) as { c: number };
    if (totalSeries.c === 0) continue; // playoffs not generated yet — ok to skip
    const incompleteSeries = db.prepare(`
      SELECT COUNT(*) as c FROM playoff_series WHERE season_id = ? AND status != 'completed'
    `).get(sid) as { c: number };
    if (incompleteSeries.c > 0) {
      throw new Error('Playoffs are not yet complete. End season only after all Grand Finals are decided.');
    }
  }

  // Step 1: Mark all active seasons completed
  db.prepare("UPDATE seasons SET status = 'completed' WHERE status = 'active'").run();

  // Step 2: Process promotion / relegation (modifies teams.league_id)
  const promotion = processPromotionRelegation();

  // Step 3 & 4: Create new seasons + generate fixtures for each league
  const leagues = db.prepare("SELECT id FROM leagues ORDER BY id").all() as { id: number }[];

  const insertFixture = db.prepare(`
    INSERT INTO fixtures (season_id, league_id, home_team_id, away_team_id, game_week, scheduled_date)
    VALUES (@season_id, @league_id, @home_team_id, @away_team_id, @game_week, @scheduled_date)
  `);

  let seasonsCreated = 0;
  let fixturesGenerated = 0;

  for (const league of leagues) {
    const teams = db.prepare(
      "SELECT id FROM teams WHERE league_id = ? ORDER BY id"
    ).all(league.id) as { id: number }[];

    if (teams.length < 2) continue;

    const result = db.prepare(`
      INSERT INTO seasons (league_id, year, name, start_date, end_date)
      VALUES (?, ?, ?, ?, ?)
    `).run(league.id, newYear, `${newYear} Season`, `${newYear}-01-01`, `${newYear}-12-31`);

    const seasonId = Number(result.lastInsertRowid);
    seasonsCreated++;

    const teamIds = teams.map((t: { id: number }) => t.id);
    const slots = generateScheduleForLeague(league.id, teamIds, newYear);

    db.transaction(() => {
      for (const slot of slots) {
        insertFixture.run({
          season_id: seasonId,
          league_id: league.id,
          home_team_id: slot.home_team_id,
          away_team_id: slot.away_team_id,
          game_week: slot.game_week,
          scheduled_date: slot.scheduled_date,
        });
        fixturesGenerated++;
      }
    })();
  }

  // Step 5: Reset team stats for the new season and advance calendar
  db.prepare(`
    UPDATE teams SET played = 0, won = 0, lost = 0, points = 0, sets_won = 0, sets_lost = 0
  `).run();

  const newSeasonForState = db.prepare(
    "SELECT id FROM seasons WHERE year = ? ORDER BY id ASC LIMIT 1"
  ).get(newYear) as { id: number } | undefined;

  db.prepare(`
    UPDATE game_state SET current_date = ?, season_id = ?, updated_at = datetime('now') WHERE id = 1
  `).run(`${newYear}-01-01`, newSeasonForState?.id ?? null);

  return { oldYear, newYear, promotion, seasonsCreated, fixturesGenerated };
}

// ==================== PROMOTION / RELEGATION ====================

export interface PromotionRelegationResult {
  relegated: { teamId: number; teamName: string; fromLeague: number; toLeague: number }[];
  promoted:  { teamId: number; teamName: string; fromLeague: number; toLeague: number }[];
}

/**
 * Process end-of-season promotion/relegation:
 *
 * IVL Premier Division (league_id: 1) — split into North/South conferences by `region`:
 *   - Last-placed team in the North conference  → relegated to IVL North (league_id: 2)
 *   - Last-placed team in the South conference  → relegated to IVL South (league_id: 3)
 *
 * IVL North (league_id: 2):
 *   - Top team → promoted to IVL Premier Division (league_id: 1), region = 'north'
 *
 * IVL South (league_id: 3):
 *   - Top team → promoted to IVL Premier Division (league_id: 1), region = 'south'
 */
export function processPromotionRelegation(): PromotionRelegationResult {
  return processPromotionRelegationByConfig();
}

// ==================== PLAYOFFS ====================

export interface PlayoffSeries {
  id: number;
  season_id: number;
  league_id: number;
  round: number;
  conference: string | null;
  seed_high: number;
  seed_low: number;
  home_team_id: number;
  away_team_id: number;
  home_wins: number;
  away_wins: number;
  winner_team_id: number | null;
  status: string;
  created_at: string;
  // joined
  home_team_name?: string;
  away_team_name?: string;
  winner_team_name?: string;
}

export interface PlayoffGame {
  id: number;
  series_id: number;
  game_number: number;
  home_team_id: number;
  away_team_id: number;
  scheduled_date: string;
  status: string;
  home_sets: number | null;
  away_sets: number | null;
  home_points: number | null;
  away_points: number | null;
  played_at: string | null;
  created_at: string;
  // joined
  home_team_name?: string;
  away_team_name?: string;
}

export interface PlayoffBracket {
  seasonId: number;
  year: number;
  round1: PlayoffSeries[];
  round2: PlayoffSeries[];
  round3: PlayoffSeries[];
  champion: { teamId: number; teamName: string } | null;
  status: 'not_started' | 'in_progress' | 'completed';
}

const SERIES_JOIN = `
  SELECT ps.*,
    ht.team_name AS home_team_name,
    at.team_name AS away_team_name,
    wt.team_name AS winner_team_name
  FROM playoff_series ps
  JOIN teams ht ON ps.home_team_id = ht.id
  JOIN teams at ON ps.away_team_id = at.id
  LEFT JOIN teams wt ON ps.winner_team_id = wt.id
`;

export function getPlayoffSeriesForSeason(seasonId: number): PlayoffSeries[] {
  return getDb().prepare(`${SERIES_JOIN} WHERE ps.season_id = ? ORDER BY ps.round ASC, ps.id ASC`)
    .all(seasonId) as PlayoffSeries[];
}

export function getPlayoffGamesForSeries(seriesId: number): PlayoffGame[] {
  return getDb().prepare(`
    SELECT pg.*,
      ht.team_name AS home_team_name,
      at.team_name AS away_team_name
    FROM playoff_games pg
    JOIN teams ht ON pg.home_team_id = ht.id
    JOIN teams at ON pg.away_team_id = at.id
    WHERE pg.series_id = ?
    ORDER BY pg.game_number ASC
  `).all(seriesId) as PlayoffGame[];
}

export function getPlayoffGamesByDate(date: string, includeCompleted = false): PlayoffGame[] {
  const statusClause = includeCompleted ? "pg.status != 'cancelled'" : "pg.status = 'scheduled'";
  return getDb().prepare(`
    SELECT pg.*,
      ht.team_name AS home_team_name,
      at.team_name AS away_team_name
    FROM playoff_games pg
    JOIN teams ht ON pg.home_team_id = ht.id
    JOIN teams at ON pg.away_team_id = at.id
    WHERE pg.scheduled_date = ? AND ${statusClause}
    ORDER BY pg.id ASC
  `).all(date) as PlayoffGame[];
}

export function getPlayoffGamesByTeam(teamId: number): PlayoffGame[] {
  return getDb().prepare(`
    SELECT pg.*,
      ht.team_name AS home_team_name,
      at.team_name AS away_team_name
    FROM playoff_games pg
    JOIN teams ht ON pg.home_team_id = ht.id
    JOIN teams at ON pg.away_team_id = at.id
    WHERE (pg.home_team_id = ? OR pg.away_team_id = ?) AND pg.status != 'cancelled'
    ORDER BY pg.scheduled_date ASC, pg.game_number ASC
  `).all(teamId, teamId) as PlayoffGame[];
}

export function getPlayoffGameDatesForSeason(seasonId: number): string[] {
  const rows = getDb().prepare(`
    SELECT DISTINCT pg.scheduled_date
    FROM playoff_games pg
    JOIN playoff_series ps ON pg.series_id = ps.id
    WHERE ps.season_id = ? AND pg.status != 'cancelled'
    ORDER BY pg.scheduled_date ASC
  `).all(seasonId) as { scheduled_date: string }[];
  return rows.map(r => r.scheduled_date);
}

export function getPlayoffBracket(seasonId: number): PlayoffBracket {
  const db = getDb();
  const season = db.prepare('SELECT * FROM seasons WHERE id = ?').get(seasonId) as { id: number; year: number } | undefined;
  if (!season) throw new Error('Season not found');

  const allSeries = getPlayoffSeriesForSeason(seasonId);

  const round1 = allSeries.filter(s => s.round === 1);
  const round2 = allSeries.filter(s => s.round === 2);
  const round3 = allSeries.filter(s => s.round === 3);

  let champion: { teamId: number; teamName: string } | null = null;
  const grandFinal = round3[0];
  if (grandFinal?.winner_team_id) {
    champion = { teamId: grandFinal.winner_team_id, teamName: grandFinal.winner_team_name ?? '' };
  }

  let status: PlayoffBracket['status'] = 'not_started';
  if (allSeries.length > 0) {
    const allDone = allSeries.every(s => s.status === 'completed');
    status = allDone ? 'completed' : 'in_progress';
  }

  return { seasonId, year: season.year, round1, round2, round3, champion, status };
}

/**
 * Generate Round 1 playoff series + all 5 potential game slots for the active
 * Premier Division season. Called automatically when the last regular-season
 * fixture date passes (Aug 31).
 */
export function generatePlayoffs(seasonId: number): { seriesCreated: number; gamesScheduled: number } {
  return generatePostSeason(seasonId);
}


/**
 * After all Round 1 (or Round 2) series in a conference complete, generate the
 * next round's series + game slots.
 * Called automatically after each playoff game result is recorded.
 */
export function advancePlayoffRound(seasonId: number): { advanced: boolean; round: number } {
  const db = getDb();

  const season = db.prepare('SELECT * FROM seasons WHERE id = ?').get(seasonId) as { id: number; year: number } | undefined;
  if (!season) return { advanced: false, round: 0 };

  // Find the highest round that exists
  const maxRoundRow = db.prepare(
    'SELECT MAX(round) as r FROM playoff_series WHERE season_id = ?'
  ).get(seasonId) as { r: number | null };
  const currentRound = maxRoundRow.r ?? 0;

  if (currentRound === 0 || currentRound >= 3) return { advanced: false, round: currentRound };

  // Check if all series in currentRound are completed
  const incomplete = db.prepare(`
    SELECT COUNT(*) as c FROM playoff_series
    WHERE season_id = ? AND round = ? AND status != 'completed'
  `).get(seasonId, currentRound) as { c: number };
  if (incomplete.c > 0) return { advanced: false, round: currentRound };

  // All done — generate next round
  const nextRound = currentRound + 1;

  // Already generated?
  const nextExists = db.prepare(
    'SELECT COUNT(*) as c FROM playoff_series WHERE season_id = ? AND round = ?'
  ).get(seasonId, nextRound) as { c: number };
  if (nextExists.c > 0) return { advanced: false, round: nextRound };

  const roundDates = getPlayoffRoundDates(season.year, nextRound as 1 | 2 | 3);

  const insertSeries = db.prepare(`
    INSERT INTO playoff_series
      (season_id, league_id, round, conference, seed_high, seed_low, home_team_id, away_team_id, status)
    VALUES (@season_id, @league_id, @round, @conference, @seed_high, @seed_low, @home_team_id, @away_team_id, 'scheduled')
  `);
  const insertGame = db.prepare(`
    INSERT INTO playoff_games
      (series_id, game_number, home_team_id, away_team_id, scheduled_date, status)
    VALUES (@series_id, @game_number, @home_team_id, @away_team_id, @scheduled_date, 'scheduled')
  `);

  function createNextSeries(
    conference: string | null,
    seedHigh: number, seedLow: number,
    highTeamId: number, lowTeamId: number,
    leagueId: number,
  ) {
    const res = insertSeries.run({
      season_id: seasonId,
      league_id: leagueId,
      round: nextRound,
      conference,
      seed_high: seedHigh,
      seed_low: seedLow,
      home_team_id: highTeamId,
      away_team_id: lowTeamId,
    });
    const seriesId = Number(res.lastInsertRowid);
    // Only pre-schedule games 1-3; games 4-5 added dynamically if needed
    for (let g = 0; g < 3; g++) {
      const homeId = g < 2 ? highTeamId : lowTeamId;
      const awayId = g < 2 ? lowTeamId  : highTeamId;
      insertGame.run({
        series_id: seriesId,
        game_number: g + 1,
        home_team_id: homeId,
        away_team_id: awayId,
        scheduled_date: roundDates[g],
      });
    }
  }

  const leagueId = (db.prepare('SELECT league_id FROM playoff_series WHERE season_id = ? LIMIT 1').get(seasonId) as { league_id: number }).league_id;

  db.transaction(() => {
    if (nextRound === 2) {
      // Conference Finals: winner of N(1v4) vs winner of N(2v3), same for South
      for (const conf of ['north', 'south'] as const) {
        const confSeries = db.prepare(`
          SELECT * FROM playoff_series WHERE season_id = ? AND round = 1 AND conference = ? ORDER BY seed_high ASC
        `).all(seasonId, conf) as PlayoffSeries[];

        // series with seed_high=1 winner vs series with seed_high=2 winner
        const s14 = confSeries.find(s => s.seed_high === 1 && s.seed_low === 4);
        const s23 = confSeries.find(s => s.seed_high === 2 && s.seed_low === 3);
        if (!s14?.winner_team_id || !s23?.winner_team_id) return;

        // Higher seed (1v4 winner) is home
        createNextSeries(conf, 1, 2, s14.winner_team_id, s23.winner_team_id, leagueId);
      }
    } else if (nextRound === 3) {
      // Grand Final: North conference winner vs South conference winner
      const northFinal = db.prepare(`
        SELECT * FROM playoff_series WHERE season_id = ? AND round = 2 AND conference = 'north' LIMIT 1
      `).get(seasonId) as PlayoffSeries | undefined;
      const southFinal = db.prepare(`
        SELECT * FROM playoff_series WHERE season_id = ? AND round = 2 AND conference = 'south' LIMIT 1
      `).get(seasonId) as PlayoffSeries | undefined;

      if (!northFinal?.winner_team_id || !southFinal?.winner_team_id) return;

      // North winner is home for games 1,2,5; South winner for games 3,4
      createNextSeries(null, 1, 2, northFinal.winner_team_id, southFinal.winner_team_id, leagueId);
    }
  })();

  return { advanced: true, round: nextRound };
}

/**
 * Record the result of a playoff game. Updates wins, advances series if won,
 * cancels remaining games, and triggers next-round generation.
 */
export function recordPlayoffGameResult(
  gameId: number,
  result: { home_sets: number; away_sets: number; home_points: number; away_points: number },
): { seriesWinner: number | null; seriesComplete: boolean } {
  const db = getDb();

  const game = db.prepare('SELECT * FROM playoff_games WHERE id = ?').get(gameId) as PlayoffGame | undefined;
  if (!game) throw new Error('Playoff game not found');
  if (game.status === 'completed') return { seriesWinner: null, seriesComplete: false };

  const series = db.prepare('SELECT * FROM playoff_series WHERE id = ?').get(game.series_id) as PlayoffSeries | undefined;
  if (!series) throw new Error('Playoff series not found');

  // Determine which SERIES side won — game home/away may differ from series home/away
  // (e.g. games 3-4 are hosted by the series away team)
  const gameHomeWon = result.home_sets > result.away_sets;
  const seriesHomeWonGame = gameHomeWon
    ? game.home_team_id === series.home_team_id
    : game.away_team_id === series.home_team_id;

  db.transaction(() => {
    // Mark game complete
    db.prepare(`
      UPDATE playoff_games SET
        status = 'completed', home_sets = ?, away_sets = ?, home_points = ?, away_points = ?,
        played_at = datetime('now')
      WHERE id = ?
    `).run(result.home_sets, result.away_sets, result.home_points, result.away_points, gameId);

    // Increment wins on the series using SERIES home/away context, not game home/away
    if (seriesHomeWonGame) {
      db.prepare('UPDATE playoff_series SET home_wins = home_wins + 1 WHERE id = ?').run(series.id);
    } else {
      db.prepare('UPDATE playoff_series SET away_wins = away_wins + 1 WHERE id = ?').run(series.id);
    }
  })();

  // Re-fetch updated series
  const updated = db.prepare('SELECT * FROM playoff_series WHERE id = ?').get(series.id) as PlayoffSeries;
  const homeWins = updated.home_wins;
  const awayWins = updated.away_wins;

  if (homeWins >= 3 || awayWins >= 3) {
    const winnerId = homeWins >= 3 ? series.home_team_id : series.away_team_id;

    db.transaction(() => {
      // Mark series completed with winner
      db.prepare(`
        UPDATE playoff_series SET status = 'completed', winner_team_id = ? WHERE id = ?
      `).run(winnerId, series.id);

      // Cancel any unplayed remaining games in this series
      db.prepare(`
        UPDATE playoff_games SET status = 'cancelled'
        WHERE series_id = ? AND status = 'scheduled'
      `).run(series.id);
    })();

    // Try to advance to next round
    const seasonId = series.season_id;
    advancePlayoffRound(seasonId);

    return { seriesWinner: winnerId, seriesComplete: true };
  }

  // Series is still live — schedule the next game if it doesn't exist yet
  const nextGameNumber = game.game_number + 1;
  const alreadyScheduled = db.prepare(
    'SELECT id FROM playoff_games WHERE series_id = ? AND game_number = ?'
  ).get(series.id, nextGameNumber);

  if (!alreadyScheduled && nextGameNumber <= 5) {
    // Fetch round dates to get the correct date for this game slot (0-indexed)
    const seasonRow = db.prepare('SELECT year FROM seasons WHERE id = ?').get(series.season_id) as { year: number };
    const roundDates = getPlayoffRoundDates(seasonRow.year, series.round as 1 | 2 | 3);
    const dateIdx = nextGameNumber - 1; // game_number is 1-based
    const scheduledDate = roundDates[Math.min(dateIdx, roundDates.length - 1)];

    // Home/away rotation: games 1,2 at high seed; 3,4 at low seed; 5 at high seed
    const homeTeamId = nextGameNumber <= 2 ? series.home_team_id
      : nextGameNumber <= 4 ? series.away_team_id
      : series.home_team_id;
    const awayTeamId = homeTeamId === series.home_team_id ? series.away_team_id : series.home_team_id;

    db.prepare(`
      INSERT INTO playoff_games (series_id, game_number, home_team_id, away_team_id, scheduled_date, status)
      VALUES (?, ?, ?, ?, ?, 'scheduled')
    `).run(series.id, nextGameNumber, homeTeamId, awayTeamId, scheduledDate);
  }

  return { seriesWinner: null, seriesComplete: false };
}

/**
 * Check whether the regular season (league_id=1) is fully complete — i.e., all
 * fixtures on or before Aug 31 have been played — and playoffs haven't started yet.
 * Used by advance-day to auto-trigger playoff generation.
 */
export function shouldGeneratePlayoffs(seasonId: number): boolean {
  return shouldGeneratePostSeason(seasonId);
}
