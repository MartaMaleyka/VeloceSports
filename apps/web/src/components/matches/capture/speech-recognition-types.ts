/** Idioma del reconocimiento — cambia es-419 ↔ es-ES para probar variantes. */
export const VOICE_RECOGNITION_LANG_ES = 'es-419';
export const VOICE_RECOGNITION_LANG_EN = 'en-US';

export type VoiceSpeechLocale = 'es' | 'en';

export function speechLangForLocale(locale: VoiceSpeechLocale): string {
  return locale === 'en' ? VOICE_RECOGNITION_LANG_EN : VOICE_RECOGNITION_LANG_ES;
}

/** @deprecated Usar speechLangForLocale según idioma activo de la app */
export const VOICE_RECOGNITION_LANG = VOICE_RECOGNITION_LANG_ES;

export type VoiceRecognitionStatus =
  | 'unsupported'
  | 'idle'
  | 'listening'
  | 'permission_denied'
  | 'error';

export type VoiceRecognitionErrorCode =
  | 'not-allowed'
  | 'no-speech'
  | 'network'
  | 'aborted'
  | 'audio-capture'
  | 'service-not-allowed'
  | 'unknown';

export interface VoicePhraseEntry {
  id: string;
  text: string;
  at: number;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

export interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSecureSpeechContext(): boolean {
  if (typeof window === 'undefined') return false;
  return window.isSecureContext;
}
