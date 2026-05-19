import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { authGetUserByEmail, authGetUserByUsername, authCreateUser } from '@/lib/db/auth-db';
import { openUserDb } from '@/lib/db';
import { sessionOptions, SessionData } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
    try {
        const { email, password, username, displayName } = await req.json();

        if (!email || !password || !username || !displayName) {
            return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
        }

        if (authGetUserByEmail(email)) {
            return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
        }
        if (authGetUserByUsername(username)) {
            return NextResponse.json({ error: 'Username already taken' }, { status: 400 });
        }

        const id = crypto.randomUUID();
        const passwordHash = await bcrypt.hash(password, 10);

        authCreateUser({ id, email, username, password_hash: passwordHash, display_name: displayName, is_admin: 1 });

        // Eagerly create + seed this user's game DB so first login is fast.
        // openUserDb is idempotent — running schema + seeds on an empty file
        // takes a few seconds, but only happens once per user.
        openUserDb(id);

        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
        session.userId = id;
        session.username = username;
        session.displayName = displayName;
        await session.save();

        return NextResponse.json({ success: true, user: { id, email, username, displayName } });
    } catch (error) {
        console.error('Registration error:', error);
        return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
    }
}
