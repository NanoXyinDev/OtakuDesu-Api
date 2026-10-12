/* Halaman utama: demo langsung + contoh langkah */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const form = $("#demoForm");
  const input = $("#demoQ");
  const go = $("#demoGo");
  const body = $("#demoBody");
  const status = $("#demoStatus");
  const segBtns = document.querySelectorAll(".seg button");

  let src = "otakudesu";
  const srcBtns = document.querySelectorAll(".src-switch button");
  const pathLabel = $("#demoPath");
  const searchPath = () => (src === "samehadaku" ? "/api/samehadaku/search?q=" : "/api/search?q=");
  srcBtns.forEach((b) =>
    b.addEventListener("click", () => {
      src = b.dataset.src;
      srcBtns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      pathLabel.textContent = searchPath();
      if (input.value.trim()) run(input.value);
    })
  );

  let view = "cards";
  let last = null;
  let firstRun = true;

  function setView(v) {
    view = v;
    segBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === v)));
    render();
  }

  function message(title, text, isErr) {
    const hint = isErr && /Diblokir|Cloudflare|diblokir|dijangkau/.test(text) ? '<small>Ini blokir dari situs sumber, bukan galat di API. Lihat <a href="/docs#grup-sistem">dokumentasi</a> atau README bagian SOURCE_BLOCKED.</small>' : "";
    body.innerHTML = '<div class="empty' + (isErr ? " err" : "") + '"><strong>' + K.esc(title) + "</strong>" + K.esc(text) + hint + "</div>";
  }

  function renderMeta() {
    if (!last) return;
    const cls = last.ok ? "ok" : "err";
    const label = last.status ? last.status : "Gagal";
    status.innerHTML =
      '<span class="status-pill ' + cls + '">' + label + "</span> " + last.ms + " ms" +
      (last.ok ? ' <span class="dim">cache ' + K.esc(last.cache) + "</span>" : "");
  }

  function render() {
    if (!last) return;
    renderMeta();
    if (view === "json") {
      body.replaceChildren(K.codeBlock([{ label: "Respons", text: K.pretty(last) || "(kosong)", kind: "json" }]));
      return;
    }
    const q = input.value.trim();
    if (!last.ok || !last.json || last.json.status === false) {
      const msg = (last.json && last.json.message) || last.error || "Server mengembalikan respons yang tidak terduga.";
      message("Permintaan gagal", msg, true);
      return;
    }
    const d = last.json.data;
    const list = Array.isArray(d) ? d : d && Array.isArray(d.list) ? d.list : [];
    if (!list.length) {
      message("Tidak ada hasil", "Tidak ada anime yang cocok dengan “" + q + "”. Coba kata kunci lain.");
      return;
    }
    const ul = document.createElement("ul");
    ul.className = "results" + (firstRun ? " first-run" : "");
    list.slice(0, 12).forEach((a, i) => {
      const li = document.createElement("li");
      li.className = "result";
      li.style.setProperty("--i", i);
      const tags = [a.type, a.status, Array.isArray(a.genres) ? a.genres.slice(0, 2).join(", ") : a.genres].filter(Boolean).map((t) => '<span class="tag">' + K.esc(t.length > 38 ? t.slice(0, 36) + "…" : t) + "</span>").join("");
      const rt = a.rating || a.score;
      const rate = rt ? '<span class="tag rate">★ ' + K.esc(rt) + "</span>" : "";
      li.innerHTML =
        '<img alt="" loading="lazy" referrerpolicy="no-referrer" src="' + K.esc(a.poster || "") + '">' +
        "<div><h3>" + K.esc(a.title) + "</h3><p><code>" + K.esc(a.slug) + "</code></p>" +
        '<div class="tags">' + rate + tags + "</div></div>";
      li.querySelector("img").addEventListener("error", (e) => (e.target.style.visibility = "hidden"));
      ul.appendChild(li);
    });
    body.replaceChildren(ul);
    firstRun = false;
  }

  async function run(q) {
    q = (q || "").trim();
    if (!q) {
      last = null;
      status.textContent = "Isi kata kunci dulu.";
      message("Kata kunci kosong", "Ketik judul anime, lalu tekan Kirim.");
      input.focus();
      return;
    }
    go.disabled = true;
    status.textContent = "Mengirim request…";
    last = await K.request(searchPath() + encodeURIComponent(q));
    go.disabled = false;
    render();
  }

  form.addEventListener("submit", (e) => { e.preventDefault(); run(input.value); });
  segBtns.forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
  document.querySelectorAll(".chip").forEach((c) =>
    c.addEventListener("click", () => { input.value = c.textContent; run(c.textContent); })
  );

  /* ---------- Contoh tiga langkah ---------- */
  const B = location.origin;
  const steps = {
    1: `const res = await fetch("${B}/api/search?q=oni");
const { data } = await res.json();
const slug = data[0].slug;`,
    2: `const res = await fetch(\`${B}/api/anime/\${slug}\`);
const { data } = await res.json();
const episode = data.episodes[0].slug;
const batch = data.batch; // null jika tidak ada paket batch`,
    3: `const res = await fetch(\`${B}/api/watch/\${episode}\`);
const { data } = await res.json();
console.log(data.servers, data.downloads);`,
    4: `const res = await fetch(\`${B}/api/download/\${episode}\`);
const { data } = await res.json();

for (const item of data.downloads) {
  console.log(item.quality, item.size); // "Mp4 720p" "142.1 MB"
  for (const link of item.links) {
    console.log("  ", link.provider, link.url);
  }
}

// Mau langsung membuka satu link di tab baru?
// window.open(data.downloads[0].links[0].url, "_blank");`,
    5: `if (batch) {
  const res = await fetch(\`${B}/api/batch/\${batch}\`);
  const { data } = await res.json();
  console.log(data.title, data.downloads);
} else {
  console.log("Anime ini tidak punya paket batch");
}`,
  };

  // Bentuk data hasil unduh, sama dengan respons /api/download/{slug}
  const downloadSample = JSON.stringify(
    {
      status: true,
      data: {
        title: "Oni no Hanayome Episode 1 Subtitle Indonesia",
        downloads: [
          { quality: "Mp4 480p", size: "78.4 MB", links: [{ provider: "Pdrain", url: "https://pixeldrain.com/u/xxxxxxxx" }, { provider: "Mega", url: "https://mega.nz/file/xxxxxxxx" }] },
          { quality: "Mp4 720p", size: "142.1 MB", links: [{ provider: "Pdrain", url: "https://pixeldrain.com/u/yyyyyyyy" }] },
        ],
      },
    },
    null,
    2
  );

  Object.keys(steps).forEach((n) => {
    const host = document.querySelector('[data-step="' + n + '"]');
    if (!host) return;
    const tabs = [{ label: "JavaScript", text: steps[n], kind: "code" }];
    if (n === "4") tabs.push({ label: "Hasil", text: downloadSample, kind: "json" });
    host.appendChild(K.codeBlock(tabs));
  });

  run(input.value);
})();

/* Lencana status server di hero */
(function () {
  var el = document.getElementById("srcStatus");
  if (!el || !window.fetch) return;
  fetch("/health").then(function (r) { return r.json(); }).then(function (d) {
    var how = d.gateway ? "gateway aktif" : d.proxies ? d.proxies + " proxy" : "tanpa proxy";
    el.textContent = "2 sumber · " + how;
  }).catch(function () { el.classList.add("off"); el.textContent = "server tidak merespons"; });
})();
