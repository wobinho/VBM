import { SessionOptions } from 'iron-session';

export interface SessionData {
    userId?: string;
    username?: string;
    displayName?: string;
    teamId?: number;
    teamName?: string;
}

export const sessionOptions: SessionOptions = {
    password: process.env.SESSION_SECRET || 'spike-dynasty-super-secret-password-that-is-at-least-32-chars',
    cookieName: 'spike-dynasty-session',
    cookieOptions: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax' as const,
        maxAge: 60 * 60 * 24 * 7, // 7 days
    },
};
