import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { UserRole } from '@velocesport/shared';
import { getPool, closePool } from '../config/db.js';
import { runPendingMigrations } from '../db/migrate.js';
import { userRoleRepository } from '../repositories/user-role.repository.js';

const SUPER_ADMIN_EMAIL = 'maleyka1994@gmail.com';

async function findUserByEmail(email: string): Promise<{ id: number } | null> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id FROM users WHERE email = ? LIMIT 1',
    [email],
  );
  return rows[0] ? { id: rows[0].id as number } : null;
}

async function seedProduction(): Promise<void> {
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error(
      'SUPER_ADMIN_PASSWORD es obligatoria en producción (mínimo 12 caracteres)',
    );
  }

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const migrationsDir = path.resolve(__dirname, '../../db/migrations');
  await runPendingMigrations(migrationsDir);

  const passwordHash = await bcrypt.hash(password, 12);
  const email = SUPER_ADMIN_EMAIL.toLowerCase().trim();

  const pool = getPool();
  const existing = await findUserByEmail(email);

  let userId: number;
  if (existing) {
    userId = existing.id;
    await pool.execute(
      `UPDATE users
       SET password_hash = ?, role = ?, tenant_id = NULL, status = 'active'
       WHERE id = ?`,
      [passwordHash, UserRole.SUPER_ADMIN, userId],
    );
    console.log(`✓ Super admin actualizado: ${email} (id: ${userId})`);
  } else {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO users (email, password_hash, role, tenant_id, status, first_name, last_name)
       VALUES (?, ?, ?, NULL, 'active', ?, ?)`,
      [email, passwordHash, UserRole.SUPER_ADMIN, 'Maleyka', 'Magallón'],
    );
    userId = result.insertId;
    console.log(`✓ Super admin creado: ${email} (id: ${userId})`);
  }

  await userRoleRepository.assignRole(userId, UserRole.SUPER_ADMIN, null);
  console.log('✓ Rol super_admin asignado en user_roles');
  console.log('\nProducción lista. Usuario único:', email);
}

seedProduction()
  .catch((error) => {
    console.error('Error en seed de producción:', error);
    process.exit(1);
  })
  .finally(async () => {
    await closePool();
  });
