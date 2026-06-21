import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { env } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function columnExists(
  connection: mysql.Connection,
  table: string,
  column: string,
): Promise<boolean> {
  const [rows] = await connection.query<mysql.RowDataPacket[]>(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [env.DB_NAME, table, column],
  );
  return rows.length > 0;
}

async function repair(): Promise<void> {
  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    multipleStatements: true,
  });

  try {
    const needs003 = !(await columnExists(connection, 'plans', 'price'));

    if (needs003) {
      console.log('Aplicando reparación: migración 003 (columnas de plans + audit_log)...');
      const sqlPath = path.resolve(__dirname, '../../db/migrations/003_platform_plans_audit.sql');
      const sql = await fs.readFile(sqlPath, 'utf-8');
      await connection.query(sql);

      await connection.query(
        `INSERT INTO _schema_migrations (filename)
         SELECT '003_platform_plans_audit.sql' FROM DUAL
         WHERE NOT EXISTS (
           SELECT 1 FROM _schema_migrations WHERE filename = '003_platform_plans_audit.sql'
         )`,
      );
      console.log('Reparación 003 completada.');
    } else {
      console.log('Esquema OK: columna plans.price ya existe.');
    }
  } finally {
    await connection.end();
  }
}

repair().catch((error) => {
  console.error('Error en reparación de esquema:', error);
  process.exit(1);
});
