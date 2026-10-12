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

## Akun, peran, dan limit
Login email+password, Google, dan GitHub. Data akun disimpan di `database/data.json` pada repo GitHub (env `GITHUB_TOKEN`, `GH_DB_REPO`); tanpa token dipakai file lokal untuk pengembangan. Halaman akun ada di `/account`.

| Peran | Per menit | Per hari |
|---|---|---|
| guest (tanpa login, per IP) | 10 | 200 |
| user | 60 | 3.000 |
| premium | 180 | 30.000 |
| admin | tanpa batas | tanpa batas |

Ubah angka atau tambah peran lewat env `ROLE_LIMITS` (lihat `.env.example`) atau `lib/roles.js`. Kirim API key lewat header `X-API-Key` (atau `Authorization: Bearer kt_...`, atau `?apikey=`). Respons membawa `X-RateLimit-*`; melewati batas memberi HTTP 429 + `Retry-After`. `REQUIRE_AUTH=true` menolak tamu.

Admin: isi `ADMIN_EMAILS`, lalu login Google/GitHub dengan email itu (login password tidak diberi admin karena emailnya tidak diverifikasi). Admin mengatur peran dan blokir di `/account`.

**Membuat kredensial OAuth**
- Google: <https://console.cloud.google.com> → pilih/buat project → *APIs & Services* → *OAuth consent screen* (External, isi nama app + email) → *Credentials* → *Create credentials* → *OAuth client ID* → *Web application* → *Authorized redirect URIs*: `https://DOMAIN-KAMU/auth/google/callback` (tambah `http://localhost:3000/auth/google/callback` untuk lokal). Salin Client ID dan Client secret ke `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
- GitHub: <https://github.com/settings/developers> → *OAuth Apps* → *New OAuth App* → *Authorization callback URL*: `https://DOMAIN-KAMU/auth/github/callback`. Salin ke `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`.

Catatan penting:
- **Buat repo database menjadi private.** Isinya email, hash password, dan hash API key pengguna.
- Batas per menit/hari dihitung per instance; di Vercel (serverless) angkanya perkiraan. Untuk batas ketat lintas instance, simpan penghitung di Redis.
- Tiap register, ganti key, atau ubah peran = 1 commit di repo database. Pemakaian harian disimpan berkala (`USAGE_FLUSH_SEC`) supaya commit tidak membludak.
- Pemakaian Google/GitHub OAuth tidak butuh verifikasi email sendiri; register password tidak memverifikasi email.

## Sumber kedua: Samehadaku
Sumber `https://v2.samehadaku.how` (ubah lewat env `SAMEHADAKU_URL`). Semua endpoint di bawah `/api/samehadaku`:

| Endpoint | Fungsi |
|---|---|
| `/api/samehadaku/home` | episode terbaru + populer |
| `/api/samehadaku/latest?page=1` | episode terbaru |
| `/api/samehadaku/search?q=judul` | pencarian |
| `/api/samehadaku/list?status=&type=&order=&q=&page=` | daftar dengan filter |
| `/api/samehadaku/genres` , `/genres/:genre?page=1` | genre dan anime per genre |
| `/api/samehadaku/anime/:slug` | detail, genre, episode |
| `/api/samehadaku/episode/:slug` | server mirror, stream default, unduhan, prev/next |
| `/api/samehadaku/stream?post=&nume=&type=` | resolve embed satu mirror |
| `/api/samehadaku/batch/:slug` | unduhan batch |
| `/api/samehadaku/schedule?day=monday` | jadwal rilis per hari |

> Selector Samehadaku ditulis dari struktur tema situsnya dan diuji dengan HTML tiruan, belum dengan situs asli (tidak terjangkau dari lingkungan pengembangan). Kalau ada field kosong, jalankan `node inspect.js <url>` dan sesuaikan `shCards`, `shLatest`, dan `shDownloads` di `index.js`.

## Endpoint Otakudesu
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

## Proxy gratis dari GitHub
    node scripts/fetch-proxies.js          # ambil, uji, simpan yang lolos ke proxies.txt
    node scripts/fetch-proxies.js 800 30   # uji 800 proxy, simpan maksimal 30
Proxy gratis umumnya mati dalam hitungan jam dan sering diblokir Cloudflare, jadi jalankan ulang berkala. Kalau proxy banyak yang gagal, naikkan `RETRIES` (default 2). Untuk Vercel, `proxies.txt` tidak dipakai: salin hasilnya ke env `PROXY_LIST` (dipisah koma).

## Kena "SOURCE_BLOCKED" (403 Cloudflare)?
IP datacenter (Vercel, Railway, dll.) ditolak situs sumber; ini tidak bisa diperbaiki lewat kode. Pilihan, dari yang paling gampang:
1. **`FETCH_GATEWAY`**: pakai layanan scraping (ScraperAPI/ScrapingBee/ZenRows). Isi template URL-nya di env, lihat `.env.example`. Di Vercel cukup ini saja.
2. **Jalankan dari jaringan rumahan**: PC/HP (Termux) + Cloudflare Tunnel. IP rumahan biasanya lolos tanpa proxy.
3. **`PROXY_LIST`** dengan proxy residential (`node scripts/fetch-proxies.js` untuk proxy gratis, hasilnya sering gagal).
Pesan error menyebut host mana yang diblokir; `/health` menampilkan `gateway: true/false`.

## Ketahanan
- Cache memori + Redis opsional (Upstash). Kalau situs sumber error/diblokir, data lama tetap disajikan (`X-Cache: STALE`, `stale: true`) selama umurnya < `STALE_TTL`.
- Proxy yang gagal didinginkan sementara (backoff), request diulang dengan proxy lain. `/health` menampilkan `proxies_cooling`.
- Kode status: 400 parameter salah, 401/403 auth, 404 tidak ditemukan, 429 limit, 502 sumber diblokir/mati, 504 timeout.
- `/api/unified/search` dan `/api/unified/latest`: dua sumber sekaligus, tetap jalan walau salah satu gagal.

## Catatan
- Selector dicocokkan dengan scraper open source. Kalau situs sumber berubah, jalankan `node inspect.js <url>` dan sesuaikan.
- IP datacenter (Vercel) sering diblokir Cloudflare. Pakai proxy residential di `PROXY_LIST`.
- ID action admin-ajax bisa berubah; ganti lewat env `NONCE_ACTION` / `STREAM_ACTION`.
- Halaman utama otomatis menjalankan satu pencarian contoh saat dibuka (di-cache 5 menit).
- Proyek tidak resmi dan tidak berafiliasi dengan situs sumbernya.
