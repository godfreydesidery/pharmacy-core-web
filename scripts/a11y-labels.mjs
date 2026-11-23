// Counts form labels that name no control (WCAG 1.3.1 / 4.1.2), per file: a <label> with no `for`
// and no control inside it. Such a label is still tied to its control at run time when it sits
// in a `.field` block of a component that imports SHARED (FieldLinkDirective) or inside
// <app-field>; the rest are listed as remaining.
//
//   node scripts/a11y-labels.mjs            summary
//   node scripts/a11y-labels.mjs --list     every remaining label, with its file and line
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../src/app/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const VOID = new Set(['input', 'img', 'br', 'hr', 'meta', 'link', 'area', 'col', 'source', 'wbr']);

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|html)$/.test(name) && !name.endsWith('.spec.ts') ? [path] : [];
  });
}

function scan(text) {
  const tag = /<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^'">])*?)(\/?)>/g;
  const stack = [];
  const found = [];
  let match;
  while ((match = tag.exec(text))) {
    const [, closing, rawName, attrs, selfClosing] = match;
    const name = rawName.toLowerCase();
    if (closing) {
      const at = stack.map((s) => s.name).lastIndexOf(name);
      if (at >= 0) stack.length = at;
      continue;
    }
    if (name === 'label') {
      const end = text.indexOf('</label', tag.lastIndex);
      const inner = end > 0 ? text.slice(tag.lastIndex, end) : '';
      const linked =
        /(\s|\[|attr\.)for\]?=/.test(attrs) || /<(input|select|textarea)\b/.test(inner);
      if (!linked) {
        const inField = stack.some(
          (s) => s.name === 'app-field' || /\bclass="[^"]*\bfield\b/.test(s.attrs),
        );
        found.push({ line: text.slice(0, match.index).split('\n').length, inField });
      }
    }
    if (!selfClosing && !VOID.has(name)) stack.push({ name, attrs });
  }
  return found;
}

const list = process.argv.includes('--list');
let total = 0;
let auto = 0;
const remaining = [];
for (const file of files(root)) {
  const text = readFileSync(file, 'utf8');
  if (!text.includes('<label')) continue;
  const shared =
    /\bSHARED\b|\bFIELDS\b|FieldLinkDirective|FieldComponent/.test(text) || file.endsWith('.html');
  for (const label of scan(text)) {
    total++;
    if (label.inField && shared) auto++;
    else remaining.push(`${relative(root, file).replace(/\\/g, '/')}:${label.line}`);
  }
}
const explicit = files(root).reduce(
  (n, f) => n + (readFileSync(f, 'utf8').match(/<app-field\b/g) ?? []).length,
  0,
);
console.log(`labels with no for and no control inside: ${total}`);
console.log(`  linked at run time (.field block or app-field): ${auto}`);
console.log(`  not linked: ${remaining.length}`);
console.log(`app-field uses: ${explicit}`);
if (list) for (const r of remaining) console.log(`  ${r}`);
