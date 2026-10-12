/* Halaman dokumentasi: dirender dari endpoints.js */
(function () {
  const D = window.KITSUNE_DOCS;
  const BASE = location.origin;
  const $ = (s, r) => (r || document).querySelector(s);
  const h = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };

  /* ---------- Pengantar ---------- */
  $("#copyBase").addEventListener("click", (e) => K.copyText(BASE, e.currentTarget));

  $("#formatCode").appendChild(
    K.codeBlock([
      { label: "Sukses", kind: "json", text: JSON.stringify({ status: true, data: "…" }, null, 2) },
      { label: "Gagal", kind: "json", text: JSON.stringify({ status: false, message: "Parameter ?q= wajib diisi" }, null, 2) },
    ])
  );

  const errBody = $("#errorTable tbody");
  D.errors.forEach((e) => errBody.appendChild(h(`<tr><td><code>${e.code}</code></td><td>${K.esc(e.text)}</td></tr>`)));

  /* ---------- Util endpoint ---------- */
  const withBase = (obj) => JSON.parse(JSON.stringify(obj).split("{{BASE}}").join(BASE));

  function pathWith(ep, values) {
    let path = ep.path;
    const query = [];
    ep.params.forEach((p) => {
      const v = values[p.name];
      if (p.in === "path") path = path.replace("{" + p.name + "}", v ? encodeURIComponent(v) : "{" + p.name + "}");
      else if (v) query.push(encodeURIComponent(p.name) + "=" + encodeURIComponent(v));
    });
    return path + (query.length ? "?" + query.join("&") : "");
  }

  function exampleValues(ep) {
    const v = {};
    ep.params.forEach((p) => {
      if (p.required || (p.example && p.example !== p.default)) v[p.name] = p.example || "";
    });
    return v;
  }

  function samples(ep) {
    const url = BASE + pathWith(ep, exampleValues(ep));
    const key = ep.plain ? "" : '["data"]';
    return [
      { label: "cURL", kind: "code", text: `curl "${url}"` },
      { label: "JavaScript", kind: "code", text: `const res = await fetch("${url}");\nconst json = await res.json();\nconsole.log(${ep.plain ? "json" : "json.data"});` },
      { label: "Python", kind: "code", text: `import requests\n\nres = requests.get("${url}")\nprint(res.json()${key})` },
    ];
  }

  /* ---------- Render endpoint ---------- */
  function paramsTable(ep) {
    if (!ep.params.length) return '<p class="no-params">Tidak ada parameter.</p>';
    const rows = ep.params.map((p) => `
      <tr>
        <td><code>${p.name}</code>${p.required ? '<span class="req">wajib</span>' : '<span class="opt">opsional</span>'}</td>
        <td><span class="where">${p.in === "path" ? "path" : "query"}</span><br><span class="where">${p.type}${p.default ? ", bawaan " + p.default : ""}</span></td>
        <td>${K.esc(p.desc)}${p.example ? ` Contoh: <code>${K.esc(p.example.length > 28 ? p.example.slice(0, 26) + "…" : p.example)}</code>` : ""}</td>
      </tr>`).join("");
    return `<table class="params"><thead><tr><th>Nama</th><th>Lokasi</th><th>Keterangan</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function tryPanel(ep) {
    const det = h(`<details class="try"><summary>Coba langsung</summary></details>`);
    const form = h(`<form class="try-form" autocomplete="off"></form>`);
    ep.params.forEach((p) => {
      const id = `f-${ep.id}-${p.name}`;
      const f = h(`<div class="field"><label for="${id}">${p.name}${p.required ? " (wajib)" : ""}</label><input id="${id}" name="${p.name}" spellcheck="false" placeholder="${K.esc(p.default || p.example || "")}" value="${K.esc(p.required ? p.example || "" : "")}"></div>`);
      form.appendChild(f);
    });
    const actions = h(`<div class="try-actions"><button class="btn btn-primary btn-sm" type="submit">Kirim request</button><span class="try-url"></span></div>`);
    form.appendChild(actions);
    const out = h(`<div class="try-out" aria-live="polite"></div>`);
    const urlEl = $(".try-url", actions);
    const sync = () => {
      const vals = {};
      new FormData(form).forEach((v, k) => (vals[k] = String(v).trim()));
      urlEl.textContent = pathWith(ep, vals);
      return vals;
    };
    form.addEventListener("input", sync);
    sync();

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const vals = sync();
      const missing = ep.params.find((p) => p.required && !vals[p.name]);
      if (missing) {
        out.innerHTML = `<p class="no-params">Isi parameter <code>${missing.name}</code> dulu.</p>`;
        return;
      }
      const btn = $("button", actions);
      btn.disabled = true;
      out.innerHTML = '<p class="no-params">Mengirim request…</p>';
      const r = await K.request(pathWith(ep, vals));
      btn.disabled = false;
      const msg = r.error || (r.json && r.json.message);
      out.replaceChildren(
        h(`<p class="demo-meta" style="padding-inline:0"><span><span class="status-pill ${r.ok ? "ok" : "err"}">${r.status || "Gagal"}</span> ${r.ms} ms${r.ok ? ' <span class="dim">cache ' + K.esc(r.cache) + "</span>" : ""}</span></p>`),
        K.codeBlock([{ label: "Respons", kind: "json", text: K.pretty(r) || msg || "(kosong)" }])
      );
    });

    det.append(form, out);
    return det;
  }

  function endpointArticle(ep) {
    const art = h(`<article class="ep-article" id="${ep.id}"></article>`);
    art.appendChild(h(`<div class="ep-head"><h3>${K.esc(ep.title)}</h3><p>${K.esc(ep.desc)}</p></div>`));
    const pathHtml = K.esc(ep.path).replace(/\{(\w+)\}/g, '<span class="p">{$1}</span>');
    art.appendChild(h(`<div class="reqline"><span class="verb">GET</span><code>${pathHtml}</code></div>`));

    const body = h(`<div class="ep-body"></div>`);
    body.appendChild(h(`<div><h4>Parameter</h4>${paramsTable(ep)}</div>`));
    if (ep.notes && ep.notes.length) body.appendChild(h(`<ul class="notes">${ep.notes.map((n) => `<li>${K.esc(n)}</li>`).join("")}</ul>`));
    if (ep.errors && ep.errors.length) {
      body.appendChild(h(`<div><h4>Kemungkinan galat</h4><ul class="notes">${ep.errors.map((e) => `<li><code>${e.code}</code> ${K.esc(e.text)}</li>`).join("")}</ul></div>`));
    }
    const req = h(`<div><h4>Contoh request</h4></div>`);
    req.appendChild(K.codeBlock(samples(ep)));
    body.appendChild(req);
    const resp = h(`<div><h4>Contoh respons</h4></div>`);
    resp.appendChild(K.codeBlock([{ label: "200 OK", kind: "json", text: JSON.stringify(withBase(ep.response), null, 2) }]));
    body.appendChild(resp);
    body.appendChild(tryPanel(ep));
    art.appendChild(body);
    return art;
  }

  /* ---------- Susun halaman + sidebar ---------- */
  const host = $("#endpoints");
  const nav = $("#sideNav");

  const intro = [
    { id: "pengantar", label: "Mulai" },
    { id: "format", label: "Format respons" },
    { id: "error", label: "Kode status" },
    { id: "cache", label: "Cache dan header" },
    { id: "konfigurasi", label: "Konfigurasi server" },
  ];
  const sideGroups = [{ title: "Pengantar", items: intro.map((i) => ({ id: i.id, label: i.label })) }];

  /* Dikelompokkan per sumber: Otakudesu, Samehadaku, Gabungan, lalu Sistem */
  const SRC = D.sources;
  const order = ["otakudesu", "samehadaku", "gabungan", "sistem"];
  const srcOf = (g) => g.source || "sistem";
  const badge = (s, title) => (SRC[s] && SRC[s].title !== title ? `<span class="src-badge src-${s}">${K.esc(SRC[s].title)}</span>` : "");

  [...D.groups].sort((x, y) => order.indexOf(srcOf(x)) - order.indexOf(srcOf(y))).forEach((g) => {
    const eps = D.endpoints.filter((e) => e.group === g.id);
    if (!eps.length) return;
    const src = srcOf(g);
    const sec = h(`<section id="grup-${g.id}" data-source="${src}"><h2 class="group src-bar src-${src}">${K.esc(g.title)} ${badge(src, g.title)}</h2><p class="group-blurb">${K.esc(g.blurb)}</p></section>`);
    eps.forEach((ep) => sec.appendChild(endpointArticle(ep)));
    host.appendChild(sec);
    sideGroups.push({ title: g.title, source: src, items: eps.map((e) => ({ id: e.id, label: e.title, path: e.path })) });
  });

  let lastSrc = null;
  sideGroups.forEach((g) => {
    if (g.source && g.source !== lastSrc && SRC[g.source]) {
      nav.appendChild(h(`<div class="side-src src-${g.source}" data-source="${g.source}">${K.esc(SRC[g.source].title)}<small>${K.esc(SRC[g.source].prefix)}</small></div>`));
    }
    lastSrc = g.source || lastSrc;
    const wrap = h(`<div class="side-group"${g.source ? ` data-source="${g.source}"` : ""}><h2>${K.esc(g.title)}</h2><ul></ul></div>`);
    const ul = $("ul", wrap);
    g.items.forEach((i) => {
      ul.appendChild(h(`<li data-key="${K.esc((i.label + " " + (i.path || "")).toLowerCase())}"><a href="#${i.id}">${K.esc(i.label)}</a></li>`));
    });
    nav.appendChild(wrap);
  });
  const none = h(`<p class="none" hidden>Tidak ada endpoint yang cocok.</p>`);
  nav.appendChild(none);

  /* Filter: kata kunci + sumber (?source=samehadaku juga bisa dari URL) */
  let srcSel = new URLSearchParams(location.search).get("source") || "all";
  if (!["all", "otakudesu", "samehadaku", "gabungan"].includes(srcSel)) srcSel = "all";
  let query = "";
  function refilter() {
    let shown = 0;
    nav.querySelectorAll(".side-group").forEach((g) => {
      const srcOk = srcSel === "all" || !g.dataset.source || g.dataset.source === srcSel;
      let any = 0;
      g.querySelectorAll("li").forEach((li) => {
        const ok = srcOk && (!query || li.dataset.key.includes(query));
        li.hidden = !ok;
        if (ok) any++;
      });
      g.hidden = !any;
      shown += any;
    });
    nav.querySelectorAll(".side-src").forEach((s) => (s.hidden = srcSel !== "all" && s.dataset.source !== srcSel));
    host.querySelectorAll("section[data-source]").forEach((s) => (s.hidden = srcSel !== "all" && s.dataset.source !== srcSel));
    document.querySelectorAll(".src-filter button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.src === srcSel)));
    none.hidden = shown > 0;
  }
  $("#filter").addEventListener("input", (e) => { query = e.target.value.trim().toLowerCase(); refilter(); });
  document.querySelectorAll(".src-filter button").forEach((b) => b.addEventListener("click", () => { srcSel = b.dataset.src; refilter(); }));
  refilter();

  /* Tutup menu seluler setelah memilih */
  nav.addEventListener("click", (e) => {
    if (e.target.closest("a") && document.body.classList.contains("nav-open")) $("[data-menu-toggle]").click();
  });

  /* Tandai bagian aktif */
  const links = new Map([...nav.querySelectorAll("a")].map((a) => [a.getAttribute("href").slice(1), a]));
  const targets = [...links.keys()].map((id) => document.getElementById(id)).filter(Boolean);
  if ("IntersectionObserver" in window) {
    const visible = new Set();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => (en.isIntersecting ? visible.add(en.target.id) : visible.delete(en.target.id)));
        const first = targets.find((t) => visible.has(t.id)); // yang paling atas di halaman
        if (!first) return;
        links.forEach((a) => a.classList.remove("active"));
        const a = links.get(first.id);
        if (a) a.classList.add("active");
      },
      { rootMargin: "-80px 0px -65% 0px" }
    );
    targets.forEach((t) => io.observe(t));
  }

  /* ?q= dari halaman 404 mengisi kotak cari */
  const pre = new URLSearchParams(location.search).get("q");
  if (pre) { const f = $("#filter"); f.value = pre; f.dispatchEvent(new Event("input")); }

  /* Buka panel "coba langsung" kalau tautan langsung menuju endpoint */
  if (location.hash) {
    const el = document.getElementById(location.hash.slice(1));
    if (el) setTimeout(() => el.scrollIntoView(), 0);
  }
})();
