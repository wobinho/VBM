import { NextRequest, NextResponse } from 'next/server';
import { updateTransferStatus } from '@/lib/db/queries';
import { withUserDb } from '@/lib/db/with-user-db';

export const PATCH = withUserDb(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const { status } = await req.json();
    updateTransferStatus(Number(id), status);
    return NextResponse.json({ success: true });
});
