import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { PlayerDto } from '@velocesport/shared';
import {
  Alert,
  Badge,
  Button,
  Input,
  Label,
  Skeleton,
  ToastProvider,
  useToast,
} from '@velocesport/design-system';
import { useTranslation, tenantPlayerStatusKey } from '@velocesport/i18n';
import { Camera } from 'lucide-react';
import { PlayerApiError, playerFetch } from '../../lib/player-api';
import { PlayerAvatar } from '../players/PlayerAvatar';
import { PlayerPhotoModal } from '../players/PlayerPhotoModal';

interface ProfileFormState {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  position: string;
}

function toForm(profile: PlayerDto): ProfileFormState {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    dateOfBirth: profile.dateOfBirth ?? '',
    position: profile.position ?? '',
  };
}

function PlayerProfilePageInner() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<PlayerDto | null>(null);
  const [form, setForm] = useState<ProfileFormState>({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    position: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await playerFetch<PlayerDto>('me');
      setProfile(me);
      setForm(toForm(me));
    } catch (e) {
      setError(e instanceof PlayerApiError ? e.message : t('dashboard.player.errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setFormError(null);
    setSubmitting(true);
    try {
      const updated = await playerFetch<PlayerDto>('me', {
        method: 'PATCH',
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          dateOfBirth: form.dateOfBirth || null,
          position: form.position.trim() || null,
        }),
      });
      setProfile(updated);
      setForm(toForm(updated));
      showToast({ variant: 'success', message: t('dashboard.player.profile.successUpdate') });
    } catch (err) {
      setFormError(
        err instanceof PlayerApiError ? err.message : t('dashboard.player.errors.generic'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <Alert variant="error" title={t('dashboard.player.errors.title')}>
        {error ?? t('dashboard.player.errors.generic')}
        <div className="mt-3">
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
            {t('common.retry')}
          </Button>
        </div>
      </Alert>
    );
  }

  return (
    <div className="ds-stagger-enter space-y-6">
      <section
        className="ds-stagger-item flex flex-col gap-5 rounded-xl border border-border bg-bg-surface p-4 sm:flex-row sm:items-start sm:p-6"
        style={{ ['--stagger-index' as string]: 0 }}
      >
        <div className="flex flex-col items-start gap-3">
          <button
            type="button"
            onClick={() => setPhotoOpen(true)}
            className="group relative min-h-touch min-w-touch rounded-full focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]"
            aria-label={t('dashboard.player.profile.changePhoto')}
          >
            <PlayerAvatar
              player={profile}
              size="xl"
              showJersey
              className="ring-2 ring-border ring-offset-2 ring-offset-bg-surface transition-[box-shadow] duration-[var(--motion-duration-fast)] group-hover:ring-section-brand-border"
            />
            <span className="absolute bottom-0 right-0 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-bg-surface text-section-brand-fg shadow-sm">
              <Camera className="h-4 w-4" aria-hidden="true" />
            </span>
          </button>
          <p className="max-w-[14rem] text-xs text-text-muted">
            {t('dashboard.player.profile.photoHint')}
          </p>
          <Button
            type="button"
            variant="secondary"
            className="min-h-touch"
            onClick={() => setPhotoOpen(true)}
          >
            {t('dashboard.player.profile.changePhoto')}
          </Button>
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="space-y-2">
            <h2 className="font-display text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
              {profile.firstName} {profile.lastName}
            </h2>
            <Badge variant="default">{t(tenantPlayerStatusKey(profile.status))}</Badge>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-bg-subtle/60 px-3 py-2.5">
              <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">
                {t('dashboard.player.profile.jersey')}
              </dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums text-text-primary">
                #{profile.jerseyNumber}
              </dd>
              <p className="mt-1 text-[11px] text-text-muted">
                {t('dashboard.player.profile.readOnlyAssigned')}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-bg-subtle/60 px-3 py-2.5">
              <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">
                {t('dashboard.player.profile.category')}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-text-primary">
                {profile.categoryName ?? '—'}
              </dd>
              <p className="mt-1 text-[11px] text-text-muted">
                {t('dashboard.player.profile.readOnlyAssigned')}
              </p>
            </div>
          </dl>
        </div>
      </section>

      <section
        className="ds-stagger-item rounded-xl border border-border bg-bg-surface p-4 sm:p-6"
        style={{ ['--stagger-index' as string]: 1 }}
      >
        <div className="mb-4 space-y-1">
          <h3 className="font-display text-lg font-semibold text-text-primary">
            {t('dashboard.player.profile.editSection')}
          </h3>
          <p className="text-sm text-text-muted">{t('dashboard.player.profile.editHint')}</p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {formError && (
            <Alert variant="error" title={t('dashboard.player.errors.title')}>
              {formError}
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="player-first-name" required>
                {t('dashboard.player.profile.firstName')}
              </Label>
              <Input
                id="player-first-name"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                required
                autoComplete="given-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="player-last-name" required>
                {t('dashboard.player.profile.lastName')}
              </Label>
              <Input
                id="player-last-name"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                required
                autoComplete="family-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="player-dob">{t('dashboard.player.profile.dateOfBirth')}</Label>
              <Input
                id="player-dob"
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="player-position">{t('dashboard.player.profile.position')}</Label>
              <Input
                id="player-position"
                value={form.position}
                onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                maxLength={50}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <Button type="submit" className="min-h-touch" disabled={submitting}>
              {submitting ? t('common.saving') : t('dashboard.player.profile.save')}
            </Button>
          </div>
        </form>
      </section>

      <PlayerPhotoModal
        open={photoOpen}
        onClose={() => setPhotoOpen(false)}
        player={profile}
        audience="self"
        onChanged={(photoUrl: string | null) =>
          setProfile((p) => (p ? { ...p, photoUrl } : p))
        }
      />
    </div>
  );
}

export default function PlayerProfilePage() {
  return (
    <ToastProvider>
      <PlayerProfilePageInner />
    </ToastProvider>
  );
}
