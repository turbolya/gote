# gote — Design System

**gote** is an iOS (and Android) app for playfully learning to identify the
animals and plants you've seen. It pulls your **iNaturalist** observations and
quizzes you on the species in your own backyard — a card game built from real
data, with a slick, modern, iOS-native feel. The mascot is a **newt**, drawn as
a single clean silhouette.

This design system captures gote's brand, visual foundations, reusable
components, and a click-through recreation of the app, so any agent can produce
on-brand gote artifacts — production UI or throwaway mocks.

## Sources

- **GitHub:** [`turbolya/gote`](https://github.com/turbolya/gote) — the Expo
  (React Native) app. Tokens lifted from `src/theme.js`; screens recreated from
  `src/screens/*` and `src/components/*`; mascot from `assets/`. Explore the
  repo for deeper fidelity when building new gote work.
- The app uses the [iNaturalist v2 API](https://api.inaturalist.org/v2/docs/)
  for species data and photos.

> The reader is not assumed to have repo access; everything needed to design
> for gote lives in this project.

---

## Content fundamentals

How gote writes, in its own voice:

- **The brand name is lowercase "gote"** in prose, though the app's hero title
  renders it as **"Gote"** (capitalized, because it sits alone as a wordmark).
- **Second person, warm and direct.** Copy talks to *you* about *your* species:
  "Browse all your species", "Learn species typical to a place", "See a photo,
  choose its name."
- **Short, plain, encouraging.** Mode subtitles are one clause, no period:
  "Endless cards — survive 3 misses", "Choose how many cards and which groups".
- **Praise scales with performance**, never sarcastic: *Outstanding!* → *Great
  job!* → *Nice work — keep going!* → *Keep practicing!*
- **Sentence case everywhere** for titles and buttons ("Main menu", "Play
  again", "Revisit missed"). The only uppercase is the small tracked-out
  **section labels** ("PLAY", "LEARN", "SETTINGS").
- **Gentle, low-pressure tone.** A missed answer reads "It was Eastern Newt",
  not "Wrong". The donation link is deliberately quiet: "Buy me a coffee".
- **No emoji.** Meaning is carried by Ionicons glyphs and the accent color
  system, never emoji. Scientific names are shown in *italics* beside the common
  name.
- **Numbers are concrete and personal:** "72% lifetime accuracy · 410/570",
  "570 cards". Em dashes and middots (·) are common connectors.

---

## Visual foundations

**Palette.** The product color is a **cyan-teal** (`#008AAC`, `--primary`) — the
same teal as the app-icon field, so the mark and the in-app UI now share one
signature color. A darker `#036178` (`--primary-dark`) carries section labels and
pressed states. Surfaces are a soft
off-white (`#FAFAF8`) with pure-white cards, near-black text (`#1A1D1A`), a
neutral gray for secondary text (`#8A8F86`), and a barely-there `#F0F1ED` for
sunken fills and pressed states. State colors: green `--correct`, red `--wrong`,
amber `--flag`. A full **dark theme** mirrors every token. Eight **monotone
accent tints** (green/blue/violet/amber/teal/indigo/rose/slate), each a colored
glyph on a soft tile, color-code the menu rows and taxon groups.

**Type.** No custom webfont — gote uses the **iOS system face (SF Pro)** via the
Apple system stack. Hierarchy is driven by **weight, not typeface**: black (900)
for the hero wordmark, big scores and revealed species names; heavy (800) for
headings, button labels and the tracked-out uppercase section labels; bold (700)
for list-row titles and counters; semibold (600) for subtitles. Display sizes
tighten letter-spacing (`-0.03em` on the 56px result percentage); section labels
open it up (`+0.06em`).

**Backgrounds & imagery.** Two background worlds: (1) clean off-white screens
with hairline-divided lists, and (2) **full-bleed photography** on the quiz —
the species photo fills the screen as a blurred, darkened backdrop with the full
image shown `contain` on top, so the whole screen takes on the photo's colors.
The **teal hero gradient** (`#17A7C6 → #008AAC → #02485A`, diagonal) is the one
decorative gradient; there are **no purple/blue tech gradients, no textures, no
patterns.** Imagery is real iNaturalist nature photography — warm, naturalistic,
never filtered to mono.

**Protection & chrome.** Over photos, white chrome rides on **scrim gradients**
(top: black→transparent; bottom: transparent→black) plus a flat 40%-black
darkening over the blurred layer, so white text and outline buttons stay legible
on any photo. Active answer UI sits in a centered translucent-black panel
(`rgba(0,0,0,0.32)`, 20px radius).

**Corners & cards.** Heavily rounded. Buttons 16px, choice chips 14px, centered
panels/sheets 20px, and **full pills (999px)** for stat chips, the round
back/close buttons, avatars and progress tracks. Cards are plain white with a
hairline `#E7E8E3` border or a soft neutral shadow — **never** a colored
left-border accent.

**Shadows.** Soft, low-contrast, neutral: a faint card shadow, a `0 4px 12px /
18%` shadow that fades in as the hero banner collapses, and one **color-tinted
shadow** — teal `rgba(0,138,172,0.35)` — reserved for the single emphasized
primary CTA per screen.

**Spacing & layout.** A 4px-based rhythm; **20px** is the default screen
horizontal padding (24px on results). Lists are flat groups divided by
hairlines with a leading accent glyph, a title + quiet subtitle, and a trailing
chevron. The menu hero is a fixed full-bleed element that **collapses on
scroll**; sub-screens use a fixed top header (round back button · centered title
· spacer).

**Motion.** Restrained and physical. The hero height/opacity/shadow interpolate
continuously with scroll; buttons and rows respond to press with an **opacity
dip** (rows to ~0.5, buttons ~0.7) rather than scaling; progress fills animate
width. No bounce, no infinite loops, no flashy entrances.

**Hover/press.** Touch-first: the primary feedback is the press opacity dip
above. There is no desktop hover vocabulary in the app itself.

---

## Iconography

- **UI icons: [Ionicons](https://ionic.io/ionicons)** — a modern, rounded,
  iOS-native set. The app maps familiar Feather-style names to Ionicons
  centrally (`src/components/Icon.js`); outline variants for navigation/inactive
  (`settings-outline`, `chevron-back`, `search-outline`), solid for emphasis
  (`star`, `heart`, `flash`, `flag`). Load from CDN:
  `https://cdn.jsdelivr.net/npm/ionicons@7.4.0/...`; use `<ion-icon name="…">`.
- **Taxon-group icons: Material Design Icons** (the app uses
  MaterialCommunityIcons + a FontAwesome5 frog). Leaf (plants), bird, bee
  (insects), mushroom (fungi), paw (mammals), turtle (reptiles), snail
  (mollusks). In this system they're rendered via the **@mdi/font** webfont
  (`mdi mdi-leaf`, …); **amphibians use the brand newt silhouette** since no
  webfont has a good newt/frog glyph.
- **No emoji, no unicode-glyph icons.** Everything is a real vector icon.
- **Logos / mark:** `assets/newt.svg` is the tintable single-path newt
  (recolor via `fill`/`currentColor` or a CSS mask). `assets/app-icon.png` is
  the finished app icon (white newt on teal). `assets/gote.png` is the white
  in-app logo; `assets/gote-splash.png` the splash. Copy these into artifacts
  rather than redrawing.

---

## Index / manifest

**Foundations**
- `styles.css` — the single entry point (link this); `@import`s all tokens.
- `tokens/colors.css` · `tokens/accents.css` · `tokens/typography.css` ·
  `tokens/spacing.css` — the token layer (base values + semantic aliases).
- `guidelines/*.card.html` — foundation specimen cards (Colors, Type, Spacing,
  Brand) shown in the Design System tab.

**Components** (`window.GoteDesignSystem_1d5a8c.*`, via `_ds_bundle.js`)
- `components/buttons/` — **Button**, **IconButton**
- `components/data-display/` — **ListRow**, **SectionLabel**, **StatPill**
- `components/quiz/` — **ChoiceButton**, **ProgressBar**

**UI kit**
- `ui_kits/app/` — interactive iOS-app recreation (`index.html`): menu, quiz,
  results, lexicon.

**Assets** — `assets/` (newt mark, app icon, logo, splash).

**Skill** — `SKILL.md` (Agent-Skills-compatible entry point).
