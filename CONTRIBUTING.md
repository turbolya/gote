# Contributing to gote

Thanks for taking an interest. Bug reports, ideas and pull requests are all
welcome.

## Licensing of contributions

**By submitting a pull request you agree to both of the following.**

**1. Your contribution is licensed under the [GNU Affero General Public License
v3.0](LICENSE) *together with* the [app-store additional
permission](LICENSE-EXCEPTION), on the same terms as the rest of the project.**

That second half matters. gote ships through the Apple App Store and Google
Play, whose terms conflict with parts of the AGPL-3.0 — the permission in
`LICENSE-EXCEPTION` is what makes that distribution consistent with the
license. The permission has to cover *every* copyright holder in the codebase,
so a contribution offered under the plain AGPL-3.0 alone can't be merged; it
would make the app undistributable through the stores it's built for.

**2. You additionally grant the project maintainer a perpetual, worldwide,
non-exclusive, royalty-free, irrevocable licence to reproduce, modify, publicly
perform and display, sublicense and distribute your contribution and works
based on it — including under licence terms other than the AGPL-3.0, and
including as part of a proprietary or store-distributed binary. You confirm you
are legally entitled to grant this: the contribution is your own work, or you
have the rights to submit it, and it is not encumbered by an employer or by a
third party's licence.**

### Why the second grant exists

The app stores are the awkward case again, from the other direction. Publishing
a binary through them means accepting terms — device limits, store signing —
that the AGPL-3.0 would otherwise forbid imposing on the people who receive it.
There are two ways to reconcile that, and the project keeps both open:

- `LICENSE-EXCEPTION`, which lets *anyone* redistribute gote through a store;
  and
- the maintainer's own position as a copyright holder, which lets *them* ship a
  store build under the store's standard end-user licence.

The second route only works while the maintainer holds the rights to the whole
codebase. Without grant 2, every merged contribution would carve out a piece
they could not relicense, and the route would close quietly — one pull request
at a time, with nobody noticing until a store's terms changed and it was too
late to react.

### What this does NOT do

- **You keep your copyright.** This is a licence you grant, not an assignment.
  You remain free to use, relicense and republish your own contribution however
  you like, including in other projects.
- **It does not make gote proprietary.** The source stays AGPL-3.0 here, and
  every obligation of that licence continues to apply to the project as
  published. Grant 2 is about what the maintainer *may* do, not a statement
  that they will.
- **It does not let the maintainer relicense your work on its own.** The grant
  covers use of your contribution as part of gote.

If you are not comfortable with grant 2, please say so in the pull request
rather than quietly skipping it. A contribution can still be discussed, and
small fixes can often be reimplemented independently — what cannot happen is
merging it while the question is unresolved.

> Not lawyer-vetted. This wording is adapted from the shape common to
> contributor licence agreements in open-source projects, and is part of what
> the pre-release legal review is meant to check.

## Before you open a pull request

```bash
npm test            # unit, contrast and merge suites (145 tests)
npx expo-doctor     # dependency/config health
```

If you touched anything under `src/sync/`, run the integration suite too — it
drives the real push/pull code against a local Postgres with row-level security
on, which is where sync bugs actually live:

```bash
npx supabase start && npm run test:sync && npx supabase stop
```

If you touched anything the end-to-end tests cover, run those too — they need a
macOS machine with Xcode:

```bash
npm run e2e:build
npm run e2e:test
```

See [`e2e/README.md`](e2e/README.md) for the one-time Detox setup.

## House rules

- **Colours go through `src/theme.js`.** `scripts/test-contrast.js` asserts every
  pairing against WCAG AA in both light and dark; a raw hex in a component will
  bypass that check and eventually fail someone's accessibility needs.
- **`ios/` and `android/` are generated** by `expo prebuild` and gitignored.
  Change `app.json`, a config plugin, or `targets/` instead — never the native
  projects directly.
- **Every user-visible change gets a `src/changelog.js` entry** and a version
  bump in both `app.json` and `package.json`; the three must agree.
- Pure logic belongs in a testable module (`src/quiz.js`, `src/lexicon.js`,
  `src/gestures.js` …) with a matching runner in `scripts/`, rather than inside
  a component.

## Reporting bugs

Open an issue with the device, OS version, app version (Settings ▸ About) and
the steps to reproduce. If it involves species data, the iNaturalist username
and the observation or taxon id help a lot.

## Architecture

[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) covers the data flow, the
iNaturalist API surface, the caching model and the Apple Watch companion.
