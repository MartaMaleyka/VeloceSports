import { getMailSender, type OutgoingMail } from '../lib/mailer.js';
import { publicBaseUrl, renderEmail, type EmailLocale } from '../lib/email-template.js';
import { buildGameActionEmailCopy } from '../utils/notification-message.js';

/**
 * Correos a usuarios finales (RF-NOT). Nunca lanza: un fallo de SMTP no debe romper la
 * captura en vivo ni una aprobación; se registra y se sigue.
 */
export class EmailNotificationService {
  private async deliver(mail: OutgoingMail, context: string): Promise<boolean> {
    try {
      await getMailSender().send(mail);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[email] No se pudo enviar "${context}" a ${mail.to}: ${message}`);
      return false;
    }
  }

  private async deliverAll(mails: OutgoingMail[], context: string): Promise<number> {
    const results = await Promise.all(mails.map((mail) => this.deliver(mail, context)));
    return results.filter(Boolean).length;
  }

  /** Acción notificable de un hijo (gol, asistencia…) al padre que activó el email. */
  async sendGameActionEmail(input: {
    to: string;
    locale: EmailLocale;
    playerFirstName: string;
    actionCode: number;
    actionName: string;
    minute: number;
  }): Promise<boolean> {
    const copy = buildGameActionEmailCopy(
      input.locale,
      input.playerFirstName,
      input.actionCode,
      input.actionName,
      input.minute,
    );
    const footer =
      input.locale === 'en'
        ? 'You receive this email because you turned on email notifications. You can turn them off in your notification preferences.'
        : 'Recibes este correo porque activaste los avisos por email. Puedes desactivarlos en tus preferencias de notificaciones.';
    return this.deliver(
      renderEmail({
        to: input.to,
        subject: copy.subject,
        paragraphs: [copy.body, footer],
        action: {
          label: input.locale === 'en' ? 'See notifications' : 'Ver notificaciones',
          url: `${publicBaseUrl()}/dashboard/parent/notifications`,
        },
      }),
      'game_action',
    );
  }

  /** Resultado de la revisión de una cuenta autorregistrada (academia o personal). */
  async sendAccountDecisionEmail(input: {
    to: string[];
    locale: EmailLocale;
    accountName: string;
    approved: boolean;
    reason?: string | null;
  }): Promise<number> {
    const en = input.locale === 'en';
    const subject = input.approved
      ? en
        ? 'Your SquadVeloce account is approved'
        : 'Tu cuenta de SquadVeloce fue aprobada'
      : en
        ? 'Your SquadVeloce request was not approved'
        : 'Tu solicitud en SquadVeloce no fue aprobada';
    const paragraphs = input.approved
      ? [
          en
            ? `Good news: "${input.accountName}" has been approved. You can now sign in and start using SquadVeloce.`
            : `Buenas noticias: "${input.accountName}" fue aprobada. Ya puedes iniciar sesión y empezar a usar SquadVeloce.`,
        ]
      : [
          en
            ? `We reviewed the request for "${input.accountName}" and could not approve it.`
            : `Revisamos la solicitud de "${input.accountName}" y no pudimos aprobarla.`,
          ...(input.reason ? [en ? `Reason: ${input.reason}` : `Motivo: ${input.reason}`] : []),
          en
            ? 'If you think this is a mistake, reply to this email.'
            : 'Si crees que es un error, responde a este correo.',
        ];
    const mails = input.to.map((to) =>
      renderEmail({
        to,
        subject,
        paragraphs,
        action: input.approved
          ? { label: en ? 'Sign in' : 'Iniciar sesión', url: `${publicBaseUrl()}/login` }
          : undefined,
      }),
    );
    return this.deliverAll(mails, input.approved ? 'account_approved' : 'account_rejected');
  }

  /** Resultado de la inscripción de un jugador enviada por su familia. */
  async sendEnrollmentDecisionEmail(input: {
    to: string[];
    locale: EmailLocale;
    playerName: string;
    academyName: string;
    approved: boolean;
    reason?: string | null;
  }): Promise<number> {
    const en = input.locale === 'en';
    const subject = input.approved
      ? en
        ? `${input.playerName}'s enrollment was approved`
        : `La inscripción de ${input.playerName} fue aprobada`
      : en
        ? `${input.playerName}'s enrollment was not approved`
        : `La inscripción de ${input.playerName} no fue aprobada`;
    const paragraphs = input.approved
      ? [
          en
            ? `${input.academyName} approved ${input.playerName}'s enrollment. You can now follow their matches and stats.`
            : `${input.academyName} aprobó la inscripción de ${input.playerName}. Ya puedes seguir sus partidos y estadísticas.`,
        ]
      : [
          en
            ? `${input.academyName} did not approve ${input.playerName}'s enrollment.`
            : `${input.academyName} no aprobó la inscripción de ${input.playerName}.`,
          ...(input.reason ? [en ? `Reason: ${input.reason}` : `Motivo: ${input.reason}`] : []),
        ];
    const mails = input.to.map((to) =>
      renderEmail({
        to,
        subject,
        paragraphs,
        action: {
          label: en ? 'Open SquadVeloce' : 'Abrir SquadVeloce',
          url: `${publicBaseUrl()}/dashboard/parent`,
        },
      }),
    );
    return this.deliverAll(mails, input.approved ? 'enrollment_approved' : 'enrollment_rejected');
  }
}

export const emailNotificationService = new EmailNotificationService();
