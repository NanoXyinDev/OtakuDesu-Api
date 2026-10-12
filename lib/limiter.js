/* Pembatas request per peran: per menit (memori) dan per hari (memori + disimpan berkala ke database).
   Catatan: di serverless tiap instance punya penghitung sendiri, jadi batas bersifat perkiraan.
   Untuk batas ketat lintas instance, simpan penghitung di Redis. */
const db = require("./db");
const { identify } = require("./auth");
const { limitsFor } = require("./roles");

const REQUIRE_AUTH = process.env.REQUIRE_AUTH === "true";
const FLUSH_MS = (parseInt(process.env.USAGE_FLUSH_SEC) || 600) * 1000;
const day = () => new Date().toISOString().slice(0, 10);

const minute = new Map(); // id -> {win, n}
const daily = new Map(); // id -> {day, n, user}
const dirty = new Set();
let timer = null;

const usedToday = (id) => { const d = daily.get(id); return d && d.day === day() ? d.n : null; };

function scheduleFlush() {
  if (timer || !dirty.size) return;
  timer = setTimeout(async () => {
    timer = null;
    const ids = [...dirty]; dirty.clear();
    try {
      await db.update((data) => {
        const d = day();
        for (const id of ids) {
          const cur = daily.get(id);
          if (!cur) continue;
          const u = (data.usage[id] = data.usage[id] || {});
          u[d] = Math.max(u[d] || 0, cur.n);
          Object.keys(u).sort().slice(0, -31).forEach((k) => delete u[k]); // simpan 31 hari
        }
      }, "chore(db): usage");
    } catch (e) { ids.forEach((i) => dirty.add(i)); }
  }, FLUSH_MS);
  timer.unref();
}

async function middleware(req, res, next) {
  let who = { user: null, via: "guest" };
  try { who = await identify(req); }
  catch (e) {
    if (e.status) return res.status(e.status).json({ status: false, code: e.code, message: e.message });
    res.set("X-Auth-Degraded", "1"); // database akun bermasalah: layani sebagai tamu
  }
  const u = who.user;
  if (u && u.banned) return res.status(403).json({ status: false, code: "BANNED", message: "Akun diblokir" });
  if (!u && REQUIRE_AUTH) return res.status(401).json({ status: false, code: "UNAUTHORIZED", message: "Endpoint ini butuh login atau API key. Daftar di /account" });

  const id = u ? u.id : "ip:" + req.ip;
  const role = u ? u.role : "guest";
  const lim = limitsFor(role);
  const now = Date.now(), win = Math.floor(now / 60000), d = day();

  let m = minute.get(id);
  if (!m || m.win !== win) { m = { win, n: 0 }; minute.set(id, m); }
  let q = daily.get(id);
  if (!q || q.day !== d) {
    let seed = 0;
    if (u) { try { seed = ((await db.read()).usage[id] || {})[d] || 0; } catch {} }
    q = { day: d, n: seed }; daily.set(id, q);
  }
  if (minute.size > 10000) for (const [k, v] of minute) if (v.win !== win) minute.delete(k);
  if (daily.size > 10000) for (const [k, v] of daily) if (v.day !== d) daily.delete(k);

  const head = (remaining, limit, reset) => {
    res.set("X-RateLimit-Limit", Number.isFinite(limit) ? String(limit) : "unlimited");
    res.set("X-RateLimit-Remaining", Number.isFinite(remaining) ? String(Math.max(0, remaining)) : "unlimited");
    res.set("X-RateLimit-Reset", String(reset));
    res.set("X-RateLimit-Role", role);
  };
  const reset = Math.ceil(((win + 1) * 60000 - now) / 1000);
  if (m.n >= lim.rpm) {
    head(0, lim.rpm, reset); res.set("Retry-After", String(reset));
    return res.status(429).json({ status: false, code: "RATE_LIMITED", message: `Batas ${lim.rpm} request/menit untuk peran "${role}" tercapai. Coba lagi dalam ${reset} detik.`, upgrade: "/account" });
  }
  if (q.n >= lim.daily) {
    const toMidnight = Math.ceil((Date.parse(d + "T00:00:00Z") + 86400000 - now) / 1000);
    head(0, lim.daily, toMidnight); res.set("Retry-After", String(toMidnight));
    return res.status(429).json({ status: false, code: "DAILY_QUOTA", message: `Kuota harian ${lim.daily} request untuk peran "${role}" habis (reset 00:00 UTC).`, upgrade: "/account" });
  }
  m.n++; q.n++;
  head(lim.rpm - m.n, lim.rpm, reset);
  if (u) { dirty.add(id); scheduleFlush(); }
  req.actor = { id, role, user: u };
  next();
}

module.exports = { middleware, usedToday };
