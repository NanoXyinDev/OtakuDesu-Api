/* Halaman akun: masuk, daftar, OAuth, dashboard, API key, panel admin */
(function () {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => K.esc(String(s == null ? "" : s));
  const flash = $("#flash");
  let mode = "login";

  function say(msg, ok) {
    flash.hidden = !msg;
    flash.textContent = msg || "";
    flash.className = "flash" + (ok ? " ok" : "");
    if (msg) flash.scrollIntoView({ block: "nearest" });
  }
  async function api(path, opts) {
    const r = await fetch(path, { credentials: "same-origin", ...opts, headers: { "Content-Type": "application/json", ...((opts && opts.headers) || {}) } });
    let j = null;
    try { j = await r.json(); } catch (e) { /* bukan JSON */ }
    if (!r.ok || (j && j.status === false)) throw new Error((j && j.message) || "Permintaan gagal (HTTP " + r.status + ")");
    return j;
  }
  const fmt = (n) => (n == null ? "Tanpa batas" : Number(n).toLocaleString("id-ID"));

  /* ---------- Tampilan masuk / daftar ---------- */
  function setMode(m) {
    mode = m;
    document.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.mode === m)));
    document.querySelectorAll("[data-only='register']").forEach((e) => (e.hidden = m !== "register"));
    $("#authGo").textContent = m === "login" ? "Masuk" : "Buat akun";
    $("#fPass").autocomplete = m === "login" ? "current-password" : "new-password";
    say("");
  }
  document.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));

  $("#authForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#authGo");
    btn.disabled = true;
    try {
      const body = { email: $("#fEmail").value, password: $("#fPass").value, name: $("#fName").value };
      const r = await api(mode === "login" ? "/auth/login" : "/auth/register", { method: "POST", body: JSON.stringify(body) });
      await showDash(r.data.api_key);
    } catch (err) { say(err.message); }
    btn.disabled = false;
  });

  async function loadSide() {
    try {
      const [roles, prov] = await Promise.all([api("/auth/roles"), api("/auth/providers")]);
      $("#rolesTable tbody").innerHTML = Object.entries(roles.data)
        .map(([k, v]) => `<tr><td><strong>${esc(v.label)}</strong><br><code>${esc(k)}</code></td><td>${fmt(v.rpm)}</td><td>${fmt(v.daily)}</td></tr>`).join("");
      [["google", "#oGoogle"], ["github", "#oGithub"]].forEach(([p, sel]) => {
        if (!prov.data[p]) { const a = $(sel); a.setAttribute("aria-disabled", "true"); a.removeAttribute("href"); a.title = "Belum dikonfigurasi di server"; a.classList.add("off"); }
      });
    } catch (e) { /* biarkan tabel kosong */ }
  }

  /* ---------- Dashboard ---------- */
  function keyExample(key) {
    const k = key || "KEY_KAMU";
    $("#keyExample").replaceChildren(K.codeBlock([{ label: "cURL", kind: "code", text: `curl -H "X-API-Key: ${k}" \\\n  "${location.origin}/api/samehadaku/latest"` }]));
  }

  async function showDash(freshKey) {
    const r = await api("/auth/me");
    const d = r.data, u = d.user;
    $("#authView").hidden = true;
    $("#dashView").hidden = false;
    document.querySelectorAll("[data-account]").forEach((a) => (a.textContent = "Akun"));
    $("#dHello").textContent = "Halo, " + (u.name || u.email);
    $("#dMail").textContent = u.email + (u.providers.length ? " · terhubung: " + u.providers.join(", ") : "");
    $("#sRole").textContent = u.role;
    $("#sRpm").textContent = fmt(d.limits.rpm);
    $("#sUsed").textContent = fmt(d.usage_today) + (d.limits.daily ? " / " + fmt(d.limits.daily) : "");
    $("#sBar").style.width = d.limits.daily ? Math.min(100, (d.usage_today / d.limits.daily) * 100) + "%" : "0%";
    showKey(freshKey, u.api_key_prefix);
    if (u.role === "admin") loadAdmin();
    if (freshKey) say("Berhasil. Simpan API key kamu sekarang, tidak akan ditampilkan lagi.", true);
  }
  function showKey(key, prefix) {
    $("#keyShow").textContent = key || (prefix ? prefix + "••••••••••••••••••" : "–");
    $("#keyCopy").hidden = !key;
    keyExample(key);
  }
  $("#keyCopy").addEventListener("click", (e) => K.copyText($("#keyShow").textContent, e.currentTarget));
  $("#keyNew").addEventListener("click", async () => {
    if (!confirm("Buat key baru? Key lama langsung berhenti berlaku.")) return;
    try { const r = await api("/auth/apikey/regenerate", { method: "POST", body: "{}" }); showKey(r.data.api_key); say("Key baru dibuat. Salin sekarang.", true); } catch (e) { say(e.message); }
  });
  $("#logout").addEventListener("click", async () => {
    await fetch("/auth/logout", { method: "POST", credentials: "same-origin" });
    location.href = "/account";
  });

  /* ---------- Admin ---------- */
  async function loadAdmin() {
    try {
      const [users, roles] = await Promise.all([api("/auth/admin/users"), api("/auth/roles")]);
      const names = Object.keys(roles.data).filter((r) => r !== "guest");
      $("#adminBox").hidden = false;
      $("#usersTable tbody").innerHTML = users.data.map((u) =>
        `<tr data-id="${esc(u.id)}"><td>${esc(u.email)}<br><small class="where">${esc(u.name)} · ${esc(u.providers.join(", ") || "password")}</small></td>` +
        `<td><select data-role>${names.map((n) => `<option${n === u.role ? " selected" : ""}>${esc(n)}</option>`).join("")}</select></td>` +
        `<td>${fmt(u.usage || 0)}</td><td><input type="checkbox" data-ban aria-label="Blokir ${esc(u.email)}"${u.banned ? " checked" : ""}></td></tr>`).join("");
    } catch (e) { say(e.message); }
  }
  $("#usersTable").addEventListener("change", async (e) => {
    const tr = e.target.closest("tr");
    if (!tr) return;
    const body = e.target.matches("[data-role]") ? { role: e.target.value } : { banned: e.target.checked };
    try { await api("/auth/admin/users/" + tr.dataset.id, { method: "PATCH", body: JSON.stringify(body) }); say("Tersimpan.", true); }
    catch (err) { say(err.message); loadAdmin(); }
  });

  /* ---------- Mulai ---------- */
  (async function init() {
    const err = new URLSearchParams(location.search).get("error");
    if (err) { say(err); history.replaceState(null, "", "/account"); }
    try { await showDash(); }
    catch (e) { $("#authView").hidden = false; loadSide(); setMode("login"); }
  })();
})();
