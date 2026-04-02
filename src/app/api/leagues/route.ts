import { NextResponse } from 'next/server';
import { getLeagues } from '@/lib/db/queries';

export async function GET() {
    return NextResponse.json(getLeagues());
}
