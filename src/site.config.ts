// Language-neutral site config. Translatable UI strings live in src/i18n/ui.ts;
// translatable content (services, team, FAQs…) lives in src/i18n/content.ts.

export interface Social { label: string; href: string; }

export const site = {
  name: 'Dominik Ślęczka',
  mark: '©',
  brand: 'Dominik Ślęczka',
  since: '2024',
  // Neutral fallback meta only - no experience framing, no hardcoded price.
  // The real homepage description (with price) is built from `priceFrom()` in HomeScreen.
  description:
    'Dominik Ślęczka - a Warsaw-based photographer making honest portraits, couple sessions and small events.',
  descriptionPl:
    'Dominik Ślęczka - fotograf z Warszawy. Szczere portrety, sesje dla par i kameralne wydarzenia.',
  email: 'hello@dominik.gallery',
  city: 'Warsaw, Poland',
  cityPl: 'Warszawa',
};

export const socials: Social[] = [
  { label: 'Instagram', href: 'https://instagram.com/dominik.gallery' },
];

// --- Single source of truth for the starting price. Owner changes these values only. ---
export const pricing = { portraitFrom: 400, currency: 'zł' } as const; // 400 is a placeholder

/** "od 400 zł" (pl) / "from 400 zł" (en) - never hardcode the number in copy. */
export const priceFrom = (lang: 'pl' | 'en'): string =>
  (lang === 'pl' ? 'od ' : 'from ') + pricing.portraitFrom + ' ' + pricing.currency;

// Testimonials section stays hidden until this many *consented* entries exist.
export const testimonialsMinimum = 3;

/**
 * LocalBusiness / ProfessionalService structured data. Values pulled from this config
 * so nothing is duplicated. Pass absolute `url` and `image` (built from Astro.site).
 */
export function businessJsonLd(opts: {
  lang: 'pl' | 'en';
  url: string;
  image: string;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    additionalType: 'https://schema.org/Photograph',
    name: site.brand,
    url: opts.url,
    image: opts.image,
    email: site.email,
    areaServed: opts.lang === 'pl' ? 'Warszawa' : 'Warsaw',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Warszawa',
      addressCountry: 'PL',
    },
    priceRange: priceFrom(opts.lang),
    sameAs: socials.map((s) => s.href),
  };
}
