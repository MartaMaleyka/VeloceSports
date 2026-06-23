import { useCallback, useEffect, useRef, useState } from 'react';
import type { ParentNotificationDto } from '@velocesport/shared';
import { Button, cn } from '@velocesport/design-system';
import { useTranslation, type TranslationKey } from '@velocesport/i18n';
import {
  fetchParentNotifications,
  fetchParentUnreadCount,
  markAllParentNotificationsRead,
  markParentNotificationRead,
} from '../../lib/parent-notifications-api';
import { ParentApiError } from '../../lib/parent-api';

function formatNotificationText(
  item: ParentNotificationDto,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
): { title: string; body: string } {
  if (item.payload?.messageKey) {
    const params = Object.fromEntries(
      Object.entries(item.payload.params).map(([k, v]) => [k, String(v)]),
    ) as Record<string, string>;
    return {
      title: t(`${item.payload.messageKey}.title` as TranslationKey, params),
      body: t(`${item.payload.messageKey}.body` as TranslationKey, params),
    };
  }
  return { title: item.title, body: item.body };
}

export default function ParentNotificationBell() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<ParentNotificationDto[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(async () => {
    try {
      const count = await fetchParentUnreadCount();
      setUnreadCount(count);
    } catch {
      /* silencioso en polling */
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchParentNotifications(15, 0);
      setItems(data.items);
      setUnreadCount(data.unreadCount);
    } catch (e) {
      if (e instanceof ParentApiError) {
        setItems([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCount();
    const interval = window.setInterval(() => void refreshCount(), 60_000);
    return () => window.clearInterval(interval);
  }, [refreshCount]);

  useEffect(() => {
    if (!open) return;
    void loadList();
  }, [open, loadList]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const handleOpen = () => {
    setOpen((prev) => !prev);
  };

  const handleMarkRead = async (item: ParentNotificationDto) => {
    if (item.readAt) return;
    try {
      await markParentNotificationRead(item.id);
      setItems((prev) =>
        prev.map((n) =>
          n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n,
        ),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      /* ignore */
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllParentNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
      setUnreadCount(0);
    } catch {
      /* ignore */
    }
  };

  const reportPath = (item: ParentNotificationDto) =>
    `/dashboard/parent/children/${item.playerId}/matches/${item.matchId}`;

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        className="relative inline-flex min-h-touch min-w-touch items-center justify-center rounded-md border border-border bg-bg-surface text-text-primary focus-visible:shadow-[var(--shadow-focus-ring)]"
        aria-label={
          unreadCount > 0
            ? t('parentNotifications.bellLabel', { count: unreadCount })
            : t('parentNotifications.bellLabelNone')
        }
        aria-expanded={open}
        onClick={handleOpen}
      >
        <span aria-hidden="true">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-feedback-error px-1 text-xs font-bold text-text-on-primary">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-lg border border-border bg-bg-surface shadow-lg"
          role="dialog"
          aria-label={t('parentNotifications.panelTitle')}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-text-primary">
              {t('parentNotifications.panelTitle')}
            </h2>
            {unreadCount > 0 && (
              <Button type="button" variant="ghost" onClick={() => void handleMarkAll()}>
                {t('parentNotifications.markAllRead')}
              </Button>
            )}
          </div>

          <div className="max-h-[min(70vh,24rem)] overflow-y-auto">
            {loading && (
              <p className="px-4 py-6 text-sm text-text-muted">{t('common.loading')}</p>
            )}
            {!loading && items.length === 0 && (
              <p className="px-4 py-6 text-sm text-text-secondary">
                {t('parentNotifications.empty')}
              </p>
            )}
            {!loading &&
              items.map((item) => {
                const text = formatNotificationText(item, t);
                const isUnread = !item.readAt;
                const isVoided = Boolean(item.voidedAt);
                return (
                  <article
                    key={item.id}
                    className={cn(
                      'border-b border-border px-4 py-3 text-sm',
                      isUnread && 'bg-section-audit-subtle/30',
                      isVoided && 'opacity-70',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'font-semibold text-text-primary',
                            isVoided && 'line-through',
                          )}
                        >
                          {text.title}
                        </p>
                        <p className="mt-1 text-text-secondary">{text.body}</p>
                        {isVoided && (
                          <p className="mt-1 text-xs text-feedback-warning-fg">
                            {t('parentNotifications.voidedHint')}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-text-muted">
                          {item.playerFirstName} {item.playerLastName}
                        </p>
                      </div>
                      {isUnread && (
                        <span
                          className="mt-1 h-2 w-2 shrink-0 rounded-full bg-section-matches-fg"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          void handleMarkRead(item);
                          window.location.href = reportPath(item);
                        }}
                      >
                        {t('parentNotifications.viewMatch')}
                      </Button>
                      {isUnread && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => void handleMarkRead(item)}
                        >
                          {t('parentNotifications.markRead')}
                        </Button>
                      )}
                    </div>
                  </article>
                );
              })}
          </div>

          <div className="border-t border-border px-4 py-2">
            <a
              href="/dashboard/parent/notifications"
              className="text-sm font-medium text-section-audit-fg hover:underline"
            >
              {t('parentNotifications.managePreferences')}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
