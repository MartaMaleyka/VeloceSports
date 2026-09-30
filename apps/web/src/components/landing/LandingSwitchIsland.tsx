import { useEffect, useId, useState } from 'react';
import { I18nProvider, useTranslation, type Locale } from '@velocesport/i18n';

const GROUPS = {
  pitch: ['academy', 'parent', 'margin'],
  match: ['attendance', 'action', 'parent'],
  start: ['pilot', 'tell', 'choose'],
} as const;

type SwitchGroup = keyof typeof GROUPS;

function labelKey(group: SwitchGroup, id: string) {
  if (group === 'pitch' && id === 'academy') return 'landing.pitch.academy.label' as const;
  if (group === 'pitch' && id === 'parent') return 'landing.pitch.parent.label' as const;
  if (group === 'pitch' && id === 'margin') return 'landing.pitch.margin.label' as const;
  if (group === 'match' && id === 'attendance') return 'landing.match.attendance.label' as const;
  if (group === 'match' && id === 'action') return 'landing.match.action.label' as const;
  if (group === 'match' && id === 'parent') return 'landing.match.parent.label' as const;
  if (group === 'start' && id === 'pilot') return 'landing.start.pilot.label' as const;
  if (group === 'start' && id === 'tell') return 'landing.start.tell.label' as const;
  return 'landing.start.choose.label' as const;
}

function LandingSwitchControls({ group }: { group: SwitchGroup }) {
  const { t } = useTranslation();
  const tabsId = useId();
  const steps = GROUPS[group];
  const [active, setActive] = useState<(typeof steps)[number]>(steps[0]);

  useEffect(() => {
    const root = document.getElementById(`landing-${group}`);
    if (!root) return;
    root.classList.add('is-ready');
    root.querySelectorAll<HTMLElement>('[data-switch-panel]').forEach((panel) => {
      const on = panel.dataset.switchPanel === active;
      panel.classList.toggle('is-active', on);
      panel.hidden = !on;
    });
  }, [active, group]);

  const next = () => {
    const index = steps.indexOf(active);
    const following = steps[(index + 1) % steps.length];
    if (following) setActive(following);
  };

  return (
    <div className="ds-landing__switch-bar">
      <div className="ds-landing__tabs" role="tablist" aria-labelledby={tabsId}>
        {steps.map((id) => {
          const selected = id === active;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`${tabsId}-${id}`}
              aria-selected={selected}
              aria-controls={`${group}-${id}`}
              className="ds-landing__tab"
              onClick={() => setActive(id)}
            >
              {t(labelKey(group, id))}
            </button>
          );
        })}
      </div>
      <button type="button" className="ds-landing__next" onClick={next}>
        {t('landing.pitch.next')}
      </button>
    </div>
  );
}

export default function LandingSwitchIsland({
  group,
  initialLocale,
}: {
  group: SwitchGroup;
  initialLocale: Locale;
}) {
  return (
    <I18nProvider initialLocale={initialLocale}>
      <LandingSwitchControls group={group} />
    </I18nProvider>
  );
}
