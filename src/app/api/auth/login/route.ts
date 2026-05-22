import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { authGetUserByEmail, authEnsureClassicSave } from '@/lib/db/auth-db';
import { sessionOptions, SessionData } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
    try {
        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
        }

        const user = authGetUserByEmail(email);
        if (!user) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        // Make sure the user's classic "Main Save" is registered — backfills
        // accounts created before multi-save existed. Which save to actually
        // load is chosen on the save-picker screen, not here.
        authEnsureClassicSave(user.id);

        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
        session.userId = user.id;
        session.username = user.username;
        session.displayName = user.display_name;
        session.saveId = undefined;
        session.teamId = undefined;
        session.teamName = undefined;
        await session.save();

        return NextResponse.json({
            success: true,
            user: { id: user.id, email: user.email, username: user.username, displayName: user.display_name, isAdmin: user.is_admin === 1 },
        });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ error: 'Login failed' }, { status: 500 });
    }
}
