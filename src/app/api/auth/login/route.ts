import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { getUserByEmail, getUserTeam } from '@/lib/db/queries';
import { sessionOptions, SessionData } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
    try {
        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
        }

        const user = getUserByEmail(email);
        if (!user) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        const userTeam = getUserTeam(user.id);

        const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
        session.userId = user.id;
        session.username = user.username;
        session.displayName = user.display_name;
        if (userTeam) {
            session.teamId = userTeam.team_id;
            session.teamName = userTeam.team_name;
        }
        await session.save();

        return NextResponse.json({
            success: true,
            user: { id: user.id, email: user.email, username: user.username, displayName: user.display_name, isAdmin: user.is_admin === 1 },
            team: userTeam ? { id: userTeam.team_id, name: userTeam.team_name } : null,
        });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ error: 'Login failed' }, { status: 500 });
    }
}
