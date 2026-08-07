# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

<!-- The design surface owned by this record is the marketing website
(goteapp.com). The product itself is a native iOS / iPadOS / Android / Apple
Watch app; the site's job is to represent it truthfully and get people to
download it. Native app UI is out of scope here — see Operating Context. -->

## Users

**Website visitor (the surface's audience):** someone deciding whether to
install gote — typically arriving from an app-store link, the iNaturalist
community, word of mouth, or the GitHub repo. They want to quickly understand
what the app is, see it's real, and trust it before downloading.

**The product's end users** (whom the site must speak to): naturalists,
birders, and nature-curious learners who keep meeting organisms they can't yet
name — "the birders, the plant people, and anyone who's ever crouched over
something small and wondered what on earth it was." Also students learning
local flora and fauna, and iNaturalist users who want to actually *learn* the
species they've observed rather than just log them. Their situation: they see
things in the field and want recognition to become automatic. Their job: build
reliable recall so they can identify species on sight.

## Product Purpose

gote turns real nature observations into quick flashcard rounds so people learn
to recognize species on sight — a fun few-minutes-a-day habit rather than a
cram session. It teaches identification instead of doing it for you.

Website success = a visitor understands the app, trusts it, and downloads it
(secondary: stars the repo or tips on Ko-fi). Product success = the learner can
reliably name the species they care about.

## Positioning

A **powerful, deeply tweakable learning tool**, not a casual auto-identifier.
The defensible combination a neighboring product could not truthfully copy:

- Quizzes are built from **real iNaturalist field photos**, and the wrong
  answers are **genuine look-alike species** — so you learn to tell confusable
  species apart, not just match a picture to a label.
- **Deep, per-species analytics** (success %, correct/incorrect, streak,
  accuracy trend) plus heavy configurability (custom decks, six modes, taxon
  groups, search radius) make it a serious study instrument.
- It can draw from **your own observations** and a chosen place, so you study
  what you actually encounter.

Contrast with Seek / Merlin / Picture This, which mostly *perform* the ID for
the user. gote's mechanism is the opposite: it trains the user's own eye.

## Operating Context

The website must portray these real app capabilities accurately (no invented
features):

- **Play modes (6):** By name (photo → pick the name), By picture (name → pick
  the photo), Speedrun (timed; survive 3 misses), Flash cards (reveal, then
  self-grade), Nearby species (map + search radius + taxon-group filters, drawn
  from all iNaturalist observers at a place), Custom game (choose card count and
  groups).
- **Learn / track:** Lexicon (searchable list of every species seen, filterable
  by how well known); Statistics (accuracy, daily streak, recent-games chart,
  running accuracy trend, and a per-species table with success %, correct, and
  incorrect, plus a "My observations" filter). Aggregates are counted **per
  card, not per round**, so a one-card round can't score a full 100%, and the
  per-species ranking discounts thin samples so a species answered once doesn't
  outrank one answered right forty times.
- **Apple Watch:** a quick photo quiz on the wrist and accuracy/streak
  complications on the watch face.
- **Source data:** the iNaturalist API and photos from iNaturalist observers,
  used under each observer's license; every photo credits its photographer.
  Users can start from a sample set or study their own iNaturalist observations.
- **Cross-device sync:** optional and strictly opt-in (off by default),
  anonymous by default with optional email device-linking; stores stats and
  settings only. In-app account deletion is provided.
- **Availability:** iPhone, iPad, Android, Apple Watch. **Pre-launch** — the app
  is "coming soon" to the App Store and Google Play, not yet released.

## Capabilities and Constraints

- Free, no ads, no account required to play; sync and accounts are optional.
- **Open-source** under AGPL-3.0 (with an App Store distribution exception).
- Website stack: **Jekyll on GitHub Pages**, custom domain **goteapp.com**,
  auto-published on every push to `main` (no review step — edits go live).
  Pages are self-contained; the site mirrors the app's design tokens
  (`src/theme.js`), self-hosts the Fredoka wordmark font, and is theme-aware
  (light/dark via `prefers-color-scheme` + a `data-theme` toggle). No Jekyll
  installed locally — preview is via a static server with manual Liquid
  substitution, so live-mode iteration isn't wired up.
- Legal: gote is an **independent, unofficial app — not created by** iNaturalist,
  the California Academy of Sciences, or the National Geographic Society;
  "iNaturalist" is a trademark of its owners.

## Brand Commitments

- **Name:** `gote`, always lowercase.
- **Wordmark:** set in **Fredoka** (SemiBold), self-hosted; used for the "gote"
  logotype only, not body text.
- **Mascot / logo:** a **newt** (app icon + hero image, `assets/gote.png`).
  ("gőte" is Hungarian for newt.)
- **Brand color:** teal — `--brand: #008AAC` (light) / `#34C2E0` (dark); hero
  gradient `#17A7C6 → #008AAC → #02485A`. Full token set mirrors `src/theme.js`.
- **Voice:** warm, humane, plain-spoken, quietly witty — and deliberately
  **not** markety or generic-AI. Established anti-patterns to avoid: emoji-in-
  rounded-square feature-card grids, hype adjectives, repetitive blurbs. Prefer
  specific, concrete, human lines (e.g. "For the perpetually curious.").
- **Tone:** calm, photo-first, confident, unpretentious.

## Evidence on Hand

- **Live site:** https://goteapp.com (landing + `/PRIVACY.html`), served from the
  public repo github.com/turbolya/gote.
- **Real app screenshots** (device-framed on the site) in
  `assets/screenshots/`: `quiz`, `stats`, `analytics`, `nearby`, `watch-play`,
  `watch-face` — captured from a seeded demo build (the `mate_koch` account:
  ~78% accuracy, 1,713 cards answered, 47 species, 12-day streak).
- **Logo/hero:** `assets/gote.png`, `assets/app-icon.png`. **Font:**
  `assets/fonts/Fredoka-SemiBold.ttf`.
- **Privacy policy:** `PRIVACY.md` (hosted at goteapp.com/PRIVACY.html).
- **Support:** Ko-fi — https://ko-fi.com/goteapp.
- **Do not fabricate:** the app is **pre-launch**, so there are no App Store /
  Play Store listing URLs yet, and there are **no testimonials, user counts,
  ratings, or press**. Roadmap items (shareable custom decks, spaced repetition,
  adaptive sessions) are **planned, not shipped**, and must always be labeled as
  such. Never invent store links, reviews, or metrics.

## Product Principles

1. **Teach recognition, don't automate it.** gote trains the user's own eye; it
   is not an auto-identifier. Features should build skill, not replace it.
2. **Real over synthetic.** Real field photos, real look-alike distractors, and
   the user's own observations are the pedagogy — authenticity is the point.
3. **Depth without friction.** Powerful and tweakable (modes, custom decks, deep
   stats), yet a round is always a few taps away; never gate play behind setup,
   accounts, or payment.
4. **Honest and independent.** Free, no ads, privacy-first, opt-in sync,
   open-source; unofficial and never implying iNaturalist endorsement; never
   manufacture proof before launch.
5. **Credit the commons.** Photos and data come from iNaturalist's community;
   always attribute and respect each observer's license.

## Accessibility & Inclusion

No formal standard was set, but color contrast is a demonstrated commitment (the
app ships a contrast test), and the website is theme-aware for light and dark.
Future web work should keep text and interactive contrast legible in both themes.

## Parking Lot

Ideas noted but not scheduled — no commitment, revisit when the trigger below hits.

### Supabase free-tier storage headroom
Context (measured 2026-08-01): the append-only `events` log costs **~1.2 KB per
finished round** (12 species with names + iNat photo URLs, indexes + TOAST
included; no vacuum bloat since the table has no UPDATE/DELETE). The free tier's
500 MB holds **~350k rounds ever** (cumulative — rounds are never deleted), which
is 1–3+ years for a small engaged base but only weeks-to-months past ~500–1,000
regularly-active users. Levers, cheapest first:

- **Anonymous-user cleanup.** Every install that turns on sync mints an anonymous
  `auth.users` row; signing in on a second device orphans one, and Supabase never
  deletes them. A scheduled job removing anonymous users with no email and no
  recent activity keeps the auth schema from quietly dominating the 500 MB.
- **Event compaction — the real scaling lever.** The accuracy chart only shows the
  last 120 bars, and totals/species/confusions/days are all cumulative, so a
  trusted server-side job (`pg_cron`) can fold each user's *old* rounds into their
  baseline (sum totals, keep the last 120 bars + all days) and delete the folded
  rows — turning unbounded growth into bounded per-user storage. The history/days
  baseline (events payload v3, 2026-08-01) is the vehicle for this; a compaction
  job must carry `counts` alongside `history` (payload v4, 2026-08-02) or the
  folded bars lose their weights and the trend line drifts off the totals again.
- **Store photo IDs, not full URLs**, in the `species` delta and rebuild the URL
  client-side: ~40% smaller blobs (~0.7 KB/round).
- Fallback: Pro tier ($25/mo) → 8 GB, ~16× the headroom.

### Confusion *groups*, not just pairs
Real ID confusion is rarely two species — it is a blob. Gulls, warblers, yellow
composites, brown mushrooms: the learner has N look-alikes that all read the
same, and being shown them two at a time understates the problem.

The data already supports this. `confusions` is
`{ correctKey: { chosenKey: count } }` — a **directed weighted graph**; only the
reading is pairwise (`topConfusionPairs` renders edges). Groups are: symmetrise
(a↔b = both directions summed), threshold, take connected components.

Three things to settle before building it:

- **The transitivity trap is the real risk.** A~B and B~C does not imply A~C.
  Naive connected components snowball into one mega-cluster labelled "everything
  is confusing" — useless, and slightly insulting. Needs a density guard: each
  member must have ≥2 edges *inside* the group, or cap the size.
- **Evidence cost grows fast.** A pair needs 3 mistakes on one edge; a credible
  triangle needs evidence on three edges, from rounds where those species
  actually co-occurred as options. Genuine groups would surface rarely and late.
- **Taxonomy can substitute for the missing data.** Cards carry `ancestry`, and
  two confirmed edges among congeneric species is far more trustworthy than two
  across families. A genus/family prior lets a group be proposed on thinner
  evidence — exactly where the sparsity bites.

What makes it cheap: **the drill already exists.** The A/B duel is inherently
2-up, but an N-species drill is just a normal multiple-choice round with the pool
restricted to the group's members, which `startPicked` already does. So detection
plus a "Drill this group" button reuses the round machinery rather than adding a
mode.

Trigger: revisit once there is enough real play to see whether triangles actually
appear at the current 3-mistake threshold — if they never do, the taxonomic prior
is the feature, not the graph.
