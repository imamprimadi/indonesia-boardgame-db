const { getSupabaseAdmin } = require('./lib/supabaseAdmin');
const { requireAdmin } = require('./lib/auth');

function json(statusCode, obj) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    return json(500, { error: e.message });
  }

  const auth = await requireAdmin(event, supabase);
  if (!auth.ok) return json(auth.statusCode, { error: auth.message });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Body bukan JSON valid' });
  }

  const { submissionId, action, reviewerNote } = body;
  if (!submissionId || !['approve', 'reject'].includes(action)) {
    return json(400, { error: 'submissionId dan action (approve/reject) wajib diisi' });
  }

  const { data: sub, error: fetchErr } = await supabase
    .from('submissions')
    .select('*')
    .eq('id', submissionId)
    .single();
  if (fetchErr || !sub) return json(404, { error: 'Submission tidak ditemukan' });
  if (sub.status !== 'pending') return json(409, { error: 'Submission ini sudah pernah direview' });

  if (action === 'approve') {
    if (sub.type === 'delete') {
      const { error: delErr } = await supabase.from('games').delete().eq('id', sub.target_id);
      if (delErr) return json(500, { error: 'Gagal menghapus game dari database live' });
    } else {
      const row = { ...sub.payload, updated_at: new Date().toISOString() };
      const { error: upsertErr } = await supabase.from('games').upsert(row, { onConflict: 'id' });
      if (upsertErr) return json(500, { error: 'Gagal menyimpan game ke database live' });
    }
  }

  const { error: updateErr } = await supabase
    .from('submissions')
    .update({
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewer_note: reviewerNote || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', submissionId);
  if (updateErr) return json(500, { error: 'Gagal memperbarui status submission' });

  return json(200, { ok: true });
};
