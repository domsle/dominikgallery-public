// Data layer for the portfolio, driven by src/gallery/gallery.yaml.
// Drop images into a folder, list them in the yaml, and they appear on the site -
// no code change needed. Each yaml `collection` becomes one Work (a photo series).

import type { ImageMetadata } from 'astro';
import { load } from 'js-yaml';
import galleryRaw from '../gallery/gallery.yaml?raw';

// --- image resolution: path (relative to src/gallery) → optimized ImageMetadata ---
const modules = import.meta.glob<ImageMetadata>('../gallery/**/*.jpg', {
  eager: true,
  import: 'default',
});
const byPath: Record<string, ImageMetadata> = {};
for (const [key, mod] of Object.entries(modules)) {
  byPath[key.replace('../gallery/', '')] = mod;
}

export function galleryImage(path: string): ImageMetadata {
  const found = byPath[path];
  if (!found) throw new Error(`gallery.yaml references a missing image: ${path}`);
  return found;
}

// --- yaml shape ---
// Optional per-image `description` (owner fills over time) - a bare string is used for
// both languages, or an { en, pl } object for language-specific text. Appended to the
// generated alt text (see i18n/works.ts).
export type ImageDescription = string | { en?: string; pl?: string };
interface RawCollection { id: string; name: string; }
interface RawImage { path: string; collections: string[]; description?: ImageDescription; }
interface RawGallery { collections: RawCollection[]; images: RawImage[]; }

const data = load(galleryRaw) as RawGallery;

const FEATURED = 'featured';

export interface Series {
  id: string;                 // collection id - also the URL slug
  name: string;               // display name from yaml
  cover: ImageMetadata;       // first featured image, else first image
  images: ImageMetadata[];    // all images in the series (yaml order)
  descriptions: (ImageDescription | undefined)[]; // optional, aligned to `images`
  count: number;
  hasFeatured: boolean;       // series contains a `featured`-tagged image
}

/** Series in yaml collection order, skipping any that ended up empty. */
export const series: Series[] = data.collections
  .map((col) => {
    const imgs = data.images.filter((im) => im.collections.includes(col.id));
    const coverEntry = imgs.find((im) => im.collections.includes(FEATURED)) ?? imgs[0];
    return coverEntry
      ? {
          id: col.id,
          name: col.name,
          cover: galleryImage(coverEntry.path),
          images: imgs.map((im) => galleryImage(im.path)),
          descriptions: imgs.map((im) => im.description),
          count: imgs.length,
          hasFeatured: imgs.some((im) => im.collections.includes(FEATURED)),
        }
      : null;
  })
  .filter((s): s is Series => s !== null);

export const seriesById = new Map(series.map((s) => [s.id, s]));

/** Flat pool of every image flagged `featured` - handy for hero/marquee/decor. */
export const featuredImages: ImageMetadata[] = data.images
  .filter((im) => im.collections.includes(FEATURED))
  .map((im) => galleryImage(im.path));

/** Every image, yaml order - fallback pool. */
export const allImages: ImageMetadata[] = data.images.map((im) => galleryImage(im.path));
