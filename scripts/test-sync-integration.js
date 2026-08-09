// Integration tests for cross-device sync — the REAL push/pull code, against a
// REAL Postgres with RLS on.
//
//   npm run test:sync            (starts nothing; see below)
//
// Why this exists: scripts/test-sync.js covers merge.js's pure functions and
// passed the whole time two bugs were shipping. Both lived in the wiring around
// the merge — a queued event that was never flushed, and a stale pull watermark
// after switching accounts — and neither is reachable without a database. This
// file drives src/sync/index.js itself, so that class of bug fails here instead
// of on a device.
//
// It simulates devices rather than driving simulators. A "device" is an
// independent in-memory kv backend plus its own Supabase client, which is
// exactly what distinguishes two installs: identity and outbox live in
// key-value storage. That makes the second device free, and the tests
// deterministic.
//
// SETUP — a local stack, so nothing touches the cloud project:
//
//   npx supabase start          # Docker; applies supabase/migrations/
//   npm run test:sync
//   npx supabase stop
//
// AFTER ADDING OR CHANGING A MIGRATION, reset first — `supabase start` only
// applies migrations when it first creates the DB, so an already-running stack
// keeps the OLD schema and most tests fail with "row count: expected 1, got 0"
// (the event insert silently fails on the missing column, so nothing lands):
//
//   npx supabase db reset       # re-applies ALL migrations to the local db
//   npm run test:sync
//
// It reads SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY from
// the environment, falling back to `supabase status`. If no instance is
// reachable it SKIPS with exit code 0 rather than failing, so `npm test` still
// works on a machine without Docker.

const path = require('path');
const { execFileSync } = require('child_process');
const babel = require('@babel/core');

const ROOT = path.join(__dirname, '..');

// --- module loading ---------------------------------------------------------
// The sync layer is ESM and imports across files; transpile each to CommonJS in
// memory and hand it a require that resolves siblings through the same loader,
// so one module graph is shared (a second copy of outbox.js would mean a second
// outbox). Same trick the other test scripts use, extended to a graph.

function makeLoader(kvBackend) {
  const cache = new Map();

  function load(rel) {
    const file = require.resolve(path.join(ROOT, rel));
    if (cache.has(file)) return cache.get(file);
    const code = babel.transformFileSync(file, {
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    }).code;
    const m = { exports: {} };
    cache.set(file, m.exports);

    const fakeRequire = (id) => {
      // The kv seam: every device gets its own backend, which is what makes
      // them independent installs rather than one app talking to itself.
      if (id === './kv' || id === '../kv') {
        return {
          __esModule: true,
          ...kvBackend,
          // client.js imports this by name; unused here because the test
          // injects its own client, but it must exist to destructure.
          storageAdapter: {
            getItem: kvBackend.getItem,
            setItem: kvBackend.setItem,
            removeItem: kvBackend.removeItem,
          },
        };
      }
      if (id.startsWith('.')) {
        const resolved = path.relative(ROOT, path.resolve(path.dirname(file), id));
        return load(resolved);
      }
      return require(id);
    };

    new Function('module', 'exports', 'require', code)(m, m.exports, fakeRequire);
    cache.set(file, m.exports);
    return m.exports;
  }

  return load;
}

function memoryKv(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: async (k) => (map.has(k) ? map.get(k) : null),
    setItem: async (k, v) => {
      map.set(k, String(v));
    },
    removeItem: async (k) => {
      map.delete(k);
    },
    multiRemove: async (keys) => keys.forEach((k) => map.delete(k)),
    _dump: () => Object.fromEntries(map),
  };
}

// --- environment ------------------------------------------------------------

function readEnv() {
  const fromEnv = {
    url: process.env.SUPABASE_URL,
    anon: process.env.SUPABASE_ANON_KEY,
    service: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  if (fromEnv.url && fromEnv.anon && fromEnv.service) return fromEnv;

  // Fall back to the local stack's own report, so no keys are hardcoded here.
  try {
    const out = execFileSync('npx', ['--yes', 'supabase@latest', 'status', '-o', 'env'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const get = (key) => {
      const m = out.match(new RegExp(`^${key}="?([^"\\n]+)"?$`, 'm'));
      return m ? m[1] : null;
    };
    return {
      url: get('API_URL'),
      anon: get('ANON_KEY'),
      service: get('SERVICE_ROLE_KEY'),
    };
  } catch {
    return {};
  }
}

// --- harness ----------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log('  ok   ' + name);
  } catch (e) {
    failed++;
    failures.push([name, e]);
    console.log('  FAIL ' + name + '\n         ' + (e && e.message));
  }
}

function eq(actual, expected, what) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${what}: expected ${b}, got ${a}`);
}

function ok(cond, what) {
  if (!cond) throw new Error(what);
}

// --- a simulated device -----------------------------------------------------

function makeDevice({ createClient, url, anon, name, optIn = true }) {
  // Sync is opt-in and OFF by default. Every test here is about sync MECHANICS,
  // so devices start opted in; the one test of the gate itself passes optIn:false.
  const kv = memoryKv(optIn ? { '@gote/sync/optIn': '1' } : {});
  const load = makeLoader(kv);

  // Its own client, so its own session — two devices are two users.
  const client = createClient(url, anon, {
    auth: {
      storage: {
        getItem: (k) => kv.getItem(k),
        setItem: (k, v) => kv.setItem(k, v),
        removeItem: (k) => kv.removeItem(k),
      },
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  const config = load('src/sync/config.js');
  const clientMod = load('src/sync/client.js');
  config.setSyncEnabledForTests(true); // no EXPO_PUBLIC_* is inlined under node
  clientMod.setClientForTests(client);

  return {
    name,
    kv,
    client,
    sync: load('src/sync/index.js'),
    storage: load('src/storage.js'),
    outbox: load('src/sync/outbox.js'),
  };
}

// --- main -------------------------------------------------------------------

(async () => {
  const { url, anon, service } = readEnv();
  if (!url || !anon) {
    console.log('\nsync integration: SKIPPED — no Supabase instance reachable.');
    console.log('  Start one with:  npx supabase start');
    console.log('  (or set SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY)\n');
    process.exit(0);
  }

  let createClient;
  try {
    ({ createClient } = require('@supabase/supabase-js'));
  } catch {
    console.log('\nsync integration: SKIPPED — @supabase/supabase-js not installed.\n');
    process.exit(0);
  }

  console.log(`\nsync integration — ${url}\n`);

  // Preflight. Without this an unreachable server makes some tests "pass" for
  // the wrong reason — "the forged insert was rejected" is true when every
  // request fails. A suite that goes green while nothing is running is worse
  // than no suite.
  try {
    const res = await fetch(`${url}/auth/v1/health`, { headers: { apikey: anon } });
    if (!res.ok) throw new Error(`health check returned ${res.status}`);
  } catch (e) {
    console.log(`  cannot reach ${url}: ${e.message}`);
    console.log('  Start the local stack with:  npx supabase start\n');
    process.exit(1);
  }

  const admin = service
    ? createClient(url, service, { auth: { persistSession: false } })
    : null;

  // --- anonymous sign-in ---------------------------------------------------
  console.log('auth');

  await test('sync is off by default: no upload, no account', async () => {
    // The privacy contract: a sync-capable build that the user has NOT opted
    // into must behave exactly like a build with no server at all.
    const d = makeDevice({ createClient, url, anon, name: 'off', optIn: false });
    const rid = await d.sync.recordEvent({ answered: 5, correct: 5, pct: 100 });
    eq(rid, null, 'recordEvent should no-op while sync is off');
    const merged = await d.sync.syncNow();
    eq(merged, null, 'syncNow should no-op while sync is off');
    eq(JSON.parse(d.kv._dump()['@gote/sync/outbox'] || 'null'), null, 'nothing queued');
    // No anonymous user was created.
    const { data } = await d.client.auth.getSession();
    eq(data.session, null, 'a session was created despite sync being off');
  });

  await test('a device can sign in anonymously', async () => {
    const d = makeDevice({ createClient, url, anon, name: 'A' });
    const id = await d.sync.ensureSession();
    ok(id, 'no user id — is the Anonymous provider enabled?');
  });

  await test('two devices get DIFFERENT anonymous users', async () => {
    const a = makeDevice({ createClient, url, anon, name: 'A' });
    const b = makeDevice({ createClient, url, anon, name: 'B' });
    const ia = await a.sync.ensureSession();
    const ib = await b.sync.ensureSession();
    ok(ia && ib, 'sign-in failed');
    ok(ia !== ib, 'both devices got the same user — anonymous accounts must be per-install');
  });

  // --- the round trip ------------------------------------------------------
  console.log('\npush / pull');

  await test('a finished round reaches the database', async () => {
    const a = makeDevice({ createClient, url, anon, name: 'A' });
    const userId = await a.sync.ensureSession();
    await a.sync.recordEvent({
      answered: 10,
      correct: 7,
      pct: 70,
      species: { 42: { name: 'Smooth newt', sci: 'Lissotriton vulgaris', known: 7, missed: 3 } },
    });
    await a.sync.syncNow();
    const { data, error } = await a.client.from('events').select('*').eq('user_id', userId);
    ok(!error, `select failed: ${error && error.message}`);
    const rows = data || [];
    eq(rows.length, 1, 'row count');
    eq(rows[0].answered, 10, 'answered');
    eq(rows[0].correct, 7, 'correct');
    eq(rows[0].species['42'].known, 7, 'species tally');
  });

  await test('the outbox is emptied once the push succeeds', async () => {
    const a = makeDevice({ createClient, url, anon, name: 'A' });
    await a.sync.ensureSession();
    await a.sync.recordEvent({ answered: 5, correct: 5, pct: 100 });
    ok(JSON.parse(a.kv._dump()['@gote/sync/outbox']).length === 1, 'not queued');
    await a.sync.syncNow();
    eq(JSON.parse(a.kv._dump()['@gote/sync/outbox']), [], 'outbox after sync');
  });

  await test('re-syncing does not duplicate rows', async () => {
    const a = makeDevice({ createClient, url, anon, name: 'A' });
    const userId = await a.sync.ensureSession();
    await a.sync.recordEvent({ answered: 3, correct: 2, pct: 66 });
    await a.sync.syncNow();
    await a.sync.syncNow();
    await a.sync.syncNow();
    const { data, error } = await a.client.from('events').select('id').eq('user_id', userId);
    ok(!error, `select failed: ${error && error.message}`);
    eq((data || []).length, 1, 'row count after three syncs');
  });

  await test('a device does not re-apply its own rows', async () => {
    // The bug this guards: pulling your own event and folding it in again,
    // doubling every number on the device that played it.
    const a = makeDevice({ createClient, url, anon, name: 'A' });
    await a.sync.ensureSession();
    await a.storage.saveStats({ answered: 10, correct: 7 });
    await a.sync.recordEvent({ answered: 10, correct: 7, pct: 70 });
    await a.sync.syncNow();
    await a.sync.syncNow();
    eq(await a.storage.loadStats(), { answered: 10, correct: 7 }, 'local totals');
  });

  await test('an existing player uploads their history on first sync', async () => {
    // Someone who has played for months and only now turns sync on. Without a
    // baseline the server would learn only about rounds played from this moment
    // and their second device would show an empty account.
    const a = makeDevice({ createClient, url, anon, name: 'A' });
    const userId = await a.sync.ensureSession();
    await a.storage.saveStats({ answered: 120, correct: 96 });
    await a.storage.saveSpeciesStats({
      42: { name: 'Smooth newt', sci: 'Lissotriton vulgaris', known: 30, missed: 4 },
    });
    await a.sync.syncNow();

    const { data } = await a.client.from('events').select('*').eq('user_id', userId);
    const rows = data || [];
    eq(rows.length, 1, 'baseline row count');
    eq(rows[0].answered, 120, 'baseline answered');
    eq(rows[0].correct, 96, 'baseline correct');
    eq(rows[0].pct, null, 'a baseline is not a round and must not reach the chart');
    eq(rows[0].species['42'].known, 30, 'baseline species tally');
  });

  await test('the baseline does not re-count a queued round', async () => {
    // The trap: local rollups ALREADY include a round that is still sitting in
    // the outbox. A baseline of the raw totals plus that round's own event
    // would put it on the account twice — invisible here, wrong everywhere else.
    const a = makeDevice({ createClient, url, anon, name: 'A' });
    const userId = await a.sync.ensureSession();
    await a.storage.saveStats({ answered: 10, correct: 7 });
    await a.sync.recordEvent({ answered: 10, correct: 7, pct: 70 }); // queued, not pushed
    await a.sync.syncNow();

    const { data } = await a.client.from('events').select('answered, correct').eq('user_id', userId);
    const total = (data || []).reduce(
      (acc, r) => ({ answered: acc.answered + r.answered, correct: acc.correct + r.correct }),
      { answered: 0, correct: 0 }
    );
    eq(total, { answered: 10, correct: 7 }, 'server total after first sync');
  });

  // --- isolation -----------------------------------------------------------
  console.log('\nrow-level security');

  await test('one user cannot read another user rows', async () => {
    const a = makeDevice({ createClient, url, anon, name: 'A' });
    const b = makeDevice({ createClient, url, anon, name: 'B' });
    await a.sync.ensureSession();
    await b.sync.ensureSession();
    await a.sync.recordEvent({ answered: 9, correct: 9, pct: 100 });
    await a.sync.syncNow();
    // B asks for everything it is allowed to see. A successful query returning
    // nothing is the pass; an error would mean the request never landed, which
    // proves nothing about RLS.
    const { data, error } = await b.client.from('events').select('*');
    ok(!error, `select failed, so this proves nothing: ${error && error.message}`);
    eq(data || [], [], "B could see A's events — RLS is not doing its job");
  });

  await test('a user cannot write a row owned by someone else', async () => {
    const a = makeDevice({ createClient, url, anon, name: 'A' });
    const b = makeDevice({ createClient, url, anon, name: 'B' });
    const idA = await a.sync.ensureSession();
    await b.sync.ensureSession();
    const { error } = await b.client.from('events').insert({
      id: '11111111-1111-4111-8111-111111111111',
      user_id: idA, // forged
      device_id: 'evil',
      ts: new Date().toISOString(),
      local_day: '2026-01-01',
      answered: 999,
      correct: 999,
    });
    // Must be REJECTED by the policy, not merely failed. A connection error
    // would satisfy a bare `ok(error)` while proving nothing — the preflight
    // above rules that out, and this checks the shape of the refusal.
    ok(error, 'the insert was ALLOWED — the with-check policy is missing');
    ok(
      /row-level security|policy|violates/i.test(error.message || ''),
      `rejected, but not by RLS: ${error.message}`
    );
  });

  await test('history is append-only: a row cannot be updated', async () => {
    const a = makeDevice({ createClient, url, anon, name: 'A' });
    const userId = await a.sync.ensureSession();
    await a.sync.recordEvent({ answered: 4, correct: 1, pct: 25 });
    await a.sync.syncNow();
    const { data } = await a.client.from('events').select('id').eq('user_id', userId);
    ok((data || []).length === 1, 'setup: the row was not written');
    const { error, count } = await a.client
      .from('events')
      .update({ correct: 4 }, { count: 'exact' })
      .eq('id', data[0].id);
    // No update policy exists, so RLS silently matches zero rows rather than
    // erroring. Either outcome is fine; a successful edit is not.
    ok(error || count === 0, 'a past round could be rewritten');
  });

  // --- two devices ---------------------------------------------------------
  console.log('\ntwo devices, one account');

  await test('linkEmail is accepted for an anonymous account', async () => {
    const a = makeDevice({ createClient, url, anon, name: 'A' });
    await a.sync.ensureSession();
    const res = await a.sync.linkEmail(`link-${Date.now()}@example.com`);
    ok(res.ok, `linkEmail rejected: ${res.error}`);
  });

  await test('signing in on device B merges both histories', async () => {
    if (!admin) throw new Error('needs SERVICE_ROLE_KEY to mint an OTP');
    const email = `merge-${Date.now()}@example.com`;

    // Device A: play, then end up with a confirmed address (see attachEmail —
    // the link flow's own token is only obtainable from a real inbox).
    const a = makeDevice({ createClient, url, anon, name: 'A' });
    const idA = await a.sync.ensureSession();
    await a.storage.saveStats({ answered: 10, correct: 8 });
    await a.sync.recordEvent({ answered: 10, correct: 8, pct: 80 });
    await a.sync.syncNow();
    await attachEmail(admin, idA, email);

    // Device B: its own history, then join A's account.
    const b = makeDevice({ createClient, url, anon, name: 'B' });
    await b.sync.ensureSession();
    await b.storage.saveStats({ answered: 6, correct: 3 });
    await b.sync.recordEvent({ answered: 6, correct: 3, pct: 50 });
    await b.sync.syncNow();

    const sent = await b.sync.signInWithEmail(email);
    ok(sent.ok, `signInWithEmail failed: ${sent.error}`);
    const signedIn = await b.sync.confirmSignIn(email, await otpFor(admin, url, email));
    ok(signedIn.ok, `confirmSignIn failed: ${signedIn.error}`);
    await b.sync.afterAuthChange();

    // B keeps its own 6/3 and gains A's 10/8.
    eq(await b.storage.loadStats(), { answered: 16, correct: 11 }, "B's totals after merge");
  });

  await test('the account switch does not double-count on B', async () => {
    // Guards the reconcile in afterAuthChange: B uploads a baseline of its own
    // totals, and must not then apply that baseline back to itself.
    if (!admin) throw new Error('needs SERVICE_ROLE_KEY');
    const email = `nodup-${Date.now()}@example.com`;

    const a = makeDevice({ createClient, url, anon, name: 'A' });
    const idA = await a.sync.ensureSession();
    await a.sync.recordEvent({ answered: 2, correct: 2, pct: 100 });
    await a.sync.syncNow();
    await attachEmail(admin, idA, email);

    const b = makeDevice({ createClient, url, anon, name: 'B' });
    await b.sync.ensureSession();
    await b.storage.saveStats({ answered: 20, correct: 10 });
    ok((await b.sync.signInWithEmail(email)).ok, 'signin');
    ok((await b.sync.confirmSignIn(email, await otpFor(admin, url, email))).ok, 'confirm B');
    await b.sync.afterAuthChange();
    await b.sync.syncNow();
    await b.sync.syncNow(); // extra passes must change nothing

    eq(await b.storage.loadStats(), { answered: 22, correct: 12 }, 'B after repeated syncs');
  });

  await test('turning sync off and on again does not double-count', async () => {
    // The bug this guards, seen on a real iPad: the pull watermark and the
    // applied-id ledger were BOTH cleared on every account switch, and a sync
    // off/on cycle is two account switches (out to a throwaway anonymous
    // account, back to the real one). Each cycle re-read the account's whole
    // history with an empty ledger and added it to rollups that already
    // contained it, so the two devices drifted further apart every time the
    // user tried to fix them by toggling sync.
    if (!admin) throw new Error('needs SERVICE_ROLE_KEY');
    const email = `toggle-${Date.now()}@example.com`;

    const a = makeDevice({ createClient, url, anon, name: 'A' });
    const idA = await a.sync.ensureSession();
    await a.storage.saveStats({ answered: 30, correct: 24 });
    await a.sync.recordEvent({ answered: 30, correct: 24, pct: 80 });
    await a.sync.syncNow();
    await attachEmail(admin, idA, email);

    const b = makeDevice({ createClient, url, anon, name: 'B' });
    await b.sync.ensureSession();
    await b.storage.saveStats({ answered: 10, correct: 5 });
    ok((await b.sync.signInWithEmail(email)).ok, 'signin');
    ok((await b.sync.confirmSignIn(email, await otpFor(admin, url, email))).ok, 'confirm');
    await b.sync.afterAuthChange();

    const settled = await b.storage.loadStats();
    eq(settled, { answered: 40, correct: 29 }, 'B after joining');

    // Now the exact sequence a confused user performs: off, on, sign in again.
    for (let cycle = 1; cycle <= 2; cycle++) {
      await b.sync.disableSync();
      await b.sync.enableSync(); // mints a fresh anonymous account
      // Straight to the code, skipping signInWithEmail. Asking for a second one
      // this fast trips the mailer's own resend cooldown (config.toml
      // max_frequency), which is a property of the mail service and has nothing
      // to do with what this test is about — the request path is covered by
      // "signing in on device B merges both histories" above. What matters here
      // is the session actually switching back to the real account, which is
      // what confirmSignIn does and what triggers the reconcile.
      const confirmed = await b.sync.confirmSignIn(email, await otpFor(admin, url, email));
      ok(confirmed.ok, `confirm cycle ${cycle}: ${confirmed.error}`);
      await b.sync.afterAuthChange();
      await b.sync.syncNow();
      eq(await b.storage.loadStats(), settled, `B unchanged after off/on cycle ${cycle}`);
    }

    // And A must not have been inflated by B re-uploading a baseline each time.
    await a.sync.syncNow();
    eq(await a.storage.loadStats(), { answered: 40, correct: 29 }, 'A after B toggled twice');
  });

  await test('an account emptied out of band gets re-baselined', async () => {
    // Deleting the rows straight out of the table (dashboard surgery, a restore
    // from an older backup, a project reset) tells the client nothing: it still
    // believes it baselined this account, and its watermark still points past
    // rows that no longer exist. Without the guard it would upload nothing and
    // pull nothing for good, leaving the account permanently empty.
    if (!admin) throw new Error('needs SERVICE_ROLE_KEY');

    const a = makeDevice({ createClient, url, anon, name: 'A' });
    const idA = await a.sync.ensureSession();
    await a.storage.saveStats({ answered: 12, correct: 9 });
    await a.sync.recordEvent({ answered: 12, correct: 9, pct: 75 });
    await a.sync.syncNow();

    const before = await admin.from('events').select('id').eq('user_id', idA);
    ok(before.data.length > 0, 'nothing was uploaded to begin with');

    // The out-of-band deletion. Rows only — the auth user survives, which is
    // exactly what makes the client's stale bookkeeping a problem.
    const del = await admin.from('events').delete().eq('user_id', idA);
    ok(!del.error, `manual delete failed: ${del.error && del.error.message}`);
    eq((await admin.from('events').select('id').eq('user_id', idA)).data.length, 0, 'rows gone');

    // Same account, same device, next sync.
    await a.sync.syncNow();

    const after = await admin.from('events').select('answered, correct').eq('user_id', idA);
    ok(after.data.length > 0, 'account is still empty — the baseline was not re-sent');
    const total = after.data.reduce(
      (acc, r) => ({ answered: acc.answered + r.answered, correct: acc.correct + r.correct }),
      { answered: 0, correct: 0 }
    );
    eq(total, { answered: 12, correct: 9 }, 're-sent baseline should restore the totals');

    // And the device must not have inflated itself in the process.
    eq(await a.storage.loadStats(), { answered: 12, correct: 9 }, 'A after recovery');
  });

  await test('a healthy account is never re-baselined', async () => {
    // The guard above must stay narrow: repeated syncs against an account that
    // genuinely has rows must not add anything.
    const a = makeDevice({ createClient, url, anon, name: 'A' });
    const idA = await a.sync.ensureSession();
    await a.storage.saveStats({ answered: 7, correct: 7 });
    await a.sync.recordEvent({ answered: 7, correct: 7, pct: 100 });
    await a.sync.syncNow();
    const rows = (await admin.from('events').select('id').eq('user_id', idA)).data.length;

    await a.sync.syncNow();
    await a.sync.syncNow();

    eq(
      (await admin.from('events').select('id').eq('user_id', idA)).data.length,
      rows,
      'extra syncs added rows to a healthy account'
    );
    eq(await a.storage.loadStats(), { answered: 7, correct: 7 }, 'A unchanged');
  });

  await test('a re-sent baseline collides with itself instead of duplicating', async () => {
    // Belt to the guard above: the baseline id is derived from (device,
    // account), so even a client that somehow asks twice writes the same row.
    const { outbox } = makeDevice({ createClient, url, anon, name: 'uid' });
    const first = outbox.baselineUid('device-1', 'user-1');
    eq(outbox.baselineUid('device-1', 'user-1'), first, 'same inputs, same id');
    ok(outbox.baselineUid('device-2', 'user-1') !== first, 'different device, different id');
    ok(outbox.baselineUid('device-1', 'user-2') !== first, 'different account, different id');
    ok(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(first),
      `not a well-formed uuid: ${first}`
    );
  });

  await test("device A picks up device B's baseline", async () => {
    if (!admin) throw new Error('needs SERVICE_ROLE_KEY');
    const email = `back-${Date.now()}@example.com`;

    const a = makeDevice({ createClient, url, anon, name: 'A' });
    const idA = await a.sync.ensureSession();
    await a.storage.saveStats({ answered: 4, correct: 4 });
    await a.sync.recordEvent({ answered: 4, correct: 4, pct: 100 });
    await a.sync.syncNow();
    await attachEmail(admin, idA, email);

    const b = makeDevice({ createClient, url, anon, name: 'B' });
    await b.sync.ensureSession();
    await b.storage.saveStats({ answered: 5, correct: 1 });
    ok((await b.sync.signInWithEmail(email)).ok, 'signin');
    ok((await b.sync.confirmSignIn(email, await otpFor(admin, url, email))).ok, 'confirm');
    await b.sync.afterAuthChange(); // uploads B's baseline

    await a.sync.syncNow();
    eq(await a.storage.loadStats(), { answered: 9, correct: 5 }, "A after B's baseline");
  });

  await test('a joining device gets the accuracy chart and streak, not just totals', async () => {
    // The bug this guards: a device that played BEFORE turning sync on used to
    // upload a totals-only baseline, so a second device showed the right lifetime
    // number over an empty chart and a reset streak. The baseline now carries the
    // per-round history and the active-day set too.
    if (!admin) throw new Error('needs SERVICE_ROLE_KEY');
    const email = `hist-${Date.now()}@example.com`;

    // Device A: several days of play sitting in LOCAL storage, nothing queued —
    // exactly the pre-sync state. Turning sync on uploads one baseline event.
    const a = makeDevice({ createClient, url, anon, name: 'A' });
    const idA = await a.sync.ensureSession();
    await a.storage.saveStats({ answered: 40, correct: 30 });
    // Sizes for the newest three bars only — the state of a device whose oldest
    // round predates them. They are right-aligned with the chart, and must land
    // opposite the same bars on B.
    await a.storage.saveHistory([60, 70, 80, 90], [10, 20, 10]);
    await a.storage.saveActiveDays(['2026-03-01', '2026-03-02', '2026-03-03']);
    await a.sync.syncNow(); // first sync → uploadBaseline carries history + days
    await attachEmail(admin, idA, email);

    // Device B, fresh, joins the account.
    const b = makeDevice({ createClient, url, anon, name: 'B' });
    await b.sync.ensureSession();
    ok((await b.sync.signInWithEmail(email)).ok, 'signin');
    ok((await b.sync.confirmSignIn(email, await otpFor(admin, url, email))).ok, 'confirm');
    await b.sync.afterAuthChange('signin');

    eq(await b.storage.loadHistory(), [60, 70, 80, 90], "B rebuilt A's accuracy chart");
    eq(
      await b.storage.loadHistoryCounts(),
      [0, 10, 20, 10],
      "B rebuilt A's round sizes, aligned to the same bars"
    );
    const days = JSON.parse(b.kv._dump()['@gote/activeDays'] || '[]');
    ok(
      days.includes('2026-03-01') && days.includes('2026-03-02') && days.includes('2026-03-03'),
      "B rebuilt A's active days"
    );
  });

  // --- settings ------------------------------------------------------------
  console.log('\nsettings');

  await test('an older client write preserves a newer key (data merge)', async () => {
    const a = makeDevice({ createClient, url, anon, name: 'A' });
    const userId = await a.sync.ensureSession();

    // A NEWER client seeds the row with a key this build predates. This is the
    // insert, so the row is stored verbatim (the merge trigger is update-only).
    const seed = await a.client.from('settings').upsert(
      {
        user_id: userId,
        data: { v: 1, prefs: { locale: 'hu' }, username: 'ada', deckPrefs: { sort: 'az' } },
        updated_at: new Date(1000).toISOString(),
      },
      { onConflict: 'user_id' }
    );
    eq(seed.error, null, 'seed insert ok');

    // This OLDER client then saves its settings, knowing nothing of deckPrefs.
    await a.storage.savePrefs({ locale: 'en' });
    await a.storage.saveUsername('ada');
    await a.sync.pushLocalSettings();

    // The BEFORE UPDATE trigger shallow-merged old||new: the unknown key
    // survives, the keys the old client did send are updated.
    const { data } = await a.client
      .from('settings')
      .select('data')
      .eq('user_id', userId)
      .maybeSingle();
    eq(data.data.deckPrefs, { sort: 'az' }, 'newer key preserved by the merge');
    eq(data.data.prefs.locale, 'en', 'the key the old client owns is updated');
  });

  await test("a my-tell note rides the settings row and merges per note", async () => {
    const a = makeDevice({ createClient, url, anon, name: 'A' });
    const userId = await a.sync.ensureSession();

    // Another device's note is already on the row (its own `n:` top-level key).
    const seed = await a.client.from('settings').upsert(
      {
        user_id: userId,
        data: { v: 2, prefs: {}, username: 'ada', 'n:C D': { text: 'grey bill', t: 5 } },
        updated_at: new Date(1000).toISOString(),
      },
      { onConflict: 'user_id' }
    );
    eq(seed.error, null, 'seed insert ok');

    // This device writes its OWN note for a different pair, then pushes.
    await a.storage.saveConfusionNote('A B', 'toothed leaves', 2000);
    await a.sync.pushLocalSettings();

    // The shallow-merge keeps each note independent: both `n:` keys survive.
    const { data } = await a.client
      .from('settings')
      .select('data')
      .eq('user_id', userId)
      .maybeSingle();
    // Field-by-field, not whole-object: jsonb returns keys in its own order.
    eq(data.data['n:C D'].text, 'grey bill', "the other device's note is preserved");
    eq(data.data['n:C D'].t, 5, "the other device's note keeps its timestamp");
    eq(data.data['n:A B'].text, 'toothed leaves', "this device's note is written");

    // Pulling folds the row's notes back into local storage (per-note merge).
    await a.sync.pullSettings({ force: true });
    const local = await a.storage.loadConfusionNotes();
    eq(local['C D'] && local['C D'].text, 'grey bill', 'pulled the other note into local storage');
    eq(local['A B'] && local['A B'].text, 'toothed leaves', 'kept this device note in local storage');
  });

  await test("a flag rides the settings row (per username) and merges per flag", async () => {
    const a = makeDevice({ createClient, url, anon, name: 'A' });
    const userId = await a.sync.ensureSession();
    await a.storage.saveUsername('leo');

    // Another device already flagged species 99 for this account.
    const seed = await a.client.from('settings').upsert(
      {
        user_id: userId,
        data: { v: 2, prefs: {}, username: 'leo', 'f:leo:99': { on: true, t: 5 } },
        updated_at: new Date(1000).toISOString(),
      },
      { onConflict: 'user_id' }
    );
    eq(seed.error, null, 'seed insert ok');

    // This device flags a different species, then pushes.
    await a.storage.saveFlag('leo', 10, true, 2000);
    await a.sync.pushLocalSettings();

    // Both flag keys survive the shallow-merge (independent top-level keys).
    const { data } = await a.client
      .from('settings').select('data').eq('user_id', userId).maybeSingle();
    // Field-by-field, not whole-object: jsonb returns keys in its own order.
    eq(data.data['f:leo:99'].on, true, "the other device's flag is preserved");
    eq(data.data['f:leo:99'].t, 5, "the other device's flag keeps its timestamp");
    eq(data.data['f:leo:10'].on, true, "this device's flag is written");

    // Pull folds both into this account's local flags.
    await a.sync.pullSettings({ force: true });
    eq((await a.storage.loadFlags('leo')).sort(), ['10', '99'], 'both flags land in local storage');
  });

  // --- confusions ----------------------------------------------------------
  console.log('\nconfusions');

  await test("a confusion event syncs to another device", async () => {
    if (!admin) throw new Error('needs SERVICE_ROLE_KEY');
    const email = `conf-${Date.now()}@example.com`;

    // Device A records a round that includes a confusion delta, then pushes.
    const a = makeDevice({ createClient, url, anon, name: 'A' });
    const idA = await a.sync.ensureSession();
    await a.sync.recordEvent({
      answered: 5,
      correct: 4,
      pct: 80,
      confusions: { 10: { 20: 2 } }, // mixed up taxon 10 for 20, twice
    });
    await a.sync.syncNow();
    await attachEmail(admin, idA, email);

    // Device B signs into the same account and pulls.
    const b = makeDevice({ createClient, url, anon, name: 'B' });
    await b.sync.ensureSession();
    ok((await b.sync.signInWithEmail(email)).ok, 'signin');
    ok((await b.sync.confirmSignIn(email, await otpFor(admin, url, email))).ok, 'confirm');
    await b.sync.afterAuthChange();
    await b.sync.syncNow();

    eq(await b.storage.loadConfusions(), { 10: { 20: 2 } }, "B folded in A's confusion");
  });

  // --- a row the database refuses -------------------------------------------
  // The `events` table carries CHECK constraints (answered >= 0, correct >= 0,
  // pct 0..100). A violating row is refused with SQLSTATE 23514 on EVERY
  // attempt — it describes the row, not the moment — and the outbox is pushed
  // as one statement, so a single such row used to stop every later round
  // uploading, forever, while the screen said only "waiting to upload".
  //
  // These craft the bad row by writing it straight to the outbox, because that
  // is the only way it can still arise: recordEvent sanitizes now, so the app
  // itself cannot make one. An older build could, and its rows are still on
  // devices.
  console.log('\na row the database refuses');

  const badRow = async (d, over = {}) => ({
    id: d.outbox.uid(),
    device_id: await d.outbox.getDeviceId(),
    ts: new Date().toISOString(),
    local_day: '2026-08-09',
    answered: 0,
    correct: 0,
    // THE POISON: pct must be null or 0..100, so this row is refused however
    // else it is filled in. It lives on `pct` rather than on `answered`
    // deliberately — callers below override answered/correct to give the row a
    // size, and a poison sitting on one of those would be cured by the override
    // without the test noticing it had stopped testing anything.
    pct: 140,
    n: 0,
    species: {},
    formats: {},
    confusions: {},
    history: [],
    counts: [],
    days: [],
    ...over,
  });

  await test('a refused round does not stop the good ones uploading', async () => {
    const a = makeDevice({ createClient, url, anon, name: 'A' });
    const userId = await a.sync.ensureSession();
    await a.outbox.pushToOutbox(await badRow(a));
    await a.sync.recordEvent({ answered: 4, correct: 3, pct: 75 });
    await a.sync.recordEvent({ answered: 6, correct: 6, pct: 100 });
    await a.sync.syncNow();

    const { data } = await a.client.from('events').select('answered').eq('user_id', userId);
    const landed = (data || []).map((r) => r.answered).sort((x, y) => x - y);
    eq(landed, [4, 6], 'the two good rounds landed despite the refused one');
  });

  await test('a permanently refused round is discarded, not retried forever', async () => {
    // Before the per-row fallback this row sat in the outbox for good, and took
    // every later round with it. Dropping it loses one round; keeping it lost
    // all of them.
    const a = makeDevice({ createClient, url, anon, name: 'A' });
    await a.sync.ensureSession();
    await a.outbox.pushToOutbox(await badRow(a));
    await a.sync.syncNow();
    eq(JSON.parse(a.kv._dump()['@gote/sync/outbox']), [], 'outbox after the refusal');

    // And the queue keeps working afterwards.
    await a.sync.recordEvent({ answered: 2, correct: 1, pct: 50 });
    await a.sync.syncNow();
    eq(JSON.parse(a.kv._dump()['@gote/sync/outbox']), [], 'outbox after a later round');
  });

  await test('the refusal is reported, not swallowed', async () => {
    // "N rounds waiting to upload" with no reason is what sent a real user
    // looking at their wifi for a problem that was on the server.
    const a = makeDevice({ createClient, url, anon, name: 'A' });
    await a.sync.ensureSession();
    await a.outbox.pushToOutbox(await badRow(a));
    await a.sync.syncNow();
    const status = await a.sync.getSyncStatus();
    ok(status.pushError, 'getSyncStatus must carry why the push failed');
  });

  await test('recordEvent cannot create a row the table would refuse', async () => {
    // sanitizeEvent's whole job. Values no caller should produce, clamped into
    // range rather than queued and refused for ever.
    const a = makeDevice({ createClient, url, anon, name: 'A' });
    const userId = await a.sync.ensureSession();
    await a.sync.recordEvent({ answered: -3, correct: -1, pct: 140, n: -2 });
    await a.sync.syncNow();
    const { data } = await a.client.from('events').select('answered, correct, pct, n').eq('user_id', userId);
    eq((data || []).length, 1, 'the clamped row was accepted');
    eq(data[0], { answered: 0, correct: 0, pct: 100, n: 0 }, 'clamped values');
    eq(JSON.parse(a.kv._dump()['@gote/sync/outbox']), [], 'nothing left stuck');
  });

  // --- stranded history and its recovery ------------------------------------
  // The failure that cost a real device its whole history: uploadBaseline
  // subtracts whatever is in the outbox (those rounds are about to be pushed as
  // their own events), so if that push then fails permanently the account keeps
  // a baseline with the rounds deducted and nothing to replace them. The device
  // has already recorded baselineUserId, and the baseline id is stable per
  // (device, account), so it can never correct itself.
  console.log('\nstranded history');

  await test('a baseline deducting an unpushable round leaves the account short', async () => {
    if (!admin) throw new Error('needs SERVICE_ROLE_KEY');
    const email = `strand-${Date.now()}@example.com`;

    const a = makeDevice({ createClient, url, anon, name: 'A' });
    const idA = await a.sync.ensureSession();
    await a.sync.recordEvent({ answered: 1, correct: 1, pct: 100 });
    await a.sync.syncNow();
    await attachEmail(admin, idA, email);

    // B has played 38 rounds locally, and one queued round it can never push.
    const b = makeDevice({ createClient, url, anon, name: 'B' });
    await b.sync.ensureSession();
    await b.storage.saveStats({ answered: 38, correct: 27 });
    // Bars and days too, or the baseline finds nothing at all to send and never
    // queues a row — the production case had a row, with the totals deducted.
    await b.storage.saveHistory([70, 80]);
    await b.storage.saveActiveDays(['2026-08-01', '2026-08-02']);
    await b.outbox.pushToOutbox(await badRow(b, { answered: 38, correct: 27 }));

    ok((await b.sync.signInWithEmail(email)).ok, 'signin B');
    ok((await b.sync.confirmSignIn(email, await otpFor(admin, url, email))).ok, 'confirm B');
    await b.sync.afterAuthChange('signin');

    // B's baseline deducted the queued round, which was then refused: the
    // account has B's row, but with nothing in it.
    const idB = await b.sync.currentUserId();
    const { data } = await b.client
      .from('events').select('answered').eq('user_id', idB).eq('device_id', await b.outbox.getDeviceId());
    eq((data || []).map((r) => r.answered), [0], "B's contribution to the account");
  });

  await test('recontributeHistory puts a stranded history back on the account', async () => {
    if (!admin) throw new Error('needs SERVICE_ROLE_KEY');
    const email = `recover-${Date.now()}@example.com`;

    const a = makeDevice({ createClient, url, anon, name: 'A' });
    const idA = await a.sync.ensureSession();
    await a.storage.saveStats({ answered: 5, correct: 4 });
    await a.sync.recordEvent({ answered: 5, correct: 4, pct: 80 });
    await a.sync.syncNow();
    await attachEmail(admin, idA, email);

    const b = makeDevice({ createClient, url, anon, name: 'B' });
    await b.sync.ensureSession();
    await b.storage.saveStats({ answered: 38, correct: 27 });
    await b.storage.saveHistory([70, 80]);
    await b.storage.saveActiveDays(['2026-08-01', '2026-08-02']);
    await b.outbox.pushToOutbox(await badRow(b, { answered: 38, correct: 27 }));
    ok((await b.sync.signInWithEmail(email)).ok, 'signin B');
    ok((await b.sync.confirmSignIn(email, await otpFor(admin, url, email))).ok, 'confirm B');
    await b.sync.afterAuthChange('signin');

    // Stranded: A syncs and sees nothing of B's 38.
    await a.sync.syncNow();
    eq(await a.storage.loadStats(), { answered: 5, correct: 4 }, 'A before the recovery');

    // The repair. A fresh event id, because the deterministic one is taken by
    // the empty row.
    const res = await b.sync.recontributeHistory();
    ok(res.ok, `recontributeHistory refused: ${res.error}`);

    await a.sync.syncNow();
    eq(await a.storage.loadStats(), { answered: 43, correct: 31 }, "A after B's history is restored");
    // B is unchanged by its own re-upload — it skips its own rows on pull. Its
    // total is 43 because signing in folded A's 5 in, not because of the repair.
    eq(await b.storage.loadStats(), { answered: 43, correct: 31 }, 'B unchanged by its own re-upload');
  });

  await test('recontributeHistory changes nothing on a healthy device', async () => {
    // Idempotence is what makes the button safe to press. A device with nothing
    // missing must compute an empty contribution: its local totals minus what it
    // merged from others minus what it has already sent is zero. An earlier
    // version refused outright whenever anything had been merged, which was
    // useless — a device PULLS as it signs in, so the ledger is never empty by
    // the time anyone notices history is missing.
    if (!admin) throw new Error('needs SERVICE_ROLE_KEY');
    const email = `idem-${Date.now()}@example.com`;

    const a = makeDevice({ createClient, url, anon, name: 'A' });
    const idA = await a.sync.ensureSession();
    await a.storage.saveStats({ answered: 9, correct: 9 });
    await a.sync.recordEvent({ answered: 9, correct: 9, pct: 100 });
    await a.sync.syncNow();
    await attachEmail(admin, idA, email);

    const b = makeDevice({ createClient, url, anon, name: 'B' });
    await b.sync.ensureSession();
    await b.storage.saveStats({ answered: 4, correct: 2 });
    await b.storage.saveHistory([50]);
    ok((await b.sync.signInWithEmail(email)).ok, 'signin B');
    ok((await b.sync.confirmSignIn(email, await otpFor(admin, url, email))).ok, 'confirm B');
    await b.sync.afterAuthChange('signin'); // B contributes its 4 and folds in A's 9
    await a.sync.syncNow();

    const aBefore = await a.storage.loadStats();
    const bBefore = await b.storage.loadStats();
    eq(aBefore, { answered: 13, correct: 11 }, 'A has both devices before the repair');

    const res = await b.sync.recontributeHistory();
    ok(res.ok, `recontributeHistory failed: ${res.error}`);
    await a.sync.syncNow();
    await a.sync.syncNow();

    eq(await a.storage.loadStats(), aBefore, 'A is untouched — nothing was double-counted');
    eq(await b.storage.loadStats(), bBefore, 'B is untouched');
  });

  // --- reset, and the per-format split --------------------------------------
  console.log('\nreset and formats');

  await test('resetting statistics is not undone by the next sync', async () => {
    // The 2.37.3 bug, at the level it actually bit: clearing the streak but
    // keeping the day set let the next pull recompute the streak back.
    const a = makeDevice({ createClient, url, anon, name: 'A' });
    await a.sync.ensureSession();
    await a.storage.saveStats({ answered: 30, correct: 20 });
    await a.sync.recordEvent({ answered: 30, correct: 20, pct: 66, days: ['2026-08-01', '2026-08-02'] });
    await a.sync.syncNow();

    await a.storage.resetStatistics();
    await a.sync.syncNow();
    await a.sync.syncNow();
    eq(await a.storage.loadStats(), { answered: 0, correct: 0 }, 'totals stay reset');
    eq(await a.storage.loadActiveDays(), [], 'the day set stays cleared');
  });

  await test('the per-format split reaches another device', async () => {
    if (!admin) throw new Error('needs SERVICE_ROLE_KEY');
    const email = `fmt-${Date.now()}@example.com`;

    const a = makeDevice({ createClient, url, anon, name: 'A' });
    const idA = await a.sync.ensureSession();
    await a.sync.recordEvent({
      answered: 4, correct: 3, pct: 75,
      formats: { typed: { answered: 2, correct: 2 }, pair: { answered: 2, correct: 1 } },
    });
    await a.sync.syncNow();
    await attachEmail(admin, idA, email);

    const b = makeDevice({ createClient, url, anon, name: 'B' });
    await b.sync.ensureSession();
    ok((await b.sync.signInWithEmail(email)).ok, 'signin B');
    ok((await b.sync.confirmSignIn(email, await otpFor(admin, url, email))).ok, 'confirm B');
    await b.sync.afterAuthChange('signin');

    const fmts = await b.storage.loadStatsByFormat();
    eq(fmts.typed, { answered: 2, correct: 2 }, 'typed split reached B');
    eq(fmts.pair, { answered: 2, correct: 1 }, 'pair split reached B');
  });

  // --- deletion ------------------------------------------------------------
  console.log('\naccount deletion');

  await test('deleting the account removes its rows (cascade)', async () => {
    if (!admin) throw new Error('needs SERVICE_ROLE_KEY');
    const a = makeDevice({ createClient, url, anon, name: 'A' });
    const userId = await a.sync.ensureSession();
    await a.sync.recordEvent({ answered: 7, correct: 7, pct: 100 });
    await a.sync.syncNow();

    const before = await admin.from('events').select('id').eq('user_id', userId);
    eq(before.data.length, 1, 'rows before delete');

    // The edge function may not be served locally; fall back to the admin API,
    // which exercises the same cascade the function relies on.
    const viaFn = await a.sync.deleteAccount();
    if (!viaFn.ok) await admin.auth.admin.deleteUser(userId);

    const after = await admin.from('events').select('id').eq('user_id', userId);
    eq(after.data.length, 0, 'rows after delete');
  });

  // --- report --------------------------------------------------------------
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) {
    console.log('\nFailures:');
    failures.forEach(([n, e]) => console.log(`  ${n}\n    ${e.stack || e.message}`));
  }
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error('\nharness error:', e);
  process.exit(1);
});

// Mint a sign-in code without an inbox. The admin endpoint returns the same
// token the email would have carried, which is what makes this runnable in CI:
// no mail server, no polling, no flake.
//
// 'magiclink' pairs with verifyOtp type 'email' — i.e. the signInWithEmail /
// confirmSignIn path. The LINK path uses type 'email_change', whose token is
// only obtainable from the actual email, so these tests attach the address
// administratively instead (see attachEmail) and exercise the join path, which
// is the one carrying the interesting logic.
async function otpFor(admin, url, email) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (error) throw new Error(`generateLink: ${error.message}`);
  const otp =
    (data && data.properties && data.properties.email_otp) ||
    (data && data.email_otp);
  if (!otp) throw new Error('no OTP in generateLink response');
  return otp;
}

// Stand in for a completed "link this device" flow: give the user a confirmed
// email address. The app does this via linkEmail + an emailed email_change
// token; the outcome is identical, and it is the outcome the merge depends on.
async function attachEmail(admin, userId, email) {
  const { error } = await admin.auth.admin.updateUserById(userId, {
    email,
    email_confirm: true,
  });
  if (error) throw new Error(`attachEmail: ${error.message}`);
}
