'use client';
import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';

interface Track {
    title: string;
    artist: string;
    src: string;
}

interface AudioContextType {
    tracks: Track[];
    currentIndex: number;
    currentTrack: Track;
    isPlaying: boolean;
    volume: number;
    sfxEnabled: boolean;
    musicReady: boolean;
    play: () => void;
    pause: () => void;
    toggle: () => void;
    next: () => void;
    previous: () => void;
    setVolume: (v: number) => void;
    setSfxEnabled: (v: boolean) => void;
    playClick: () => void;
}

const TRACKS: Track[] = [
    { title: 'Cassette Groove', artist: 'Aventure', src: '/assets/music/Aventure - Cassette Groove.mp3' },
    { title: 'Coffee & Streets', artist: 'Aylex', src: '/assets/music/Aylex - Coffee & Streets.mp3' },
    { title: 'Good Days', artist: 'Aylex', src: '/assets/music/Aylex - Good Days.mp3' },
    { title: 'Back Alley', artist: 'Burgundy X', src: '/assets/music/Burgundy X - Back Alley.mp3' },
    { title: 'Urban Pulse', artist: 'Dagored', src: '/assets/music/Dagored - Urban Pulse.mp3' },
    { title: 'Sunshine', artist: 'Moavii', src: '/assets/music/Moavii - Sunshine.mp3' },
    { title: 'B Reel', artist: 'Tetuano', src: '/assets/music/Tetuano - B Reel.mp3' },
    { title: 'Back To Promise', artist: 'Unheard', src: '/assets/music/Unheard - Back To Promise.mp3' },
];

const CLICK_SFX_SRC = '/assets/sound-effects/mouse-click.mp3';
const STORAGE_KEY = 'spike-dynasty-audio';

const Ctx = createContext<AudioContextType | null>(null);

export function AudioProvider({ children }: { children: React.ReactNode }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolumeState] = useState(0.4);
    const [sfxEnabled, setSfxEnabledState] = useState(true);
    const [musicReady, setMusicReady] = useState(false);

    const musicRef = useRef<HTMLAudioElement | null>(null);
    const sfxPoolRef = useRef<HTMLAudioElement[]>([]);
    const sfxIndexRef = useRef(0);

    // Restore persisted preferences
    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const saved = JSON.parse(raw);
                if (typeof saved.volume === 'number') setVolumeState(Math.min(1, Math.max(0, saved.volume)));
                if (typeof saved.sfxEnabled === 'boolean') setSfxEnabledState(saved.sfxEnabled);
                if (typeof saved.currentIndex === 'number' && saved.currentIndex >= 0 && saved.currentIndex < TRACKS.length) {
                    setCurrentIndex(saved.currentIndex);
                }
            }
        } catch { /* ignore */ }
    }, []);

    // Persist preferences
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ volume, sfxEnabled, currentIndex }));
        } catch { /* ignore */ }
    }, [volume, sfxEnabled, currentIndex]);

    // Initialize audio elements on the client only
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const music = new Audio();
        music.loop = false;
        music.preload = 'auto';
        musicRef.current = music;

        const pool: HTMLAudioElement[] = [];
        for (let i = 0; i < 4; i++) {
            const a = new Audio(CLICK_SFX_SRC);
            a.preload = 'auto';
            pool.push(a);
        }
        sfxPoolRef.current = pool;
        setMusicReady(true);

        return () => {
            music.pause();
            music.src = '';
            musicRef.current = null;
            sfxPoolRef.current = [];
        };
    }, []);

    // Apply volume to elements
    useEffect(() => {
        if (musicRef.current) musicRef.current.volume = volume;
        sfxPoolRef.current.forEach((a) => { a.volume = Math.min(1, volume * 1.4); });
    }, [volume]);

    const playCurrent = useCallback(() => {
        const el = musicRef.current;
        if (!el) return;
        const promise = el.play();
        if (promise && typeof promise.then === 'function') {
            promise.then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
        } else {
            setIsPlaying(true);
        }
    }, []);

    // Load current track when index changes
    useEffect(() => {
        const el = musicRef.current;
        if (!el || !musicReady) return;
        const track = TRACKS[currentIndex];
        const absolute = new URL(track.src, window.location.origin).toString();
        if (el.src !== absolute) {
            el.src = track.src;
            el.load();
        }
        if (isPlaying) playCurrent();
    }, [currentIndex, musicReady, isPlaying, playCurrent]);

    // Advance on track end
    useEffect(() => {
        const el = musicRef.current;
        if (!el) return;
        const handleEnded = () => {
            setCurrentIndex((i) => (i + 1) % TRACKS.length);
            setIsPlaying(true);
        };
        el.addEventListener('ended', handleEnded);
        return () => el.removeEventListener('ended', handleEnded);
    }, [musicReady]);

    const play = useCallback(() => {
        playCurrent();
    }, [playCurrent]);

    const pause = useCallback(() => {
        const el = musicRef.current;
        if (!el) return;
        el.pause();
        setIsPlaying(false);
    }, []);

    const toggle = useCallback(() => {
        if (isPlaying) pause();
        else play();
    }, [isPlaying, pause, play]);

    const next = useCallback(() => {
        setCurrentIndex((i) => (i + 1) % TRACKS.length);
    }, []);

    const previous = useCallback(() => {
        setCurrentIndex((i) => (i - 1 + TRACKS.length) % TRACKS.length);
    }, []);

    const setVolume = useCallback((v: number) => {
        setVolumeState(Math.min(1, Math.max(0, v)));
    }, []);

    const setSfxEnabled = useCallback((v: boolean) => {
        setSfxEnabledState(v);
    }, []);

    const playClick = useCallback(() => {
        if (!sfxEnabled) return;
        const pool = sfxPoolRef.current;
        if (!pool.length) return;
        const a = pool[sfxIndexRef.current];
        sfxIndexRef.current = (sfxIndexRef.current + 1) % pool.length;
        try {
            a.currentTime = 0;
            const p = a.play();
            if (p && typeof p.catch === 'function') p.catch(() => { /* ignore autoplay errors */ });
        } catch { /* ignore */ }
    }, [sfxEnabled]);

    const value = useMemo<AudioContextType>(() => ({
        tracks: TRACKS,
        currentIndex,
        currentTrack: TRACKS[currentIndex],
        isPlaying,
        volume,
        sfxEnabled,
        musicReady,
        play,
        pause,
        toggle,
        next,
        previous,
        setVolume,
        setSfxEnabled,
        playClick,
    }), [currentIndex, isPlaying, volume, sfxEnabled, musicReady, play, pause, toggle, next, previous, setVolume, setSfxEnabled, playClick]);

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAudio(): AudioContextType {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error('useAudio must be used within an AudioProvider');
    return ctx;
}
