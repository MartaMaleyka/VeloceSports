import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swaggerSpec } from '../config/swagger.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.resolve(here, '../../../../docs/openapi.json');

fs.writeFileSync(outFile, `${JSON.stringify(swaggerSpec, null, 2)}\n`);
console.log(`[openapi] Especificación escrita en ${path.relative(process.cwd(), outFile)}`);
