import { getDb } from './index';

// ==================== TYPES ====================
export interface League { id: number; league_name: string; created_at: string; updated_at: string; }
export interface Team { id: number; team_name: string; league_id: number; team_money: number; played: number; won: number; lost: number; points: number; goal_diff: number; stadium: string; capacity: number; founded: string; created_at: string; updated_at: string; league_name?: string; win_rate?: number; }
export interface Player {
    id: number; player_name: string; team_id: number | null; position: string; age: number; country: string;
    jersey_number: number; overall: number; attack: number; defense: number; serve: number; block: number;
    receive: number; setting: number; contract_years: number; monthly_wage: number; player_value: number;
    speed: number; agility: number; strength: number; endurance: number; height: number;
    leadership: number; teamwork: number; concentration: number; pressure_handling: number;
    jump_serve: number; float_serve: number; spike_power: number; spike_accuracy: number;
    block_timing: number; dig_technique: number; experience: number; potential: number; consistency: number;
    created_at: string; updated_at: string; team_name?: string;
}
export interface Transfer { id: number; player_id: number; from_team: number | null; to_team: number | null; price: number; transfer_date: string; status: string; created_at: string; updated_at: string; player_name?: string; from_team_name?: string; to_team_name?: string; }
export interface User { id: string; email: string; username: string; password_hash: string; display_name: string; created_at: string; updated_at: string; last_login: string | null; is_active: number; is_admin: number; }
export interface UserTeam { id: number; user_id: string; team_id: number; is_primary: number; created_at: string; updated_at: string; }
export interface TransferOffer { id: number; player_id: number; from_user_id: string; to_user_id: string; offer_amount: number; message: string | null; status: string; expires_at: string; created_at: string; updated_at: string; responded_at: string | null; player_name?: string; from_team_name?: string; to_team_name?: string; }

// ==================== PLAYER VALUE ====================
export function calculatePlayerValue(overall: number, age: number, attack: number, defense: number, serve: number, block: number, receive: number, setting: number) {
    const baseValue = overall * 5000;
    let ageMod = 1.0;
    if (age < 22) ageMod = 1.3;
    else if (age < 25) ageMod = 1.1;
    else if (age < 30) ageMod = 1.0;
    else if (age < 35) ageMod = 0.8;
    else ageMod = 0.6;
    const statBonus = (attack + defense + serve + block + receive + setting) * 50;
    return Math.round((baseValue * ageMod) + statBonus);
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
    return getDb().prepare("UPDATE teams SET team_money = ?, updated_at = datetime('now') WHERE id = ?").run(amount, teamId);
}

export function updateTeamStats(teamId: number, data: Partial<Team>) {
    const fields = Object.keys(data).filter(k => k !== 'id').map(k => `${k} = @${k}`).join(', ');
    return getDb().prepare(`UPDATE teams SET ${fields}, updated_at = datetime('now') WHERE id = @id`).run({ ...data, id: teamId });
}

// ==================== PLAYERS ====================
export function getPlayers(teamId?: number): Player[] {
    if (teamId) {
        return getDb().prepare(`
      SELECT p.*, t.team_name FROM players p
      LEFT JOIN teams t ON p.team_id = t.id
      WHERE p.team_id = ?
      ORDER BY p.overall DESC
    `).all(teamId) as Player[];
    }
    return getDb().prepare(`
    SELECT p.*, t.team_name FROM players p
    LEFT JOIN teams t ON p.team_id = t.id
    ORDER BY p.overall DESC
  `).all() as Player[];
}

export function getPlayerById(id: number): Player | undefined {
    return getDb().prepare(`
    SELECT p.*, t.team_name FROM players p
    LEFT JOIN teams t ON p.team_id = t.id
    WHERE p.id = ?
  `).get(id) as Player | undefined;
}

export function getFreeAgents(): Player[] {
    return getDb().prepare('SELECT * FROM players WHERE team_id IS NULL ORDER BY overall DESC').all() as Player[];
}

export function searchPlayers(term: string): Player[] {
    const like = `%${term}%`;
    return getDb().prepare(`
    SELECT p.*, t.team_name FROM players p
    LEFT JOIN teams t ON p.team_id = t.id
    WHERE p.player_name LIKE ? OR p.country LIKE ? OR p.position LIKE ?
    ORDER BY p.overall DESC
  `).all(like, like, like) as Player[];
}

export function createPlayer(data: Omit<Player, 'id' | 'created_at' | 'updated_at' | 'team_name'>): number {
    const result = getDb().prepare(`
    INSERT INTO players (
      player_name, team_id, position, age, country, jersey_number, overall,
      attack, defense, serve, block, receive, setting,
      contract_years, monthly_wage, player_value,
      speed, agility, strength, endurance, height,
      leadership, teamwork, concentration, pressure_handling,
      jump_serve, float_serve, spike_power, spike_accuracy,
      block_timing, dig_technique, experience, potential, consistency
    ) VALUES (
      @player_name, @team_id, @position, @age, @country, @jersey_number, @overall,
      @attack, @defense, @serve, @block, @receive, @setting,
      @contract_years, @monthly_wage, @player_value,
      @speed, @agility, @strength, @endurance, @height,
      @leadership, @teamwork, @concentration, @pressure_handling,
      @jump_serve, @float_serve, @spike_power, @spike_accuracy,
      @block_timing, @dig_technique, @experience, @potential, @consistency
    )
  `).run(data);
    return Number(result.lastInsertRowid);
}

export function updatePlayer(id: number, data: Partial<Player>) {
    const allowedFields = [
        'player_name', 'team_id', 'position', 'age', 'country', 'jersey_number', 'overall',
        'attack', 'defense', 'serve', 'block', 'receive', 'setting',
        'contract_years', 'monthly_wage', 'player_value',
        'speed', 'agility', 'strength', 'endurance', 'height',
        'leadership', 'teamwork', 'concentration', 'pressure_handling',
        'jump_serve', 'float_serve', 'spike_power', 'spike_accuracy',
        'block_timing', 'dig_technique', 'experience', 'potential', 'consistency',
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

export function createUser(data: { id: string; email: string; username: string; password_hash: string; display_name: string }) {
    return getDb().prepare(`
    INSERT INTO users (id, email, username, password_hash, display_name)
    VALUES (@id, @email, @username, @password_hash, @display_name)
  `).run(data);
}

// ==================== USER TEAMS ====================
export function getUserTeam(userId: string): (UserTeam & { team_name: string }) | undefined {
    return getDb().prepare(`
    SELECT ut.*, t.team_name FROM user_teams ut
    JOIN teams t ON ut.team_id = t.id
    WHERE ut.user_id = ? AND ut.is_primary = 1
  `).get(userId) as (UserTeam & { team_name: string }) | undefined;
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
