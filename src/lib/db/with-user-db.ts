import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import { authGetSave } from './auth-db';
import { openSaveDb, runWithDb } from './index';

/**
 * Wraps a Next.js route handler so it runs inside an AsyncLocalStorage
 * scope where `getDb()` returns the active save's game DB.
 *
 * Returns 401 if unauthenticated, 409 if no save is selected, 404 if the
 * selected save does not belong to the caller.
 *
 * Usage:
 *   export const GET = withUserDb(async (req) => { ... getDb() ... });
 *   export const GET = withUserDb(async (req, { params }) => { ... });
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withUserDb<H extends (req: NextRequest, ctx: any) => Promise<Response> | Response>(handler: H): H {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wrapped = (async (req: NextRequest, ctx: any) => {
        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
        if (!session.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (!session.saveId) {
            return NextResponse.json({ error: 'No save selected' }, { status: 409 });
        }
        const save = authGetSave(session.saveId);
        if (!save || save.user_id !== session.userId) {
            return NextResponse.json({ error: 'Save not found' }, { status: 404 });
        }
        const db = openSaveDb(save);
        return runWithDb(db, () => handler(req, ctx)) as Promise<Response>;
    }) as H;
    return wrapped;
}
