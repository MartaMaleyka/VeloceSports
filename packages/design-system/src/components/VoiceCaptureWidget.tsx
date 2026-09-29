import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Pause, Play } from 'lucide-react';
import { Button } from './Button.js';
import { cn } from '../utils/cn.js';

export interface VoiceCaptureWidgetProps {
  onCapture?: (audioData: Blob) => void;
  isProcessing?: boolean;
  placeholder?: string;
  className?: string;
}

export function VoiceCaptureWidget({
  onCapture,
  isProcessing = false,
  placeholder = 'Click to record action',
  className,
}: VoiceCaptureWidgetProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording, isPaused]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onCapture?.(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);
      setDuration(0);
    } catch (error) {
      console.error('Microphone access denied:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className={cn(
        'flex items-center gap-3 p-4 rounded-lg border-2 transition-all',
        isRecording
          ? 'border-red-500 bg-red-50 dark:bg-red-900'
          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900',
      )}>
        {/* Mic icon with pulse animation */}
        <div className={cn(
          'flex-shrink-0 p-3 rounded-lg',
          isRecording
            ? 'bg-red-100 dark:bg-red-800'
            : 'bg-gray-100 dark:bg-gray-800',
        )}>
          <Mic className={cn(
            'h-6 w-6',
            isRecording
              ? 'text-red-600 dark:text-red-400 animate-pulse'
              : 'text-gray-600 dark:text-gray-400',
          )} />
        </div>

        {/* Text and timer */}
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            {isRecording ? `Recording... ${formatTime(duration)}` : placeholder}
          </div>
          {isProcessing && (
            <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              Processing audio...
            </div>
          )}
        </div>

        {/* Control buttons */}
        <div className="flex gap-2">
          {!isRecording ? (
            <Button
              onClick={startRecording}
              size="sm"
              className="flex items-center gap-2"
              disabled={isProcessing}
            >
              <Mic className="h-4 w-4" />
              Record
            </Button>
          ) : (
            <>
              {!isPaused ? (
                <Button
                  onClick={pauseRecording}
                  size="sm"
                  variant="secondary"
                  className="flex items-center gap-2"
                >
                  <Pause className="h-4 w-4" />
                  Pause
                </Button>
              ) : (
                <Button
                  onClick={resumeRecording}
                  size="sm"
                  variant="secondary"
                  className="flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  Resume
                </Button>
              )}
              <Button
                onClick={stopRecording}
                size="sm"
                variant="destructive"
                className="flex items-center gap-2"
              >
                <Square className="h-4 w-4" />
                Stop
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
