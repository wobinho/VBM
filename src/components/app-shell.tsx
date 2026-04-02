'use client';
import { useAuth } from '@/contexts/auth-context';
import Sidebar from '@/components/sidebar';
import AuthModal from '@/components/auth-modal';

export default function AppShell({ children }: { children: React.ReactNode }) {
    const { user, team, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-950">
                <div className="text-center space-y-4">
                    <div className="text-5xl animate-bounce">🏐</div>
                    <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden mx-auto">
                        <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full animate-pulse" style={{ width: '60%' }} />
                    </div>
                    <p className="text-sm text-gray-500">Loading Spike Dynasty...</p>
                </div>
            </div>
        );
    }

    if (!user || !team) {
        return <AuthModal />;
    }

    return (
        <div className="min-h-screen flex">
            <Sidebar />
            <main className="flex-1 overflow-y-auto min-h-screen">
                <div className="max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
