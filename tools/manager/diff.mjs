// Not a minimal diff — just common-prefix / common-suffix line trimming, with the
// changed middle shown as all-removed-then-all-added. Good enough for a "does this look
// right before I write it" review; not meant to be a tight diff.
export function lineDiff(oldText, newText) {
  if (oldText === newText) return [];
  const a = oldText.split('\n');
  const b = newText.split('\n');
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length - 1;
  let endB = b.length - 1;
  while (endA >= start && endB >= start && a[endA] === b[endB]) {
    endA--;
    endB--;
  }
  const out = [];
  if (start > 0) out.push({ type: 'ctx', text: a[start - 1] });
  for (let i = start; i <= endA; i++) out.push({ type: 'del', text: a[i] });
  for (let i = start; i <= endB; i++) out.push({ type: 'add', text: b[i] });
  if (endA + 1 < a.length) out.push({ type: 'ctx', text: a[endA + 1] });
  return out;
}
