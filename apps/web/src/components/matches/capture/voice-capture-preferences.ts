const KEY_CONFIRM = 'vs_voice_confirm_before_register';
const KEY_SOUND = 'vs_voice_sound_feedback';
const KEY_VIBRATION = 'vs_voice_vibration_feedback';
const KEY_CONTINUOUS = 'vs_voice_continuous_mode';

export function getVoiceConfirmBeforeRegister(): boolean {
  if (typeof window === 'undefined') return true;
  const raw = window.localStorage.getItem(KEY_CONFIRM);
  if (raw === 'false') return false;
  return true;
}

export function setVoiceConfirmBeforeRegister(value: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY_CONFIRM, value ? 'true' : 'false');
}

export function getVoiceSoundFeedback(): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(KEY_SOUND) !== 'false';
}

export function setVoiceSoundFeedback(value: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY_SOUND, value ? 'true' : 'false');
}

export function getVoiceVibrationFeedback(): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(KEY_VIBRATION) !== 'false';
}

export function setVoiceVibrationFeedback(value: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY_VIBRATION, value ? 'true' : 'false');
}

export function getVoiceContinuousMode(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(KEY_CONTINUOUS) === 'true';
}

export function setVoiceContinuousMode(value: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY_CONTINUOUS, value ? 'true' : 'false');
}
