'use client';
import { useEffect } from 'react';
import { useAudio } from '@/contexts/audio-context';

const INTERACTIVE_SELECTOR = 'button, a, [role="button"], input[type="checkbox"], input[type="radio"], input[type="submit"], input[type="button"], summary, [data-click-sfx]';

export default function ClickSoundListener() {
    const { playClick } = useAudio();

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (e.button !== 0) return;
            const target = e.target as HTMLElement | null;
            if (!target) return;
            const interactive = target.closest(INTERACTIVE_SELECTOR) as HTMLElement | null;
            if (!interactive) return;
            if (interactive.hasAttribute('disabled')) return;
            if (interactive.getAttribute('aria-disabled') === 'true') return;
            if (interactive.dataset.noClickSfx === 'true') return;
            playClick();
        };
        document.addEventListener('click', handler, true);
        return () => document.removeEventListener('click', handler, true);
    }, [playClick]);

    return null;
}
