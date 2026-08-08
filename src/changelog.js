// Single source of truth for the app version and release notes. The version
// here must match app.json / package.json (kept in sync manually on each
// release). The Settings → Changelog screen renders these entries.
//
// Versioning (semver-ish for an app):
//   • major (X.0.0) — big redesigns or breaking changes to saved data
//   • minor (1.X.0) — new features / game modes / screens
//   • patch (1.0.X) — bug fixes and small tweaks
// Newest entry first.

export const APP_VERSION = '2.37.4';

export const CHANGELOG = [
  {
    version: '2.37.4',
    date: '2026-08-08',
    changes: [
      'Groundwork for smarter review: gote now remembers when you last answered '
        + 'each species and roughly how long your answers take. Nothing uses it '
        + 'yet — it is being recorded because a future "show me this again just '
        + 'before I forget it" feature needs history that can only be gathered '
        + 'from now on. Answers that take longer than a minute are ignored '
        + 'rather than recorded, and it is covered in the privacy policy.',
    ],
  },
  {
    version: '2.37.3',
    date: '2026-08-08',
    changes: [
      'Reset statistics now really resets the streak on synced devices. It used '
        + 'to clear the streak counter but keep the record of days you had '
        + 'played, so the next sync quietly rebuilt the streak from those days '
        + 'and the reset looked like it hadn’t stuck.',
    ],
  },
  {
    version: '2.37.2',
    date: '2026-08-03',
    changes: [
      'Fixed a serious sync bug: statistics could be counted twice. Signing in '
        + 'on another device, or turning sync off and on again, made the app '
        + 're-read your whole synced history and add it on top of the totals it '
        + 'already had — so two devices drifted further apart the more you tried '
        + 'to fix them. Each device now remembers how far it has read for each '
        + 'account separately, and never applies the same round twice.',
      'Turning sync off and on no longer re-uploads your history every time. It '
        + 'used to send a fresh copy on each cycle, inflating the numbers on your '
        + 'other devices.',
      'If your totals are already wrong from this, Statistics → Reset statistics '
        + 'on the affected device and let it sync again.',
      'Sync now also recovers if your synced data disappears from the server — '
        + 'your device notices the account is empty and re-sends its history, '
        + 'instead of both sides waiting for the other forever.',
    ],
  },
  {
    version: '2.37.1',
    date: '2026-08-03',
    changes: [
      'Swiping right from the left edge to go back now works on every page that '
        + 'has a back button. It was missing on “Sync across devices”, where the '
        + 'gesture quietly did nothing.',
    ],
  },
  {
    version: '2.37.0',
    date: '2026-08-02',
    changes: [
      'Your accuracy trend is now weighted by how many cards each round had. '
        + 'Before, every game counted the same, so quitting a round after one '
        + 'lucky card scored a full 100% and pulled the line up as hard as a '
        + '100-card game would — which also meant the trend line never quite '
        + 'matched the lifetime accuracy printed next to it. It does now.',
      'Statistics → “Success %” no longer puts species you’ve seen once at the '
        + 'top. A species needs a few answers behind it before it is judged on '
        + 'its own record, so the top of the list is now the species you really '
        + 'do know rather than the ones you’ve barely met.',
    ],
  },
  {
    version: '2.36.0',
    date: '2026-08-01',
    changes: [
      'New study option, “Only species named in <your language>”: hides cards for '
        + 'species that have no common name in the language you’ve chosen, so you '
        + 'never study one shown only by its scientific (Latin) name. Off by '
        + 'default; find it under Settings → Species name language.',
      'The card loading spinner now appears immediately while a photo downloads — '
        + 'including over the initial dark screen on a slow connection — instead of '
        + 'only showing up once the blurred background had already loaded.',
      'Fixed offline play showing broken images. gote now keeps its own copies of '
        + 'your deck’s photos on the device, so an offline round only serves cards '
        + 'whose pictures are genuinely there and they actually appear. Previously '
        + 'it went by a list of photos it had merely tried to preload, which the '
        + 'system could quietly discard — leaving a round of grey placeholders. '
        + 'The “more photos” and map buttons are also hidden while offline, since '
        + 'both need a connection.',
    ],
  },
  {
    version: '2.35.3',
    date: '2026-08-01',
    changes: [
      'Fixed the Apple Watch face complication going stale: your streak and '
        + 'accuracy on a watch-face complication now refresh in the background '
        + 'shortly after you play on the phone, instead of staying frozen until '
        + 'you next opened the watch app.',
      'The streak complication now shows the gote newt instead of a generic '
        + 'flame.',
      'Fixed cross-device sync leaving out your history: when you sign in on a '
        + 'new device, it now rebuilds your full accuracy graph and day streak '
        + 'from the account — not just the lifetime total. Previously a device '
        + 'that had played before you turned sync on only sent its running totals, '
        + 'so a new device showed an empty graph and a reset streak.',
    ],
  },
  {
    version: '2.35.2',
    date: '2026-07-29',
    changes: [
      'The confusion “duel” drill now starts instantly — it opens straight on the '
        + 'photos it already has instead of pausing on a “Setting up the drill…” '
        + 'spinner while it fetches the rest.',
    ],
  },
  {
    version: '2.35.1',
    date: '2026-07-29',
    changes: [
      'Fixed “Research grade only”: research grade is a community-verification '
        + 'signal, not a taxonomic rank — an observation can be research grade at '
        + 'genus level when the community agrees it can’t be narrowed any further. '
        + 'gote no longer treats “Research grade only” as if it also meant '
        + '“identified to species”. The two are now independent toggles you can '
        + 'combine: switch on both to get community-verified observations that are '
        + 'also identified to an exact species. If you use “Research grade only” on '
        + 'its own, your deck may now include some research-grade genus-level cards '
        + 'it was quietly leaving out before.',
    ],
  },
  {
    version: '2.35.0',
    date: '2026-07-29',
    changes: [
      'New optional setting, “Fresh photo once mastered”: once you reliably know '
        + 'a species (5+ correct and 80%+ right), gote studies it on a random '
        + 'official photo instead of your own observation — so you’re recognising '
        + 'the species, not memorising one picture. Off by default; turn it on '
        + 'under Settings → Study options.',
    ],
  },
  {
    version: '2.34.0',
    date: '2026-07-28',
    changes: [
      'Flagged species now sync too: with sync on, the species you’ve flagged to '
        + 'revisit are kept in step across your devices (flag on one, it’s flagged '
        + 'on the others; unflag and it clears everywhere). Without sync, they stay '
        + 'on each device as before.',
    ],
  },
  {
    version: '2.33.0',
    date: '2026-07-28',
    changes: [
      'Your “Your tell” notes now sync: with sync on, the reminders you write on '
        + 'the “Species you mix up” comparison screen are backed up and kept in '
        + 'step across your devices (the most recent edit of each note wins). '
        + 'Without sync, they stay on your device as before.',
    ],
  },
  {
    version: '2.32.0',
    date: '2026-07-28',
    changes: [
      'Your mix-ups now come back on their own: Custom and Flash-card rounds '
        + 'quietly resurface the species you confuse — and their look-alike '
        + 'partner alongside — so you get to re-test the pair without hunting for '
        + 'it. It eases off once you’ve told a pair apart a few times running.',
    ],
  },
  {
    version: '2.31.0',
    date: '2026-07-28',
    changes: [
      'Closing the loop on look-alikes: when a species you used to mix up comes '
        + 'back in By-name rounds, gote quietly slips the old look-alike in as an '
        + 'option — and once you’ve told them apart a few times running, it says '
        + 'so ("you used to mix these up — now 3 in a row").',
    ],
  },
  {
    version: '2.30.0',
    date: '2026-07-28',
    changes: [
      'New “Drill this pair” — a quick two-way workout on the look-alikes you '
        + 'keep swapping. Open a pair from “Species you mix up” (or the in-round '
        + 'flag), tap Drill, and it shows one at a time until you can call them '
        + 'apart six in a row. Your own tell resurfaces whenever you slip.',
    ],
  },
  {
    version: '2.29.16',
    date: '2026-07-28',
    changes: [
      'When you pick a species you keep mixing up with another, gote now flags '
        + 'it right there in the round — with a one-tap shortcut to see the two '
        + 'side by side and jot down what tells them apart.',
    ],
  },
  {
    version: '2.29.15',
    date: '2026-07-28',
    changes: [
      'With sync on, the “Species you mix up” list now follows you across '
        + 'devices — the pairs you confuse are backed up and merged like the rest '
        + 'of your stats. (The private notes you write stay on each device.)',
    ],
  },
  {
    version: '2.29.14',
    date: '2026-07-28',
    changes: [
      'Tap a pair in “Species you mix up” to see the two look-alikes side by '
        + 'side and write your own note on what tells them apart — gote saves it '
        + 'and shows it back to you next time.',
    ],
  },
  {
    version: '2.29.13',
    date: '2026-07-28',
    changes: [
      'Statistics has a new “Species you mix up” section: the look-alikes you '
        + 'keep picking for each other, side by side, so you can spot the ones to '
        + 'study together. It appears once a pattern shows up.',
    ],
  },
  {
    version: '2.29.12',
    date: '2026-07-27',
    changes: [
      'Groundwork for smarter practice: gote now quietly notes when you mix up '
        + 'two look-alike species (which one you picked instead), to power targeted '
        + '"these two" lessons later. It stays on your device for now.',
    ],
  },
  {
    version: '2.29.11',
    date: '2026-07-27',
    changes: [
      'Offline play: gote now downloads a pack of your deck’s photos in the '
        + 'background, so By name, Speedrun, Custom and Flash cards keep working '
        + 'with no connection — using only cards whose photos are ready. Modes '
        + 'that need the internet (Nearby, By picture) are paused offline, and if '
        + 'nothing is downloaded yet the app tells you to connect once first.',
    ],
  },
  {
    version: '2.29.10',
    date: '2026-07-27',
    changes: [
      'Offline: when you have no connection, the app now says so and pauses the '
        + 'features that need the internet — Nearby species and refreshing your '
        + 'observations — instead of letting them fail quietly.',
    ],
  },
  {
    version: '2.29.9',
    date: '2026-07-27',
    changes: [
      'Tidied Settings: related options are now grouped into clearer sections — '
        + 'your account and its observations together, appearance on its own, and '
        + 'cross-device sync and photo storage combined under Data & storage.',
      'Statistics: the “By species” controls are now labelled “Show” and '
        + '“Sort by”, so it’s clear which buttons filter the list and which sort it.',
    ],
  },
  {
    version: '2.29.8',
    date: '2026-07-27',
    changes: [
      'Under the hood: made cross-device sync forward-compatible, so your '
        + 'settings and stats keep syncing cleanly as new features (like custom '
        + 'decks) arrive — even between devices running different app versions.',
    ],
  },
  {
    version: '2.29.7',
    date: '2026-07-26',
    changes: [
      'Sync: signing in on a device that already has a gote account now warns '
        + 'you first — and asks you to confirm — that this device’s settings '
        + '(theme, filters, language and the account you study) will be replaced '
        + 'by that account’s. Your play history is still merged in, not lost.',
    ],
  },
  {
    version: '2.29.6',
    date: '2026-07-26',
    changes: [
      'Settings now sync across devices: they upload when you first turn sync '
        + 'on, save to the server as you change them, arrive on your other devices '
        + 'on the next app start, and are adopted when you sign in on a new device.',
    ],
  },
  {
    version: '2.29.5',
    date: '2026-07-26',
    changes: [
      'Sync across devices: tidied the layout, kept the “connect another '
        + 'device” step out of the way until you need it, fixed the code entry '
        + 'so it accepts the emailed verification code, and added a Resend code button.',
    ],
  },
  {
    version: '2.29.4',
    date: '2026-07-25',
    changes: [
      'Small wording tweak to the iNaturalist disclaimer on the Legal screen.',
    ],
  },
  {
    version: '2.29.3',
    date: '2026-07-25',
    changes: [
      'Removed the (unused) Sentry crash-reporting dependency. It was never '
        + 'active, so nothing changes for you — the app is just a little lighter.',
    ],
  },
  {
    version: '2.29.2',
    date: '2026-07-25',
    changes: [
      'The privacy policy link in Settings now points to the new gote website.',
    ],
  },
  {
    version: '2.29.1',
    date: '2026-07-24',
    changes: [
      'Sync is now off by default and opt-in: nothing leaves your device until '
        + 'you turn on Settings ▸ Devices ▸ Sync across devices. Turning it off '
        + 'again stops all uploading.',
    ],
  },
  {
    version: '2.29.0',
    date: '2026-07-24',
    changes: [
      'Sync fix: if you had already been playing before turning sync on, your '
        + 'existing statistics are now uploaded too — previously only new '
        + 'rounds were, so a second device started from zero.',
      'Sync fix: signing in on a second device now correctly pulls the full '
        + 'history of that account.',
    ],
  },
  {
    version: '2.28.4',
    date: '2026-07-24',
    changes: [
      'Internal: sync now has an automated test suite that runs against a real '
        + 'database, so cross-device bugs get caught before a release. No '
        + 'change to the app you use.',
    ],
  },
  {
    version: '2.28.3',
    date: '2026-07-24',
    changes: [
      'The Privacy Policy link in Data & licensing now opens the published '
        + 'policy page.',
    ],
  },
  {
    version: '2.28.2',
    date: '2026-07-24',
    changes: [
      'Clearer about what sync stores: it keeps a round-by-round record of '
        + 'your play, and the privacy policy and Data & licensing screen now '
        + 'say so plainly instead of calling it just statistics.',
    ],
  },
  {
    version: '2.28.1',
    date: '2026-07-24',
    changes: [
      'Settings ▸ Data & licensing now explains what gote stores, what sync '
        + 'sends, and how to delete it — with a link to the full privacy policy.',
    ],
  },
  {
    version: '2.28.0',
    date: '2026-07-24',
    changes: [
      'You can now delete your synced account and everything on it from '
        + 'Settings ▸ Devices ▸ Sync across devices. Your statistics on this '
        + 'device are kept — use Reset statistics if you want those gone too.',
    ],
  },
  {
    version: '2.27.0',
    date: '2026-07-24',
    changes: [
      'New: sync across devices. Settings ▸ Devices ▸ Sync across devices '
        + 'links your phone, iPad and watch to one set of statistics, streak '
        + 'and species list. Just an email and a 6-digit code — no password, '
        + 'and playing still never needs an account.',
      'Signing in on a second device merges its progress in rather than '
        + 'replacing it, and signing out leaves that device untouched.',
    ],
  },
  {
    version: '2.26.1',
    date: '2026-07-24',
    changes: [
      'Fixed the groundwork sync so finished rounds are sent straight away '
        + 'rather than waiting for the next app start.',
    ],
  },
  {
    version: '2.26.0',
    date: '2026-07-24',
    changes: [
      'Groundwork for syncing your stats and settings between devices, so an '
        + 'iPhone and an iPad can share one set of numbers. Nothing changes yet '
        + '— the app still keeps everything on your device — and playing will '
        + 'never require an account.',
    ],
  },
  {
    version: '2.25.2',
    date: '2026-07-24',
    changes: [
      'iPad: the answer choices no longer stretch across the whole screen. '
        + 'They sit in a panel the width of the photo, so the names are easier '
        + 'to read and quicker to tap.',
    ],
  },
  {
    version: '2.25.1',
    date: '2026-07-24',
    changes: [
      'The Apple Watch app icon now has proper breathing room — it was cropped '
        + 'tight by the round icon shape.',
      'More dark-mode contrast fixes: the Main menu, Next, Statistics filter '
        + 'and sort, and Buy me a coffee buttons had a white label on the '
        + 'bright teal fill.',
    ],
  },
  {
    version: '2.25.0',
    date: '2026-07-22',
    changes: [
      'Readability: secondary text, the correct/incorrect tallies and the flag '
        + 'marker are all easier to read — every text and icon colour now meets '
        + 'the WCAG AA contrast standard in both light and dark themes.',
      'Dark mode fixes: primary buttons had a white label on bright teal, and '
        + 'the Results screen buttons and the "flagged only" toggle kept their '
        + 'light-theme colours. All now adapt properly.',
      'Consistent spacing: every screen uses the same page margins, so content '
        + 'no longer shifts as you move between them.',
    ],
  },
  {
    version: '2.24.6',
    date: '2026-07-22',
    changes: [
      'The Apple Watch quiz now draws from a much larger set of your species '
        + '(up to 240, from 24), so it stays varied for far longer.',
    ],
  },
  {
    version: '2.24.5',
    date: '2026-07-22',
    changes: [
      'Internal: the sample stats used for App Store screenshots now look like '
        + 'real play — uneven rounds, slumps and hot streaks. No change to the '
        + 'app you use.',
    ],
  },
  {
    version: '2.24.4',
    date: '2026-07-20',
    changes: [
      'Watch: a card with no photo now shows a placeholder instead of spinning '
        + 'forever.',
    ],
  },
  {
    version: '2.24.3',
    date: '2026-07-17',
    changes: [
      'Internal: App Store screenshot tooling now captures the Apple Watch '
        + 'screens and complications too. No change to the app you use.',
    ],
  },
  {
    version: '2.24.2',
    date: '2026-07-17',
    changes: [
      'A "Did you know?" note on the main menu points iPhone users to the '
        + 'Apple Watch app. Hide it any time — it stays available under '
        + 'Settings ▸ Apple Watch.',
    ],
  },
  {
    version: '2.24.1',
    date: '2026-07-17',
    changes: [
      'Apple Watch results now also sync the instant they happen when your '
        + 'phone is nearby (with the reliable queued sync as backup), so your '
        + 'stats and streak update right away.',
    ],
  },
  {
    version: '2.24.0',
    date: '2026-07-16',
    changes: [
      'Rounds played on the Apple Watch now count: every answer feeds your '
        + 'lifetime accuracy, per-species statistics, and daily streak, and '
        + 'each finished wrist round joins the accuracy chart — synced to the '
        + 'phone even if it was in your pocket, and reflected back on the '
        + 'watch and its complications.',
    ],
  },
  {
    version: '2.23.1',
    date: '2026-07-16',
    changes: [
      'Watch quiz fix: picking an answer now visibly reveals the result — the '
        + 'correct choice turns green and a wrong pick turns red.',
    ],
  },
  {
    version: '2.23.0',
    date: '2026-07-16',
    changes: [
      'Watch quiz redesigned: the photo now opens fullscreen — zoom with the '
        + 'Digital Crown, pan by dragging. Tap › for the answer choices (your '
        + 'pick turns green or red, then it auto-advances), or ✕ to end the '
        + 'round with a session summary.',
    ],
  },
  {
    version: '2.22.3',
    date: '2026-07-16',
    changes: [
      'Watch app: the streak text no longer gets cropped — the personal best '
        + 'moved to its own line.',
    ],
  },
  {
    version: '2.22.2',
    date: '2026-07-16',
    changes: [
      'The watch now offers two separate watch-face complications — Accuracy '
        + 'and Streak — so you can add either (or both) to any face.',
    ],
  },
  {
    version: '2.22.1',
    date: '2026-07-16',
    changes: [
      'Watch app polish: cleaner home screen (no header) and the newt on the '
        + 'Play button.',
    ],
  },
  {
    version: '2.22.0',
    date: '2026-07-16',
    changes: [
      'New: Apple Watch companion app — see your lifetime accuracy and daily '
        + 'streak at a glance, and play a quick 4-choice photo quiz from your '
        + 'synced cards, right on your wrist.',
      'New: a watch-face complication showing your accuracy and streak.',
    ],
  },
  {
    version: '2.21.21',
    date: '2026-07-15',
    changes: [
      'Internal: the App Store screenshot tooling now seeds realistic sample '
        + 'stats (a full accuracy chart and a populated Statistics page). No '
        + 'change to the app you use.',
    ],
  },
  {
    version: '2.21.20',
    date: '2026-06-29',
    changes: [
      'On Android, Nearby species now uses your current location with an '
        + 'adjustable radius (the map and place search stay iOS-only for now).',
    ],
  },
  {
    version: '2.21.19',
    date: '2026-06-29',
    changes: [
      'Fullscreen photos are now pinch-to-zoom, drag-to-pan, and double-tap-to-'
        + 'zoom on Android too (previously zoom worked only on iOS).',
    ],
  },
  {
    version: '2.21.18',
    date: '2026-06-29',
    changes: [
      'You can now cancel a slow load (downloading a big account or finding '
        + 'nearby species) from the loading screen.',
    ],
  },
  {
    version: '2.21.17',
    date: '2026-06-29',
    changes: [
      'Accessibility: the icon-only buttons (back, close, flag, more photos, map) '
        + 'now have VoiceOver labels.',
    ],
  },
  {
    version: '2.21.16',
    date: '2026-06-29',
    changes: [
      'Your deck now fully refreshes periodically, so observations you delete on '
        + 'iNaturalist eventually drop out of the app instead of lingering.',
    ],
  },
  {
    version: '2.21.15',
    date: '2026-06-29',
    changes: [
      'On Statistics, changing the sort or filter no longer jumps the list back '
        + 'to the top, so the controls stay put and are easy to use again.',
    ],
  },
  {
    version: '2.21.14',
    date: '2026-06-29',
    changes: [
      'Internal: the Statistics species list re-renders less as thumbnails load '
        + '(smoother on very long lists).',
    ],
  },
  {
    version: '2.21.13',
    date: '2026-06-29',
    changes: [
      'The fullscreen photo viewer now adapts to screen-size changes (e.g. '
        + 'rotating an iPad).',
    ],
  },
  {
    version: '2.21.12',
    date: '2026-06-29',
    changes: [
      '“Pick the right one” now gives up quickly when it can’t reach the network '
        + 'instead of retrying its way through your whole deck.',
    ],
  },
  {
    version: '2.21.11',
    date: '2026-06-29',
    changes: [
      'Fixed flagged species from an older version leaking into every account; '
        + 'they now migrate to the first account that opens and stay there.',
    ],
  },
  {
    version: '2.21.10',
    date: '2026-06-29',
    changes: [
      'Internal: removed a dead crash-reporting config path (no visible change).',
    ],
  },
  {
    version: '2.21.9',
    date: '2026-06-29',
    changes: [
      'The Update button now correctly says “Already up to date” when nothing '
        + 'changed, instead of always reporting one updated observation.',
    ],
  },
  {
    version: '2.21.8',
    date: '2026-06-29',
    changes: [
      'Ending a round no longer risks double-counting your score if the button '
        + 'is tapped twice quickly.',
    ],
  },
  {
    version: '2.21.7',
    date: '2026-06-29',
    changes: [
      'A brief network hiccup no longer leaves a species stuck with no photos or '
        + 'details for the rest of the session — those lookups now retry.',
    ],
  },
  {
    version: '2.21.6',
    date: '2026-06-29',
    changes: [
      'Fixed Speedrun getting stuck (and mis-counting your score) when your deck '
        + 'had only a single card.',
    ],
  },
  {
    version: '2.21.5',
    date: '2026-06-29',
    changes: [
      'Swiping back from Settings now applies your changes (language, filters) '
        + 'just like the back button, instead of discarding them.',
    ],
  },
  {
    version: '2.21.4',
    date: '2026-06-29',
    changes: [
      'The Android app icon now shows the gote newt, matching the iOS icon '
        + '(it was a placeholder before).',
    ],
  },
  {
    version: '2.21.3',
    date: '2026-06-29',
    changes: [
      'Removed a harmless Android console warning about layout animations under '
        + 'the New Architecture.',
    ],
  },
  {
    version: '2.21.2',
    date: '2026-06-28',
    changes: [
      'Clarified under the “Buy me a coffee” button that gote is free and '
        + 'donations don’t unlock any features.',
    ],
  },
  {
    version: '2.21.1',
    date: '2026-06-26',
    changes: [
      'Release preparation: removed a debug-only menu button and finalized the '
        + 'app for its first App Store submission.',
    ],
  },
  {
    version: '2.21.0',
    date: '2026-06-24',
    changes: [
      'Cards now have a small location pin next to the photo credit — tap it to '
        + 'see a map of where the observation was recorded.',
      'The species details page (from the Lexicon or Statistics) now shows the '
        + 'observation place with a tappable map too.',
      'The Statistics breakdown now loads and scrolls smoothly even with a very '
        + 'long species list (e.g. after Nearby rounds spanning many users).',
      'The menu hero chart now always spans your full history — once it fills the '
        + 'screen it downsamples instead of dropping older games — with a smooth '
        + 'trend line showing how your lifetime accuracy has changed over time.',
      'The Statistics page now has two explained charts: a per-game accuracy bar '
        + 'chart and a smooth lifetime-accuracy trend line.',
      'Swipe right from the left edge to go back on the Settings, game-setup, '
        + 'Statistics, Lexicon and species pages.',
    ],
  },
  {
    version: '2.20.0',
    date: '2026-06-21',
    changes: [
      'The Statistics page now shows your daily streak, with your best run and a '
        + 'short explanation of how it works.',
    ],
  },
  {
    version: '2.19.0',
    date: '2026-06-21',
    changes: [
      'Daily streak: a teal flame on the home screen counts the days you play in '
        + 'a row — it fills in once you’ve played today, and your streak also '
        + 'shows on the results screen.',
    ],
  },
  {
    version: '2.18.0',
    date: '2026-06-21',
    changes: [
      'In the fullscreen photo viewer, double-tap to toggle between fit-to-screen '
        + 'and zoomed in (anywhere photos open full screen).',
    ],
  },
  {
    version: '2.17.0',
    date: '2026-06-21',
    changes: [
      'On a species page, tap any photo — the main one or the smaller ones — to '
        + 'open it full screen, pinch to zoom, and swipe between photos.',
    ],
  },
  {
    version: '2.16.0',
    date: '2026-06-21',
    changes: [
      'Statistics rows are now tinted by net score (correct minus incorrect): '
        + 'teal for your strongest species, dark red for the weakest.',
    ],
  },
  {
    version: '2.15.4',
    date: '2026-06-21',
    changes: [
      'Nearby species: the loading screen no longer says it’s loading your '
        + 'account — it now reads “Finding species observed near this place,” and '
        + 'the setup screen explains the mode draws from all observers nearby.',
    ],
  },
  {
    version: '2.15.3',
    date: '2026-06-21',
    changes: ['Reverted the Nearby map to the standard style.'],
  },
  {
    version: '2.15.2',
    date: '2026-06-21',
    changes: [
      'The Nearby map now uses a muted style so the radius circle and pin stand '
        + 'out more.',
    ],
  },
  {
    version: '2.15.1',
    date: '2026-06-21',
    changes: [
      'Fixed sync dropping new identifications that landed on older observations '
        + '(on large accounts) — updated observations are now always kept when '
        + 'syncing.',
    ],
  },
  {
    version: '2.15.0',
    date: '2026-06-21',
    changes: [
      'Nearby species now has a map: tap to drop a pin (or drag the marker), and '
        + 'a circle shows your search radius — updating live as you move the '
        + 'slider.',
    ],
  },
  {
    version: '2.14.1',
    date: '2026-06-21',
    changes: [
      'The Nearby radius slider is now continuous: it magnetically snaps to 10, '
        + '25, 50, 100 (and the 2.5/500 ends) with a haptic tick, but you can '
        + 'still pick any value in between.',
    ],
  },
  {
    version: '2.14.0',
    date: '2026-06-21',
    changes: [
      'Nearby species: the search radius is now a slider from 2.5 km up to '
        + '500 km, with marks at 10, 25, 50 and 100 km.',
    ],
  },
  {
    version: '2.13.1',
    date: '2026-06-21',
    changes: [
      'On a brand-new install the example collection downloads first and then '
        + 'drops you on Settings to enter your own username; after that, each '
        + 'launch quietly checks for new observations since last time.',
    ],
  },
  {
    version: '2.13.0',
    date: '2026-06-21',
    changes: [
      'No iNaturalist account? gote now starts you off with a built-in example '
        + 'collection so you can play right away — set your own username anytime '
        + 'in Settings.',
    ],
  },
  {
    version: '2.12.5',
    date: '2026-06-21',
    changes: [
      'The “Buy me a coffee” link now opens the real Ko-fi page — thank you for '
        + 'supporting gote!',
    ],
  },
  {
    version: '2.12.4',
    date: '2026-06-21',
    changes: [
      'The Settings header now shows the gote newt instead of the leaf icon.',
    ],
  },
  {
    version: '2.12.3',
    date: '2026-06-21',
    changes: [
      'Replaced the card flip with a clean fade-and-scale reveal in self-grade '
        + 'rounds — the answer dissolves in over the photo, with nothing cut off. '
        + 'Press and hold the photo to peek at it again.',
    ],
  },
  {
    version: '2.12.2',
    date: '2026-06-21',
    changes: [
      'Card flip now turns over a dimmed backdrop, so the receding side reads as '
        + 'depth behind the card instead of a gap.',
    ],
  },
  {
    version: '2.12.1',
    date: '2026-06-21',
    changes: [
      'Fixed a black edge showing during the card flip — a blurred backdrop now '
        + 'sits behind the turning card.',
    ],
  },
  {
    version: '2.12.0',
    date: '2026-06-21',
    changes: [
      'Flash cards and other self-grade rounds now reveal the answer with a real '
        + '3D card flip — the photo turns over to show the species name and the '
        + '“I knew it / Missed it” buttons on its back.',
    ],
  },
  {
    version: '2.11.0',
    date: '2026-06-21',
    changes: [
      'Motion polish throughout: screens and the species detail page slide in, '
        + 'cards and answer choices fade/stagger in, the score counts up with an '
        + 'accuracy bar, stats bars grow and re-sort smoothly, menu rows spring '
        + 'on press and stagger in, and the accuracy chart animates up.',
    ],
  },
  {
    version: '2.10.0',
    date: '2026-06-21',
    changes: [
      'When choices or the answer cover the photo, press and hold any bare part '
        + 'of the picture to peek: the panel slides up out of the way while you '
        + 'hold, and slides back when you let go. The buttons keep working.',
    ],
  },
  {
    version: '2.9.0',
    date: '2026-06-21',
    changes: [
      'Speedrun is now timed: each photo flashes for 3 seconds (the countdown '
        + 'starts once it has loaded, shown by a little pie timer in the corner), '
        + 'then the choices appear automatically and the photo is hidden — so '
        + 'you answer from memory.',
    ],
  },
  {
    version: '2.8.4',
    date: '2026-06-20',
    changes: [
      'Fixed a brief black flash between the launch screen and the in-app '
        + 'splash — the two now hand off seamlessly.',
    ],
  },
  {
    version: '2.8.3',
    date: '2026-06-19',
    changes: [
      'The brand name is now consistently lowercase “gote” everywhere — the '
        + 'Settings header, the home-screen app name, and all in-app text.',
    ],
  },
  {
    version: '2.8.2',
    date: '2026-06-19',
    changes: [
      'Tightened the Statistics rows: shorter correct/incorrect bars with the '
        + 'count closer, leaving more room for the species name.',
    ],
  },
  {
    version: '2.8.1',
    date: '2026-06-19',
    changes: [
      'Statistics and Lexicon now keep your scroll position when you open a '
        + 'species and come back — they only jump to the top when you change a '
        + 'filter or return to the menu.',
    ],
  },
  {
    version: '2.8.0',
    date: '2026-06-19',
    changes: [
      'Flag species straight from Statistics (between the name and the bars) '
        + 'and from the species detail page.',
    ],
  },
  {
    version: '2.7.1',
    date: '2026-06-19',
    changes: [
      'Fixed missing thumbnails in “All species” statistics: they now fall back '
        + 'to each species’ default iNaturalist photo (and recover if a stored '
        + 'image fails to load).',
    ],
  },
  {
    version: '2.7.0',
    date: '2026-06-19',
    changes: [
      'Tap any species in Statistics to open its full detail page (photos, '
        + 'taxonomy, Wikipedia) — the same one as in the Lexicon.',
      'Statistics thumbnails now load for species outside your current '
        + 'observations too (fetched from iNaturalist when needed).',
    ],
  },
  {
    version: '2.6.4',
    date: '2026-06-19',
    changes: [
      'Cleaner per-species stat bars: dropped the check/✗ icons — the green/red '
        + 'colours already say it.',
    ],
  },
  {
    version: '2.6.3',
    date: '2026-06-19',
    changes: [
      'Statistics now filters to your current observations by default; toggle '
        + '“My observations / All species” to include every species you’ve ever '
        + 'been quizzed on (e.g. from Nearby rounds).',
    ],
  },
  {
    version: '2.6.2',
    date: '2026-06-19',
    changes: [
      'Cleaner launch splash: just the newt logo, without the “gote” wordmark.',
    ],
  },
  {
    version: '2.6.1',
    date: '2026-06-19',
    changes: [
      'Compact per-species stats rows: the correct/incorrect bars now sit to '
        + 'the right of the thumbnail and name, and each row’s recognition rate '
        + 'shows as a teal gradient filling the row background.',
    ],
  },
  {
    version: '2.6.0',
    date: '2026-06-18',
    changes: [
      'Statistics now has a per-species breakdown: every species you’ve been '
        + 'quizzed on, with its thumbnail and two bars showing how many times '
        + 'you got it right and wrong.',
      'Sort the breakdown by success rate, or by number of correct or incorrect '
        + 'identifications.',
    ],
  },
  {
    version: '2.5.7',
    date: '2026-06-18',
    changes: [
      'New app icon: the white newt on the brand teal (replacing the solid-green '
        + 'placeholder).',
    ],
  },
  {
    version: '2.5.6',
    date: '2026-06-18',
    changes: [
      'More breathing room below the title in the support popup.',
    ],
  },
  {
    version: '2.5.5',
    date: '2026-06-18',
    changes: [
      'Fixed the support popup title: the “gote” wordmark now reads level with '
        + '“Enjoying” and is coloured the brand teal.',
    ],
  },
  {
    version: '2.5.4',
    date: '2026-06-18',
    changes: [
      'Internal: added a temporary debug button to the menu for testing the '
        + 'support popup (removed before release), and gave the menu bottom '
        + 'extra padding so the last items clear the home indicator.',
    ],
  },
  {
    version: '2.5.3',
    date: '2026-06-18',
    changes: [
      'The “Enjoying gote?” support popup now matches the brand: the newt mark '
        + 'sits in front of the title and the wordmark uses the Fredoka '
        + 'logotype (replacing the old leaf icon).',
    ],
  },
  {
    version: '2.5.2',
    date: '2026-06-18',
    changes: [
      'The newt mark on the menu banner now sits to the left of the “gote” '
        + 'wordmark, matching the design guidance.',
    ],
  },
  {
    version: '2.5.1',
    date: '2026-06-18',
    changes: [
      'Internal: added UI-test coverage for the new “gote” brand wordmark.',
    ],
  },
  {
    version: '2.5.0',
    date: '2026-06-18',
    changes: [
      'New brand wordmark: the “gote” logo on the menu banner and the launch '
        + 'splash now uses the rounded Fredoka logotype.',
    ],
  },
  {
    version: '2.4.0',
    date: '2026-06-18',
    changes: [
      'New look: gote’s brand colour is now teal instead of green — the menu '
        + 'banner, headings, buttons, splash and app icon background all follow '
        + 'the new palette, in both light and dark mode.',
    ],
  },
  {
    version: '2.3.8',
    date: '2026-06-12',
    changes: [
      'The native launch screen now shows the gote logo too (it was a plain '
        + 'green square), so the logo is visible from the very first frame.',
    ],
  },
  {
    version: '2.3.7',
    date: '2026-06-12',
    changes: [
      'The gote logo now appears bare on the launch splash and the menu '
        + 'banner — white on green, no backdrop tile (replacing the drawn newt '
        + 'and the badge).',
    ],
  },
  {
    version: '2.3.6',
    date: '2026-06-12',
    changes: [
      'Code-review fixes: the Lexicon “Not seen” filter icon no longer shows a '
        + '“?” box; the nearby-place search spinner can no longer get stuck (and '
        + 'slow lookups can no longer overwrite newer results).',
      '“Revisit missed” after a Nearby round now draws its multiple-choice '
        + 'alternatives from the nearby species, not your own observations.',
      'Starting a game with an empty deck (e.g. filters excluding everything) '
        + 'no longer dead-ends on a blank screen.',
      'A failed account switch keeps the old account’s flags and username '
        + 'consistent with the still-loaded deck.',
      'Dark mode: fixed the language picker’s selected row and the settings '
        + 'switches using light-theme colours.',
    ],
  },
  {
    version: '2.3.5',
    date: '2026-06-08',
    changes: [
      'The menu banner now shows the gote logo in place of the generic feather '
        + 'icon.',
    ],
  },
  {
    version: '2.3.4',
    date: '2026-06-08',
    changes: [
      'The menu banner now casts a soft shadow once you scroll, lifting it '
        + 'above the list.',
    ],
  },
  {
    version: '2.3.3',
    date: '2026-06-08',
    changes: [
      'Tap the accuracy banner (lifetime % and the recent-games chart) to open '
        + 'Statistics; removed the separate Statistics menu row.',
    ],
  },
  {
    version: '2.3.2',
    date: '2026-06-08',
    changes: [
      'Moved “Buy me a coffee” to a quiet link at the bottom of the main menu.',
    ],
  },
  {
    version: '2.3.1',
    date: '2026-06-08',
    changes: [
      'Polished the menu banner: roomier collapsed state and a richer green '
        + 'gradient.',
    ],
  },
  {
    version: '2.3.0',
    date: '2026-06-08',
    changes: [
      'The menu header is now a full-width banner that reaches the top edge '
        + 'and collapses into a compact bar as you scroll.',
    ],
  },
  {
    version: '2.2.2',
    date: '2026-06-08',
    changes: [
      'Brought back the menu’s header card with the recent-accuracy chart, '
        + 'now alongside the minimal sections.',
    ],
  },
  {
    version: '2.2.1',
    date: '2026-06-08',
    changes: [
      'Settings now notes that only your ~1,000 most recent observations are '
        + 'loaded.',
    ],
  },
  {
    version: '2.2.0',
    date: '2026-06-08',
    changes: [
      'Dark mode! Choose Light, Dark, or Follow system in Settings → '
        + 'Appearance.',
    ],
  },
  {
    version: '2.1.1',
    date: '2026-06-07',
    changes: [
      'Fixed icons occasionally appearing as “?” boxes — the icon fonts are '
        + 'now preloaded at launch.',
    ],
  },
  {
    version: '2.1.0',
    date: '2026-06-07',
    changes: [
      'Added a “Buy me a coffee” option in Settings → Support to support gote.',
      'An occasional, easy-to-dismiss popup now invites an App Store rating or '
        + 'a coffee. (Both links activate once the App Store listing and Ko-fi '
        + 'account are live.)',
    ],
  },
  {
    version: '2.0.0',
    date: '2026-06-07',
    changes: [
      'New minimal design across the whole app: flat lists with hairline '
        + 'dividers, clean accent-coloured icons (no tiles), and a lighter '
        + 'menu and headers.',
    ],
  },
  {
    version: '1.10.1',
    date: '2026-06-07',
    changes: [
      'Refined two game-mode names to “By name” and “By picture”.',
    ],
  },
  {
    version: '1.10.0',
    date: '2026-06-06',
    changes: [
      'Reorganized the menu into three sections — Play, Learn, and Settings.',
      'Renamed “All cards” to “By name” and “Pick the right one” to “By picture”.',
    ],
  },
  {
    version: '1.9.8',
    date: '2026-06-06',
    changes: [
      'Renamed the Settings “Load observations” button to “Save”.',
    ],
  },
  {
    version: '1.9.7',
    date: '2026-06-06',
    changes: [
      'Settings changes now always take effect: adjusting the language or the '
        + 'study filters and simply going back applies them, instead of only '
        + 'when you pressed “Load observations”.',
    ],
  },
  {
    version: '1.9.6',
    date: '2026-06-06',
    changes: [
      'Internal: fixed a harmless React key warning logged from the menu.',
    ],
  },
  {
    version: '1.9.5',
    date: '2026-06-06',
    changes: [
      'Toned down the menu accuracy bars so they sit more softly behind the '
        + 'header.',
    ],
  },
  {
    version: '1.9.4',
    date: '2026-06-06',
    changes: [
      'No more accidental answers: the choices (and the “I knew it / Missed '
        + 'it” buttons) now appear in the center of the screen, away from the '
        + '“Show choices / Reveal answer” button you just tapped.',
    ],
  },
  {
    version: '1.9.3',
    date: '2026-06-06',
    changes: [
      'Menu accuracy chart: bars now fade from solid white at the top to '
        + 'transparent at the bottom, and a 100% bar rises to just below your '
        + 'username.',
    ],
  },
  {
    version: '1.9.2',
    date: '2026-06-06',
    changes: [
      'The flag on cards now sits in the top bar next to the score: a white '
        + 'outline when off, a filled flag when on.',
    ],
  },
  {
    version: '1.9.1',
    date: '2026-06-06',
    changes: [
      'End-of-round buttons are clearer: “Revisit missed” (light orange, eye '
        + 'icon) and “Play again” (light green, play icon) are now easy to tell '
        + 'apart.',
    ],
  },
  {
    version: '1.9.0',
    date: '2026-06-06',
    changes: [
      'The menu header now shows a subtle bar chart of your recent games’ '
        + 'accuracy behind the title, newest on the right.',
    ],
  },
  {
    version: '1.8.1',
    date: '2026-06-06',
    changes: [
      'Flagged species are now remembered per iNaturalist account (like your '
        + 'cached observations), so switching accounts no longer mixes flags.',
    ],
  },
  {
    version: '1.8.0',
    date: '2026-06-06',
    changes: [
      'Flag species you want to revisit: tap the flag on any card while '
        + 'playing, or on a missed species at the end of a round.',
      'In the Lexicon you can flag or unflag any species and filter to just '
        + 'your flagged ones.',
      'Custom game and Flash cards now have a “Flagged only” option to study '
        + 'just the species you flagged.',
    ],
  },
  {
    version: '1.7.1',
    date: '2026-06-06',
    changes: [
      'On the end-of-round screen, tap any species you missed to open its '
        + 'full detail page (photos, taxonomy, Wikipedia) — the same one as in '
        + 'the Lexicon.',
    ],
  },
  {
    version: '1.7.0',
    date: '2026-06-05',
    changes: [
      'Custom game and Speedrun are now multiple-choice too (answer + four '
        + 'alternatives), matching All cards and Nearby species.',
      'New mode: Flash cards — same picker as Custom game, but reveal the '
        + 'answer and grade yourself (the classic self-grade style).',
      'End-of-round screen: the Main menu button is now emphasized, with a '
        + 'matching ✕ in the top corner.',
      'Fixed some result/answer icons that were not displaying after the '
        + 'recent icon refresh.',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-06-05',
    changes: [
      'Nearby species is now a multiple-choice quiz: pick the right name from '
        + 'the answer plus four look-alike alternatives (like All cards), '
        + 'instead of self-grading.',
    ],
  },
  {
    version: '1.5.2',
    date: '2026-06-05',
    changes: [
      'Fixed: the card count was wrong right after launch — your study '
        + 'filters (e.g. “Research grade only”) are now applied correctly on '
        + 'startup instead of only after a manual sync.',
    ],
  },
  {
    version: '1.5.1',
    date: '2026-06-05',
    changes: [
      'Amphibians now show a frog icon instead of the stand-in turtle.',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-06-05',
    changes: [
      'Fresh, more modern look for the main menu and Settings: a gradient '
        + 'header, colour-coded game cards, and grouped settings sections.',
      'New icon set (Ionicons) throughout the app — rounder, clearer glyphs '
        + 'that better match each option.',
    ],
  },
  {
    version: '1.4.5',
    date: '2026-06-04',
    changes: [
      'Proper nature icons for taxon groups (leaf, mushroom, bird, fish, paw, '
        + 'turtle, bee, spider, …) instead of the old abstract placeholders.',
    ],
  },
  {
    version: '1.4.4',
    date: '2026-06-04',
    changes: [
      'More resilient networking: if iNaturalist rate-limits a request, the app '
        + 'now waits and retries automatically instead of failing.',
    ],
  },
  {
    version: '1.4.3',
    date: '2026-06-04',
    changes: [
      'Performance: species photo/detail lookups are now cached for the '
        + 'session, cutting repeat network requests (helps stay under '
        + 'iNaturalist’s rate limit, especially in "Pick the right one").',
    ],
  },
  {
    version: '1.4.2',
    date: '2026-06-04',
    changes: [
      'Card photos now show in full (no cropping) — wide or tall photos fit the '
        + 'screen with a blurred fill behind, so identifying features are never '
        + 'cut off.',
    ],
  },
  {
    version: '1.4.1',
    date: '2026-06-04',
    changes: [
      'Fixed: swiping or tapping a card no longer reveals/hides the species '
        + 'name. Use the Reveal answer button; double-tap a photo to zoom.',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-06-04',
    changes: [
      'New game mode: Nearby species — learn the species typically observed '
        + 'around a location. Pick a spot by GPS or place search, choose which '
        + 'groups (birds, mammals, plants, …), and study the most common ones.',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-06-04',
    changes: [
      'Cards now show the photo’s copyright/license (from iNaturalist) as small '
        + 'print in the corner, replacing the now-redundant fullscreen button '
        + '(double-tap a photo to zoom).',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-06-04',
    changes: [
      'New: "Data & licensing" screen in Settings explaining that photos and '
        + 'data come from iNaturalist and its observers, under each observer’s '
        + 'copyright/license.',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-06-04',
    changes: [
      'New: in-app changelog (this screen) and app versioning.',
      'New: crash reporting via Sentry (off until a DSN is configured).',
      'New: branded launch splash with a stylized newt.',
      'New: "Report a bug" and "Send feedback" options in Settings.',
      'Fixed: "Identified to species" filter now correctly excludes genus-level '
        + 'observations and keeps subspecies.',
      'Removed the Quick 16 game mode.',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-05-31',
    changes: [
      'First version of gote.',
      'Game modes: All cards, Custom game, Speedrun, and Pick the right one.',
      'Lexicon to browse and search every species you have observed.',
      'Statistics: lifetime accuracy, most-missed and best-known species.',
      'Species-name language picker and offline observation cache.',
    ],
  },
];
