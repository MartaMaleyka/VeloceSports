import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../src/config/db.js';
import { runOverdueInvoicesJob } from '../src/jobs/overdue-invoices.job.js';
import { msUntilNextUtcHour, runExclusive } from '../src/jobs/scheduler.js';
import { getTestSeed } from './helpers.js';

describe('Scheduler', () => {
  it('calcula la próxima ejecución diaria en UTC', () => {
    const now = new Date('2026-03-10T05:30:00.000Z');
    expect(msUntilNextUtcHour(6, now)).toBe(30 * 60 * 1000);
    // Ya pasó hoy → mañana a la misma hora.
    expect(msUntilNextUtcHour(5, now)).toBe(23.5 * 60 * 60 * 1000);
    expect(msUntilNextUtcHour(5, new Date('2026-03-10T05:00:00.000Z'))).toBe(24 * 60 * 60 * 1000);
  });

  it('runExclusive impide ejecuciones simultáneas del mismo job', async () => {
    let release!: () => void;
    const holding = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = runExclusive('squadveloce:test-lock', () => holding);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const second = await runExclusive('squadveloce:test-lock', async () => {
      throw new Error('no debería ejecutarse');
    });
    expect(second).toBe(false);

    release();
    await expect(first).resolves.toBe(true);
    // Liberado: se puede volver a tomar.
    await expect(runExclusive('squadveloce:test-lock', async () => {})).resolves.toBe(true);
  });
});

describe('Job de facturas vencidas', () => {
  it('marca vencidas, suspende la academia y es idempotente', async () => {
    const seed = getTestSeed();
    const pool = getPool();
    const unique = Date.now();
    const [academy] = await pool.execute<ResultSetHeader>(
      'INSERT INTO academies (name, slug, status, plan_id, billing_anchor_day) VALUES (?, ?, ?, ?, ?)',
      [`Academia Job ${unique}`, `job-${unique}`, 'active', seed.planId, 1],
    );
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const [invoice] = await pool.execute<ResultSetHeader>(
      `INSERT INTO invoices
        (tenant_id, plan_id, invoice_type, amount, currency, period_start, period_end, issue_date, due_date, status)
       VALUES (?, ?, 'monthly', 29, 'USD', '2025-01-01', '2025-01-31', '2025-01-01', ?, 'pending')`,
      [academy.insertId, seed.planId, yesterday.toISOString().slice(0, 10)],
    );

    await runOverdueInvoicesJob();
    await runOverdueInvoicesJob();

    const [inv] = await pool.execute<RowDataPacket[]>('SELECT status FROM invoices WHERE id = ?', [
      invoice.insertId,
    ]);
    const [acad] = await pool.execute<RowDataPacket[]>(
      'SELECT status, suspension_reason FROM academies WHERE id = ?',
      [academy.insertId],
    );
    expect(inv[0]?.status).toBe('overdue');
    expect(acad[0]?.status).toBe('suspended');
    expect(acad[0]?.suspension_reason).toBe('billing');
  });
});
