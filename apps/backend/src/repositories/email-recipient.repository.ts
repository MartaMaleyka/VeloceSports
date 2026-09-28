import type { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../config/db.js';
import { TenantScopedRepository } from './base.repository.js';

/** Direcciones de correo para avisos transaccionales (aprobaciones, rechazos). */
export class EmailRecipientRepository extends TenantScopedRepository {
  /**
   * Solicitante de una cuenta autorregistrada: administradores de la academia o el
   * padre titular de una cuenta personal, más el email de contacto de la academia.
   */
  async findAccountOwnerEmails(tenantId: number): Promise<string[]> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT u.email FROM users u
       WHERE u.tenant_id = ? AND u.role IN ('academy_admin', 'parent')
       UNION
       SELECT a.contact_email FROM academies a
       WHERE a.id = ? AND a.contact_email IS NOT NULL AND a.contact_email <> ''`,
      [tenantId, tenantId],
    );
    return uniqueEmails(rows.map((r) => String(r.email)));
  }

  /** Familia vinculada al jugador (padres y tutores con cuenta activa). */
  async findFamilyEmails(tenantId: number, playerId: number): Promise<string[]> {
    this.assertTenantId(tenantId);
    const pool = getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT DISTINCT u.email
       FROM player_viewers pv
       INNER JOIN users u ON u.id = pv.viewer_id AND u.status = 'active'
       WHERE pv.tenant_id = ? AND pv.player_id = ?
         AND pv.relationship IN ('PARENT', 'GUARDIAN')`,
      [tenantId, playerId],
    );
    return uniqueEmails(rows.map((r) => String(r.email)));
  }
}

function uniqueEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of emails) {
    const email = raw.trim();
    const key = email.toLowerCase();
    if (!email || seen.has(key)) continue;
    seen.add(key);
    result.push(email);
  }
  return result;
}

export const emailRecipientRepository = new EmailRecipientRepository();
