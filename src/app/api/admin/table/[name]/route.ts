import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/index';
import { requireAdmin } from '@/lib/auth/requireAdmin';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const { name } = await params;
    const db = getDb();

    // Sanitize table name
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      return NextResponse.json({ error: 'Invalid table name' }, { status: 400 });
    }

    const data = db.prepare(`SELECT * FROM ${name} LIMIT 1000`).all();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch table data' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const { name } = await params;
    const body = await req.json();
    const db = getDb();

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      return NextResponse.json({ error: 'Invalid table name' }, { status: 400 });
    }

    // Get columns from table schema
    const columns = db.prepare(`PRAGMA table_info(${name})`).all() as any[];
    
    // Filter columns to include 'id' only if it's in the body, 
    // and only include columns that are actually present in the request body.
    const columnNames = columns.map(c => c.name).filter(c => {
      if (c === 'id') return body.id !== undefined;
      return body[c] !== undefined;
    });

    if (columnNames.length === 0) {
      return NextResponse.json({ error: 'No data provided' }, { status: 400 });
    }

    const placeholders = columnNames.map(() => '?').join(', ');
    const values = columnNames.map(c => body[c]);

    const result = db.prepare(
      `INSERT INTO ${name} (${columnNames.join(', ')}) VALUES (${placeholders})`
    ).run(...values);

    return NextResponse.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    console.error('Insert error:', error);
    return NextResponse.json({ error: 'Failed to insert row' }, { status: 500 });
  }
}
