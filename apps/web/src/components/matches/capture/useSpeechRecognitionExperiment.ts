import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getSpeechRecognitionCtor,
  isSecureSpeechContext,
  speechLangForLocale,
  type SpeechRecognitionLike,
  type VoicePhraseEntry,
  type VoiceRecognitionErrorCode,
  type VoiceRecognitionStatus,
  type VoiceSpeechLocale,
} from './speech-recognition-types';

const MAX_HISTORY = 12;

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
}

export function useSpeechRecognitionExperiment(options: UseSpeechRecognitionOptions) {
  const { locale, onFinalPhrase } = options;
  const onFinalPhraseRef = useRef(onFinalPhrase);
  onFinalPhraseRef.current = onFinalPhrase;

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const listeningRef = useRef(false);

  const [supported, setSupported] = useState(true);
  const [secureContext, setSecureContext] = useState(true);
  const [status, setStatus] = useState<VoiceRecognitionStatus>('idle');
  const [errorCode, setErrorCode] = useState<VoiceRecognitionErrorCode | null>(null);
  const [interimText, setInterimText] = useState('');
  const [lastFinalText, setLastFinalText] = useState('');
  const [history, setHistory] = useState<VoicePhraseEntry[]>([]);

  const speechLang = speechLangForLocale(locale);

  useEffect(() => {
    const ctor = getSpeechRecognitionCtor();
    setSupported(ctor != null);
    setSecureContext(isSecureSpeechContext());
    if (ctor == null) {
      setStatus('unsupported');
    }
  }, []);

  const pushFinalPhrase = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setLastFinalText(trimmed);
    setHistory((prev) =>
      [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          text: trimmed,
          at: Date.now(),
        },
        ...prev,
      ].slice(0, MAX_HISTORY),
    );
    onFinalPhraseRef.current?.(trimmed);
  }, []);

  const stopListening = useCallback(() => {
    listeningRef.current = false;
    recognitionRef.current?.stop();
    setInterimText('');
    setStatus((current) => {
      if (current === 'unsupported' || current === 'permission_denied' || current === 'error') {
        return current;
      }
      return 'idle';
    });
  }, []);

  const startListening = useCallback(() => {
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

    setErrorCode(null);
    setInterimText('');

    const recognition = new ctor();
    recognition.lang = speechLang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) {
          pushFinalPhrase(transcript);
          setInterimText('');
        } else {
          interim += transcript;
        }
      }
      if (interim) {
        setInterimText(interim.trim());
      }
    };

    recognition.onerror = (event) => {
      const code = mapErrorCode(event.error);
      setErrorCode(code);
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setStatus('permission_denied');
      } else if (code !== 'aborted' && code !== 'no-speech') {
        setStatus('error');
      }
      listeningRef.current = false;
      setInterimText('');
    };

    recognition.onend = () => {
      if (listeningRef.current) {
        try {
          recognition.start();
        } catch {
          listeningRef.current = false;
          setStatus('idle');
        }
        return;
      }
      setInterimText('');
      setStatus((current) =>
        current === 'permission_denied' || current === 'unsupported' || current === 'error'
          ? current
          : 'idle',
      );
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      listeningRef.current = true;
      setStatus('listening');
    } catch {
      setStatus('error');
      setErrorCode('unknown');
      listeningRef.current = false;
    }
  }, [pushFinalPhrase, speechLang]);

  const toggleListening = useCallback(() => {
    if (status === 'listening') {
      stopListening();
      return;
    }
    if (status === 'unsupported') return;
    startListening();
  }, [startListening, status, stopListening]);

  useEffect(() => {
    return () => {
      listeningRef.current = false;
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const isListening = status === 'listening';

  return {
    lang: speechLang,
    supported,
    secureContext,
    status,
    errorCode,
    isListening,
    interimText,
    lastFinalText,
    history,
    toggleListening,
    stopListening,
  };
}
