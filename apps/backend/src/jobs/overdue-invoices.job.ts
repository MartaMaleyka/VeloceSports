import { env } from '../config/env.js';
import { billingDunningService } from '../services/billing-dunning.service.js';
import { runExclusive, scheduleDailyUtc } from './scheduler.js';

const LOCK_NAME = 'squadveloce:job:overdue-invoices';

/**
 * Avisa de las facturas recién vencidas y suspende las academias cuyo periodo de
 * gracia terminó sin pago (idempotente: cada factura se avisa una sola vez).
 */
export async function runOverdueInvoicesJob(now: Date = new Date()): Promise<void> {
  const ran = await runExclusive(LOCK_NAME, async () => {
    const result = await billingDunningService.run(now);
    console.log(
      `[jobs] Facturas avisadas: ${result.warnedInvoiceIds.length}; ` +
        `academias suspendidas: ${result.suspendedAcademyIds.join(', ') || 'ninguna'}`,
    );
  });
  if (!ran) console.log('[jobs] Facturas vencidas: otra instancia ya lo está ejecutando');
}

/**
 * Opt-in (BILLING_OVERDUE_JOB_ENABLED): suspende academias automáticamente, así que
 * se activa solo cuando el negocio lo decide. Devuelve la función para detenerlo.
 */
export function startOverdueInvoicesJob(): (() => void) | null {
  if (!env.BILLING_OVERDUE_JOB_ENABLED) return null;
  console.log(
    `[jobs] Facturas vencidas: diario a las ${env.BILLING_OVERDUE_JOB_HOUR_UTC}:00 UTC, ` +
      `${env.BILLING_OVERDUE_GRACE_DAYS} días de gracia tras el aviso`,
  );
  return scheduleDailyUtc(env.BILLING_OVERDUE_JOB_HOUR_UTC, () => {
    runOverdueInvoicesJob().catch((error) =>
      console.error('[jobs] Error procesando facturas vencidas:', error),
    );
  });
}
