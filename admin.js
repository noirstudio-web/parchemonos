/* ParchéMonos · panel de admins
   Edita todo el contenido. Los cambios se guardan en este navegador (vista previa)
   y se publican para todos descargando site-data.js (pestaña Publicar). */
(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const lsGet = (k) => { try { const v = localStorage.getItem(k); return v == null ? null : JSON.parse(v); } catch { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { toast("⚠️ No hay espacio para guardar. Usa imágenes más livianas."); return false; } };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const debounce = (fn, ms = 400) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  const D = window.PM_DEFAULTS;
  const SD = window.SITE_DATA || {};
  const DATA = window.PM_DATA;
  const DEFAULT_PIN = "parche2026";

  // Estado editable (lo que ve la página en este navegador)
  const state = {
    texts: { ...DATA.texts },
    imgs: { ...DATA.imgs },
    plans: clone(DATA.plans),
    quiz: clone(DATA.quiz),
    stickers: clone(DATA.stickers),
    blocked: [...DATA.blocked],
    settings: { ...DATA.settings },
    members: clone(DATA.members),
    roles: clone(DATA.roles),
  };
  const KEYS = { texts: "pm_texts", imgs: "pm_imgs", plans: "pm_seed_plans", quiz: "pm_quiz", stickers: "pm_stickers", blocked: "pm_blocked_words", settings: "pm_settings", members: "pm_members", roles: "pm_roles" };
  const save = (what) => lsSet(KEYS[what], state[what]);

  /* ---------- Toast y "guardado" ---------- */
  const toastEl = $("#toast");
  let tt;
  function toast(t) { toastEl.textContent = t; toastEl.classList.add("is-on"); clearTimeout(tt); tt = setTimeout(() => toastEl.classList.remove("is-on"), 2600); }
  function flashSaved(id) { const el = $(id); if (!el) return; el.classList.add("is-on"); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("is-on"), 1400); }

  function compressImage(file, maxSide = 1400) {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }
  function pickImage(maxSide) {
    return new Promise((resolve) => {
      const inp = document.createElement("input");
      inp.type = "file";
      inp.accept = "image/*";
      inp.onchange = async () => {
        const f = inp.files?.[0];
        if (!f) return resolve(null);
        if (!f.type.startsWith("image/")) { toast("Eso no es una imagen."); return resolve(null); }
        resolve(await compressImage(f, maxSide));
      };
      inp.click();
    });
  }

  function applyLogo() {
    const logo = state.imgs.logo || "assets/logo.jpg";
    $$("img[data-logo]").forEach((i) => (i.src = logo));
  }
  applyLogo();

  /* =====================================================
     Acceso
     ===================================================== */
  async function hashPin(p) {
    const data = `pm:${p}`;
    if (window.crypto?.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
      return "s:" + [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    let h = 5381;
    for (const ch of data) h = ((h << 5) + h + ch.charCodeAt(0)) | 0;
    return "d:" + (h >>> 0).toString(16);
  }
  // contraseña cifrada con el usuario (así dos personas con la misma clave no tienen el mismo código)
  const hashPass = (user, pass) => hashPin(`${String(user).trim().toLowerCase()}:${pass}`);
  const isoToday = () => new Date().toISOString().slice(0, 10);

  /* ---------- Cuentas del panel ----------
     Jerarquía: Fundador > Co Fundador > Administrador > Moderador > Staff.
     De Administrador hacia arriba se pueden crear cuentas, siempre con un rol MENOR al propio. */
  const RANK = { fundador: 100, cofundador: 90, administrador: 80, moderador: 60, staff: 40 };
  const PANEL_ROLES = Object.keys(RANK);
  const MEMBER_RANK = { ...RANK, org: 20, miembro: 10, prueba: 5 };
  const rankOf = (roleId) => MEMBER_RANK[roleId] ?? 15; // roles creados a mano: entre miembro y organizador
  const CAN_MANAGE_ACCOUNTS = 80; // Administrador hacia arriba
  // nivel mínimo para ver cada pestaña
  const TAB_MIN = { resumen: 0, solicitudes: 40, reportes: 40, miembros: 60, recuerdos: 60, textos: 80, imagenes: 80, parches: 80, test: 80, chat: 80, ajustes: 80, publicar: 80, cuentas: CAN_MANAGE_ACCOUNTS };
  const ROLE_ACCESS = {
    fundador: "Todo el panel. Crea cuentas de Co Fundador para abajo.",
    cofundador: "Todo el panel. Crea cuentas de Administrador, Moderador y Staff.",
    administrador: "Todo el panel. Crea cuentas de Moderador y Staff.",
    moderador: "Solicitudes, reportes, miembros (roles menores al suyo) y recuerdos.",
    staff: "Solicitudes y reportes.",
  };

  const ACC_KEY = "pm_admin_accounts";
  let accounts = [];
  let current = null;
  const myRank = () => RANK[current?.role] || 0;
  const saveAccounts = () => lsSet(ACC_KEY, accounts);
  const findAcc = (user) => accounts.find((a) => a.user.toLowerCase() === String(user || "").trim().toLowerCase());

  async function loadAccounts() {
    let list = lsGet(ACC_KEY) || SD.adminAccounts || null;
    if (!list || !list.length) {
      // si ya existía la clave vieja de un solo admin, se convierte en la cuenta "admin" del Fundador
      const legacy = lsGet("pm_admin_pin_hash") || SD.adminPinHash || null;
      list = legacy ? [{ user: "admin", name: "Fundador", role: "fundador", active: true, hash: null, legacyHash: legacy, mustChange: true, createdBy: "sistema", createdAt: isoToday() }] : [];
      if (list.length) lsSet(ACC_KEY, list);
    }
    accounts = list;
  }

  /* ---------- Registro: primera vez, crear la cuenta del Fundador ---------- */
  $("#setupForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#setupErr");
    err.textContent = "";
    if (accounts.length) { location.reload(); return; } // alguien ya la creó
    const user = $("#setupUser").value.trim().toLowerCase();
    const name = $("#setupName").value.trim();
    const pass = $("#setupPass").value;
    if (!/^[a-z0-9._-]{3,24}$/.test(user)) return (err.textContent = "El usuario debe tener de 3 a 24 letras o números, sin espacios ni tildes.");
    if (name.length < 2) return (err.textContent = "Escribe tu nombre o apodo.");
    if (pass.length < 8) return (err.textContent = "La contraseña necesita mínimo 8 caracteres.");
    if (pass === DEFAULT_PIN) return (err.textContent = "Usa una contraseña diferente.");
    if (pass !== $("#setupPass2").value) return (err.textContent = "Las contraseñas no coinciden.");
    const acc = { user, name, nick: name, role: "fundador", active: true, hash: await hashPass(user, pass), mustChange: false, createdBy: "registro", createdAt: isoToday(), lastLogin: new Date().toISOString() };
    accounts = [acc];
    if (!saveAccounts()) return;
    current = acc;
    memberFromAccount(acc); // el Fundador también aparece en el grupo con su apodo y 👑
    try { sessionStorage.setItem("pm_admin_user", user); } catch { /* */ }
    $("#setupView").hidden = true;
    showAdmin();
    toast("👑 ¡Cuenta creada! Ve a 🚀 Publicar para que funcione en cualquier computador.");
  });

  async function checkLogin(user, pass) {
    const a = findAcc(user);
    if (!a || a.active === false) return null;
    if (a.hash && a.hash === (await hashPass(a.user, pass))) return a;
    if (a.legacyHash && a.legacyHash === (await hashPin(pass))) {
      // pasa la clave vieja al formato nuevo
      a.hash = await hashPass(a.user, pass);
      delete a.legacyHash;
      saveAccounts();
      return a;
    }
    return null;
  }

  const pinView = $("#pinView");
  const adminView = $("#adminView");
  function showAdmin() {
    pinView.hidden = true;
    adminView.hidden = false;
    $("#wipeBox").hidden = myRank() < RANK.cofundador;
    const r = roleById(current.role);
    $("#meUser").textContent = current.user;
    $("#meRole").innerHTML = roleChip(current.role);
    $("#meBtn").title = `${current.name} · ${r?.name || current.role}`;
    $("#defaultPassNote").hidden = !current.mustChange;
    // pestañas según el nivel
    $$(".tab").forEach((t) => (t.hidden = (TAB_MIN[t.dataset.tab] ?? 80) > myRank()));
    $$("[data-go]").forEach((b) => { const box = b.closest(".box"); if (box && (TAB_MIN[b.dataset.go] ?? 80) > myRank()) box.hidden = true; });
    // el modo "editar imágenes sobre la página" solo para Administrador hacia arriba
    try { if (myRank() >= 80) sessionStorage.setItem("pm_admin", "1"); else sessionStorage.removeItem("pm_admin"); } catch { /* */ }
    let tab = "resumen";
    try { tab = sessionStorage.getItem("pm_admin_tab") || "resumen"; } catch { /* */ }
    goTab(tab);
  }

  // freno a quien intente adivinar contraseñas: 5 intentos y espera 1 minuto
  let fails = 0, lockUntil = 0;
  $("#pinForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#pinError");
    err.textContent = "";
    if (Date.now() < lockUntil) { err.textContent = `Demasiados intentos. Espera ${Math.ceil((lockUntil - Date.now()) / 1000)} segundos.`; return; }
    const user = $("#loginUser").value.trim();
    const acc = await checkLogin(user, $("#pinInput").value);
    if (!acc) {
      fails++;
      if (fails >= 5) { lockUntil = Date.now() + 60000; fails = 0; }
      const a = findAcc(user);
      err.textContent = a && a.active === false ? "Esta cuenta está desactivada." : "Usuario o contraseña incorrectos.";
      return;
    }
    fails = 0;
    current = acc;
    acc.lastLogin = new Date().toISOString();
    saveAccounts();
    try { sessionStorage.setItem("pm_admin_user", acc.user); } catch { /* */ }
    $("#pinInput").value = "";
    showAdmin();
  });
  $("#logoutBtn").addEventListener("click", () => {
    try { ["pm_admin", "pm_admin_user", "pm_admin_tab"].forEach((k) => sessionStorage.removeItem(k)); } catch { /* */ }
    location.reload();
  });

  /* ---------- Mi cuenta: cambiar mi contraseña ---------- */
  const meModal = $("#meModal");
  function openMe() {
    $("#meInfo").innerHTML = `Usuario <b>${esc(current.user)}</b> · ${esc(current.name)} · ${roleChip(current.role)}`;
    $("#pinChangeErr").textContent = "";
    meModal.hidden = false;
    setTimeout(() => $("#pinOld").focus(), 50);
  }
  const closeMe = () => { meModal.hidden = true; $("#pinChange").reset(); };
  $("#meBtn").addEventListener("click", openMe);
  $("#defaultPassBtn").addEventListener("click", openMe);
  $$("[data-close]", meModal).forEach((el) => el.addEventListener("click", closeMe));

  /* =====================================================
     Pestañas
     ===================================================== */
  const renderers = {};
  function goTab(tab) {
    if (!$(`.pane[data-pane="${tab}"]`)) tab = "resumen";
    if ((TAB_MIN[tab] ?? 80) > myRank()) { toast("🔒 Tu rol no tiene acceso a esa sección."); tab = "resumen"; }
    $$(".tab").forEach((t) => t.classList.toggle("is-active", t.dataset.tab === tab));
    $$(".pane").forEach((p) => (p.hidden = p.dataset.pane !== tab));
    try { sessionStorage.setItem("pm_admin_tab", tab); } catch { /* */ }
    renderers[tab]?.();
    $(`.tab[data-tab="${tab}"]`)?.scrollIntoView({ inline: "center", block: "nearest" });
    window.scrollTo({ top: 0 });
  }
  $("#tabs").addEventListener("click", (e) => { const t = e.target.closest(".tab"); if (t) goTab(t.dataset.tab); });
  document.addEventListener("click", (e) => { const g = e.target.closest("[data-go]"); if (g) goTab(g.dataset.go); });

  /* =====================================================
     Resumen
     ===================================================== */
  const defText = Object.fromEntries(D.TEXT_FIELDS.map((f) => [f[1], f[3]]));
  renderers.resumen = () => {
    $("#kReqPend").textContent = loadRequests().filter((r) => r.status === "pendiente").length;
    $("#kMembers").textContent = state.members.filter((m) => m.status !== "expulsado").length;
    updateReqBadge();
    $("#kRepPend").textContent = loadReports().filter((r) => r.status === "pendiente").length;
    $("#kPlans").textContent = state.plans.length;
    $("#kTexts").textContent = Object.keys(defText).filter((k) => state.texts[k] != null && state.texts[k] !== defText[k]).length;
    $("#kImgs").textContent = Object.keys(state.imgs).length;
    updateRepBadge();
  };

  /* =====================================================
     Solicitudes de ingreso
     ===================================================== */
  const loadRequests = () => lsGet("pm_requests") || [];
  const isoIn = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
  const roleById = (id) => state.roles.find((r) => r.id === id) || state.roles.find((r) => r.id === "miembro");
  const memberByNick = (nick) => state.members.find((m) => m.nick.toLowerCase() === String(nick || "").toLowerCase());
  const roleChip = (id) => { const r = roleById(id); return `<span class="role-chip" style="--rc:${esc(r.color)}">${esc(r.emoji)} ${esc(r.name)}</span>`; };

  /* ---------- Grupo ↔ panel: la misma persona, el mismo nombre y el mismo rol ---------- */
  // Código único de cada miembro: sale del apodo, así es igual en todos los dispositivos
  function memberCode(nick) {
    let h = 2166136261;
    for (const ch of String(nick || "").trim().toLowerCase()) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
    return "PM-" + h.toString(36).toUpperCase().padStart(6, "0").slice(-6);
  }
  const interactionsOf = (nick) => (lsGet("pm_interactions") || {})[String(nick || "").toLowerCase()] || 0;
  const strikesMax = () => +state.settings.STRIKES_MAX || 3;
  const accountOf = (nick) => accounts.find((a) => (a.nick || a.name || "").toLowerCase() === String(nick || "").toLowerCase());

  // panel → grupo: la cuenta aparece en el grupo con su apodo y su rol
  function memberFromAccount(a) {
    const nick = (a.nick || a.name || "").trim();
    if (!nick) return null;
    let m = memberByNick(nick);
    if (!m) {
      m = { nick, role: a.role, color: "#5ab0ff", status: "activo", joinedAt: isoToday(), code: memberCode(nick), fromPanel: true };
      state.members.unshift(m);
    } else m.role = a.role;
    save("members");
    return m;
  }
  // grupo → panel: si cambia el rol del miembro, cambia su cuenta (o se desactiva si ya no es del equipo)
  function accountFromMember(m) {
    const a = accountOf(m.nick);
    if (!a) return null;
    if (RANK[m.role] && m.status !== "expulsado") { a.role = m.role; a.active = true; }
    else a.active = false;
    saveAccounts();
    return a;
  }
  let reqFilter = "pendiente";

  function updateReqBadge() {
    const n = loadRequests().filter((r) => r.status === "pendiente").length;
    const b = $("#tabReqCount");
    b.hidden = !n;
    b.textContent = n;
  }
  renderers.solicitudes = () => {
    updateReqBadge();
    const all = loadRequests();
    const list = all.filter((r) => reqFilter === "all" || r.status === reqFilter);
    const wrap = $("#reqList");
    if (!list.length) {
      wrap.innerHTML = `<div class="empty" style="grid-column:1/-1"><b>🙋</b>${reqFilter === "pendiente" ? "No hay solicitudes por revisar." : "No hay solicitudes aquí."}</div>`;
      return;
    }
    wrap.innerHTML = list.map((r) => {
      const date = new Date(r.createdAt).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
      const reco = r.via === "recomendacion" ? memberByNick(r.recommendedBy) : null;
      const st = { pendiente: "⏳ Por revisar", aceptado: "✅ Aceptada", rechazado: "🙅 Rechazada" }[r.status] || r.status;
      return `
      <article class="rep req" data-rid="${esc(r.id)}" data-status="${esc(r.status)}">
        <div class="rep__head">
          <span class="req__nick"><span class="dot-c" style="background:${esc(r.color)};color:${esc(r.color)}"></span>${esc(r.nick)}</span>
          ${r.via === "recomendacion" ? `<span class="tag tag--reco">🤝 Recomendado</span>` : `<span class="tag tag--priv">🙋 Normal</span>`}
          <span class="tag tag--st">${st}</span>
        </div>
        <p class="rep__meta">
          <span>👤 ${esc(r.name)}</span>
          ${r.age ? `<span>🎂 ${esc(r.age)} años</span>` : ""}
          <span>📍 ${esc(r.city)}</span>
          <span>🗓️ ${esc(date)}</span>
        </p>
        ${r.via === "recomendacion" ? `<p class="rep__meta"><span>🤝 Lo recomienda <b style="color:var(--text)">${esc(r.recommendedBy)}</b> ${reco ? roleChip(reco.role) : "(ya no es miembro)"}</span></p>` : ""}
        ${r.intro ? `<p class="req__intro">“${esc(r.intro)}”</p>` : ""}
        ${r.status === "rechazado" && r.reason ? `<p class="rep__meta">Motivo: ${esc(r.reason)}</p>` : ""}
        ${r.status === "aceptado" ? `<p class="rep__meta">Aceptada como ${roleChip(memberByNick(r.nick)?.role || "miembro")}${r.trialUntil ? ` · prueba hasta ${esc(r.trialUntil)}` : ""}</p>` : ""}
        <div class="rep__actions">
          ${r.status === "pendiente" ? `
            <button class="btn btn--grad" data-racc="miembro">✅ Aceptar como 💜 Miembro</button>
            <button class="btn btn--danger" data-rrej>🙅 Rechazar</button>` : `
            <button class="btn btn--ghost" data-rreopen>↺ Volver a revisar</button>`}
          <button class="btn btn--ghost" data-rdel aria-label="Borrar solicitud">🗑️</button>
        </div>
      </article>`;
    }).join("");
  };
  function saveRequests(list) { lsSet("pm_requests", list); }
  $("#reqList").addEventListener("click", (e) => {
    const card = e.target.closest("[data-rid]");
    if (!card) return;
    const list = loadRequests();
    const r = list.find((x) => x.id === card.dataset.rid);
    if (!r) return;
    const acc = e.target.closest("[data-racc]");
    if (acc) {
      if (memberByNick(r.nick)) { toast(`Ya existe un miembro con el apodo "${r.nick}".`); return; }
      // Toda persona aceptada entra con el rol 💜 Miembro
      r.status = "aceptado";
      r.decidedAt = new Date().toISOString();
      r.trialUntil = null;
      state.members.push({
        nick: r.nick, color: r.color, role: "miembro", status: "activo",
        joinedAt: today(), trialUntil: null, recommendedBy: r.recommendedBy || null,
        name: r.name, city: r.city, age: r.age || null, requestId: r.id,
        code: memberCode(r.nick), warnings: [],
      });
      save("members");
      toast(`✅ ${r.nick} ya es 💜 Miembro del parche`);
    } else if (e.target.closest("[data-rrej]")) {
      const reason = prompt(`¿Por qué rechazas a ${r.nick}? (opcional, la persona lo verá)`, "");
      if (reason === null) return;
      r.status = "rechazado";
      r.reason = reason.trim();
      r.decidedAt = new Date().toISOString();
      toast(`🙅 Solicitud de ${r.nick} rechazada`);
    } else if (e.target.closest("[data-rreopen]")) {
      if (r.status === "aceptado" && !confirm(`Esto saca a ${r.nick} de la lista de miembros. ¿Seguir?`)) return;
      state.members = state.members.filter((m) => m.requestId !== r.id);
      save("members");
      r.status = "pendiente";
      delete r.reason; delete r.trialUntil;
    } else if (e.target.closest("[data-rdel]")) {
      if (!confirm("¿Borrar esta solicitud?")) return;
      saveRequests(list.filter((x) => x.id !== r.id));
      renderers.solicitudes();
      return;
    } else return;
    saveRequests(list);
    renderers.solicitudes();
  });
  $("#reqFilters").addEventListener("click", (e) => {
    const c = e.target.closest(".chip");
    if (!c) return;
    reqFilter = c.dataset.f;
    $$("#reqFilters .chip").forEach((x) => x.classList.toggle("is-active", x === c));
    renderers.solicitudes();
  });

  /* =====================================================
     Miembros y roles
     ===================================================== */
  let memberQuery = "";
  let memberRole = "all";
  const saveMembers = debounce(() => { save("members"); flashSaved("#memSaved"); }, 200);

  renderers.miembros = () => {
    $("#memberRoleFilter").innerHTML = `<option value="all">Todos los roles</option>` + state.roles.map((r) => `<option value="${esc(r.id)}" ${memberRole === r.id ? "selected" : ""}>${esc(r.emoji)} ${esc(r.name)}</option>`).join("");
    const q = memberQuery.toLowerCase();
    const list = state.members
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => (memberRole === "all" || m.role === memberRole) && (!q || m.nick.toLowerCase().includes(q) || (m.name || "").toLowerCase().includes(q)));
    $("#memberRows").innerHTML = list.length ? list.map(({ m, i }) => {
      const banned = m.status === "expulsado";
      const trialLeft = m.role === "prueba" && m.trialUntil ? Math.round((new Date(m.trialUntil) - new Date(today())) / 864e5) : null;
      // solo se gestiona a quien tiene un rol MENOR al tuyo
      const canEdit = rankOf(m.role) < myRank();
      return `<div class="row member ${banned ? "is-banned" : ""}" data-mi="${i}">
        <div class="member__top">
          <span class="member__nick"><span class="dot-c" style="background:${esc(m.color)};color:${esc(m.color)}"></span>${esc(m.nick)}${banned ? ` <span class="tag" style="color:#ff6b6b;border-color:#ff6b6b">⛔ Expulsado</span>` : ""}</span>
          ${canEdit
            ? `<select data-mrole aria-label="Rol de ${esc(m.nick)}">${state.roles.map((r) => `<option value="${esc(r.id)}" ${r.id === m.role ? "selected" : ""} ${rankOf(r.id) >= myRank() ? "disabled" : ""}>${esc(r.emoji)} ${esc(r.name)}</option>`).join("")}</select>`
            : `${roleChip(m.role)} <small style="color:var(--muted)" title="Tiene un rol igual o mayor que el tuyo">🔒</small>`}
        </div>
        <div class="member__info">
          ${m.name ? `<span>👤 ${esc(m.name)}</span>` : ""}
          ${m.age ? `<span>🎂 ${esc(m.age)} años</span>` : ""}
          ${m.city ? `<span>📍 ${esc(m.city)}</span>` : ""}
          ${m.joinedAt ? `<span>📅 Desde ${esc(m.joinedAt)}</span>` : ""}
          ${m.recommendedBy ? `<span>🤝 Lo recomendó ${esc(m.recommendedBy)}</span>` : ""}
          ${trialLeft != null ? `<span style="color:#ffb46b">🧪 Prueba hasta ${esc(m.trialUntil)} (${trialLeft < 0 ? "ya terminó" : `quedan ${trialLeft} días`})</span>` : ""}
        </div>
        ${(() => {
          const warns = m.warnings || [];
          const max = strikesMax();
          const acc = accountOf(m.nick);
          return `<div class="member__info">
            <span>🆔 <code>${esc(m.code || memberCode(m.nick))}</code></span>
            <span>💬 ${interactionsOf(m.nick)} interacciones</span>
            <span class="strikes" title="Strikes">⚠️ ${warns.length}/${max} ${"●".repeat(Math.min(warns.length, max))}${"○".repeat(Math.max(0, max - warns.length))}</span>
            ${acc ? `<span>🔑 Panel: <code>${esc(acc.user)}</code>${acc.active === false ? " (desactivada)" : ""}</span>` : ""}
          </div>
          ${warns.length ? `<ul class="warns">${warns.map((w) => `<li>⚠️ <b>${esc(w.reason)}</b> <small>· ${esc(w.date)} · por ${esc(w.by)}</small></li>`).join("")}</ul>` : ""}`;
        })()}
        ${canEdit ? `<div class="row__btns" style="justify-content:flex-start">
          ${m.role === "prueba" ? `<button class="btn btn--grad" data-mend>✅ Terminar prueba</button><button class="btn btn--ghost" data-mext>➕ 7 días</button>` : ""}
          ${!banned ? `<button class="btn btn--ghost" data-mwarn>⚠️ Advertencia</button>` : ""}
          ${(m.warnings || []).length ? `<button class="btn btn--ghost" data-munwarn>↺ Quitar advertencia</button>` : ""}
          ${RANK[m.role] && !accountOf(m.nick) && myRank() >= CAN_MANAGE_ACCOUNTS ? `<button class="btn btn--grad" data-mpanel>🔑 Darle acceso al panel</button>` : ""}
          ${banned ? `<button class="btn btn--ghost" data-munban>↺ Readmitir</button>` : `<button class="btn btn--danger" data-mban>⛔ Expulsar</button>`}
          <button class="btn btn--ghost" data-mdelm aria-label="Quitar de la lista">🗑️</button>
        </div>` : ""}
      </div>`;
    }).join("") : `<div class="empty"><b>👥</b>No hay miembros con ese filtro.</div>`;
    renderRoles();
  };
  $("#memberSearch").addEventListener("input", (e) => { memberQuery = e.target.value.trim(); renderers.miembros(); });
  $("#memberRoleFilter").addEventListener("change", (e) => { memberRole = e.target.value; renderers.miembros(); });
  $("#memberRows").addEventListener("change", (e) => {
    const sel = e.target.closest("[data-mrole]");
    if (!sel) return;
    const m = state.members[+sel.closest("[data-mi]").dataset.mi];
    if (rankOf(m.role) >= myRank() || rankOf(sel.value) >= myRank()) { toast("🔒 Solo puedes dar roles menores al tuyo."); renderers.miembros(); return; }
    m.role = sel.value;
    if (m.role === "prueba" && !m.trialUntil) m.trialUntil = isoIn(state.settings.TRIAL_DAYS || 15);
    if (m.role !== "prueba") m.trialUntil = null;
    saveMembers();
    // grupo → panel
    const a = accountFromMember(m);
    toast(`${m.nick} ahora es ${roleById(m.role).emoji} ${roleById(m.role).name}${a ? (a.active ? ` · su cuenta del panel (${a.user}) también` : ` · su cuenta del panel (${a.user}) quedó desactivada`) : RANK[m.role] && myRank() >= CAN_MANAGE_ACCOUNTS ? " · dale acceso al panel con 🔑" : ""}`);
    renderers.miembros();
  });
  $("#memberRows").addEventListener("click", (e) => {
    const row = e.target.closest("[data-mi]");
    if (!row) return;
    const i = +row.dataset.mi;
    const m = state.members[i];
    if (rankOf(m.role) >= myRank()) { toast("🔒 No puedes gestionar a alguien de tu mismo nivel o superior."); return; }
    if (e.target.closest("[data-mend]")) { m.role = "miembro"; m.trialUntil = null; toast(`✅ ${m.nick} terminó su prueba`); }
    else if (e.target.closest("[data-mext]")) {
      const base = m.trialUntil && new Date(m.trialUntil) > new Date() ? new Date(m.trialUntil) : new Date();
      base.setDate(base.getDate() + 7);
      m.trialUntil = base.toISOString().slice(0, 10);
      toast(`🧪 Prueba de ${m.nick} hasta ${m.trialUntil}`);
    } else if (e.target.closest("[data-mwarn]")) {
      const reason = prompt(`Advertencia para ${m.nick}. ¿Qué regla incumplió? (la persona lo verá en "Mi cuenta")`, "");
      if (!reason || !reason.trim()) return;
      (m.warnings ||= []).push({ reason: reason.trim(), date: isoToday(), by: current.name || current.user });
      const n = m.warnings.length, max = strikesMax();
      toast(`⚠️ ${m.nick}: strike ${n}/${max}`);
      if (n >= max && confirm(`${m.nick} llegó a ${n}/${max} strikes. ¿Expulsarlo del parche ahora?`)) {
        m.status = "expulsado";
        accountFromMember(m);
        toast(`⛔ ${m.nick} expulsado por llegar a ${max} strikes`);
      }
    } else if (e.target.closest("[data-munwarn]")) {
      const last = (m.warnings || []).slice(-1)[0];
      if (!last || !confirm(`¿Quitarle a ${m.nick} la advertencia "${last.reason}"?`)) return;
      m.warnings.pop();
      toast(`↺ Advertencia quitada · ${m.nick} queda con ${m.warnings.length}/${strikesMax()}`);
    } else if (e.target.closest("[data-mpanel]")) {
      // abre Cuentas con el formulario listo: mismo apodo y mismo rol
      goTab("cuentas");
      $("#accName").value = m.nick;
      $("#accRole").value = m.role;
      $("#accUser").value = m.nick.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9._-]/g, "").slice(0, 24);
      $("#accPass").value = genPass();
      $("#accUser").focus();
      toast("Revisa el usuario y toca 🔑 Crear cuenta");
      return;
    } else if (e.target.closest("[data-mban]")) {
      if (!confirm(`¿Expulsar a ${m.nick}? Ya no podrá entrar al chat${accountOf(m.nick) ? " ni al panel" : ""}.`)) return;
      m.status = "expulsado";
      accountFromMember(m);
      toast(`⛔ ${m.nick} expulsado`);
    } else if (e.target.closest("[data-munban]")) { m.status = "activo"; accountFromMember(m); toast(`↺ ${m.nick} readmitido`); }
    else if (e.target.closest("[data-mdelm]")) {
      if (!confirm(`¿Quitar a ${m.nick} de la lista de miembros?${accountOf(m.nick) ? " Su cuenta del panel quedará desactivada." : ""}`)) return;
      const a = accountOf(m.nick);
      if (a) { a.active = false; saveAccounts(); }
      state.members.splice(i, 1);
    } else return;
    save("members");
    flashSaved("#memSaved");
    renderers.miembros();
  });
  $("#memberAdd").addEventListener("click", () => {
    const nick = prompt("Apodo del nuevo miembro:");
    if (!nick || !nick.trim()) return;
    if (memberByNick(nick.trim())) { toast("Ya existe un miembro con ese apodo."); return; }
    state.members.unshift({ nick: nick.trim(), role: "miembro", color: "#ff7ad9", status: "activo", joinedAt: today() });
    save("members");
    renderers.miembros();
    toast(`➕ ${nick.trim()} agregado como Miembro`);
  });

  // Roles
  const PERMS = [["pin", "📌 Fijar"], ["poll", "📊 Encuestas"], ["media", "🖼️ Fotos/GIFs"], ["plans", "🗓️ Parches"]];
  function renderRoles() {
    $("#roleRows").innerHTML = state.roles.map((r, i) => {
      const people = state.members.filter((m) => m.role === r.id && m.status !== "expulsado");
      const count = people.length;
      return `<div class="row role-row" data-ri="${i}" style="--rc:${esc(r.color)}">
        <div class="role-row__top">
          <input type="text" data-remoji maxlength="4" value="${esc(r.emoji)}" aria-label="Emoji del rol" />
          <input type="text" data-rname maxlength="20" value="${esc(r.name)}" aria-label="Nombre del rol" />
          <input type="color" data-rcolor value="${esc(r.color)}" aria-label="Color del rol" />
          <div class="role-row__meta">
            <span class="role-row__count">👥 ${count} persona${count === 1 ? "" : "s"}</span>
            ${r.fixed ? `<span class="role-row__lock" title="Rol del sistema: no se puede borrar">🔒</span>` : `<button class="icon-mini" data-rdel aria-label="Borrar rol" title="Borrar rol">🗑️</button>`}
          </div>
        </div>
        <div class="perms">
          ${PERMS.map(([k, l]) => `<label><input type="checkbox" data-rperm="${k}" ${r.perms?.[k] ? "checked" : ""} ${r.id === "fundador" ? "disabled" : ""} /> ${l}</label>`).join("")}
        </div>
        <div class="role-row__people">
          ${count ? people.map((m) => `<span class="role-person"><i style="background:${esc(m.color || r.color)}"></i>${esc(m.nick)}</span>`).join("") : `<small>Nadie tiene este rol todavía</small>`}
        </div>
      </div>`;
    }).join("");
  }
  const saveRoles = debounce(() => { save("roles"); flashSaved("#memSaved"); }, 300);
  $("#roleRows").addEventListener("input", (e) => {
    const row = e.target.closest("[data-ri]");
    if (!row) return;
    const r = state.roles[+row.dataset.ri];
    if (e.target.matches("[data-remoji]")) r.emoji = e.target.value.trim() || "⭐";
    if (e.target.matches("[data-rname]")) r.name = e.target.value.trim() || "Rol";
    if (e.target.matches("[data-rcolor]")) { r.color = e.target.value; row.style.setProperty("--rc", r.color); }
    if (e.target.matches("[data-rperm]")) (r.perms ||= {})[e.target.dataset.rperm] = e.target.checked;
    saveRoles();
  });
  $("#roleRows").addEventListener("click", (e) => {
    const b = e.target.closest("[data-rdel]");
    if (!b) return;
    const r = state.roles[+b.closest("[data-ri]").dataset.ri];
    const n = state.members.filter((m) => m.role === r.id).length;
    if (!confirm(`¿Borrar el rol "${r.name}"?${n ? ` Las ${n} personas con este rol pasan a Miembro.` : ""}`)) return;
    state.members.forEach((m) => { if (m.role === r.id) m.role = "miembro"; });
    state.roles = state.roles.filter((x) => x.id !== r.id);
    save("roles"); save("members");
    renderers.miembros();
  });
  $("#roleAdd").addEventListener("click", () => {
    state.roles.push({ id: `r${Date.now().toString(36)}`, emoji: "⭐", name: "Nuevo rol", color: "#5ab0ff", perms: { pin: false, poll: true, media: true, plans: false } });
    save("roles");
    renderRoles();
    $$("#roleRows [data-rname]").slice(-1)[0]?.select();
  });
  $("#rolesReset").addEventListener("click", () => {
    if (!confirm("¿Volver a los roles originales? Quien tenga un rol creado por ti pasa a Miembro.")) return;
    state.roles = clone(D.ROLES);
    const ids = state.roles.map((r) => r.id);
    state.members.forEach((m) => { if (!ids.includes(m.role)) m.role = "miembro"; });
    save("roles"); save("members");
    renderers.miembros();
  });

  /* =====================================================
     Reportes
     ===================================================== */
  const STATUS = { pendiente: "🕓 Pendiente", revision: "👀 En revisión", resuelto: "✅ Resuelto", expulsado: "⛔ Expulsado" };
  const KIND = { text: "Mensaje", voice: "Nota de voz", sticker: "Sticker", image: "Foto", gif: "GIF", video: "Video", poll: "Encuesta" };
  const loadReports = () => lsGet("pm_reports") || [];
  let repFilter = "all";
  let repQuery = "";
  function updateRepBadge() {
    const n = loadReports().filter((r) => r.status === "pendiente").length;
    const b = $("#tabRepCount");
    b.hidden = !n;
    b.textContent = n;
  }
  renderers.reportes = () => {
    const all = loadReports();
    $("#kPend").textContent = all.filter((r) => r.status === "pendiente").length;
    $("#kRev").textContent = all.filter((r) => r.status === "revision").length;
    $("#kDone").textContent = all.filter((r) => r.status === "resuelto").length;
    $("#kBan").textContent = all.filter((r) => r.status === "expulsado").length;
    updateRepBadge();
    const q = repQuery.toLowerCase();
    const list = all.filter((r) => {
      if (repFilter === "publico" || repFilter === "privado") { if (r.visibility !== repFilter) return false; }
      else if (repFilter !== "all" && r.status !== repFilter) return false;
      return !q || [r.reported, r.reason, r.reporter, r.details, r.id].some((x) => (x || "").toLowerCase().includes(q));
    });
    const wrap = $("#reports");
    if (!list.length) {
      wrap.innerHTML = `<div class="empty" style="grid-column:1/-1"><b>🛡️</b>${all.length ? "No hay reportes con ese filtro." : "Todavía no hay reportes. ¡El parche está tranquilo!"}</div>`;
      return;
    }
    wrap.innerHTML = list.map((r) => {
      const date = new Date(r.createdAt).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
      const ev = r.evidenceMessage;
      return `
      <article class="rep" data-id="${esc(r.id)}" data-status="${esc(r.status)}">
        <div class="rep__head">
          <span class="rep__who">🚩 ${esc(r.reported)}</span>
          <span class="tag ${r.visibility === "publico" ? "tag--pub" : "tag--priv"}">${r.visibility === "publico" ? "📢 Público" : "🔒 Privado"}</span>
          <span class="tag tag--st">${STATUS[r.status] || esc(r.status)}</span>
        </div>
        <p class="rep__reason">${esc(r.reason)}</p>
        <p class="rep__meta"><span>🆔 ${esc(r.id)}</span><span>🗓️ ${esc(date)}</span><span>📍 ${esc(r.where)}</span><span>👤 Reporta: ${esc(r.reporter)}</span></p>
        ${r.details ? `<p class="rep__details">${esc(r.details)}</p>` : ""}
        ${ev ? `<div class="rep__quote"><small>${esc(KIND[ev.kind] || "Mensaje")} reportado ${ev.time ? `· ${esc(ev.time)}` : ""}</small>${ev.text ? `“${esc(ev.text)}”` : `[${esc(KIND[ev.kind] || "contenido")}]`}</div>` : ""}
        ${r.evidenceImage ? `<button class="rep__img" data-img="${esc(r.evidenceImage)}" aria-label="Ver captura"><img src="${esc(r.evidenceImage)}" alt="Captura adjunta" /></button>` : ""}
        ${r.note ? `<p class="rep__meta">ℹ️ ${esc(r.note)}</p>` : ""}
        <div class="rep__actions">
          ${r.status !== "revision" ? `<button class="btn btn--ghost" data-act="revision">👀 Revisar</button>` : ""}
          ${r.status !== "resuelto" ? `<button class="btn btn--ghost" data-act="resuelto">✅ Resolver</button>` : ""}
          ${r.status !== "expulsado" ? `<button class="btn btn--danger" data-act="expulsado">⛔ Expulsar</button>` : ""}
          ${r.status !== "pendiente" ? `<button class="btn btn--ghost" data-act="pendiente">↺ Reabrir</button>` : ""}
          <button class="btn btn--ghost" data-act="borrar" aria-label="Borrar reporte">🗑️</button>
        </div>
      </article>`;
    }).join("");
  };
  $("#reports").addEventListener("click", (e) => {
    const img = e.target.closest("[data-img]");
    if (img) { $("#lightboxImg").src = img.dataset.img; $("#lightbox").hidden = false; return; }
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const id = btn.closest(".rep").dataset.id;
    let list = loadReports();
    const r = list.find((x) => x.id === id);
    if (!r) return;
    const act = btn.dataset.act;
    if (act === "borrar") {
      if (!confirm(`¿Borrar el reporte ${id}? No se puede deshacer.`)) return;
      list = list.filter((x) => x.id !== id);
      toast("Reporte borrado");
    } else if (act === "expulsado") {
      if (!confirm(`¿Expulsar a "${r.reported}" del parche?`)) return;
      r.status = "expulsado";
      toast(`⛔ ${r.reported} fue marcado como expulsado`);
    } else {
      r.status = act;
      toast(`Reporte marcado como: ${STATUS[act]}`);
    }
    r.updatedAt = new Date().toISOString();
    lsSet("pm_reports", list);
    renderers.reportes();
  });
  $("#repFilters").addEventListener("click", (e) => {
    const c = e.target.closest(".chip");
    if (!c) return;
    repFilter = c.dataset.f;
    $$("#repFilters .chip").forEach((x) => x.classList.toggle("is-active", x === c));
    renderers.reportes();
  });
  $("#repSearch").addEventListener("input", (e) => { repQuery = e.target.value.trim(); renderers.reportes(); });
  $("#exportReports").addEventListener("click", () => download(`reportes-parchemonos-${today()}.json`, JSON.stringify(loadReports(), null, 2), "application/json"));
  window.addEventListener("storage", (e) => {
    if (e.key !== "pm_reports") return;
    updateRepBadge();
    if (!$('.pane[data-pane="reportes"]').hidden) renderers.reportes();
    toast("🚩 ¡Llegó un reporte nuevo!");
  });
  $("#lightbox").addEventListener("click", () => ($("#lightbox").hidden = true));

  /* =====================================================
     Textos
     ===================================================== */
  const saveTexts = debounce(() => { save("texts"); flashSaved("#textSaved"); });
  renderers.textos = () => {
    if ($("#textGroups").childElementCount) return; // ya está armado
    const groups = {};
    D.TEXT_FIELDS.forEach(([g, key, label, def, multi]) => (groups[g] ||= []).push({ key, label, def, multi }));
    $("#textGroups").innerHTML = Object.entries(groups).map(([g, fields], gi) => `
      <details class="tgroup" ${gi < 2 ? "open" : ""}>
        <summary>${esc(g)} <small style="color:var(--muted);font-weight:500;margin-left:auto;margin-right:12px">${fields.length} textos</small></summary>
        <div class="tgroup__body">
          ${fields.map((f) => {
            const v = state.texts[f.key] ?? f.def;
            const id = `t_${f.key.replace(/\W/g, "_")}`;
            const input = f.multi
              ? `<textarea id="${id}" data-tkey="${esc(f.key)}" rows="3">${esc(v)}</textarea>`
              : `<input type="text" id="${id}" data-tkey="${esc(f.key)}" value="${esc(v)}" />`;
            return `<div class="field ${v !== f.def ? "is-changed" : ""}" data-field="${esc(f.key)}" data-search="${esc((g + " " + f.label + " " + v).toLowerCase())}">
              <label class="field__label" for="${id}">${esc(f.label)}</label>
              <div class="field-inline">${input}<button type="button" class="icon-mini" data-treset="${esc(f.key)}" title="Volver al texto original" aria-label="Volver al texto original">↺</button></div>
            </div>`;
          }).join("")}
        </div>
      </details>`).join("");
  };
  $("#textGroups").addEventListener("input", (e) => {
    const el = e.target.closest("[data-tkey]");
    if (!el) return;
    const key = el.dataset.tkey;
    state.texts[key] = el.value;
    el.closest(".field").classList.toggle("is-changed", el.value !== defText[key]);
    saveTexts();
  });
  $("#textGroups").addEventListener("click", (e) => {
    const b = e.target.closest("[data-treset]");
    if (!b) return;
    const key = b.dataset.treset;
    state.texts[key] = defText[key];
    const el = $(`[data-tkey="${CSS.escape(key)}"]`);
    el.value = defText[key];
    el.closest(".field").classList.remove("is-changed");
    save("texts");
    flashSaved("#textSaved");
  });
  $("#textSearch").addEventListener("input", (e) => {
    renderers.textos();
    const q = e.target.value.trim().toLowerCase();
    $$(".tgroup").forEach((g) => {
      let any = false;
      $$("[data-field]", g).forEach((f) => {
        const val = ($("[data-tkey]", f)?.value || "").toLowerCase();
        const hit = !q || f.dataset.search.includes(q) || val.includes(q);
        f.hidden = !hit;
        any ||= hit;
      });
      g.hidden = !any;
      if (q && any) g.open = true;
    });
  });

  /* =====================================================
     Imágenes
     ===================================================== */
  renderers.imagenes = () => {
    $("#slots").innerHTML = D.IMAGE_SLOTS.map(([slot, label, def]) => {
      const custom = state.imgs[slot];
      const prev = custom || (def.startsWith("assets/") ? def : null);
      return `<div class="slot">
        <div class="slot__prev">${prev ? `<img src="${esc(prev)}" alt="" />` : esc(def)}</div>
        <div class="slot__body">
          <b>${esc(label)}</b>
          <small style="color:${custom ? "var(--lime)" : "var(--muted)"}">${custom ? "✓ Cambiada" : "Original"}</small>
          <div class="slot__btns">
            <button class="btn btn--grad" data-slotpick="${slot}">📷 Cambiar</button>
            ${custom ? `<button class="btn btn--ghost" data-slotreset="${slot}" aria-label="Volver a la original">↺</button>` : ""}
          </div>
        </div>
      </div>`;
    }).join("");
  };
  $("#slots").addEventListener("click", async (e) => {
    const pick = e.target.closest("[data-slotpick]");
    const reset = e.target.closest("[data-slotreset]");
    if (pick) {
      const slot = pick.dataset.slotpick;
      const data = await pickImage(slot.startsWith("card-") || slot === "logo" ? 500 : 1400);
      if (!data) return;
      const before = state.imgs[slot];
      state.imgs[slot] = data;
      if (!save("imgs")) { if (before) state.imgs[slot] = before; else delete state.imgs[slot]; return; }
      toast("✅ Imagen cambiada");
    } else if (reset) {
      delete state.imgs[reset.dataset.slotreset];
      save("imgs");
      toast("↺ Imagen original");
    } else return;
    applyLogo();
    renderers.imagenes();
  });

  /* =====================================================
     Parches oficiales
     ===================================================== */
  const catOf = (n) => D.CATS.find((c) => c.name === n) || D.CATS[D.CATS.length - 1];
  const fromISO = (s) => { const [y, m, d] = (s || "").split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };
  const today = () => new Date().toISOString().slice(0, 10);
  const planImg = (p) => state.imgs[`plan-${p.id}`] || p.img;

  renderers.parches = () => {
    const list = [...state.plans].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    $("#planRows").innerHTML = list.length ? list.map((p) => {
      const img = planImg(p);
      const d = fromISO(p.date).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
      const past = fromISO(p.date) < new Date(new Date().toDateString());
      return `<div class="row" data-pid="${esc(p.id)}">
        <div class="row__img">${img ? `<img src="${esc(img)}" alt="" />` : catOf(p.cat).icon}</div>
        <div class="row__main">
          <b>${esc(p.title)}</b>
          <small>${catOf(p.cat).icon} ${esc(p.cat)} · 📅 ${esc(d)} · 🕓 ${esc(p.time)}${past ? " · <span style='color:var(--pink)'>ya pasó</span>" : ""}</small><br />
          <small>📍 ${esc(p.address)}</small>
        </div>
        <div class="row__btns">
          <button class="btn btn--grad" data-pedit>✏️ Editar</button>
          <button class="btn btn--ghost" data-pdup>📄 Duplicar</button>
          <button class="btn btn--danger" data-pdel>🗑️</button>
        </div>
      </div>`;
    }).join("") : `<div class="empty"><b>🗓️</b>No hay parches oficiales. Crea el primero con “➕ Nuevo parche”.</div>`;
  };
  $("#planRows").addEventListener("click", (e) => {
    const row = e.target.closest("[data-pid]");
    if (!row) return;
    const p = state.plans.find((x) => x.id === row.dataset.pid);
    if (e.target.closest("[data-pedit]")) openPlanEditor(p);
    if (e.target.closest("[data-pdup]")) {
      const copy = { ...clone(p), id: `a${Date.now().toString(36)}`, title: `${p.title} (copia)` };
      if (planImg(p)) copy.img = planImg(p);
      state.plans.push(copy);
      save("plans");
      renderers.parches();
      toast("📄 Parche duplicado");
    }
    if (e.target.closest("[data-pdel]")) {
      if (!confirm(`¿Borrar el parche "${p.title}"?`)) return;
      state.plans = state.plans.filter((x) => x.id !== p.id);
      delete state.imgs[`plan-${p.id}`];
      save("plans"); save("imgs");
      renderers.parches();
      toast("🗑️ Parche borrado");
    }
  });
  $("#planNew").addEventListener("click", () => openPlanEditor(null));
  $("#plansReset").addEventListener("click", () => {
    if (!confirm("¿Volver a los parches de ejemplo? Se borran los parches oficiales que creaste o editaste.")) return;
    state.plans = clone(D.PLANS);
    save("plans");
    renderers.parches();
    toast("↺ Parches de ejemplo restaurados");
  });

  // Editor
  const pm = $("#planModal");
  let editing = null;
  let pmImg = null;
  $("#pmCat").innerHTML = D.CATS.map((c) => `<option value="${c.name}">${c.icon} ${c.name}</option>`).join("");
  function setPmImg(data) {
    pmImg = data;
    $("#pmImgPrev").hidden = !data;
    $("#pmImgBtn").hidden = !!data;
    if (data) $("#pmImgTag").src = data;
  }
  function addPmOpt(val = "") {
    const box = $("#pmPollOpts");
    if (box.children.length >= 5) { toast("Máximo 5 opciones."); return; }
    const row = document.createElement("div");
    row.className = "poll-builder__opt";
    row.innerHTML = `<input type="text" maxlength="40" placeholder="Opción" aria-label="Opción" /><input type="number" min="0" placeholder="Votos" aria-label="Votos iniciales" style="max-width:90px" /><button type="button" aria-label="Quitar">✕</button>`;
    const [t, v] = $$("input", row);
    t.value = typeof val === "object" ? val.t : val;
    v.value = typeof val === "object" ? val.v || 0 : 0;
    $("button", row).addEventListener("click", () => { if (box.children.length > 2) row.remove(); });
    box.appendChild(row);
  }
  $("#pmPollOn").addEventListener("change", (e) => {
    $("#pmPollFields").hidden = !e.target.checked;
    if (e.target.checked && !$("#pmPollOpts").children.length) { addPmOpt(); addPmOpt(); }
  });
  $("#pmPollAdd").addEventListener("click", () => addPmOpt());
  $("#pmImgBtn").addEventListener("click", async () => { const d = await pickImage(1400); if (d) setPmImg(d); });
  $("#pmImgDel").addEventListener("click", () => setPmImg(null));

  function openPlanEditor(p) {
    editing = p;
    $("#pmTitle").textContent = p ? "Editar parche" : "Nuevo parche";
    $("#pmErr").textContent = "";
    $("#pmName").value = p?.title || "";
    $("#pmCat").value = p?.cat || "Mirador";
    $("#pmCap").value = p?.cap || "";
    $("#pmDate").value = p?.date || today();
    $("#pmTime").value = p?.time || "18:00";
    $("#pmAddr").value = p?.address || "";
    $("#pmMeet").value = p?.meet || "";
    $("#pmDesc").value = p?.desc || "";
    $("#pmAuthor").value = p?.author || "Admins 👑";
    $("#pmGoing").value = p?.going ?? 0;
    $("#pmVotes").value = p?.votes ?? 0;
    setPmImg(p ? planImg(p) || null : null);
    $("#pmPollOpts").innerHTML = "";
    $("#pmPollOn").checked = !!p?.poll;
    $("#pmPollFields").hidden = !p?.poll;
    $("#pmPollQ").value = p?.poll?.q || "";
    (p?.poll?.options || []).forEach((o) => addPmOpt(o));
    pm.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closePlanEditor() { pm.hidden = true; document.body.style.overflow = ""; }
  $$("[data-close]", pm).forEach((el) => el.addEventListener("click", closePlanEditor));

  $("#pmForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const err = $("#pmErr");
    const v = (id) => $(id).value.trim();
    const title = v("#pmName"), date = v("#pmDate"), time = v("#pmTime"), address = v("#pmAddr"), desc = v("#pmDesc");
    if (title.length < 3) return (err.textContent = "Ponle un título.");
    if (!date || !time) return (err.textContent = "Pon fecha y hora.");
    if (address.length < 3) return (err.textContent = "Escribe la dirección.");
    if (desc.length < 5) return (err.textContent = "Escribe una descripción.");
    let poll = null;
    if ($("#pmPollOn").checked) {
      const options = $$(".poll-builder__opt", $("#pmPollOpts"))
        .map((r) => { const [t, n] = $$("input", r); return { t: t.value.trim(), v: Math.max(0, parseInt(n.value, 10) || 0) }; })
        .filter((o) => o.t);
      if (!v("#pmPollQ") || options.length < 2) return (err.textContent = "La votación necesita pregunta y 2 opciones.");
      poll = { q: v("#pmPollQ"), options };
    }
    const cap = parseInt(v("#pmCap"), 10);
    const author = v("#pmAuthor") || "Admins 👑";
    const data = {
      id: editing?.id || `a${Date.now().toString(36)}`,
      cat: $("#pmCat").value, title, date, time, address,
      meet: v("#pmMeet"), desc,
      img: pmImg || null,
      cap: cap >= 2 ? cap : null,
      going: Math.max(0, parseInt(v("#pmGoing"), 10) || 0),
      votes: Math.max(0, parseInt(v("#pmVotes"), 10) || 0),
      initials: editing?.initials || [author.replace(/[^\p{L}]/gu, "").slice(0, 2).toUpperCase() || "PM"],
      author, poll,
    };
    if (editing) state.plans[state.plans.findIndex((x) => x.id === editing.id)] = data;
    else state.plans.push(data);
    delete state.imgs[`plan-${data.id}`]; // la imagen queda dentro del parche
    if (!save("plans")) return;
    save("imgs");
    closePlanEditor();
    renderers.parches();
    toast(editing ? "💾 Parche actualizado" : "🎉 Parche creado");
  });

  /* =====================================================
     Test
     ===================================================== */
  const TYPES = { choice: "Respuesta concreta", yesno: "Sí o No", tf: "Verdadero o Falso" };
  const saveQuiz = debounce(() => { save("quiz"); flashSaved("#quizSaved"); });
  function qHtml(q, i) {
    let body = "";
    if (q.type === "choice") {
      const opts = [...(q.opts || [])];
      while (opts.length < 4) opts.push("");
      body = `<div class="q__opts">${opts.map((o, k) => `
        <div class="q__opt">
          <input type="radio" name="qa${i}" value="${k}" ${o && o === q.a ? "checked" : ""} aria-label="Marcar como correcta" />
          <input type="text" data-qopt="${k}" value="${esc(o)}" placeholder="Opción ${k + 1}${k > 1 ? " (opcional)" : ""}" />
        </div>`).join("")}
        <small style="color:var(--muted)">Marca el círculo de la respuesta correcta.</small></div>`;
    } else {
      const choices = q.type === "yesno" ? ["Sí", "No"] : ["Verdadero", "Falso"];
      body = `<label class="field" style="margin-top:8px"><span class="field__label">Respuesta correcta</span>
        <select data-qa>${choices.map((c) => `<option ${c === q.a ? "selected" : ""}>${c}</option>`).join("")}</select></label>`;
    }
    return `<div class="q" data-qi="${i}">
      <div class="q__head">
        <span class="q__num">${String(i + 1).padStart(2, "0")}</span>
        <select data-qtype aria-label="Tipo de pregunta">${Object.entries(TYPES).map(([k, l]) => `<option value="${k}" ${k === q.type ? "selected" : ""}>${l}</option>`).join("")}</select>
        <button type="button" class="icon-mini" data-qmove="-1" aria-label="Subir">↑</button>
        <button type="button" class="icon-mini" data-qmove="1" aria-label="Bajar">↓</button>
        <button type="button" class="icon-mini" data-qdel aria-label="Borrar pregunta">🗑️</button>
      </div>
      <input type="text" data-qtext value="${esc(q.q)}" placeholder="Escribe la pregunta" />
      ${body}
    </div>`;
  }
  renderers.test = () => {
    $("#quizList").innerHTML = state.quiz.map(qHtml).join("") ||
      `<div class="empty"><b>❓</b>No hay preguntas. Agrega al menos una.</div>`;
  };
  function readQ(el) {
    const i = +el.dataset.qi;
    const q = state.quiz[i];
    q.q = $("[data-qtext]", el).value;
    if (q.type === "choice") {
      const inputs = $$("[data-qopt]", el);
      const checked = $(`input[name="qa${i}"]:checked`, el);
      const correct = checked ? inputs[+checked.value].value.trim() : "";
      q.opts = inputs.map((x) => x.value.trim()).filter(Boolean);
      q.a = q.opts.includes(correct) ? correct : q.opts[0] || "";
    } else {
      q.a = $("[data-qa]", el).value;
    }
  }
  $("#quizList").addEventListener("input", (e) => {
    const el = e.target.closest(".q");
    if (!el || e.target.matches("[data-qtype]")) return;
    readQ(el);
    saveQuiz();
  });
  $("#quizList").addEventListener("change", (e) => {
    const el = e.target.closest(".q");
    if (!el) return;
    if (e.target.matches("[data-qtype]")) {
      const q = state.quiz[+el.dataset.qi];
      q.type = e.target.value;
      if (q.type === "choice") { q.opts = q.opts?.length ? q.opts : ["", "", "", ""]; q.a = q.opts[0] || ""; delete q._; }
      else { delete q.opts; q.a = q.type === "yesno" ? "Sí" : "Verdadero"; }
      el.outerHTML = qHtml(q, +el.dataset.qi);
    } else readQ(el);
    saveQuiz();
  });
  $("#quizList").addEventListener("click", (e) => {
    const el = e.target.closest(".q");
    if (!el) return;
    const i = +el.dataset.qi;
    const mv = e.target.closest("[data-qmove]");
    if (mv) {
      const j = i + +mv.dataset.qmove;
      if (j < 0 || j >= state.quiz.length) return;
      [state.quiz[i], state.quiz[j]] = [state.quiz[j], state.quiz[i]];
    } else if (e.target.closest("[data-qdel]")) {
      if (state.quiz.length <= 1) { toast("El test necesita al menos 1 pregunta."); return; }
      if (!confirm("¿Borrar esta pregunta?")) return;
      state.quiz.splice(i, 1);
    } else return;
    save("quiz");
    renderers.test();
    flashSaved("#quizSaved");
  });
  $("#quizAdd").addEventListener("click", () => {
    state.quiz.push({ type: "yesno", q: "", a: "Sí" });
    save("quiz");
    renderers.test();
    $$(".q").slice(-1)[0]?.scrollIntoView({ behavior: "smooth", block: "center" });
    $$(".q [data-qtext]").slice(-1)[0]?.focus({ preventScroll: true });
  });
  $("#quizReset").addEventListener("click", () => {
    if (!confirm("¿Volver a las 10 preguntas originales?")) return;
    state.quiz = clone(D.QUIZ);
    save("quiz");
    renderers.test();
    toast("↺ Test original restaurado");
  });

  /* =====================================================
     Chat: stickers y palabras bloqueadas
     ===================================================== */
  const saveChat = debounce(() => { save("stickers"); save("blocked"); flashSaved("#chatSaved"); });
  renderers.chat = () => {
    $("#stkRows").innerHTML = state.stickers.map((s, i) => `
      <div class="stk-row" data-si="${i}">
        <input type="text" maxlength="4" value="${esc(s.e)}" data-se aria-label="Emoji" />
        <input type="text" maxlength="20" value="${esc(s.t)}" data-st aria-label="Texto del sticker" />
        <button type="button" class="icon-mini" data-sdel aria-label="Borrar sticker">✕</button>
      </div>`).join("");
    $("#blockedWords").value = state.blocked.join("\n");
  };
  $("#stkRows").addEventListener("input", (e) => {
    const row = e.target.closest("[data-si]");
    if (!row) return;
    const s = state.stickers[+row.dataset.si];
    s.e = $("[data-se]", row).value.trim();
    s.t = $("[data-st]", row).value.trim();
    saveChat();
  });
  $("#stkRows").addEventListener("click", (e) => {
    const b = e.target.closest("[data-sdel]");
    if (!b) return;
    state.stickers.splice(+b.closest("[data-si]").dataset.si, 1);
    save("stickers");
    renderers.chat();
  });
  $("#stkAdd").addEventListener("click", () => {
    state.stickers.push({ e: "😎", t: "Nuevo" });
    save("stickers");
    renderers.chat();
    $$("#stkRows [data-st]").slice(-1)[0]?.select();
  });
  $("#stkReset").addEventListener("click", () => { state.stickers = clone(D.STICKERS); save("stickers"); renderers.chat(); toast("↺ Stickers originales"); });
  $("#blockedWords").addEventListener("input", (e) => {
    state.blocked = e.target.value.split("\n").map((w) => w.trim().toLowerCase()).filter(Boolean);
    saveChat();
  });
  $("#blockedReset").addEventListener("click", () => { state.blocked = [...D.BLOCKED_WORDS]; save("blocked"); renderers.chat(); toast("↺ Lista original"); });

  /* =====================================================
     Seguridad y ajustes
     ===================================================== */
  renderers.ajustes = () => {
    $$("[data-set]").forEach((el) => {
      const v = state.settings[el.dataset.set];
      if (el.type === "checkbox") el.checked = !!v;
      else if (el.hasAttribute("data-list")) el.value = (v || []).join(el.hasAttribute("data-lines") ? "\n" : ", ");
      else el.value = v ?? "";
    });
  };
  $('.pane[data-pane="ajustes"]').addEventListener("change", (e) => {
    const el = e.target.closest("[data-set]");
    if (!el) return;
    const k = el.dataset.set;
    let v;
    if (el.type === "checkbox") v = el.checked;
    else if (el.type === "number") v = parseInt(el.value, 10);
    else if (el.hasAttribute("data-list")) v = el.value.split(/[\n,]/).map((x) => x.trim()).filter(Boolean).map((x) => (k === "ALLOWED_COUNTRIES" ? x.toUpperCase() : x));
    else v = el.value.trim();
    if (k === "AGE_MIN" || k === "AGE_MAX") {
      const min = k === "AGE_MIN" ? v : state.settings.AGE_MIN;
      const max = k === "AGE_MAX" ? v : state.settings.AGE_MAX;
      if (!v || min >= max) { toast("La edad mínima tiene que ser menor que la máxima."); renderers.ajustes(); return; }
    }
    state.settings[k] = v;
    save("settings");
    flashSaved("#setSaved");
  });
  // Mi cuenta → cambiar mi contraseña
  $("#pinChange").addEventListener("submit", async (e) => {
    e.preventDefault();
    const old = $("#pinOld").value, a = $("#pinNew").value, b = $("#pinNew2").value, err = $("#pinChangeErr");
    err.textContent = "";
    if (!(await checkLogin(current.user, old))) return (err.textContent = "Tu contraseña actual no es correcta.");
    if (a.length < 8) return (err.textContent = "La nueva contraseña necesita mínimo 8 caracteres.");
    if (a === DEFAULT_PIN) return (err.textContent = "No uses la contraseña inicial.");
    if (a !== b) return (err.textContent = "Las contraseñas nuevas no coinciden.");
    current.hash = await hashPass(current.user, a);
    delete current.legacyHash;
    current.mustChange = false;
    saveAccounts();
    closeMe();
    $("#defaultPassNote").hidden = true;
    toast("🔒 Contraseña cambiada. Publica para que aplique en otros computadores.");
  });

  /* =====================================================
     Cuentas del panel (Administrador hacia arriba)
     ===================================================== */
  function genPass() {
    const abc = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const n = new Uint32Array(10);
    crypto.getRandomValues(n);
    return [...n].map((x) => abc[x % abc.length]).join("");
  }
  const assignable = () => PANEL_ROLES.filter((r) => RANK[r] < myRank());
  const canManage = (a) => a !== current && RANK[a.role] < myRank();

  renderers.cuentas = () => {
    $("#accRole").innerHTML = assignable().map((r) => { const ro = roleById(r); return `<option value="${r}">${esc(ro?.emoji || "")} ${esc(ro?.name || r)}</option>`; }).join("");
    $("#accMembers").innerHTML = state.members.filter((m) => m.status !== "expulsado").map((m) => `<option value="${esc(m.nick)}"></option>`).join("");
    $("#accRolesInfo").innerHTML = PANEL_ROLES.map((r) => `<div class="role-access"><b>${roleChip(r)}</b><span>${esc(ROLE_ACCESS[r])}</span></div>`).join("");
    const list = [...accounts].sort((a, b) => (RANK[b.role] || 0) - (RANK[a.role] || 0) || a.user.localeCompare(b.user));
    $("#accRows").innerHTML = list.map((a) => {
      const me = a === current;
      const manage = canManage(a);
      const off = a.active === false;
      const last = a.lastLogin ? new Date(a.lastLogin).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" }) : "nunca";
      return `<div class="row acc ${off ? "is-off" : ""}" data-acc="${esc(a.user)}">
        <div class="acc__top">
          <span class="acc__user"><code>${esc(a.user)}</code> ${esc(a.name || "")} ${me ? `<span class="tag tag--pub">Tú</span>` : ""} ${off ? `<span class="tag" style="color:#ff6b6b;border-color:#ff6b6b">Desactivada</span>` : ""}</span>
          ${manage
            ? `<select data-accrole aria-label="Rol de ${esc(a.user)}">${assignable().map((r) => `<option value="${r}" ${r === a.role ? "selected" : ""}>${esc(roleById(r)?.emoji || "")} ${esc(roleById(r)?.name || r)}</option>`).join("")}</select>`
            : roleChip(a.role)}
        </div>
        <div class="acc__info">
          <span>Creada por ${esc(a.createdBy || "—")}${a.createdAt ? ` · ${esc(a.createdAt)}` : ""}</span>
          <span>Último ingreso: ${esc(last)}</span>
          ${memberByNick(a.nick || a.name) ? `<span>💬 En el grupo: <b style="color:var(--text)">${esc(memberByNick(a.nick || a.name).nick)}</b> · <code>${esc(memberByNick(a.nick || a.name).code || memberCode(a.nick || a.name))}</code></span>` : `<span style="color:#ffb46b">No está en el grupo</span>`}
          ${a.mustChange ? `<span style="color:#ffb46b">Debe cambiar su contraseña</span>` : ""}
        </div>
        ${manage ? `<div class="row__btns" style="justify-content:flex-start">
          <button class="btn btn--ghost" data-accpass>🔑 Nueva contraseña</button>
          <button class="btn btn--ghost" data-acctoggle>${off ? "▶️ Activar" : "⏸️ Desactivar"}</button>
          <button class="btn btn--danger" data-accdel aria-label="Borrar cuenta">🗑️</button>
        </div>` : me ? `<div class="row__btns" style="justify-content:flex-start"><button class="btn btn--ghost" data-accme>👤 Cambiar mi contraseña</button></div>` : ""}
      </div>`;
    }).join("");
  };

  $("#accGen").addEventListener("click", () => { $("#accPass").value = genPass(); $("#accPass").select(); });
  $("#accForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#accErr");
    err.textContent = "";
    if (myRank() < CAN_MANAGE_ACCOUNTS) return (err.textContent = "Tu rol no puede crear cuentas.");
    const user = $("#accUser").value.trim().toLowerCase();
    const name = $("#accName").value.trim();
    const role = $("#accRole").value;
    const pass = $("#accPass").value;
    if (!/^[a-z0-9._-]{3,24}$/.test(user)) return (err.textContent = "El usuario debe tener de 3 a 24 letras o números, sin espacios ni tildes.");
    if (findAcc(user)) return (err.textContent = "Ese usuario ya existe.");
    if (name.length < 2) return (err.textContent = "Escribe el nombre o apodo de la persona.");
    if (!assignable().includes(role)) return (err.textContent = "Solo puedes dar roles menores al tuyo.");
    if (pass.length < 8) return (err.textContent = "La contraseña necesita mínimo 8 caracteres (usa 🎲 Generar).");
    if (accountOf(name)) return (err.textContent = `"${name}" ya tiene una cuenta del panel (${accountOf(name).user}).`);
    const existing = memberByNick(name);
    if (existing && rankOf(existing.role) >= myRank()) return (err.textContent = "Esa persona tiene en el grupo un rol igual o mayor al tuyo.");
    const nick = existing ? existing.nick : name;
    const acc = { user, name: nick, nick, role, active: true, hash: await hashPass(user, pass), mustChange: true, createdBy: current.user, createdAt: isoToday() };
    accounts.push(acc);
    if (!saveAccounts()) return;
    // panel → grupo: misma persona, mismo apodo y mismo rol en el chat
    const m = memberFromAccount(acc);
    $("#accForm").reset();
    renderers.cuentas();
    alert(`✅ Cuenta creada\n\nUsuario: ${user}\nContraseña: ${pass}\nRol: ${roleById(role)?.name || role}\n${existing ? `Ya estaba en el grupo como "${nick}": ahora su rol en el chat también es ${roleById(role)?.name || role}.` : `Se agregó al grupo como "${nick}" (${m?.code || ""}).`}\n\nCópialos y entrégaselos en privado. Al entrar, le pediremos cambiar la contraseña.\nPara que funcione en otros computadores, ve a 🚀 Publicar.`);
  });
  $("#accRows").addEventListener("change", (e) => {
    const sel = e.target.closest("[data-accrole]");
    if (!sel) return;
    const a = findAcc(sel.closest("[data-acc]").dataset.acc);
    if (!a || !canManage(a) || !assignable().includes(sel.value)) { toast("🔒 Solo puedes dar roles menores al tuyo."); renderers.cuentas(); return; }
    a.role = sel.value;
    saveAccounts();
    memberFromAccount(a); // panel → grupo
    toast(`${a.user} ahora es ${roleById(a.role)?.name || a.role} · también en el grupo`);
    renderers.cuentas();
  });
  $("#accRows").addEventListener("click", async (e) => {
    if (e.target.closest("[data-accme]")) { openMe(); return; }
    const row = e.target.closest("[data-acc]");
    if (!row) return;
    const a = findAcc(row.dataset.acc);
    if (!a || !canManage(a)) return;
    if (e.target.closest("[data-accpass]")) {
      const pass = genPass();
      if (!confirm(`¿Darle una contraseña nueva a ${a.user}? La anterior deja de funcionar.`)) return;
      a.hash = await hashPass(a.user, pass);
      delete a.legacyHash;
      a.mustChange = true;
      saveAccounts();
      alert(`🔑 Nueva contraseña para ${a.user}:\n\n${pass}\n\nEntrégasela en privado. Al entrar, le pediremos cambiarla.`);
    } else if (e.target.closest("[data-acctoggle]")) {
      a.active = a.active === false;
      saveAccounts();
      toast(a.active ? `▶️ ${a.user} puede volver a entrar` : `⏸️ ${a.user} ya no puede entrar al panel`);
    } else if (e.target.closest("[data-accdel]")) {
      if (!confirm(`¿Borrar la cuenta ${a.user}? Ya no podrá entrar al panel.`)) return;
      accounts = accounts.filter((x) => x !== a);
      saveAccounts();
      toast(`🗑️ Cuenta ${a.user} borrada`);
    } else return;
    renderers.cuentas();
  });

  /* =====================================================
     Recuerdos (IndexedDB de este navegador)
     ===================================================== */
  function idbOpen() {
    return new Promise((res, rej) => {
      const r = indexedDB.open("parchemonos", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("media", { keyPath: "id" });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function idbRun(mode, fn) {
    const db = await idbOpen();
    return new Promise((res, rej) => {
      const tx = db.transaction("media", mode);
      const req = fn(tx.objectStore("media"));
      tx.oncomplete = () => res(req?.result);
      tx.onerror = () => rej(tx.error);
    });
  }
  let memUrls = [];
  renderers.recuerdos = async () => {
    memUrls.forEach((u) => URL.revokeObjectURL(u));
    memUrls = [];
    let items = [];
    try { items = await idbRun("readonly", (s) => s.getAll()); } catch { /* */ }
    items.sort((a, b) => b.createdAt - a.createdAt);
    const title = (id) => state.plans.find((p) => p.id === id)?.title || (id === "otro" ? "Otro plan" : "Plan del parche");
    $("#memRows").innerHTML = items.length ? items.map((m) => {
      const url = URL.createObjectURL(m.blob);
      memUrls.push(url);
      return `<div class="row" data-mid="${esc(m.id)}">
        <div class="row__img">${m.type === "video" ? `<video src="${url}" muted></video>` : `<img src="${url}" alt="" />`}</div>
        <div class="row__main">
          <b>${m.type === "video" ? "🎬" : "📸"} ${esc(title(m.planId))}</b>
          <small>${esc(m.caption || "Sin descripción")} · 👤 ${esc(m.author || "Anónimo")} · ${new Date(m.createdAt).toLocaleDateString("es-CO")}</small>
        </div>
        <div class="row__btns">
          ${m.type !== "video" ? `<button class="btn btn--ghost" data-mview="${url}">👁️ Ver</button>` : ""}
          <button class="btn btn--danger" data-mdel>🗑️ Borrar</button>
        </div>
      </div>`;
    }).join("") : `<div class="empty"><b>📸</b>No hay recuerdos subidos en este navegador.</div>`;
  };
  $("#memRows").addEventListener("click", async (e) => {
    const view = e.target.closest("[data-mview]");
    if (view) { $("#lightboxImg").src = view.dataset.mview; $("#lightbox").hidden = false; return; }
    const del = e.target.closest("[data-mdel]");
    if (!del || !confirm("¿Borrar este recuerdo?")) return;
    try { await idbRun("readwrite", (s) => s.delete(del.closest("[data-mid]").dataset.mid)); toast("🗑️ Recuerdo borrado"); } catch { toast("No se pudo borrar."); }
    renderers.recuerdos();
  });

  /* =====================================================
     Publicar, copia de seguridad y descartar
     ===================================================== */
  function download(name, content, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function siteData() {
    // solo se guardan los textos que cambiaron respecto al original
    const texts = Object.fromEntries(Object.entries(state.texts).filter(([k, v]) => defText[k] !== v));
    return {
      publishedAt: new Date().toISOString(),
      texts,
      imgs: state.imgs,
      plans: state.plans,
      quiz: state.quiz.filter((q) => q.q.trim()),
      stickers: state.stickers.filter((s) => s.e && s.t),
      blocked: state.blocked,
      settings: state.settings,
      roles: state.roles,
      // a la página pública solo va lo necesario: nada de nombres reales, ciudad ni edad
      members: state.members.map(({ nick, role, color, status, joinedAt, trialUntil, recommendedBy, demo, code, warnings }) => ({ nick, role, color, status, joinedAt, trialUntil, recommendedBy, demo, code: code || memberCode(nick), warnings: warnings || [] })),
      // para la cifra "Tolerancia al acoso": casos de acoso confirmados (sin datos de nadie)
      stats: {
        harassCases: loadReports().filter((r) => (r.status === "resuelto" || r.status === "expulsado") &&
          ["Acoso o mensajes insistentes", "Comentarios sexuales o piropos incómodos", "Fotos, videos o audios sin permiso", "Amenazas o violencia"].includes(r.reason)).length,
      },
      // cuentas del panel: viajan con la contraseña cifrada, nunca en texto normal
      adminAccounts: accounts.map(({ user, name, role, active, hash, legacyHash, mustChange, createdBy, createdAt }) => ({ user, name, role, active, hash, legacyHash, mustChange, createdBy, createdAt })),
    };
  }
  $("#publishBtn").addEventListener("click", async () => {
    const data = await siteData();
    const js = `/* Contenido publicado por los admins de ParchéMonos · ${new Date().toLocaleString("es-CO")}\n   Generado desde admin.html → Publicar. Reemplaza este archivo y súbelo con la página. */\nwindow.SITE_DATA = ${JSON.stringify(data, null, 1)};\n`;
    download("site-data.js", js, "text/javascript");
    toast("⬇ site-data.js descargado. Ponlo en la carpeta de la página y súbela.");
  });
  $("#backupBtn").addEventListener("click", async () => {
    const data = await siteData();
    data.reports = loadReports();
    data.requests = loadRequests();
    data.members = state.members; // la copia sí guarda los datos completos
    download(`copia-parchemonos-${today()}.json`, JSON.stringify(data, null, 2), "application/json");
  });
  $("#restoreBtn").addEventListener("click", () => $("#restoreInput").click());
  $("#restoreInput").addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!confirm("¿Cargar esta copia? Reemplaza los cambios actuales de este navegador.")) return;
      if (data.texts) lsSet(KEYS.texts, { ...state.texts, ...data.texts });
      if (data.imgs) lsSet(KEYS.imgs, data.imgs);
      if (data.plans) lsSet(KEYS.plans, data.plans);
      if (data.quiz) lsSet(KEYS.quiz, data.quiz);
      if (data.stickers) lsSet(KEYS.stickers, data.stickers);
      if (data.blocked) lsSet(KEYS.blocked, data.blocked);
      if (data.settings) lsSet(KEYS.settings, data.settings);
      if (Array.isArray(data.adminAccounts) && data.adminAccounts.length) lsSet(ACC_KEY, data.adminAccounts);
      else if (data.adminPinHash) lsSet("pm_admin_pin_hash", data.adminPinHash);
      if (Array.isArray(data.reports)) lsSet("pm_reports", data.reports);
      if (Array.isArray(data.requests)) lsSet("pm_requests", data.requests);
      if (Array.isArray(data.members)) lsSet(KEYS.members, data.members);
      if (Array.isArray(data.roles)) lsSet(KEYS.roles, data.roles);
      toast("✅ Copia cargada");
      setTimeout(() => location.reload(), 700);
    } catch {
      toast("Ese archivo no es una copia válida.");
    }
  });
  $("#discardBtn").addEventListener("click", () => {
    if (!confirm("¿Descartar TODOS tus cambios de este navegador y volver a lo publicado?")) return;
    Object.values(KEYS).forEach((k) => { try { localStorage.removeItem(k); } catch { /* */ } });
    toast("🧹 Cambios descartados");
    setTimeout(() => location.reload(), 600);
  });

  // Empezar desde cero: borra todo menos roles, reglas, test, cuentas y seguridad
  $("#wipeBtn").addEventListener("click", () => {
    if (myRank() < RANK.cofundador) { toast("🔒 Solo el Fundador o el Co Fundador pueden hacer esto."); return; }
    if (!confirm("¿Borrar TODO y empezar de cero?\n\nSe borran miembros, solicitudes, reportes, parches, recuerdos, imágenes y textos.\nSe conservan roles, reglas, test, cuentas del panel y seguridad.")) return;
    if (prompt('Para confirmar escribe: BORRAR') !== "BORRAR") { toast("Cancelado: no se borró nada."); return; }
    const KEEP = ["pm_roles", "pm_quiz", "pm_settings", ACC_KEY, "pm_admin_pin_hash", "pm_blocked", "pm_blocked_reason", "pm_blocked_ips", "pm_reset"];
    const rules = Object.fromEntries(Object.entries(state.texts || {}).filter(([k]) => /^rules?\d*\./.test(k)));
    try {
      Object.keys(localStorage).filter((k) => k.startsWith("pm_") && !KEEP.includes(k)).forEach((k) => localStorage.removeItem(k));
      // vacío explícito para que no vuelvan los de site-data.js
      lsSet(KEYS.members, []);
      lsSet(KEYS.plans, []);
      lsSet(KEYS.imgs, {});
      lsSet(KEYS.texts, rules);
      lsSet(KEYS.roles, state.roles);
      lsSet(KEYS.quiz, state.quiz);
    } catch { /* */ }
    try { indexedDB.deleteDatabase("parchemonos"); } catch { /* */ }
    toast("🧨 Listo: todo quedó en cero");
    setTimeout(() => location.reload(), 800);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    $("#lightbox").hidden = true;
    if (!pm.hidden) closePlanEditor();
  });

  // solicitudes nuevas en vivo (cuando alguien la envía desde otra pestaña de este navegador)
  window.addEventListener("storage", (e) => {
    if (e.key !== "pm_requests") return;
    updateReqBadge();
    if (!$('.pane[data-pane="solicitudes"]').hidden) renderers.solicitudes();
    if (!$('.pane[data-pane="resumen"]').hidden) renderers.resumen();
    toast("🙋 ¡Llegó una solicitud nueva!");
  });

  // si ya entró en esta pestaña, abre el panel directo
  // arranque: carga las cuentas y, si ya inició sesión en esta pestaña, abre el panel directo
  loadAccounts().then(() => {
    let user = null;
    try { user = sessionStorage.getItem("pm_admin_user"); } catch { /* */ }
    const acc = findAcc(user);
    if (acc && acc.active !== false) { current = acc; showAdmin(); }
    else if (!accounts.length) { pinView.hidden = true; $("#setupView").hidden = false; $("#setupUser").focus(); }
    else $("#loginUser").focus();
  });
})();
