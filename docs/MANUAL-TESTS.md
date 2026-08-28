# Manual test cases

Cases a human has to run, because a simulator cannot: real devices, real
accounts, real network conditions, and the judgement calls ("does this bubble
cover anything it shouldn't?") that an assertion cannot make.

**This file is the source of truth.** Testiny is a consumer of it — see
[Keeping Testiny in sync](#keeping-testiny-in-sync) at the bottom. Edit the
cases here, regenerate the CSV, re-import.

Everything already covered by `npm test` (1,634 tutorial assertions) and
`npm run e2e:test` (34 Detox specs) is deliberately **not** repeated here. What
follows is the residue: the things automation genuinely cannot reach.

## Format

Each case is `### <ID> <title>`, then Priority, Preconditions, numbered steps,
and a single Expected. `scripts/testiny-export.js` parses exactly that shape and
fails loudly if it drifts, so the CSV can never quietly stop matching this file.

---

## Guided tour — first run and lifecycle

### GT-01 The tour starts by itself on a first-ever launch

**Priority:** High
**Preconditions:** App deleted from the device and reinstalled, so no saved data exists. Device online.

1. Launch the app and wait for the deck to finish loading.
2. Observe the menu.

**Expected:** The tour opens on its own at step "1 of 12", titled "Welcome to gote". The rest of the screen is dimmed. No spotlight ring is shown, because this step points at nothing in particular.

### GT-02 The tour does not reappear once it has been seen

**Priority:** High
**Preconditions:** GT-01 completed, then the tour finished or exited.

1. Force-quit the app.
2. Relaunch it.

**Expected:** The menu appears with no bubble and no tutorial bar. This holds for every subsequent launch.

### GT-03 The tour resumes where it left off after a force-quit

**Priority:** High
**Preconditions:** Tour running, stopped part-way (e.g. at step 4).

1. Note the step number in the bubble.
2. Force-quit the app from the app switcher.
3. Relaunch it.

**Expected:** The tour is at the same step number as before. If that step lives on a screen other than the menu, the tutorial bar appears instead, naming the screen to go to.

### GT-04 Resetting statistics does not restart the tour

**Priority:** Medium
**Preconditions:** Tour finished or exited. Some rounds played.

1. Open Statistics and scroll to the bottom.
2. Tap "Reset statistics" and confirm.
3. Return to the menu, then force-quit and relaunch.

**Expected:** Statistics are cleared, and the tour stays away. Having been shown around is not a score.

### GT-05 Tour progress does not travel between devices

**Priority:** Medium
**Preconditions:** Two devices signed into the same sync account. Tour finished on device A. Device B has never had the app installed.

1. Install and launch the app on device B, and turn sync on with the same account.
2. Wait for the sync to complete.

**Expected:** Device B still runs the tour on its first launch. "Have I been shown around this phone" is a property of the device, not the account.

---

## Guided tour — walking the twelve steps

Run this whole section in one sitting, on a real device, with a real iNaturalist
account. The Detox suite walks the sequence, but never against the live API.

At every step, before doing anything else, check that the bubble is actually
drawn. A dimmed, sealed screen with no bubble on it is the worst state the tour
has — running, blocking, and invisible — and it looks like the app has frozen
rather than like a bug in the tour.

### GT-10 Step 2 scrolls the Settings row into view before pointing at it

**Priority:** High
**Preconditions:** Tour at step 1 on the menu.

1. Without scrolling the menu yourself, tap "Next".
2. Watch the menu.

**Expected:** The menu scrolls on its own until the Settings row is visible in the upper half of the screen, the row is lit inside the spotlight, and the bubble ("Start here") sits beside it with its arrow pointing at the row. The row starts below the fold on every phone, so a bubble pointing off-screen here is a failure.

### GT-11 The highlighted control can be tapped through the dim

**Priority:** High
**Preconditions:** Tour at step 2, Settings row spotlit.

1. Once the menu has stopped moving, tap the Settings row inside the spotlight.
2. Restart the tour and reach step 2 again, this time tapping the row the instant it is lit, while the menu is still scrolling.

**Expected:** Settings opens on the first tap, both times. The spotlight is a real hole, not a picture of one — and the hole must not lag the row it follows. A tap that lands while the list is still settling has to work: that is exactly the moment someone reaches for a control the tour has just brought into view.

### GT-12 Everything outside the spotlight is sealed off

**Priority:** High
**Preconditions:** Tour at step 2 on the menu, Settings row spotlit.

1. Tap the teal accuracy banner at the top (not spotlit).
2. Drag the menu up and down, starting the drag outside the spotlight.
3. Tap "Exit tutorial" in the bubble, then "Keep going".

**Expected:** Neither the tap nor the drag does anything: the banner does not open Statistics and the menu does not move. A step is modal on purpose — the only live things on screen are the spotlit control and the bubble's own buttons, so the step cannot be side-stepped or scrolled out from under. "Exit tutorial" still works, which is what stops sealing the screen from trapping anyone.

### GT-13 Step 3 leaves the username field AND the Save button usable

**Priority:** High
**Preconditions:** Tour at step 3, on Settings.

1. Read the bubble ("Type your iNaturalist username and tap Save — or keep loarie for now if you have no account").
2. Look at what the spotlight contains.
3. Type your own iNaturalist username into the field.
4. Tap Save.

**Expected:** The spotlight covers the field, its hint line and the Save button together — everything the bubble mentions is lit and reachable, and the bubble sits clear of all of it. Typing works with the keyboard up, the deck reloads, and the app returns to the menu with the tour advanced to step 4.

### GT-14 The keyboard does not leave the bubble stranded

**Priority:** Medium
**Preconditions:** Tour at step 3, on Settings.

1. Tap the username field so the keyboard rises.
2. Watch the bubble and the spotlight.

**Expected:** Both follow the field as the screen shifts, staying attached to it. Neither is left behind at the old position or hidden behind the keyboard.

### GT-15 Backing out of Settings without saving still moves the tour on

**Priority:** Medium
**Preconditions:** Tour at step 3, on Settings.

1. Do not type anything. Tap "Menu" at the top left.

**Expected:** The tour advances to step 4 and points at Smart play. Choosing to keep the demo account is a decision, not a failure to comply.

### GT-16 Steps 4 and 5 lead into a real round

**Priority:** High
**Preconditions:** Tour at step 4 on the menu, device online.

1. Tap the spotlit "Smart play" row.
2. On the Smart play screen, note where the bubble sits, then tap the spotlit Start button.

**Expected:** Step 5 points at Start with the bubble above it (Start sits at the bottom of the screen). Tapping Start begins a round and the tour advances to step 6.

### GT-17 Step 6 points at the more-photos button during a live round

**Priority:** High
**Preconditions:** Tour at step 6, a Smart play round in progress.

1. Look at the bottom-left corner of the card.
2. Tap the spotlit grid button.
3. Scroll the grid, then tap one of the photos.
4. Tap back, then close the viewer.
5. Tap "Next" in the bubble.

**Expected:** The grid button is spotlit and the bubble sits above it, clear of the answer choices. Tapping it opens a scrollable grid of that species' photos — the set, which is what the button is about. Tapping a photo opens it full-screen; back returns to the grid, close leaves the viewer, and the card is underneath with the bubble still up. "Next" advances to step 7. (The grid itself is covered in more detail by PH-01 to PH-04.)

### GT-18 The tour stays out of the way for the rest of the round

**Priority:** High
**Preconditions:** Step 6 dismissed, round still in progress.

1. Answer every remaining card in the round.
2. Pass through the results screen back to the menu.

**Expected:** No bubble and no tutorial bar appear at any point during the round, or on results. The tour reappears only once you are back on the menu, at step 7. A coach mark on top of a card being answered is a bug.

### GT-19 Step 7 opens Statistics from the banner

**Priority:** Medium
**Preconditions:** Tour at step 7 on the menu.

1. Tap the spotlit accuracy banner.

**Expected:** Statistics opens and the tour advances to step 8, whose bubble is centred (it describes the whole screen rather than one control).

### GT-20 Step 9 does not force the location permission

**Priority:** High
**Preconditions:** Tour at step 9 on the menu, location permission not yet granted.

1. Read the bubble about Nearby species.
2. Tap "Next" without tapping the Nearby row.

**Expected:** The tour advances to step 10 with no permission prompt. Nobody should have to grant location access to finish a tutorial.

### GT-21 Step 11 points at Sync, and step 12 ends the tour

**Priority:** High
**Preconditions:** Tour at step 10 on the menu.

1. Tap the spotlit Settings row.
2. Read step 11, pointing at "Sync across devices".
3. Tap "Next".
4. Read step 12 and tap "Done".

**Expected:** Step 11's spotlight is on the Sync row. Step 12's button reads "Done", not "Next". Tapping it removes the overlay entirely; Settings is left as normal, with nothing dimmed.

### GT-22 Tapping the spotlit Sync row counts as doing the step

**Priority:** Medium
**Preconditions:** Tour at step 11, on Settings.

1. Tap the spotlit "Sync across devices" row instead of tapping Next.
2. Look at the Sync screen.
3. Tap back to Settings.

**Expected:** The Sync screen opens and the tour moves on to step 12. The bar on the Sync screen therefore reads "Tutorial · open Settings to continue" for step 12, and going back shows step 12's bubble ("That is the tour", with a Done button) — not step 11's again. Step 11 keeps its Next button because sync is opt-in, but opening the thing the step points at is doing the step.

### GT-23 Opening Nearby from step 9 counts as doing it

**Priority:** High
**Preconditions:** Tour at step 9 on the menu, with the "Nearby species" row spotlit.

1. Tap the spotlit "Nearby species" row instead of tapping Next.
2. Look at the place-picking screen.
3. Go back to the menu.

**Expected:** Nearby opens and the tour moves on to step 10: the bar reads "Tutorial · go back to the menu to continue", and returning to the menu shows step 10 pointing at the Settings row. It must not still be asking for Nearby. The spotlight is the only live control on a sealed screen and every action step before this one has been advanced by tapping it, so tapping it here is the natural move — being sent back to the same row is a loop whose only exit is a button nobody has needed since step 1.

---

## Guided tour — exiting, restarting, wandering

### GT-30 Exiting asks first, and can be declined

**Priority:** High
**Preconditions:** Tour running at any step.

1. Tap "Exit tutorial" in the bubble.
2. Read the dialog.
3. Tap "Keep going".

**Expected:** The dialog is titled "Exit the tutorial?" and says "You can start it again any time from Settings." Tapping "Keep going" returns to the same step, unchanged.

### GT-31 Exiting for good sticks

**Priority:** High
**Preconditions:** Tour running.

1. Tap "Exit tutorial", then "Exit" in the dialog.
2. Force-quit and relaunch the app.

**Expected:** The overlay disappears immediately, and the tour does not come back on relaunch.

### GT-32 The tour can be restarted from Settings

**Priority:** High
**Preconditions:** Tour finished or exited.

1. Open Settings and scroll to the "About" section.
2. Tap "Take the tutorial".

**Expected:** The app returns to the menu and the tour opens at step 1 of 12. It starts from the beginning, not from wherever it was abandoned.

### GT-33 Every step offers a way out

**Priority:** High
**Preconditions:** Fresh tour.

1. Walk the tour from step 1 to step 12, and at each step confirm an exit control is present before advancing.
2. On any step whose screen you are not currently on, confirm the tutorial bar's ✕ also offers the exit.

**Expected:** "Exit tutorial" appears on all twelve bubbles, and the tutorial bar carries a ✕ that opens the same confirmation. There is no step where the tour cannot be left.

### GT-34 Wandering off pauses the tour rather than losing it

**Priority:** High
**Preconditions:** Tour at step 5, on the Smart play screen with its Start button spotlit.

1. Force-quit the app and relaunch it. It reopens on the menu.
2. Observe the bottom of the screen.
3. Tap "Smart play" to go back.

**Expected:** On the menu a slim bar reads "Tutorial · open Smart play to continue" — a bar, not a bubble, with nothing dimmed and nothing sealed, because the tour is not here. Tapping Smart play restores step 5's bubble. The tour never simply vanishes with no way back to it. (A relaunch is the way into this state: a step seals its own screen, so you cannot simply walk off one.)

---

## Guided tour — presentation

### GT-40 Small phone

**Priority:** High
**Preconditions:** iPhone SE (or the smallest supported device). Fresh tour.

1. Walk all twelve steps.

**Expected:** Every bubble is fully on screen, clear of the notch/status bar and the home indicator, and never covers the control it points at. On this screen some bubbles sit above their target rather than below — that is correct, not a defect.

### GT-41 Large phone and iPad

**Priority:** Medium
**Preconditions:** iPhone Pro Max and an iPad. Fresh tour on each.

1. Walk all twelve steps on each device.

**Expected:** The bubble stays a readable width rather than stretching the full width of an iPad, remains centred on its target, and the arrow points at the target on every step.

### GT-42 Dark mode

**Priority:** Medium
**Preconditions:** Settings → Appearance set to Dark. Fresh tour.

1. Walk several steps, including one over a photo (step 6, in a round).

**Expected:** The bubble text is legible, the spotlight ring is visible against the dimmed background, and the "Next" button's label reads clearly on its fill. Nothing is grey-on-grey.

### GT-43 Large system text

**Priority:** Medium
**Preconditions:** iOS Settings → Display & Brightness → Text Size raised to a large setting. Fresh tour.

1. Walk several steps, including the longest bodies (steps 1, 3 and 11).

**Expected:** The text grows, the bubble grows with it, and it stays on screen and clear of its target. Text is not clipped mid-sentence.

### GT-44 VoiceOver

**Priority:** Low
**Preconditions:** VoiceOver on. Fresh tour.

1. Swipe through the elements on a step with a spotlight.

**Expected:** The step's title and body are announced, and the "Exit tutorial" and "Next" buttons are reachable and announced as buttons.

---

## Guided tour — edge conditions

### GT-50 Offline during the round step

**Priority:** Medium
**Preconditions:** Tour at step 5 on the Smart play screen. Put the device in aeroplane mode before starting the round.

1. Start the round and reach step 6.

**Expected:** The more-photos button is hidden offline, so the step has nothing to point at: the bubble is centred with no spotlight and no arrow, and "Next" still advances. It must not point at an empty corner or freeze the tour.

### GT-51 Build without sync credentials

**Priority:** Low
**Preconditions:** A build where the Sync row is absent from Settings.

1. Reach step 11.

**Expected:** The bubble is centred with no spotlight rather than pointing at nothing, and "Next" advances to step 12.

### GT-52 Backgrounding mid-step

**Priority:** Medium
**Preconditions:** Tour running at a spotlit step.

1. Swipe to the home screen, wait ten seconds, and return to the app.

**Expected:** The same step is shown with the bubble and spotlight correctly positioned. Neither is left at a stale position.

### GT-53 The tour after an account change

**Priority:** Low
**Preconditions:** Tour finished. A different iNaturalist username saved in Settings.

1. Save a new username and let the deck reload.
2. Return to the menu.

**Expected:** The tour does not restart. It is a property of the install, not the account.

---

## Photos — the grid and full screen

The more-photos button belongs to every mode that shows a photo card, not only
the one the guided tour walks through (GT-17). Run these on a real device: the
photos come from the live iNaturalist API, and the credits are whatever the
photographers actually chose.

### PH-01 More photos opens a grid of the whole set

**Priority:** High
**Preconditions:** A round in progress in a mode that shows a photo card (Smart play, By name, Speedrun or Flash cards). Device online.

1. Tap the grid button in the bottom-left corner of the card.
2. Wait for the photos to arrive, then scroll the grid.

**Expected:** A scrollable grid of that species' photos opens, the card's own photo among them, and a spinner covers the wait while they are fetched. It is a grid from the first frame — opening on a single photo with the rest hidden behind a swipe nobody was told about is the behaviour this replaced.

### PH-02 A photo filling the screen says whose it is

**Priority:** High
**Preconditions:** The photo grid open (PH-01).

1. Tap any photo in the grid.
2. Read the line along the bottom of the screen.
3. Swipe to the next photo and read it again.

**Expected:** The photo opens full-screen, and a credit sits along the bottom beginning with "©", naming the photographer and the licence exactly as iNaturalist states them. Swiping to another photo swaps the credit for that photo's own. iNaturalist photos are licensed individually by the people who took them, so a full-screen photo with no credit is a licensing failure, not a cosmetic one.

### PH-03 Back goes up a layer, close leaves

**Priority:** Medium
**Preconditions:** A photo open full-screen from the grid (PH-02).

1. Tap the back control at the top left.
2. From the grid, tap the close control.

**Expected:** Back returns to the grid with the round still waiting underneath; close leaves the viewer altogether and lands back on the card. They are deliberately two controls: one X meaning "up a layer" here and "leave" there would be a coin toss every time.

### PH-04 Double-tapping the card skips the grid

**Priority:** Medium
**Preconditions:** A round in progress with a photo card.

1. Double-tap the photo on the card itself.
2. Look for a back control.

**Expected:** The photo opens full-screen directly, with no grid in between, and still carries its credit. There is no back control, because there is no grid to go back to — only close. That gesture means "bigger", not "show me the others".

### PH-05 Zooming still works, and paging yields to it

**Priority:** Medium
**Preconditions:** A photo open full-screen (from PH-02 or PH-04).

1. Pinch to zoom in, then drag around the photo.
2. Drag horizontally while still zoomed in.
3. Double-tap to zoom back out, then swipe sideways.

**Expected:** Pinch zooms and the drag pans within the photo rather than flipping to the next one. Once zoomed back out, a sideways swipe pages to the next photo again.

---

## Loading

### LD-01 The loading screen spins the newt, in teal

**Priority:** Medium
**Preconditions:** App freshly installed, or a username changed in Settings so the deck reloads. Device online.

1. Watch the screen while the observations download.

**Expected:** The spinner is the gote newt animation, tinted the brand teal, sitting above "Loading observations for <name>…", the "<n> of <total>" count, and the note that only the ~1,000 most recent observations are loaded. A plain grey system spinner may show for a moment on a first-ever launch while the animation is still decoding, and must give way to the newt — it is the fallback, not the spinner.

---

## Apple Watch

### WA-01 The streak is marked with a newt, not a flame

**Priority:** Medium
**Preconditions:** A paired Apple Watch with the gote watch app installed, and a streak of at least one day synced to it.

1. Open gote on the watch and look at the streak on its home screen.
2. Add the gote streak complication to a watch face, in both a circular and a rectangular slot.
3. Look at the accuracy gauge in the watch app.

**Expected:** Every streak is marked with the small gote newt — teal on the app's home screen while the streak is running, dimmed when it is not. No flame appears anywhere: the flame is the generic fitness glyph, and it was replaced in the app and in both complication shapes. The accuracy gauge is labelled "acc" rather than carrying a glyph of its own.

---

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
4. Re-importing matches on **Title**, so a case whose title changes here arrives
   as a new case and leaves the old one behind. Two so far: GT-12 was "Controls
   outside the spotlight still work" and GT-22 was "Tapping the spotlit Sync row
   mid-step behaves sensibly", and both now describe the opposite behaviour.
   Delete that stale pair by hand after importing — the **Reference** column
   (`GT-nn`) is what ties a case back to this file.
5. The **Folder** column carries a path taken from the `##` headings above
   (`Guided tour/presentation` and so on), so the suite arrives with the same
   shape it has here rather than as one flat list. Re-importing updates
   existing cases when their **Title** matches and adds the rest, so the CSV can
   be re-imported after every edit rather than curated by hand. The **Reference**
   column carries the `GT-nn` id, which is how a case in Testiny is traced back
   to this file.
6. Add the cases to whichever test run covers the release, and record results in
   Testiny as usual. Results live there; the cases live here.

If your Testiny plan exposes the REST API and you would rather script step 3,
the CSV is straightforward to POST as test cases — check the field names against
your instance's API docs first, since they vary by version and by any custom
fields your project has added.
