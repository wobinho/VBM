import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/index';

export async function GET() {
    const db = getDb();
    const leagues = db.prepare(`
        SELECT l.*, lc.config
        FROM leagues l
        LEFT JOIN league_configs lc ON lc.league_id = l.id
        ORDER BY l.id
    `).all() as (Record<string, unknown> & { config?: string })[];

    const result = leagues.map(({ config, ...rest }) => ({
        ...rest,
        format_type: config ? (JSON.parse(config) as { format?: { type?: string } }).format?.type ?? null : null,
    }));

    return NextResponse.json(result);
}
