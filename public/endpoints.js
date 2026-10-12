/* Sumber data tunggal untuk dokumentasi + openapi.json.
   Dipakai di browser (window.KITSUNE_DOCS) dan di server (require). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.KITSUNE_DOCS = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const SLUG = "oni-hanayome-sub-indo";
  const EP = "oni-hanayome-episode-1-sub-indo";

  const card = (extra) => ({
    title: "Oni no Hanayome (Episode 1 – 12) Subtitle Indonesia",
    slug: SLUG,
    url: "https://otakudesu.blog/anime/" + SLUG + "/",
    poster: "https://otakudesu.blog/wp-content/uploads/2026/10/Oni-no-Hanayome-Sub-Indo.jpg",
    ...extra,
  });

  const listCard = {
    title: "Oni no Hanayome",
    slug: SLUG,
    url: "https://otakudesu.blog/anime/" + SLUG + "/",
    poster: "https://otakudesu.blog/wp-content/uploads/2026/10/Oni-no-Hanayome-Sub-Indo.jpg",
    episode: "Episode 12",
    day: "Minggu",
    date: "11 Okt",
  };

  const downloads = [
    {
      quality: "Mp4 480p",
      size: "78.4 MB",
      links: [
        { provider: "Pdrain", url: "https://pixeldrain.com/u/xxxxxxxx" },
        { provider: "Mega", url: "https://mega.nz/file/xxxxxxxx" },
      ],
    },
    {
      quality: "Mp4 720p",
      size: "142.1 MB",
      links: [{ provider: "Pdrain", url: "https://pixeldrain.com/u/yyyyyyyy" }],
    },
  ];


  const page = { name: "page", in: "query", type: "integer", required: false, default: "1", example: "1", desc: "Nomor halaman, mulai dari 1." };
  const shCard = { title: "One Piece", slug: "one-piece", url: "https://v2.samehadaku.how/anime/one-piece/", poster: "https://v2.samehadaku.how/wp-content/uploads/one-piece.jpg", type: "TV", score: "8.7", status: "Ongoing", genres: ["Action", "Adventure"] };
  const shEp = { title: "One Piece Episode 1", slug: "one-piece-episode-1", url: "https://v2.samehadaku.how/one-piece-episode-1/", poster: "https://v2.samehadaku.how/wp-content/uploads/one-piece.jpg", episode: "Episode 1", posted_by: "Admin", released: "2 jam lalu" };

  const groups = [
    { id: "jelajahi", title: "Jelajahi", blurb: "Daftar anime yang sedang tayang, sudah tamat, per genre, dan jadwal rilis." },
    { id: "cari", title: "Cari", blurb: "Cari anime berdasarkan judul." },
    { id: "detail", title: "Detail", blurb: "Info lengkap satu anime beserta daftar episodenya." },
    { id: "tonton", title: "Tonton", blurb: "Server mirror dan URL embed untuk satu episode." },
    { id: "unduh", title: "Unduh", blurb: "Link download per episode, batch, dan paket lengkap." },
    { id: "gabungan", title: "Gabungan", blurb: "Otakudesu dan Samehadaku sekaligus, field seragam. Kalau satu sumber gagal, hasil sumber lain tetap dikembalikan." },
    { id: "samehadaku", title: "Samehadaku", blurb: "Sumber kedua dari v2.samehadaku.how: episode terbaru, pencarian, detail, server mirror, dan link unduh. Semua di bawah /api/samehadaku." },
    { id: "sistem", title: "Sistem", blurb: "Cek status dan spesifikasi API." },
  ];

  const endpoints = [
    {
      id: "home",
      group: "jelajahi",
      path: "/api/home",
      title: "Beranda",
      desc: "Gabungan anime ongoing dan complete halaman pertama. Cocok untuk memuat beranda dalam satu request.",
      params: [],
      response: { status: true, data: { ongoing: [listCard], complete: [{ ...listCard, episode: "Episode 12", day: "", date: "" }] } },
    },
    {
      id: "ongoing",
      group: "jelajahi",
      path: "/api/ongoing",
      title: "Anime ongoing",
      desc: "Anime yang sedang tayang, terbaru di atas. Satu halaman berisi sekitar 20 judul.",
      params: [{ name: "page", in: "query", type: "integer", required: false, default: "1", example: "1", desc: "Nomor halaman, mulai dari 1." }],
      response: { status: true, data: { page: 1, list: [listCard] } },
    },
    {
      id: "complete",
      group: "jelajahi",
      path: "/api/complete",
      title: "Anime complete",
      desc: "Anime yang sudah tamat, terbaru di atas.",
      params: [{ name: "page", in: "query", type: "integer", required: false, default: "1", example: "1", desc: "Nomor halaman, mulai dari 1." }],
      response: { status: true, data: { page: 1, list: [{ ...listCard, day: "", date: "" }] } },
    },
    {
      id: "anime-list",
      group: "jelajahi",
      path: "/api/anime-list",
      title: "Daftar semua anime",
      desc: "Seluruh judul anime urut A–Z. Responsnya besar (ribuan judul), jadi simpan di sisi klien dan jangan panggil berulang.",
      params: [],
      response: {
        status: true,
        data: [
          { title: "Aho Girl", slug: "aho-girl-sub-indo", url: "https://otakudesu.blog/anime/aho-girl-sub-indo/" },
          { title: "Oni no Hanayome", slug: SLUG, url: "https://otakudesu.blog/anime/" + SLUG + "/" },
        ],
      },
    },
    {
      id: "schedule",
      group: "jelajahi",
      path: "/api/schedule",
      title: "Jadwal rilis",
      desc: "Jadwal rilis mingguan. Kunci objek adalah nama hari sesuai teks di situs sumber.",
      params: [],
      response: {
        status: true,
        data: { Senin: [{ title: "Contoh Anime A", slug: "contoh-anime-a-sub-indo" }], Minggu: [{ title: "Oni no Hanayome", slug: SLUG }] },
      },
    },
    {
      id: "genres",
      group: "jelajahi",
      path: "/api/genres",
      title: "Daftar genre",
      desc: "Semua genre. Pakai nilai slug untuk memanggil endpoint anime per genre.",
      params: [],
      response: { status: true, data: [{ name: "Action", slug: "action" }, { name: "Romance", slug: "romance" }] },
    },
    {
      id: "genre-anime",
      group: "jelajahi",
      path: "/api/genres/{genre}",
      title: "Anime per genre",
      desc: "Anime dalam satu genre, dengan halaman.",
      params: [
        { name: "genre", in: "path", type: "string", required: true, example: "romance", desc: "Slug genre dari /api/genres." },
        { name: "page", in: "query", type: "integer", required: false, default: "1", example: "1", desc: "Nomor halaman, mulai dari 1." },
      ],
      response: {
        status: true,
        data: {
          genre: "romance",
          page: 1,
          list: [{ title: "Oni no Hanayome", slug: SLUG, url: "https://otakudesu.blog/anime/" + SLUG + "/", poster: "https://otakudesu.blog/wp-content/uploads/2026/10/Oni-no-Hanayome-Sub-Indo.jpg", episode: "12 Eps", rating: "6.82", status: "Completed" }],
        },
      },
    },
    {
      id: "search",
      group: "cari",
      path: "/api/search",
      title: "Cari anime",
      desc: "Cari berdasarkan judul. Field di luar title, slug, url, dan poster mengikuti info yang tampil di hasil pencarian situs sumber, dengan nama kunci huruf kecil (misalnya genres, status, rating).",
      params: [{ name: "q", in: "query", type: "string", required: true, example: "oni", desc: "Kata kunci judul." }],
      response: { status: true, data: [card({ genres: "Drama, Fantasy, Mythology, Romance, Urban Fantasy", status: "Completed", rating: "6.82" })] },
      errors: [{ code: 500, text: "Parameter ?q= wajib diisi" }],
    },
    {
      id: "anime-detail",
      group: "detail",
      path: "/api/anime/{slug}",
      title: "Detail anime",
      desc: "Info anime, sinopsis, dan daftar episode. Field batch dan lengkap berisi slug untuk endpoint unduh, atau null jika tidak tersedia.",
      params: [{ name: "slug", in: "path", type: "string", required: true, example: SLUG, desc: "Slug anime dari hasil pencarian atau daftar." }],
      response: {
        status: true,
        data: {
          poster: "https://otakudesu.blog/wp-content/uploads/2026/10/Oni-no-Hanayome-Sub-Indo.jpg",
          title: "Oni no Hanayome",
          info: { judul: "Oni no Hanayome", skor: "6.82", status: "Completed", total_episode: "12", genre: "Drama, Fantasy, Mythology, Romance, Urban Fantasy" },
          synopsis: "Sinopsis anime tampil di sini.",
          batch: "oni-hanayome-batch-sub-indo",
          lengkap: null,
          episodes: [{ title: "Oni no Hanayome Episode 1 Subtitle Indonesia", slug: EP, url: "https://otakudesu.blog/episode/" + EP + "/", date: "6 Okt, 2026" }],
        },
      },
      notes: ["Nama kunci di info mengikuti label di situs sumber (huruf kecil, spasi jadi underscore), jadi bisa berbeda antar anime."],
    },
    {
      id: "watch",
      group: "tonton",
      path: "/api/watch/{slug}",
      title: "Halaman nonton",
      desc: "Stream default, daftar server mirror per kualitas, episode sebelum dan sesudahnya, plus link unduh. URL setiap server mengarah ke /api/stream di API ini.",
      params: [{ name: "slug", in: "path", type: "string", required: true, example: EP, desc: "Slug episode dari /api/anime/{slug}." }],
      response: {
        status: true,
        data: {
          title: "Oni no Hanayome Episode 1 Subtitle Indonesia",
          default_stream: "https://example-embed.net/v/abcdef",
          servers: [
            { quality: "480p", server: "ondesu", url: "{{BASE}}/api/stream?content=eyJpZCI6MTIzNDUsImkiOjAsInEiOiI3MjBwIn0%3D&ref=https%3A%2F%2Fotakudesu.blog%2Fepisode%2F" + EP + "%2F" },
            { quality: "720p", server: "odstream", url: "{{BASE}}/api/stream?content=…" },
          ],
          prev: null,
          next: "oni-hanayome-episode-2-sub-indo",
          downloads,
        },
      },
      notes: ["Juga tersedia di /watch/{slug} tanpa prefix /api."],
    },
    {
      id: "stream",
      group: "tonton",
      path: "/api/stream",
      title: "Ambil URL embed",
      desc: "Mengubah satu server mirror menjadi URL embed yang bisa dipasang di iframe. Salin nilai URL dari servers[].url pada /api/watch, jangan menyusun content sendiri.",
      params: [
        { name: "content", in: "query", type: "string", required: true, example: "eyJpZCI6MTIzNDUsImkiOjAsInEiOiI3MjBwIn0=", desc: "Token base64 dari servers[].url." },
        { name: "ref", in: "query", type: "string", required: false, example: "", desc: "URL halaman episode asal, ikut terisi di servers[].url." },
      ],
      response: { status: true, data: { embed: "https://example-embed.net/v/abcdef" } },
      notes: ["Respons endpoint ini tidak di-cache karena URL embed bisa kedaluwarsa.", "Gagal dengan pesan “Embed tidak ditemukan” jika ID action situs sumber berubah. Perbarui env NONCE_ACTION dan STREAM_ACTION."],
      errors: [{ code: 500, text: "Embed tidak ditemukan (action ID mungkin berubah)" }],
    },
    {
      id: "download",
      group: "unduh",
      path: "/api/download/{slug}",
      title: "Unduh satu episode",
      desc: "Link unduh satu episode, dikelompokkan per kualitas lalu per penyedia.",
      params: [{ name: "slug", in: "path", type: "string", required: true, example: EP, desc: "Slug episode." }],
      response: { status: true, data: { title: "Oni no Hanayome Episode 1 Subtitle Indonesia", downloads } },
      notes: ["Juga tersedia di /download/{slug}."],
    },
    {
      id: "batch",
      group: "unduh",
      path: "/api/batch/{slug}",
      title: "Unduh batch",
      desc: "Link unduh satu batch seluruh episode.",
      params: [{ name: "slug", in: "path", type: "string", required: true, example: "oni-hanayome-batch-sub-indo", desc: "Nilai field batch dari /api/anime/{slug}." }],
      response: { status: true, data: { title: "Oni no Hanayome Batch Subtitle Indonesia", downloads } },
      notes: ["Juga tersedia di /batch/{slug}."],
    },
    {
      id: "lengkap",
      group: "unduh",
      path: "/api/lengkap/{slug}",
      title: "Unduh lengkap",
      desc: "Link unduh paket lengkap sebuah anime.",
      params: [{ name: "slug", in: "path", type: "string", required: true, example: "", desc: "Nilai field lengkap dari /api/anime/{slug}." }],
      response: { status: true, data: { downloads } },
      notes: ["Juga tersedia di /lengkap/{slug}."],
    },

    /* ---------- Gabungan ---------- */
    {
      id: "unified-search", group: "gabungan", path: "/api/unified/search", title: "Cari di dua sumber",
      desc: "Pencarian judul ke Otakudesu dan Samehadaku sekaligus. Hasil digabung dengan field seragam; data.sources menunjukkan sumber mana yang berhasil.",
      params: [{ name: "q", in: "query", type: "string", required: true, example: "naruto", desc: "Kata kunci judul." }, page],
      response: { status: true, data: { query: "naruto", page: 1, sources: { otakudesu: { ok: true, count: 1 }, samehadaku: { ok: false, code: "SOURCE_BLOCKED", error: "Diblokir situs sumber" } }, results: [{ source: "otakudesu", title: "Naruto", slug: "naruto-sub-indo", url: "https://otakudesu.blog/anime/naruto-sub-indo/", poster: null, type: null, score: "8.0", status: "Completed", genres: ["Action"] }] } },
      notes: ["Slug berlaku di sumber asalnya: pakai /api/anime/{slug} untuk otakudesu, /api/samehadaku/anime/{slug} untuk samehadaku."],
    },
    {
      id: "unified-latest", group: "gabungan", path: "/api/unified/latest", title: "Terbaru dari dua sumber",
      desc: "Anime ongoing (Otakudesu) dan episode terbaru (Samehadaku) dalam satu daftar. Cocok untuk bot notifikasi.",
      params: [page],
      response: { status: true, data: { page: 1, sources: { otakudesu: { ok: true, count: 1 }, samehadaku: { ok: true, count: 1 } }, results: [{ source: "samehadaku", kind: "episode", title: "One Piece Episode 1", slug: "one-piece-episode-1", url: "https://v2.samehadaku.how/one-piece-episode-1/", poster: null, episode: "Episode 1", released: "2 jam lalu" }] } },
      notes: ["kind = episode berarti slug adalah slug episode; kind = anime berarti slug anime."],
    },

    /* ---------- Samehadaku ---------- */
    {
      id: "sh-home", group: "samehadaku", path: "/api/samehadaku/home", title: "Beranda Samehadaku",
      desc: "Episode terbaru dan anime populer dalam satu request.",
      params: [],
      response: { status: true, data: { latest: [shEp], popular: [shCard] } },
    },
    {
      id: "sh-latest", group: "samehadaku", path: "/api/samehadaku/latest", title: "Episode terbaru",
      desc: "Daftar episode yang baru dirilis, terbaru di atas.",
      params: [page],
      response: { status: true, data: { page: 1, list: [shEp] } },
    },
    {
      id: "sh-search", group: "samehadaku", path: "/api/samehadaku/search", title: "Cari anime",
      desc: "Cari anime berdasarkan judul.",
      params: [{ name: "q", in: "query", type: "string", required: true, example: "naruto", desc: "Kata kunci judul." }, page],
      response: { status: true, data: { query: "naruto", page: 1, list: [shCard] } },
    },
    {
      id: "sh-list", group: "samehadaku", path: "/api/samehadaku/list", title: "Daftar anime",
      desc: "Daftar anime dengan filter status, tipe, dan urutan.",
      params: [
        page,
        { name: "status", in: "query", type: "string", required: false, example: "Ongoing", desc: "Ongoing atau Completed." },
        { name: "type", in: "query", type: "string", required: false, example: "TV", desc: "TV, Movie, OVA, ONA, atau Special." },
        { name: "order", in: "query", type: "string", required: false, example: "popular", desc: "title, titlereverse, update, latest, atau popular." },
        { name: "q", in: "query", type: "string", required: false, example: "", desc: "Filter judul (opsional)." },
      ],
      response: { status: true, data: { page: 1, list: [shCard] } },
    },
    {
      id: "sh-genres", group: "samehadaku", path: "/api/samehadaku/genres", title: "Daftar genre",
      desc: "Semua genre beserta slug-nya.",
      params: [],
      response: { status: true, data: [{ name: "Action", slug: "action" }] },
    },
    {
      id: "sh-genre", group: "samehadaku", path: "/api/samehadaku/genres/{genre}", title: "Anime per genre",
      desc: "Anime dalam satu genre.",
      params: [{ name: "genre", in: "path", type: "string", required: true, example: "action", desc: "Slug genre." }, page],
      response: { status: true, data: { genre: "action", page: 1, list: [shCard] } },
    },
    {
      id: "sh-anime", group: "samehadaku", path: "/api/samehadaku/anime/{slug}", title: "Detail anime",
      desc: "Info, sinopsis, genre, trailer, dan semua episode.",
      params: [{ name: "slug", in: "path", type: "string", required: true, example: "one-piece", desc: "Slug anime dari hasil pencarian." }],
      response: {
        status: true,
        data: {
          title: "One Piece", poster: "https://v2.samehadaku.how/wp-content/uploads/one-piece.jpg", rating: "8.7",
          genres: ["Action", "Adventure"], info: { status: "Ongoing", type: "TV", duration: "24 min" },
          synopsis: "Sinopsis anime tampil di sini.", trailer: null, batch: null,
          episodes: [{ number: "1", title: "One Piece Episode 1", slug: "one-piece-episode-1", url: "https://v2.samehadaku.how/one-piece-episode-1/", date: "2 tahun lalu" }],
        },
      },
      notes: ["Nama kunci di info mengikuti label situs sumber (huruf kecil, spasi jadi underscore)."],
    },
    {
      id: "sh-episode", group: "samehadaku", path: "/api/samehadaku/episode/{slug}", title: "Halaman nonton",
      desc: "Server mirror, stream default, link unduh, dan episode sebelum/sesudahnya.",
      params: [{ name: "slug", in: "path", type: "string", required: true, example: "one-piece-episode-1", desc: "Slug episode dari detail anime." }],
      response: {
        status: true,
        data: {
          title: "One Piece Episode 1", anime: "one-piece", default_stream: "https://example.com/embed/xxxx",
          servers: [{ server: "Blogspot 720p", quality: "720p", url: "{{BASE}}/api/samehadaku/stream?post=1234&nume=1&type=schtml&ref=…" }],
          prev: null, next: "one-piece-episode-2",
          downloads: [{ format: "MKV", quality: "720p", links: [{ provider: "Pdrain", url: "https://pixeldrain.com/u/xxxxxxxx" }] }],
        },
      },
    },
    {
      id: "sh-stream", group: "samehadaku", path: "/api/samehadaku/stream", title: "Resolve embed",
      desc: "Ambil URL embed satu server mirror. Pakai URL dari servers[].url di endpoint episode.",
      params: [
        { name: "post", in: "query", type: "string", required: true, example: "1234", desc: "ID post dari server mirror." },
        { name: "nume", in: "query", type: "string", required: true, example: "1", desc: "Nomor server." },
        { name: "type", in: "query", type: "string", required: false, default: "schtml", example: "schtml", desc: "Tipe player." },
      ],
      response: { status: true, data: { embed: "https://example.com/embed/xxxx" } },
      notes: ["Tidak di-cache."],
    },
    {
      id: "sh-batch", group: "samehadaku", path: "/api/samehadaku/batch/{slug}", title: "Unduh batch",
      desc: "Link unduh batch (slug dari field batch di detail anime).",
      params: [{ name: "slug", in: "path", type: "string", required: true, example: "one-piece-batch", desc: "Nilai field batch." }],
      response: { status: true, data: { title: "One Piece Batch", downloads: [{ format: "MKV", quality: "720p", links: [{ provider: "Pdrain", url: "https://pixeldrain.com/u/xxxxxxxx" }] }] } },
    },
    {
      id: "sh-schedule", group: "samehadaku", path: "/api/samehadaku/schedule", title: "Jadwal rilis",
      desc: "Jadwal rilis per hari.",
      params: [{ name: "day", in: "query", type: "string", required: false, example: "monday", desc: "monday sampai sunday. Default: hari ini." }],
      response: { status: true, data: { day: "monday", list: [{ title: "One Piece", slug: "one-piece", url: "https://v2.samehadaku.how/anime/one-piece/", poster: null, type: "TV", score: "8.7", time: "09:30", genres: "Action, Adventure" }] } },
    },
    {
      id: "health",
      group: "sistem",
      path: "/health",
      title: "Cek status",
      desc: "Mengembalikan ok jika server hidup, beserta jumlah proxy yang termuat.",
      params: [],
      response: { ok: true, proxies: 0, sources: { otakudesu: "https://otakudesu.blog", samehadaku: "https://v2.samehadaku.how" } },
      plain: true,
    },
    {
      id: "index",
      group: "sistem",
      path: "/api",
      title: "Indeks endpoint",
      desc: "Daftar semua endpoint dalam bentuk JSON.",
      params: [],
      response: { name: "Kitsune API", version: "2.2.0", docs: "/docs", openapi: "/api/openapi.json", endpoints: { search: "/api/search?q=naruto" } },
      plain: true,
    },
    {
      id: "openapi",
      group: "sistem",
      path: "/api/openapi.json",
      title: "OpenAPI",
      desc: "Spesifikasi OpenAPI 3.0 yang dibuat otomatis dari halaman ini. Impor ke Postman, Insomnia, atau Swagger UI.",
      params: [],
      response: { openapi: "3.0.3", info: { title: "Kitsune API", version: "2.2.0" }, paths: { "…": "…" } },
      plain: true,
    },
  ];

  const errors = [
    { code: 400, text: "Parameter wajib kosong atau tidak valid (code: BAD_REQUEST)" },
    { code: 401, text: "API key tidak valid, atau endpoint butuh login (INVALID_API_KEY, UNAUTHORIZED)" },
    { code: 403, text: "Akun diblokir (BANNED)" },
    { code: 404, text: "Endpoint atau halaman di situs sumber tidak ditemukan (SOURCE_NOT_FOUND)" },
    { code: 429, text: "Batas request per menit atau per hari tercapai (RATE_LIMITED, DAILY_QUOTA). Lihat header Retry-After" },
    { code: 502, text: "Situs sumber diblokir Cloudflare atau tidak bisa dijangkau (SOURCE_BLOCKED, SOURCE_UNREACHABLE)" },
    { code: 504, text: "Situs sumber terlalu lama merespons (SOURCE_TIMEOUT)" },
  ];

  return { name: "Kitsune API", version: "2.2.0", groups, endpoints, errors };
});
