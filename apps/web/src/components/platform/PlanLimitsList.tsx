import type { PlanDto } from '@velocesport/shared';
import { FeatureList, type FeatureItem } from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';

function UsersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlayersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2l2.4 4.8L20 8l-3.6 3.5.9 5.2L12 14.8 6.7 16.7l.9-5.2L4 8l5.6-1.2L12 2z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CategoriesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function MatchesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function usePlanLimitItems(plan: PlanDto): FeatureItem[] {
  const { t } = useTranslation();

  return [
    {
      icon: <PlayersIcon />,
      label: t('platform.plans.limits.players', { count: plan.maxPlayers }),
    },
    {
      icon: <CategoriesIcon />,
      label: t('platform.plans.limits.categories', { count: plan.maxCategories }),
    },
    {
      icon: <UsersIcon />,
      label: t('platform.plans.limits.users', { count: plan.maxUsers }),
    },
    {
      icon: <MatchesIcon />,
      label: t('platform.plans.limits.matches', { count: plan.maxMatchesPerMonth }),
    },
  ];
}

export function PlanLimitsList({ plan }: { plan: PlanDto }) {
  const items = usePlanLimitItems(plan);
  return <FeatureList items={items} />;
}

function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function PlanPriceDisplay({ plan }: { plan: PlanDto }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-1">
      <span className="text-base font-semibold tabular-nums text-text-primary">
        {t('platform.plans.pricing.annualFee', { price: formatUsd(plan.annualFee) })}
      </span>
      <span className="text-sm text-text-secondary">
        {t('platform.plans.pricing.pricePerPlayer', { price: formatUsd(plan.pricePerPlayer) })}
      </span>
    </div>
  );
}
