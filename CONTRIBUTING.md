# Contributing to gote

Thanks for taking an interest. Bug reports, ideas and pull requests are all
welcome.

## Licensing of contributions

**By submitting a pull request you agree that your contribution is licensed
under the [GNU Affero General Public License v3.0](LICENSE) *together with* the
[app-store additional permission](LICENSE-EXCEPTION), on the same terms as the
rest of the project.**

That second half matters. gote ships through the Apple App Store and Google
Play, whose terms conflict with parts of the AGPL-3.0 — the permission in
`LICENSE-EXCEPTION` is what makes that distribution consistent with the
license. The permission has to cover *every* copyright holder in the codebase,
so a contribution offered under the plain AGPL-3.0 alone can't be merged; it
would make the app undistributable through the stores it's built for.

Nothing here asks you to assign copyright. You keep it — you're granting the
same licence the project already runs on.

## Before you open a pull request

```bash
npm test            # unit + WCAG contrast suites (105 tests)
npx expo-doctor     # dependency/config health
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
