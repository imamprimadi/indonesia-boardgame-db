const { createClient } = require('@supabase/supabase-js');

let client;

// Service Role Key = kunci rahasia yang MELEWATI Row Level Security sepenuhnya.
// Cuma boleh dipakai di sini (server-side, Netlify Function) — JANGAN PERNAH dikirim ke browser.
function getSupabaseAdmin() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum di-set di environment variables Netlify.');
    }
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

module.exports = { getSupabaseAdmin };
