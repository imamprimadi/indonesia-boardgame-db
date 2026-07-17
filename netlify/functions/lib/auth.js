// Verifikasi token login Supabase Auth yang dikirim admin.html, lalu cek emailnya
// ada di daftar ADMIN_EMAILS (env var, dipisah koma). Ini yang mencegah sembarang orang
// yang cuma daftar akun Supabase Auth biasa bisa ikut approve/reject usulan.
async function requireAdmin(event, supabaseAdmin) {
  const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { ok: false, statusCode: 401, message: 'Tidak ada token login. Silakan login dulu.' };

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data || !data.user) {
    return { ok: false, statusCode: 401, message: 'Token login tidak valid atau kedaluwarsa.' };
  }

  const allowlist = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  const email = (data.user.email || '').toLowerCase();

  if (!allowlist.length) {
    return { ok: false, statusCode: 500, message: 'ADMIN_EMAILS belum di-set di environment variables Netlify.' };
  }
  if (!allowlist.includes(email)) {
    return { ok: false, statusCode: 403, message: 'Akun ini login sah, tapi bukan admin yang diizinkan.' };
  }
  return { ok: true, user: data.user };
}

module.exports = { requireAdmin };
