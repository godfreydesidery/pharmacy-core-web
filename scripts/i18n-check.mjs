// Checks the translations: every key used as `'area.key' | t` (or translations.t('area.key'))
// exists in en.ts, Swahili defines no key English lacks, and lists the English keys Swahili still
// falls back on. Usage: npm run i18n:check   (add -- --strict to fail on missing Swahili keys)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = fileURLToPath(new URL('../src/app/', import.meta.url));
const strict = process.argv.includes('--strict');

function keysOf(file) {
  const text = readFileSync(join(app, 'core/i18n', file), 'utf8');
  return new Set([...text.matchAll(/^\s*'([\w.-]+)':/gm)].map((m) => m[1]));
}

function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|html)$/.test(name) && !name.endsWith('.spec.ts') ? [path] : [];
  });
}

// en.ts / sw.ts plus every per-area pair in dict/ (<area>.en.ts, <area>.sw.ts).
const dictFiles = readdirSync(join(app, 'core/i18n/dict'));
const union = (base, suffix) =>
  new Set([
    ...keysOf(base),
    ...dictFiles.filter((f) => f.endsWith(suffix)).flatMap((f) => [...keysOf(join('dict', f))]),
  ]);
const en = union('en.ts', '.en.ts');
const sw = union('sw.ts', '.sw.ts');
const used = new Map();
const patterns = [/'([a-z][\w-]*\.[\w.-]+)'\s*\|\s*t\b/g, /\.t\(\s*'([a-z][\w-]*\.[\w.-]+)'/g];
for (const file of sources(app)) {
  if (file.includes(join('core', 'i18n'))) continue;
  const text = readFileSync(file, 'utf8');
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      used.set(match[1], file.slice(app.length));
    }
  }
}

// A key ending in '.' is a prefix completed at run time ('acct.ev.' + action): it is defined when
// some English key starts with it.
const defined = (key) =>
  key.endsWith('.') ? [...en].some((known) => known.startsWith(key)) : en.has(key);
const undefinedKeys = [...used].filter(([key]) => !defined(key));
const extraSw = [...sw].filter((key) => !en.has(key));
const missingSw = [...en].filter((key) => !sw.has(key));

for (const [key, file] of undefinedKeys)
  console.error(`✗ ${key} is used in ${file} but not defined in en.ts`);
for (const key of extraSw) console.error(`✗ ${key} is in sw.ts but not in en.ts`);
for (const key of missingSw)
  console.warn(`• ${key} has no Swahili text yet (falls back to English)`);
console.log(
  `i18n: ${en.size} English keys, ${sw.size} Swahili, ${used.size} literal uses; ` +
    `${undefinedKeys.length} undefined, ${extraSw.length} extra in sw, ${missingSw.length} untranslated.`,
);
process.exit(undefinedKeys.length || extraSw.length || (strict && missingSw.length) ? 1 : 0);
