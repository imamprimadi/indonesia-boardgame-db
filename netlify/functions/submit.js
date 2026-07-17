const crypto = require('crypto');
const { getSupabaseAdmin } = require('./lib/supabaseAdmin');

const MAX_SUBMISSIONS_PER_HOUR = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function json(statusCode, obj) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}

function hashIp(ip) {
  const salt = process.env.IP_HASH_SALT || 'idn-bgdb-default-salt-ganti-kalau-mau';
  return crypto.createHash('sha256').update(salt + '|' + ip).digest('hex');
}

function getClientIp(event) {
  return (
    event.headers['x-nf-client-connection-ip'] ||
    (event.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    'unknown'
  );
}

function str(v, maxLen) {
  if (typeof v !== 'string') return '';
  return v.slice(0, maxLen).trim();
}
function strArray(v, maxItems, maxLen) {
  if (!Array.isArray(v)) return [];
  return v.slice(0, maxItems).map(x => str(x, maxLen)).filter(Boolean);
}
function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function isSafeUrl(u) {
  if (!u) return true;
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Body bukan JSON valid' });
  }

  const type = body.type;
  if (!['add', 'edit', 'delete'].includes(type)) {
    return json(400, { error: 'type harus salah satu dari: add, edit, delete' });
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    return json(500, { error: e.message });
  }

  const ip = getClientIp(event);
  const ipHash = hashIp(ip);

  // --- Rate limit sederhana per-IP ---
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count, error: countErr } = await supabase
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', since);
  if (countErr) return json(500, { error: 'Gagal memeriksa rate limit' });
  if ((count || 0) >= MAX_SUBMISSIONS_PER_HOUR) {
    return json(429, { error: 'Terlalu banyak usulan dari alamat ini dalam 1 jam terakhir. Coba lagi nanti.' });
  }

  // --- Validasi & sanitasi payload ---
  let payload = null;
  let target_id = null;

  if (type === 'delete') {
    target_id = num(body.target_id, null);
    if (target_id == null) return json(400, { error: 'target_id wajib diisi untuk usulan hapus' });
  } else {
    const p = body.payload || {};
    const id = num(p.id, null);
    const name = str(p.name, 200);
    if (id == null || !name) return json(400, { error: 'id dan name wajib diisi' });

    const url = str(p.url, 2000);
    if (!url) return json(400, { error: 'url wajib diisi' });
    if (!isSafeUrl(url)) return json(400, { error: 'url harus berupa link http/https yang valid' });

    const categories = strArray(p.categories, 30, 80);
    const mechanics = strArray(p.mechanics, 30, 80);
    if (!categories.length) return json(400, { error: 'categories wajib diisi minimal 1' });
    if (!mechanics.length) return json(400, { error: 'mechanics wajib diisi minimal 1' });

    payload = {
      id,
      name,
      image: str(p.image, 2000),
      categories,
      mechanics,
      averageweight: num(p.averageweight, 0),
      minplayers: num(p.minplayers, 1),
      maxplayers: num(p.maxplayers, 1),
      rank: (p.rank === '' || p.rank == null) ? null : num(p.rank, null),
      rating: num(p.rating, 0),
    };
    payload.url = url;
    const publisher = str(p.publisher, 200);
    const series = str(p.series, 200);
    const playtime = str(p.playtime, 100);
    const age = str(p.age, 50);
    const description = str(p.description, 2000);
    if (publisher) payload.publisher = publisher;
    if (series) payload.series = series;
    if (playtime) payload.playtime = playtime;
    if (age) payload.age = age;
    if (description) payload.description = description;

    if (type === 'edit') {
      target_id = num(body.target_id ?? p.id, null);
      if (target_id == null) return json(400, { error: 'target_id wajib diisi untuk usulan edit' });
    }
  }

  const submitter_note = str(body.submitter_note, 500) || null;

  const { error: insertErr } = await supabase.from('submissions').insert({
    type,
    target_id,
    payload,
    submitter_note,
    status: 'pending',
    ip_hash: ipHash,
  });
  if (insertErr) return json(500, { error: 'Gagal menyimpan usulan, coba lagi.' });

  return json(200, { ok: true, message: 'Usulan terkirim, menunggu review admin. Terima kasih!' });
};
