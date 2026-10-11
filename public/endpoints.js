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

  const groups = [
    { id: "jelajahi", title: "Jelajahi", blurb: "Daftar anime yang sedang tayang, sudah tamat, per genre, dan jadwal rilis." },
    { id: "cari", title: "Cari", blurb: "Cari anime berdasarkan judul." },
    { id: "detail", title: "Detail", blurb: "Info lengkap satu anime beserta daftar episodenya." },
    { id: "tonton", title: "Tonton", blurb: "Server mirror dan URL embed untuk satu episode." },
    { id: "unduh", title: "Unduh", blurb: "Link download per episode, batch, dan paket lengkap." },
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
    {
      id: "health",
      group: "sistem",
      path: "/health",
      title: "Cek status",
      desc: "Mengembalikan ok jika server hidup, beserta jumlah proxy yang termuat.",
      params: [],
      response: { ok: true, proxies: 0 },
      plain: true,
    },
    {
      id: "index",
      group: "sistem",
      path: "/api",
      title: "Indeks endpoint",
      desc: "Daftar semua endpoint dalam bentuk JSON.",
      params: [],
      response: { name: "Kitsune API", version: "2.0.0", docs: "/docs", openapi: "/api/openapi.json", endpoints: { search: "/api/search?q=naruto" } },
      plain: true,
    },
    {
      id: "openapi",
      group: "sistem",
      path: "/api/openapi.json",
      title: "OpenAPI",
      desc: "Spesifikasi OpenAPI 3.0 yang dibuat otomatis dari halaman ini. Impor ke Postman, Insomnia, atau Swagger UI.",
      params: [],
      response: { openapi: "3.0.3", info: { title: "Kitsune API", version: "2.0.0" }, paths: { "…": "…" } },
      plain: true,
    },
  ];

  const errors = [
    { code: 404, text: "Endpoint tidak ditemukan" },
    { code: 500, text: "Parameter wajib kosong, situs sumber tidak bisa dijangkau, atau diblokir Cloudflare" },
  ];

  return { name: "Kitsune API", version: "2.0.0", groups, endpoints, errors };
});
