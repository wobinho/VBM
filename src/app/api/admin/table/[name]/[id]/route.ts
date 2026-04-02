import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/index';
import { requireAdmin } from '@/lib/auth/requireAdmin';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ name: string; id: string }> }
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const { name, id } = await params;
    const body = await req.json();
    const db = getDb();

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      return NextResponse.json({ error: 'Invalid table name' }, { status: 400 });
    }

    const updates = Object.entries(body)
      .map(([key]) => `${key} = ?`)
      .join(', ');
    const values = Object.values(body);

    db.prepare(`UPDATE ${name} SET ${updates} WHERE id = ?`).run(...values, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update error:', error);
    return NextResponse.json({ error: 'Failed to update row' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ name: string; id: string }> }
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const { name, id } = await params;
    const db = getDb();

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      return NextResponse.json({ error: 'Invalid table name' }, { status: 400 });
    }

    db.prepare(`DELETE FROM ${name} WHERE id = ?`).run(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: 'Failed to delete row' }, { status: 500 });
  }
}
