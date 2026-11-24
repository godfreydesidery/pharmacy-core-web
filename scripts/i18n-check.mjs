// Checks the translations: every key used as `'area.key' | t` (or translations.t('area.key'))
// exists in en.ts, Swahili defines no key English lacks, and lists the English keys Swahili still
// falls back on. Usage: npm run i18n:check   (add -- --strict to fail on missing Swahili keys)
//
// It also checks the API's refusals against src/app/core/i18n/api-reasons.json (the reasons the
// API sends, refreshed with `npm run i18n:reasons`): every reason has an `errors.<reason>` line in
// English and in Swahili, and a line uses only the `{{placeholders}}` its problem carries.
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
// Every refusal reason the API sends has its line in both languages, and each line's placeholders
// are members the problem carries.
const apiReasons = JSON.parse(
  readFileSync(join(app, 'core/i18n/api-reasons.json'), 'utf8'),
).reasons;
function linesOf(suffix, base) {
  const files = [base, ...dictFiles.filter((f) => f.endsWith(suffix)).map((f) => join('dict', f))];
  const lines = new Map();
  for (const file of files) {
    const text = readFileSync(join(app, 'core/i18n', file), 'utf8');
    // 'errors.reason': 'text' or "text", on the same line or the next
    const entry = /^\s*'(errors\.[\w-]+)':\s*(['"])((?:\\.|(?!\2)[^\\])*)\2/gm;
    for (const m of text.matchAll(entry)) lines.set(m[1], m[3]);
  }
  return lines;
}
const reasonLines = { en: linesOf('.en.ts', 'en.ts'), sw: linesOf('.sw.ts', 'sw.ts') };
const missingReasons = [];
const badPlaceholders = [];
for (const [reason, members] of Object.entries(apiReasons)) {
  for (const [lang, lines] of Object.entries(reasonLines)) {
    const line = lines.get(`errors.${reason}`);
    if (line === undefined) {
      missingReasons.push(`${lang} errors.${reason}`);
      continue;
    }
    for (const [, name] of line.matchAll(/\{\{\s*(\w+)\s*}}/g)) {
      if (!members.includes(name)) badPlaceholders.push(`${lang} errors.${reason} {{${name}}}`);
    }
  }
}

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
for (const line of missingReasons)
  console.error(`✗ ${line} is missing: the API sends this reason (api-reasons.json)`);
for (const line of badPlaceholders)
  console.error(`✗ ${line}: the API's problem has no such member (api-reasons.json)`);
for (const key of missingSw)
  console.warn(`• ${key} has no Swahili text yet (falls back to English)`);
console.log(
  `i18n: ${en.size} English keys, ${sw.size} Swahili, ${used.size} literal uses; ` +
    `${undefinedKeys.length} undefined, ${extraSw.length} extra in sw, ${missingSw.length} untranslated.`,
);
const reasonCount = Object.keys(apiReasons).length;
console.log(
  `i18n: ${reasonCount} API refusal reasons; ${missingReasons.length} lines missing, ` +
    `${badPlaceholders.length} unknown placeholders.`,
);
process.exit(
  undefinedKeys.length ||
    extraSw.length ||
    missingReasons.length ||
    badPlaceholders.length ||
    (strict && missingSw.length)
    ? 1
    : 0,
);
