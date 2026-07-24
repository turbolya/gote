// Delete the calling user's account and everything attached to it.
//
// Required by App Store guideline 5.1.1(v): an app that lets people create an
// account must let them delete it from inside the app.
//
// This has to be an edge function rather than client code, because deleting an
// auth user needs the SERVICE ROLE key — which bypasses row-level security
// entirely and must never be shipped in an app binary or committed to a repo.
// The key is injected by the platform at runtime; it is not in this file.
//
// SECURITY: the id to delete comes from the caller's verified JWT, NEVER from
// the request body. Taking it from the body would turn this into "any user can
// delete any other user" — the whole function is one line away from that.
//
// Deploy:  supabase functions deploy delete-account
// (see docs/SUPABASE.md)

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'missing-token' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Step 1 — establish WHO is asking, using their own token and the low-
  // privilege key. If the token is invalid or expired this fails, and nothing
  // privileged has happened yet.
  const asUser = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await asUser.auth.getUser();
  if (userErr || !userData?.user) return json({ error: 'invalid-token' }, 401);

  const userId = userData.user.id;

  // Step 2 — delete as admin. Every table (events, settings, profiles)
  // references auth.users with `on delete cascade`, so removing the user
  // removes all of their rows in the same transaction. No manual cleanup here,
  // which means a table added later is covered automatically as long as it
  // carries the same cascade.
  const asAdmin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: delErr } = await asAdmin.auth.admin.deleteUser(userId);
  if (delErr) return json({ error: delErr.message }, 500);

  return json({ ok: true, deleted: userId });
});
