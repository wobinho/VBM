import { promises as fs } from 'fs';
import { join } from 'path';
import { NextResponse } from 'next/server';

/**
 * GET /api/badges — returns a list of all available team badge filenames
 * from the public/assets/teams directory (without extensions)
 */
export async function GET() {
    try {
        const teamsDir = join(process.cwd(), 'public', 'assets', 'teams');
        const files = await fs.readdir(teamsDir);

        // Filter to only PNG files, extract numeric badges and named ones
        const badges = files
            .filter(f => f.endsWith('.png'))
            .map(f => f.replace('.png', ''))
            .sort((a, b) => {
                // Numeric badges first (sorted numerically), then named ones (alphabetically)
                const aNum = !isNaN(Number(a));
                const bNum = !isNaN(Number(b));
                if (aNum && bNum) return Number(a) - Number(b);
                if (aNum) return -1;
                if (bNum) return 1;
                return a.localeCompare(b);
            });

        return NextResponse.json({ badges });
    } catch (error) {
        console.error('Failed to read badges directory:', error);
        return NextResponse.json({ error: 'Failed to read badges' }, { status: 500 });
    }
}
