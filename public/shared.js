/* Util bersama: tema, menu, highlight, salin, request */
(function () {
  const root = document.documentElement;

  /* ---------- Tema ---------- */
  const store = {
    get() { try { return localStorage.getItem("kitsune-theme"); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem("kitsune-theme", v); } catch (e) { /* abaikan */ } },
  };
  const systemDark = () => window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
  const current = () => root.getAttribute("data-theme") || (systemDark() ? "dark" : "light");

  function paintToggle(btn) {
    const dark = current() === "dark";
    btn.setAttribute("aria-label", dark ? "Ganti ke tema terang" : "Ganti ke tema gelap");
    btn.innerHTML = dark
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  }

  function initChrome() {
    const saved = store.get();
    if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);

    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
      paintToggle(btn);
      btn.addEventListener("click", () => {
        const next = current() === "dark" ? "light" : "dark";
        root.setAttribute("data-theme", next);
        store.set(next);
        paintToggle(btn);
      });
    });

    const menu = document.querySelector("[data-menu-toggle]");
    if (menu) {
      menu.addEventListener("click", () => {
        const open = document.body.classList.toggle("nav-open");
        menu.setAttribute("aria-expanded", String(open));
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && document.body.classList.contains("nav-open")) menu.click();
      });
    }

    document.querySelectorAll("[data-base]").forEach((el) => (el.textContent = location.origin));
  }

  /* ---------- Highlight ---------- */
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

  function hlJSON(text) {
    return esc(text).replace(
      /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
      (m, s, colon, b) => {
        if (s) return colon ? '<span class="t-key">' + s + "</span>" + colon : '<span class="t-str">' + s + "</span>";
        if (b) return '<span class="t-bool">' + m + "</span>";
        return '<span class="t-num">' + m + "</span>";
      }
    );
  }

  function hlCode(text) {
    return esc(text).replace(/(#[^\n]*|\/\/[^\n]*)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)/g, (m, c, s) =>
      c ? '<span class="t-dim">' + c + "</span>" : '<span class="t-str">' + s + "</span>"
    );
  }

  /* ---------- Salin ---------- */
  async function copyText(text, btn) {
    const old = btn.textContent;
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "Tersalin";
    } catch (e) {
      btn.textContent = "Gagal menyalin";
    }
    setTimeout(() => (btn.textContent = old), 1400);
  }

  /* ---------- Blok kode ---------- */
  // tabs: [{label, text, kind: 'json' | 'code'}]
  function codeBlock(tabs, opts) {
    opts = opts || {};
    const wrap = document.createElement("div");
    wrap.className = "code";
    const bar = document.createElement("div");
    bar.className = "code-bar";
    const tabsEl = document.createElement("div");
    tabsEl.className = "code-tabs";
    tabsEl.setAttribute("role", "tablist");
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "copy";
    copy.textContent = "Salin";
    const pre = document.createElement("pre");
    pre.tabIndex = 0;
    const codeEl = document.createElement("code");
    pre.appendChild(codeEl);

    let active = 0;
    const buttons = tabs.map((t, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "tab");
      b.textContent = t.label;
      b.addEventListener("click", () => select(i));
      tabsEl.appendChild(b);
      return b;
    });

    function select(i) {
      active = i;
      buttons.forEach((b, j) => b.setAttribute("aria-selected", String(i === j)));
      const t = tabs[i];
      codeEl.innerHTML = t.kind === "json" ? hlJSON(t.text) : hlCode(t.text);
    }
    copy.addEventListener("click", () => copyText(tabs[active].text, copy));

    bar.append(tabsEl, copy);
    wrap.append(bar, pre);
    select(0);
    wrap.update = (newTabs) => { tabs = newTabs; select(Math.min(active, tabs.length - 1)); };
    return wrap;
  }

  /* ---------- Request ---------- */
  async function request(path) {
    const t0 = performance.now();
    try {
      const res = await fetch(path, { headers: { Accept: "application/json" } });
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch (e) { /* bukan JSON */ }
      return {
        ok: res.ok, status: res.status, ms: Math.round(performance.now() - t0),
        cache: res.headers.get("X-Cache") || "MISS", json, text,
      };
    } catch (e) {
      return { ok: false, status: 0, ms: Math.round(performance.now() - t0), error: "Tidak bisa menghubungi server. Pastikan API sedang berjalan.", json: null, text: "" };
    }
  }

  const pretty = (r) => (r.json ? JSON.stringify(r.json, null, 2) : r.text || "");

  window.K = { esc, hlJSON, hlCode, codeBlock, copyText, request, pretty, initChrome };
  document.addEventListener("DOMContentLoaded", initChrome);
})();

/* Label tautan akun di nav: "Akun" kalau sudah login */
(function () {
  document.addEventListener("DOMContentLoaded", function () {
    var links = document.querySelectorAll("[data-account]");
    if (!links.length || !window.fetch) return;
    fetch("/auth/me", { credentials: "same-origin" }).then(function (r) { if (r.ok) links.forEach(function (a) { a.textContent = "Akun"; }); }).catch(function () {});
  });
})();
