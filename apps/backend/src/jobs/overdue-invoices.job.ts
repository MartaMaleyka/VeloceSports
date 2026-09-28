import { env } from '../config/env.js';
import { invoiceService } from '../services/invoice.service.js';
import { runExclusive, scheduleDailyUtc } from './scheduler.js';

const LOCK_NAME = 'squadveloce:job:overdue-invoices';

/** Marca facturas vencidas y suspende las academias afectadas (idempotente). */
export async function runOverdueInvoicesJob(asOf: Date = new Date()): Promise<void> {
  const ran = await runExclusive(LOCK_NAME, async () => {
    const result = await invoiceService.processOverdueInvoices(asOf);
    console.log(
      `[jobs] Facturas vencidas procesadas: ${result.processedCount}; ` +
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
  console.log(`[jobs] Facturas vencidas: diario a las ${env.BILLING_OVERDUE_JOB_HOUR_UTC}:00 UTC`);
  return scheduleDailyUtc(env.BILLING_OVERDUE_JOB_HOUR_UTC, () => {
    runOverdueInvoicesJob().catch((error) =>
      console.error('[jobs] Error procesando facturas vencidas:', error),
    );
  });
}
