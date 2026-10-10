# Dominik - Photography Portfolio: Full Build Spec

A complete, framework-agnostic specification to build a photography portfolio
site from scratch. Written so you (or another dev/agent) can implement it in Astro, Next, SvelteKit, plain HTML,
etc. Where this repo already implements something, the file is noted.

---

## 1. Product summary

- **What:** Marketing + portfolio site for a photography studio/agency.
- **Goal:** Make imagery the loudest element; everything else is quiet chrome.
- **Tone:** Editorial, minimal, dark, premium.
- **Audience:** Brands, publications, and individuals booking shoots.
- **Success signals:** Visitor browses works → reads About → hits Contact CTA.

---

## 2. Tech & architecture

- **Rendering:** Static site generation (SSG). No server needed for core site.
- **Recommended stack:** Astro + Content Collections (this repo). Any SSG works.
- **Dependencies:** Keep near-zero. No UI framework required; vanilla JS for the
  few interactions (menu toggle, scroll reveal, FAQ accordion via `<details>`).
- **Fonts:** One display face (uppercase, tight tracking - e.g. Archivo) + one
  text face (e.g. Inter). Load via `<link>` with `preconnect`.
- **Images:** External CDN URLs for demo; real build should use local optimized
  assets (AVIF/WebP, responsive `srcset`, `loading="lazy"`, width/height to
  avoid layout shift).
- **Hosting:** Any static host (Pages, Netlify, Vercel). Forms need a form
  backend (Netlify Forms, Formspree, or a serverless function).

---

## 3. Design system (build this first)

### 3.1 Color tokens (dark theme)
| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `#0a0a0a` | page background |
| `--bg-soft` | `#121212` | alt sections |
| `--surface` | `#161616` | cards, inputs, image placeholders |
| `--border` | `#262626` | hairlines, dividers |
| `--text` | `#f4f2ee` | primary text (warm off-white) |
| `--muted` | `#a3a09a` | secondary text |
| `--faint` | `#6b6862` | labels, numbering |

### 3.2 Typography
- **Display:** Archivo 600–800, `text-transform: uppercase`, `letter-spacing:
  -0.02em`, `line-height: ~0.9`. Used for all headings + big brand marks.
- **Text:** Inter 400–600, `line-height: 1.6`.
- **Eyebrow label:** 0.72rem, `letter-spacing: 0.22em`, uppercase, muted, with a
  short leading rule (`--`) before the text.
- **Fluid scale:** use `clamp()`. Hero brand ~`clamp(4rem, 22vw, 18rem)`; section
  titles ~`clamp(1.9rem, 5vw, 3.6rem)`.

### 3.3 Spacing & layout
- Content max-width ~1240px, centered, side padding `clamp(1rem, 3vw, 2rem)`.
- Vertical section rhythm `clamp(4rem, 10vw, 8rem)`.
- Border radius: minimal (~2px). Sharp, editorial feel.
- Grid gaps ~1.5rem.

### 3.4 Motion
- **Scroll reveal:** elements fade + rise 24px when entering viewport
  (IntersectionObserver, add `.is-visible`, unobserve after).
- **Image hover:** grayscale(~0.2) → full color + `scale(1.04)` over ~0.6s.
- **Buttons:** invert fill on hover; arrow nudges right 4px.
- **Marquee:** infinite horizontal scroll, pause on hover.
- **Always** honor `prefers-reduced-motion: reduce` (kill animations/transitions).

### 3.5 Accessibility baseline
- Semantic landmarks (`header`/`main`/`footer`/`nav`), one `<h1>` per page.
- Dominik-visible states on all interactive elements.
- Alt text on content images; `alt=""` on decorative marquee frames.
- FAQ via native `<details>/<summary>` (keyboard + screen-reader free).
- Color contrast ≥ 4.5:1 for body text.

---

## 4. Global components

### 4.1 Header (sticky) - `src/components/Header.astro`
- Sticky top, translucent bg + `backdrop-filter: blur`, bottom hairline.
- Left: wordmark `Dominik S` (© as `<sup>`).
- Center/right: nav links (Home, About, Works, Contact), uppercase, tracked.
  Active link underlined/highlighted based on current path.
- Mobile (<760px): hamburger toggles a full-width vertical menu; animate burger
  → X; `aria-expanded` synced.

### 4.2 Footer - `src/components/Footer.astro`
- Huge wordmark + "Back to top ↑" link.
- Divider, then 3 columns: **Menu** (nav + Licenses), **Elsewhere** (socials),
  **Studio** (tagline, portfolio year, email).
- Copyright line `© {year} Dominik S`.

### 4.3 CTA band - `src/components/CTA.astro`
- Reusable full-width centered call-to-action: eyebrow, giant title, one button.
- Props: `eyebrow`, `title`, `buttonLabel`, `buttonHref`. Appears at bottom of
  most pages with contextual copy.

### 4.4 Base layout - `src/layouts/BaseLayout.astro`
- `<head>`: title pattern `Page - Dominik S`, meta description, Open Graph tags,
  favicon, font links.
- Renders Header, `<slot/>`, Footer.
- Global `<script>` wiring the scroll-reveal IntersectionObserver.

---

## 5. Data model

Single source of truth for editable content. This repo splits it two ways:

### 5.1 Site config - `src/site.config.ts`
Exports:
- `site` - name, mark (©), tagline, portfolio year string, description, email,
  phone, `since` year.
- `nav` - `[{ label, href }]`.
- `socials` - `[{ label, href }]` (Instagram, Pinterest, Unsplash, LinkedIn).
- `services` - `[{ title, blurb, img }]` (Editorial, Studio, Commercial,
  Portrait, Fine Art).
- `stats` - `[{ value, label }]` (15+ Years, 80+ Projects, 99% Satisfaction,
  25+ Awards).
- `process` - `[{ step, title, blurb }]` (Explore, Define, Deliver).
- `team` - `[{ name, role, img }]`.
- `testimonials` - `[{ quote, name, company, img }]`.
- `faqs` - `[{ q, a }]`.

### 5.2 Works collection - `src/content/works/*.md`
Frontmatter schema (validated in `src/content.config.ts`):
```
title      string            required
category   string            default "Editorial"
year       string|number     optional
location   string            optional
cover      string (url)      required
excerpt    string            optional
featured   boolean           default false  # show on home
order      number            default 0      # sort key
gallery    string[] (urls)   default []
```
Body = Markdown, rendered on the detail page.

---

## 6. Pages (screen-by-screen)

### 6.1 Home - `/` (`src/pages/index.astro`)
1. **Hero** (`Hero.astro`)
   - Top meta row: `⚲ Warsaw, Poland` (left) · `Portfolio 2023/26 ✲` (right).
   - Giant brand wordmark `Dominik Sleczka`.
   - **Animated marquee**: horizontal auto-scrolling strip of ~12 portrait frames
     (duplicate the set and translateX -50% for a seamless loop). Grayscale →
     color + scale on hover; whole track pauses on hover. Edge fade mask.
2. **Highlighted captures** - eyebrow "Highlighted captures", title "Selected
   Works", 3-column grid of featured `WorkCard`s (numbered 01–03), "All works →"
   button.
3. **Services** (`Services.astro`) - eyebrow "Creative vision"; list rows (index,
   title, blurb) with a floating thumbnail that appears on row hover (desktop);
   rows indent on hover. Collapses to stacked list on mobile.
4. **Testimonials** (`Testimonials.astro`) - eyebrow "Client stories"; 3 quote
   cards, each with quote, avatar, name, company.
5. **CTA** - "Book your session" → Contact.

### 6.2 Works index - `/works` (`src/pages/works/index.astro`)
- Page head: eyebrow "Portfolio", big "Selected Works", lead sentence.
- **4-column** responsive grid of all works (→3 →2 on smaller screens), each a
  numbered `WorkCard` linking to detail. No filters (source has none; optional
  enhancement below).
- CTA "Let's capture your moments".

### 6.3 Work detail - `/works/[slug]` (`src/pages/works/[slug].astro`)
- `getStaticPaths` from the collection; computes prev/next (wrap-around).
- Header: "← All works", giant title, meta row (Category / Year / Location).
- Full-bleed cover image (16:10).
- Markdown body (max ~62ch, muted, emphasized text brightens).
- **Gallery**: 2-column image grid (from `gallery[]`).
- **Prev / Next** navigation footer.
- CTA "Like what you see?".

### 6.4 About - `/about` (`src/pages/about.astro`)
1. Hero: eyebrow `⚲ Based in Warsaw`, title "We are Dominik S", 6-frame
   image grid.
2. **Approach**: eyebrow "The Dominik approach", title "Visual Stories" + lead.
3. **Stats band**: 4 big numbers (from `stats`), bordered top/bottom.
4. **Process**: eyebrow "How we work", title "From idea to image", 3 columns
   (Explore/Define/Deliver) each with step number.
5. **Team**: eyebrow "Creative minds", 3 member cards (photo, name, role).
6. CTA "Let's make something".

### 6.5 Contact - `/contact` (`src/pages/contact.astro`)
- Hero: 3-frame image row, eyebrow "Get in touch", title "Let's talk
  photography", availability lead ("Open for selected editorial, campaign, and
  portrait projects…").
- Two-column body:
  - **Details:** email (big link), phone (big link), social links.
  - **Inquiry form:** name, email, project-type select, message; submit button.
    Wire to a form backend (Netlify Forms attr in this repo). Client + server
    validation, success/error states.
- **FAQ** (`FAQ.astro`): eyebrow "Common questions", accordion of 5 Q&As using
  `<details>` with a `+`→`×` rotate icon.

### 6.6 Licenses - `/licenses` (`src/pages/licenses.astro`)
- Simple legal page: imagery source note, theme license, client-work usage.
  Linked from footer only.

---

## 7. Reusable components summary
| Component | Purpose | Key props |
|-----------|---------|-----------|
| `Header` | sticky nav + mobile menu | - (reads `nav`, path) |
| `Footer` | site footer | - |
| `Hero` | home marquee hero | `images[]`, `title?` |
| `WorkCard` | portfolio thumbnail | `href, title, category, cover, index?` |
| `Services` | services list w/ hover thumb | reads `services` |
| `Testimonials` | quote cards | reads `testimonials` |
| `FAQ` | accordion | reads `faqs` |
| `CTA` | call-to-action band | `eyebrow, title, buttonLabel, buttonHref` |

---

## 8. Interactions & JS (minimal)
1. **Scroll reveal** - one IntersectionObserver in base layout; add `.reveal` to
   any element you want to animate in.
2. **Mobile menu** - toggle `.is-open` + `aria-expanded` on burger click.
3. **FAQ** - native `<details>`; CSS rotates the icon on `[open]`.
4. **Marquee** - pure CSS keyframe (`translateX 0 → -50%`), pause on hover.
5. **Contact form** - submit handler / backend integration.

No client framework, no hydration needed for any of the above.

---

## 9. SEO & meta
- Per-page `<title>` and `description`.
- Open Graph + Twitter card tags (add `og:image` per work for rich sharing).
- `sitemap.xml` (Astro `@astrojs/sitemap`) and `robots.txt`.
- JSON-LD: `LocalBusiness`/`Organization` on home; `CreativeWork` per work
  (optional, boosts rich results).
- Canonical URLs; set `site` in config.

---

## 10. Performance checklist
- Local, optimized images with explicit `width`/`height` + `srcset`/`sizes`.
- `loading="lazy"` below the fold; eager + `fetchpriority="high"` for LCP hero.
- Preconnect font origins; `font-display: swap`; subset fonts if possible.
- Ship ~no JS; inline the tiny scroll-reveal script.
- Target: Lighthouse 95+ across the board.

---

## 11. Build order (recommended)
1. Design tokens + global CSS + base layout.
2. Header + Footer + CTA (shared chrome).
3. Site config data model + works collection schema.
4. WorkCard → Works index → Work detail (prove the data pipeline).
5. Home (Hero marquee, featured grid, Services, Testimonials).
6. About (stats, process, team).
7. Contact (form + FAQ) + Licenses.
8. SEO, sitemap, image optimization, a11y + Lighthouse pass.
9. Replace placeholder images/copy with real content; deploy.

---

## 12. Optional enhancements (beyond the source)
- Category filter / tag pages on Works.
- Lightbox / fullscreen gallery viewer on work detail.
- Client proofing area (password-gated galleries).
- CMS backing (Sanity, Keystatic, TinaCMS) instead of Markdown.
- Light/dark toggle.
- View Transitions between work pages (Astro built-in).
- Blog / journal collection.
- i18n.

---

## 13. Content inventory to prepare
- Brand: name, ©/mark, tagline, city, portfolio year, since-year.
- ~12 hero images (portrait 3:4), 4+ works (cover + 2–3 gallery each).
- 5 service names + one-line blurbs + one image each.
- 4 stats, 3 process steps, 3 team members (photo/name/role).
- 3 testimonials (quote/name/company/avatar).
- 5 FAQs. Contact email + phone + social URLs. Licenses copy.

---

Everything above is implemented in this repo - use it as the working reference
while rebuilding.
