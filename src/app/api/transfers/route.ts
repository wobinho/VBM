import { NextRequest, NextResponse } from 'next/server';
import { getTransfers, createTransfer } from '@/lib/db/queries';
import { withUserDb } from '@/lib/db/with-user-db';

export const GET = withUserDb(async () => {
    return NextResponse.json(getTransfers());
});

export const POST = withUserDb(async (req: NextRequest) => {
    try {
        const data = await req.json();
        createTransfer(data);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Create transfer error:', error);
        return NextResponse.json({ error: 'Failed to create transfer' }, { status: 500 });
    }
});
