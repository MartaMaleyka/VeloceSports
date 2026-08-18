import { defineConfig, envField } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

const astroBase = process.env.ASTRO_BASE ?? '/';

/**
 * Sin allowedDomains, el adapter Node de Astro cae a hostname "localhost" e ignora
 * el Host real (p. ej. 127.0.0.1:9082 detrás de Docker). Entonces checkOrigin
 * compara Origin del browser vs http://localhost y bloquea multipart/form-data.
 * Misma estrategia que el fix de CSRF del logout: site + allowlist, nunca desactivar checkOrigin.
 */
function parseAllowedDomains(raw) {
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .flatMap((value) => {
      try {
        const url = new URL(value.includes('://') ? value : `http://${value}`);
        const entry = {
          hostname: url.hostname,
          protocol: url.protocol.replace(':', ''),
        };
        if (url.port) entry.port = url.port;
        return [entry];
      } catch {
        return [];
      }
    });
}

const astroSite = process.env.ASTRO_SITE ?? 'http://127.0.0.1:9082';
const allowedOriginsRaw =
  process.env.ASTRO_ALLOWED_ORIGINS ??
  process.env.CORS_ORIGINS ??
  'http://127.0.0.1:9082,http://localhost:9082';

export default defineConfig({
  site: astroSite,
  base: astroBase,
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  security: {
    checkOrigin: true,
    allowedDomains: parseAllowedDomains(allowedOriginsRaw),
  },
  integrations: [
    react(),
    tailwind({
      applyBaseStyles: false,
      configFile: './tailwind.config.mjs',
    }),
  ],
  env: {
    schema: {
      JWT_ACCESS_SECRET: envField.string({
        context: 'server',
        access: 'secret',
        min: 32,
      }),
      JWT_ACCESS_EXPIRES_IN: envField.string({
        context: 'server',
        access: 'secret',
        default: '15m',
      }),
      JWT_REFRESH_EXPIRES_IN: envField.string({
        context: 'server',
        access: 'secret',
        default: '7d',
      }),
      PUBLIC_API_URL: envField.string({
        context: 'client',
        access: 'public',
        default: 'http://localhost:3000',
      }),
      INTERNAL_API_URL: envField.string({
        context: 'server',
        access: 'secret',
        default: 'http://localhost:3000',
      }),
    },
  },
  server: {
    port: 8065,
  },
  vite: {
    resolve: {
      dedupe: ['react', 'react-dom', '@velocesport/i18n'],
    },
    ssr: {
      noExternal: ['@velocesport/design-system', '@velocesport/i18n'],
    },
  },
});
