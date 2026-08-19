# Manual test cases

Cases a human has to run, because a simulator cannot: real devices, real
accounts, real network conditions, and the judgement calls ("does this bubble
cover anything it shouldn't?") that an assertion cannot make.

**This file is the source of truth.** Testiny is a consumer of it — see
[Keeping Testiny in sync](#keeping-testiny-in-sync) at the bottom. Edit the
cases here, regenerate the CSV, re-import.

Everything already covered by `npm test` (523 tutorial assertions) and
`npm run e2e:test` (31 Detox specs) is deliberately **not** repeated here. What
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

### GT-10 Step 2 scrolls the Settings row into view before pointing at it

**Priority:** High
**Preconditions:** Tour at step 1 on the menu.

1. Without scrolling the menu yourself, tap "Next".
2. Watch the menu.

**Expected:** The menu scrolls on its own until the Settings row is visible in the upper half of the screen, the row is lit inside the spotlight, and the bubble ("Start here") sits beside it with its arrow pointing at the row. The row starts below the fold on every phone, so a bubble pointing off-screen here is a failure.

### GT-11 The highlighted control can be tapped through the dim

**Priority:** High
**Preconditions:** Tour at step 2, Settings row spotlit.

1. Tap the Settings row inside the spotlight.

**Expected:** Settings opens on the first tap. The spotlight is a real hole, not a picture of one.

### GT-12 Controls outside the spotlight still work

**Priority:** High
**Preconditions:** Tour at step 2 on the menu.

1. Tap the green accuracy banner at the top (not spotlit).

**Expected:** Statistics opens. The dim never swallows a tap — a tutorial must not trap the user on one control.

### GT-13 Step 3 leaves the username field AND the Save button usable

**Priority:** High
**Preconditions:** Tour at step 3, on Settings.

1. Read the bubble ("Type your iNaturalist username and tap Save").
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
3. Swipe through the photos, then close the viewer.
4. Tap "Next" in the bubble.

**Expected:** The grid button is spotlit and the bubble sits above it, clear of the answer choices. Tapping it opens the photo viewer with more photos of that species. Closing it returns to the card with the bubble still up. "Next" advances to step 7.

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

### GT-22 Tapping the spotlit Sync row mid-step behaves sensibly

**Priority:** Low
**Preconditions:** Tour at step 11, on Settings.

1. Tap the spotlit "Sync across devices" row instead of tapping Next.
2. Look at the Sync screen.
3. Tap back to Settings.

**Expected:** The Sync screen opens normally and the tutorial bar appears at the bottom reading "Tutorial · open Settings to continue". Going back restores step 11's bubble. This is expected behaviour, not a defect — the step lives on Settings, and the tour waits rather than following you.

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
**Preconditions:** Tour at a step that lives on the menu (e.g. step 2).

1. Open the Lexicon from the menu.
2. Observe the bottom of the screen.
3. Go back to the menu.

**Expected:** On the Lexicon a slim bar reads "Tutorial · go back to the menu to continue". Returning to the menu restores the bubble at the same step. The tour never simply vanishes with no way back to it.

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
4. The **Folder** column carries a path taken from the `##` headings above
   (`Guided tour/presentation` and so on), so the suite arrives with the same
   shape it has here rather than as one flat list of 32. Re-importing updates
   existing cases when their **Title** matches and adds the rest, so the CSV can
   be re-imported after every edit rather than curated by hand. The **Reference**
   column carries the `GT-nn` id, which is how a case in Testiny is traced back
   to this file.
5. Add the cases to whichever test run covers the release, and record results in
   Testiny as usual. Results live there; the cases live here.

If your Testiny plan exposes the REST API and you would rather script step 3,
the CSV is straightforward to POST as test cases — check the field names against
your instance's API docs first, since they vary by version and by any custom
fields your project has added.
