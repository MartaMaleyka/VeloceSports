import {
  AcademyStatus,
  AcademySuspensionReason,
} from '@velocesport/shared';
import { env } from '../config/env.js';
import { getMailSender, type OutgoingMail } from '../lib/mailer.js';
import { academyRepository } from '../repositories/academy.repository.js';
import { invoiceRepository, type InvoiceRow } from '../repositories/invoice.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { userSessionService } from './user-session.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

type Locale = 'es' | 'en';

export interface DunningRunResult {
  warnedInvoiceIds: number[];
  suspendedAcademyIds: number[];
}

function toLocale(academyLocale: string | null | undefined): Locale {
  return academyLocale?.toLowerCase().startsWith('en') ? 'en' : 'es';
}

function formatDate(value: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(value);
}

function formatAmount(row: InvoiceRow, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es', {
    style: 'currency',
    currency: row.currency,
  }).format(Number(row.amount));
}

function dueDateOf(row: InvoiceRow): Date {
  const raw = row.due_date as Date | string;
  return typeof raw === 'string' ? new Date(`${raw.slice(0, 10)}T00:00:00Z`) : raw;
}

export function buildOverdueWarningEmail(
  to: string,
  row: InvoiceRow,
  suspensionDate: Date,
  locale: Locale,
): OutgoingMail {
  const amount = formatAmount(row, locale);
  const due = formatDate(dueDateOf(row), locale);
  const suspension = formatDate(suspensionDate, locale);
  const academy = row.academy_name ?? '';
  const [subject, body] =
    locale === 'en'
      ? [
          `Overdue invoice — ${academy}`,
          `The invoice for ${amount} that was due on ${due} has not been paid yet.\n\n` +
            `If the payment is not registered by ${suspension}, the SquadVeloce account for ${academy} ` +
            `will be suspended and its users will not be able to sign in.\n\n` +
            `If you already paid, please send the receipt to SquadVeloce support.`,
        ]
      : [
          `Factura vencida — ${academy}`,
          `La factura por ${amount} con vencimiento el ${due} aún no está pagada.\n\n` +
            `Si el pago no se registra antes del ${suspension}, la cuenta de ${academy} en SquadVeloce ` +
            `se suspenderá y sus usuarios no podrán iniciar sesión.\n\n` +
            `Si ya pagaste, envía el comprobante al soporte de SquadVeloce.`,
        ];
  const html = body
    .split('\n\n')
    .map((p) => `<p>${p.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)}</p>`)
    .join('\n');
  return { to, subject, text: `${body}\n`, html };
}

/**
 * Cobro de facturas vencidas en dos pasos:
 * 1. Aviso: la factura pendiente vencida pasa a `overdue`, se registra el aviso,
 *    se fija la fecha de suspensión (hoy + BILLING_OVERDUE_GRACE_DAYS) y se avisa
 *    por email a los administradores y al contacto de la academia.
 * 2. Suspensión: solo cuando esa fecha llega y la factura sigue impaga.
 * Pagar durante el periodo de gracia saca la factura de `overdue` y evita la suspensión.
 */
export class BillingDunningService {
  async run(now: Date = new Date()): Promise<DunningRunResult> {
    const warnedInvoiceIds = await this.warnNewlyOverdue(now);
    const suspendedAcademyIds = await this.suspendAfterGrace(now);
    return { warnedInvoiceIds, suspendedAcademyIds };
  }

  private async warnNewlyOverdue(now: Date): Promise<number[]> {
    const today = now.toISOString().slice(0, 10);
    const suspensionDate = new Date(now.getTime() + env.BILLING_OVERDUE_GRACE_DAYS * DAY_MS);
    const warned: number[] = [];

    for (const invoice of await invoiceRepository.findPendingPastDue(today)) {
      const claimed = await invoiceRepository.markOverdueWithWarning(invoice.id, now, suspensionDate);
      if (!claimed) continue;
      warned.push(invoice.id);

      await this.sendWarning(invoice, suspensionDate).catch((error) =>
        console.error(`[billing] No se pudo enviar el aviso de la factura ${invoice.id}:`, error),
      );
      // audit_log exige un usuario real: las acciones del sistema quedan en el log del servidor.
      console.log(
        `[billing] Factura ${invoice.id} (academia ${invoice.tenant_id}) vencida: aviso enviado, ` +
          `suspensión programada para ${suspensionDate.toISOString()}`,
      );
    }
    return warned;
  }

  private async suspendAfterGrace(now: Date): Promise<number[]> {
    const suspended: number[] = [];
    for (const invoice of await invoiceRepository.findDueForSuspension(now)) {
      if (suspended.includes(invoice.tenant_id)) continue;
      const academy = await academyRepository.findById(invoice.tenant_id);
      // Ya suspendida (o inactiva): solo se consume la programación.
      await invoiceRepository.clearSuspensionSchedule(invoice.tenant_id);
      if (!academy || academy.status !== AcademyStatus.ACTIVE) continue;

      await academyRepository.updateStatus(
        invoice.tenant_id,
        AcademyStatus.SUSPENDED,
        AcademySuspensionReason.BILLING,
      );
      await userSessionService.revokeAllSessionsForTenant(invoice.tenant_id);
      suspended.push(invoice.tenant_id);

      console.log(
        `[billing] Academia ${invoice.tenant_id} suspendida: factura ${invoice.id} impaga tras el periodo de gracia`,
      );
    }
    return suspended;
  }

  private async sendWarning(invoice: InvoiceRow, suspensionDate: Date): Promise<void> {
    const academy = await academyRepository.findById(invoice.tenant_id);
    const recipients = new Set(await userRepository.findActiveAcademyAdminEmails(invoice.tenant_id));
    if (academy?.contact_email) recipients.add(academy.contact_email.toLowerCase());
    const locale = toLocale(academy?.locale);
    for (const to of recipients) {
      await getMailSender().send(buildOverdueWarningEmail(to, invoice, suspensionDate, locale));
    }
  }
}

export const billingDunningService = new BillingDunningService();
