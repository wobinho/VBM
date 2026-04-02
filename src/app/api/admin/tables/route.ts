import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/index';
import { requireAdmin } from '@/lib/auth/requireAdmin';

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const db = getDb();
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as { name: string }[];

    const tablesWithSchema = tables.map(table => {
      const schema = db.prepare(`PRAGMA table_info(${table.name})`).all() as any[];
      const rows = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get() as { count: number };
      return {
        name: table.name,
        columns: schema,
        rowCount: rows.count,
      };
    });

    return NextResponse.json(tablesWithSchema);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch tables' }, { status: 500 });
  }
}
