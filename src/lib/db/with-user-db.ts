import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import { openUserDb, runWithDb } from './index';

/**
 * Wraps a Next.js route handler so it runs inside an AsyncLocalStorage
 * scope where `getDb()` returns the calling user's per-user game DB.
 *
 * Returns 401 if the request is unauthenticated.
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
        const db = openUserDb(session.userId);
        return runWithDb(db, () => handler(req, ctx)) as Promise<Response>;
    }) as H;
    return wrapped;
}
