import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import {
    authEnsureClassicSave, authListSaves, authGetSave,
    authCreateSave, authUpdateSaveStatus, authDeleteSave,
} from '@/lib/db/auth-db';
import { openSaveDb, createSelectiveClassicSaveDb } from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/auth/session';

/** GET /api/saves — list the current user's saves. */
export async function GET() {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Backfills the classic "Main Save" for accounts created before multi-save.
    authEnsureClassicSave(session.userId);
    return NextResponse.json({
        saves: authListSaves(session.userId),
        activeSaveId: session.saveId ?? null,
    });
}

/** POST /api/saves — create a new save and build its world. */
export async function POST(req: NextRequest) {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? '').trim();
    const type = body?.type ?? 'classic';
    const selectedCountries = Array.isArray(body?.selectedCountries) ? body.selectedCountries : undefined;

    if (!name) {
        return NextResponse.json({ error: 'Save name is required' }, { status: 400 });
    }
    if (name.length > 40) {
        return NextResponse.json({ error: 'Save name is too long (40 characters max)' }, { status: 400 });
    }
    if (type === 'custom') {
        return NextResponse.json({ error: 'Custom saves are coming soon' }, { status: 400 });
    }
    if (type !== 'classic') {
        return NextResponse.json({ error: 'Unknown save type' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    authCreateSave({ id, user_id: session.userId, name, save_type: 'classic', status: 'creating' });
    try {
        // Builds the world: schema + selected country seeds. Takes a few seconds.
        if (selectedCountries && selectedCountries.length > 0) {
            createSelectiveClassicSaveDb({ id, user_id: session.userId, save_type: 'classic' }, selectedCountries);
        } else {
            openSaveDb({ id, user_id: session.userId, save_type: 'classic' });
        }
        authUpdateSaveStatus(id, 'ready');
    } catch (error) {
        console.error('Save creation failed:', error);
        authDeleteSave(id);
        return NextResponse.json({ error: 'Failed to create save' }, { status: 500 });
    }

    return NextResponse.json({ success: true, save: authGetSave(id), saveId: id });
}
