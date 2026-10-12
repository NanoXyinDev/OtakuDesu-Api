// Ambil proxy publik dari GitHub, uji ke situs sumber, simpan yang lolos ke proxies.txt
// Pakai:  node scripts/fetch-proxies.js [maks_uji=400] [maks_simpan=20]
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { HttpsProxyAgent } = require("https-proxy-agent");

const LISTS = [
  "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt",
  "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt",
  "https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/http/data.txt",
];
const TARGETS = [process.env.SAMEHADAKU_URL || "https://v2.samehadaku.how", process.env.BASE_URL || "https://otakudesu.blog"];
const MAX_TEST = parseInt(process.argv[2]) || 400;
const MAX_KEEP = parseInt(process.argv[3]) || 20;

async function works(proxy, url) {
  try {
    const agent = new HttpsProxyAgent(proxy);
    const r = await axios.get(url, { httpAgent: agent, httpsAgent: agent, proxy: false, timeout: 7000, validateStatus: () => true,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36" } });
    const body = String(r.data);
    return r.status === 200 && !/Just a moment|cf-chl|Attention Required/.test(body) && body.length > 2000;
  } catch { return false; }
}

(async () => {
  let all = new Set();
  for (const u of LISTS) {
    try {
      const { data } = await axios.get(u, { timeout: 15000 });
      String(data).split(/\r?\n/).map((l) => l.trim().replace(/^https?:\/\//, "")).filter((l) => /^\d+\.\d+\.\d+\.\d+:\d+$/.test(l)).forEach((l) => all.add(l));
    } catch (e) { console.log("Lewati", u, e.message); }
  }
  const pool = [...all].sort(() => Math.random() - 0.5).slice(0, MAX_TEST);
  console.log(`Total ${all.size} proxy, menguji ${pool.length} ke ${TARGETS.join(" & ")} ...`);

  const good = [];
  let i = 0, done = 0;
  async function worker() {
    while (i < pool.length && good.length < MAX_KEEP) {
      const p = pool[i++];
      const ok = (await Promise.all(TARGETS.map((t) => works("http://" + p, t)))).some(Boolean);
      if (ok) { good.push("http://" + p); console.log("OK  ", p); }
      if (++done % 50 === 0) console.log(`  ${done}/${pool.length} diuji, ${good.length} lolos`);
    }
  }
  await Promise.all(Array.from({ length: 50 }, worker));

  if (!good.length) return console.log("Tidak ada yang lolos. Proxy gratis sering diblokir Cloudflare; coba lagi nanti atau pakai proxy residential.");
  fs.writeFileSync(path.join(__dirname, "..", "proxies.txt"), "# dibuat oleh scripts/fetch-proxies.js\n" + good.join("\n") + "\n");
  console.log(`\n${good.length} proxy disimpan ke proxies.txt. Usia proxy gratis pendek: ulangi skrip ini berkala.`);
})();
