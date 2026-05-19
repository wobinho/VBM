import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { getReceivedOffers, getSentOffers, createOffer } from '@/lib/db/queries';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import { withUserDb } from '@/lib/db/with-user-db';

export const GET = withUserDb(async (req: NextRequest) => {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    const type = req.nextUrl.searchParams.get('type');
    if (type === 'sent') return NextResponse.json(getSentOffers(session.userId!));
    return NextResponse.json(getReceivedOffers(session.userId!));
});

export const POST = withUserDb(async (req: NextRequest) => {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    try {
        const data = await req.json();
        createOffer({ ...data, from_user_id: session.userId });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Create offer error:', error);
        return NextResponse.json({ error: 'Failed to create offer' }, { status: 500 });
    }
});
