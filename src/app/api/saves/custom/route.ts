import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { authCreateSave, authUpdateSaveStatus, authDeleteSave, authGetSave } from '@/lib/db/auth-db';
import { openSaveDb, openCatalogDb, dropSaveDb } from '@/lib/db';
import { seedCustomWorld, validateAgainstCatalog } from '@/lib/seed-custom';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import type { CustomWorldConfig } from '@/lib/custom-save';

/** POST /api/saves/custom — validate a custom-world config and build the save. */
export async function POST(req: NextRequest) {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = (await req.json().catch(() => null)) as CustomWorldConfig | null;
    if (!config) {
        return NextResponse.json({ error: 'Invalid configuration' }, { status: 400 });
    }

    const catalogDb = openCatalogDb();
    const errors = validateAgainstCatalog(config, catalogDb);
    if (errors.length) {
        return NextResponse.json({ error: errors[0], errors }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const saveName = config.saveName.trim();
    authCreateSave({ id, user_id: session.userId, name: saveName, save_type: 'custom', status: 'creating' });

    try {
        const customDb = openSaveDb({ id, user_id: session.userId, save_type: 'custom' });
        seedCustomWorld(customDb, catalogDb, config);
        authUpdateSaveStatus(id, 'ready');
    } catch (error) {
        console.error('Custom save creation failed:', error);
        dropSaveDb({ id, user_id: session.userId, save_type: 'custom' });
        authDeleteSave(id);
        return NextResponse.json({ error: 'Failed to build the custom world' }, { status: 500 });
    }

    return NextResponse.json({ success: true, save: authGetSave(id) });
}
