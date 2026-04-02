import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { getUserById } from '@/lib/db/queries';
import { sessionOptions, SessionData } from '@/lib/auth/session';

export async function requireAdmin(): Promise<{ userId: string } | NextResponse> {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = getUserById(session.userId);
    if (!user || user.is_admin !== 1) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return { userId: session.userId };
}
