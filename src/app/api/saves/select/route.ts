import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { authGetSave, authTouchSave } from '@/lib/db/auth-db';
import { sessionOptions, SessionData } from '@/lib/auth/session';

/**
 * POST /api/saves/select — set (or clear) the active save.
 * Body: { saveId: string } to open a save, { saveId: null } to deselect
 * and return to the save-picker screen.
 */
export async function POST(req: NextRequest) {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const saveId: string | null = body?.saveId ?? null;

    // The managed team is per-save, so always drop the cached team selection.
    session.teamId = undefined;
    session.teamName = undefined;

    if (!saveId) {
        session.saveId = undefined;
        await session.save();
        return NextResponse.json({ success: true, activeSave: null });
    }

    const save = authGetSave(saveId);
    if (!save || save.user_id !== session.userId) {
        return NextResponse.json({ error: 'Save not found' }, { status: 404 });
    }
    if (save.status !== 'ready') {
        return NextResponse.json({ error: 'This save is still being created' }, { status: 409 });
    }

    session.saveId = save.id;
    await session.save();
    authTouchSave(save.id);

    return NextResponse.json({
        success: true,
        activeSave: { id: save.id, name: save.name, save_type: save.save_type },
    });
}
