/* Akun: register/login (email + password), OAuth Google & GitHub, API key, panel admin.
   Sesi = JWT HS256 di cookie HttpOnly (stateless, cocok untuk serverless). */
const crypto = require("crypto");
const axios = require("axios");
const express = require("express");
const db = require("./db");
const { limitsFor, isRole, publicRoles } = require("./roles");

class HttpError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}

/* ---------- Rahasia & token ---------- */
let SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  SECRET = crypto.randomBytes(32).toString("hex");
  console.warn("[auth] JWT_SECRET belum diisi: sesi hilang tiap server restart. Isi env JWT_SECRET (acak, 32+ karakter).");
}
const b64u = (b) => Buffer.from(b).toString("base64url");
const hmac = (s) => crypto.createHmac("sha256", SECRET).update(s).digest("base64url");
function sign(payload, ttlSec) {
  const body = b64u(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec }));
  const head = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  return `${head}.${body}.${hmac(head + "." + body)}`;
}
function verify(token) {
  const [h, b, s] = String(token || "").split(".");
  if (!h || !b || !s) return null;
  const good = hmac(h + "." + b);
  if (s.length !== good.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(good))) return null;
  try {
    const p = JSON.parse(Buffer.from(b, "base64url").toString());
    return p.exp > Date.now() / 1000 ? p : null;
  } catch { return null; }
}

/* ---------- Password & API key ---------- */
const scrypt = (pw, salt) => new Promise((res, rej) => crypto.scrypt(pw, salt, 64, (e, k) => (e ? rej(e) : res(k))));
async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return `scrypt$${salt.toString("base64")}$${(await scrypt(pw, salt)).toString("base64")}`;
}
async function checkPassword(pw, stored) {
  const [alg, s, h] = String(stored || "").split("$");
  if (alg !== "scrypt" || !s || !h) { await scrypt(pw, Buffer.alloc(16)); return false; } // waktu tetap
  const want = Buffer.from(h, "base64");
  const got = await scrypt(pw, Buffer.from(s, "base64"));
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const newApiKey = () => "kt_" + crypto.randomBytes(24).toString("base64url");

/* ---------- Cookie ---------- */
const parseCookies = (req) =>
  Object.fromEntries((req.headers.cookie || "").split(";").map((c) => c.trim().split(/=(.*)/s).slice(0, 2)).filter((p) => p[0]));
function setCookie(req, res, name, value, maxAgeSec) {
  const parts = [`${name}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAgeSec}`];
  if (req.secure) parts.push("Secure");
  res.append("Set-Cookie", parts.join("; "));
}
const SESSION_TTL = 30 * 24 * 3600;
const startSession = (req, res, u) => setCookie(req, res, "kt_session", sign({ sub: u.id, tv: u.tv || 0 }, SESSION_TTL), SESSION_TTL);

/* ---------- Pengguna ---------- */
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const todayKey = () => new Date().toISOString().slice(0, 10);

const publicUser = (u, usage) => ({
  id: u.id, email: u.email, name: u.name, role: u.role, banned: !!u.banned,
  providers: Object.keys(u.providers || {}), has_password: !!u.passwordHash,
  api_key_prefix: u.apiKeyPrefix || null, created_at: u.createdAt,
  ...(usage ? { usage } : {}),
});

function makeUser({ email, name, passwordHash = null, provider, providerId, verified }) {
  const key = newApiKey();
  const u = {
    id: crypto.randomUUID(), email, name: name || email.split("@")[0],
    role: verified && ADMIN_EMAILS.includes(email) ? "admin" : "user",
    passwordHash, emailVerified: !!verified, providers: provider ? { [provider]: providerId } : {},
    apiKeyHash: sha(key), apiKeyPrefix: key.slice(0, 11), tv: 0, banned: false, createdAt: new Date().toISOString(),
  };
  return { user: u, apiKey: key };
}

/* ---------- Identifikasi pemanggil (dipakai pembatas request juga) ---------- */
function extractKey(req) {
  const h = req.get("x-api-key");
  if (h) return h;
  const a = req.get("authorization") || "";
  if (/^Bearer kt_/i.test(a)) return a.slice(7).trim();
  if (typeof req.query.apikey === "string") return req.query.apikey;
  return null;
}
async function identify(req) {
  const key = extractKey(req);
  if (key) {
    const data = await db.read();
    const h = sha(key);
    const u = data.users.find((x) => x.apiKeyHash === h);
    if (!u) throw new HttpError(401, "API key tidak valid", "INVALID_API_KEY");
    return { user: u, via: "apikey" };
  }
  const tok = parseCookies(req).kt_session;
  if (tok) {
    const p = verify(tok);
    if (p) {
      const data = await db.read();
      const u = data.users.find((x) => x.id === p.sub);
      if (u && (u.tv || 0) === (p.tv || 0)) return { user: u, via: "session" };
    }
  }
  return { user: null, via: "guest" };
}
async function requireUser(req, role) {
  const { user } = await identify(req);
  if (!user) throw new HttpError(401, "Perlu login", "UNAUTHORIZED");
  if (user.banned) throw new HttpError(403, "Akun diblokir", "BANNED");
  if (role && user.role !== role) throw new HttpError(403, "Hanya untuk " + role, "FORBIDDEN");
  return user;
}

/* ---------- Anti brute-force (per IP, memori) ---------- */
const attempts = new Map();
function throttle(req, max = 10, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const e = attempts.get(req.ip);
  if (!e || e.reset < now) { attempts.set(req.ip, { n: 1, reset: now + windowMs }); return; }
  if (++e.n > max) throw new HttpError(429, "Terlalu banyak percobaan, coba lagi nanti", "TOO_MANY_ATTEMPTS");
  if (attempts.size > 5000) for (const [k, v] of attempts) if (v.reset < now) attempts.delete(k);
}

/* ---------- OAuth ---------- */
const PROVIDERS = {
  google: {
    id: () => process.env.GOOGLE_CLIENT_ID, secret: () => process.env.GOOGLE_CLIENT_SECRET,
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth", scope: "openid email profile",
    async profile(code, redirect) {
      const t = await axios.post("https://oauth2.googleapis.com/token", new URLSearchParams({
        code, client_id: PROVIDERS.google.id(), client_secret: PROVIDERS.google.secret(), redirect_uri: redirect, grant_type: "authorization_code",
      }).toString(), { timeout: 10000 });
      const r = await axios.get("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${t.data.access_token}` }, timeout: 10000 });
      return { id: String(r.data.sub), email: (r.data.email || "").toLowerCase(), verified: r.data.email_verified === true, name: r.data.name };
    },
  },
  github: {
    id: () => process.env.GITHUB_CLIENT_ID, secret: () => process.env.GITHUB_CLIENT_SECRET,
    authUrl: "https://github.com/login/oauth/authorize", scope: "read:user user:email",
    async profile(code, redirect) {
      const t = await axios.post("https://github.com/login/oauth/access_token",
        { client_id: PROVIDERS.github.id(), client_secret: PROVIDERS.github.secret(), code, redirect_uri: redirect },
        { headers: { Accept: "application/json" }, timeout: 10000 });
      const tok = t.data.access_token;
      if (!tok) throw new HttpError(400, "GitHub menolak kode login: " + (t.data.error_description || "tidak diketahui"), "OAUTH_FAILED");
      const H = { Authorization: `Bearer ${tok}`, "User-Agent": "kitsune-api", Accept: "application/vnd.github+json" };
      const [u, em] = await Promise.all([
        axios.get("https://api.github.com/user", { headers: H, timeout: 10000 }),
        axios.get("https://api.github.com/user/emails", { headers: H, timeout: 10000 }),
      ]);
      const primary = (em.data || []).find((e) => e.primary && e.verified) || (em.data || []).find((e) => e.verified);
      return { id: String(u.data.id), email: primary ? primary.email.toLowerCase() : "", verified: !!primary, name: u.data.name || u.data.login };
    },
  },
};
const enabled = (p) => !!(PROVIDERS[p].id() && PROVIDERS[p].secret());
const baseUrl = (req) => (process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");

async function oauthLogin(provider, p) {
  if (!p.email || !p.verified) throw new HttpError(400, "Akun " + provider + " tidak punya email yang terverifikasi", "EMAIL_UNVERIFIED");
  const adminNow = ADMIN_EMAILS.includes(p.email);
  const cur = (await db.read(true)).users.find((u) => u.providers && u.providers[provider] === p.id);
  if (cur && !(adminNow && cur.role !== "admin")) return cur; // tanpa tulis ke database
  let result;
  await db.update((data) => {
    let u = data.users.find((x) => x.providers && x.providers[provider] === p.id);
    if (!u) {
      u = data.users.find((x) => x.email === p.email);
      if (u) {
        // Email terbukti milik pemilik OAuth: cabut password lama yang mungkin dipasang pihak lain.
        if (!u.emailVerified) { u.passwordHash = null; u.tv = (u.tv || 0) + 1; u.emailVerified = true; }
        u.providers = { ...(u.providers || {}), [provider]: p.id };
      } else {
        u = makeUser({ email: p.email, name: p.name, provider, providerId: p.id, verified: true }).user;
        data.users.push(u);
      }
    }
    if (adminNow) u.role = "admin";
    result = u;
  }, `chore(db): oauth ${provider}`);
  return result;
}

/* ---------- Router ---------- */
const router = express.Router();
const wrapR = (fn) => async (req, res) => {
  try { await fn(req, res); }
  catch (e) { res.status(e.status || 500).json({ status: false, code: e.code || "ERROR", message: e.status ? e.message : "Kesalahan server: " + e.message }); }
};
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (["POST", "PATCH"].includes(req.method) && !req.is("application/json") && !req.path.includes("/logout"))
    return res.status(415).json({ status: false, code: "UNSUPPORTED", message: "Kirim JSON (Content-Type: application/json)" });
  next();
});

router.get("/roles", (req, res) => res.json({ status: true, data: publicRoles() }));
router.get("/providers", (req, res) => res.json({ status: true, data: { google: enabled("google"), github: enabled("github"), database: db.mode } }));

router.post("/register", wrapR(async (req, res) => {
  throttle(req);
  const email = String((req.body || {}).email || "").trim().toLowerCase();
  const password = String((req.body || {}).password || "");
  const name = String((req.body || {}).name || "").trim().slice(0, 60);
  if (!/^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$/.test(email) || email.length > 120) throw new HttpError(400, "Email tidak valid", "BAD_REQUEST");
  if (password.length < 8 || password.length > 200) throw new HttpError(400, "Password minimal 8 karakter", "BAD_REQUEST");
  const passwordHash = await hashPassword(password);
  const made = makeUser({ email, name, passwordHash, verified: false });
  await db.update((data) => {
    if (data.users.some((u) => u.email === email)) throw new HttpError(409, "Email sudah terdaftar. Coba masuk, atau pakai Google/GitHub.", "EMAIL_TAKEN");
    data.users.push(made.user);
  }, "chore(db): register user");
  startSession(req, res, made.user);
  res.status(201).json({ status: true, data: { user: publicUser(made.user), api_key: made.apiKey, note: "Simpan API key ini sekarang; tidak akan ditampilkan lagi." } });
}));

router.post("/login", wrapR(async (req, res) => {
  throttle(req);
  const email = String((req.body || {}).email || "").trim().toLowerCase();
  const password = String((req.body || {}).password || "");
  const u = (await db.read(true)).users.find((x) => x.email === email);
  const ok = await checkPassword(password, u && u.passwordHash);
  if (!u || !ok) throw new HttpError(401, "Email atau password salah", "BAD_CREDENTIALS");
  if (u.banned) throw new HttpError(403, "Akun diblokir", "BANNED");
  startSession(req, res, u);
  res.json({ status: true, data: { user: publicUser(u) } });
}));

router.post("/logout", (req, res) => { setCookie(req, res, "kt_session", "", 0); res.json({ status: true }); });

router.get("/me", wrapR(async (req, res) => {
  const u = await requireUser(req);
  const limits = limitsFor(u.role);
  const usage = (await db.read()).usage[u.id] || {};
  res.json({ status: true, data: {
    user: publicUser(u),
    limits: { rpm: Number.isFinite(limits.rpm) ? limits.rpm : null, daily: Number.isFinite(limits.daily) ? limits.daily : null },
    usage_today: require("./limiter").usedToday(u.id) ?? usage[todayKey()] ?? 0,
    usage_history: usage,
  } });
}));

router.post("/apikey/regenerate", wrapR(async (req, res) => {
  const u = await requireUser(req);
  const key = newApiKey();
  await db.update((data) => {
    const x = data.users.find((v) => v.id === u.id);
    x.apiKeyHash = sha(key); x.apiKeyPrefix = key.slice(0, 11);
  }, "chore(db): regenerate api key");
  res.json({ status: true, data: { api_key: key, note: "Key lama langsung tidak berlaku. Simpan key baru ini." } });
}));

/* OAuth */
router.get("/:provider(google|github)", wrapR(async (req, res) => {
  const p = req.params.provider;
  if (!enabled(p)) throw new HttpError(501, `Login ${p} belum dikonfigurasi (isi ${p.toUpperCase()}_CLIENT_ID dan ${p.toUpperCase()}_CLIENT_SECRET)`, "OAUTH_DISABLED");
  const state = crypto.randomBytes(16).toString("hex");
  setCookie(req, res, "kt_oauth", sign({ s: state, p }, 600), 600);
  const q = new URLSearchParams({ client_id: PROVIDERS[p].id(), redirect_uri: `${baseUrl(req)}/auth/${p}/callback`, response_type: "code", scope: PROVIDERS[p].scope, state });
  res.redirect(`${PROVIDERS[p].authUrl}?${q}`);
}));
router.get("/:provider(google|github)/callback", async (req, res) => {
  const p = req.params.provider;
  const fail = (m) => res.redirect("/account?error=" + encodeURIComponent(m));
  try {
    if (!enabled(p)) return fail("Login " + p + " belum dikonfigurasi");
    if (req.query.error) return fail("Login dibatalkan: " + req.query.error);
    const st = verify(parseCookies(req).kt_oauth);
    if (!st || st.p !== p || st.s !== req.query.state || !req.query.code) return fail("Sesi login kedaluwarsa, ulangi.");
    setCookie(req, res, "kt_oauth", "", 0);
    const prof = await PROVIDERS[p].profile(String(req.query.code), `${baseUrl(req)}/auth/${p}/callback`);
    const u = await oauthLogin(p, prof);
    if (u.banned) return fail("Akun diblokir");
    startSession(req, res, u);
    res.redirect("/account");
  } catch (e) { fail(e.status ? e.message : "Login gagal: " + e.message); }
});

/* Admin */
router.get("/admin/users", wrapR(async (req, res) => {
  await requireUser(req, "admin");
  const data = await db.read(true);
  res.json({ status: true, data: data.users.map((u) => publicUser(u, (data.usage[u.id] || {})[todayKey()] || 0)) });
}));
router.patch("/admin/users/:id", wrapR(async (req, res) => {
  const me = await requireUser(req, "admin");
  const { role, banned } = req.body || {};
  if (role !== undefined && !isRole(role)) throw new HttpError(400, "Role tidak dikenal", "BAD_REQUEST");
  if (me.id === req.params.id && (banned || (role && role !== "admin"))) throw new HttpError(400, "Tidak bisa menurunkan atau memblokir akun sendiri", "BAD_REQUEST");
  let out;
  await db.update((data) => {
    const u = data.users.find((x) => x.id === req.params.id);
    if (!u) throw new HttpError(404, "User tidak ditemukan", "NOT_FOUND");
    if (role !== undefined) u.role = role;
    if (banned !== undefined) { u.banned = !!banned; if (banned) u.tv = (u.tv || 0) + 1; }
    out = u;
  }, "chore(db): admin update user");
  res.json({ status: true, data: publicUser(out) });
}));

module.exports = { router, identify, HttpError };
