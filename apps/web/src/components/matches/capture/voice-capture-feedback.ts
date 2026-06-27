/**
 * Feedback auditivo/háptico para captura por voz sin mirar la pantalla.
 * Usa Web Audio API (sin archivos externos) y Vibration API.
 */

export interface VoiceFeedbackOptions {
  sound: boolean;
  vibration: boolean;
}

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    const Ctx = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    audioContext = new Ctx();
  }
  return audioContext;
}

function playTone(frequency: number, durationMs: number, volume = 0.15): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  void ctx.resume().catch(() => undefined);
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  gain.gain.value = volume;
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  const now = ctx.currentTime;
  oscillator.start(now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);
  oscillator.stop(now + durationMs / 1000 + 0.02);
}

function vibrate(pattern: number | number[]): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

export function playVoiceSuccessFeedback(options: VoiceFeedbackOptions): void {
  if (options.sound) {
    playTone(880, 70);
  }
  if (options.vibration) {
    vibrate(45);
  }
}

export function playVoiceErrorFeedback(options: VoiceFeedbackOptions): void {
  if (options.sound) {
    playTone(220, 90);
    window.setTimeout(() => playTone(180, 90), 110);
  }
  if (options.vibration) {
    vibrate([35, 60, 35]);
  }
}

export function playVoiceInfoFeedback(options: VoiceFeedbackOptions): void {
  if (options.sound) {
    playTone(440, 50);
  }
  if (options.vibration) {
    vibrate(25);
  }
}
