const { getSupabaseAdmin } = require('./lib/supabaseAdmin');
const { requireAdmin } = require('./lib/auth');

function json(statusCode, obj) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method Not Allowed' });

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    return json(500, { error: e.message });
  }

  const auth = await requireAdmin(event, supabase);
  if (!auth.ok) return json(auth.statusCode, { error: auth.message });

  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) return json(500, { error: 'Gagal mengambil daftar usulan' });

  return json(200, { submissions: data });
};
