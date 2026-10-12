/* Penjelajah endpoint per sumber (data dari endpoints.js) + cek status sumber */
(function () {
  const D = window.KITSUNE_DOCS;
  if (!D) return;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => K.esc(String(s == null ? "" : s));
  const inSource = (src) => D.endpoints.filter((e) => {
    const g = D.groups.find((x) => x.id === e.group);
    return g && g.source === src;
  });
  const groupTitle = (e) => (D.groups.find((g) => g.id === e.group) || {}).title || "";
  let current = "otakudesu";

  function show(src) {
    current = src;
    const meta = D.sources[src];
    document.querySelectorAll(".ex-tab").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.src === src)));
    $("#exTitle").textContent = meta.title;
    $("#exBlurb").textContent = meta.blurb;
    $("#exBase").textContent = meta.prefix + "/…";
    $("#exDocs").href = "/docs?source=" + src;
    const eps = inSource(src);
    // kelompokkan per grup, urutan sesuai definisi
    const groups = [];
    eps.forEach((e) => {
      let g = groups.find((x) => x.id === e.group);
      if (!g) groups.push((g = { id: e.group, title: groupTitle(e), items: [] }));
      g.items.push(e);
    });
    $("#exGrid").innerHTML = groups.map((g) =>
      (groups.length > 1 ? `<h4 class="ex-group">${esc(g.title)}</h4>` : "") +
      g.items.map((e) =>
        `<a class="ex-card src-${src}" href="/docs#${esc(e.id)}"><span class="verb">GET</span><code>${esc(e.path)}</code><strong>${esc(e.title)}</strong><span>${esc(e.desc.length > 92 ? e.desc.slice(0, 90) + "…" : e.desc)}</span></a>`
      ).join("")
    ).join("");
  }

  // jumlah endpoint di tiap tab
  Object.keys(D.sources).forEach((s) => {
    const t = document.querySelector(`.ex-tab[data-src="${s}"] .ex-count`);
    if (t) t.textContent = inSource(s).length;
  });
  document.querySelectorAll(".ex-tab").forEach((t) => t.addEventListener("click", () => show(t.dataset.src)));
  show(current);

  /* Cek status sumber (hasil di-cache server 5 menit) */
  const btn = $("#probe"), note = $("#exNote");
  btn.addEventListener("click", async () => {
    btn.disabled = true; btn.textContent = "Mengecek…";
    note.hidden = true;
    try {
      const r = await (await fetch("/api/status")).json();
      const d = r.data, bad = [];
      ["otakudesu", "samehadaku"].forEach((s) => {
        const el = document.querySelector(`[data-state="${s}"]`);
        el.textContent = d[s].ok ? "online" : "diblokir";
        el.className = "ex-state " + (d[s].ok ? "ok" : "err");
        if (!d[s].ok) bad.push(D.sources[s].title + ": " + d[s].message);
      });
      note.hidden = false;
      note.className = "ex-note " + (bad.length ? "err" : "ok");
      note.innerHTML = bad.length
        ? "<strong>Sumber bermasalah.</strong> " + bad.map(esc).join("<br>") + '<br><small>Ini blokir dari situs sumber (Cloudflare), bukan galat di API. Pasang <code>FETCH_GATEWAY</code> atau <code>PROXY_LIST</code> di server.</small>'
        : "<strong>Semua sumber online.</strong> Dicek " + new Date(r.checked_at).toLocaleTimeString("id-ID") + ".";
    } catch (e) {
      note.hidden = false; note.className = "ex-note err"; note.textContent = "Tidak bisa menghubungi server API.";
    }
    btn.disabled = false; btn.textContent = "Cek status sumber";
  });
})();
