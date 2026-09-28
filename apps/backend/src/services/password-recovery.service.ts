import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { UserStatus } from '@velocesport/shared';
import { env } from '../config/env.js';
import { escapeHtml, publicBaseUrl } from '../lib/email-template.js';
import { getMailSender, type OutgoingMail } from '../lib/mailer.js';
import { passwordRecoveryRepository } from '../repositories/password-recovery.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { ValidationError } from '../types/index.js';
import { auditService } from './audit.service.js';
import { userSessionService } from './user-session.service.js';

const BCRYPT_ROUNDS = 12;

export const PASSWORD_RECOVERY_INVALID_CODE = 'PASSWORD_RECOVERY_INVALID';

type Locale = 'es' | 'en';

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function buildRecoveryEmail(
  to: string,
  link: string,
  ttlMinutes: number,
  locale: Locale,
): OutgoingMail {
  const copy =
    locale === 'en'
      ? {
          subject: 'Reset your SquadVeloce password',
          intro: 'We received a request to reset the password for your SquadVeloce account.',
          action: 'Choose a new password',
          expiry: `This link expires in ${ttlMinutes} minutes and can only be used once.`,
          ignore: "If you didn't request it, you can ignore this email: your password won't change.",
        }
      : {
          subject: 'Restablece tu contraseña de SquadVeloce',
          intro: 'Recibimos una solicitud para restablecer la contraseña de tu cuenta de SquadVeloce.',
          action: 'Elegir una nueva contraseña',
          expiry: `El enlace caduca en ${ttlMinutes} minutos y solo puede usarse una vez.`,
          ignore: 'Si no lo solicitaste, ignora este correo: tu contraseña no cambiará.',
        };

  const text = `${copy.intro}\n\n${copy.action}: ${link}\n\n${copy.expiry}\n${copy.ignore}\n`;
  const html = `<p>${escapeHtml(copy.intro)}</p>
<p><a href="${escapeHtml(link)}">${escapeHtml(copy.action)}</a></p>
<p>${escapeHtml(copy.expiry)}<br>${escapeHtml(copy.ignore)}</p>`;
  return { to, subject: copy.subject, text, html };
}

export class PasswordRecoveryService {
  /**
   * Solicita un enlace de recuperación. Nunca revela si el email existe: el
   * controlador responde lo mismo siempre y no espera a esta promesa.
   */
  async request(
    email: string,
    context: { ipAddress?: string | null; locale?: Locale } = {},
  ): Promise<void> {
    const user = await userRepository.findByEmail(email.toLowerCase().trim());
    if (!user || user.status !== UserStatus.ACTIVE) return;

    const token = randomBytes(32).toString('base64url');
    const ttlMinutes = env.PASSWORD_RECOVERY_TOKEN_TTL_MINUTES;
    await passwordRecoveryRepository.createReplacingPrevious({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
      requestedIp: context.ipAddress ?? null,
    });

    const link = `${publicBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    await getMailSender().send(
      buildRecoveryEmail(user.email, link, ttlMinutes, context.locale ?? 'es'),
    );

    await auditService.log(
      { userId: user.id, tenantId: user.tenant_id },
      'user',
      user.id,
      'password_recovery_requested',
      null,
      { ipAddress: context.ipAddress ?? null },
    );
  }

  /** Canjea el token: nueva contraseña, token consumido y todas las sesiones cerradas. */
  async confirm(token: string, newPassword: string): Promise<void> {
    const invalid = () =>
      new ValidationError(
        'El enlace no es válido o ya expiró. Solicita uno nuevo.',
        PASSWORD_RECOVERY_INVALID_CODE,
      );

    const row = await passwordRecoveryRepository.findByHash(hashToken(token));
    if (!row || row.used_at || new Date(row.expires_at).getTime() <= Date.now()) {
      throw invalid();
    }

    const user = await userRepository.findByIdGlobal(row.user_id);
    if (!user || user.status !== UserStatus.ACTIVE) throw invalid();

    // Consumir antes de cambiar nada: dos peticiones simultáneas no canjean el mismo token.
    if (!(await passwordRecoveryRepository.markUsed(row.id))) throw invalid();

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await userRepository.updatePasswordAfterRecovery(user.id, passwordHash, new Date());
    const revoked = await userSessionService.revokeAllSessionsForUser(user.id);

    await auditService.log(
      { userId: user.id, tenantId: user.tenant_id },
      'user',
      user.id,
      'password_recovery_completed',
      null,
      { sessionsRevoked: revoked },
    );
  }

  async purgeStaleTokens(retentionDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    return passwordRecoveryRepository.deleteStale(cutoff);
  }
}

export const passwordRecoveryService = new PasswordRecoveryService();
