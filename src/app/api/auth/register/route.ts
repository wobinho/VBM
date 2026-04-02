import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { createUser, getUserByEmail, getUserByUsername } from '@/lib/db/queries';
import { sessionOptions, SessionData } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
    try {
        const { email, password, username, displayName } = await req.json();

        if (!email || !password || !username || !displayName) {
            return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
        }

        if (getUserByEmail(email)) {
            return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
        }
        if (getUserByUsername(username)) {
            return NextResponse.json({ error: 'Username already taken' }, { status: 400 });
        }

        const id = crypto.randomUUID();
        const passwordHash = await bcrypt.hash(password, 10);

        createUser({ id, email, username, password_hash: passwordHash, display_name: displayName, is_admin: 1 });

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
