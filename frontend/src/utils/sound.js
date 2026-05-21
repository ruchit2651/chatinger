/**
 * Lightweight notification chime — synthesized via WebAudio so no asset is
 * required. Two-tone "bing" similar to common chat clients. Falls back
 * silently if AudioContext is unavailable or blocked.
 */
let ctx = null;

function getContext() {
    if (ctx) return ctx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try {
        ctx = new Ctor();
    } catch {
        return null;
    }
    return ctx;
}

function tone(frequency, startOffset, duration) {
    const audio = getContext();
    if (!audio) return;
    const now = audio.currentTime + startOffset;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, now);
    // Quick attack / soft decay to avoid clicks.
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(audio.destination);
    osc.start(now);
    osc.stop(now + duration + 0.05);
}

export function playChime() {
    try {
        const audio = getContext();
        if (!audio) return;
        // Most browsers suspend AudioContext until a user gesture; try to resume.
        if (audio.state === 'suspended') audio.resume().catch(() => {});
        tone(880, 0, 0.18);     // A5
        tone(1175, 0.12, 0.22); // D6
    } catch {
        // ignore
    }
}
