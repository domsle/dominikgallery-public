import type { ImageMetadata } from 'astro';
import type { Lang } from './ui';
import { defaultLang } from './ui';
import { series, seriesById, type Series, type ImageDescription } from '../data/gallery';

// Per-series editorial metadata that isn't in gallery.yaml (localized name, category,
// location, year, and whether it appears on the home page). Keyed by collection id.
// Series present in the yaml but missing here fall back to sensible defaults.
interface Loc { en: string; pl: string; }
interface WorkMeta {
  name?: Loc;        // overrides the yaml collection name
  category: Loc;
  location: Loc;
  year: number;
  home?: boolean;    // show in the home "Recent work" grid
  description?: Loc; // optional short intro shown on the work's own page (not on home)
}

const meta: Record<string, WorkMeta> = {
  yoga_sunset: {
    name: { en: 'Sunny Yoga in Warsaw', pl: 'Słoneczna Joga w Warszawie' },
    category: { en: 'Yoga', pl: 'Joga' },
    location: { en: 'Warsaw, Poland', pl: 'Warszawa, Polska' },
    year: 2026,
    home: true,
    description: {
      en: 'Golden-hour yoga in the city - warm light, calm bodies, easy breath.',
      pl: 'Joga w złotej godzinie w mieście - ciepłe światło, spokojne ciała, swobodny oddech.',
    },
  },
  bnw_portraits: {
    name: { en: "B&W Portraits", pl: "Portrety cz-b" },
    category: { en: "Portrait", pl: "Portret" },
    location: { en: "Szklane Zaczarowane, Poland", pl: "Szklane Zaczarowane, Polska" },
    year: 2026,
    home: true,
    description: {
      en: "A black-and-white session - soft light, honest faces, nothing staged.",
      pl: "Sesja czarno-biała - miękkie światło, szczere twarze, nic na pokaz.",
    },
  },
  portraits: {
    name: { en: 'Sensual Portraits', pl: 'Zmysłowe Portrety' },
    category: { en: 'Portrait', pl: 'Portret' },
    location: { en: 'Szklane Zaczarowane, Poland', pl: 'Szklane Zaczarowane, Polska' },
    year: 2026,
    home: true,
    description: {
      en: 'Warm, sensual portraits made slowly - in trust and good light.',
      pl: 'Ciepłe, zmysłowe portrety robione powoli - w zaufaniu i dobrym świetle.',
    },
  },
  daga: {
    category: { en: "", pl: "" },
    location: { en: "", pl: "" },
    year: 2026,
  },
  smiles: {
    name: { en: 'Beautiful Smiles', pl: 'Piękne Uśmiechy' },
    category: { en: 'Portrait', pl: 'Portret' },
    location: { en: 'Szklane Zaczarowane, Poland', pl: 'Szklane Zaczarowane, Polska' },
    year: 2026,
    description: {
      en: 'The easy ones - real smiles caught between the posed shots.',
      pl: 'Lekkie i prawdziwe uśmiechy złapane pomiędzy pozowanymi kadrami.',
    },
  },
  vietnam: {
    name: { en: 'Vietnam', pl: 'Wietnam' },
    category: { en: 'Travel', pl: 'Podróże' },
    location: { en: 'Vietnam', pl: 'Wietnam' },
    year: 2026,
    description: {
      en: 'A few picks of shots showing life in Vietnam.',
      pl: 'Kilka wybranych kadrów pokazujących codzienność Wietnamu.',
    },
  },
  bw_women: {
    name: { en: 'Women in Vietnam', pl: 'Kobiety Wietnamu' },
    category: { en: 'Documentary', pl: 'Dokument' },
    location: { en: 'Vietnam', pl: 'Wietnam' },
    year: 2026,
    home: true,
    description: {
      en: 'Women I stumbled upon in Vietnam - strength in ordinary moments.',
      pl: 'Kobiety spotkane w Wietnamie - siła w zwykłych chwilach.',
    },
  },
  acroyoga: {
    name: { en: 'Acro Yoga', pl: 'Akrojoga' },
    category: { en: 'Event', pl: 'Wydarzenie' },
    location: { en: 'Las Festival, Poland', pl: 'Las Festiwal, Polska' },
    year: 2026,
    description: {
      en: 'Balance, trust and flight - acro yoga classes at Las Festival.',
      pl: 'Równowaga, zaufanie i lot - zajęcia akrojogi na Las Festiwalu.',
    },
  },
};

export interface GalleryImage { src: ImageMetadata; alt: string; }
export interface WorkData {
  title: string;
  category: string;
  year: number;
  location: string;
  cover: ImageMetadata;
  gallery: GalleryImage[];  // each image carries generated, localized alt text
  count: number;
  featured: boolean;        // shown on home
  description?: string;     // optional short intro on the work's own page
}
export interface Work {
  id: string;   // slug
  data: WorkData;
}

const pick = (loc: Loc | undefined, lang: Lang, fallback: string): string =>
  loc ? loc[lang] ?? loc[defaultLang] : fallback;

/** Resolve an optional per-image description to a plain string for the active locale. */
const pickDesc = (d: ImageDescription | undefined, lang: Lang): string | undefined => {
  if (!d) return undefined;
  const s = typeof d === 'string' ? d : d[lang] ?? d[defaultLang];
  return s && s.trim() ? s.trim() : undefined;
};

/**
 * Generated fallback alt text, per language, from the series title:
 *   PL: "{Tytuł serii} - zdjęcie {n}, fot. Dominik Ślęczka."
 *   EN: "{Series title} - photo {n} by Dominik Ślęczka."
 * Any per-image description is appended after the full stop.
 */
export function imageAlt(title: string, index: number, lang: Lang, desc?: string): string {
  const n = index + 1;
  const base = lang === 'pl'
    ? `${title} - zdjęcie ${n}, fot. Dominik Ślęczka.`
    : `${title} - photo ${n} by Dominik Ślęczka.`;
  return desc ? `${base} ${desc}` : base;
}

function toWork(s: Series, lang: Lang): Work {
  const m = meta[s.id];
  const title = pick(m?.name, lang, s.name);
  return {
    id: s.id,
    data: {
      title,
      category: pick(m?.category, lang, ''),
      year: m?.year ?? new Date().getFullYear(),
      location: pick(m?.location, lang, ''),
      cover: s.cover,
      gallery: s.images.map((src, i) => ({
        src,
        alt: imageAlt(title, i, lang, pickDesc(s.descriptions[i], lang)),
      })),
      count: s.count,
      featured: Boolean(m?.home),
      description: m?.description ? pick(m.description, lang, '') : undefined,
    },
  };
}

/** All works in gallery order, localized. */
export function getWorks(lang: Lang): Work[] {
  return series.map((s) => toWork(s, lang));
}

/** One work by slug, or undefined. */
export function getWork(lang: Lang, slug: string): Work | undefined {
  const s = seriesById.get(slug);
  return s ? toWork(s, lang) : undefined;
}

/** Language-neutral slug (kept for API compatibility with the screens). */
export const workSlug = (w: Work): string => w.id;
export type WorkEntry = Work;
