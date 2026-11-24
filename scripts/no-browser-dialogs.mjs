// Fails when the app calls the browser's own dialogs (confirm, alert, prompt). The owner's rule:
// questions go through ConfirmService, the app's animated dialog, never the browser's box.
// Run in CI (npm run lint:dialogs); a method merely named confirm (a form's submit) is fine.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|html)$/.test(name) && !name.endsWith('.spec.ts') ? [path] : [];
  });
}

/** Blanks out comments, keeping the line numbers. */
function code(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`])\/\/.*$/gm, (c, before) => before + ' '.repeat(c.length - before.length));
}

// window.confirm( / globalThis.alert( ... anywhere; a bare confirm( that is a call, not a method
// of that name (declared, called on this or another object, or bound in a template's quotes).
const GLOBAL = /\b(?:window|globalThis|self)\s*\.\s*(confirm|alert|prompt)\s*\(/;
const BARE = /(?<![\w.$"'`])\b(confirm|alert|prompt)\s*\(/;
const DECLARATION =
  /^\s*(?:(?:public|protected|private|static|override|async|function)\s+)*(?:confirm|alert|prompt)\s*\(.*\{\s*$/;

export function findBrowserDialogs(text) {
  const found = [];
  code(text)
    .split('\n')
    .forEach((line, i) => {
      if (GLOBAL.test(line) || (BARE.test(line) && !DECLARATION.test(line))) {
        found.push({ line: i + 1, text: line.trim() });
      }
    });
  return found;
}

const problems = files(root).flatMap((file) =>
  findBrowserDialogs(readFileSync(file, 'utf8')).map(
    (p) => `${relative(root, file).replace(/\\/g, '/')}:${p.line}  ${p.text}`,
  ),
);
if (problems.length) {
  console.error("The browser's confirm/alert/prompt is used; ask with ConfirmService instead:");
  for (const p of problems) console.error(`  src/${p}`);
  process.exit(1);
}
console.log('No browser confirm/alert/prompt calls.');
