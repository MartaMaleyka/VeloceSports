import { useEffect, useId, useState } from 'react';
import { I18nProvider, useTranslation, type Locale } from '@velocesport/i18n';
import {
  LANDING_PARENT_FEE_DEFAULT,
  LANDING_PARENT_FEE_MAX,
  LANDING_PARENT_FEE_MIN,
  LANDING_PLAYER_DEFAULT,
  LANDING_PLAYER_MAX,
  LANDING_PLAYER_MIN,
  clampLandingPlayers,
  clampParentFee,
  quoteLanding,
  type LandingPlanId,
} from './landing-quote.js';

function formatUsd(amount: number): string {
  const whole = Number.isInteger(amount);
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `$${formatted}`;
}

function planNameKey(planId: LandingPlanId) {
  switch (planId) {
    case 'family':
      return 'landing.family.title' as const;
    case 'school':
      return 'landing.plans.school.name' as const;
    case 'academy':
      return 'landing.plans.academy.name' as const;
    case 'club':
      return 'landing.plans.club.name' as const;
  }
}

function LandingQuoteForm() {
  const { t } = useTranslation();
  const playersId = useId();
  const feeId = useId();
  const [players, setPlayers] = useState(LANDING_PLAYER_DEFAULT);
  const [parentFee, setParentFee] = useState(LANDING_PARENT_FEE_DEFAULT);
  const quote = quoteLanding(players, parentFee);
  const money = (amount: number) => formatUsd(amount);
  const planName = t(planNameKey(quote.planId));

  useEffect(() => {
    const cards = document.querySelectorAll<HTMLElement>('[data-plan]');
    cards.forEach((card) => {
      card.classList.toggle('is-recommended', card.dataset.plan === quote.planId);
    });
  }, [quote.planId]);

  let detail = t('landing.quote.summary', {
    players: quote.players,
    fee: money(quote.parentFee),
    collected: money(quote.collected),
    software: money(quote.software),
  });
  if (quote.offersFamily) {
    detail = `${detail} ${t('landing.quote.familyNote')}`;
  } else if (quote.renewalsToCover <= 1) {
    detail = `${detail} ${t('landing.quote.oneParent', { fee: money(quote.parentFee) })}`;
  } else if (quote.oneParentAtEightyCovers) {
    detail = `${detail} ${t('landing.quote.eighty')}`;
  } else {
    detail = `${detail} ${t('landing.quote.renewals', {
      count: quote.renewalsToCover,
      fee: money(quote.parentFee),
    })}`;
  }

  return (
    <div className="ds-landing__quote">
      <div className="ds-landing__quote-fields">
        <div className="ds-landing__quote-field">
          <label htmlFor={playersId}>{t('landing.quote.players')}</label>
          <div className="ds-landing__quote-controls">
            <input
              id={playersId}
              type="range"
              min={LANDING_PLAYER_MIN}
              max={LANDING_PLAYER_MAX}
              value={players}
              onChange={(event) => setPlayers(clampLandingPlayers(Number(event.target.value)))}
            />
            <input
              type="number"
              min={LANDING_PLAYER_MIN}
              max={LANDING_PLAYER_MAX}
              inputMode="numeric"
              aria-label={t('landing.quote.players')}
              value={players}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (!Number.isFinite(next)) return;
                setPlayers(Math.min(LANDING_PLAYER_MAX, Math.round(next)));
              }}
              onBlur={() => setPlayers((value) => clampLandingPlayers(value))}
            />
          </div>
        </div>
        <div className="ds-landing__quote-field">
          <label htmlFor={feeId}>{t('landing.quote.fee')}</label>
          <div className="ds-landing__quote-controls">
            <input
              id={feeId}
              type="range"
              min={LANDING_PARENT_FEE_MIN}
              max={LANDING_PARENT_FEE_MAX}
              value={parentFee}
              onChange={(event) => setParentFee(clampParentFee(Number(event.target.value)))}
            />
            <input
              type="number"
              min={LANDING_PARENT_FEE_MIN}
              max={LANDING_PARENT_FEE_MAX}
              inputMode="numeric"
              aria-label={t('landing.quote.fee')}
              value={parentFee}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (!Number.isFinite(next)) return;
                setParentFee(Math.min(LANDING_PARENT_FEE_MAX, Math.round(next)));
              }}
              onBlur={() => setParentFee((value) => clampParentFee(value))}
            />
          </div>
          <p className="ds-landing__quote-hint">{t('landing.quote.feeHint')}</p>
        </div>
      </div>
      <div className="ds-landing__quote-result" aria-live="polite">
        <p className="ds-landing__quote-plan">
          <span>{t('landing.quote.plan')}</span>
          {planName}
        </p>
        <dl>
          <div>
            <dt>{t('landing.quote.collected')}</dt>
            <dd>{money(quote.collected)}</dd>
          </div>
          <div>
            <dt>{t('landing.quote.software')}</dt>
            <dd>{money(quote.software)}</dd>
          </div>
          <div>
            <dt>{t('landing.quote.kept')}</dt>
            <dd>{money(quote.kept)}</dd>
          </div>
        </dl>
        <p>{detail}</p>
      </div>
    </div>
  );
}

export default function LandingQuoteIsland({ initialLocale }: { initialLocale: Locale }) {
  return (
    <I18nProvider initialLocale={initialLocale}>
      <LandingQuoteForm />
    </I18nProvider>
  );
}
