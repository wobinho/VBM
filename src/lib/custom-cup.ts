/**
 * Custom cup engine.
 *
 * Generic single-elimination knockout (best-of-3 final) for user-created cups
 * in custom saves. Kept separate from the classic national-cup logic in
 * cup-engine.ts, which is hardcoded to country-derived structure and July-only
 * matchdays. Custom cups carry cup_type 'custom'; recordCupFixtureResult routes
 * their advancement here.
 */
import type Database from 'better-sqlite3';
import { getDb } from './db';
import { planCupRounds, type CustomCupWindow } from './custom-save';

type Db = Database.Database;

function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/** Next Mon/Wed/Fri strictly after the given YYYY-MM-DD date. */
function nextCupDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    do { d.setDate(d.getDate() + 1); } while (![1, 3, 5].includes(d.getDay()));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export interface CustomCupSpec {
    name: string;
    teamIds: number[];   // resolved in-save team ids — power of 2 (2, 4, 8, 16)
    year: number;
    window: CustomCupWindow;
}

/**
 * Creates a single-elimination knockout cup (best-of-3 final) and seeds its
 * first round. Returns the new cup id.
 */
export function generateCustomCup(db: Db, spec: CustomCupSpec): number {
    const plans = planCupRounds(spec.year, spec.teamIds.length, spec.window);

    const cupRes = db.prepare(`
        INSERT INTO cup_competitions (name, cup_type, format, country, year, status)
        VALUES (?, 'custom', 'single_elimination', NULL, ?, 'active')
    `).run(spec.name, spec.year);
    const cupId = Number(cupRes.lastInsertRowid);

    const insertRound = db.prepare(`
        INSERT INTO cup_rounds (cup_id, round_number, round_name, round_type, start_date, end_date, status)
        VALUES (?, ?, ?, 'knockout', ?, ?, 'scheduled')
    `);
    const insertFixture = db.prepare(`
        INSERT INTO cup_fixtures (cup_id, round_id, home_team_id, away_team_id, scheduled_date, status)
        VALUES (?, ?, ?, ?, ?, 'scheduled')
    `);

    const roundIds: number[] = [];
    for (const p of plans) {
        const res = insertRound.run(cupId, p.roundNumber, p.name, p.dates[0], p.dates[p.dates.length - 1]);
        roundIds.push(Number(res.lastInsertRowid));
    }

    // Seed the first round.
    const teams = shuffle([...spec.teamIds]);
    const firstRound = plans[0];
    const firstRoundId = roundIds[0];
    if (firstRound.isFinal) {
        // 2-team cup: the only round IS the best-of-3 final.
        insertFixture.run(cupId, firstRoundId, teams[0], teams[1], firstRound.dates[0]);
        insertFixture.run(cupId, firstRoundId, teams[0], teams[1], firstRound.dates[1]);
    } else {
        for (let i = 0; i + 1 < teams.length; i += 2) {
            insertFixture.run(cupId, firstRoundId, teams[i], teams[i + 1], firstRound.dates[0]);
        }
    }

    return cupId;
}

/**
 * Advances a custom cup after a fixture result — generic single-elimination
 * with a best-of-3 final. Called by recordCupFixtureResult for cup_type 'custom'.
 */
export function advanceCustomCupRound(cupId: number): void {
    const db = getDb();

    const round = db.prepare(`
        SELECT * FROM cup_rounds WHERE cup_id = ? AND status != 'completed'
        ORDER BY round_number ASC LIMIT 1
    `).get(cupId) as
        | { id: number; round_number: number; round_name: string; start_date: string; end_date: string }
        | undefined;

    if (!round) {
        db.prepare("UPDATE cup_competitions SET status = 'completed' WHERE id = ?").run(cupId);
        return;
    }

    if (round.round_name === 'Grand Final') {
        handleCustomFinal(db, cupId, round);
        return;
    }

    // Non-final round: advance only once every fixture is done.
    const pending = db.prepare(
        "SELECT COUNT(*) AS c FROM cup_fixtures WHERE round_id = ? AND status != 'completed'"
    ).get(round.id) as { c: number };
    if (pending.c > 0) return;

    db.prepare("UPDATE cup_rounds SET status = 'completed' WHERE id = ?").run(round.id);

    const next = db.prepare(
        'SELECT * FROM cup_rounds WHERE cup_id = ? AND round_number = ?'
    ).get(cupId, round.round_number + 1) as
        | { id: number; round_name: string; start_date: string; end_date: string }
        | undefined;

    if (!next) {
        db.prepare("UPDATE cup_competitions SET status = 'completed' WHERE id = ?").run(cupId);
        return;
    }

    const winners = (db.prepare(
        'SELECT winner_team_id FROM cup_fixtures WHERE round_id = ? ORDER BY id'
    ).all(round.id) as { winner_team_id: number | null }[])
        .map(w => w.winner_team_id)
        .filter((w): w is number => w != null);
    const pool = shuffle(winners);

    const insertFixture = db.prepare(`
        INSERT INTO cup_fixtures (cup_id, round_id, home_team_id, away_team_id, scheduled_date, status)
        VALUES (?, ?, ?, ?, ?, 'scheduled')
    `);

    if (next.round_name === 'Grand Final') {
        // Two finalists → best-of-3 on the final round's two dates.
        insertFixture.run(cupId, next.id, pool[0], pool[1], next.start_date);
        insertFixture.run(cupId, next.id, pool[0], pool[1], next.end_date);
    } else {
        for (let i = 0; i + 1 < pool.length; i += 2) {
            insertFixture.run(cupId, next.id, pool[i], pool[i + 1], next.start_date);
        }
    }
}

/** Best-of-3 final: complete the cup at 2 wins, add a decider at 1-1. */
function handleCustomFinal(db: Db, cupId: number, round: { id: number; end_date: string }): void {
    const fixtures = db.prepare(
        'SELECT * FROM cup_fixtures WHERE round_id = ? ORDER BY id'
    ).all(round.id) as {
        id: number; home_team_id: number; away_team_id: number;
        status: string; winner_team_id: number | null;
    }[];
    if (fixtures.length === 0) return;

    const team1 = fixtures[0].home_team_id;
    const team2 = fixtures[0].away_team_id;
    const wins1 = fixtures.filter(f => f.status === 'completed' && f.winner_team_id === team1).length;
    const wins2 = fixtures.filter(f => f.status === 'completed' && f.winner_team_id === team2).length;

    if (wins1 >= 2 || wins2 >= 2) {
        db.prepare("UPDATE cup_rounds SET status = 'completed' WHERE id = ?").run(round.id);
        db.prepare("UPDATE cup_competitions SET status = 'completed' WHERE id = ?").run(cupId);
        return;
    }

    if (wins1 === 1 && wins2 === 1 && fixtures.length === 2) {
        db.prepare(`
            INSERT INTO cup_fixtures (cup_id, round_id, home_team_id, away_team_id, scheduled_date, status)
            VALUES (?, ?, ?, ?, ?, 'scheduled')
        `).run(cupId, round.id, team1, team2, nextCupDate(round.end_date));
    }
}
