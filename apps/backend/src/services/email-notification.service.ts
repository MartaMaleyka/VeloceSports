/**
 * Punto de extensión para envío de email a padres (RF-NOT).
 * NO conectado en MVP — invocar desde notification.service tras crear in-app.
 */
export interface EmailNotificationPayload {
  tenantId: number;
  recipientUserId: number;
  recipientEmail: string;
  subject: string;
  body: string;
  notificationId: number;
}

export interface EmailNotificationResult {
  sent: false;
  reason: 'not_implemented';
}

export class EmailNotificationService {
  async sendEmailNotification(
    _payload: EmailNotificationPayload,
  ): Promise<EmailNotificationResult> {
    // TODO(RF-NOT): conectar proveedor (SendGrid, SES, Resend, etc.)
    return { sent: false, reason: 'not_implemented' };
  }
}

export const emailNotificationService = new EmailNotificationService();
