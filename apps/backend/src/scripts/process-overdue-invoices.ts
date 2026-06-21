/**
 * Script manual para procesar facturas vencidas.
 * Uso: pnpm --filter @velocesport/backend exec tsx src/scripts/process-overdue-invoices.ts
 *
 * Conectar a cron/tarea programada junto con generación automática futura.
 */
import { invoiceService } from '../services/invoice.service.js';
import { closePool } from '../config/db.js';

async function main(): Promise<void> {
  const result = await invoiceService.processOverdueInvoices(new Date());
  console.log(
    JSON.stringify(
      {
        processedCount: result.processedCount,
        suspendedAcademyIds: result.suspendedAcademyIds,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closePool());
