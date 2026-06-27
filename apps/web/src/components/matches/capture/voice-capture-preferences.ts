const STORAGE_KEY = 'vs_voice_confirm_before_register';

export function getVoiceConfirmBeforeRegister(): boolean {
  if (typeof window === 'undefined') return true;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === 'false') return false;
  return true;
}

export function setVoiceConfirmBeforeRegister(value: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
}
