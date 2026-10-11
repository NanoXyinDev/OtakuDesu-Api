/* Halaman utama: demo langsung + contoh langkah */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const form = $("#demoForm");
  const input = $("#demoQ");
  const go = $("#demoGo");
  const body = $("#demoBody");
  const status = $("#demoStatus");
  const segBtns = document.querySelectorAll(".seg button");

  let view = "cards";
  let last = null;
  let firstRun = true;

  function setView(v) {
    view = v;
    segBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === v)));
    render();
  }

  function message(title, text) {
    body.innerHTML = '<div class="empty"><strong>' + K.esc(title) + "</strong>" + K.esc(text) + "</div>";
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
      message("Permintaan gagal", msg);
      return;
    }
    const list = Array.isArray(last.json.data) ? last.json.data : [];
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
      const tags = [a.status, a.genres].filter(Boolean).map((t) => '<span class="tag">' + K.esc(t.length > 38 ? t.slice(0, 36) + "…" : t) + "</span>").join("");
      const rate = a.rating ? '<span class="tag rate">★ ' + K.esc(a.rating) + "</span>" : "";
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
    last = await K.request("/api/search?q=" + encodeURIComponent(q));
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
const episode = data.episodes[0].slug;`,
    3: `const res = await fetch(\`${B}/api/watch/\${episode}\`);
const { data } = await res.json();
console.log(data.servers, data.downloads);`,
  };
  Object.keys(steps).forEach((n) => {
    const host = document.querySelector('[data-step="' + n + '"]');
    if (host) host.appendChild(K.codeBlock([{ label: "JavaScript", text: steps[n], kind: "code" }]));
  });

  run(input.value);
})();
