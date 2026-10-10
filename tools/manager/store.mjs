// Reads/writes the real site content files. Each collection meta entry and each FAQ
// entry keeps its original source snippet; an entry is only re-serialized (and loses any
// non-literal JS, e.g. the `${amount}` price interpolation in content.ts) if its value
// actually changed. Unchanged entries round-trip byte-for-byte.
import fs from 'node:fs';
import path from 'node:path';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';
import { findMatching, splitTopLevel, splitKeyValue, evalJs, jsStr } from './parsers.mjs';

const ROOT = process.env.MANAGER_ROOT
  ? path.resolve(process.env.MANAGER_ROOT)
  : path.resolve(import.meta.dirname, '../..');

export const paths = {
  galleryYaml: path.join(ROOT, 'src/gallery/gallery.yaml'),
  galleryDir: path.join(ROOT, 'src/gallery'),
  worksTs: path.join(ROOT, 'src/i18n/works.ts'),
  contentTs: path.join(ROOT, 'src/i18n/content.ts'),
  siteConfigTs: path.join(ROOT, 'src/site.config.ts'),
  testimonialsDir: path.join(ROOT, 'src/content/testimonials'),
};

const read = (p) => fs.readFileSync(p, 'utf8');

// ---------- gallery.yaml ----------

function loadGallery() {
  const raw = yamlLoad(read(paths.galleryYaml));
  return { collections: raw.collections, images: raw.images };
}

function dumpGallery({ collections, images }) {
  return yamlDump({ collections, images }, { lineWidth: -1, flowLevel: 3 });
}

// ---------- works.ts meta block ----------

function findMetaBlock(text) {
  const marker = 'const meta: Record<string, WorkMeta> = {';
  const markerIdx = text.indexOf(marker);
  if (markerIdx === -1) throw new Error('works.ts: meta block marker not found');
  const openIdx = markerIdx + marker.length - 1;
  const closeIdx = findMatching(text, openIdx);
  return { openIdx, closeIdx };
}

function loadMeta() {
  const text = read(paths.worksTs);
  const { openIdx, closeIdx } = findMetaBlock(text);
  const inner = text.slice(openIdx + 1, closeIdx);
  const entries = new Map(); // id -> { value, raw }
  for (const chunk of splitTopLevel(inner)) {
    const [id, valueText] = splitKeyValue(chunk);
    entries.set(id, { value: evalJs(valueText), raw: `  ${id}: ${valueText},` });
  }
  return entries;
}

function printLoc(loc) {
  return `{ en: ${jsStr(loc.en ?? '')}, pl: ${jsStr(loc.pl ?? '')} }`;
}

function printMetaValue(v) {
  const lines = [];
  if (v.name) lines.push(`name: ${printLoc(v.name)}`);
  lines.push(`category: ${printLoc(v.category ?? {})}`);
  lines.push(`location: ${printLoc(v.location ?? {})}`);
  lines.push(`year: ${Number(v.year) || new Date().getFullYear()}`);
  if (v.home) lines.push(`home: true`);
  if (v.description) lines.push(`description: ${printLoc(v.description)}`);
  return `{\n    ${lines.join(',\n    ')},\n  }`;
}

function sameValue(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function dumpWorksTs(originalText, loadedMeta, nextMetaById, order) {
  const { openIdx, closeIdx } = findMetaBlock(originalText);
  const entryLines = order
    .filter((id) => nextMetaById.has(id))
    .map((id) => {
      const next = nextMetaById.get(id);
      const loaded = loadedMeta.get(id);
      if (loaded && sameValue(loaded.value, next)) return loaded.raw;
      return `  ${id}: ${printMetaValue(next)},`;
    });
  return (
    originalText.slice(0, openIdx + 1) +
    '\n' +
    entryLines.join('\n') +
    '\n' +
    originalText.slice(closeIdx)
  );
}

// ---------- content.ts faqs arrays ----------

function loadFaqBlocks(text) {
  const blocks = [];
  let searchFrom = 0;
  for (let i = 0; i < 2; i++) {
    const markerIdx = text.indexOf('faqs: [', searchFrom);
    if (markerIdx === -1) throw new Error('content.ts: expected two faqs: [ ] blocks');
    const openIdx = markerIdx + 'faqs: ['.length - 1;
    const closeIdx = findMatching(text, openIdx);
    blocks.push({ openIdx, closeIdx });
    searchFrom = closeIdx + 1;
  }
  return blocks; // [en, pl] in file order
}

function loadFaqs(amount) {
  const text = read(paths.contentTs);
  const blocks = loadFaqBlocks(text);
  const scope = { amount };
  return blocks.map(({ openIdx, closeIdx }) => {
    const inner = text.slice(openIdx + 1, closeIdx);
    return splitTopLevel(inner).map((raw) => ({ value: evalJs(raw, scope), raw }));
  });
}

function printFaqEntry(f) {
  return `{ q: ${jsStr(f.q)}, a: ${jsStr(f.a)} }`;
}

function dumpContentTs(originalText, loadedFaqs, nextFaqs) {
  let text = originalText;
  let searchFrom = 0;
  for (let i = 0; i < 2; i++) {
    const markerIdx = text.indexOf('faqs: [', searchFrom);
    const openIdx = markerIdx + 'faqs: ['.length - 1;
    const closeIdx = findMatching(text, openIdx);
    const loaded = loadedFaqs[i];
    const next = nextFaqs[i];
    const lines = next.map((f, idx) => {
      const prior = loaded[idx];
      if (prior && sameValue(prior.value, f)) return `      ${prior.raw},`;
      return `      ${printFaqEntry(f)},`;
    });
    const replacement = '\n' + lines.join('\n') + '\n    ';
    text = text.slice(0, openIdx + 1) + replacement + text.slice(closeIdx);
    searchFrom = openIdx + 1 + replacement.length;
  }
  return text;
}

// ---------- site.config.ts pricing ----------

function loadPricing() {
  const text = read(paths.siteConfigTs);
  const m = text.match(/portraitFrom:\s*(\d+)/);
  const currencyMatch = text.match(/currency:\s*'([^']*)'/);
  if (!m) throw new Error('site.config.ts: portraitFrom not found');
  return { portraitFrom: Number(m[1]), currency: currencyMatch ? currencyMatch[1] : 'zł' };
}

function dumpSiteConfigTs(originalText, portraitFrom) {
  return originalText.replace(/portraitFrom:\s*\d+/, `portraitFrom: ${Number(portraitFrom)}`);
}

// ---------- testimonials (one file per entry) ----------

function loadTestimonials() {
  if (!fs.existsSync(paths.testimonialsDir)) return [];
  return fs
    .readdirSync(paths.testimonialsDir)
    .filter((f) => !f.startsWith('_') && /\.(ya?ml)$/.test(f))
    .map((file) => {
      const data = yamlLoad(read(path.join(paths.testimonialsDir, file)));
      return { file, ...data, date: String(data.date).slice(0, 10) };
    });
}

function dumpTestimonialFile(entry) {
  const { file, ...data } = entry;
  return yamlDump(data, { lineWidth: -1 });
}

// ---------- public API ----------

export function loadState() {
  const gallery = loadGallery();
  const meta = loadMeta();
  const pricing = loadPricing();
  const amount = `${pricing.portraitFrom} ${pricing.currency}`;
  const faqBlocks = loadFaqs(amount);
  const testimonials = loadTestimonials();
  const metaById = {};
  for (const [id, { value }] of meta) metaById[id] = value;
  return {
    collections: gallery.collections,
    images: gallery.images,
    meta: metaById,
    pricing,
    faqs: { en: faqBlocks[0].map((e) => e.value), pl: faqBlocks[1].map((e) => e.value) },
    testimonials,
  };
}

/** Computes the new on-disk text for every text file that may have changed, plus
 * testimonial file writes/deletes and pending photo uploads. Does not touch disk. */
export function buildWrite(next) {
  const loadedMeta = loadMeta();
  const loadedWorksText = read(paths.worksTs);
  const nextMetaById = new Map(Object.entries(next.meta));
  const order = next.collections.map((c) => c.id);

  const pricing = loadPricing();
  const amount = `${pricing.portraitFrom} ${pricing.currency}`;
  const loadedFaqs = loadFaqs(amount);
  const loadedContentText = read(paths.contentTs);

  const loadedSiteConfigText = read(paths.siteConfigTs);
  const loadedTestimonials = loadTestimonials();

  const files = [];
  files.push({
    path: paths.galleryYaml,
    label: 'src/gallery/gallery.yaml',
    oldText: read(paths.galleryYaml),
    newText: dumpGallery({ collections: next.collections, images: next.images }),
  });
  files.push({
    path: paths.worksTs,
    label: 'src/i18n/works.ts',
    oldText: loadedWorksText,
    newText: dumpWorksTs(loadedWorksText, loadedMeta, nextMetaById, order),
  });
  files.push({
    path: paths.contentTs,
    label: 'src/i18n/content.ts',
    oldText: loadedContentText,
    newText: dumpContentTs(loadedContentText, loadedFaqs, [next.faqs.en, next.faqs.pl]),
  });
  files.push({
    path: paths.siteConfigTs,
    label: 'src/site.config.ts',
    oldText: loadedSiteConfigText,
    newText: dumpSiteConfigTs(loadedSiteConfigText, next.pricing.portraitFrom),
  });

  const loadedByFile = new Map(loadedTestimonials.map((t) => [t.file, t]));
  const nextByFile = new Map(next.testimonials.map((t) => [t.file, t]));
  for (const [file, entry] of nextByFile) {
    const prior = loadedByFile.get(file);
    const newText = dumpTestimonialFile(entry);
    if (!prior || !sameValue(prior, entry)) {
      files.push({
        path: path.join(paths.testimonialsDir, file),
        label: `src/content/testimonials/${file}`,
        oldText: prior ? dumpTestimonialFile(prior) : '',
        newText,
        isNew: !prior,
      });
    }
  }
  const deletes = [];
  for (const [file, entry] of loadedByFile) {
    if (!nextByFile.has(file)) {
      deletes.push({
        path: path.join(paths.testimonialsDir, file),
        label: `src/content/testimonials/${file}`,
        oldText: dumpTestimonialFile(entry),
      });
    }
  }

  const uploads = (next.pendingUploads || []).map((u) => ({
    path: path.join(paths.galleryDir, u.path),
    label: `src/gallery/${u.path}`,
    bytes: Buffer.from(u.base64, 'base64'),
  }));

  return { files, deletes, uploads };
}

export function commitWrite(next) {
  const { files, deletes, uploads } = buildWrite(next);
  for (const u of uploads) {
    fs.mkdirSync(path.dirname(u.path), { recursive: true });
    fs.writeFileSync(u.path, u.bytes);
  }
  for (const f of files) {
    if (f.oldText !== f.newText) fs.writeFileSync(f.path, f.newText);
  }
  for (const d of deletes) fs.rmSync(d.path, { force: true });
}

export { ROOT };
