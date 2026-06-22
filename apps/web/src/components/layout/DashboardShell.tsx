import { Suspense, useState, type ReactNode } from 'react';
import type { LoginRole } from '@velocesport/shared';
import { I18nProvider, useTranslation, type Locale, type TranslationKey } from '@velocesport/i18n';
import Sidebar from './Sidebar';
import ModuleHeader from './ModuleHeader';
import PreferenceToggles from './PreferenceToggles';
import { Alert, sectionAccentFromNavId, type SectionAccentId } from '@velocesport/design-system';
import {
  getDashboardTranslationPrefix,
  getSessionSubtitle,
  type DashboardContentKey,
} from '../../lib/navigation';
import { resolvePlatformPage, type PlatformPageId } from '../../lib/platform-pages';
import { resolveAcademyPage, type AcademyPageId } from '../../lib/academy-pages';
import { resolveCoachPage, type CoachPageId } from '../../lib/coach-pages';
import { resolveParentPage, type ParentPageId } from '../../lib/parent-pages';
import type { ComponentType } from 'react';

function resolveDashboardPage(
  contentKey: DashboardContentKey,
  pageId: string | undefined,
): ComponentType<Record<string, unknown>> | null {
  if (!pageId) return null;

  switch (contentKey) {
    case 'superAdmin':
      return resolvePlatformPage(pageId as PlatformPageId);
    case 'academyAdmin':
      return resolveAcademyPage(pageId as AcademyPageId);
    case 'coach':
      return resolveCoachPage(pageId as CoachPageId);
    case 'parent':
      return resolveParentPage(pageId as ParentPageId);
    default:
      return null;
  }
}

interface DashboardShellInnerProps {
  roles: LoginRole[];
  primaryRole: LoginRole;
  activeNavId: string;
  contentKey: DashboardContentKey;
  children?: ReactNode;
  pageId?: PlatformPageId | AcademyPageId | CoachPageId | ParentPageId;
  pageProps?: Record<string, unknown>;
  pageTitle?: string;
  pageDescription?: string;
  hideWelcome?: boolean;
  headerSectionAccent?: SectionAccentId;
}

function DashboardShellInner({
  roles,
  primaryRole,
  activeNavId,
  contentKey,
  children,
  pageId,
  pageProps,
  pageTitle,
  pageDescription,
  hideWelcome = false,
  headerSectionAccent,
}: DashboardShellInnerProps) {
  const { t, locale } = useTranslation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const Page = resolveDashboardPage(contentKey, pageId);

  const prefix = getDashboardTranslationPrefix(contentKey);
  const roleLabel = getSessionSubtitle(roles, locale);
  const defaultTitle =
    roles.length > 1
      ? t(`${prefix}.greetingMulti` as TranslationKey, { roles: roleLabel })
      : t(`${prefix}.greeting` as TranslationKey, { role: roleLabel });
  const defaultDescription = t(`${prefix}.description` as TranslationKey);
  const welcome = t(`${prefix}.welcome` as TranslationKey);
  const title = pageTitle ?? defaultTitle;
  const description = pageDescription ?? defaultDescription;
  const sectionAccent = headerSectionAccent ?? sectionAccentFromNavId(activeNavId);

  return (
    <div className="flex min-h-screen bg-bg-app">
      <div className="hidden w-64 shrink-0 md:block">
        <Sidebar roles={roles} primaryRole={primaryRole} activeNavId={activeNavId} />
      </div>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-text-primary/40"
            aria-label={t('a11y.closeNav')}
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-64 bg-bg-surface shadow-md">
            <Sidebar roles={roles} primaryRole={primaryRole} activeNavId={activeNavId} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-bg-surface px-4 py-3 md:hidden">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-md border border-border text-text-primary focus-visible:shadow-[var(--shadow-focus-ring)]"
              aria-label={t('a11y.openNav')}
              aria-expanded={mobileNavOpen}
            >
              <span aria-hidden="true">☰</span>
            </button>
            <span className="text-sm font-medium text-text-primary">{t('common.appName')}</span>
          </div>
          <PreferenceToggles />
        </div>

        <ModuleHeader
          title={title}
          description={description}
          sectionAccent={sectionAccent}
          actions={
            <div className="hidden md:block">
              <PreferenceToggles />
            </div>
          }
        />

        <main className="flex-1 p-4 sm:p-8" id="main-content">
          {!hideWelcome && (
            <div className="ds-brand-card mb-6 p-6">
              <p className="text-base text-text-secondary">{welcome}</p>
            </div>
          )}
          {Page ? (
            <Suspense fallback={<p className="text-text-secondary">{t('common.loading')}</p>}>
              <Page {...pageProps} />
            </Suspense>
          ) : pageId ? (
            <Alert variant="error" title={t('reportCard.errors.title')}>
              {t('reportCard.errors.notFound')}
            </Alert>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

export interface DashboardShellProps {
  initialLocale: Locale;
  role: LoginRole;
  roles?: LoginRole[];
  activeNavId: string;
  contentKey: DashboardContentKey;
  children?: ReactNode;
  pageId?: PlatformPageId | AcademyPageId | CoachPageId | ParentPageId;
  pageProps?: Record<string, unknown>;
  pageTitle?: string;
  pageDescription?: string;
  hideWelcome?: boolean;
  headerSectionAccent?: SectionAccentId;
}

export default function DashboardShell({
  initialLocale,
  role,
  roles,
  activeNavId,
  contentKey,
  children,
  pageId,
  pageProps,
  pageTitle,
  pageDescription,
  hideWelcome,
  headerSectionAccent,
}: DashboardShellProps) {
  const sessionRoles = roles ?? [role];
  return (
    <I18nProvider initialLocale={initialLocale}>
      <DashboardShellInner
        roles={sessionRoles}
        primaryRole={role}
        activeNavId={activeNavId}
        contentKey={contentKey}
        pageId={pageId}
        pageProps={pageProps}
        pageTitle={pageTitle}
        pageDescription={pageDescription}
        hideWelcome={hideWelcome}
        headerSectionAccent={headerSectionAccent}
      >
        {children}
      </DashboardShellInner>
    </I18nProvider>
  );
}
