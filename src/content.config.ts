import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Testimonials. Three entry types: a text `quote`, an `image` (screenshot of a
// conversation), or a `video`. An entry renders ONLY when `consent: true` - screenshots
// of private conversations without recorded consent must never appear. `lang` records
// the language of the quote/screenshot so a translation gloss can be shown on the other
// locale. Crop/mask of screenshots is the owner's job, not the code's.
const testimonials = defineCollection({
  loader: glob({ pattern: '**/*.{yml,yaml,json,md}', base: './src/content/testimonials' }),
  schema: z.object({
    type: z.enum(['quote', 'image', 'video']),
    content: z.string().optional(),        // quote text
    src: z.string().optional(),            // image/video path (e.g. under /public)
    attribution: z.string().optional(),    // optional - some people won't want to be named
    consent: z.boolean().default(false),   // must be true to render
    translation: z.string().optional(),    // short gloss for the other locale
    lang: z.enum(['pl', 'en']).optional(),
    date: z.coerce.date(),
  }),
});

export const collections = { testimonials };
