One-line: gote's tappable list row — accent glyph, title + subtitle, trailing chevron; the backbone of the menu and settings screens.

```jsx
<SectionLabel>Play</SectionLabel>
<div>
  <ListRow icon="albums-outline" accent="green" title="By name" sub="See a photo, choose its name" onClick={...} />
  <ListRow divider icon="apps-outline" accent="blue" title="By picture" sub="See a name, choose its photo" />
  <ListRow divider icon="flash" accent="amber" title="Speedrun" sub="Endless cards — survive 3 misses" />
</div>
```

Notes: set `divider` on every row after the first so groups read as one hairline-divided block. `accent` tints just the glyph. Pass `trailing` to swap the chevron (e.g. a flag toggle in the results "missed" list).
