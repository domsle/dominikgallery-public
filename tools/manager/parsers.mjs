// Small hand-rolled parsers for surgically editing hand-authored TS source files
// (works.ts, content.ts) without a full TS toolchain. Only handles the subset of
// JS literal syntax these two files actually use: objects, arrays, strings
// (incl. template literals), numbers, booleans. No comments inside the edited blocks.

/** Index of the bracket/brace matching the opener at `openIdx`, respecting quotes. */
export function findMatching(text, openIdx) {
  const open = text[openIdx];
  const close = open === '{' ? '}' : open === '[' ? ']' : open === '(' ? ')' : null;
  if (!close) throw new Error(`not an opener at ${openIdx}: ${open}`);
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') {
      i = skipString(text, i);
      continue;
    }
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error('unbalanced brackets');
}

/** Given index of an opening quote char, returns index of its closing quote. */
function skipString(text, i) {
  const quote = text[i];
  i++;
  for (; i < text.length; i++) {
    if (text[i] === '\\') { i++; continue; }
    if (text[i] === quote) return i;
  }
  throw new Error('unterminated string');
}

/** Splits `text` on top-level commas, respecting nested brackets/strings. Trims entries, drops empties. */
export function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') { i = skipString(text, i); continue; }
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') depth--;
    else if (c === ',' && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

/** Splits a top-level "key: value" chunk into [key, value]. */
export function splitKeyValue(entry) {
  let depth = 0;
  for (let i = 0; i < entry.length; i++) {
    const c = entry[i];
    if (c === '"' || c === "'" || c === '`') { i = skipString(entry, i); continue; }
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') depth--;
    else if (c === ':' && depth === 0) {
      return [entry.slice(0, i).trim(), entry.slice(i + 1).trim()];
    }
  }
  throw new Error(`no top-level ":" in: ${entry}`);
}

/** Evaluates a JS literal expression (object/array/string/number/bool), with optional named scope vars. */
export function evalJs(expr, scope = {}) {
  const keys = Object.keys(scope);
  const fn = new Function(...keys, `return (${expr});`);
  return fn(...keys.map((k) => scope[k]));
}

/** JSON.stringify-based string literal — always valid, always safely escaped. */
export function jsStr(s) {
  return JSON.stringify(s);
}
