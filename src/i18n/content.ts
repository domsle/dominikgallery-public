import type { ImageMetadata } from 'astro';
import type { Lang } from './ui';
import { defaultLang } from './ui';
import { pricing } from '../site.config';

// Service imagery = real gallery covers (language-neutral).
import { seriesById } from '../data/gallery';

export interface Service { title: string; blurb: string; img: ImageMetadata; }
export interface Stat { value: string; label: string; }
export interface ProcessStep { step: string; title: string; blurb: string; }
export interface TeamMember { name: string; role: string; img: ImageMetadata; }
export interface SessionStep { lead: string; body: string; }
export interface SessionInfo { heading: string; steps: SessionStep[]; }
export interface Faq { q: string; a: string; }

interface LocaleContent {
  services: Service[];
  stats: Stat[];
  process: ProcessStep[];
  team: TeamMember[];
  session: SessionInfo;
  faqs: Faq[];
}

// Portraits → portraits cover · Couple Sessions → light/motion cover · Events → acroyoga cover.
const fallback = seriesById.values().next().value!.cover;
const cover = (id: string) => seriesById.get(id)?.cover ?? fallback;
const serviceImgs = [cover('portraits'), cover('misc'), cover('acroyoga')];

// Price is a single config value - never hardcode the number in copy.
const amount = `${pricing.portraitFrom} ${pricing.currency}`;

const content: Record<Lang, LocaleContent> = {
  en: {
    services: [
      { title: 'Portraits', blurb: 'Relaxed portraits of people as they are - no stiff poses, just you.', img: serviceImgs[0] },
      { title: 'Couple Sessions', blurb: 'Quiet places, subtle emotions, glances full of warmth and closeness.', img: serviceImgs[1] },
      { title: 'Events', blurb: 'Gatherings and celebrations, remembered the way they felt.', img: serviceImgs[2] },
    ],
    stats: [],
    process: [
      { step: '01', title: 'Talk', blurb: 'We start by shaping your vision - what the shoot should give you - with no pressure and no jargon.' },
      { step: '02', title: 'Shoot', blurb: 'During the shoot I keep things relaxed, so you feel like yourself.' },
      { step: '03', title: 'Photos', blurb: 'You get a hand-picked, edited set of photos to keep and share.' },
    ],
    team: [],
    session: {
      heading: 'You don’t need experience in front of a camera',
      steps: [
        { lead: 'We talk.', body: 'You write on Instagram or by email. We work out what the photos are for and how you’d like them to feel.' },
        { lead: 'We plan the place and the look.', body: 'What you feel good in, where we go. I’ll usually suggest somewhere; if you already have an idea, we start from that.' },
        { lead: 'We start slowly.', body: 'The first part of the session is conversation - that’s why sessions aren’t rushed. By the time the camera matters, the first few minutes are behind you.' },
        { lead: 'We shoot.', body: 'I know the route and the spots worth stopping at. If someone’s helping me carry gear or hold light, you’ll know beforehand.' },
        { lead: 'You get the photos.', body: 'At least 15, edited, full resolution, within two weeks.' },
      ],
    },
    faqs: [
      { q: 'How do you work?', a: "Unhurried - we talk first, then shoot. I'll show you photos as we go." },
      { q: 'How much does a shoot cost?', a: `Portraits start at ${amount}; longer sessions and events are quoted individually.` },
      { q: 'What do I get?', a: 'About 90 minutes together, plus at least 15 edited photos within two weeks.' },
      { q: 'Where are you based?', a: "Warsaw - in places I know well, or wherever you have in mind." },
      { q: 'What do you photograph?', a: "Mostly portraits and small events - but tell me your idea." },
    ],
  },
  pl: {
    services: [
      { title: 'Portrety', blurb: 'Swobodne portrety ludzi takich, jacy są - bez sztywnych póz, po prostu Ty.', img: serviceImgs[0] },
      { title: 'Sesje Par', blurb: 'Ciche miejsca, subtelne emocje, spojrzenia pełne ciepła i wzajemności.', img: serviceImgs[1] },
      { title: 'Wydarzenia', blurb: 'Spotkania i uroczystości zapamiętane tak, jak były odczuwane.', img: serviceImgs[2] },
    ],
    stats: [],
    process: [
      { step: '01', title: 'Rozmowa', blurb: 'Zaczynamy od ustalenia twojej wizji - tego co sesja ma ci dać - bez presji i żargonu.' },
      { step: '02', title: 'Sesja', blurb: 'W trakcie sesji dbam o swobodę, abyś czuł/czyła się sobą.' },
      { step: '03', title: 'Zdjęcia', blurb: 'Dostajesz wybrany, obrobiony zestaw zdjęć do zachowania i dzielenia się.' },
    ],
    team: [],
    session: {
      heading: 'Nie musisz mieć doświadczenia przed aparatem',
      steps: [
        { lead: 'Rozmawiamy.', body: 'Piszesz na Instagramie albo mailem. Ustalamy, do czego mają być te zdjęcia i jak mają działać.' },
        { lead: 'Planujemy miejsce i to, jak chcesz wyglądać.', body: 'W czym czujesz się dobrze, dokąd idziemy. Zwykle proponuję miejsce; jeśli masz swój pomysł, zaczynamy od niego.' },
        { lead: 'Zaczynamy spokojnie.', body: 'Pierwsza część sesji to rozmowa - dlatego sesje nie są w pośpiechu. Zanim aparat zacznie mieć znaczenie, pierwsze minuty masz już za sobą.' },
        { lead: 'Fotografujemy.', body: 'Znam trasę i miejsca, w których warto się zatrzymać. Jeśli ktoś mi pomaga nieść sprzęt albo trzymać światło, wiesz o tym wcześniej.' },
        { lead: 'Dostajesz zdjęcia.', body: 'Co najmniej 15, wyretuszowanych, w pełnej rozdzielczości, w ciągu dwóch tygodni.' },
      ],
    },
    faqs: [
      { q: 'Jak pracujesz?', a: 'Bez pośpiechu - najpierw rozmawiamy, potem fotografujemy. Zdjęcia pokazuję na bieżąco.' },
      { q: 'Ile kosztuje sesja?', a: `Sesje portretowe od ${amount}; dłuższe sesje i wydarzenia wyceniam indywidualnie.` },
      { q: 'Co dostaję?', a: 'Około 90 minut razem i co najmniej 15 wyretuszowanych zdjęć w ciągu dwóch tygodni.' },
      { q: 'Gdzie fotografujesz?', a: 'W Warszawie - w miejscach, które dobrze znam, albo tam, gdzie zechcesz.' },
      { q: 'Co fotografujesz?', a: 'Głównie portrety i kameralne wydarzenia - ale chętnie posłucham Twojego pomysłu.' },
    ],
  },
};

export const getContent = (lang: Lang): LocaleContent => content[lang] ?? content[defaultLang];
