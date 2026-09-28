import nodemailer, { type Transporter } from 'nodemailer';
import { env, isProduction } from '../config/env.js';

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface MailSender {
  send(mail: OutgoingMail): Promise<void>;
}

class SmtpMailSender implements MailSender {
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    });
  }

  async send(mail: OutgoingMail): Promise<void> {
    await this.transporter.sendMail({ from: env.MAIL_FROM, ...mail });
  }
}

/** Sin SMTP: en desarrollo muestra el correo en el log para poder probar el flujo. */
class ConsoleMailSender implements MailSender {
  async send(mail: OutgoingMail): Promise<void> {
    if (isProduction()) {
      console.warn(
        `[mailer] SMTP no configurado: no se envió "${mail.subject}". Define SMTP_HOST para enviar correos.`,
      );
      return;
    }
    console.log(`[mailer] (sin SMTP) Para: ${mail.to}\nAsunto: ${mail.subject}\n${mail.text}`);
  }
}

let sender: MailSender | null = null;

export function getMailSender(): MailSender {
  if (!sender) {
    sender = env.SMTP_HOST ? new SmtpMailSender() : new ConsoleMailSender();
  }
  return sender;
}

export function setMailSenderForTests(next: MailSender | null): void {
  sender = next;
}
