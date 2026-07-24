# Privacy Policy for gote

**Last updated: 24 July 2026**

gote is a species-identification flashcard game for iPhone, iPad and Apple
Watch, built on the public [iNaturalist](https://www.inaturalist.org) API. This
policy explains what it stores, what leaves your device, and how to delete it.

The short version: **you can use gote without an account, and by default nothing
you do is sent to us.** Everything below describes features you switch on
yourself.

---

## What gote stores on your device

Kept locally, in the app's own storage. It never leaves your device unless you
turn on Sync across devices.

- The iNaturalist username you enter, and a cached copy of that account's public
  observations (photos, species names, dates, locations as provided by the API)
- Your gameplay statistics: rounds played, answers right and wrong, per-species
  tallies, accuracy history, and your daily streak
- Your preferences: language for species names, theme, and the game filters
- A cache of photo files, so cards work offline

Deleting the app deletes all of it. You can also clear statistics at any time in
**Settings ▸ Reset statistics**.

## What gote sends, and to whom

### iNaturalist (always)

To fetch cards, gote requests public data from `api.inaturalist.org`: the
observations of the username you entered, taxon information, look-alike species,
and — for **Nearby species** — the species commonly observed near a location you
choose. Photos are downloaded from iNaturalist's image servers.

These are ordinary web requests, so iNaturalist receives your device's IP
address and the query itself, as any website would. gote does not send them your
identity, and gote has no account system of its own for this. iNaturalist's
handling of that data is covered by their
[Privacy Policy](https://www.inaturalist.org/pages/privacy).

gote reads only **public** observations. It cannot see private or obscured
records, and it never writes anything to iNaturalist.

### Sync across devices (only if you turn it on)

If you enable **Settings ▸ Devices ▸ Sync across devices**, your gameplay data is
stored on servers operated by [Supabase](https://supabase.com) on our behalf, so
your devices can share one set of statistics.

What is stored there:

- An account identifier — a random ID, not linked to your name
- Your gameplay statistics: for each round, the number of cards answered and got
  right, the date in your local calendar, and per-species tallies including the
  species name
- Your preferences, and the iNaturalist username you entered
- **Your email address, only if you choose to link devices.** It is used solely
  to recognise your devices as belonging to the same person. There is no
  password, and we do not email you anything other than your sign-in codes.

What is **not** stored there: your photos, your location, your contacts, your
device identifiers for advertising, or anything about you beyond the above.

Sync is off unless you turn it on, and the app is fully usable without it.

### Crash reports (if enabled in a future release)

Some builds may include [Sentry](https://sentry.io) for crash reporting. When a
crash happens it records the error, the app version, and the device model and OS
version. It does not record your observations, statistics, or email address.

## Location

**Nearby species** asks for your location so it can find species observed near
you. The coordinates are used to make that single request and are not stored on
our servers or shared with anyone. You can decline the permission and pick a
place manually instead; every other part of gote works without location access.

## What gote does not do

- No advertising, no ad identifiers, no ad networks
- No tracking across other apps or websites, and no data sold or shared with
  data brokers
- No analytics profile of you as an individual
- No account required to use the app

## Deleting your data

- **On your device:** Settings ▸ Reset statistics clears your gameplay data.
  Deleting the app removes everything, including the cache.
- **On the server:** Settings ▸ Devices ▸ Sync across devices ▸ **Delete synced
  account** permanently deletes your account and every row associated with it,
  including your email address if you linked one. This is immediate and cannot
  be undone. Your statistics on the device you are holding are kept, so you can
  keep playing; use Reset statistics as well if you want those gone too.

You do not need to contact anyone to delete your data, but if something isn't
working you can reach us at the address below.

## Children

gote is not directed at children under 13 and does not knowingly collect
personal information from them. It requires no account to play, and the only
personal information it can ever hold is an email address you choose to provide.

## Data retention

Synced data is kept until you delete your account. If you never turn on sync,
there is nothing on our servers to retain.

## Where data is processed

Sync data is stored by Supabase in the region chosen for the project. If you are
in the EEA or UK, your data may be processed outside your country. You can avoid
this entirely by not enabling sync.

## Your rights

Depending on where you live you may have the right to access, correct, export or
delete your personal information, and to withdraw consent. The Delete synced
account button covers deletion immediately; for anything else, contact us.

## Changes

If this policy changes materially, the updated version will be published here
with a new date, and significant changes will be noted in the app's changelog.

## Contact

Questions about privacy: **koch.mate@gmail.com**

Source code: <https://github.com/turbolya/gote>

---

*gote is an independent, unofficial app. It is not created, endorsed or
supported by iNaturalist, the California Academy of Sciences, or the National
Geographic Society.*
