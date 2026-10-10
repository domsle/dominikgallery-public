# Dominik Ślęczka — Photography Portfolio

Editorial, dark, image-first photography site. [Astro](https://astro.build) + Content
Collections, static output, bilingual (English `/`, Polish `/pl/`). Design/architecture
rationale lives in [`SPEC.md`](./SPEC.md); this file is the practical how-to.

This repo also contains a simple CRM manager, which makes managing content on the website easier.

The final result of this repo can be seen on [my website](https://dominik.gallery).

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # → dist/
npm run deploy   # git push → Netlify rebuilds
```

> First install: `sharp`/`esbuild` need their install scripts approved once —
> `npm install-scripts approve sharp esbuild && npm rebuild sharp esbuild` (already pinned
> via `package.json` → `allowScripts`).

## Where things live

```
src/
├─ site.config.ts     name, email, socials, price — language-neutral facts
├─ gallery/
│  ├─ gallery.yaml     every photo: path + which collection(s) it's in + featured flag
│  └─ <collection>/…    the actual image files
├─ data/gallery.ts     parses gallery.yaml + optimizes images (don't touch)
├─ i18n/
│  ├─ ui.ts            all UI strings, en + pl — nav, buttons, section titles
│  ├─ content.ts       services / process steps / FAQs, en + pl
│  ├─ works.ts         per-series title/category/location/year + home flag, en + pl
│  └─ utils.ts         locale helpers (rarely touched)
├─ components/ · screens/ · layouts/   UI — screens hold each page's markup once;
│                                       pages/ (+ pages/pl/) are one-line wrappers
└─ styles/global.css   design tokens
public/                static files (robots.txt, og image)
tools/manager/         local admin UI for editing gallery/content without hand-editing files
```

**Golden rule:** change *photos* in `src/gallery/` (+ `works.ts` for metadata); change
*wording* in `i18n/ui.ts` or `i18n/content.ts`. You rarely touch `.astro` files directly.
Every text change has an `en` and a `pl` side — update both.

## Adding photos

```yaml
# src/gallery/gallery.yaml
collections:
  - id: portraits
    name: Sensual Portraits   # English fallback; set the Polish name in works.ts
images:
  - path: portraits/P1082298.jpg
    collections: [portraits, featured]   # featured → eligible for home/hero
```

1. Drop the file in `src/gallery/<id>/`, add one `images:` line.
2. New series: also add a `collections:` entry, and a block in `src/i18n/works.ts`:

```ts
boats: {
  name: { en: 'Boats', pl: 'Łodzie' },       // omit to reuse the yaml name both ways
  category: { en: 'Travel', pl: 'Podróże' },
  location: { en: 'Vietnam', pl: 'Wietnam' },
  year: 2026,
  home: true,                                // show on the home "Recent work" grid
},
```

| Thing | Comes from |
|---|---|
| Series cover | first photo tagged `featured`, else the first photo |
| Series order | order of `collections:` in the yaml |
| Title/category/location/year | `works.ts` (falls back to the yaml `name`) |
| Home grid | series with `home: true` |

## The manager tool (and basic CRM)

`tools/manager/` is a small local admin page for everything above — reorder series, toggle
`featured`/home, edit FAQs and pricing, drag-drop new photos — without hand-editing YAML/TS.
It shows a diff before writing anything to disk, and has buttons to run the dev server, stage
(`git add`), and deploy.

It also doubles as a very basic CRM: each testimonial is a per-client record (name/attribution,
quote or photo/video, language, consent-to-publish flag, date) stored as one YAML file under
`src/content/testimonials/`. Add/edit/remove clients and their consent there — testimonials
only go live on the site once `consent: true` and the minimum count is met.

```bash
cd tools/manager && npm start   # http://localhost:5177
```

It edits the real files directly (`gallery.yaml`, `works.ts`, `content.ts`, `site.config.ts`,
`content/testimonials/*.yaml`) — review its diff/stage steps before deploying, same as any
other change.

## Text, design, SEO, contact form

- **UI strings** (nav, buttons, labels): `src/i18n/ui.ts` — one dictionary, `en`/`pl` share keys.
- **Services/process/FAQs**: `src/i18n/content.ts`, `en`/`pl`.
- **Colors/spacing**: tokens at the top of `src/styles/global.css`.
- **Per-page SEO**: `title`/`description`/`ogImage` props on `<BaseLayout>`; sitemap + JSON-LD
  are automatic.
- **Contact form**: wired for Netlify Forms (`src/screens/ContactScreen.astro`); email
  notifications are set up once in Netlify → Forms → Notifications.

## Languages

English is default (unprefixed), Polish is under `/pl/`. Auto-detects on first visit
(`navigator.languages`), remembers a manual switcher choice in `localStorage`. To add a third
language: add it to `astro.config.mjs` → `i18n.locales`, add `de` blocks to `ui.ts`/`content.ts`,
add `de` entries to each `works.ts` series, and copy `src/pages/pl/` → `src/pages/de/`.

## Deploy

Netlify, connected to this repo's `master` branch (`netlify.toml`: build `npm run build`,
publish `dist`). `npm run deploy` is `git push` — any push to `master` triggers a rebuild.
`dist/` is never committed. Custom domain is managed in the Netlify UI.

## Publishing a public copy

`scripts/publish-public.sh [target-dir]` mirrors this repo into a separate directory as a
single fresh commit (no shared git history), with real photos excluded — only `gallery.yaml`
(the manifest, no image files) ships. This repo keeps deploying the live site unchanged; the
public copy is just a code showcase and won't build without your own `src/gallery/<id>/*.jpg`
files dropped back in.

```bash
scripts/publish-public.sh ../dominikgallery-public
cd ../dominikgallery-public && git remote add origin <your-public-repo-url> && git push -u origin main
# later, to update the public copy:
scripts/publish-public.sh ../dominikgallery-public --push
```
