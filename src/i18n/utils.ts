import { ui, defaultLang, languages, type Lang } from './ui';

/** Derive the active locale from a URL pathname (e.g. /pl/about → 'pl'). */
export function getLangFromUrl(url: URL): Lang {
  const [, seg] = url.pathname.split('/');
  if (seg in languages) return seg as Lang;
  return defaultLang;
}

/** Translation function bound to a locale, with graceful fallback to defaultLang. */
export function useTranslations(lang: Lang) {
  return function t(key: keyof (typeof ui)[typeof defaultLang]): string {
    return (ui[lang] as Record<string, string>)[key] ?? ui[defaultLang][key];
  };
}

/**
 * Prefix a site-root path with the locale.
 * Default locale (pl) is un-prefixed (prefixDefaultLocale: false).
 *   localizePath('/works', 'pl') → '/works'
 *   localizePath('/works', 'en') → '/en/works'
 *   localizePath('/', 'en')      → '/en'
 */
export function localizePath(path: string, lang: Lang): string {
  if (lang === defaultLang) return path;
  const clean = path === '/' ? '' : path;
  return `/${lang}${clean}`;
}

/** Strip a leading locale segment, returning the language-neutral route. */
export function routeFromUrl(url: URL): string {
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] in languages) parts.shift();
  return '/' + parts.join('/');
}

/** Same page, other locale - used by the language switcher. */
export function alternatePath(url: URL, target: Lang): string {
  return localizePath(routeFromUrl(url), target);
}

/** All locales except the current one. */
export function otherLangs(current: Lang): Lang[] {
  return (Object.keys(languages) as Lang[]).filter((l) => l !== current);
}

/** Localized primary navigation. */
export function localizedNav(lang: Lang) {
  const t = useTranslations(lang);
  return [
    { label: t('nav.home'), href: localizePath('/', lang) },
    { label: t('nav.works'), href: localizePath('/works', lang) },
    { label: t('nav.contact'), href: localizePath('/contact', lang) },
  ];
}

export { languages, defaultLang, type Lang };
