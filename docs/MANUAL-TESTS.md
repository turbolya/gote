# gote — manual tests

Every case a human has to run, because a simulator cannot: real devices, real
accounts, real network conditions, and the judgement calls ("does this bubble
cover anything it shouldn't?") that an assertion cannot make. Work top to
bottom; each case is self-contained. Tick the box and jot anything odd in the
notes line.

**This file is the source of truth.** Testiny is a consumer of it — see
[Keeping Testiny in sync](#keeping-testiny-in-sync) at the bottom. Edit the
cases here, regenerate the CSV, re-import. There is one list, not one per
feature: a second file is how the same case ends up written twice, differently.

Everything already covered by `npm test` (1,634 tutorial assertions) and
`npm run e2e:test` (34 Detox specs) is deliberately **not** repeated here. What
follows is the residue: the things automation genuinely cannot reach.

## How to use this

- **Legend:** ☐ = not run, ✅ = pass, ❌ = fail (write what happened). "Device A"
  and "Device B" are two separate installs (e.g. an iPhone and an iPad, or two
  phones). "Tester" = you.
- **Build:** test a **TestFlight** build (or an EAS **dev/preview** build), never
  Expo Go — the watch app and cross-device sync only exist in a real build.
  Cross-device sync also needs the build to carry Supabase credentials. The
  **`production`** and **`testflight`** profiles both do — `testflight`
  `extends` `production` and inherits its `env` — so either is fine for sync
  testing. **`preview` and `development` do not.** A build with no creds behaves
  as if sync doesn't exist: no sync row in Settings at all. That's expected, not
  a bug, and it is what "sync vanished" in 2.37.1 turned out to be. To check a
  build rather than assume: `npx eas config --platform ios --profile <name>`
  lists the environment variables it will carry.
- **Store-build flags:** a real test build must have **neither** `EXPO_PUBLIC_E2E`
  **nor** `EXPO_PUBLIC_SHOTS` set (they enable an offline fixture deck and fake
  seeded stats). If your streak is "12 days" and species look canned on a fresh
  install, you're on a SHOTS build — rebuild without it.
- **Run order:** top to bottom. Parts 1 and 2 are one device, and Part 2 wants
  that device freshly installed — the tour runs once and several of its cases
  cannot be reached again afterwards, so do it before Part 1 has wandered
  around the app. Part 3 needs two devices, Part 4 an Apple Watch paired to
  Device A, and Part 5 the actual store build.

## Clean-state recipes

Know how to get back to zero — several cases need a fresh start.

- **Fresh local data:** delete the app and reinstall (fastest reliable reset).
- **Fresh server data:** Settings ▸ Devices ▸ Sync ▸ **Delete synced account**
  (removes this account's events + settings on the server). Do this before
  re-testing a sync flow so old rows don't confuse the result.
- **A "second player":** for two-device tests, install on Device B and, where a
  case says so, use a **different** email or a fresh anonymous account.

---

# Part 1 — Single device: the basics

## 1. First run & core loop

- [ ] **TC-1.1 Cold start.** Fresh install → open the app.
  - *Preconditions:* Fresh install, no test flags
  - *Priority:* High
  - *Expected:* lands on the menu within a couple of seconds; no crash, no error
    banner; stats read 0 answered / 0% / no streak; no network required.
- [ ] **TC-1.2 Play a starter round.** Start a round from the starter/sample set.
  - *Expected:* a real nature photo with five options; tapping the right one shows
    a correct (green) state, a wrong one shows red **and** reveals the right answer.
- [ ] **TC-1.3 Finish a round.** Complete a full round.
  - *Expected:* a session summary appears; lifetime "answered" and accuracy update
    on the menu; the round shows up on the recent-games chart.
- [ ] **TC-1.4 Swipe back works on every page with a back button.** Visit each
    page with a back chevron and swipe right starting **from the left edge**:
    Settings, Smart play ⋯, Flash cards, Nearby species, Statistics, Lexicon, and
    the Settings sub-pages **What's new**, **Data & licensing** and **Sync across
    devices**. Also the overlays: a species detail page, a compare pair, a duel.
  - *Priority:* High
  - *Expected:* every one goes back to exactly where its back chevron goes —
    top-level pages to the menu, Settings sub-pages to Settings. Sync was the
    one that used to do nothing (fixed 2.37.1). Settings additionally **applies
    any pending field edits** on the way out, same as tapping its chevron: change
    the username or a toggle, swipe back, and the change must stick.
  - *Also expected — these deliberately do NOT swipe back:* the menu (nothing
    above it), a round in progress (an accidental swipe must not abandon it), the
    results screen, the fullscreen photo viewer (swipe there pages between photos;
    use its own controls to leave — **back** returns to the photo grid it was
    opened from, **×** closes it, and there is no swipe- or flick-to-dismiss)
    and the observation map (pannable; use its × button).
  - *Note:* it is an **edge** swipe — the touch must start within ~28 px of the
    left edge, so it never steals horizontal gestures from the Nearby radius
    slider, the card-count slider or the map.
- [ ] **TC-1.5 The loading screen spins the newt, in teal.**
  1. Watch the screen while the observations download.
  - *Preconditions:* App freshly installed, or a username changed in Settings
    so the deck reloads. Device online.
  - *Expected:* The spinner is the gote newt animation, tinted the brand teal,
    sitting above "Loading observations for <name>…", the "<n> of <total>"
    count, and the note that only the ~1,000 most recent observations are
    loaded. A plain grey system spinner may show for a moment on a first-ever
    launch while the animation is still decoding, and must give way to the newt
    — it is the fallback, not the spinner. ---

## 2. Game modes

Run one full round of **each** mode. Expected for all: it starts, is playable,
scores correctly, and returns to the menu cleanly.

- [ ] **TC-2.1 Mode: name questions.** There is no **By name** row on the menu;
    the round comes from the **Smart play card** on the menu with only the
    *name* icon left on.
    Play a full round: photo → pick the name.
  - *Expected:* No By name entry on the menu. The narrowed round asks a name
    question on **every** card, scores correctly, and returns to the menu
    cleanly.
- [ ] **TC-2.2 Mode: photo questions.** There is no **By picture** row on the
    menu either; the round comes from the **Smart play card** with only the
    *photo* icon left on. Play a full round: name → pick the photo. Keep going long
    enough to pass a species with few look-alikes.
  - *Expected:* No By picture entry on the menu. Every card is a photo grid —
    a species that cannot make one is **skipped**, never quietly turned into a
    name list. If the deck runs out of species that can, the screen says
    "Not enough look-alike data to play right now" with a way on.
- [ ] **TC-2.3 Mode: Speedrun.** Play a round; it is timed — confirm it **ends after 3 misses** and shows a
  result.
  - *Expected:* Timed; ends after 3 misses; shows a result.
- [ ] **TC-2.4 Mode: Flash cards.** Reveal the answer, then self-grade; confirm the
  grade is recorded.
  - *Expected:* The self-grade is recorded; returns to the menu cleanly.
- [ ] **TC-2.5 Mode: Nearby species.** Drop/adjust the map pin, set a search radius and
  taxon-group filter, start.
  - *Expected:* the deck reflects species seen near that pin (not just your own
    records); on Android there's **no map** by design — GPS + radius slider only.
- [ ] **TC-2.6 Smart play - mixed questions.** On the menu's Smart play card,
    leave all four question icons on, drag the slider up to 16, and Start.
  - *Priority:* High
  - *Expected:* the question CHANGES between cards — a photo grid, a five-name
    list, and (once a species has a few answers behind it) typing the name.
    Species you have never met lean towards the photo grid; species you answer
    well start being asked from memory. The round never stalls between formats,
    and the card counter advances by exactly one each time.
- [ ] **TC-2.7 Smart play - limiting the question types.** On the menu card,
    turn off all but one icon and play a few cards. Then try to turn off the
    last one. Repeat behind the card's **⋯**, where the same types are chips
    with labels.
  - *Priority:* High
  - *Expected:* only that type comes up. The last one **refuses** to switch off
    (it stays lit) rather than Start becoming disabled, on both surfaces. Note: choosing only
    **Look-alike pairs** falls back to a name list for any species you have no
    recorded confusion for — there is no pair to ask about.
- [ ] **TC-2.8 Typing from memory.** In a Smart play round, get a
    "type the name" card. Try, in turn: the exact common name; the same name
    with wrong capitals and no accents; a one-letter typo; the scientific name;
    and a completely different species.
  - *Preconditions:* A Smart play round that serves a type-the-name card
  - *Priority:* High
  - *Expected:* the first four are all accepted — a typo says so and shows the
    correct spelling. The different species is **rejected**. Long names wrap onto
    a second line rather than scrolling sideways. Check is greyed until you type
    something, and the field and the button are clearly different controls.
- [ ] **TC-2.9 Group All / None shortcuts.** On Smart play ▸ **⋯** or on
    Flash cards, tap **None** then **All** beside Groups.
  - *Expected:* None clears every group and Start greys out reading "Select a
    group"; All restores them. Each shortcut greys out when it would do nothing.
- [ ] **TC-2.10 The setup is remembered where you left it.** On Smart play ▸
    **⋯**, turn off all types but *Choosing the name*, pick one group, tap
    **Max**, and Start. Quit the round and look at the menu card. Then look
    again after force-quitting and relaunching. Separately: open **⋯**, change
    the types, press Back **without** starting, and look at the card again.
  - *Priority:* High
  - *Expected:* the card comes back showing name-only and the full card count,
    both times, so the round is a single tap from the menu — and **Max** means
    the whole of today's deck even if the deck has grown since. The setup you
    backed out of without starting is **not** remembered. Flash cards keeps its
    own separate setup. Note the card plays **every** group whatever ⋯ last
    chose, because it has no group control of its own to show you.
- [ ] **TC-2.11 Start a round from the menu card.** On a fresh install, look at
    the Smart play card on the menu without opening anything else. Tap a
    question icon off and on again, drag the slider, then Start. Also try it
    with a deck smaller than 8 cards, and with the last icon left on.
  - *Priority:* High
  - *Expected:* all four icons start lit and the slider starts at **8** — or at
    the deck size when that is under 8, never above it. An icon that is off is
    clearly dimmer, not just differently outlined. The Start button and the
    number beside the slider both track the slider as you drag. Start plays that
    many cards of those types with no intervening screen. The last lit icon
    refuses to switch off. Offline, the **photo** icon is dimmed and will not
    light, and the round plays with the rest.

## 3. Photos & the fullscreen viewer

- [ ] **TC-3.1 More photos opens a grid of the whole set.**
  1. Tap the grid button in the bottom-left corner of the card.
  2. Wait for the photos to arrive, then scroll the grid.
  - *Preconditions:* A round in progress in a mode that shows a photo card
    (Smart play, Speedrun or Flash cards). Device online.
  - *Priority:* High
  - *Expected:* A scrollable grid of that species' photos opens, the card's own
    photo among them, and a spinner covers the wait while they are fetched. It
    is a grid from the first frame — opening on a single photo with the rest
    hidden behind a swipe nobody was told about is the behaviour this replaced.
- [ ] **TC-3.2 A photo filling the screen says whose it is.**
  1. Tap any photo in the grid.
  2. Read the line along the bottom of the screen.
  3. Swipe to the next photo and read it again.
  - *Preconditions:* The photo grid open (TC-3.1).
  - *Priority:* High
  - *Expected:* The photo opens full-screen, and a credit sits along the bottom
    beginning with "©", naming the photographer and the licence exactly as
    iNaturalist states them. Swiping to another photo swaps the credit for that
    photo's own. iNaturalist photos are licensed individually by the people who
    took them, so a full-screen photo with no credit is a licensing failure,
    not a cosmetic one.
- [ ] **TC-3.3 Back goes up a layer, close leaves.**
  1. Tap the back control at the top left.
  2. From the grid, tap the close control.
  - *Preconditions:* A photo open full-screen from the grid (TC-3.2).
  - *Expected:* Back returns to the grid with the round still waiting
    underneath; close leaves the viewer altogether and lands back on the card.
    They are deliberately two controls: one X meaning "up a layer" here and
    "leave" there would be a coin toss every time.
- [ ] **TC-3.4 Double-tapping the card skips the grid.**
  1. Double-tap the photo on the card itself.
  2. Look for a back control.
  - *Preconditions:* A round in progress with a photo card.
  - *Expected:* The photo opens full-screen directly, with no grid in between,
    and still carries its credit. There is no back control, because there is no
    grid to go back to — only close. That gesture means "bigger", not "show me
    the others".
- [ ] **TC-3.5 Zooming still works, and paging yields to it.**
  1. Pinch to zoom in, then drag around the photo.
  2. Drag horizontally while still zoomed in.
  3. Double-tap to zoom back out, then swipe sideways.
  - *Preconditions:* A photo open full-screen (from TC-3.2 or TC-3.4).
  - *Expected:* Pinch zooms and the drag pans within the photo rather than
    flipping to the next one. Once zoomed back out, a sideways swipe pages to
    the next photo again. ---

## 4. Deck sources & account

- [ ] **TC-4.1 Starter set (no account).** With no iNaturalist username set,
  play from the starter deck.
  - *Expected:* works offline-ish, no account needed.
  - *Preconditions:* No iNaturalist username set
- [ ] **TC-4.2 Own observations.** Set an iNaturalist username and switch to
  studying your own observations.
  - *Expected:* the deck rebuilds from that account's observations; changing the
    username reloads the deck (not stale cards from the previous account).
- [ ] **TC-4.3 Language / locale.** Change the language/locale.
  - *Expected:* common names switch language; the deck refreshes for the new
    locale (no leftover names in the old language).

## 5. Stats, Lexicon & streak

- [ ] **TC-5.1 Statistics screen.** Play several rounds, open Statistics.
  - *Preconditions:* Played several rounds
  - *Expected:* accuracy %, cards answered, species seen, a daily streak card, a
    recent-games chart, and a running accuracy-trend line — all consistent with
    what you just played. The trend line **ends on the accuracy % shown in the
    summary**, not merely near it (see TC-5.17).
- [ ] **TC-5.2 Per-species table.** Check the by-species table (success %, correct,
    incorrect) and its sort/filter, including the **"My observations"** filter.
  - *Expected:* tallies match play; a single wrong answer moves the right row.
- [ ] **TC-5.3 Score and question-type breakdown.** Play rounds
    in several formats, then open Statistics.
  - *Preconditions:* Rounds played in several question formats
  - *Priority:* High
  - *Expected:* a **Score** card showing points "of N possible" — harder
    questions are worth more (typing counts 4× a photo choice), so the Score
    rises faster after typed answers than after photo ones. A **By question
    type** card lists each format easiest-first with its own accuracy; a lower
    number further down is expected, not a bug. Play a **Flash cards** round:
    accuracy and the breakdown both change, but the **Score does not move** —
    self-graded answers do not score.
- [ ] **TC-5.4 Explanations live behind the i buttons.** On Statistics, tap the ⓘ
    in the corner of each card.
  - *Expected:* every card is figures only until you tap its ⓘ, which expands
    the explanation in place and turns the icon into a ✕. Opening a second card's
    ⓘ **closes the first** — only one at a time. The streak card still shows
    "Best: N" without tapping, since that is a figure rather than an explanation.
- [ ] **TC-5.5 Lexicon.** Open the Lexicon (list of species seen); filter by how
    well known.
  - *Expected:* every species you've met appears; search works.
- [ ] **TC-5.6 Streak - same day.** Play again the same day.
  - *Expected:* the streak does **not** double-count one calendar day.
- [ ] **TC-5.7 Streak - day rollover.** Play today, play again after
    local midnight (or nudge the device clock forward a day).
  - *Preconditions:* Optional/slow - needs a day change or clock nudge
  - *Priority:* Low
  - *Expected:* the streak increments by exactly 1; a missed day lapses it to 0
    while "longest" remembers the old run.
- [ ] **TC-5.8 Species you mix up appears.** In a multiple-choice mode (Smart play
    / Speedrun), deliberately pick the **same wrong
    look-alike** for a species **3+ times**, then open Statistics.
  - *Expected:* a **"Species you mix up"** card lists that pair — both species
    side by side (thumbnail + name) with "Mixed up N times". It does **not**
    appear below the 3× threshold.
- [ ] **TC-5.9 Compare + my tell note persists.** Tap a mix-up pair.
  - *Preconditions:* A mix-up pair exists
  - *Expected:* a side-by-side comparison opens (both photos + names). Type a
    note in **"Your tell"**, go back, reopen the pair → the note is still there,
    and the Stats row now reads **"Your tell ✓"**. Clearing the note removes the
    mark.
- [ ] **TC-5.10 Reset clears confusions and their notes.** With a mix-up
    pair on the Stats page and a **"Your tell"** note written for it (TC-5.9),
    reset statistics. On a synced account, then force a sync and reopen the pair
    — and check Device B too.
  - *Preconditions:* A mix-up pair on the Stats page with a Your tell note written for it; ideally sync on with a second device
  - *Priority:* High
  - *Expected:* the "Species you mix up" card is gone **and the note with it** —
    reopening that pair shows an empty "Your tell" and the row no longer reads
    "Your tell ✓". The note must **stay** gone after the sync, and must also
    disappear on Device B. Notes travel in the settings row, which is re-read on
    every pull, so a note that reappears means the deletion isn't propagating —
    the same failure the streak had in 2.37.3. Your flagged species, settings and
    downloaded photos are untouched.
- [ ] **TC-5.11 Just-in-time callout during play.** Keep picking the same wrong
    look-alike for a species in a choice mode (Smart play / Speedrun / By
    picture) until you've done it 3 times.
  - *Expected:* on that 3rd wrong pick, the answer reveal shows a red "You keep
    mixing these up — see them side by side" callout. Tapping it opens the
    comparison overlay for that pair; closing it returns to the round where you
    left off. A first/second mistake shows **no** callout; a correct answer never
    does.
- [ ] **TC-5.12 A/B duel drill.** Open a mix-up pair (from Statistics or the
    in-round callout) and tap **"Drill this pair"**.
  - *Preconditions:* A mix-up pair exists
  - *Expected:* a two-choice drill opens — one photo at a time with two name
    buttons whose order changes each question. Streak dots track progress toward
    6-in-a-row. Answer **6 correct in a row** → a **"You've got it!"** finish with
    **Drill again / Done**. On a wrong pick the correct name is shown (plus your
    "tell", if any) and you tap **Continue**; a correct pick advances on its own.
    Missing repeatedly ends after 20 questions with a **"Good progress"** finish.
    Photos vary between questions (not the same image every time); offline it
    still runs using the stored thumbnail.
- [ ] **TC-5.13 Verify the fix (re-seed + recovery callout).** Build up a mix-up
    pair (miss A as B **3+ times** in a choice mode), then keep playing **Smart play**
    and watch for that species to come up again.
  - *Preconditions:* A mix-up pair exists (missed 3+ times in a choice mode)
  - *Expected:* the old look-alike is now offered as one of the options (a
    deliberate re-test of the pair). Pick the **correct** species **3 times in a
    row** for that pair → a green **"You used to mix these up — now 3 in a row"**
    callout appears on the answer reveal. Missing the pair again clears the run
    (and no callout) until you rebuild it. Resetting statistics clears both the
    mix-up and the recovery streak.
- [ ] **TC-5.14 Spaced-repetition resurfacing.** Build up one or two mix-up pairs
    (miss A as B 3+ times), then start several **Smart play** rounds (a small card
    count, from groups that include those species).
  - *Preconditions:* One or two mix-up pairs exist (missed 3+ times)
  - *Expected:* the confused species resurface noticeably more often than a plain
    random draw would give — and when one appears, its **look-alike partner tends
    to appear in the same round** (interleaved, not back-to-back). After you've
    told a pair apart several times running (its recovery streak climbs), it stops
    dominating. With **no** mix-ups logged, Smart play rounds look like a normal random
    sample (new players unaffected).
- [ ] **TC-5.15 Your tell notes sync across devices.** With sync on and the same
    account on two devices, write a **Your tell** note for a pair on device A, then
    sync device B.
  - *Preconditions:* Sync on, same account on two devices
  - *Expected:* the note appears on device B's comparison screen for that pair
    (and its Stats row shows **"Your tell ✓"**). Editing the note on B and syncing
    back updates A (the most recent edit wins). Clearing the note on one device
    removes it on the other after a sync. Notes for *different* pairs written on the
    two devices before syncing both survive (neither clobbers the other). With sync
    **off**, notes stay device-local as before.
- [ ] **TC-5.16 Flagged species sync across devices.** With sync on and the same
    account on two devices, flag a species on device A, then sync device B.
  - *Preconditions:* Sync on, same account on two devices
  - *Expected:* the species shows as flagged on device B. Unflagging it on either
    device clears it on the other after a sync (the most recent toggle wins).
    Different species flagged on the two devices before syncing both survive.
    Flags are **per account** — switching to a different iNaturalist username shows
    that account's own flags, not the other's. With sync **off**, flags stay
    device-local.
- [ ] **TC-5.17 One-card round cannot inflate accuracy.** Note the lifetime
    accuracy % on the Statistics summary. Start a **Smart play round of 1 card**,
    answer it correctly, finish the round. Reopen Statistics.
  - *Preconditions:* Some existing play, so there is a lifetime accuracy to compare against
  - *Priority:* High
  - *Expected:* the accuracy % barely moves (one card against your lifetime
    total), and the **accuracy-trend line's right-hand end sits at the same
    percentage printed in the summary above it** — the two must agree. A 1-card
    100% round must **not** visibly lift the trend the way a long round does.
    Repeat with a long round (20+ cards) at a clearly different accuracy: *that*
    one should move the line noticeably. Rounds played before 2.37.0 have no
    recorded size and fall back to your average round length, so the very oldest
    bars are approximate — the endpoint is still exact.
- [ ] **TC-5.18 Success % ranking discounts thin samples.** Precondition: at
    least one species answered correctly **exactly once**, and one with a long
    record at high-but-imperfect accuracy (say 28 correct / 2 incorrect).
    Statistics → sort by **Success %**.
  - *Preconditions:* At least one species answered correctly exactly once, and one with a long record at high but imperfect accuracy (e.g. 28 correct / 2 incorrect)
  - *Priority:* High
  - *Expected:* the top of the list is species with a real record, not ones
    you've barely met: the 1-correct/0-incorrect species sits **below** the
    28/2 species despite a raw 100% vs 93%. A short note under the sort chips
    explains the ranking. Species never answered at all stay at the bottom.
    Sorting by **Correct** or **Incorrect** is unaffected (raw counts).
- [ ] **TC-5.19 Reset really resets the streak on a synced device.**
    Precondition: sync **on**, a multi-day streak, and a second device on the
    same account with play to contribute. On the synced device: Statistics ▸
    **Reset statistics**. Confirm the streak reads 0. Now force a sync (relaunch,
    or play a round on the other device and wait), and reopen Statistics.
  - *Preconditions:* Sync on, a multi-day streak, and a second device on the same account with play to contribute
  - *Priority:* High
  - *Expected:* the streak **stays** reset. Before 2.37.3 the reset cleared the
    streak counter but kept the record of *which days* you had played, and the
    streak is recomputed from those days on the next sync — so it silently came
    back and the reset looked like it hadn't worked. Lifetime totals stay reset
    too (they always did, which is what made the old bug look like flakiness
    rather than a bug).

## 6. Settings & theming

- [ ] **TC-6.1 Theme switch.** Switch theme Light / Dark / System.
  - *Expected:* the whole app re-themes immediately; text stays legible in both;
    "System" follows the OS toggle live.
- [ ] **TC-6.2 Filters.** Toggle each of: one-card-per-species, research-grade
  only, species-only.
  - *Expected:* each visibly changes which cards appear.
- [ ] **TC-6.3 Persistence across restart.** Force-quit and reopen.
  - *Priority:* High
  - *Expected:* username, language, theme, filters and all stats are exactly as
    left.
- [ ] **TC-6.4 Fresh photo once mastered.** Under Study options, turn on **"Fresh
    photo once mastered"**. Play a species you've already mastered (**5+ correct,
    80%+ accuracy** — check Statistics) in a self-photo mode (Smart play / Flash /
    Speedrun / Nearby).
  - *Preconditions:* A species is mastered (5+ correct, 80%+ accuracy)
  - *Expected:* that card shows a **random official (iNaturalist) photo**, not your
    own observation shot, and the photo varies across repeat appearances. Non-
    mastered species still show your own photo. With the setting **off**, every
    card shows your own photo as before. Offline (or a species with no official
    photos) falls back to your own photo. Photo questions are unchanged (they
    already use official photos).
- [ ] **TC-6.5 Only species named in your language.** Set the language to one with
    gaps (e.g. **Hungarian**), then under **Species name language** turn on
    **"Only species named in <language>"**.
  - *Expected:* the toggle **names the chosen language** and relabels live when you
    change the picker. Turning it on drops every species that has **no** name in
    that language — the deck's card count falls and you no longer see cards labelled
    only by their scientific (Latin) name. Turning it off restores the full deck.
    It composes with the other filters (research grade / species-only), persists
    across a force-quit, and — with sync on — rides to the other device. Off by
    default.

## 7. Offline & resilience

> Behaviour recap: after a deck loads online, gote prefetches a pack of its
> photos. Offline, the deck-local modes (Speedrun, Smart play, Flash) play
> only from downloaded cards; Nearby, Smart play's photo question, and
> observation updates are paused.

- [ ] **TC-7.1 Prime then go offline.** With a deck loaded, play online for a
  minute (let the offline pack warm), then turn on airplane mode and return to
  the menu.
  - *Expected:* an amber "You're offline…" banner; **Nearby** is dimmed
    ("Needs a connection"); **Speedrun / Smart play / Flash** stay tappable.
    Open Smart play: *Choosing the photo* is greyed and will not tick, with a
    line saying it needs a connection, and the other three still work. If you
    had left the picker on photos only, it opens on the types that CAN run
    rather than on a round it cannot ask.
  - *Preconditions:* Deck loaded
  - *Priority:* High
- [ ] **TC-7.2 Play a deck-local mode offline.** Start Speedrun (and Smart play /
  Flash).
  - *Expected:* real cards with photos — **no blank/broken images**; scoring
    and stats update locally; no crash.
  - *Preconditions:* Offline with a warmed pack
  - *Priority:* High
- [ ] **TC-7.3 Online-only modes blocked not broken.** Tap Nearby and By
  picture while offline.
  - *Expected:* they don't start (disabled); no dead screen or spinner-forever.
  - *Preconditions:* Offline
  - *Priority:* High
- [ ] **TC-7.4 Update paused offline.** Settings → the Observations row.
  - *Expected:* "Offline — reconnect to update" and the Update button is
    disabled.
  - *Preconditions:* Offline
- [ ] **TC-7.5 Fresh install offline (empty pack).** Delete the app, reinstall,
  and open it in airplane mode (nothing downloaded yet).
  - *Expected:* the banner says to connect once to load your deck, and the play
    modes are disabled rather than dealing blank cards.
  - *Preconditions:* Nothing downloaded
  - *Priority:* High
- [ ] **TC-7.6 Empty cache clears the offline pack.** Online, Settings →
  "Empty" (downloaded photos), then go offline.
  - *Expected:* the deck-local modes are now treated as having nothing
    downloaded (empty-pack state), consistent with the photos actually being
    gone.
  - *Preconditions:* Online
- [ ] **TC-7.7 Reconnect.** Turn networking back on.
  - *Expected:* the banner clears; all modes re-enable; new decks/images load
    again.
  - *Preconditions:* Was offline
- [ ] **TC-7.8 Backgrounding.** Background mid-round, return after a while.
  - *Expected:* state is intact or recovers gracefully; no lost progress for a
    finished round.

---


> Needs a sync-capable build on **both** devices. Enable sync on each at:
> **Settings ▸ Devices ▸ Sync across devices.** Off by default —
> "Sync is off. Everything stays on this device."

---

# Part 2 — The guided tour

The tour runs once, on a fresh install, so **do this part first** — several
of its cases cannot be reached again without deleting the app.

## 8. Tour: first run & lifecycle

- [ ] **TC-8.1 The tour starts by itself on a first-ever launch.**
  1. Launch the app and wait for the deck to finish loading.
  2. Observe the menu.
  - *Preconditions:* App deleted from the device and reinstalled, so no saved
    data exists. Device online.
  - *Priority:* High
  - *Expected:* The tour opens on its own at step "1 of 13", titled "Welcome to
    gote". The rest of the screen is dimmed. No spotlight ring is shown,
    because this step points at nothing in particular.
- [ ] **TC-8.2 The tour does not reappear once it has been seen.**
  1. Force-quit the app.
  2. Relaunch it.
  - *Preconditions:* TC-8.1 completed, then the tour finished or exited.
  - *Priority:* High
  - *Expected:* The menu appears with no bubble and no tutorial bar. This holds
    for every subsequent launch.
- [ ] **TC-8.3 The tour resumes where it left off after a force-quit.**
  1. Note the step number in the bubble.
  2. Force-quit the app from the app switcher.
  3. Relaunch it.
  - *Preconditions:* Tour running, stopped part-way (e.g. at step 5).
  - *Priority:* High
  - *Expected:* The tour is at the same step number as before. If that step
    lives on a screen other than the menu, the tutorial bar appears instead,
    naming the screen to go to.
- [ ] **TC-8.4 Resetting statistics does not restart the tour.**
  1. Open Statistics and scroll to the bottom.
  2. Tap "Reset statistics" and confirm.
  3. Return to the menu, then force-quit and relaunch.
  - *Preconditions:* Tour finished or exited. Some rounds played.
  - *Expected:* Statistics are cleared, and the tour stays away. Having been
    shown around is not a score.
- [ ] **TC-8.5 Tour progress does not travel between devices.**
  1. Install and launch the app on device B, and turn sync on with the same
     account.
  2. Wait for the sync to complete.
  - *Preconditions:* Two devices signed into the same sync account. Tour
    finished on device A. Device B has never had the app installed.
  - *Expected:* Device B still runs the tour on its first launch. "Have I been
    shown around this phone" is a property of the device, not the account. ---

## 9. Tour: the thirteen steps

- [ ] **TC-9.1 Step 2 scrolls the Settings row into view before pointing at it.**
  1. Without scrolling the menu yourself, tap "Next".
  2. Watch the menu.
  - *Preconditions:* Tour at step 1 on the menu.
  - *Priority:* High
  - *Expected:* The menu scrolls on its own until the Settings row is visible
    in the upper half of the screen, the row is lit inside the spotlight, and
    the bubble ("Start here") sits beside it with its arrow pointing at the
    row. The row starts below the fold on every phone, so a bubble pointing
    off-screen here is a failure.
- [ ] **TC-9.2 The highlighted control can be tapped through the dim.**
  1. Once the menu has stopped moving, tap the Settings row inside the
     spotlight.
  2. Restart the tour and reach step 2 again, this time tapping the row the
     instant it is lit, while the menu is still scrolling.
  - *Preconditions:* Tour at step 2, Settings row spotlit.
  - *Priority:* High
  - *Expected:* Settings opens on the first tap, both times. The spotlight is a
    real hole, not a picture of one — and the hole must not lag the row it
    follows. A tap that lands while the list is still settling has to work:
    that is exactly the moment someone reaches for a control the tour has just
    brought into view.
- [ ] **TC-9.3 Everything outside the spotlight is sealed off.**
  1. Tap the teal accuracy banner at the top (not spotlit).
  2. Drag the menu up and down, starting the drag outside the spotlight.
  3. Tap "Exit tutorial" in the bubble, then "Keep going".
  - *Preconditions:* Tour at step 2 on the menu, Settings row spotlit.
  - *Priority:* High
  - *Expected:* Neither the tap nor the drag does anything: the banner does not
    open Statistics and the menu does not move. A step is modal on purpose —
    the only live things on screen are the spotlit control and the bubble's own
    buttons, so the step cannot be side-stepped or scrolled out from under.
    "Exit tutorial" still works, which is what stops sealing the screen from
    trapping anyone.
- [ ] **TC-9.4 Step 4 leaves the username field AND the Save button usable.**
  1. Read the bubble ("Type your iNaturalist username and tap Save — or keep
     loarie for now if you have no account").
  2. Look at what the spotlight contains.
  3. Type your own iNaturalist username into the field.
  4. Tap Save.
  - *Preconditions:* Tour at step 4, on Settings.
  - *Priority:* High
  - *Expected:* The spotlight covers the field, its hint line and the Save
    button together — everything the bubble mentions is lit and reachable, and
    the bubble sits clear of all of it. Typing works with the keyboard up, the
    deck reloads, and the app returns to the menu with the tour advanced to
    step 5.
- [ ] **TC-9.5 The keyboard does not leave the bubble stranded.**
  1. Tap the username field so the keyboard rises.
  2. Watch the bubble and the spotlight.
  - *Preconditions:* Tour at step 4, on Settings.
  - *Expected:* Both follow the field as the screen shifts, staying attached to
    it. Neither is left behind at the old position or hidden behind the
    keyboard.
- [ ] **TC-9.6 Backing out of Settings without saving still moves the tour on.**
  1. Do not type anything. Tap "Menu" at the top left.
  - *Preconditions:* Tour at step 4, on Settings.
  - *Expected:* The tour advances to step 5 and points at Smart play. Choosing
    to keep the demo account is a decision, not a failure to comply.
- [ ] **TC-9.7 Steps 5 and 6 lead into a real round.**
  1. Read step 5, pointing at the Smart play card, and tap "Next".
  2. Note where step 6's bubble sits, then tap the spotlit Start button on the
     card.
  - *Preconditions:* Tour at step 5 on the menu, device online.
  - *Priority:* High
  - *Expected:* Step 6 points at Start with the bubble above it (Start sits at
    the bottom of the screen). Tapping Start begins a round and the tour
    advances to step 7.
- [ ] **TC-9.8 Step 7 points at the more-photos button during a live round.**
  1. Look at the bottom-left corner of the card.
  2. Tap the spotlit grid button.
  3. Scroll the grid, then tap one of the photos.
  4. Tap back, then close the viewer.
  5. Tap "Next" in the bubble.
  - *Preconditions:* Tour at step 7, a Smart play round in progress.
  - *Priority:* High
  - *Expected:* The grid button is spotlit and the bubble sits above it, clear
    of the answer choices. Tapping it opens a scrollable grid of that species'
    photos — the set, which is what the button is about. Tapping a photo opens
    it full-screen; back returns to the grid, close leaves the viewer, and the
    card is underneath with the bubble still up. "Next" advances to step 8.
    (The grid itself is covered in more detail by TC-3.1 to TC-3.5.)
- [ ] **TC-9.9 The tour stays out of the way for the rest of the round.**
  1. Answer every remaining card in the round.
  2. Pass through the results screen back to the menu.
  - *Preconditions:* Step 7 dismissed, round still in progress.
  - *Priority:* High
  - *Expected:* No bubble and no tutorial bar appear at any point while cards
    are being answered — a coach mark on top of a card is a bug. On the results
    screen the slim tutorial bar DOES come back, naming the menu as where to go
    next: results is the one moment mid-round where the user is idle and
    choosing what to do, and a tour that vanishes there reads as a tour that has
    died. Back on the menu, step 8's bubble is up.
- [ ] **TC-9.10 Step 8 opens Statistics from the banner.**
  1. Tap the spotlit accuracy banner.
  - *Preconditions:* Tour at step 8 on the menu.
  - *Expected:* Statistics opens and the tour advances to step 9, whose bubble
    is centred (it describes the whole screen rather than one control).
- [ ] **TC-9.11 Step 10 does not force the location permission.**
  1. Read the bubble about Nearby species.
  2. Tap "Next" without tapping the Nearby row.
  - *Preconditions:* Tour at step 10 on the menu, location permission not yet
    granted.
  - *Priority:* High
  - *Expected:* The tour advances to step 11 with no permission prompt. Nobody
    should have to grant location access to finish a tutorial.
- [ ] **TC-9.12 Step 12 points at Sync, and step 13 ends the tour.**
  1. Tap the spotlit Settings row.
  2. Read step 12, pointing at "Sync across devices".
  3. Tap "Next".
  4. Read step 13 and tap "Done".
  - *Preconditions:* Tour at step 11 on the menu.
  - *Priority:* High
  - *Expected:* Step 12's spotlight is on the Sync row. Step 13's button reads
    "Done", not "Next". Tapping it removes the overlay entirely; Settings is
    left as normal, with nothing dimmed.
- [ ] **TC-9.13 Tapping the spotlit Sync row counts as doing the step.**
  1. Tap the spotlit "Sync across devices" row instead of tapping Next.
  2. Look at the Sync screen.
  3. Tap back to Settings.
  - *Preconditions:* Tour at step 12, on Settings.
  - *Expected:* The Sync screen opens and the tour moves on to step 13. The bar
    on the Sync screen therefore reads "Tutorial · open Settings to continue"
    for step 13, and going back shows step 13's bubble ("That is the tour",
    with a Done button) — not step 12's again. Step 12 keeps its Next button
    because sync is opt-in, but opening the thing the step points at is doing
    the step.
- [ ] **TC-9.14 Opening Nearby from step 10 counts as doing it.**
  1. Tap the spotlit "Nearby species" row instead of tapping Next.
  2. Look at the place-picking screen.
  3. Go back to the menu.
  - *Preconditions:* Tour at step 10 on the menu, with the "Nearby species" row
    spotlit.
  - *Priority:* High
  - *Expected:* Nearby opens and the tour moves on to step 11: the bar reads
    "Tutorial · go back to the menu to continue", and returning to the menu
    shows step 11 pointing at the Settings row. It must not still be asking for
    Nearby. The spotlight is the only live control on a sealed screen and every
    action step before this one has been advanced by tapping it, so tapping it
    here is the natural move — being sent back to the same row is a loop whose
    only exit is a button nobody has needed since step 1. ---
- [ ] **TC-9.15 Step 3 asks for a name language before the username.**
  1. Arrive on Settings from step 2 and watch what the tour does next.
  2. Read the bubble ("Species names come from iNaturalist — choose the
     language you want them in").
  3. Open the picker, choose a language, then tap "Next".
  4. Restart the tour, reach step 3 again, and this time tap "Next" without
     touching the picker.
  5. Reach step 3 once more, then leave Settings with "Menu" instead.
  - *Preconditions:* Tour at step 2 on the menu.
  - *Priority:* High
  - *Expected:* The Settings screen **scrolls down on its own** to the "Species
    name language" section and spotlights the heading, its explanation and the
    picker together — the section starts well below the fold. The picker opens
    and works through the spotlight. "Next" moves to step 4, the username step,
    which means Settings scrolls back **up**. Skipping without changing the
    language is allowed — this step must never require a change. Leaving
    Settings does **not** pass it: the menu shows the bar reading "Tutorial ·
    open Settings to continue", and going back shows step 3 again.

## 10. Tour: exiting, restarting, wandering

- [ ] **TC-10.1 Exiting asks first, and can be declined.**
  1. Tap "Exit tutorial" in the bubble.
  2. Read the dialog.
  3. Tap "Keep going".
  - *Preconditions:* Tour running at any step.
  - *Priority:* High
  - *Expected:* The dialog is titled "Exit the tutorial?" and says "You can
    start it again any time from Settings." Tapping "Keep going" returns to the
    same step, unchanged.
- [ ] **TC-10.2 Exiting for good sticks.**
  1. Tap "Exit tutorial", then "Exit" in the dialog.
  2. Force-quit and relaunch the app.
  - *Preconditions:* Tour running.
  - *Priority:* High
  - *Expected:* The overlay disappears immediately, and the tour does not come
    back on relaunch.
- [ ] **TC-10.3 The tour can be restarted from Settings.**
  1. Open Settings and scroll to the "About" section.
  2. Tap "Take the tutorial".
  - *Preconditions:* Tour finished or exited.
  - *Priority:* High
  - *Expected:* The app returns to the menu and the tour opens at step 1 of 13.
    It starts from the beginning, not from wherever it was abandoned.
- [ ] **TC-10.4 Every step offers a way out.**
  1. Walk the tour from step 1 to step 13, and at each step confirm an exit
     control is present before advancing.
  2. On any step whose screen you are not currently on, confirm the tutorial
     bar's ✕ also offers the exit.
  - *Preconditions:* Fresh tour.
  - *Priority:* High
  - *Expected:* "Exit tutorial" appears on all thirteen bubbles, and the tutorial
    bar carries a ✕ that opens the same confirmation. There is no step where
    the tour cannot be left.
- [ ] **TC-10.5 Wandering off pauses the tour rather than losing it.**
  1. Force-quit the app and relaunch it. It reopens on the menu.
  2. Observe the bottom of the screen.
  3. Tap "Smart play" to go back.
  - *Preconditions:* Tour at step 6, on the Smart play screen with its Start
    button spotlit.
  - *Priority:* High
  - *Expected:* On the menu a slim bar reads "Tutorial · open Smart play to
    continue" — a bar, not a bubble, with nothing dimmed and nothing sealed,
    because the tour is not here. Tapping Smart play restores step 6's bubble.
    The tour never simply vanishes with no way back to it. (A relaunch is the
    way into this state: a step seals its own screen, so you cannot simply walk
    off one.) ---

## 11. Tour: presentation

- [ ] **TC-11.1 Small phone.**
  1. Walk all thirteen steps.
  - *Preconditions:* iPhone SE (or the smallest supported device). Fresh tour.
  - *Priority:* High
  - *Expected:* Every bubble is fully on screen, clear of the notch/status bar
    and the home indicator, and never covers the control it points at. On this
    screen some bubbles sit above their target rather than below — that is
    correct, not a defect.
- [ ] **TC-11.2 Large phone and iPad.**
  1. Walk all thirteen steps on each device.
  - *Preconditions:* iPhone Pro Max and an iPad. Fresh tour on each.
  - *Expected:* The bubble stays a readable width rather than stretching the
    full width of an iPad, remains centred on its target, and the arrow points
    at the target on every step.
- [ ] **TC-11.3 Dark mode.**
  1. Walk several steps, including one over a photo (step 7, in a round).
  - *Preconditions:* Settings → Appearance set to Dark. Fresh tour.
  - *Expected:* The bubble text is legible, the spotlight ring is visible
    against the dimmed background, and the "Next" button's label reads clearly
    on its fill. Nothing is grey-on-grey.
- [ ] **TC-11.4 Large system text.**
  1. Walk several steps, including the longest bodies (steps 1, 3 and 11).
  - *Preconditions:* iOS Settings → Display & Brightness → Text Size raised to
    a large setting. Fresh tour.
  - *Expected:* The text grows, the bubble grows with it, and it stays on
    screen and clear of its target. Text is not clipped mid-sentence.
- [ ] **TC-11.5 VoiceOver.**
  1. Swipe through the elements on a step with a spotlight.
  - *Preconditions:* VoiceOver on. Fresh tour.
  - *Priority:* Low
  - *Expected:* The step's title and body are announced, and the "Exit
    tutorial" and "Next" buttons are reachable and announced as buttons. ---

## 12. Tour: edge conditions

- [ ] **TC-12.1 Offline during the round step.**
  1. Start the round and reach step 7.
  - *Preconditions:* Tour at step 6 on the Smart play screen. Put the device in
    aeroplane mode before starting the round.
  - *Expected:* The more-photos button is hidden offline, so the step has
    nothing to point at: the bubble is centred with no spotlight and no arrow,
    and "Next" still advances. It must not point at an empty corner or freeze
    the tour.
- [ ] **TC-12.2 Build without sync credentials.**
  1. Reach step 12.
  - *Preconditions:* A build where the Sync row is absent from Settings.
  - *Priority:* Low
  - *Expected:* The bubble is centred with no spotlight rather than pointing at
    nothing, and "Next" advances to step 13.
- [ ] **TC-12.3 Backgrounding mid-step.**
  1. Swipe to the home screen, wait ten seconds, and return to the app.
  - *Preconditions:* Tour running at a spotlit step.
  - *Expected:* The same step is shown with the bubble and spotlight correctly
    positioned. Neither is left at a stale position.
- [ ] **TC-12.4 The tour after an account change.**
  1. Save a new username and let the deck reload.
  2. Return to the menu.
  - *Preconditions:* Tour finished. A different iNaturalist username saved in
    Settings.
  - *Priority:* Low
  - *Expected:* The tour does not restart. It is a property of the install, not
    the account. ---

---

---

# Part 3 — Cross-device sync (two devices)

## 13. Turning sync on & linking

- [ ] **TC-13.1 Enable sync on A.** On Device A, turn sync on.
  - *Preconditions:* Sync-capable build; Device A
  - *Expected:* copy changes to "Sync is on. Your progress is backed up…"; nothing
    else visibly breaks; play still instant.
- [ ] **TC-13.2 First upload.** After enabling, play a round on A, wait a moment.
  - *Preconditions:* Sync just enabled
  - *Expected:* no error. (Under the hood A's current stats + settings upload.)
- [ ] **TC-13.3 Add an email to A.** Choose **Connect this device**, enter your
    email, submit.
  - *Priority:* High
  - *Expected:* a **6-digit code** arrives by email; the screen asks for it and
    offers **Resend** (with a short cooldown before it re-enables).
- [ ] **TC-13.4 Confirm the code.** Enter the 6-digit code.
  - *Priority:* High
  - *Expected:* A shows "This device is connected. Sign in with the same address
    on your other devices." A wrong/short code is rejected with a clear message.
- [ ] **TC-13.5 Resend code.** Trigger Resend, use the newest code.
  - *Expected:* the latest code works; the cooldown prevents spamming.

## 14. Sharing progress A → B

- [ ] **TC-14.1 Sign in on B.** On Device B (with some of its **own** local play),
    go to Sync, choose **"I already have gote elsewhere"**, enter the **same**
    email, and confirm the code.
  - *Preconditions:* Device B has its own local play; same email as A
  - *Priority:* High
  - *Expected before confirming:* a warning that signing in **replaces this
    device's settings** (theme, filters, language, studied account) with the
    account's, but **play history is merged, not lost** — with a confirm step.
  - *Expected after:* "Signed in. Your progress from both devices has been
    merged." B's lifetime totals = A's + B's (nothing erased); B now shows A's
    settings.
  - *Expected:* Before confirm: a warning that settings are replaced but
    history is merged and kept, with a confirm step. After: 'Signed in. Your
    progress from both devices has been merged.'; B totals = A + B; B shows A's
    settings.
- [ ] **TC-14.2 Stats merge is additive.** Compare lifetime "answered" on B
  before vs after.
  - *Expected:* it went **up** by A's totals, not replaced by them.
  - *Priority:* High
- [ ] **TC-14.3 A picks up B's play.** Play a round on B, then relaunch A.
  - *Preconditions:* Both signed into same account
  - *Priority:* High
  - *Expected:* A's totals grow to include B's new round (append-only merge; no
    double-count on repeated relaunches).
- [ ] **TC-14.4 Confusions sync A -> B.** On A, build a confusion (pick the same
    wrong look-alike for a species 3+ times in a choice mode). Relaunch B (same
    account).
  - *Preconditions:* Both signed into same account
  - *Expected:* the pair appears in B's Statistics → "Species you mix up" with the
    same count (confusions ride the append-only log, so counts merge; playing the
    same confusion on both devices sums, never double-counts a single device's).
    The **"my tell" note itself does NOT cross over** — notes are device-local by
    design.
- [ ] **TC-14.5 Chart and streak reach a new device.** Precondition:
    Device A has **several days** of play from **before** sync was turned on — its
    accuracy chart has many bars and its streak spans multiple days. Turn sync on
    and add an email on A, then on a **fresh** Device B sign in to the same account.
  - *Preconditions:* Device A has several days of play from BEFORE sync was enabled (many chart bars, multi-day streak); sync then enabled and an email added on A
  - *Priority:* High
  - *Expected:* B shows not only A's lifetime accuracy **number** but its **accuracy
    chart (the bars)** and its **day streak** — the hero is a full graph, not a
    single point over an empty chart with a reset streak. (Pre-sync play used to
    upload as totals only; the baseline now carries the chart and the active-day
    set.) Note: this only helps devices that join **after** both run a build with
    the fix — history already uploaded as totals-only can't be back-filled.
    Each bar's **card count** travels with it too (2.37.0), so B's trend line
    ends on the same accuracy % as A's rather than drifting — check both devices
    show the same number under the hero. Bars A played before 2.37.0 carry no
    size and fall back to the average, which is expected.
- [ ] **TC-14.6 Sync off and on does not inflate totals.**
    **The regression test for the worst sync bug found so far — run it on every
    build.** With both devices signed into one account and their totals agreed,
    write down "cards answered" on **both**. On device B: Settings ▸ Devices ▸
    Sync ▸ turn sync **off**, then **on** again, then sign in with the same
    email. Repeat the whole cycle a **second** time. Relaunch A.
  - *Preconditions:* Both devices signed into one account with totals in agreement
  - *Priority:* High
  - *Expected:* the totals on **both** devices are **exactly** what you wrote
    down, after each cycle. Nothing grows. Before 2.37.2 each cycle re-read the
    whole account and added it again — so B's numbers jumped every time, and A's
    grew too because B re-uploaded its history on each pass. Toggling sync was
    the fastest way to corrupt the data, which is why this is worth repeating
    rather than trying once.
- [ ] **TC-14.7 Repeated syncs change nothing.** On either device, force several
    syncs in a row (relaunch a few times; play nothing in between).
  - *Preconditions:* Sync on, some history
  - *Priority:* High
  - *Expected:* lifetime totals, streak and the chart are identical every time.
    Any drift at all means events are being applied more than once.
- [ ] **TC-14.8 Retrieval signals are being recorded.** Nothing in the
    UI shows these, so this is checked in the data. With sync on, play a round of
    **Smart play** at a normal pace, then in the Supabase dashboard open the newest
    `events` row and look inside its `species` blob.
  - *Preconditions:* Sync on; access to the Supabase dashboard
  - *Expected:* each species carries `lastSeen` (a recent ms timestamp),
    `msTotal` and `msCount` alongside `known`/`missed`. `msCount` should equal
    the number of cards you answered **in that round on the phone**;
    `msTotal / msCount` should look like a plausible answer time (roughly
    1–10 s), not 0 and not tens of thousands. Then: play a **wrist round** on the
    watch and check its event — `msCount` must be **0** there (the watch sends no
    timing, and counting those as instant answers would poison the average),
    while `known`/`missed` still increment. Finally, leave one card on screen for
    over a minute before answering: that answer must **not** raise `msCount` (a
    pause that long describes an interruption, not recall).

## 15. Settings sync

- [ ] **TC-15.1 Change on A appears on B.** With both signed into the same
    account: change the **theme** (and language) on A. Relaunch B.
  - *Preconditions:* Both signed into same account
  - *Priority:* High
  - *Expected:* B adopts the new theme/language on start.
- [ ] **TC-15.2 Last change wins.** Change theme on B, then on A, then relaunch B.
  - *Preconditions:* Both signed into same account
  - *Priority:* High
  - *Expected:* B ends on **A's** later choice (most-recent change wins); no
    setting is silently lost.
- [ ] **TC-15.3 Studied account not clobbered.** Confirm the username/deck you
    study behaves per design after a settings sync (note anything surprising).
  - *Expected:* Behaves per design; note anything surprising.

## 16. Concurrent / offline devices

- [ ] **TC-16.1 Both play same day.** Play a round on A and a round on B the same
    day (same account). Relaunch both.
  - *Preconditions:* Both signed into same account
  - *Priority:* High
  - *Expected:* totals = the **sum** of both; the streak counts the day **once**
    (not twice).
- [ ] **TC-16.2 Offline catch-up.** Put B in airplane mode, play a few rounds,
    bring it back online and relaunch.
  - *Priority:* High
  - *Expected:* B's offline rounds reach the server and show up on A; nothing is
    lost or duplicated.

---

## 17. Linking edge cases

- [ ] **TC-17.1 Email already in use.** On a fresh Device C, choose **Connect this
    device** (the *link*, not sign-in path) with an email already tied to another
    account.
  - *Preconditions:* Fresh Device C; email already tied to another account
  - *Priority:* High
  - *Expected:* "That address is already used by another device. Choose 'I already
    have gote elsewhere' to sign in with it." — i.e. it steers you to sign-in, and
    does **not** silently overwrite.
- [ ] **TC-17.2 Link keeps local data (lossless).** On an anonymous synced device,
    use **Connect this device** with a **new** email.
  - *Preconditions:* Anonymous synced device
  - *Expected:* copy notes your on-device play "stays with you — connecting keeps
    it and adds a backup"; no warning about replacement (link is lossless), and
    totals are unchanged.
- [ ] **TC-17.3 Sign-in warning is honest.** Re-read the sign-in confirmation copy.
  - *Expected:* it clearly says settings are **replaced** but history is **merged
    and kept** — matching what actually happens in TC-14.1.

---

## 18. Account deletion

- [ ] **TC-18.1 Delete flow.** Settings ▸ Devices ▸ Sync ▸ **Delete synced
    account** → confirm at the "Delete synced account?" prompt.
  - *Priority:* High
  - *Expected:* success message ("Your account and all synced data have been
    deleted…"); the app stays usable with local data.
- [ ] **TC-18.2 Server really cleared.** In the Supabase dashboard, check
    **Authentication ▸ Users** and the `events` / `settings` tables for that user.
  - *Preconditions:* Supabase dashboard access
  - *Priority:* High
  - *Expected:* the user and all their rows are gone (cascade). If it 500s, check
    the `SUPABASE_SERVICE_ROLE_KEY` secret on the delete-account function.
- [ ] **TC-18.3 Other device after deletion.** On the other device signed into
  that account, try to sync after deletion.
  - *Expected:* no crash; it behaves as a signed-out / fresh account (note the
    exact behaviour).
  - *Preconditions:* Another device signed into that account
- [ ] **TC-18.4 Re-attaching the address after a delete.** After TC-18.1, turn
    sync on again and try **Sign in** with the same email address.
  - *Preconditions:* TC-18.1 completed - the synced account was deleted
  - *Expected:* sign-in **fails** — that user no longer exists, and the app never
    silently creates one. The way back is **Connect this device** (which attaches
    the address to a fresh account), not Sign in. Confirm the error message says
    something a user can act on rather than a raw server string.
- [ ] **TC-18.5 Data deleted on the server outside the app.** With sync
    on and history uploaded, delete that user's rows **straight from the `events`
    table** in the Supabase dashboard — the rows only, leaving the user in
    **Authentication ▸ Users**. Then open the app and let it sync (relaunch, or
    play a round).
  - *Preconditions:* Sync on, history uploaded, access to the Supabase dashboard
  - *Priority:* High
  - *Expected:* the device notices the account is empty and **re-uploads its
    history**; the `events` table repopulates and the other device gets it back.
    Before 2.37.2 this state was permanent — the device believed it had already
    uploaded and stayed silent forever, so the account never refilled. Check the
    device's own totals do **not** change while it recovers. This also covers a
    restore from an older backup.

---

---

# Part 4 — Apple Watch

## 19. Apple Watch

> Watch paired to Device A; gote installed on the watch (via TestFlight).

- [ ] **TC-19.1 Wrist round.** Play a quick quiz on the watch.
  - *Preconditions:* Watch paired to A; gote installed on the watch
  - *Expected:* photo-first quiz; Crown zoom and drag-pan work; correct/incorrect
    reveal (green/red); a session summary at the end.
- [ ] **TC-19.2 Wrist play counts into phone stats.** Open the phone afterwards.
  - *Priority:* High
  - *Expected:* the wrist round's answers count into lifetime totals, per-species
    tallies, the accuracy chart, and today's streak.
- [ ] **TC-19.3 Complications.** Add the Accuracy and Streak complications to a
  watch face.
  - *Expected:* they show current accuracy % and streak; the **Streak**
    complication shows the **gote newt** glyph (not a generic flame). Both
    refresh after play (allow for watchOS refresh cadence).
- [ ] **TC-19.4 Phone -> watch update.** Play on the phone, then open the watch home.
  - *Expected:* the watch's shown stats catch up to the phone.
- [ ] **TC-19.5 Complication refreshes in the background.** With a gote complication
    on the **active** watch face, play a round on the **phone** and then **do not
    open the watch app**. Glance at the watch face after a short while.
  - *Preconditions:* A gote complication is on the active watch face
  - *Priority:* High
  - *Expected:* the Streak/Accuracy complication catches up to the phone **on its
    own**, without opening the watch app first (allow for watchOS's background
    refresh cadence and its daily budget). Previously it stayed stale — e.g. a
    streak frozen at yesterday's number — until the watch app was next opened.

---
- [ ] **TC-19.6 The newt on the watch app's own screens.**
  1. Open gote on the watch and look at the streak on its home screen.
  2. Let the streak lapse (or check on a watch whose streak is zero) and look
     again.
  3. Look at the label under the accuracy gauge.
  - *Preconditions:* A paired Apple Watch with the gote watch app installed,
    and a streak of at least one day synced to it.
  - *Expected:* The streak is marked with the small gote newt, teal while the
    streak is running and dimmed when it is not — never a flame, which is the
    generic fitness glyph the app deliberately does not borrow. The accuracy
    gauge is labelled "acc" and carries no glyph of its own. ---

---

# Part 5 — Store-build sanity (before submission)

## 20. Store-build sanity

- [ ] **TC-20.1 No test flags.** Fresh install of the actual store/TestFlight
  build.
  - *Expected:* stats start at zero and species are real — i.e. `SHOTS` and
    `E2E` are **off**.
  - *Preconditions:* Fresh install of the store/TestFlight build
  - *Priority:* High
- [ ] **TC-20.2 No debug affordances.** No debug buttons/menus are reachable.
  - *Expected:* None are reachable.
- [ ] **TC-20.3 Legal & links.** Settings ▸ Legal / "Your data" opens; the privacy
    link loads `https://goteapp.com/PRIVACY.html`; the Ko-fi link opens.
  - *Expected:* The privacy link loads https://goteapp.com/PRIVACY.html; the
    Ko-fi link opens.
- [ ] **TC-20.4 Crash-free pass.** Run one round in each mode back-to-back without
    a crash.

---
  - *Expected:* No crash.


Newer ground than Parts 1–6, which is why it sits at the end rather than being
threaded through them: renumbering the sections above would rename their Testiny
folders and duplicate all 84 cases on the next import. Run **16 to 20 on a fresh
install**, before anything else has touched the app — the tour only ever runs
once, and several of its cases cannot be reached afterwards without deleting the
app again.

---

# Sign-off

| Part | Area | Result | Tester | Date | Build |
|---|---|---|---|---|---|
| 1 | Single device: the basics | ☐ | | | |
| 2 | The guided tour | ☐ | | | |
| 3 | Cross-device sync | ☐ | | | |
| 4 | Apple Watch | ☐ | | | |
| 5 | Store-build sanity | ☐ | | | |

**Blocking bugs found:** _none / list them (and add to BUGS.md)_

---

## Format

Testiny runs these; this file is where they are written. `npm test` validates
the shape on every run, and `node scripts/testiny-export.js` turns it into
`testiny-cases.csv` for import — see [Keeping Testiny in
sync](#keeping-testiny-in-sync) below, and in particular what an import can and
cannot update.

There is no hand-written CSV, and no second markdown file. Both existed once:
the CSV drifted from this file until 41 of 84 cases had a different title in one
than the other, and a separate `MANUAL-TESTS.md` grew a duplicate of a case this
plan already had. One copy of a case now, and it is here.

A case is a checklist item, so the document stays something a human walks
through:

```markdown
## 5. Stats, Lexicon & streak

- [ ] **TC-5.1 Statistics screen.** Open Statistics after a few rounds.
  - *Preconditions:* a couple of rounds played
  - *Priority:* High
  - *Expected:* every tile is populated…
  - *Note:* anything else indented under the case joins the expectation.
```

- The `## ` heading is the Testiny **folder**, verbatim — including its number.
  Sections are numbered **1..n straight through the file**, in reading order,
  and cases within one are `TC-<section>.<n>`, also straight through. There are
  no gaps and no letter suffixes: an id says where the case is, and nothing
  else. The `# Part n` dividers are for the reader and carry no cases of their
  own.
- The bold `TC-n.m Title.` is the id and the title. Change either one freely,
  but **not both in the same run**: the push matches a renumbered case by its
  title and a renamed one by its id, so a case that changes both at once has
  nothing linking it to its old self, and lands as a new case beside an orphan.
  Renumbering is otherwise cheap — do it rather than live with a gap.
- The steps are either prose after the bold title, as above, or a numbered list
  indented under it when the case is a sequence:

  ```markdown
  - [ ] **TC-9.2 The highlighted control can be tapped through the dim.**
    1. Once the menu has stopped moving, tap the Settings row.
    2. Restart the tour and tap the row while the menu is still scrolling.
    - *Expected:* Settings opens on the first tap, both times.
  ```

- `*Preconditions:*` and `*Priority:*` are optional. Priority defaults to
  **Medium**, so only High and Low are written down.
- `*Expected:*` is required. Any other italic sub-bullet — `*Also expected —*`,
  `*Note:*` — is folded into the expectation in the order written, because in
  Testiny they are all "what should have happened".


## Keeping Testiny in sync

Testiny is where these run; this file is where they are written. The loop:

1. Edit the cases above.
2. Regenerate the import file:

   ```bash
   node scripts/testiny-export.js
   ```

   It writes `testiny-cases.csv` (gitignored) and fails loudly if any case is
   missing a field, so a malformed case cannot reach Testiny as a blank.

3. In Testiny, open the project and choose **Import** (test cases), then upload
   the CSV. Map the columns when prompted — the header row is named to match
   Testiny's own field names (`Title`, `Precondition`, `Steps`, `Expected
   Result`, `Priority`, `Folder`), so the mapping should mostly be picked up for
   you.
4. **The import cannot update an existing case.** "Detect existing by" only
   decides whether a match is *skipped* or *created anyway* — there is no
   overwrite, and it cannot match on the `Reference` column; detection is on
   **folder & title**. So a re-import is safe to repeat and never needs a record
   of what was last imported, but it will not carry an edit into Testiny. Two
   consequences, both of which have to be done by hand:

   - **A case whose text changed** keeps its title, so it is skipped. Edit it in
     Testiny to match this file.
   - **A case whose title changed** arrives as a second copy and leaves the
     original behind. Delete the original.

   Treat titles as stable keys, and rename one only when the case genuinely
   became a different case.
5. The **Folder** column carries a path taken from the `##` headings above
   (`Guided tour/presentation` and so on), so the suite arrives with the same
   shape it has here rather than as one flat list. The **Reference** column
   carries the `GT-nn` id, which is how a case in Testiny is traced back to
   this file.
6. Add the cases to whichever test run covers the release, and record results in
   Testiny as usual. Results live there; the cases live here.

If your Testiny plan exposes the REST API and you would rather script step 4,
the CSV is straightforward to POST as test cases — check the field names against
your instance's API docs first, since they vary by version and by any custom
fields your project has added.
