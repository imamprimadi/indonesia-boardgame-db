// Jalankan SEKALI dari folder bgg-database, setelah `npm install` dan setelah schema.sql dijalankan
// di Supabase, untuk memindahkan isi indonesia-games.json ke tabel `games` di Supabase.
//
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxxxxxxx node supabase/seed.mjs
//
// Ambil kedua nilai itu dari Supabase Dashboard -> Project Settings -> API.
// JANGAN commit Service Role Key ke git manapun — cuma dipakai sekali di terminal lokal kamu.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Set env var SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY dulu sebelum menjalankan script ini.');
  process.exit(1);
}

const supabase = createClient(url, key);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, '..', 'indonesia-games.json');
const db = JSON.parse(readFileSync(dataPath, 'utf8'));

const rows = db.games.map(g => ({
  id: g.id,
  name: g.name,
  image: g.image || null,
  categories: g.categories || [],
  mechanics: g.mechanics || [],
  averageweight: g.averageweight ?? 0,
  minplayers: g.minplayers ?? 1,
  maxplayers: g.maxplayers ?? 1,
  rank: g.rank ?? null,
  rating: g.rating ?? 0,
  url: g.url || null,
  publisher: g.publisher || null,
  series: g.series || null,
  playtime: g.playtime || null,
  age: g.age || null,
  description: g.description || null,
  source: g.source || null,
}));

const { error } = await supabase.from('games').upsert(rows, { onConflict: 'id' });

if (error) {
  console.error('Gagal seed:', error);
  process.exit(1);
}

console.log(`Berhasil upsert ${rows.length} game ke tabel Supabase "games".`);
