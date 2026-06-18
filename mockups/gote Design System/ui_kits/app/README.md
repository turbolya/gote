# gote — iOS app UI kit

A high-fidelity, click-through recreation of the gote mobile app, composed from
the design-system tokens. Open `index.html` for the interactive prototype.

## Flow
`Menu → (pick a play mode) → Quiz → Results`, plus `Menu → Lexicon`.

- **MenuScreen** — full-bleed green hero (account + recent-accuracy bar chart)
  collapsing over a hairline-divided list of play/learn/settings rows.
- **StudyScreen** — the quiz. A blurred + darkened photo fills the screen with
  the full image shown `contain` on top; white chrome rides on protection
  gradients. Multiple-choice flow: *Show choices → pick → graded (green/red) →
  Next card.*
- **ResultsScreen** — grade badge, big percentage, tinted secondary actions,
  emphasized "Main menu" CTA, and a missed-species list.
- **LexiconScreen** — searchable species list with status filter chips and
  taxon-group thumbnails.

## Notes
- **Photos are placeholders.** The quiz pulls keyword-matched nature images from
  loremflickr (falling back to picsum), standing in for the iNaturalist
  observation photos the real app downloads from each user's account.
- **Icons:** Ionicons (UI) via CDN; Material Design Icons webfont for taxon
  glyphs; the brand newt silhouette (`assets/newt.svg`) for amphibians.
- Screens mirror `src/screens/*` from the source repo but are simplified,
  mainly-cosmetic versions — they are recreations, not the production code.

## Source files
`data.js` (sample species/quiz data + helpers) · `ui.jsx` (shared chrome &
mini-primitives) · `MenuScreen.jsx` · `StudyScreen.jsx` · `ResultsScreen.jsx` ·
`LexiconScreen.jsx` · `index.html` (frame + state machine).
