import { defineConfig, envField } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
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
    },
  },
  server: {
    port: 4321,
  },
  vite: {
    ssr: {
      noExternal: ['@velocesport/design-system', '@velocesport/i18n'],
    },
  },
});
