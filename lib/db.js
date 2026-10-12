/* Database JSON: disimpan di repo GitHub (database/data.json) lewat Contents API.
   Tanpa GITHUB_TOKEN dipakai file lokal (untuk pengembangan; di Vercel filesystem read-only).
   Baca dari snapshot memori (TTL pendek). Tulis selalu: baca terbaru -> ubah -> PUT dengan sha,
   ulangi kalau bentrok (409/422), dan diserialkan per proses. */
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const REPO = process.env.GH_DB_REPO || "NanoXyinDev/OtakuDesu-Api";
const FILE = process.env.GH_DB_PATH || "database/data.json";
const BRANCH = process.env.GH_DB_BRANCH || ""; // kosong = branch default repo
const TOKEN = process.env.GITHUB_TOKEN || "";
const API = (process.env.GITHUB_API || "https://api.github.com").replace(/\/$/, "");
const SNAP_TTL = (parseInt(process.env.DB_SNAPSHOT_TTL) || 30) * 1000;
const LOCAL = path.join(__dirname, "..", "database", "data.json");

const EMPTY = () => ({ users: [], usage: {} });
let snap = null; // { data, sha, at }
let queue = Promise.resolve();

const mode = TOKEN ? "github" : "file";
const gh = () => ({
  headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "kitsune-api" },
  timeout: 10000,
  validateStatus: () => true,
});
const url = () => `${API}/repos/${REPO}/contents/${FILE}`;

async function readRemote() {
  if (mode === "file") {
    try { return { data: JSON.parse(fs.readFileSync(LOCAL, "utf8")), sha: null }; } catch { return { data: EMPTY(), sha: null }; }
  }
  const r = await axios.get(url() + (BRANCH ? `?ref=${BRANCH}` : ""), gh());
  if (r.status === 404) return { data: EMPTY(), sha: null }; // file belum ada: dibuat saat tulis pertama
  if (r.status !== 200) throw new Error(`GitHub DB gagal dibaca (HTTP ${r.status}): ${r.data && r.data.message}`);
  const text = Buffer.from(r.data.content || "", "base64").toString("utf8");
  let data;
  try { data = text.trim() ? JSON.parse(text) : EMPTY(); } catch { throw new Error("database/data.json bukan JSON yang valid"); }
  data.users = data.users || [];
  data.usage = data.usage || {};
  return { data, sha: r.data.sha };
}

async function writeRemote(data, sha, message) {
  if (mode === "file") {
    fs.mkdirSync(path.dirname(LOCAL), { recursive: true });
    fs.writeFileSync(LOCAL, JSON.stringify(data, null, 2));
    return { ok: true, sha: null };
  }
  const body = { message, content: Buffer.from(JSON.stringify(data, null, 2)).toString("base64"), ...(sha ? { sha } : {}), ...(BRANCH ? { branch: BRANCH } : {}) };
  const r = await axios.put(url(), body, gh());
  if (r.status === 200 || r.status === 201) return { ok: true, sha: r.data.content.sha };
  if (r.status === 409 || r.status === 422) return { ok: false, conflict: true };
  throw new Error(`GitHub DB gagal ditulis (HTTP ${r.status}): ${r.data && r.data.message}`);
}

/* Baca snapshot (cache pendek) */
async function read(force = false) {
  if (!force && snap && Date.now() - snap.at < SNAP_TTL) return snap.data;
  const { data, sha } = await readRemote();
  snap = { data, sha, at: Date.now() };
  return data;
}

/* Ubah data secara atomik: fn(data) boleh mengubah langsung atau mengembalikan data baru. */
function update(fn, message = "chore(db): update") {
  const run = async () => {
    for (let i = 0; i < 4; i++) {
      const { data, sha } = await readRemote();
      const next = (await fn(data)) || data;
      const w = await writeRemote(next, sha, message);
      if (w.ok) { snap = { data: next, sha: w.sha, at: Date.now() }; return next; }
    }
    throw new Error("Database sibuk (bentrok tulis berulang), coba lagi");
  };
  const p = queue.then(run, run);
  queue = p.catch(() => {});
  return p;
}

module.exports = { read, update, mode, repo: REPO, file: FILE };
