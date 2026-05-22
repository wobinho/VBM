import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { authGetSave, authDeleteSave } from '@/lib/db/auth-db';
import { dropSaveDb } from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/auth/session';

/** DELETE /api/saves/[id] — delete a save and its game DB file. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const save = authGetSave(id);
    if (!save || save.user_id !== session.userId) {
        return NextResponse.json({ error: 'Save not found' }, { status: 404 });
    }
    // The original per-user save is the protected default and cannot be deleted.
    if (save.id === save.user_id) {
        return NextResponse.json({ error: 'The Main Save cannot be deleted' }, { status: 400 });
    }

    dropSaveDb(save);
    authDeleteSave(id);

    if (session.saveId === id) {
        session.saveId = undefined;
        session.teamId = undefined;
        session.teamName = undefined;
        await session.save();
    }
    return NextResponse.json({ success: true });
}
