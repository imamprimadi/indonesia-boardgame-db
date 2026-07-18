# Setup: Online-kan Database + Submission Publik (Supabase + Netlify Functions)

Panduan ini isinya langkah-langkah yang **cuma bisa kamu kerjakan sendiri** (bikin akun, generate key,
isi secret) — bagian kodenya (Netlify Functions, `admin.html`, alur submit di `index.html`) sudah jadi
semua, tinggal disambungkan.

Model keamanannya: **tidak ada submission publik yang langsung tayang.** Semua usulan tambah/edit/hapus
masuk ke antrean (`submissions`), dan cuma kamu (admin, lewat `admin.html`) yang bisa approve/reject.
Baru setelah di-approve, perubahan itu masuk ke tabel `games` yang tayang publik.

---

## 1. Bikin project Supabase (gratis)

1. Buka [supabase.com](https://supabase.com) → Sign up / login → **New project**.
2. Kasih nama bebas (mis. `indonesia-boardgame-db`), pilih region terdekat (Singapore), set password
   database (simpan baik-baik, tapi tidak akan dipakai langsung di kode kita).
3. Tunggu project selesai di-provision (~2 menit).

## 2. Jalankan schema SQL

1. Di dashboard Supabase project kamu → menu **SQL Editor** → **New query**.
2. Copy-paste seluruh isi file [`supabase/schema.sql`](supabase/schema.sql) di folder ini → **Run**.
3. Cek di menu **Table Editor** — harus muncul 2 tabel baru: `games` dan `submissions`.

## 3. Ambil API keys

Di dashboard → **Project Settings** (ikon gear) → **API**. Catat 3 nilai ini:

| Nama di Supabase | Dipakai di mana | Boleh publik? |
|---|---|---|
| `Project URL` | `SUPABASE_URL` (index.html, admin.html, Netlify env var) | Ya |
| `anon` `public` key | `SUPABASE_ANON_KEY` (index.html, admin.html) | Ya — ini memang didesain publik, keamanan diatur lewat Row Level Security, bukan dengan menyembunyikan key ini |
| `service_role` key | `SUPABASE_SERVICE_ROLE_KEY` (**Netlify environment variable SAJA**) | **TIDAK.** Key ini melewati semua RLS. Kalau bocor, siapapun bisa baca/tulis/hapus apapun. Jangan pernah taruh di file yang ikut ke-commit ke git, jangan taruh di kode frontend. |

## 4. Isi konfigurasi di kode

Buka 2 file ini, isi baris `SUPABASE_URL` dan `SUPABASE_ANON_KEY` (isinya sama di kedua file):

- [`index.html`](index.html) — cari `const SUPABASE_URL = "";` di bagian `<script>`.
- [`admin.html`](admin.html) — cari baris yang sama di bagian atas `<script>`.

```js
const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOi..."; // anon/public key, BUKAN service_role
```

> Catatan: kalau kamu pakai `index.template.html` + script build (lihat riwayat sesi ini), isi juga
> di template-nya supaya tidak hilang saat generate ulang.

## 5. Pindahkan 56 game yang sudah ada ke Supabase

Dari terminal, di folder `bgg-database`:

```bash
npm install
SUPABASE_URL=https://xxxxxxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxxxxxxx node supabase/seed.mjs
```

(Ganti dengan URL & **service_role key** punya kamu — key ini cuma dipakai sekali di terminal lokal,
tidak disimpan di mana-mana.) Kalau berhasil akan muncul `Berhasil upsert 56 game...`.

## 6. Bikin akun admin (buat login ke admin.html)

Di dashboard Supabase → **Authentication** → **Users** → **Add user** → isi email & password admin
kamu sendiri (jangan pakai fitur signup publik, karena memang tidak kita sediakan). Bisa bikin lebih
dari satu akun kalau ada beberapa admin.

## 7. Deploy ke Netlify + set environment variables

1. Push folder `bgg-database` ke GitHub (kalau belum), lalu di [app.netlify.com](https://app.netlify.com)
   → **Add new site → Import an existing project** → hubungkan repo → **Base directory**: `bgg-database`,
   **Build command**: kosongkan, **Publish directory**: `.`
2. Sebelum/sesudah deploy pertama, buka **Site settings → Environment variables**, tambahkan:

   | Key | Value |
   |---|---|
   | `SUPABASE_URL` | sama seperti di atas |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key (SECRET) |
   | `ADMIN_EMAILS` | email admin, pisah koma kalau lebih dari satu, mis. `kamu@email.com,partner@email.com` |
   | `IP_HASH_SALT` | **WAJIB** — string acak panjang (mis. hasil `openssl rand -hex 32`). Dipakai untuk hash IP rate-limit. Fungsi `submit` sengaja gagal (500) kalau ini belum di-set, supaya tidak ada salt default yang publik. |

3. **Deploy** (atau **Trigger deploy** kalau env var ditambahkan setelah deploy pertama). Netlify otomatis
   `npm install` dependency di `package.json` dan mem-bundle isi `netlify/functions/` jadi endpoint di
   `https://situs-kamu.netlify.app/.netlify/functions/...`.

## 8. Tes end-to-end

1. Buka situs publik → klik **Tambah Game** → isi form → **Ajukan**. Harus muncul toast "usulan terkirim".
2. Buka `https://situs-kamu.netlify.app/admin.html` → login pakai akun admin dari langkah 6.
3. Usulan tadi harus muncul di daftar → klik **Approve**.
4. Refresh halaman publik (`index.html`) → game yang baru di-approve harus sudah muncul di database live
   (badge kecil di bawah judul app akan berubah jadi "🟢 Data live").

---

## Yang perlu diingat soal keamanan

- **`admin.html` tidak ditautkan di navigasi manapun**, tapi URL-nya tetap bisa ditebak orang. Itu **aman**
  karena tetap butuh login akun admin yang sah (dicek ulang di server lewat `ADMIN_EMAILS`) — bukan
  "security by obscurity" semata.
- **`SUPABASE_SERVICE_ROLE_KEY` hanya boleh ada di environment variable Netlify**, tidak pernah di kode/
  file yang ikut ke git.
- Rate limit di `submit.js` (default: 5 usulan/jam per alamat IP) mencegah spam otomatis skala kecil-
  menengah, tapi bukan proteksi anti-bot yang canggih. Kalau ke depan kena spam serius, opsi lanjutan:
  tambah Cloudflare Turnstile/reCAPTCHA di form submit sebelum data dikirim ke `submit.js`.
- Semua submission yang di-reject/approve tersimpan permanen di tabel `submissions` (statusnya berubah,
  tidak dihapus) — jadi ada jejak audit siapa mengusulkan apa dan kapan.
