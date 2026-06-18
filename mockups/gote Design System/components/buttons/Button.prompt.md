One-line: gote's action buttons — a heavy, rounded, usually full-width control with optional Ionicons glyphs; use for any tappable primary/secondary action.

```jsx
<Button variant="primary" icon="home">Main menu</Button>
<Button variant="tinted" tone="primary" icon="play">Play again</Button>
<Button variant="tinted" tone="orange" icon="eye-outline">Revisit missed (3)</Button>
<Button variant="success" icon="checkmark">I knew it</Button>
<Button variant="danger" icon="close">Missed it</Button>
<Button variant="outline">Reveal answer</Button>  {/* over a photo */}
```

Notes:
- `primary` carries a green-tinted shadow and the heaviest weight; it's the one emphasized action per screen.
- `tinted` is the soft secondary action (light fill + colored text); pick `tone` primary (teal) or orange.
- `success`/`danger` are the solid self-grade buttons; `outline` (white 2px border) is for chrome laid over fullscreen photos.
- Glyph names are Ionicons — load the ionicons CDN on the page.
