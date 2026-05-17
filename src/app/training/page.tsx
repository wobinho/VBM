'use client';
import { Dumbbell } from 'lucide-react';

export default function TrainingPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 text-center">
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
                <Dumbbell size={40} className="text-[var(--volt)]" />
            </div>
            <div>
                <h1 className="font-display text-3xl tracking-[0.06em] text-[var(--bone)] uppercase">Training</h1>
                <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--ink-500)] mt-2">Coming soon</p>
            </div>
            <p className="text-sm text-[var(--ink-400)] max-w-sm">
                Training sessions, drills, and player development will be available here.
            </p>
        </div>
    );
}
