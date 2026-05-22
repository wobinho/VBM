'use client';
import Image from 'next/image';
import { useAuth } from '@/contexts/auth-context';
import Sidebar from '@/components/sidebar';
import AuthModal from '@/components/auth-modal';
import SavePicker from '@/components/save-picker';
import DraftScreen from '@/components/draft-screen';
import MusicPlayer from '@/components/music-player';
import ClickSoundListener from '@/components/click-sound-listener';

export default function AppShell({ children }: { children: React.ReactNode }) {
    const { user, team, loading, needsSaveSelection, draftPending } = useAuth();

    if (loading) {
        return (
            <>
                <ClickSoundListener />
                <div className="min-h-screen flex items-center justify-center">
                    <div className="text-center space-y-6 max-w-sm w-full px-6 animate-fade-up">
                        <div className="flex items-center justify-center">
                            <Image
                                src="/assets/vbm_logo.png"
                                alt="VBM"
                                width={140}
                                height={140}
                                priority
                                className="animate-float object-contain"
                            />
                        </div>
                        <div>
                            <p className="eyebrow mb-1">Initializing</p>
                            <h1 className="font-display text-4xl tracking-wide text-[var(--bone)]">VBM</h1>
                        </div>
                        <div className="w-full h-[3px] bg-white/5 overflow-hidden">
                            <div className="h-full bg-[var(--volt)] animate-shimmer" style={{ width: '60%' }} />
                        </div>
                        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--ink-500)]">Loading roster &middot; warming court</p>
                    </div>
                </div>
            </>
        );
    }

    if (!user) {
        return (
            <>
                <ClickSoundListener />
                <AuthModal />
                <MusicPlayer />
            </>
        );
    }

    if (needsSaveSelection) {
        return (
            <>
                <ClickSoundListener />
                <SavePicker />
                <MusicPlayer />
            </>
        );
    }

    if (!team) {
        return (
            <>
                <ClickSoundListener />
                <AuthModal />
                <MusicPlayer />
            </>
        );
    }

    if (draftPending) {
        return (
            <>
                <ClickSoundListener />
                <DraftScreen />
                <MusicPlayer />
            </>
        );
    }

    return (
        <div className="h-screen flex overflow-hidden">
            <ClickSoundListener />
            <Sidebar />
            <main className="flex-1 overflow-y-auto">
                <div className="max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-10">
                    {children}
                </div>
            </main>
            <MusicPlayer />
        </div>
    );
}
