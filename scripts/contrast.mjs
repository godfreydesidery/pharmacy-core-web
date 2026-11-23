// Contrast of the design tokens (WCAG 2.2 AA: 4.5:1 for text, 3:1 for UI parts such as a field's
// border and the focus ring), in each theme and look: premium light, premium dark and classic.
// Reads the tokens from src/styles.scss and src/styles/classic.scss, or from other copies:
//
//   node scripts/contrast.mjs                         the working tree
//   node scripts/contrast.mjs old.scss old-classic.scss    (for a before / after comparison)
//
// Exits 1 when a pair fails, so CI can run it.
import { readFileSync } from 'node:fs';

const here = (path) =>
  new URL(`../${path}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const [mainPath = here('src/styles.scss'), classicPath = here('src/styles/classic.scss')] =
  process.argv.slice(2);
const main = readFileSync(mainPath, 'utf8');
const classic = readFileSync(classicPath, 'utf8');

function block(text, opener) {
  const start = text.indexOf(opener);
  if (start < 0) return '';
  let depth = 0;
  for (let i = text.indexOf('{', start); i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return text.slice(text.indexOf('{', start) + 1, i);
  }
  return '';
}

function tokens(body, vars = {}) {
  const out = {};
  for (const [, name, value] of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    out[name] = value.replace(/#\{\$([\w-]+)\}/g, (_, v) => vars[v] ?? '').trim();
  }
  return out;
}

const sassVars = Object.fromEntries(
  [...classic.matchAll(/^\$([\w-]+):\s*([^;]+);/gm)].map(([, n, v]) => [n, v.trim()]),
);
const light = tokens(block(main, ':root {'));
const dark = { ...light, ...tokens(block(main, '@mixin dark-tokens')) };
const classicLook = {
  ...light,
  ...tokens(block(classic, "html:root[data-look='classic']"), sassVars),
};
const themes = { 'premium light': light, 'premium dark': dark, classic: classicLook };

function parse(color) {
  color = color.trim();
  let m = color.match(/^#([0-9a-f]{3,8})$/i);
  if (m) {
    let hex = m[1];
    if (hex.length === 3) hex = [...hex].map((c) => c + c).join('');
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).concat(1);
  }
  m = color.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const [r, g, b, a = '1'] = m[1].split(',').map((s) => s.trim());
    return [+r, +g, +b, +a];
  }
  throw new Error(`colour? ${color}`);
}

/** The colour as seen: a translucent one laid over the colour under it. */
function over(color, under) {
  const [r, g, b, a] = parse(color);
  if (a >= 1) return [r, g, b];
  const [ur, ug, ub] = under;
  return [r * a + ur * (1 - a), g * a + ug * (1 - a), b * a + ub * (1 - a)];
}

function luminance([r, g, b]) {
  const f = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ratio(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** A token's value; the ring's is the colour in its box-shadow (the outermost). */
function value(theme, name, fallback) {
  let v = theme[name] ?? fallback;
  if (name === 'ring' && v) {
    const colours = v.match(/(#[0-9a-f]{3,8}|rgba?\([^)]+\)|var\(--[\w-]+\))/gi) ?? [];
    v = colours[colours.length - 1];
  }
  const ref = v?.match(/^var\(--([\w-]+)\)$/);
  return ref ? value(theme, ref[1]) : v;
}

// [what, foreground, background, minimum, fallback for a token the theme lacks]
const PAIRS = [
  ['body text', 'text', 'surface', 4.5],
  ['secondary text', 'text-2', 'surface', 4.5],
  ['muted text', 'muted', 'surface', 4.5],
  ['muted text on the page', 'muted', 'bg', 4.5],
  ['muted text on a header strip', 'muted', 'surface-2', 4.5],
  ['hint (faint)', 'faint', 'surface', 4.5],
  ['hint on the page', 'faint', 'bg', 4.5],
  ['hint on a header strip', 'faint', 'surface-2', 4.5],
  ['link / active tab', 'primary', 'surface', 4.5],
  ['pill blue', 'primary', 'primary-soft', 4.5],
  ['pill green', 'green', 'green-soft', 4.5],
  ['pill amber', 'amber', 'amber-soft', 4.5],
  ['pill red', 'red', 'red-soft', 4.5],
  ['pill orange', 'orange', 'orange-soft', 4.5],
  ['pill purple', 'purple', 'purple-soft', 4.5],
  ['pill teal', 'teal', 'teal-soft', 4.5],
  ['pill gray', 'muted', 'surface-2', 4.5],
  ['green text', 'green', 'surface', 4.5],
  ['red text', 'red', 'surface', 4.5],
  ['amber text', 'amber', 'surface', 4.5],
  ['primary button', 'on-primary', 'primary', 4.5],
  ['success button (Complete sale)', 'on-green', 'green', 4.5, '#ffffff'],
  ['danger button', 'on-red', 'red', 4.5, '#ffffff'],
  ['warning button', 'on-amber', 'amber', 4.5, '#ffffff'],
  ['field border', 'input-border', 'surface', 3, 'var(--border)'],
  ['field border on the page', 'input-border', 'bg', 3, 'var(--border)'],
  ['focus ring', 'ring', 'surface', 3],
  ['focus ring on the page', 'ring', 'bg', 3],
];

let failed = 0;
for (const [name, theme] of Object.entries(themes)) {
  console.log(`\n${name}`);
  for (const [what, fg, bg, min, fallback] of PAIRS) {
    const back = over(value(theme, bg), [255, 255, 255]);
    const surface = over(value(theme, 'surface'), [255, 255, 255]);
    const background = over(value(theme, bg), surface);
    const front = over(value(theme, fg, fallback), background);
    const r = ratio(front, back === background ? back : background);
    const ok = r >= min;
    if (!ok) failed++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${r.toFixed(2).padStart(5)}  (≥${min})  ${what}`);
  }
}
console.log(failed ? `\n${failed} pairs below AA` : '\nall pairs meet AA');
process.exit(failed ? 1 : 0);
