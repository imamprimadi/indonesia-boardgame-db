-- Indonesia Boardgame Database — Supabase schema
-- Jalankan seluruh file ini sekali lewat Supabase Dashboard → SQL Editor → New query → Run.
--
-- Model keamanan (moderation queue):
--   - `games`        : data publik yang tayang di web app. Semua orang boleh BACA (SELECT).
--                      TIDAK ADA yang boleh menulis langsung ke tabel ini lewat browser/API publik
--                      (tidak ada policy INSERT/UPDATE/DELETE untuk anon/authenticated) — satu-satunya
--                      cara mengubahnya adalah lewat Netlify Function `admin-review` yang jalan di
--                      server pakai Service Role Key (key ini otomatis melewati RLS/Row Level Security).
--   - `submissions`  : tempat usulan publik (tambah/edit/hapus) mendarat berstatus 'pending'.
--                      Publik cuma boleh INSERT (kirim usulan baru), TIDAK BOLEH baca/ubah baris
--                      manapun di tabel ini lewat API publik — supaya orang tidak bisa mengintip atau
--                      merusak antrean moderasi orang lain. Hanya admin (lewat Netlify Function pakai
--                      Service Role Key) yang bisa membaca & mengubah status jadi approved/rejected.

create extension if not exists "pgcrypto"; -- untuk gen_random_uuid()

-- ============== TABEL DATA LIVE (PUBLIK, READ-ONLY) ==============
create table if not exists public.games (
  id            bigint primary key,
  name          text not null,
  image         text,
  categories    text[] not null default '{}',
  mechanics     text[] not null default '{}',
  averageweight numeric not null default 0,
  minplayers    integer not null default 1,
  maxplayers    integer not null default 1,
  rank          integer,
  rating        numeric not null default 0,
  url           text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Kolom opsional utk game dari katalog resmi non-BGG (mis. Paduka Play) yang tidak punya halaman BGG.
-- Pakai ADD COLUMN IF NOT EXISTS supaya aman dijalankan ulang di project yang sudah lebih dulu
-- dibuat dengan skema versi awal (sebelum kolom-kolom ini ditambahkan).
alter table public.games add column if not exists publisher    text;
alter table public.games add column if not exists series       text;
alter table public.games add column if not exists playtime     text;
alter table public.games add column if not exists age          text;
alter table public.games add column if not exists description  text;
alter table public.games add column if not exists source       text;

alter table public.games enable row level security;

drop policy if exists "games_public_read" on public.games;
create policy "games_public_read"
  on public.games for select
  to anon, authenticated
  using (true);

-- Sengaja TIDAK ADA policy insert/update/delete untuk anon/authenticated.
-- Hanya service_role (dipakai Netlify Function admin-review.js) yang bisa menulis ke tabel ini.

-- ============== TABEL ANTREAN USULAN (SUBMISSIONS) ==============
create table if not exists public.submissions (
  id             uuid primary key default gen_random_uuid(),
  type           text not null check (type in ('add','edit','delete')),
  target_id      bigint,                 -- diisi utk 'edit'/'delete' (id game yg dituju)
  payload        jsonb,                  -- data game yg diusulkan (utk 'add'/'edit'); null utk 'delete'
  submitter_note text,
  status         text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewer_note  text,
  ip_hash        text,                   -- hash IP pengirim (bukan IP mentah) — dipakai rate limit saja
  created_at     timestamptz not null default now(),
  reviewed_at    timestamptz
);

create index if not exists submissions_status_created_idx on public.submissions (status, created_at);
create index if not exists submissions_iphash_created_idx on public.submissions (ip_hash, created_at);

alter table public.submissions enable row level security;

-- Publik boleh INSERT usulan baru, TAPI wajib berstatus 'pending' (tidak bisa langsung approved),
-- dan tidak boleh isi reviewer_note/reviewed_at sendiri.
drop policy if exists "submissions_public_insert" on public.submissions;
create policy "submissions_public_insert"
  on public.submissions for insert
  to anon
  with check (
    status = 'pending'
    and reviewed_at is null
    and reviewer_note is null
  );

-- Sengaja TIDAK ADA policy select/update/delete untuk anon/authenticated di tabel submissions.
-- Catatan: Netlify Function `submit.js` sebenarnya jalan di server pakai Service Role Key (bukan anon
-- key) supaya bisa melakukan pengecekan rate-limit (perlu baca jumlah submission per IP). Policy insert
-- anon di atas ini murni lapisan pertahanan tambahan (defense-in-depth) kalau-kalau ada yang coba
-- langsung memanggil Supabase REST API pakai anon key tanpa lewat Function kita.

-- ============== SEED DATA AWAL (opsional) ==============
-- Kalau mau isi tabel `games` dari indonesia-games.json yang sudah ada, jalankan script Node terpisah
-- `bgg-database/supabase/seed.mjs` (lihat instruksi di README) — jauh lebih gampang daripada nulis
-- ratusan baris INSERT manual di sini.
