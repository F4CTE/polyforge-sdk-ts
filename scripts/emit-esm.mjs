/**
 * Post-build script: copies CJS .js -> .mjs and .d.ts -> .d.mts for ESM exports,
 * rewriting internal .js imports to .mjs.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const distDir = join(import.meta.dirname, '..', 'dist');

for (const file of readdirSync(distDir)) {
  if (file.endsWith('.js')) {
    const content = readFileSync(join(distDir, file), 'utf8');
    const esm = content
      .replace(/require\("\.\/(.+?)\.js"\)/g, 'require("./$1.mjs")')
      .replace(/(from\s+["']\.\/[^"']+?)\.js(["'])/g, '$1.mjs$2');
    writeFileSync(join(distDir, file.replace(/\.js$/, '.mjs')), esm);
  }
  if (file.endsWith('.d.ts') && !file.endsWith('.d.mts')) {
    const content = readFileSync(join(distDir, file), 'utf8');
    const patched = content.replace(/(from\s+["']\.\/[^"']+?)\.js(["'])/g, '$1.mjs$2');
    writeFileSync(join(distDir, file.replace(/\.d\.ts$/, '.d.mts')), patched);
  }
}

console.log('ESM emit complete.');
