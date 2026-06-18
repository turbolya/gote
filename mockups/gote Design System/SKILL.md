---
name: gote-design
description: Use this skill to generate well-branded interfaces and assets for gote, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick reference
- **Brand:** gote — a playful iOS/Android app for learning to identify species from your iNaturalist observations. Mascot: a newt. Slick, modern, iOS-native.
- **Color:** brand cyan-teal `#008AAC` (`--primary`, shared with the app icon); deeper `#036178` for section labels; off-white `#FAFAF8` surfaces, white cards, near-black `#1A1D1A` text. Eight monotone accent tints. Full dark theme.
- **Type:** iOS system face (SF Pro). Weight-driven hierarchy — black 900 display, heavy 800 headings/buttons, bold 700 rows. Uppercase tracked section labels only.
- **Icons:** Ionicons (UI) + Material Design Icons (taxa); the newt silhouette for amphibians. No emoji.
- **Shape:** heavily rounded (16px buttons, 999px pills), hairline-divided lists, soft neutral shadows, one green-tinted shadow on the primary CTA. Full-bleed blurred photo backdrops on the quiz.
- **Voice:** lowercase "gote", second person, short and encouraging, sentence case, no emoji.

## Files
- `styles.css` — link this; pulls in all tokens (`tokens/*.css`).
- `readme.md` — full brand, content, visual and iconography guidance.
- `components/**` — reusable React primitives (load `_ds_bundle.js`, read from `window.GoteDesignSystem_1d5a8c`).
- `ui_kits/app/` — interactive recreation of the app (menu, quiz, results, lexicon).
- `guidelines/*.card.html` — foundation specimen cards.
- `assets/` — newt mark (`newt.svg`, tintable), app icon, logo, splash.
