import { env, getCorsOrigins } from '../config/env.js';
import type { OutgoingMail } from './mailer.js';

export type EmailLocale = 'es' | 'en';

/** Idioma de un correo a partir del locale de la academia ("es-PA", "en-US"…). */
export function emailLocaleFrom(locale: string | null | undefined): EmailLocale {
  return locale?.toLowerCase().startsWith('en') ? 'en' : 'es';
}

export function publicBaseUrl(): string {
  const base = env.APP_PUBLIC_URL ?? getCorsOrigins()[0] ?? 'http://localhost:4321';
  return base.replace(/\/+$/, '');
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

/** Correo sencillo: párrafos y, opcionalmente, un enlace de acción (texto + HTML). */
export function renderEmail(input: {
  to: string;
  subject: string;
  paragraphs: string[];
  action?: { label: string; url: string };
}): OutgoingMail {
  const textParts = [...input.paragraphs];
  if (input.action) textParts.push(`${input.action.label}: ${input.action.url}`);
  const htmlParts = input.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`);
  if (input.action) {
    htmlParts.push(
      `<p><a href="${escapeHtml(input.action.url)}">${escapeHtml(input.action.label)}</a></p>`,
    );
  }
  return {
    to: input.to,
    subject: input.subject,
    text: `${textParts.join('\n\n')}\n`,
    html: htmlParts.join('\n'),
  };
}
