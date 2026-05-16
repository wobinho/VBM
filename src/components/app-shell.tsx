'use client';
import { useAuth } from '@/contexts/auth-context';
import Sidebar from '@/components/sidebar';
import AuthModal from '@/components/auth-modal';

export default function AppShell({ children }: { children: React.ReactNode }) {
    const { user, team, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center space-y-6 max-w-sm w-full px-6 animate-fade-up">
                    <div className="flex items-center justify-center gap-3">
                        <span className="text-5xl animate-float">🏐</span>
                    </div>
                    <div>
                        <p className="eyebrow mb-1">Initializing</p>
                        <h1 className="font-display text-4xl tracking-wide text-[var(--bone)]">SPIKE DYNASTY</h1>
                    </div>
                    <div className="w-full h-[3px] bg-white/5 overflow-hidden">
                        <div className="h-full bg-[var(--volt)] animate-shimmer" style={{ width: '60%' }} />
                    </div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--ink-500)]">Loading roster &middot; warming court</p>
                </div>
            </div>
        );
    }

    if (!user || !team) {
        return <AuthModal />;
    }

    return (
        <div className="h-screen flex overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-y-auto">
                <div className="max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-10">
                    {children}
                </div>
            </main>
        </div>
    );
}
