# Kitsune API (unofficial)

API scraper anime sub Indo: Express + axios + cheerio, lengkap dengan **halaman web**, **dokumentasi interaktif**, dan **OpenAPI**. Rotasi User-Agent dan proxy, retry, deteksi Cloudflare, cache, siap deploy ke Vercel.

## Jalankan
    npm install
    npm start        # http://localhost:3000

| Alamat | Isi |
|---|---|
| `/` | Halaman utama + demo langsung |
| `/docs` | Dokumentasi: parameter, contoh cURL/JS/Python, tombol "Coba langsung" |
| `/api` | Indeks endpoint (JSON) |
| `/api/openapi.json` | Spesifikasi OpenAPI 3 (impor ke Postman / Insomnia / Swagger UI) |
| `/health` | Cek status |

## Deploy Vercel
    npm i -g vercel
    vercel --prod
Isi env dari `.env.example` di dashboard Vercel (terutama `PROXY_LIST`; file proxies.txt tidak dipakai di Vercel). `vercel.json` sudah menyertakan folder `public/`.

## Endpoint
Lihat `/docs` untuk detail lengkap. Ringkasnya:

| Endpoint | Fungsi |
|---|---|
| `/api/home` | ongoing + complete |
| `/api/ongoing?page=1` | daftar ongoing |
| `/api/complete?page=1` | daftar complete |
| `/api/anime-list` | semua anime A-Z |
| `/api/search?q=judul` | pencarian |
| `/api/anime/:slug` | detail, sinopsis, episode, slug `batch` dan `lengkap` |
| `/api/watch/:episodeSlug` | stream default, server mirror, download, prev/next |
| `/api/stream?content=...` | resolve embed satu mirror (dari `servers[].url`) |
| `/api/download/:episodeSlug` | link download satu episode |
| `/api/batch/:batchSlug` | link download batch |
| `/api/lengkap/:lengkapSlug` | link download lengkap |
| `/api/schedule` | jadwal rilis |
| `/api/genres` | daftar genre |
| `/api/genres/:genre?page=1` | anime per genre |

`watch`, `download`, `batch`, dan `lengkap` juga tersedia tanpa prefix `/api`.

## Mengubah dokumentasi
Semua endpoint didefinisikan sekali di `public/endpoints.js`. Halaman `/docs` dan `/api/openapi.json` dibuat otomatis dari file itu, jadi tambah atau ubah endpoint di sana saja.

## Mengganti nama
Nama "Kitsune API" ada di `public/endpoints.js` (untuk OpenAPI dan `/api`) dan di teks HTML `public/*.html`. Cari-dan-ganti saja.

## Struktur
    index.js            server + scraper
    public/index.html   halaman utama
    public/docs.html    dokumentasi
    public/endpoints.js sumber data dokumentasi + OpenAPI
    public/style.css    seluruh gaya (tema terang/gelap otomatis)
    public/*.js         interaksi halaman
    public/fonts/       font self-host (Dela Gothic One, Plus Jakarta Sans, JetBrains Mono)

## Catatan
- Selector dicocokkan dengan scraper open source. Kalau situs sumber berubah, jalankan `node inspect.js <url>` dan sesuaikan.
- IP datacenter (Vercel) sering diblokir Cloudflare. Pakai proxy residential di `PROXY_LIST`.
- ID action admin-ajax bisa berubah; ganti lewat env `NONCE_ACTION` / `STREAM_ACTION`.
- Halaman utama otomatis menjalankan satu pencarian contoh saat dibuka (di-cache 5 menit).
- Proyek tidak resmi dan tidak berafiliasi dengan situs sumbernya.
