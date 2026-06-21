/**
 * Valida diccionarios i18n y claves usadas en el monorepo.
 *
 * Uso:
 *   tsx scripts/validate-locales.ts           — src + uso en código
 *   tsx scripts/validate-locales.ts --check-dist — además verifica dist compilado
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { es } from '../src/locales/es.js';
import { en } from '../src/locales/en.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, '..');
const MONOREPO_ROOT = path.resolve(PKG_ROOT, '../..');
const CHECK_DIST = process.argv.includes('--check-dist');

const SCAN_DIRS = [
  path.join(MONOREPO_ROOT, 'apps/web/src'),
  path.join(MONOREPO_ROOT, 'packages/design-system/src'),
].filter((dir) => existsSync(dir));

const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.astro', '.js', '.jsx']);

/** Prefijos con sufijo dinámico conocido (p. ej. impact enum). */
const DYNAMIC_KEY_SUFFIXES: Record<string, readonly string[]> = {
  'tenant.actionCatalog.impact': ['positive', 'negative', 'neutral'],
};

const STATIC_T_CALL =
  /\bt\(\s*['"]([a-zA-Z][a-zA-Z0-9_.]*)['"]/g;

function flattenLeafKeys(
  obj: Record<string, unknown>,
  prefix = '',
): Set<string> {
  const keys = new Set<string>();
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      keys.add(fullKey);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const nested of flattenLeafKeys(value as Record<string, unknown>, fullKey)) {
        keys.add(nested);
      }
    }
  }
  return keys;
}

function resolvePath(dict: Record<string, unknown>, key: string): unknown {
  let current: unknown = dict;
  for (const part of key.split('.')) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

function walkFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      files.push(...walkFiles(fullPath));
    } else if (SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

function collectStaticKeysFromCode(): Map<string, string[]> {
  const usage = new Map<string, string[]>();
  for (const dir of SCAN_DIRS) {
    for (const file of walkFiles(dir)) {
      const content = readFileSync(file, 'utf8');
      for (const match of content.matchAll(STATIC_T_CALL)) {
        const key = match[1];
        if (!key) continue;
        const rel = path.relative(MONOREPO_ROOT, file);
        const list = usage.get(key) ?? [];
        if (!list.includes(rel)) list.push(rel);
        usage.set(key, list);
      }
    }
  }
  return usage;
}

function assertLocaleParity(): void {
  const esKeys = flattenLeafKeys(es as unknown as Record<string, unknown>);
  const enKeys = flattenLeafKeys(en as unknown as Record<string, unknown>);

  const missingInEn = [...esKeys].filter((k) => !enKeys.has(k)).sort();
  const missingInEs = [...enKeys].filter((k) => !esKeys.has(k)).sort();

  if (missingInEn.length > 0 || missingInEs.length > 0) {
    console.error('\n[i18n] Claves desincronizadas entre es.ts y en.ts:\n');
    if (missingInEn.length > 0) {
      console.error('  Faltan en en.ts:');
      for (const k of missingInEn) console.error(`    - ${k}`);
    }
    if (missingInEs.length > 0) {
      console.error('  Faltan en es.ts:');
      for (const k of missingInEs) console.error(`    - ${k}`);
    }
    process.exit(1);
  }
}

function assertKeysInDictionary(dict: Record<string, unknown>, label: string): void {
  const usage = collectStaticKeysFromCode();
  const missing: Array<{ key: string; files: string[] }> = [];

  for (const [key, files] of usage) {
    const value = resolvePath(dict, key);
    if (typeof value !== 'string') {
      missing.push({ key, files });
    }
  }

  for (const [prefix, suffixes] of Object.entries(DYNAMIC_KEY_SUFFIXES)) {
    for (const suffix of suffixes) {
      const key = `${prefix}.${suffix}`;
      const value = resolvePath(dict, key);
      if (typeof value !== 'string') {
        missing.push({ key, files: ['<dynamic suffix>'] });
      }
    }
  }

  if (missing.length > 0) {
    console.error(`\n[i18n] Claves usadas en código pero ausentes en ${label}:\n`);
    for (const { key, files } of missing.sort((a, b) => a.key.localeCompare(b.key))) {
      console.error(`  - ${key}`);
      for (const f of files.slice(0, 3)) console.error(`      ${f}`);
      if (files.length > 3) console.error(`      … +${files.length - 3} más`);
    }
    process.exit(1);
  }

  console.log(
    `[i18n] OK: ${usage.size} claves estáticas + ${Object.values(DYNAMIC_KEY_SUFFIXES).flat().length} dinámicas verificadas en ${label}`,
  );
}

async function assertDistMatchesSrc(): Promise<void> {
  const distEsPath = path.join(PKG_ROOT, 'dist/locales/es.js');
  const srcEsPath = path.join(PKG_ROOT, 'src/locales/es.ts');

  if (!existsSync(distEsPath)) {
    console.error('\n[i18n] dist/locales/es.js no existe. Ejecuta: pnpm --filter @velocesport/i18n build\n');
    process.exit(1);
  }

  const srcMtime = statSync(srcEsPath).mtimeMs;
  const distMtime = statSync(distEsPath).mtimeMs;
  if (distMtime < srcMtime - 1000) {
    console.error(
      '\n[i18n] dist/ desactualizado respecto a src/locales/es.ts. Ejecuta: pnpm --filter @velocesport/i18n build\n',
    );
    process.exit(1);
  }

  const { es: distEs } = await import('../dist/locales/es.js');
  const srcKeys = flattenLeafKeys(es as unknown as Record<string, unknown>);
  const distKeys = flattenLeafKeys(distEs as unknown as Record<string, unknown>);

  const missingInDist = [...srcKeys].filter((k) => !distKeys.has(k)).sort();
  if (missingInDist.length > 0) {
    console.error('\n[i18n] Claves en src pero ausentes en dist/ (recompila i18n):\n');
    for (const k of missingInDist.slice(0, 20)) console.error(`  - ${k}`);
    if (missingInDist.length > 20) {
      console.error(`  … y ${missingInDist.length - 20} más`);
    }
    process.exit(1);
  }

  console.log(`[i18n] OK: dist/ sincronizado (${distKeys.size} claves)`);
}

async function main(): Promise<void> {
  console.log('[i18n] Validando diccionarios…');
  assertLocaleParity();
  assertKeysInDictionary(es as unknown as Record<string, unknown>, 'es.ts');

  if (CHECK_DIST) {
    await assertDistMatchesSrc();
  } else {
    console.log('[i18n] Validación src completada (usa --check-dist tras tsc)');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
