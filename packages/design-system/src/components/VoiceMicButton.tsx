import { useState, useRef } from 'react';
import { cn } from '../utils/cn.js';
import { Mic, Square } from 'lucide-react';

export interface VoiceMicButtonProps {
  onRecordingStart?: () => void;
  onRecordingEnd?: (audioBlob: Blob) => void;
  disabled?: boolean;
  className?: string;
}

export function VoiceMicButton({
  onRecordingStart,
  onRecordingEnd,
  disabled = false,
  className,
}: VoiceMicButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        onRecordingEnd?.(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      onRecordingStart?.();
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <button
      onClick={isRecording ? stopRecording : startRecording}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center rounded-full p-3',
        'transition-all duration-200',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
        isRecording
          ? 'bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-600 animate-pulse'
          : 'bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600',
        className,
      )}
      title={isRecording ? 'Stop recording' : 'Start recording'}
    >
      {isRecording ? <Square size={20} className="text-white" /> : <Mic size={20} className="text-white" />}
    </button>
  );
}
