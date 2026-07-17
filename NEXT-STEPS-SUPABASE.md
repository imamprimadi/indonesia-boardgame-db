# Sisa Setup Supabase — Panduan Ringkas

Status kamu: project Supabase sudah aktif (resumed), Netlify sudah live di
https://boardgame-id.netlify.app/. Tinggal 3 langkah ini.

---

## 1. Jalankan ulang schema (aman diulang, jaga-jaga kolom baru belum masuk)

Supabase Dashboard → project **indonesia-boardgame-db** → menu **SQL Editor** (di sidebar kiri)
→ **New query** → copy-paste **seluruh isi** file [`supabase/schema.sql`](supabase/schema.sql) → **Run**.

## 2. Isi 87 game ke tabel `games`

Terminal, di folder `bgg-database`:

```bash
SUPABASE_URL=https://wwhccyjtwbkewwlsqoth.supabase.co SUPABASE_SERVICE_ROLE_KEY=<paste_service_role_key_di_sini> node supabase/seed.mjs
```

Ambil `SUPABASE_SERVICE_ROLE_KEY` dari: Dashboard → **Project Settings** (ikon gear) → **API** →
bagian `service_role`. Sukses kalau muncul: `Berhasil upsert 87 game ke tabel Supabase "games".`

## 3. Bikin akun admin

Dashboard → **Authentication** → **Users** → **Add user** →
- Email: `paramawila@gmail.com` (harus sama persis dengan `ADMIN_EMAILS` di Netlify)
- Password: bebas, buat sendiri

---

## Cek hasil akhir

1. Buka https://boardgame-id.netlify.app/ → refresh → badge di bawah judul harus jadi **"🟢 Data live"**
2. Buka https://boardgame-id.netlify.app/admin.html → login pakai akun dari langkah 3 → harus masuk ke dashboard (kosong/"Tidak ada usulan" itu normal kalau belum ada yang submit)

Kalau ada error di salah satu langkah, screenshot/paste pesan errornya ke saya.
