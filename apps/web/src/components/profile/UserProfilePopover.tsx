import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LoginRole, UserProfileDto } from '@velocesport/shared';
import { isStrongPassword } from '@velocesport/shared';
import { useTranslation, type TranslationKey } from '@velocesport/i18n';
import {
  Alert,
  Button,
  Input,
  Label,
  PasswordInput,
  cn,
  useToast,
} from '@velocesport/design-system';
import {
  changeMyPassword,
  fetchMyProfile,
  ProfileApiError,
  updateMyProfile,
} from '../../lib/profile-api';

interface UserProfilePopoverProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

function getInitials(profile: UserProfileDto): string {
  const f = profile.firstName?.trim();
  const l = profile.lastName?.trim();
  if (f && l) return `${f[0] ?? ''}${l[0] ?? ''}`.toUpperCase();
  if (f) return f.slice(0, 2).toUpperCase();
  return profile.email.slice(0, 2).toUpperCase();
}

function getDisplayName(profile: UserProfileDto): string {
  const parts = [profile.firstName, profile.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : profile.email;
}

function roleLabelKey(role: LoginRole): TranslationKey {
  return `roles.${role}` as TranslationKey;
}

const DESKTOP_MIN_WIDTH = 768;
const PANEL_WIDTH = 352;

interface PanelPlacement {
  mode: 'sheet' | 'popover';
  left?: number;
  bottom?: number;
  width?: number;
}

function computePlacement(anchor: HTMLElement): PanelPlacement {
  if (window.innerWidth < DESKTOP_MIN_WIDTH) {
    return { mode: 'sheet' };
  }
  const rect = anchor.getBoundingClientRect();
  const width = Math.min(PANEL_WIDTH, window.innerWidth - 32);
  let left = rect.left;
  if (left + width > window.innerWidth - 16) {
    left = window.innerWidth - width - 16;
  }
  return {
    mode: 'popover',
    left: Math.max(16, left),
    bottom: window.innerHeight - rect.top + 8,
    width,
  };
}

export default function UserProfilePopover({ open, onClose, anchorRef }: UserProfilePopoverProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [emailDirty, setEmailDirty] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);
  const [placement, setPlacement] = useState<PanelPlacement>({ mode: 'sheet' });

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setProfileError(null);
    try {
      const data = await fetchMyProfile();
      setProfile(data);
      setFirstName(data.firstName ?? '');
      setLastName(data.lastName ?? '');
      setEmail(data.email);
      setEmailDirty(false);
    } catch (err) {
      setProfileError(
        err instanceof ProfileApiError ? err.message : t('profile.errors.generic'),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useLayoutEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    if (!anchor) return;

    const update = () => setPlacement(computePlacement(anchor));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [open, anchorRef]);

  useEffect(() => {
    if (open) {
      void loadProfile();
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setRevokeOtherSessions(false);
      setPasswordError(null);
    }
  }, [open, loadProfile]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onCloseRef.current();
    };
    const timer = window.setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [open, anchorRef]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open, profile]);

  if (!open) return null;

  const displayName = profile ? getDisplayName(profile) : '';
  const passwordMismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword;
  const passwordWeak = newPassword.length > 0 && !isStrongPassword(newPassword);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSavingProfile(true);
    setProfileError(null);
    try {
      const payload: { firstName?: string; lastName?: string; email?: string } = {};
      if (firstName.trim() !== (profile.firstName ?? '')) payload.firstName = firstName.trim();
      if (lastName.trim() !== (profile.lastName ?? '')) payload.lastName = lastName.trim();
      if (email.trim().toLowerCase() !== profile.email) payload.email = email.trim();

      if (Object.keys(payload).length === 0) {
        onClose();
        return;
      }

      const updated = await updateMyProfile(payload);
      setProfile(updated);
      setEmailDirty(false);
      showToast({ variant: 'success', message: t('profile.profileSaved') });
    } catch (err) {
      const message =
        err instanceof ProfileApiError && err.status === 409
          ? t('profile.errors.emailTaken')
          : err instanceof ProfileApiError
            ? err.message
            : t('profile.errors.generic');
      setProfileError(message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword !== confirmPassword) {
      setPasswordError(t('profile.passwordMismatch'));
      return;
    }
    if (!isStrongPassword(newPassword)) {
      setPasswordError(t('profile.passwordWeak'));
      return;
    }

    setSavingPassword(true);
    try {
      await changeMyPassword({
        currentPassword,
        newPassword,
        revokeOtherSessions,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setRevokeOtherSessions(false);
      showToast({ variant: 'success', message: t('profile.passwordChanged') });
    } catch (err) {
      const message =
        err instanceof ProfileApiError && err.status === 401
          ? t('profile.errors.wrongPassword')
          : err instanceof ProfileApiError
            ? err.message
            : t('profile.errors.generic');
      setPasswordError(message);
    } finally {
      setSavingPassword(false);
    }
  }

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[100] flex p-3',
        placement.mode === 'sheet' ? 'items-end justify-center' : 'pointer-events-none',
      )}
    >
      <button
        type="button"
        className={cn(
          'absolute inset-0 bg-text-primary/30',
          placement.mode === 'popover' && 'pointer-events-auto',
        )}
        aria-label={t('common.close')}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${panelId}-title`}
        tabIndex={-1}
        style={
          placement.mode === 'popover'
            ? {
                position: 'fixed',
                left: placement.left,
                bottom: placement.bottom,
                width: placement.width,
              }
            : undefined
        }
        className={cn(
          'relative z-10 flex max-h-[min(90vh,640px)] flex-col overflow-hidden',
          'border border-border bg-bg-surface shadow-lg pointer-events-auto',
          placement.mode === 'sheet'
            ? 'w-full max-w-md rounded-t-xl'
            : 'max-h-[min(80vh,560px)] rounded-xl',
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {profile && (
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-sm font-semibold text-text-on-primary"
                aria-hidden="true"
              >
                {getInitials(profile)}
              </div>
            )}
            <div className="min-w-0">
              <h2 id={`${panelId}-title`} className="truncate text-base font-semibold text-text-primary">
                {t('profile.title')}
              </h2>
              {profile && (
                <p className="truncate text-sm text-text-secondary">{displayName}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-touch min-w-touch shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-bg-muted hover:text-text-primary focus-visible:shadow-[var(--shadow-focus-ring)]"
            aria-label={t('common.close')}
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading && (
            <p className="text-sm text-text-secondary">{t('common.loading')}</p>
          )}

          {profileError && !loading && (
            <Alert variant="error" title={t('profile.errors.title')} className="mb-4">
              {profileError}
            </Alert>
          )}

          {profile && !loading && (
            <>
              <dl className="mb-4 space-y-2 text-sm">
                <div>
                  <dt className="text-text-secondary">{t('profile.fields.roles')}</dt>
                  <dd className="font-medium text-text-primary">
                    {profile.roles.map((r) => t(roleLabelKey(r))).join(' · ')}
                  </dd>
                </div>
                {profile.academyName && (
                  <div>
                    <dt className="text-text-secondary">{t('profile.fields.academy')}</dt>
                    <dd className="font-medium text-text-primary">{profile.academyName}</dd>
                  </div>
                )}
              </dl>

              <form onSubmit={handleSaveProfile} className="space-y-3 border-b border-border pb-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={`${panelId}-firstName`}>{t('profile.fields.firstName')}</Label>
                    <Input
                      id={`${panelId}-firstName`}
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      autoComplete="given-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`${panelId}-lastName`}>{t('profile.fields.lastName')}</Label>
                    <Input
                      id={`${panelId}-lastName`}
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      autoComplete="family-name"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor={`${panelId}-email`}>{t('profile.fields.email')}</Label>
                  <Input
                    id={`${panelId}-email`}
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setEmailDirty(e.target.value.trim().toLowerCase() !== profile.email);
                    }}
                    autoComplete="email"
                  />
                  {emailDirty && (
                    <p className="mt-1 text-xs text-text-secondary">{t('profile.emailChangeHint')}</p>
                  )}
                </div>
                <Button type="submit" variant="primary" disabled={savingProfile} className="w-full">
                  {savingProfile ? t('common.loading') : t('profile.saveProfile')}
                </Button>
              </form>

              <form onSubmit={handleChangePassword} className="mt-4 space-y-3">
                <h3 className="text-sm font-semibold text-text-primary">
                  {t('profile.passwordSection')}
                </h3>

                {passwordError && (
                  <Alert variant="error" title={t('profile.errors.title')}>
                    {passwordError}
                  </Alert>
                )}

                <div>
                  <Label htmlFor={`${panelId}-current-pw`}>{t('profile.currentPassword')}</Label>
                  <PasswordInput
                    id={`${panelId}-current-pw`}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor={`${panelId}-new-pw`}>{t('profile.newPassword')}</Label>
                  <PasswordInput
                    id={`${panelId}-new-pw`}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    hasError={passwordWeak}
                    required
                  />
                  {passwordWeak && (
                    <p className="mt-1 text-xs text-status-danger">{t('profile.passwordWeak')}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor={`${panelId}-confirm-pw`}>{t('profile.confirmPassword')}</Label>
                  <PasswordInput
                    id={`${panelId}-confirm-pw`}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    hasError={passwordMismatch}
                    required
                  />
                  {passwordMismatch && (
                    <p className="mt-1 text-xs text-status-danger">{t('profile.passwordMismatch')}</p>
                  )}
                </div>
                <label className="flex cursor-pointer items-start gap-2 text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    checked={revokeOtherSessions}
                    onChange={(e) => setRevokeOtherSessions(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-border text-brand-primary focus-visible:shadow-[var(--shadow-focus-ring)]"
                  />
                  <span>
                    {t('profile.revokeOtherSessions')}
                    <span className="mt-0.5 block text-xs text-text-muted">
                      {t('profile.revokeOtherSessionsHint')}
                    </span>
                  </span>
                </label>
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={savingPassword}
                  className="w-full"
                >
                  {savingPassword ? t('common.loading') : t('profile.changePassword')}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
