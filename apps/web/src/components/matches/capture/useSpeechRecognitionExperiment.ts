import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeVoiceText, shouldSkipDuplicateVoicePhrase } from '@velocesport/shared';
import {
  getSpeechRecognitionCtor,
  isSecureSpeechContext,
  speechLangForLocale,
  type SpeechRecognitionLike,
  type VoiceRecognitionErrorCode,
  type VoiceRecognitionStatus,
  type VoiceSpeechLocale,
} from './speech-recognition-types';

const RESTART_DELAY_MS = 120;

function mapErrorCode(raw: string | undefined): VoiceRecognitionErrorCode {
  switch (raw) {
    case 'not-allowed':
    case 'service-not-allowed':
      return raw;
    case 'no-speech':
    case 'network':
    case 'aborted':
    case 'audio-capture':
      return raw;
    default:
      return 'unknown';
  }
}

export interface UseSpeechRecognitionOptions {
  locale: VoiceSpeechLocale;
  onFinalPhrase?: (text: string) => void;
  /** Modo continuo: reinicia escucha automáticamente hasta apagarlo. */
  continuousMode?: boolean;
}

export function useSpeechRecognitionExperiment(options: UseSpeechRecognitionOptions) {
  const { locale, onFinalPhrase, continuousMode = false } = options;
  const onFinalPhraseRef = useRef(onFinalPhrase);
  onFinalPhraseRef.current = onFinalPhrase;

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const listeningRef = useRef(false);
  const continuousRef = useRef(continuousMode);
  const sessionRef = useRef(0);
  const lastProcessedRef = useRef<{ text: string; at: number } | null>(null);
  const restartTimerRef = useRef<number | null>(null);

  continuousRef.current = continuousMode;

  const [supported, setSupported] = useState(true);
  const [secureContext, setSecureContext] = useState(true);
  const [status, setStatus] = useState<VoiceRecognitionStatus>('idle');
  const [errorCode, setErrorCode] = useState<VoiceRecognitionErrorCode | null>(null);
  const [continuousActive, setContinuousActive] = useState(false);

  const speechLang = speechLangForLocale(locale);

  useEffect(() => {
    const ctor = getSpeechRecognitionCtor();
    setSupported(ctor != null);
    setSecureContext(isSecureSpeechContext());
    if (ctor == null) {
      setStatus('unsupported');
    }
  }, []);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current != null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const emitFinalPhrase = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const normalized = normalizeVoiceText(trimmed);
    const now = Date.now();
    if (shouldSkipDuplicateVoicePhrase(normalized, lastProcessedRef.current, now)) {
      return;
    }
    lastProcessedRef.current = { text: normalized, at: now };
    onFinalPhraseRef.current?.(trimmed);
  }, []);

  const attachRecognitionHandlers = useCallback(
    (recognition: SpeechRecognitionLike, sessionId: number) => {
      recognition.onresult = (event) => {
        if (sessionId !== sessionRef.current) return;
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          if (!result.isFinal) continue;
          const transcript = result[0]?.transcript ?? '';
          emitFinalPhrase(transcript);
        }
      };

      recognition.onerror = (event) => {
        if (sessionId !== sessionRef.current) return;
        const code = mapErrorCode(event.error);
        setErrorCode(code);
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          setStatus('permission_denied');
          listeningRef.current = false;
          continuousRef.current = false;
          setContinuousActive(false);
          return;
        }
        if (code === 'no-speech' && continuousRef.current && listeningRef.current) {
          return;
        }
        if (code !== 'aborted' && code !== 'no-speech') {
          setStatus('error');
        }
      };

      recognition.onend = () => {
        if (sessionId !== sessionRef.current) return;
        if (!listeningRef.current) {
          setContinuousActive(false);
          setStatus((current) =>
            current === 'permission_denied' || current === 'unsupported' || current === 'error'
              ? current
              : 'idle',
          );
          return;
        }
        clearRestartTimer();
        restartTimerRef.current = window.setTimeout(() => {
          if (!listeningRef.current || sessionId !== sessionRef.current) return;
          try {
            recognition.start();
            setStatus('listening');
          } catch {
            listeningRef.current = false;
            setContinuousActive(false);
            setStatus('idle');
          }
        }, RESTART_DELAY_MS);
      };
    },
    [clearRestartTimer, emitFinalPhrase],
  );

  const stopListening = useCallback(() => {
    listeningRef.current = false;
    continuousRef.current = false;
    setContinuousActive(false);
    sessionRef.current += 1;
    clearRestartTimer();
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setStatus((current) => {
      if (current === 'unsupported' || current === 'permission_denied' || current === 'error') {
        return current;
      }
      return 'idle';
    });
  }, [clearRestartTimer]);

  const startListening = useCallback(
    (continuous: boolean) => {
      const ctor = getSpeechRecognitionCtor();
      if (!ctor) {
        setStatus('unsupported');
        return;
      }
      if (!isSecureSpeechContext()) {
        setStatus('error');
        setErrorCode('service-not-allowed');
        return;
      }

      recognitionRef.current?.abort();
      clearRestartTimer();
      sessionRef.current += 1;
      const sessionId = sessionRef.current;

      setErrorCode(null);
      continuousRef.current = continuous;
      listeningRef.current = true;
      setContinuousActive(continuous);

      const recognition = new ctor();
      recognition.lang = speechLang;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      attachRecognitionHandlers(recognition, sessionId);
      recognitionRef.current = recognition;

      try {
        recognition.start();
        setStatus('listening');
      } catch {
        setStatus('error');
        setErrorCode('unknown');
        listeningRef.current = false;
        setContinuousActive(false);
      }
    },
    [attachRecognitionHandlers, clearRestartTimer, speechLang],
  );

  const toggleListening = useCallback(() => {
    if (listeningRef.current) {
      stopListening();
      return;
    }
    if (status === 'unsupported') return;
    startListening(false);
  }, [startListening, status, stopListening]);

  const startContinuousListening = useCallback(() => {
    if (status === 'unsupported') return;
    startListening(true);
  }, [startListening, status]);

  const stopContinuousListening = useCallback(() => {
    stopListening();
  }, [stopListening]);

  useEffect(() => {
    if (!continuousMode) {
      if (continuousRef.current && listeningRef.current) {
        stopListening();
      }
      return;
    }
    if (listeningRef.current) return;
    if (status === 'unsupported' || status === 'permission_denied') return;
    startListening(true);
  }, [continuousMode, startListening, status, stopListening]);

  useEffect(() => {
    return () => {
      listeningRef.current = false;
      clearRestartTimer();
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, [clearRestartTimer]);

  const isListening = status === 'listening';

  return {
    lang: speechLang,
    supported,
    secureContext,
    status,
    errorCode,
    isListening,
    continuousActive,
    toggleListening,
    stopListening,
    startContinuousListening,
    stopContinuousListening,
  };
}
