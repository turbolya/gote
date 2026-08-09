// Diagnose the email sign-in flow against the REAL Supabase project, printing
// the full error instead of the one friendly line the app can show.
//
// Why this exists: Supabase answers every bad verifyOtp with the same string,
// "Token has expired or is invalid", which covers an expired code, a mistyped
// one, and one that was already consumed. The app cannot tell those apart, and
// neither can you from the screen. The error OBJECT carries a `code` and
// `status` that do distinguish them — this prints them.
//
// Usage (two separate runs, because you need to read the email in between):
//
//   node scripts/diagnose-otp.js check
//       Config + connectivity only. Creates nothing, sends nothing.
//
//   node scripts/diagnose-otp.js send <your-email>
//       Signs in anonymously (exactly as the app does on first sync) and
//       attaches the address, which sends the code. Prints the anon user id.
//
//   node scripts/diagnose-otp.js verify <code>
//       Verifies with type 'email_change' — the LINK flow, i.e. "switch sync on
//       from this device". Prints the full error.
//
//   node scripts/diagnose-otp.js verify <code> email
//       Same, but type 'email' — the SIGN-IN flow, for comparison.
//
// The anonymous session is kept in a temp file between the two runs, because
// an email_change token is only valid for the user that requested it — which is
// precisely the thing a two-process test would otherwise get wrong.
//
// Reads credentials from .env (gitignored). Prints no key material.

const fs = require('fs');
const os = require('os');
const path = require('path');

const SESSION_FILE = path.join(os.tmpdir(), 'gote-otp-session.json');

function loadEnv() {
  const file = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(file)) {
    console.error('No .env at repo root — cannot reach the project.');
    process.exit(1);
  }
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

// File-backed storage so the anonymous session survives between `send` and
// `verify`, which run as separate processes.
const fileStorage = {
  async getItem(k) {
    try {
      return (JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')) || {})[k] ?? null;
    } catch {
      return null;
    }
  },
  async setItem(k, v) {
    let all = {};
    try {
      all = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')) || {};
    } catch {
      /* first write */
    }
    all[k] = v;
    fs.writeFileSync(SESSION_FILE, JSON.stringify(all), { mode: 0o600 });
  },
  async removeItem(k) {
    try {
      const all = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')) || {};
      delete all[k];
      fs.writeFileSync(SESSION_FILE, JSON.stringify(all), { mode: 0o600 });
    } catch {
      /* nothing stored */
    }
  },
};

// Everything the app cannot show you.
function dumpError(label, error) {
  if (!error) {
    console.log(`${label}: OK`);
    return;
  }
  console.log(`${label}: FAILED`);
  console.log('  message :', error.message);
  console.log('  code    :', error.code ?? '(none)');
  console.log('  status  :', error.status ?? '(none)');
  console.log('  name    :', error.name ?? '(none)');
  console.log('\n  How to read this:');
  console.log('    otp_expired            → genuinely past the OTP expiry window, OR the');
  console.log('                             token was already consumed (a link scanner');
  console.log('                             following {{ .ConfirmationURL }} does this).');
  console.log('    403 with no code       → wrong OTP `type` for the flow that sent it.');
  console.log('    over_email_send_rate_limit → too many sends; wait, do not resend.');
  console.log('    otp_disabled           → email OTP is off for this project.');
}

async function main() {
  const [cmd, arg, typeArg] = process.argv.slice(2);
  const env = loadEnv();
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const key = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.error('.env is missing EXPO_PUBLIC_SUPABASE_URL or _PUBLISHABLE_KEY.');
    process.exit(1);
  }

  const ref = (url.match(/https:\/\/([a-z0-9]+)\./) || [])[1];
  console.log('project :', ref, `(${url})`);
  console.log('key type:', key.startsWith('sb_publishable') ? 'new publishable' : 'legacy anon JWT');
  console.log('supabase-js:', require('@supabase/supabase-js/package.json').version);
  console.log('');

  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(url, key, {
    auth: { storage: fileStorage, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
  });

  if (cmd === 'check') {
    // Public settings endpoint: tells us the project is reachable with this key
    // and which auth methods it actually has enabled. Creates nothing.
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
    console.log('GET /auth/v1/settings →', res.status);
    if (res.ok) {
      const s = await res.json();
      console.log('  email enabled     :', s.external?.email);
      console.log('  anonymous enabled :', s.external?.anonymous_users);
      console.log('  mailer autoconfirm:', s.mailer_autoconfirm);
    } else {
      console.log('  body:', (await res.text()).slice(0, 300));
    }
    return;
  }

  if (cmd === 'send') {
    if (!arg) return console.error('Usage: node scripts/diagnose-otp.js send <email>');
    try {
      fs.unlinkSync(SESSION_FILE);
    } catch {
      /* no previous session */
    }
    const { data: anon, error: anonErr } = await supabase.auth.signInAnonymously();
    dumpError('signInAnonymously', anonErr);
    if (anonErr) return;
    console.log('  anon user id:', anon.user?.id, '\n');

    const { error } = await supabase.auth.updateUser({ email: arg.trim().toLowerCase() });
    dumpError(`updateUser({ email: ${arg} })`, error);
    if (!error) {
      console.log('\nCode sent. Read the email, then run:');
      console.log('  node scripts/diagnose-otp.js verify <code>');
      console.log('\nNote the TIME the email arrives — if the code is rejected within the');
      console.log('OTP expiry window, expiry is not the real cause.');
    }
    return;
  }

  if (cmd === 'verify') {
    if (!arg) return console.error('Usage: node scripts/diagnose-otp.js verify <code> [email|email_change]');
    const { data: sess } = await supabase.auth.getSession();
    console.log('session user:', sess?.session?.user?.id ?? '(none — run `send` first)');
    console.log('is_anonymous:', sess?.session?.user?.is_anonymous ?? '(n/a)', '\n');

    const type = typeArg || 'email_change';
    const email = sess?.session?.user?.new_email || sess?.session?.user?.email;
    console.log(`verifyOtp(type: '${type}', email: ${email || '(unknown)'})\n`);
    const { error } = await supabase.auth.verifyOtp({ email, token: arg.trim(), type });
    dumpError('verifyOtp', error);
    return;
  }

  console.error('Usage: node scripts/diagnose-otp.js check | send <email> | verify <code> [type]');
  process.exit(1);
}

main().catch((e) => {
  console.error('threw:', e);
  process.exit(1);
});
