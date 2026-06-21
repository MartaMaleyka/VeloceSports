import 'dotenv/config';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { getPool } from './config/db.js';

const app = createApp();

async function start(): Promise<void> {
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    console.log('Conexión a MySQL establecida');

    app.listen(env.PORT, () => {
      console.log(`Servidor escuchando en http://localhost:${env.PORT}`);
      if (env.NODE_ENV !== 'production') {
        console.log(`Swagger UI: http://localhost:${env.PORT}/api/docs`);
      }
    });
  } catch (error) {
    console.error('Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

start();
