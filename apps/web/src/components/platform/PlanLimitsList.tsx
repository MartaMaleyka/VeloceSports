import type { PlanDto } from '@velocesport/shared';
import { FeatureList, type FeatureItem } from '@velocesport/design-system';
import { useTranslation } from '@velocesport/i18n';
import { Check, Layers, Trophy, Users } from 'lucide-react';

export function usePlanLimitItems(plan: PlanDto): FeatureItem[] {
  const { t } = useTranslation();

  return [
    {
      icon: <Check className="h-4 w-4" aria-hidden="true" />,
      label: t('platform.plans.limits.players', { count: plan.maxPlayers }),
    },
    {
      icon: <Layers className="h-4 w-4" aria-hidden="true" />,
      label: t('platform.plans.limits.categories', { count: plan.maxCategories }),
    },
    {
      icon: <Users className="h-4 w-4" aria-hidden="true" />,
      label: t('platform.plans.limits.users', { count: plan.maxUsers }),
    },
    {
      icon: <Trophy className="h-4 w-4" aria-hidden="true" />,
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

export function PlanPriceDisplay({
  plan,
  size = 'md',
}: {
  plan: PlanDto;
  size?: 'md' | 'lg';
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-1">
      <span
        className={
          size === 'lg'
            ? 'font-display text-3xl font-bold tabular-nums tracking-tight text-text-primary'
            : 'text-base font-semibold tabular-nums text-text-primary'
        }
      >
        {t('platform.plans.pricing.annualFee', { price: formatUsd(plan.annualFee) })}
      </span>
      <span className="text-sm text-text-secondary">
        {t('platform.plans.pricing.pricePerPlayer', { price: formatUsd(plan.pricePerPlayer) })}
      </span>
    </div>
  );
}
