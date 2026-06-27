import { useEffect, useRef, useState } from 'react';
import { LogOut } from 'lucide-react';
import type { UserProfileDto } from '@velocesport/shared';
import { useTranslation } from '@velocesport/i18n';
import { cn, ToastProvider } from '@velocesport/design-system';
import UserProfilePopover from '../profile/UserProfilePopover';
import { fetchMyProfile } from '../../lib/profile-api';
import { appPath } from '../../lib/app-path';

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

export default function UserSessionActions() {
  const { t } = useTranslation();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfileDto | null>(null);

  useEffect(() => {
    void fetchMyProfile()
      .then(setProfile)
      .catch(() => {
        /* sidebar sigue usable sin nombre */
      });
  }, []);

  const displayName = profile ? getDisplayName(profile) : t('profile.menuLabel');
  const initials = profile ? getInitials(profile) : '…';

  return (
    <ToastProvider>
      <div className="relative flex items-center gap-2">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setProfileOpen(true)}
          aria-expanded={profileOpen}
          aria-haspopup="dialog"
          aria-label={t('profile.menuLabel')}
          title={displayName}
          className={cn(
            'flex min-h-touch min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left text-sm',
            'text-text-secondary transition-[background-color,color] duration-normal',
            'hover:bg-bg-muted hover:text-text-primary focus-visible:shadow-[var(--shadow-focus-ring)]',
            profileOpen && 'bg-bg-muted text-text-primary',
          )}
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-xs font-semibold text-text-on-primary"
            aria-hidden="true"
          >
            {initials}
          </span>
          <span className="truncate font-medium">{displayName}</span>
        </button>

        <form method="POST" action={appPath('/api/auth/logout')} className="shrink-0">
          <button
            type="submit"
            title={t('profile.logoutLabel')}
            aria-label={t('profile.logoutLabel')}
            className={cn(
              'inline-flex min-h-touch min-w-touch items-center justify-center rounded-md',
              'text-text-secondary transition-[background-color,color] duration-normal',
              'hover:bg-bg-muted hover:text-text-primary focus-visible:shadow-[var(--shadow-focus-ring)]',
            )}
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
          </button>
        </form>

        <UserProfilePopover
          open={profileOpen}
          onClose={() => {
            setProfileOpen(false);
            void fetchMyProfile()
              .then(setProfile)
              .catch(() => undefined);
          }}
          anchorRef={triggerRef}
        />
      </div>
    </ToastProvider>
  );
}
