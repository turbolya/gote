// Integration tests for cross-device sync — the REAL push/pull code, against a
// REAL Postgres with RLS on.
//
//   npm run test:sync            (starts nothing; see below)
//
// Why this exists: scripts/test-sync.js covers merge.js with 40 cases and
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
