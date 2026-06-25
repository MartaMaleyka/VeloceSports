import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const root = fileURLToPath(new URL('.', import.meta.url));

function resolveJsToTs() {
  return {
    name: 'resolve-js-to-ts',
    enforce: 'pre' as const,
    resolveId(source: string, importer: string | undefined) {
      if (!importer || !source.endsWith('.js') || source.includes('node_modules')) {
        return null;
      }
      const base = source.slice(0, -3);
      const dir = path.dirname(importer);
      const tsPath = path.resolve(dir, `${base}.ts`);
      if (fs.existsSync(tsPath)) {
        return tsPath;
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [resolveJsToTs()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      'astro:env/client': path.resolve(root, 'src/test/mocks/astro-env-client.ts'),
      'astro:env/server': path.resolve(root, 'src/test/mocks/astro-env-server.ts'),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
});
