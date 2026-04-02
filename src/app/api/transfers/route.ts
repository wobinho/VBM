import { NextRequest, NextResponse } from 'next/server';
import { getTransfers, createTransfer } from '@/lib/db/queries';

export async function GET() {
    return NextResponse.json(getTransfers());
}

export async function POST(req: NextRequest) {
    try {
        const data = await req.json();
        createTransfer(data);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Create transfer error:', error);
        return NextResponse.json({ error: 'Failed to create transfer' }, { status: 500 });
    }
}
