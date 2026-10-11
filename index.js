const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const { HttpsProxyAgent } = require("https-proxy-agent");

const BASE = process.env.BASE_URL || "https://otakudesu.blog";
const PORT = process.env.PORT || 3000;
const TIMEOUT = parseInt(process.env.TIMEOUT) || 8000; // Vercel Hobby batas ~10 detik
const NONCE_ACTION = process.env.NONCE_ACTION || "aa1208d27f29ca340c92c66d1926f13f";
const STREAM_ACTION = process.env.STREAM_ACTION || "2a3505c93b0035d3f455df82bf976b84";

/* ---------- User-Agent rotation ---------- */
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
];
const randomUA = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

/* ---------- Proxy rotation ----------
   Isi proxies.txt (1 proxy per baris) atau env PROXY_LIST (pisah koma).
   Format: http://user:pass@host:port  atau  http://host:port */
function loadProxies() {
  let list = [];
  if (process.env.PROXY_LIST) list = process.env.PROXY_LIST.split(",");
  const file = path.join(__dirname, "proxies.txt");
  if (fs.existsSync(file)) list = list.concat(fs.readFileSync(file, "utf8").split("\n"));
  return list.map((p) => p.trim()).filter((p) => p && !p.startsWith("#"));
}
const PROXIES = loadProxies();
let proxyIdx = 0;
const nextProxy = () => (PROXIES.length ? PROXIES[proxyIdx++ % PROXIES.length] : null);

const proxyCfg = (proxy) =>
  proxy
    ? { httpAgent: new HttpsProxyAgent(proxy), httpsAgent: new HttpsProxyAgent(proxy), proxy: false }
    : {};

/* ---------- HTTP fetch dengan retry ---------- */
async function fetchHTML(url, retries = 2) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    const proxy = nextProxy();
    try {
      const res = await axios.get(url, {
        timeout: TIMEOUT,
        headers: {
          "User-Agent": randomUA(),
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
          Referer: BASE + "/",
        },
        ...proxyCfg(proxy),
      });
      const html = String(res.data);
      if (html.includes("Just a moment") || html.includes("Attention Required")) {
        throw new Error("Diblokir Cloudflare (ganti proxy / pakai proxy residential)");
      }
      return cheerio.load(html);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

async function postAjax(form, referer) {
  const res = await axios.post(`${BASE}/wp-admin/admin-ajax.php`, new URLSearchParams(form).toString(), {
    timeout: TIMEOUT,
    headers: {
      "User-Agent": randomUA(),
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
      Origin: BASE,
      Referer: referer || BASE + "/",
    },
    ...proxyCfg(nextProxy()),
  });
  return res.data;
}

/* ---------- Helpers ---------- */
const slugOf = (href = "") => href.replace(/\/$/, "").split("/").pop();
const clean = (s = "") => s.replace(/\s+/g, " ").trim();

function parseCards($, scope) {
  const out = [];
  $(scope)
    .find(".venz ul li")
    .each((_, el) => {
      const li = $(el);
      const href = li.find(".thumb a").attr("href") || li.find("a").first().attr("href");
      if (!href) return;
      out.push({
        title: clean(li.find(".jdlflm").text()),
        slug: slugOf(href),
        url: href,
        poster: li.find("img").attr("src"),
        episode: clean(li.find(".epz").text()),
        day: clean(li.find(".epztipe").text()),
        date: clean(li.find(".newnime").text()),
      });
    });
  return out;
}


function parseDownloads($) {
  const out = [];
  $(".download ul li, .batchlink ul li").each((_, li) => {
    const quality = clean($(li).find("strong").first().text());
    const links = [];
    $(li)
      .find("a")
      .each((_, a) => {
        const url = $(a).attr("href");
        if (url) links.push({ provider: clean($(a).text()), url });
      });
    if (!quality || !links.length) return;
    out.push({ quality, size: clean($(li).find("i").first().text()), links });
  });
  return out;
}

/* ---------- Cache ringan (in-memory) ---------- */
const CACHE_TTL = (parseInt(process.env.CACHE_TTL) || 300) * 1000;
const cache = new Map();

const wrap = (fn) => async (req, res) => {
  const cacheable = CACHE_TTL > 0 && !req.path.includes("/stream");
  const key = req.originalUrl;
  const hit = cache.get(key);
  if (cacheable && hit && Date.now() - hit.at < CACHE_TTL) {
    res.set("X-Cache", "HIT");
    return res.json(hit.body);
  }
  try {
    const body = { status: true, data: await fn(req) };
    if (cacheable) {
      if (cache.size > 500) cache.delete(cache.keys().next().value);
      cache.set(key, { body, at: Date.now() });
      res.set("Cache-Control", `public, s-maxage=${CACHE_TTL / 1000}, stale-while-revalidate=60`);
    }
    res.json(body);
  } catch (e) {
    res.status(500).json({ status: false, message: e.message });
  }
};

/* ---------- Endpoint ---------- */
const app = express();

app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  next();
});

app.get("/health", (req, res) => res.json({ ok: true, proxies: PROXIES.length }));

app.get("/", (req, res) =>
  res.json({
    name: "Otakudesu API",
    proxies_loaded: PROXIES.length,
    endpoints: {
      home: "/api/home",
      ongoing: "/api/ongoing?page=1",
      complete: "/api/complete?page=1",
      search: "/api/search?q=naruto",
      detail: "/api/anime/:slug",
      watch: "/api/watch/:episodeSlug",
      stream: "/api/stream?content=...",
      download: "/download/:episodeSlug",
      batch: "/batch/:batchSlug",
      lengkap: "/lengkap/:lengkapSlug",
      animeList: "/api/anime-list",
      schedule: "/api/schedule",
      genres: "/api/genres",
      genreAnime: "/api/genres/:genre?page=1",
      health: "/health",
    },
  })
);

// Beranda: ongoing + complete
app.get(
  "/api/home",
  wrap(async () => {
    const [o, c] = await Promise.all([
      fetchHTML(`${BASE}/ongoing-anime/`),
      fetchHTML(`${BASE}/complete-anime/`),
    ]);
    return { ongoing: parseCards(o, "body"), complete: parseCards(c, "body") };
  })
);

app.get(
  "/api/ongoing",
  wrap(async (req) => {
    const page = parseInt(req.query.page) || 1;
    const $ = await fetchHTML(`${BASE}/ongoing-anime/page/${page}/`);
    return { page, list: parseCards($, "body") };
  })
);

app.get(
  "/api/complete",
  wrap(async (req) => {
    const page = parseInt(req.query.page) || 1;
    const $ = await fetchHTML(`${BASE}/complete-anime/page/${page}/`);
    return { page, list: parseCards($, "body") };
  })
);

app.get(
  "/api/search",
  wrap(async (req) => {
    const q = req.query.q;
    if (!q) throw new Error("Parameter ?q= wajib diisi");
    const $ = await fetchHTML(`${BASE}/?s=${encodeURIComponent(q)}&post_type=anime`);
    const list = [];
    $("ul.chivsrc li").each((_, el) => {
      const li = $(el);
      const a = li.find("h2 a");
      const info = {};
      li.find(".set").each((_, s) => {
        const [k, ...v] = $(s).text().split(":");
        if (v.length) info[clean(k).toLowerCase()] = clean(v.join(":"));
      });
      list.push({
        title: clean(a.text()),
        slug: slugOf(a.attr("href")),
        url: a.attr("href"),
        poster: li.find("img").attr("src"),
        ...info,
      });
    });
    return list;
  })
);

app.get(
  "/api/anime/:slug",
  wrap(async (req) => {
    const $ = await fetchHTML(`${BASE}/anime/${req.params.slug}/`);
    const info = {};
    $(".infozingle p").each((_, el) => {
      const [k, ...v] = $(el).text().split(":");
      if (v.length) info[clean(k).toLowerCase().replace(/\s+/g, "_")] = clean(v.join(":"));
    });
    const episodes = [];
    $(".episodelist ul li").each((_, el) => {
      const a = $(el).find("a").first();
      if (!(a.attr("href") || "").includes("/episode/")) return;
      episodes.push({
        title: clean(a.text()),
        slug: slugOf(a.attr("href")),
        url: a.attr("href"),
        date: clean($(el).find(".zeebr").text()),
      });
    });
    return {
      poster: $(".fotoanime img").attr("src"),
      info,
      synopsis: clean($(".sinopc").text()),
      title: clean($(".jdlrx h1, .posttl h1").first().text()),
      batch: slugOf($("a[href*='/batch/']").attr("href") || "") || null,
      lengkap: slugOf($("a[href*='/lengkap/']").attr("href") || "") || null,
      episodes,
    };
  })
);


// Halaman nonton: slug = slug episode, contoh /api/watch/xxxx-episode-1-sub-indo
app.get(
  ["/api/watch/:slug", "/watch/:slug"],
  wrap(async (req) => {
    const url = `${BASE}/episode/${req.params.slug}/`;
    const $ = await fetchHTML(url);
    const origin = `${req.protocol}://${req.get("host")}`;

    const servers = [];
    $(".mirrorstream ul").each((_, ul) => {
      const quality = ($(ul).attr("class") || "").replace(/^m/, "");
      $(ul)
        .find("li a")
        .each((_, a) => {
          const content = $(a).attr("data-content");
          if (!content) return;
          servers.push({
            quality,
            server: clean($(a).text()),
            url: `${origin}/api/stream?content=${encodeURIComponent(content)}&ref=${encodeURIComponent(url)}`,
          });
        });
    });

    let prev, next;
    $(".flir a").each((_, a) => {
      const t = ($(a).text() + " " + ($(a).attr("title") || "")).toLowerCase();
      if (t.includes("prev")) prev = $(a).attr("href");
      if (t.includes("next")) next = $(a).attr("href");
    });

    return {
      title: clean($(".posttl").first().text() || $(".venutama h1").first().text()),
      default_stream: $("#pembed iframe").attr("src") || null,
      servers,
      prev: prev ? slugOf(prev) : null,
      next: next ? slugOf(next) : null,
      downloads: parseDownloads($),
    };
  })
);

// Ambil URL embed dari satu server mirror
app.get(
  "/api/stream",
  wrap(async (req) => {
    const content = req.query.content;
    if (!content) throw new Error("Parameter ?content= wajib diisi");
    const ref = req.query.ref;
    const params = JSON.parse(Buffer.from(content, "base64").toString("utf8"));

    const nonceRes = await postAjax({ action: NONCE_ACTION }, ref);
    const res = await postAjax({ ...params, nonce: nonceRes.data, action: STREAM_ACTION }, ref);
    const html = Buffer.from(res.data, "base64").toString("utf8");
    const src = cheerio.load(html)("iframe").attr("src");
    if (!src) throw new Error("Embed tidak ditemukan (action ID mungkin berubah)");
    return { embed: src };
  })
);

// Link download satu episode
app.get(
  ["/api/download/:slug", "/download/:slug"],
  wrap(async (req) => {
    const $ = await fetchHTML(`${BASE}/episode/${req.params.slug}/`);
    return { title: clean($(".posttl").first().text() || $(".venutama h1").first().text()), downloads: parseDownloads($) };
  })
);

// Link download batch (slug dari field "batch" di /api/anime/:slug)
app.get(
  ["/api/batch/:slug", "/batch/:slug"],
  wrap(async (req) => {
    const $ = await fetchHTML(`${BASE}/batch/${req.params.slug}/`);
    return { title: clean($("h1, .batchlink h4").first().text()), downloads: parseDownloads($) };
  })
);

app.get(
  "/api/anime-list",
  wrap(async () => {
    const $ = await fetchHTML(`${BASE}/anime-list/`);
    const out = [];
    $(".hodebgst").each((_, a) => {
      const url = $(a).attr("href");
      if (url) out.push({ title: clean($(a).text()), slug: slugOf(url), url });
    });
    return out;
  })
);

// Link download "lengkap" (slug dari field "lengkap" di /api/anime/:slug)
app.get(
  ["/api/lengkap/:slug", "/lengkap/:slug"],
  wrap(async (req) => {
    const $ = await fetchHTML(`${BASE}/lengkap/${req.params.slug}/`);
    return { downloads: parseDownloads($) };
  })
);

// Anime per genre: /api/genres/action?page=1
app.get(
  "/api/genres/:genre",
  wrap(async (req) => {
    const page = parseInt(req.query.page) || 1;
    const g = req.params.genre;
    const $ = await fetchHTML(page > 1 ? `${BASE}/genres/${g}/page/${page}/` : `${BASE}/genres/${g}/`);
    const list = [];
    $(".col-anime").each((_, el) => {
      const a = $(el).find("a").first();
      const url = a.attr("href");
      if (!url) return;
      list.push({
        title: clean($(el).find(".col-anime-title").text()) || a.attr("title") || "",
        slug: slugOf(url),
        url,
        poster: $(el).find("img").attr("src"),
        episode: clean($(el).find(".episode").text()),
        rating: clean($(el).find(".rating").text()),
        status: clean($(el).find(".status").text()),
      });
    });
    return { genre: g, page, list };
  })
);

app.get(
  "/api/schedule",
  wrap(async () => {
    const $ = await fetchHTML(`${BASE}/jadwal-rilis/`);
    const out = {};
    $(".kglist321").each((_, el) => {
      const day = clean($(el).find("h2").text());
      out[day] = [];
      $(el)
        .find("ul li a")
        .each((_, a) => out[day].push({ title: clean($(a).text()), slug: slugOf($(a).attr("href")) }));
    });
    return out;
  })
);

app.get(
  "/api/genres",
  wrap(async () => {
    const $ = await fetchHTML(`${BASE}/genre-list/`);
    const out = [];
    $(".genres li a").each((_, a) =>
      out.push({ name: clean($(a).text()), slug: slugOf($(a).attr("href")) })
    );
    return out;
  })
);

app.use((req, res) => res.status(404).json({ status: false, message: "Endpoint tidak ditemukan" }));

if (require.main === module) {
  app.listen(PORT, () =>
    console.log(`API jalan di http://localhost:${PORT} | proxy dimuat: ${PROXIES.length}`)
  );
}

module.exports = app; // dipakai Vercel
