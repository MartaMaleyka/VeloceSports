import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { describeIfDatabaseAvailable } from './helpers.js';
import { getPool } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { setMailSenderForTests, type OutgoingMail } from '../src/lib/mailer.js';
import { runOverdueInvoicesJob } from '../src/jobs/overdue-invoices.job.js';
import { msUntilNextUtcHour, runExclusive } from '../src/jobs/scheduler.js';
import { getTestSeed } from './helpers.js';

describeIfDatabaseAvailable('Scheduler', () => {
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

describeIfDatabaseAvailable('Job de facturas vencidas: aviso y periodo de gracia', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const outbox: OutgoingMail[] = [];

  beforeAll(() => {
    setMailSenderForTests({ send: async (mail) => void outbox.push(mail) });
  });
  afterAll(() => setMailSenderForTests(null));
  beforeEach(() => {
    outbox.length = 0;
  });

  async function createOverdueAcademy(): Promise<{ academyId: number; invoiceId: number }> {
    const seed = getTestSeed();
    const pool = getPool();
    const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const [academy] = await pool.execute<ResultSetHeader>(
      `INSERT INTO academies (name, slug, status, plan_id, billing_anchor_day, contact_email, locale)
       VALUES (?, ?, 'active', ?, 1, ?, 'es-PA')`,
      [`Academia Mora ${unique}`, `mora-${unique}`, seed.planId, `Contacto-${unique}@test.com`],
    );
    const [admin] = await pool.execute<ResultSetHeader>(
      `INSERT INTO users (email, password_hash, role, tenant_id, status) VALUES (?, 'x', 'academy_admin', ?, 'active')`,
      [`admin-mora-${unique}@test.com`, academy.insertId],
    );
    await pool.execute(
      "INSERT INTO user_roles (user_id, role, tenant_id) VALUES (?, 'academy_admin', ?)",
      [admin.insertId, academy.insertId],
    );
    const yesterday = new Date(Date.now() - DAY).toISOString().slice(0, 10);
    const [invoice] = await pool.execute<ResultSetHeader>(
      `INSERT INTO invoices
        (tenant_id, plan_id, invoice_type, amount, currency, period_start, period_end, issue_date, due_date, status)
       VALUES (?, ?, 'monthly', 29, 'USD', '2025-01-01', '2025-01-31', '2025-01-01', ?, 'pending')`,
      [academy.insertId, seed.planId, yesterday],
    );
    return { academyId: academy.insertId, invoiceId: invoice.insertId };
  }

  async function state(academyId: number, invoiceId: number) {
    const pool = getPool();
    const [inv] = await pool.execute<RowDataPacket[]>(
      'SELECT status, overdue_warning_sent_at, suspension_scheduled_for FROM invoices WHERE id = ?',
      [invoiceId],
    );
    const [acad] = await pool.execute<RowDataPacket[]>(
      'SELECT status, suspension_reason FROM academies WHERE id = ?',
      [academyId],
    );
    return { invoice: inv[0]!, academy: acad[0]! };
  }

  it('primero avisa (sin suspender) y solo una vez', async () => {
    const { academyId, invoiceId } = await createOverdueAcademy();
    const now = new Date();

    await runOverdueInvoicesJob(now);
    const after = await state(academyId, invoiceId);
    expect(after.invoice.status).toBe('overdue');
    expect(after.academy.status).toBe('active');
    const scheduled = new Date(after.invoice.suspension_scheduled_for).getTime();
    expect(Math.abs(scheduled - (now.getTime() + env.BILLING_OVERDUE_GRACE_DAYS * DAY))).toBeLessThan(2000);

    // Admin + contacto de la academia, en el idioma de la academia.
    const recipients = outbox.map((m) => m.to).sort();
    expect(recipients).toHaveLength(2);
    expect(recipients.some((to) => to.startsWith('admin-mora-'))).toBe(true);
    expect(recipients.some((to) => to.startsWith('contacto-'))).toBe(true);
    expect(outbox[0]!.subject).toMatch(/^Factura vencida/);

    await runOverdueInvoicesJob(new Date(now.getTime() + DAY));
    expect(outbox).toHaveLength(2);
    expect((await state(academyId, invoiceId)).academy.status).toBe('active');
  });

  it('suspende solo cuando termina el periodo de gracia', async () => {
    const { academyId, invoiceId } = await createOverdueAcademy();
    const now = new Date();
    await runOverdueInvoicesJob(now);

    await runOverdueInvoicesJob(new Date(now.getTime() + (env.BILLING_OVERDUE_GRACE_DAYS - 1) * DAY));
    expect((await state(academyId, invoiceId)).academy.status).toBe('active');

    await runOverdueInvoicesJob(new Date(now.getTime() + (env.BILLING_OVERDUE_GRACE_DAYS + 1) * DAY));
    const after = await state(academyId, invoiceId);
    expect(after.academy.status).toBe('suspended');
    expect(after.academy.suspension_reason).toBe('billing');
    expect(after.invoice.suspension_scheduled_for).toBeNull();
  });

  it('pagar durante el periodo de gracia evita la suspensión', async () => {
    const { academyId, invoiceId } = await createOverdueAcademy();
    const now = new Date();
    await runOverdueInvoicesJob(now);
    await getPool().execute("UPDATE invoices SET status = 'paid', paid_at = NOW() WHERE id = ?", [
      invoiceId,
    ]);

    await runOverdueInvoicesJob(new Date(now.getTime() + (env.BILLING_OVERDUE_GRACE_DAYS + 1) * DAY));
    expect((await state(academyId, invoiceId)).academy.status).toBe('active');
  });

  it('una reactivación manual con deuda no se vuelve a suspender cada día', async () => {
    const { academyId, invoiceId } = await createOverdueAcademy();
    const now = new Date();
    const later = (days: number) => new Date(now.getTime() + days * DAY);
    await runOverdueInvoicesJob(now);
    await runOverdueInvoicesJob(later(env.BILLING_OVERDUE_GRACE_DAYS + 1));
    expect((await state(academyId, invoiceId)).academy.status).toBe('suspended');

    await getPool().execute(
      "UPDATE academies SET status = 'active', suspension_reason = NULL WHERE id = ?",
      [academyId],
    );
    await runOverdueInvoicesJob(later(env.BILLING_OVERDUE_GRACE_DAYS + 2));
    expect((await state(academyId, invoiceId)).academy.status).toBe('active');
  });
});
