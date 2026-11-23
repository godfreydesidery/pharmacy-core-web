// Regenerates src/app/core/i18n/api-reasons.json: every refusal `reason` the API can send, with the
// extra problem members (`Refusal.with("name", …)`) each one carries, read from the API's Java
// source. The API is a separate repository, so the list is committed and `npm run i18n:check`
// compares the dictionaries against it.
//
// Usage: npm run i18n:reasons                 (reads ../pharmacy-core-api)
//        npm run i18n:reasons -- <api folder>  (another checkout)
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const api = resolve(process.argv[2] ?? join(root, '..', 'pharmacy-core-api'));
const out = join(root, 'src/app/core/i18n/api-reasons.json');

if (!existsSync(join(api, 'pom.xml'))) {
  console.error(`✗ No API source at ${api}; pass its folder: npm run i18n:reasons -- <folder>`);
  process.exit(1);
}

/** Main Java sources, without build output (`target*`) or tests. */
function javaFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (name.startsWith('target') || name === 'test' || name === 'node_modules' || name === '.git')
      return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return javaFiles(path);
    return name.endsWith('.java') ? [path] : [];
  });
}

/** The text from `start` to the end of the statement (the `;` outside brackets and strings). */
function statement(text, start) {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      for (i++; i < text.length && text[i] !== '"'; i++) if (text[i] === '\\') i++;
    } else if (c === '(' || c === '{' || c === '[') depth++;
    else if (c === ')' || c === '}' || c === ']') depth--;
    else if (c === ';' && depth <= 0) return text.slice(start, i);
  }
  return text.slice(start);
}

/** The first argument of the call whose `(` is at `open`. */
function firstArgument(text, open) {
  let depth = 0;
  for (let i = open + 1; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      for (i++; i < text.length && text[i] !== '"'; i++) if (text[i] === '\\') i++;
    } else if (c === '(') depth++;
    else if (c === ')') {
      if (depth === 0) return text.slice(open + 1, i);
      depth--;
    } else if (c === ',' && depth === 0) return text.slice(open + 1, i);
  }
  return '';
}

const reasons = new Map();
const dynamic = new Set();
/** Reasons whose detail names a product, amount or limit that no problem member carries. */
const valued = new Set();
const add = (reason, params = []) => {
  const known = reasons.get(reason) ?? new Set();
  params.forEach((p) => known.add(p));
  reasons.set(reason, known);
};
const literals = (text) => [...text.matchAll(/"([a-z][a-z0-9_]*)"/g)].map((m) => m[1]);
const paramsIn = (text) => [...text.matchAll(/\.with\(\s*"(\w+)"/g)].map((m) => m[1]);

for (const file of javaFiles(api)) {
  const text = readFileSync(file, 'utf8').replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ' ');
  const constants = new Map(
    [...text.matchAll(/(?:static\s+)?final\s+String\s+(\w+)\s*=\s*"([a-z][a-z0-9_]*)"/g)].map(
      (m) => [m[1], m[2]],
    ),
  );
  const calls = [
    // Refusal.invalid("reason", …), Refusal.locked(…), …
    /Refusal\.(?:invalid|notFound|conflict|forbidden|unauthenticated|locked)\s*\(/g,
    // new Refusal(RefusalKind.X, "reason", …): skip the kind, read the second argument
    /new\s+Refusal\s*\(\s*RefusalKind\.\w+\s*,/g,
    // SmtpRules: new Refused("reason", field, problem)
    /new\s+Refused\s*\(/g,
    // ProblemAdvice: problem(status, "reason", detail, field)
    /\bproblem\s*\(\s*\d+\s*,/g,
  ];
  for (const pattern of calls) {
    for (const match of text.matchAll(pattern)) {
      const end = match.index + match[0].length;
      const open = end - 1;
      const arg = firstArgument(text, open).trim();
      const whole = statement(text, match.index);
      const params = paramsIn(whole);
      // `Refusal refusal = Refusal.conflict(…); … refusal.with("uid", …)`
      const assigned = /(\w+)\s*=\s*$/.exec(text.slice(Math.max(0, match.index - 80), match.index));
      if (assigned) {
        const after = text.slice(match.index + whole.length, match.index + whole.length + 800);
        const named = new RegExp(String.raw`\b${assigned[1]}\s*\.with\(\s*"(\w+)"`, 'g');
        params.push(...[...after.matchAll(named)].map((m) => m[1]));
      }
      // The detail names a value (`product.name() + " is …"`) the problem does not carry.
      const detail = whole.slice(whole.indexOf(arg) + arg.length);
      const namesValue = /"\s*\+\s*[a-zA-Z(]|[a-zA-Z)]\s*\+\s*"/.test(detail.split(/\.with\(/)[0]);
      if (/^"[^"]*"\s*\+/.test(arg)) {
        dynamic.add(arg.replace(/\s+/g, ' '));
        continue;
      }
      const found = literals(arg);
      if (found.length) {
        found.forEach((reason) => add(reason, params));
        if (namesValue && !params.length) found.forEach((reason) => valued.add(reason));
      } else if (constants.has(arg)) add(constants.get(arg), params);
      else if (/^\w+\.REASON$/.test(arg)) continue; // resolved where the constant is declared
    }
  }
  // REASON constants used through another class (SmsCap.REASON, CreditLimits.REASON)
  for (const [name, value] of constants) if (name === 'REASON') add(value);
  // Refusal.tooManyRequests and Refusal.malformed carry fixed reasons.
  if (/Refusal\.tooManyRequests\s*\(/.test(text)) add('too_many_requests');
  if (/Refusal\.malformed\s*\(/.test(text)) add('malformed_request');
}

// `Refusal.invalid(refused.reason(), …)` style indirections are covered by the literal they carry;
// anything else non-literal is reported so the generator can be taught it.
const sorted = Object.fromEntries(
  [...reasons.keys()].sort().map((reason) => [reason, [...reasons.get(reason)].sort()]),
);
const body = {
  $comment:
    'Generated by `npm run i18n:reasons` from pharmacy-core-api. Every refusal reason the API sends, with the problem extras each carries. Do not edit by hand.',
  dynamicPrefixes: [...dynamic].sort(),
  valuesOnlyInDetail: [...valued].filter((reason) => !reasons.get(reason).size).sort(),
  reasons: sorted,
};
writeFileSync(out, JSON.stringify(body, null, 2) + '\n');
console.log(
  `api-reasons: ${Object.keys(sorted).length} reasons, ` +
    `${Object.values(sorted).filter((p) => p.length).length} with parameters → ${out}`,
);
