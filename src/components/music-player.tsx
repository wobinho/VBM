'use client';
import { useState, useEffect, useRef } from 'react';
import { Music, Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, X } from 'lucide-react';
import { useAudio } from '@/contexts/audio-context';

export default function MusicPlayer() {
    const { currentTrack, isPlaying, volume, toggle, next, previous, setVolume } = useAudio();
    const [expanded, setExpanded] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);

    // Collapse when clicking outside
    useEffect(() => {
        if (!expanded) return;
        const handler = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
                setExpanded(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [expanded]);

    const muted = volume === 0;

    return (
        <div
            ref={rootRef}
            className="fixed bottom-6 right-6 z-50 select-none"
            style={{ fontFamily: 'var(--font-body)' }}
        >
            {!expanded && (
                <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    aria-label="Open music player"
                    className="group relative h-12 w-12 rounded-full flex items-center justify-center
                               bg-[var(--ink-900)]/60 backdrop-blur-md border border-white/10
                               opacity-40 hover:opacity-100 transition-all duration-300
                               hover:scale-105 hover:border-[var(--volt)]/50
                               shadow-lg shadow-black/40"
                >
                    <Music className="w-5 h-5 text-[var(--bone)]" strokeWidth={1.5} />
                    {isPlaying && (
                        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[var(--volt)] animate-pulse" />
                    )}
                </button>
            )}

            {expanded && (
                <div
                    className="w-72 rounded-2xl bg-[var(--ink-900)]/85 backdrop-blur-xl
                               border border-white/10 shadow-2xl shadow-black/60
                               p-4 animate-fade-up"
                >
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="h-8 w-8 rounded-lg bg-[var(--volt)]/15 flex items-center justify-center shrink-0">
                                <Music className="w-4 h-4 text-[var(--volt)]" strokeWidth={1.5} />
                            </div>
                            <div className="min-w-0">
                                <p className="eyebrow text-[9px] mb-0.5">Now playing</p>
                                <p className="text-sm text-[var(--bone)] font-medium truncate">{currentTrack.title}</p>
                                <p className="text-[11px] text-[var(--ink-400)] truncate">{currentTrack.artist}</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setExpanded(false)}
                            aria-label="Collapse player"
                            className="h-7 w-7 rounded-md flex items-center justify-center text-[var(--ink-400)] hover:text-[var(--bone)] hover:bg-white/5 transition-colors shrink-0"
                        >
                            <X className="w-4 h-4" strokeWidth={1.5} />
                        </button>
                    </div>

                    <div className="flex items-center justify-center gap-2 mb-4">
                        <button
                            type="button"
                            onClick={previous}
                            aria-label="Previous song"
                            className="h-9 w-9 rounded-full flex items-center justify-center text-[var(--bone)] hover:bg-white/5 transition-colors"
                        >
                            <SkipBack className="w-4 h-4" strokeWidth={1.5} fill="currentColor" />
                        </button>
                        <button
                            type="button"
                            onClick={toggle}
                            aria-label={isPlaying ? 'Pause' : 'Play'}
                            className="h-11 w-11 rounded-full flex items-center justify-center
                                       bg-[var(--volt)] text-[var(--ink-950)]
                                       hover:bg-[var(--volt-bright)] transition-colors
                                       shadow-md shadow-[var(--volt)]/20"
                        >
                            {isPlaying
                                ? <Pause className="w-5 h-5" strokeWidth={2} fill="currentColor" />
                                : <Play className="w-5 h-5 ml-0.5" strokeWidth={2} fill="currentColor" />
                            }
                        </button>
                        <button
                            type="button"
                            onClick={next}
                            aria-label="Next song"
                            className="h-9 w-9 rounded-full flex items-center justify-center text-[var(--bone)] hover:bg-white/5 transition-colors"
                        >
                            <SkipForward className="w-4 h-4" strokeWidth={1.5} fill="currentColor" />
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setVolume(muted ? 0.4 : 0)}
                            aria-label={muted ? 'Unmute' : 'Mute'}
                            className="text-[var(--ink-400)] hover:text-[var(--bone)] transition-colors shrink-0"
                        >
                            {muted
                                ? <VolumeX className="w-4 h-4" strokeWidth={1.5} />
                                : <Volume2 className="w-4 h-4" strokeWidth={1.5} />
                            }
                        </button>
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={volume}
                            onChange={(e) => setVolume(parseFloat(e.target.value))}
                            aria-label="Volume"
                            className="vbm-volume flex-1"
                            style={{
                                background: `linear-gradient(to right, var(--volt) 0%, var(--volt) ${volume * 100}%, rgba(255,255,255,0.1) ${volume * 100}%, rgba(255,255,255,0.1) 100%)`,
                            }}
                        />
                        <span className="font-mono text-[10px] text-[var(--ink-400)] tabular w-7 text-right">
                            {Math.round(volume * 100)}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
