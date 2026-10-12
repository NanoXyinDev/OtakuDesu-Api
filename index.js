const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { router: authRouter, HttpError } = require("./lib/auth");
const limiter = require("./lib/limiter");
const badReq = (m) => new HttpError(400, m, "BAD_REQUEST");

const BASE = process.env.BASE_URL || "https://otakudesu.blog";
const SH = (process.env.SAMEHADAKU_URL || "https://v2.samehadaku.how").replace(/\/$/, "");
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

/* Gateway scraping (opsional): kirim semua request ke layanan yang menembus Cloudflare untuk kita
   (ScraperAPI, ScrapingBee, ZenRows, dll.). Template URL-nya diisi di env FETCH_GATEWAY, {url} diganti
   alamat target yang sudah di-encode. Contoh: https://api.scraperapi.com/?api_key=KEY&url={url} */
const GATEWAY = process.env.FETCH_GATEWAY || "";
const viaGateway = (u) => (GATEWAY ? GATEWAY.replace("{url}", encodeURIComponent(u)) : u);
let proxyIdx = 0;
// Proxy yang gagal didinginkan sementara (backoff 30 dtk, 1 mnt, 2 mnt ... maks 30 mnt)
const proxyHealth = new Map();
function nextProxy() {
  if (!PROXIES.length) return null;
  const now = Date.now();
  for (let i = 0; i < PROXIES.length; i++) {
    const p = PROXIES[proxyIdx++ % PROXIES.length];
    const h = proxyHealth.get(p);
    if (!h || h.until <= now) return p;
  }
  return PROXIES[proxyIdx++ % PROXIES.length]; // semua sedang didinginkan: tetap coba
}
const markFail = (p) => {
  if (!p) return;
  const h = proxyHealth.get(p) || { fails: 0 };
  h.fails++; h.until = Date.now() + Math.min(30 * 60000, 30000 * 2 ** (h.fails - 1));
  proxyHealth.set(p, h);
};
const markOk = (p) => p && proxyHealth.delete(p);
const coolingProxies = () => [...proxyHealth.values()].filter((h) => h.until > Date.now()).length;

const proxyCfg = (proxy) =>
  proxy
    ? { httpAgent: new HttpsProxyAgent(proxy), httpsAgent: new HttpsProxyAgent(proxy), proxy: false }
    : {};

/* ---------- HTTP fetch dengan retry ---------- */
async function fetchText(url, retries = parseInt(process.env.RETRIES) || 2, base = BASE, json = false) {
  // Tanpa proxy, mengulang ke IP yang sama tidak ada gunanya (dan menghabiskan batas waktu Vercel).
  if (!PROXIES.length || GATEWAY) retries = 1; // gateway berbayar per request: jangan diulang
  let lastErr;
  for (let i = 0; i < retries; i++) {
    const proxy = GATEWAY ? null : nextProxy();
    try {
      const res = await axios.get(viaGateway(url), {
        timeout: TIMEOUT,
        validateStatus: () => true, // status kita periksa sendiri supaya pesan errornya jelas
        headers: {
          "User-Agent": randomUA(),
          Accept: json ? "application/json,text/plain,*/*" : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
          Referer: base + "/",
          "Upgrade-Insecure-Requests": "1",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "same-origin",
        },
        ...proxyCfg(proxy),
      });
      const html = typeof res.data === "string" ? res.data : JSON.stringify(res.data);
      const cf = html.includes("Just a moment") || html.includes("Attention Required") || html.includes("cf-chl");
      if (res.status === 403 || res.status === 503 || cf) {
        markFail(proxy);
        throw new HttpError(
          502,
          `Diblokir situs sumber ${new URL(url).host} (HTTP ${res.status}, kemungkinan Cloudflare). IP server ini ditolak. ` +
            (GATEWAY ? "Gateway scraping juga ditolak: cek kuota/API key-nya." : PROXIES.length
              ? "Proxy yang dipakai juga ditolak: ganti dengan proxy residential."
              : "Isi env FETCH_GATEWAY (layanan scraping) atau PROXY_LIST (proxy residential), atau jalankan API dari jaringan rumahan."),
          "SOURCE_BLOCKED"
        );
      }
      if (res.status === 404) {
        markOk(proxy);
        const err = new HttpError(404, "Halaman tidak ditemukan di situs sumber (HTTP 404). Cek slug-nya.", "SOURCE_NOT_FOUND");
        err.final = true; // tidak perlu diulang
        throw err;
      }
      if (res.status >= 400) {
        markFail(proxy);
        throw new HttpError(502, `Situs sumber mengembalikan HTTP ${res.status}`, "SOURCE_ERROR");
      }
      markOk(proxy);
      return html;
    } catch (e) {
      if (!e.status) {
        markFail(proxy);
        const timeout = e.code === "ECONNABORTED" || e.code === "ETIMEDOUT";
        e = new HttpError(timeout ? 504 : 502, timeout ? "Situs sumber terlalu lama merespons" : "Situs sumber tidak bisa dijangkau: " + e.message, timeout ? "SOURCE_TIMEOUT" : "SOURCE_UNREACHABLE");
      }
      lastErr = e;
      if (e.final) break;
    }
  }
  throw lastErr;
}
const fetchHTML = async (url, retries, base) => cheerio.load(await fetchText(url, retries, base));
const fetchJSON = async (url, base) => JSON.parse(await fetchText(url, 2, base, true));

async function postAjax(form, referer, base = BASE) {
  const res = await axios.post(viaGateway(`${base}/wp-admin/admin-ajax.php`), new URLSearchParams(form).toString(), {
    timeout: TIMEOUT,
    headers: {
      "User-Agent": randomUA(),
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Requested-With": "XMLHttpRequest",
      Origin: base,
      Referer: referer || base + "/",
    },
    ...(GATEWAY ? {} : proxyCfg(nextProxy())),
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

/* ---------- Cache: memori + Redis opsional (Upstash), dengan stale-if-error ----------
   Data lebih tua dari CACHE_TTL dianggap basi tapi tetap disajikan (X-Cache: STALE)
   kalau situs sumber sedang error/diblokir, selama umurnya < STALE_TTL. */
const CACHE_TTL = (parseInt(process.env.CACHE_TTL) || 300) * 1000;
const STALE_TTL = (parseInt(process.env.STALE_TTL) || 86400) * 1000;
const cache = new Map();
const R_URL = (process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/$/, "");
const R_AUTH = { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN || ""}` };
const rKey = (k) => encodeURIComponent("kitsune:" + k);
async function redisGet(key) {
  if (!R_URL) return null;
  try {
    const r = await axios.get(`${R_URL}/get/${rKey(key)}`, { headers: R_AUTH, timeout: 1500 });
    return r.data && r.data.result ? JSON.parse(r.data.result) : null;
  } catch { return null; }
}
function redisSet(key, val) {
  if (!R_URL) return;
  axios.post(`${R_URL}/set/${rKey(key)}?EX=${Math.ceil(STALE_TTL / 1000)}`, JSON.stringify(val), { headers: { ...R_AUTH, "Content-Type": "text/plain" }, timeout: 1500 }).catch(() => {});
}
const cacheKey = (req) =>
  req.path + "?" + Object.keys(req.query).filter((k) => k !== "apikey").sort().map((k) => `${k}=${req.query[k]}`).join("&");

const wrap = (fn) => async (req, res) => {
  const cacheable = CACHE_TTL > 0 && !req.path.includes("/stream");
  const key = cacheable ? cacheKey(req) : null;
  const entry = cacheable ? cache.get(key) || (await redisGet(key)) : null;
  if (entry && Date.now() - entry.at < CACHE_TTL) {
    res.set("X-Cache", "HIT");
    return res.json(entry.body);
  }
  try {
    const body = { status: true, data: await fn(req) };
    if (cacheable) {
      const e = { body, at: Date.now() };
      if (cache.size > 500) cache.delete(cache.keys().next().value);
      cache.set(key, e);
      redisSet(key, e);
      // Sengaja private: kalau di-cache CDN, request melewati pembatas & cek login.
      res.set("Cache-Control", "private, max-age=0, must-revalidate");
    }
    res.json(body);
  } catch (e) {
    if (entry && Date.now() - entry.at < STALE_TTL) {
      res.set("X-Cache", "STALE");
      return res.json({ ...entry.body, stale: true, stale_reason: e.message });
    }
    res.status(e.status || (e.isAxiosError ? 502 : 500)).json({ status: false, code: e.code || "ERROR", message: e.message });
  }
};

/* ---------- Dokumentasi (satu sumber: public/endpoints.js) ---------- */
const DOCS = require("./public/endpoints.js");

function buildOpenAPI(origin) {
  const paths = {};
  DOCS.endpoints.forEach((ep) => {
    const example = JSON.parse(JSON.stringify(ep.response).split("{{BASE}}").join(origin));
    paths[ep.path] = {
      get: {
        tags: [(DOCS.groups.find((g) => g.id === ep.group) || {}).title || ep.group],
        operationId: ep.id,
        summary: ep.title,
        description: ep.desc + (ep.notes ? "\n\n" + ep.notes.join("\n") : ""),
        parameters: ep.params.map((p) => ({
          name: p.name,
          in: p.in,
          required: !!p.required,
          description: p.desc,
          schema: { type: p.type, ...(p.default ? { default: p.type === "integer" ? Number(p.default) : p.default } : {}) },
          ...(p.example ? { example: p.type === "integer" ? Number(p.example) : p.example } : {}),
        })),
        responses: {
          200: { description: "Sukses", content: { "application/json": { example } } },
          ...(ep.plain
            ? {}
            : { 500: { description: "Gagal", content: { "application/json": { example: { status: false, message: "Pesan galat" } } } } }),
        },
      },
    };
  });
  return {
    openapi: "3.0.3",
    info: { title: DOCS.name, version: DOCS.version, description: "API REST tidak resmi untuk data anime sub Indo. Tanpa API key, CORS terbuka." },
    servers: [{ url: origin }],
    tags: DOCS.groups.map((g) => ({ name: g.title, description: g.blurb })),
    paths,
  };
}

/* ---------- Endpoint ---------- */
const app = express();
app.set("trust proxy", true); // supaya req.protocol benar di balik proxy Vercel
app.disable("x-powered-by");

app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type, X-API-Key, Authorization");
  res.set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  res.set("Access-Control-Expose-Headers", "X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-RateLimit-Role, X-Cache, Retry-After");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: "10kb" }));

// Halaman HTML (beranda "/" dan dokumentasi "/docs") + aset statis
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"], maxAge: "1h" }));

app.get("/health", (req, res) => res.json({ ok: true, proxies: PROXIES.length, proxies_cooling: coolingProxies(), gateway: !!GATEWAY, sources: { otakudesu: BASE, samehadaku: SH } }));

const originOf = (req) => `${req.protocol}://${req.get("host")}`;

app.get("/api/openapi.json", (req, res) => res.json(buildOpenAPI(originOf(req))));

// Indeks JSON: daftar endpoint
app.get("/api", (req, res) =>
  res.json({
    name: DOCS.name,
    version: DOCS.version,
    docs: "/docs",
    openapi: "/api/openapi.json",
    proxies_loaded: PROXIES.length,
    endpoints: Object.fromEntries(
      DOCS.endpoints.filter((e) => e.group !== "sistem").map((e) => [e.id, e.path.replace(/\{(\w+)\}/g, ":$1")])
    ),
  })
);


// Status sumber: probe halaman depan masing-masing (cache 5 menit). Tanpa pembatas: hasilnya di-cache.
let statusCache = { at: 0, body: null };
async function probe(base) {
  const t = Date.now();
  try { await fetchText(base + "/", 1, base); return { ok: true, ms: Date.now() - t }; }
  catch (e) { return { ok: false, ms: Date.now() - t, code: e.code || "ERROR", message: e.message }; }
}
app.get("/api/status", async (req, res) => {
  if (!statusCache.body || Date.now() - statusCache.at > 5 * 60 * 1000) {
    const [a, b] = await Promise.all([probe(BASE), probe(SH)]);
    statusCache = { at: Date.now(), body: { otakudesu: a, samehadaku: b } };
  }
  res.set("Cache-Control", "no-store");
  res.json({ status: true, checked_at: new Date(statusCache.at).toISOString(), data: statusCache.body });
});

// Akun (register, login, OAuth, API key, admin) — tidak kena pembatas request
app.use("/auth", authRouter);
app.get(["/login", "/register"], (req, res) => res.redirect("/account"));

// Semua route setelah ini dibatasi per peran (tamu / user / premium / admin)
app.use(limiter.middleware);

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

async function okuSearch(q) {
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
}

app.get(
  "/api/search",
  wrap(async (req) => {
    const q = req.query.q;
    if (!q) throw badReq("Parameter ?q= wajib diisi");
    return okuSearch(q);
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
    if (!content) throw badReq("Parameter ?content= wajib diisi");
    const ref = req.query.ref;
    const params = JSON.parse(Buffer.from(content, "base64").toString("utf8"));

    const nonceRes = await postAjax({ action: NONCE_ACTION }, ref);
    const res = await postAjax({ ...params, nonce: nonceRes.data, action: STREAM_ACTION }, ref);
    const html = Buffer.from(res.data, "base64").toString("utf8");
    const src = cheerio.load(html)("iframe").attr("src");
    if (!src) throw new HttpError(502, "Embed tidak ditemukan (action ID mungkin berubah)", "EMBED_NOT_FOUND");
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


/* ==========================================================
   Sumber kedua: Samehadaku (v2.samehadaku.how) -> /api/samehadaku/*
   Catatan: selector ditulis berdasarkan struktur tema situsnya dan dibuat
   toleran; kalau situs berubah, cek dengan `node inspect.js <url>`.
   ========================================================== */
const S = "/api/samehadaku";
const img = ($el) => $el.attr("data-lazy-src") || $el.attr("data-src") || $el.attr("src") || null;
const pageNum = (req) => Math.max(1, parseInt(req.query.page) || 1);
const pathPage = (base, page) => (page > 1 ? `${base}page/${page}/` : base);

// Kartu anime (.animposx): dipakai di daftar, pencarian, dan genre
function shCards($) {
  const out = [];
  $(".animposx").each((_, el) => {
    const c = $(el);
    const a = c.find("a").first();
    const url = a.attr("href");
    if (!url) return;
    out.push({
      title: clean(c.find(".data .title, .title h2, h2, h4").first().text()) || a.attr("title") || "",
      slug: slugOf(url),
      url,
      poster: img(c.find("img").first()),
      type: clean(c.find(".type").first().text()) || null,
      score: clean(c.find(".score").first().text()) || null,
      status: clean(c.find(".data .type, .ttls").first().text()) || null,
      genres: c.find(".genres .mta a, .stooltip .genres a").map((_, g) => clean($(g).text())).get(),
    });
  });
  return out;
}

// Episode terbaru (.post-show li)
function shLatest($) {
  const out = [];
  $(".post-show ul li, .post-show li").each((_, el) => {
    const li = $(el);
    const a = li.find(".entry-title a, h2 a").first();
    const url = a.attr("href");
    if (!url) return;
    const spans = li.find(".dtla span").map((_, s) => clean($(s).text())).get();
    const pick = (re) => (spans.find((t) => re.test(t)) || "").replace(re, "").replace(/^[:\s]+/, "");
    out.push({
      title: clean(a.text()),
      slug: slugOf(url),
      url,
      poster: img(li.find("img").first()),
      episode: pick(/^Episode/i) ? "Episode " + pick(/^Episode/i) : clean(li.find(".lftinfo, .eps").first().text()) || null,
      posted_by: pick(/^Posted by/i) || null,
      released: pick(/^Released on/i) || null,
    });
  });
  return out;
}

app.get(
  `${S}/home`,
  wrap(async () => {
    const [l, p] = await Promise.all([
      fetchHTML(`${SH}/anime-terbaru/`, 2, SH),
      fetchHTML(`${SH}/daftar-anime-2/?order=popular`, 2, SH),
    ]);
    return { latest: shLatest(l), popular: shCards(p) };
  })
);

app.get(
  `${S}/latest`,
  wrap(async (req) => {
    const page = pageNum(req);
    const $ = await fetchHTML(pathPage(`${SH}/anime-terbaru/`, page), 2, SH);
    return { page, list: shLatest($) };
  })
);

app.get(
  `${S}/search`,
  wrap(async (req) => {
    const q = req.query.q;
    if (!q) throw badReq("Parameter ?q= wajib diisi");
    const page = pageNum(req);
    const $ = await fetchHTML(`${SH}/${page > 1 ? `page/${page}/` : ""}?s=${encodeURIComponent(q)}`, 2, SH);
    return { query: q, page, list: shCards($) };
  })
);

// Daftar anime dengan filter: status, type, order, q
app.get(
  `${S}/list`,
  wrap(async (req) => {
    const page = pageNum(req);
    const { status = "", type = "", order = "", q = "" } = req.query;
    const qs = new URLSearchParams({ title: q, status, type, order }).toString();
    const $ = await fetchHTML(`${pathPage(`${SH}/daftar-anime-2/`, page)}?${qs}`, 2, SH);
    return { page, list: shCards($) };
  })
);

app.get(
  `${S}/genres`,
  wrap(async () => {
    const $ = await fetchHTML(`${SH}/daftar-anime-2/`, 2, SH);
    const seen = new Map();
    $("input[name='genre[]']").each((_, i) => {
      const v = $(i).attr("value");
      const label = clean($(i).closest("li").text()) || v;
      if (v) seen.set(v, { name: label, slug: v });
    });
    if (!seen.size)
      $("a[href*='/genre/']").each((_, a) => {
        const slug = slugOf($(a).attr("href"));
        if (slug) seen.set(slug, { name: clean($(a).text()) || slug, slug });
      });
    return [...seen.values()];
  })
);

app.get(
  `${S}/genres/:genre`,
  wrap(async (req) => {
    const page = pageNum(req);
    const g = req.params.genre;
    const $ = await fetchHTML(pathPage(`${SH}/genre/${g}/`, page), 2, SH);
    return { genre: g, page, list: shCards($) };
  })
);

app.get(
  `${S}/anime/:slug`,
  wrap(async (req) => {
    const $ = await fetchHTML(`${SH}/anime/${req.params.slug}/`, 2, SH);
    const info = {};
    $(".anim-senct .spe span, .infox .spe span, .spe span").each((_, el) => {
      const s = $(el);
      const key = clean(s.find("b").first().text()).replace(/:$/, "");
      if (!key) return;
      const val = clean(s.clone().children("b").remove().end().text()).replace(/^:\s*/, "");
      info[key.toLowerCase().replace(/\s+/g, "_")] = val;
    });
    const episodes = [];
    $(".lstepsiode ul li").each((_, el) => {
      const li = $(el);
      const a = li.find(".lchx a, .epsleft a").first();
      const url = a.attr("href");
      if (!url) return;
      episodes.push({
        number: clean(li.find(".epsright .eps, .eps").first().text()) || null,
        title: clean(a.text()),
        slug: slugOf(url),
        url,
        date: clean(li.find(".date").first().text()) || null,
      });
    });
    const batch = $("a[href*='/batch/']").first().attr("href");
    return {
      title: clean($("h1.entry-title").first().text()),
      poster: img($(".infoanime .thumb img, .thumb img").first()),
      rating: clean($("[itemprop='ratingValue'], .archiveanime-rating span").first().text()) || null,
      genres: $(".genre-info a").map((_, g) => clean($(g).text())).get(),
      info,
      synopsis: clean($(".entry-content-single, .desc .entry-content").first().text()),
      trailer: $("a.trailerbutton, .trailer-anime a").first().attr("href") || null,
      batch: batch ? slugOf(batch) : null,
      episodes,
    };
  })
);

app.get(
  `${S}/episode/:slug`,
  wrap(async (req) => {
    const url = `${SH}/${req.params.slug}/`;
    const $ = await fetchHTML(url, 2, SH);
    const origin = originOf(req);

    const servers = [];
    $("#server .east_player_option, .east_player_option").each((_, el) => {
      const d = $(el);
      const name = clean(d.text());
      const post = d.attr("data-post");
      if (!post) return;
      servers.push({
        server: name,
        quality: (name.match(/\d{3,4}p/i) || [null])[0],
        url: `${origin}${S}/stream?post=${encodeURIComponent(post)}&nume=${encodeURIComponent(d.attr("data-nume") || "1")}&type=${encodeURIComponent(d.attr("data-type") || "schtml")}&ref=${encodeURIComponent(url)}`,
      });
    });

    let prev = $("a[rel='prev']").attr("href");
    let next = $("a[rel='next']").attr("href");
    $(".naveps a").each((_, a) => {
      const t = ($(a).text() + " " + ($(a).attr("title") || "")).toLowerCase();
      if (!prev && /prev|sebelum/.test(t)) prev = $(a).attr("href");
      if (!next && /next|selanjut|berikut/.test(t)) next = $(a).attr("href");
    });
    const anime = $(".naveps .nvsc a, a[href*='/anime/']").first().attr("href");

    return {
      title: clean($("h1.entry-title").first().text()),
      anime: anime ? slugOf(anime) : null,
      default_stream: $("#pembed iframe, .player-embed iframe, .video-nav iframe").first().attr("src") || null,
      servers,
      prev: prev ? slugOf(prev) : null,
      next: next ? slugOf(next) : null,
      downloads: shDownloads($),
    };
  })
);

// Link download Samehadaku: blok .download-eps (format -> kualitas -> penyedia)
function shDownloads($) {
  const out = [];
  $(".download-eps, #downloadb .download-eps").each((_, blk) => {
    const format = clean($(blk).find("p b, p").first().text());
    $(blk)
      .find("ul li")
      .each((_, li) => {
        const quality = clean($(li).find("strong").first().text());
        const links = [];
        $(li)
          .find("a")
          .each((_, a) => {
            const u = $(a).attr("href");
            if (u) links.push({ provider: clean($(a).text()), url: u });
          });
        if (quality && links.length) out.push({ format, quality, links });
      });
  });
  return out;
}

// Resolve satu server mirror (admin-ajax player_ajax)
app.get(
  `${S}/stream`,
  wrap(async (req) => {
    const { post, nume, type, ref } = req.query;
    if (!post || !nume) throw badReq("Parameter ?post= dan ?nume= wajib diisi");
    const html = String(await postAjax({ action: "player_ajax", post, nume, type: type || "schtml" }, ref, SH));
    const src = cheerio.load(html)("iframe").attr("src") || (html.match(/src=["']([^"']+)["']/i) || [])[1];
    if (!src) throw new HttpError(502, "Embed tidak ditemukan (aksi player_ajax mungkin berubah)", "EMBED_NOT_FOUND");
    return { embed: src };
  })
);

app.get(
  `${S}/batch/:slug`,
  wrap(async (req) => {
    const $ = await fetchHTML(`${SH}/batch/${req.params.slug}/`, 2, SH);
    return { title: clean($("h1.entry-title, h1").first().text()), downloads: shDownloads($) };
  })
);

// Jadwal rilis per hari: ?day=monday..sunday (default: hari ini)
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
app.get(
  `${S}/schedule`,
  wrap(async (req) => {
    const day = String(req.query.day || DAYS[new Date().getDay()]).toLowerCase();
    if (!DAYS.includes(day)) throw badReq("Parameter ?day= harus salah satu dari: " + DAYS.join(", "));
    const data = await fetchJSON(`${SH}/wp-json/custom/v1/all-schedule?perpage=50&day=${day}&page=1`, SH);
    const rows = Array.isArray(data) ? data : data.data || data.results || [];
    return {
      day,
      list: rows.map((r) => ({
        title: clean(r.title || ""),
        slug: slugOf(r.url || r.link || ""),
        url: r.url || r.link || null,
        poster: r.featured_img_src || r.poster || null,
        type: r.east_type || null,
        score: r.east_score || null,
        time: r.east_time || null,
        genres: r.genre || null,
      })),
    };
  })
);

/* ==========================================================
   Gabungan: dua sumber sekaligus, field seragam. Kalau satu sumber gagal,
   hasil sumber lain tetap dikembalikan dan alasan gagalnya ada di data.sources.
   ========================================================== */
const normOku = (c) => ({
  source: "otakudesu", title: c.title, slug: c.slug, url: c.url, poster: c.poster || null, type: null,
  score: c.rating || null, status: c.status || null, genres: c.genres ? String(c.genres).split(/,\s*/) : [],
});
const normSh = (c) => ({ source: "samehadaku", title: c.title, slug: c.slug, url: c.url, poster: c.poster || null, type: c.type || null, score: c.score || null, status: c.status || null, genres: c.genres || [] });

function merge(results, names, norms, extra) {
  const sources = {}, out = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      sources[names[i]] = { ok: true, count: r.value.length };
      out.push(...r.value.map(norms[i]));
    } else sources[names[i]] = { ok: false, code: r.reason.code || "ERROR", error: r.reason.message };
  });
  if (!out.length && results.every((r) => r.status === "rejected")) {
    const err = new HttpError(502, "Semua sumber gagal: " + Object.entries(sources).map(([k, v]) => `${k}: ${v.error}`).join(" | "), "ALL_SOURCES_FAILED");
    throw err;
  }
  return { ...extra, sources, results: out };
}

app.get(
  "/api/unified/search",
  wrap(async (req) => {
    const q = req.query.q;
    if (!q) throw badReq("Parameter ?q= wajib diisi");
    const page = pageNum(req);
    const r = await Promise.allSettled([okuSearch(q), fetchHTML(`${SH}/${page > 1 ? `page/${page}/` : ""}?s=${encodeURIComponent(q)}`, 2, SH).then(shCards)]);
    return merge(r, ["otakudesu", "samehadaku"], [normOku, normSh], { query: q, page });
  })
);

app.get(
  "/api/unified/latest",
  wrap(async (req) => {
    const page = pageNum(req);
    const r = await Promise.allSettled([
      fetchHTML(`${BASE}/ongoing-anime/page/${page}/`).then(($) => parseCards($, "body")),
      fetchHTML(pathPage(`${SH}/anime-terbaru/`, page), 2, SH).then(shLatest),
    ]);
    const nOku = (c) => ({ source: "otakudesu", kind: "anime", title: c.title, slug: c.slug, url: c.url, poster: c.poster || null, episode: c.episode || null, released: [c.day, c.date].filter(Boolean).join(", ") || null });
    const nSh = (c) => ({ source: "samehadaku", kind: "episode", title: c.title, slug: c.slug, url: c.url, poster: c.poster || null, episode: c.episode || null, released: c.released || null });
    return merge(r, ["otakudesu", "samehadaku"], [nOku, nSh], { page });
  })
);

app.use((req, res) => {
  const wantsPage = !/^\/(api|auth|health|watch|download|batch|lengkap)(\/|$)/.test(req.path) && (req.get("accept") || "").includes("text/html");
  if (wantsPage) return res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
  res.status(404).json({ status: false, message: "Endpoint tidak ditemukan", path: req.path, docs: "/docs", openapi: "/api/openapi.json" });
});

app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ status: false, code: err.type === "entity.parse.failed" ? "BAD_JSON" : "ERROR", message: err.type === "entity.parse.failed" ? "Body bukan JSON yang valid" : err.message });
});

if (require.main === module) {
  app.listen(PORT, () =>
    console.log(`API jalan di http://localhost:${PORT} | proxy dimuat: ${PROXIES.length}`)
  );
}

module.exports = app; // dipakai Vercel
