/* ParchéMonos · interacciones de la landing */
(() => {
  "use strict";

  /* ================== CONFIGURACIÓN ==================
     Todo se edita desde el panel de admins (admin.html → Seguridad y ajustes).
     Valores por defecto en content.js · publicados en site-data.js.
  ===================================================== */
  const DATA = window.PM_DATA;
  const DEFAULTS = window.PM_DEFAULTS;
  const CONFIG = { ...DATA.settings };

  // Miembros y roles (los admins los cambian en admin.html → Miembros y roles)
  const readLS = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
  const readMembers = () => readLS("pm_members") || window.SITE_DATA?.members || DEFAULTS.MEMBERS;
  const readRoles = () => readLS("pm_roles") || window.SITE_DATA?.roles || DEFAULTS.ROLES;
  let members = DATA.members;
  let roles = DATA.roles;
  function memberByNick(nick) {
    if (!nick) return null;
    const n = String(nick).trim().toLowerCase();
    return members.find((m) => m.nick.toLowerCase() === n) || null;
  }
  function roleById(id) { return roles.find((r) => r.id === id) || roles.find((r) => r.id === "miembro") || roles[0]; }

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* modo privado */ } },
  };
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Opciones tipo tarjeta (privado/público, normal/recomendación): se marcan también
  // en navegadores que no entienden :has() (Safari < 15.4, Firefox viejo)
  function markVisOpts() { $$(".vis__opt input[type=radio]").forEach((r) => r.closest(".vis__opt").classList.toggle("is-checked", r.checked)); }
  document.addEventListener("change", (e) => { if (e.target.matches?.(".vis__opt input[type=radio]")) markVisOpts(); });
  document.addEventListener("reset", () => setTimeout(markVisOpts, 0), true);
  markVisOpts();

  // Imágenes cambiadas por los admins. { slot: dataURL }
  const customImgs = DATA.imgs;
  const slotImg = (slot, fallback) => customImgs[slot] || fallback;

  /* ---------------- Textos editables (data-text="clave") ---------------- */
  // **negrita** y saltos de línea; todo lo demás se muestra tal cual
  const richText = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br />");
  function applyTexts() {
    const T = DATA.texts;
    $$("[data-text]").forEach((el) => {
      const v = T[el.dataset.text];
      if (v == null) return;
      el.innerHTML = el.hasAttribute("data-bullets")
        ? v.split("•").map((p) => richText(p.trim())).join(" <i>•</i> ")
        : richText(v);
    });
    // cifras: "+250", "100%", "60"…
    $$("[data-stat]").forEach((el) => {
      const v = T[el.dataset.stat];
      if (v == null) return;
      const m = String(v).match(/^(\D*)(\d+)(\D*)$/);
      if (m) { el.dataset.prefix = m[1]; el.dataset.count = m[2]; el.dataset.suffix = m[3]; }
      else { el.dataset.count = "0"; el.dataset.prefix = String(v); el.dataset.suffix = ""; }
    });
    // cinta que se mueve
    if (T.marquee != null) {
      const words = T.marquee.split(",").map((w) => w.trim()).filter(Boolean);
      const once = words.map((w) => `<span>${esc(w)}</span><b>✦</b>`).join("");
      const track = $("[data-marquee]");
      if (track && words.length) track.innerHTML = once + once;
    }
  }
  applyTexts();

  /* ---------------- Toast ---------------- */
  const toastEl = $("#toast");
  let toastTimer;
  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-on"), 2800);
  }

  /* =====================================================
     1. Ventana +18
     ===================================================== */
  const gate = $("#gate");
  const birth = $("#birthdate");
  const ageInput = $("#ageInput");
  const gateErr = $("#gateError");
  const today = new Date();
  birth.max = today.toISOString().slice(0, 10);
  birth.min = "1900-01-01";

  const STEP_IDS = ["gateSec", "gateAsk", "gateRules", "gateQuiz", "gateResult", "gateNo"];
  function showStep(id, stepNum) {
    STEP_IDS.forEach((s) => ($("#" + s).hidden = s !== id));
    const steps = $("#gateSteps");
    steps.hidden = id === "gateNo";
    $$("li", steps).forEach((li, i) => {
      li.classList.toggle("is-active", i + 1 === stepNum);
      li.classList.toggle("is-done", i + 1 < stepNum);
    });
    gate.scrollTop = 0;
  }

  // la ventana no se borra: si luego la IP sale bloqueada, se vuelve a mostrar
  function openSite() {
    gate.classList.add("is-out");
    document.body.classList.remove("is-locked");
  }
  function closeSite() {
    gate.classList.remove("is-out");
    document.body.classList.add("is-locked");
  }

  /* --- Bloqueo para menores: se guarda en localStorage + cookie --- */
  const isBlocked = () => store.get("pm_blocked") === "1" || /(?:^|;\s*)pm_blocked=(1|menor|mayor|ip)/.test(document.cookie);
  const AGE_MIN = +CONFIG.AGE_MIN || 18;
  const AGE_MAX = +CONFIG.AGE_MAX || 36;
  const BLOCK_MSG = {
    menor: {
      title: "Todavía no, parcero",
      text: `Este parche es para personas de ${AGE_MIN} a ${AGE_MAX} años. Cuando cumplas ${AGE_MIN}, aquí te esperamos con los brazos abiertos. Mientras tanto, cuídate mucho y sal con tu gente de confianza. 🫶`,
    },
    mayor: {
      title: "Este parche no es pa' ti",
      text: `ParchéMonos es un grupo para personas de ${AGE_MIN} a ${AGE_MAX} años. Gracias por el interés, de verdad. ¡Que encuentres un parche que te quede perfecto! 💜`,
    },
    ip: {
      title: "Acceso bloqueado",
      text: "Tu conexión (IP) está bloqueada en ParchéMonos por no cumplir las reglas del grupo. Si crees que es un error, comunícate con los administradores.",
    },
    vpn: {
      title: "Apaga tu VPN, parcero",
      text: "Detectamos una conexión desde un servidor, VPN o proxy. Para cuidar al parche de bots y perfiles falsos, entra desde tu conexión normal (wifi o datos del celular).",
      temp: true,
    },
    pais: {
      title: "Fuera de zona",
      text: "Por ahora ParchéMonos solo está disponible para conexiones desde los países donde hacemos planes.",
      temp: true,
    },
    bot: {
      title: "Demasiados intentos",
      text: "Detectamos un comportamiento automático (bot). Por seguridad bloqueamos el acceso un rato. Intenta de nuevo más tarde.",
      temp: true,
    },
  };
  function showBlocked(reason, extra = "") {
    const msg = BLOCK_MSG[reason] || BLOCK_MSG.menor;
    $("#blockTitle").textContent = msg.title;
    $("#blockText").textContent = msg.text + (extra ? ` ${extra}` : "");
    $("#blockTag").textContent = reason === "ip" && ipData?.ip ? `🚫 IP bloqueada: ${ipData.ip}` : msg.temp ? "⏳ Acceso restringido" : "🚫 Acceso bloqueado en este navegador";
    $("#blockRetry").hidden = !msg.temp;
    closeSite();
    showStep("gateNo");
  }
  function blockForever(reason) {
    store.set("pm_blocked", "1");
    store.set("pm_blocked_reason", reason);
    store.set("pm_age_ok", "0");
    store.set("pm_access", "0");
    try { document.cookie = `pm_blocked=${reason}; max-age=31536000; path=/; SameSite=Lax`; } catch { /* file:// */ }
    // también se guarda la IP, para reconocerla aunque cambie de usuario en este equipo
    if (ipData?.ip) {
      const ips = new Set(JSON.parse(store.get("pm_blocked_ips") || "[]"));
      ips.add(ipData.ip);
      store.set("pm_blocked_ips", JSON.stringify([...ips]));
    }
    showBlocked(reason);
  }
  const blockedReason = () => store.get("pm_blocked_reason") || (document.cookie.match(/(?:^|;\s*)pm_blocked=(menor|mayor|ip)/) || [])[1] || "menor";
  $("#blockRetry").addEventListener("click", () => location.reload());

  /* =====================================================
     Paso 1: seguridad (IP + anti-bot)
     ===================================================== */
  let ipData = null;
  const pageLoadedAt = performance.now();
  const chkIp = $("#chkIp");
  const chkBot = $("#chkBot");
  const holdBtn = $("#holdBtn");
  const secError = $("#secError");
  const SEC = { holdMs: 1800, minPageMs: 2500, maxFails: 5, lockMin: 15, okHours: 24 };
  const sec = { ip: false, bot: false };
  const setCheck = (li, state, text) => { li.dataset.state = state; if (text != null) $("small", li).textContent = text; };

  // Proveedores de servidores / VPN conocidos (de ahí salen casi todos los bots)
  const DATACENTER = /amazon|aws|google cloud|googlecloud|microsoft|azure|digitalocean|ovh|hetzner|linode|akamai|vultr|choopa|contabo|leaseweb|m247|datacamp|cdn77|hostinger|ionos|scaleway|oracle|alibaba|tencent|nordvpn|expressvpn|surfshark|proton|mullvad|private internet|hide\.me|cyberghost|windscribe|\btor\b|vpn|proxy|hosting|data ?center|server/i;

  async function lookupIp() {
    try {
      const r = await fetch("https://ipapi.co/json/", { cache: "no-store" });
      const j = await r.json();
      if (!j.ip || j.error) throw new Error("ipapi");
      return { ip: j.ip, country: j.country_code, countryName: j.country_name, city: j.city, org: j.org || "" };
    } catch {
      try {
        const r = await fetch("https://api.ipify.org?format=json", { cache: "no-store" });
        const j = await r.json();
        return j.ip ? { ip: j.ip, country: "", countryName: "", city: "", org: "" } : null;
      } catch { return null; }
    }
  }

  // Devuelve el motivo de bloqueo o null si la IP está bien
  function ipVerdict(d) {
    if (!d) return null;
    const localBlocked = JSON.parse(store.get("pm_blocked_ips") || "[]");
    if (CONFIG.BLOCKED_IPS.includes(d.ip) || localBlocked.includes(d.ip)) return "ip";
    if (CONFIG.ALLOWED_COUNTRIES.length && d.country && !CONFIG.ALLOWED_COUNTRIES.includes(d.country)) return "pais";
    if (CONFIG.BLOCK_DATACENTER && d.org && DATACENTER.test(d.org)) return "vpn";
    return null;
  }

  async function runIpCheck({ silent = false } = {}) {
    if (!silent) setCheck(chkIp, "loading", "Revisando tu conexión…");
    ipData = await lookupIp();
    const verdict = ipVerdict(ipData);
    if (verdict === "ip") { blockForever("ip"); return false; }
    if (verdict) { showBlocked(verdict); return false; }
    if (silent) return true;
    if (ipData) {
      const where = [ipData.city, ipData.countryName].filter(Boolean).join(", ");
      setCheck(chkIp, "ok", `IP ${ipData.ip}${where ? ` · ${where}` : ""} · conexión segura`);
    } else {
      // sin internet o un bloqueador de anuncios impidió la consulta: no castigamos a la persona
      setCheck(chkIp, "warn", "No pudimos revisar tu IP (¿bloqueador de anuncios?). Puedes continuar.");
    }
    sec.ip = true;
    finishSecurity();
    return true;
  }

  /* --- Anti-bot: "mantén presionado" + señales de navegador automatizado --- */
  const botLockUntil = () => +(store.get("pm_bot_lock") || 0);
  function botFail(why) {
    const fails = +(store.get("pm_bot_fails") || 0) + 1;
    store.set("pm_bot_fails", String(fails));
    if (fails >= SEC.maxFails) {
      store.set("pm_bot_lock", String(Date.now() + SEC.lockMin * 60000));
      store.set("pm_bot_fails", "0");
      showBlocked("bot", `Podrás intentarlo en ${SEC.lockMin} minutos.`);
      return;
    }
    setCheck(chkBot, "fail", why);
    secError.textContent = `Te quedan ${SEC.maxFails - fails} intento${SEC.maxFails - fails === 1 ? "" : "s"}.`;
  }
  function looksAutomated() {
    if (navigator.webdriver) return "Navegador automatizado detectado.";
    if ($("#hpField").value) return "Se detectó un bot.";
    if (/headless|phantomjs|puppeteer|playwright|selenium/i.test(navigator.userAgent)) return "Navegador automatizado detectado.";
    if (performance.now() - pageLoadedAt < SEC.minPageMs) return "Demasiado rápido. Tómatelo con calma 😉";
    return null;
  }

  let holdStart = 0;
  let holdRaf = 0;
  const holdFill = $(".hold__fill", holdBtn);
  function holdBegin(e) {
    if (sec.bot || holdStart) return;
    if (e && e.isTrusted === false) { botFail("Se detectó un clic automático."); return; }
    secError.textContent = "";
    holdStart = performance.now();
    holdBtn.classList.add("is-holding");
    setCheck(chkBot, "loading", "Sigue presionando…");
    const tick = (t) => {
      const p = Math.min((t - holdStart) / SEC.holdMs, 1);
      holdFill.style.width = `${p * 100}%`;
      if (p >= 1) { holdComplete(); return; }
      holdRaf = requestAnimationFrame(tick);
    };
    holdRaf = requestAnimationFrame(tick);
  }
  function holdCancel() {
    if (!holdStart || sec.bot) return;
    cancelAnimationFrame(holdRaf);
    holdStart = 0;
    holdBtn.classList.remove("is-holding");
    holdFill.style.width = "0";
    setCheck(chkBot, "idle", "Soltaste muy rápido. Mantén presionado hasta que se llene.");
  }
  function holdComplete() {
    cancelAnimationFrame(holdRaf);
    holdStart = 0;
    holdBtn.classList.remove("is-holding");
    const why = looksAutomated();
    if (why) { holdFill.style.width = "0"; botFail(why); return; }
    holdBtn.classList.add("is-done");
    holdBtn.disabled = true;
    $("#holdLabel").textContent = "✓ Eres una persona real";
    passBot();
  }
  function passBot() {
    sec.bot = true;
    store.set("pm_bot_fails", "0");
    setCheck(chkBot, "ok", "Verificado: eres una persona real 🙌");
    finishSecurity();
  }
  holdBtn.addEventListener("pointerdown", (e) => { holdBtn.setPointerCapture?.(e.pointerId); holdBegin(e); });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) => holdBtn.addEventListener(ev, holdCancel));
  holdBtn.addEventListener("contextmenu", (e) => e.preventDefault());
  // accesible con teclado: mantener Espacio o Enter
  holdBtn.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); holdBegin(e); } });
  holdBtn.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") holdCancel(); });

  // Captcha opcional de Cloudflare Turnstile
  function setupTurnstile() {
    if (!CONFIG.TURNSTILE_SITE_KEY) return;
    holdBtn.hidden = true;
    const box = $("#turnstileBox");
    box.hidden = false;
    setCheck(chkBot, "loading", "Cargando verificación…");
    window.onTurnstileLoad = () => {
      window.turnstile.render(box, {
        sitekey: CONFIG.TURNSTILE_SITE_KEY,
        theme: "dark",
        language: "es",
        callback: (token) => { store.set("pm_ts_token", token); passBot(); },
        "error-callback": () => setCheck(chkBot, "fail", "No se pudo verificar. Recarga la página."),
      });
      setCheck(chkBot, "idle", "Completa la verificación de abajo");
    };
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit";
    s.async = true;
    document.head.appendChild(s);
  }

  function finishSecurity() {
    if (!sec.ip || !sec.bot) return;
    store.set("pm_sec_ok", String(Date.now()));
    setTimeout(() => {
      if (store.get("pm_age_ok") === "1") goRules();
      else { showStep("gateAsk", 2); birth.focus({ preventScroll: true }); }
    }, 900);
  }
  const secStillValid = () => Date.now() - +(store.get("pm_sec_ok") || 0) < SEC.okHours * 3600000;

  /* --- Paso 1: verificación de edad (la edad se calcula sola) --- */
  function ageFromBirth() {
    if (!birth.value) return null;
    const d = new Date(birth.value + "T00:00:00");
    if (isNaN(d) || d > today || d.getFullYear() < 1900) return NaN;
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
    return age;
  }
  function updateAge() {
    const age = ageFromBirth();
    gateErr.textContent = "";
    ageInput.value = age == null || isNaN(age) ? "" : `${age} año${age === 1 ? "" : "s"}`;
  }
  birth.addEventListener("input", updateAge);
  birth.addEventListener("change", updateAge);

  $("#gateForm").addEventListener("submit", (e) => {
    e.preventDefault();
    gateErr.textContent = "";
    const age = ageFromBirth();
    if (age == null) { gateErr.textContent = "Pon tu fecha de nacimiento, parcero."; return; }
    if (isNaN(age)) { gateErr.textContent = "Esa fecha no cuadra. Revísala porfa."; return; }
    if (age < AGE_MIN) { blockForever("menor"); return; }
    if (age > AGE_MAX) { blockForever("mayor"); return; }
    store.set("pm_age_ok", "1");
    store.set("pm_age", String(age));
    goRules();
  });

  /* --- Paso 2: leer las reglas hasta el final --- */
  const rulesBox = $("#gateRulesBox");
  const rulesDone = $("#rulesDone");
  const rulesHint = $("#rulesHint");
  function checkRulesRead() {
    if (rulesBox.scrollTop + rulesBox.clientHeight >= rulesBox.scrollHeight - 12) {
      rulesDone.disabled = false;
      rulesHint.textContent = "✓ Reglas leídas";
      rulesHint.classList.add("is-done");
    }
  }
  rulesBox.addEventListener("scroll", checkRulesRead, { passive: true });
  function goRules() {
    showStep("gateRules", 3);
    rulesBox.scrollTop = 0;
    requestAnimationFrame(checkRulesRead); // pantallas grandes donde no hay scroll
  }
  rulesDone.addEventListener("click", startQuiz);

  /* --- Paso 3: test de 10 preguntas --- */
  // type: "choice" (respuesta concreta), "yesno" (sí o no), "tf" (falso o verdadero)
  const QUESTIONS = DATA.quiz;
  const TYPE_LABEL = { choice: "Respuesta concreta", yesno: "Sí o No", tf: "Falso o Verdadero" };
  const TWO_OPTS = {
    yesno: [{ v: "Sí", icon: "👍" }, { v: "No", icon: "👎" }],
    tf: [{ v: "Verdadero", icon: "✅" }, { v: "Falso", icon: "❌" }],
  };
  const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  const qOpts = $("#qOpts");
  const qNext = $("#qNext");
  const qPrev = $("#qPrev");
  let quiz = null;

  function startQuiz() {
    quiz = {
      items: shuffle(QUESTIONS).map((q) => ({ ...q, opts: q.type === "choice" ? shuffle(q.opts) : null })),
      answers: [],
      i: 0,
    };
    showStep("gateQuiz", 4);
    renderQ();
  }

  function renderQ() {
    const { items, answers, i } = quiz;
    const q = items[i];
    $("#qCount").textContent = `Pregunta ${i + 1} de ${items.length}`;
    $("#qBar").style.width = `${(i / items.length) * 100}%`;
    $("#qType").textContent = TYPE_LABEL[q.type];
    $("#qText").textContent = q.q;
    const two = q.type !== "choice";
    qOpts.classList.toggle("quiz__opts--two", two);
    const opts = two ? TWO_OPTS[q.type] : q.opts.map((v, k) => ({ v, icon: "ABCD"[k] }));
    qOpts.innerHTML = opts.map((o) =>
      `<button type="button" class="opt" role="radio" aria-checked="${answers[i] === o.v}" data-v="${esc(o.v)}"><span class="opt__key">${o.icon}</span><span>${esc(o.v)}</span></button>`
    ).join("");
    qPrev.style.visibility = i === 0 ? "hidden" : "visible";
    qNext.textContent = i === items.length - 1 ? "Ver resultado" : "Siguiente";
    qNext.disabled = answers[i] == null;
  }

  qOpts.addEventListener("click", (e) => {
    const b = e.target.closest(".opt");
    if (!b) return;
    quiz.answers[quiz.i] = b.dataset.v;
    $$(".opt", qOpts).forEach((o) => o.setAttribute("aria-checked", String(o === b)));
    qNext.disabled = false;
  });
  qPrev.addEventListener("click", () => { if (quiz.i > 0) { quiz.i--; renderQ(); } });
  qNext.addEventListener("click", () => {
    if (quiz.answers[quiz.i] == null) return;
    if (quiz.i < quiz.items.length - 1) { quiz.i++; renderQ(); } else showResult();
  });

  function showResult() {
    $("#qBar").style.width = "100%";
    const wrong = quiz.items.filter((q, i) => quiz.answers[i] !== q.a).map((q) => ({ q, given: quiz.answers[quiz.items.indexOf(q)] }));
    const score = quiz.items.length - wrong.length;
    const list = $("#resList");
    const actions = $("#resActions");
    showStep("gateResult", 4);

    if (!wrong.length) {
      store.set("pm_access", "1");
      $("#resEmoji").textContent = "🎉";
      $("#resTitle").textContent = "¡Bienvenido al parche!";
      $("#resText").textContent = `Sacaste ${score}/${quiz.items.length}. Tienes clarito cómo nos cuidamos. Ahora sí: ¿pa' dónde vamos?`;
      list.innerHTML = "";
      actions.innerHTML = `<button type="button" class="btn btn--grad btn--block" id="resEnter">Entrar al parche 🔥</button>`;
      $$(".steps li").forEach((li) => { li.classList.remove("is-active"); li.classList.add("is-done"); });
      $("#resEnter").addEventListener("click", openSite);
      return;
    }

    $("#resEmoji").textContent = "📚";
    $("#resTitle").textContent = "Casi, parcero";
    $("#resText").textContent = `Sacaste ${score}/${quiz.items.length}. Para entrar tienes que responder bien las 10. Mira en qué fallaste:`;
    list.innerHTML = wrong.map(({ q, given }) =>
      `<li><b>${esc(q.q)}</b><span>Respondiste: ${esc(given)} · Correcta: <em>${esc(q.a)}</em></span></li>`
    ).join("");
    actions.innerHTML = `
      <button type="button" class="btn btn--grad btn--block" id="resRetry">Repetir el test</button>
      <button type="button" class="btn btn--ghost btn--block" id="resRules">Volver a leer las reglas</button>`;
    $("#resRetry").addEventListener("click", startQuiz);
    $("#resRules").addEventListener("click", goRules);
  }

  /* --- Estado inicial --- */
  if (isBlocked()) {
    showBlocked(blockedReason());
  } else if (botLockUntil() > Date.now()) {
    const mins = Math.ceil((botLockUntil() - Date.now()) / 60000);
    showBlocked("bot", `Podrás intentarlo en ${mins} minuto${mins === 1 ? "" : "s"}.`);
  } else if (store.get("pm_access") === "1") {
    // ya entró antes: abrimos de una, pero la IP se revisa en segundo plano en cada visita
    gate.classList.add("is-out");
    document.body.classList.remove("is-locked");
    runIpCheck({ silent: true });
  } else if (secStillValid()) {
    runIpCheck({ silent: true });
    if (store.get("pm_age_ok") === "1") goRules();
    else showStep("gateAsk", 2);
  } else {
    showStep("gateSec", 1);
    setupTurnstile();
    runIpCheck();
  }

  /* =====================================================
     2. Menú
     ===================================================== */
  const nav = $("#nav");
  const burger = $("#burger");
  const links = $("#navLinks");
  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 20);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  function closeMenu() { links.classList.remove("is-open"); burger.setAttribute("aria-expanded", "false"); }
  burger.addEventListener("click", () => {
    const open = links.classList.toggle("is-open");
    burger.setAttribute("aria-expanded", String(open));
  });
  $$("a", links).forEach((a) => a.addEventListener("click", closeMenu));
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closeMenu(); closeJoin(); closeReport(); closeLightbox(); toggleMedia(false); closePlan(); closeMem(); closeMyAcc(); closeProfile();
  });

  $$("[data-goto]").forEach((b) => b.addEventListener("click", () => $(b.dataset.goto)?.scrollIntoView({ behavior: "smooth" })));

  /* =====================================================
     Reveal al hacer scroll (con escalonado entre hermanos)
     ===================================================== */
  $$(".cards, .events, .rules__list, .stats__grid, .rules__big").forEach((group) => {
    $$(".reveal", group).forEach((el, i) => el.style.setProperty("--d", `${Math.min(i, 6) * 0.08}s`));
  });
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
  const observeReveals = () => $$(".reveal:not(.is-in)").forEach((el) => io.observe(el));
  observeReveals();

  /* =====================================================
     Brillo de borde siguiendo el mouse
     ===================================================== */
  document.addEventListener("pointermove", (e) => {
    const card = e.target.closest?.(".card, .event");
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - r.left}px`);
    card.style.setProperty("--my", `${e.clientY - r.top}px`);
  }, { passive: true });

  /* =====================================================
     6. Contadores
     ===================================================== */
  const countIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      countIO.unobserve(en.target);
      const el = en.target;
      el.dataset.seen = "1";
      const pre = el.dataset.prefix || "";
      const suf = el.dataset.suffix || "";
      if (el.hasAttribute("data-static") || reduceMotion) { el.textContent = pre + el.dataset.count + suf; return; }
      const dur = 1800;
      const t0 = performance.now();
      const tick = (t) => {
        const p = Math.min((t - t0) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 4);
        // lee el número en cada cuadro por si se actualiza mientras anima
        el.textContent = pre + Math.round(+el.dataset.count * eased) + suf;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.5 });
  $$("[data-count]").forEach((el) => countIO.observe(el));

  /* =====================================================
     7. Próximos parches
     ===================================================== */
  const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
  const AV_COLORS = ["#ff3df0", "#b14dff", "#f5ff3d", "#3dffd0", "#ff9f3d"];

  const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const fromISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const cap1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  function fmtTime(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "a. m." : "p. m."}`;
  }
  function daysUntil(iso) {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return Math.round((fromISO(iso) - t) / 864e5);
  }
  function whenLabel(n) {
    if (n < 0) return "Ya se hizo";
    if (n === 0) return "¡Hoy!";
    if (n === 1) return "Mañana";
    if (n < 7) return `En ${n} días`;
    if (n < 14) return "En 1 semana";
    return `En ${Math.floor(n / 7)} semanas`;
  }

  const CATS = DEFAULTS.CATS;
  const catOf = (name) => CATS.find((c) => c.name === name) || CATS[CATS.length - 1];

  // Parches de ejemplo (los que propone la gente se guardan aparte)
  const SEED_PLANS = DATA.plans;

  const loadJSON = (k, fb) => { try { return JSON.parse(store.get(k) || "") ?? fb; } catch { return fb; } };
  let userPlans = loadJSON("pm_plans", []);
  const going = new Set(loadJSON("pm_going", []));
  const myVotes = loadJSON("pm_votes", {});
  const myPolls = loadJSON("pm_polls", {});
  const saveState = () => {
    store.set("pm_going", JSON.stringify([...going]));
    store.set("pm_votes", JSON.stringify(myVotes));
    store.set("pm_polls", JSON.stringify(myPolls));
  };
  function saveUserPlans() {
    try { localStorage.setItem("pm_plans", JSON.stringify(userPlans)); return true; } catch { return false; }
  }
  const allPlans = () => [...SEED_PLANS, ...userPlans];
  const planById = (id) => allPlans().find((p) => p.id === id);

  const evWrap = $("#events");
  let planFilter = "all";
  let firstRender = true;

  function planCard(p, i) {
    const d = fromISO(p.date);
    const c = catOf(p.cat);
    const n = daysUntil(p.date);
    const past = n < 0;
    const on = going.has(p.id);
    const voted = !!myVotes[p.id];
    const votes = (p.votes || 0) + (voted ? 1 : 0);
    const people = (p.going || 0) + (on ? 1 : 0);
    const full = p.cap && people >= p.cap && !on;
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}`;
    const longDate = cap1(d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined }));

    let poll = "";
    if (p.poll) {
      const mine = myPolls[p.id];
      const counts = p.poll.options.map((o, k) => (o.v || 0) + (mine === k ? 1 : 0));
      const total = counts.reduce((a, b) => a + b, 0);
      poll = `
        <div class="poll">
          <p class="poll__q">🗳️ ${esc(p.poll.q)}</p>
          ${p.poll.options.map((o, k) => {
            const pct = total ? Math.round((counts[k] / total) * 100) : 0;
            return `<button type="button" class="poll__opt ${mine === k ? "is-mine" : ""}" data-poll="${p.id}" data-opt="${k}" aria-pressed="${mine === k}">
              <span class="poll__bar" style="width:${pct}%"></span>
              <span class="poll__t">${mine === k ? "✓ " : ""}${esc(o.t)}</span><span class="poll__pct">${pct}%</span></button>`;
          }).join("")}
          <small>${total} voto${total === 1 ? "" : "s"} · toca una opción para votar</small>
        </div>`;
    }

    const initials = p.initials || [(p.author || "?").slice(0, 2).toUpperCase()];
    const img = slotImg(`plan-${p.id}`, p.img);
    return `
    <article class="event reveal ${firstRender ? "" : "is-in"}" data-id="${esc(p.id)}" style="--d:${Math.min(i, 6) * 0.08}s">
      <div class="event__media" data-slot="plan-${esc(p.id)}">
        ${img ? `<img src="${esc(img)}" alt="Imagen del parche ${esc(p.title)}" loading="lazy" />` : `<span class="event__ph" aria-hidden="true">${c.icon}</span>`}
        <div class="event__date" aria-hidden="true">
          <small>${DAYS[d.getDay()]}</small><b>${d.getDate()}</b><small>${MONTHS[d.getMonth()]}</small>
        </div>
        <span class="event__cat">${c.icon} ${esc(p.cat)}</span>
        <span class="event__when ${n >= 0 && n <= 1 ? "event__when--soon" : ""}">${whenLabel(n)}</span>
      </div>
      <div class="event__inner">
        <div class="event__body">
          <h3>${esc(p.title)}</h3>
          <p class="event__fulldate">📅 ${esc(longDate)} · 🕓 ${fmtTime(p.time)}</p>
          <p class="event__meta">
            <span>📍 <a href="${mapUrl}" target="_blank" rel="noopener noreferrer">${esc(p.address)}</a></span>
            ${p.meet ? `<span>🚩 ${esc(p.meet)}</span>` : ""}
            ${p.cap ? `<span>👥 Cupos: ${people}/${p.cap}</span>` : ""}
          </p>
          <p class="event__desc">${esc(p.desc)}</p>
          <p class="event__author">Propuesto por <b>${esc(p.author || "Anónimo")}</b>
            ${p.own ? `<button type="button" data-del="${esc(p.id)}">🗑️ Borrar</button>` : `<button type="button" data-rep="${esc(p.id)}">⚑ reportar</button>`}
          </p>
        </div>
        ${poll}
        <div class="event__foot">
          <div class="going--wrap">
            <button type="button" class="vote ${voted ? "is-on" : ""}" data-vote="${esc(p.id)}" aria-pressed="${voted}" aria-label="Votar por este parche">
              <span>🔥</span> <b>${votes}</b>
            </button>
            <div class="going">
              <div class="avatars" aria-hidden="true">${initials.map((x, k) => `<span style="background:${AV_COLORS[(i + k) % AV_COLORS.length]}">${esc(x)}</span>`).join("")}</div>
              <span><b>${people}</b> ${past ? "fueron" : "van"}</span>
            </div>
          </div>
          ${past
            ? `<button class="btn btn--ghost btn--sm" data-mem="${esc(p.id)}">📸 Subir recuerdos</button>`
            : `<button class="btn btn--grad btn--sm ${on ? "is-on" : ""}" data-go="${esc(p.id)}" aria-pressed="${on}" ${full ? "disabled" : ""}>${on ? "✓ Vas" : full ? "Lleno" : "Me apunto"}</button>`}
        </div>
      </div>
    </article>`;
  }

  // filtro por categoría que viene de las tarjetas de "¿Qué es el parche?"
  let catFilter = null; // { cats: [...], label }
  const catBar = document.createElement("div");
  catBar.className = "cat-filter";
  catBar.hidden = true;
  evWrap.before(catBar);
  catBar.addEventListener("click", (e) => {
    if (e.target.closest("[data-catclear]")) { catFilter = null; setChip("all"); renderPlans(); }
  });
  function setChip(f) {
    planFilter = f;
    $$("#planFilters .chip").forEach((c) => { c.classList.toggle("is-active", c.dataset.filter === f); c.setAttribute("aria-selected", String(c.dataset.filter === f)); });
  }

  function renderPlans() {
    let list = allPlans();
    if (catFilter) list = list.filter((p) => catFilter.cats.includes(p.cat));
    catBar.hidden = !catFilter;
    if (catFilter) catBar.innerHTML = `<span>Mostrando parches de <b>${esc(catFilter.label)}</b> · ${list.length} plan${list.length === 1 ? "" : "es"}</span><button type="button" class="btn btn--ghost btn--sm" data-catclear>✕ Ver todos</button>`;
    if (planFilter === "mine") list = list.filter((p) => p.own);
    else if (["aire", "noche", "comida"].includes(planFilter)) list = list.filter((p) => catOf(p.cat).tag === planFilter);
    if (planFilter === "top") list.sort((a, b) => ((b.votes || 0) + (myVotes[b.id] ? 1 : 0)) - ((a.votes || 0) + (myVotes[a.id] ? 1 : 0)));
    else list.sort((a, b) => {
      // primero los que vienen (por fecha), al final los que ya pasaron
      const pa = daysUntil(a.date) < 0, pb = daysUntil(b.date) < 0;
      if (pa !== pb) return pa ? 1 : -1;
      return (a.date + a.time).localeCompare(b.date + b.time) * (pa ? -1 : 1);
    });
    evWrap.innerHTML = list.length
      ? list.map(planCard).join("")
      : `<div class="mem-empty" style="grid-column:1/-1"><b>🗓️</b>${planFilter === "mine" ? "Todavía no has propuesto ningún parche." : catFilter ? `Todavía no hay parches de ${esc(catFilter.label)}. ¡Propón el primero!` : "No hay parches en esta categoría."}<br /><button type="button" class="btn btn--grad btn--sm" data-newplan>➕ Proponer un parche</button></div>`;
    if (firstRender) { firstRender = false; observeReveals(); }
  }
  renderPlans();

  $("#planFilters").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    catFilter = null;
    setChip(chip.dataset.filter);
    renderPlans();
  });

  // Tarjetas "Miradores / Caminatas / Rumba / Comida y más" → filtran los parches
  $$(".card--link").forEach((card) => card.addEventListener("click", (e) => {
    e.preventDefault();
    catFilter = { cats: card.dataset.cats.split(","), label: card.dataset.label };
    setChip("all");
    renderPlans();
    $("#planes").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    toast(`Mostrando parches de ${card.dataset.label}`);
  }));

  evWrap.addEventListener("click", (e) => {
    const t = e.target;
    const go = t.closest("[data-go]");
    const vote = t.closest("[data-vote]");
    const pollBtn = t.closest("[data-poll]");
    const del = t.closest("[data-del]");
    const rep = t.closest("[data-rep]");
    const mem = t.closest("[data-mem]");
    if (t.closest("[data-newplan]")) { openPlan(); return; }
    if (go) {
      const p = planById(go.dataset.go);
      const on = !going.has(p.id);
      on ? going.add(p.id) : going.delete(p.id);
      if (on) countInteraction();
      saveState(); renderPlans();
      toast(on ? `¡Listo! Te apuntaste a "${p.title}" 🔥` : "Te saliste del plan. ¡Pa' la próxima!");
    } else if (vote) {
      const id = vote.dataset.vote;
      if (myVotes[id]) delete myVotes[id]; else { myVotes[id] = 1; countInteraction(); }
      saveState(); renderPlans();
      if (myVotes[id]) toast("🔥 ¡Votaste por este parche!");
    } else if (pollBtn) {
      const id = pollBtn.dataset.poll;
      const k = +pollBtn.dataset.opt;
      if (myPolls[id] === k) delete myPolls[id]; else myPolls[id] = k;
      saveState(); renderPlans();
    } else if (del) {
      const p = planById(del.dataset.del);
      if (!p || !confirm(`¿Borrar el parche "${p.title}"?`)) return;
      userPlans = userPlans.filter((x) => x.id !== p.id);
      saveUserPlans(); renderPlans(); refreshMemPlans();
      toast("Parche borrado");
    } else if (rep) {
      const p = planById(rep.dataset.rep);
      openReport({ who: p.author, evidence: { kind: "text", text: `Parche: ${p.title} — ${p.desc}`, time: "" } });
    } else if (mem) {
      openMem(mem.dataset.mem);
    }
  });

  /* --- Proponer un parche --- */
  const planModal = $("#planModal");
  const planForm = $("#planForm");
  const planErr = $("#planError");
  let planImgData = null;
  $("#planCat").innerHTML = `<option value="">Elige…</option>` + CATS.map((c) => `<option value="${c.name}">${c.icon} ${c.name}</option>`).join("");

  function setPlanImg(data) {
    planImgData = data;
    $("#planImgPreview").hidden = !data;
    $("#planImgBtn").hidden = !!data;
    if (data) $("#planImgTag").src = data; else $("#planImgTag").removeAttribute("src");
  }
  $("#planImgBtn").addEventListener("click", () => $("#planImg").click());
  $("#planImgRemove").addEventListener("click", () => { setPlanImg(null); $("#planImg").value = ""; });
  $("#planImg").addEventListener("change", async () => {
    const f = $("#planImg").files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast("Eso no es una imagen."); return; }
    if (f.size > 10 * 1024 * 1024) { toast("La imagen pesa más de 10 MB."); return; }
    const data = await compressImage(f, 1280);
    if (!data) { toast("No se pudo leer la imagen."); return; }
    setPlanImg(data);
  });

  // Encuesta opcional
  const pollOpts = $("#pollOpts");
  function addPollOpt(val = "") {
    if (pollOpts.children.length >= 5) { toast("Máximo 5 opciones."); return; }
    const row = document.createElement("div");
    row.className = "poll-builder__opt";
    row.innerHTML = `<input type="text" maxlength="40" placeholder="Opción ${pollOpts.children.length + 1}" aria-label="Opción de la votación" /><button type="button" aria-label="Quitar opción">✕</button>`;
    $("input", row).value = val;
    $("button", row).addEventListener("click", () => { if (pollOpts.children.length > 2) row.remove(); });
    pollOpts.appendChild(row);
  }
  $("#pollOn").addEventListener("change", (e) => {
    $("#pollFields").hidden = !e.target.checked;
    if (e.target.checked && !pollOpts.children.length) { addPollOpt(); addPollOpt(); }
  });
  $("#pollAdd").addEventListener("click", () => addPollOpt());

  function openPlan() {
    if (denied("plans")) return;
    planForm.reset();
    planErr.textContent = "";
    setPlanImg(null);
    pollOpts.innerHTML = "";
    $("#pollFields").hidden = true;
    $("#planDate").min = toISO(new Date());
    lastFocus = document.activeElement;
    planModal.hidden = false;
    document.body.style.overflow = "hidden";
    setTimeout(() => $("#planName").focus(), 50);
  }
  function closePlan() {
    if (planModal.hidden) return;
    planModal.hidden = true;
    document.body.style.overflow = "";
    lastFocus?.focus?.({ preventScroll: true });
  }
  $("#newPlanBtn").addEventListener("click", openPlan);
  $$("[data-close]", planModal).forEach((el) => el.addEventListener("click", closePlan));

  planForm.addEventListener("submit", (e) => {
    e.preventDefault();
    planErr.textContent = "";
    const v = (id) => $(id).value.trim();
    const title = v("#planName"), cat = v("#planCat"), date = v("#planDate"), time = v("#planTime");
    const address = v("#planAddr"), meet = v("#planMeet"), desc = v("#planDesc");
    const capN = parseInt(v("#planCap"), 10);
    if (title.length < 4) return (planErr.textContent = "Ponle un título al parche (mínimo 4 letras).");
    if (!cat) return (planErr.textContent = "Elige una categoría.");
    if (!date) return (planErr.textContent = "Elige la fecha del parche.");
    if (daysUntil(date) < 0) return (planErr.textContent = "La fecha no puede ser en el pasado.");
    if (!time) return (planErr.textContent = "Pon la hora del parche.");
    if (address.length < 5) return (planErr.textContent = "Escribe la dirección para que todos lleguen.");
    if (desc.length < 10) return (planErr.textContent = "Cuéntanos un poquito más en la descripción.");

    let poll = null;
    if ($("#pollOn").checked) {
      const q = v("#pollQ");
      const options = $$("input", pollOpts).map((i) => i.value.trim()).filter(Boolean);
      if (!q) return (planErr.textContent = "Escribe la pregunta de la votación.");
      if (options.length < 2) return (planErr.textContent = "La votación necesita al menos 2 opciones.");
      poll = { q, options: options.map((t) => ({ t, v: 0 })) };
    }
    const allText = [title, meet, desc, poll?.q, ...(poll?.options.map((o) => o.t) || [])].filter(Boolean).join(" ");
    if (isOffensive(allText)) return (planErr.textContent = "🛡️ Hay palabras que no van con las reglas del parche.");
    if (hasLink(allText)) return (planErr.textContent = "❌ Nada de enlaces sin permiso de los administradores.");

    const plan = {
      id: `u${Date.now().toString(36)}`,
      cat, title, date, time, address, meet, desc, poll,
      cap: capN >= 2 ? capN : null,
      img: planImgData,
      going: 0, votes: 0,
      author: me?.nick || "Anónimo",
      own: true,
    };
    userPlans.push(plan);
    if (!saveUserPlans()) {
      userPlans.pop();
      planErr.textContent = "La imagen es muy pesada para guardarla. Prueba con otra o publícalo sin imagen.";
      return;
    }
    going.add(plan.id);
    saveState();
    closePlan();
    catFilter = null;
    setChip("all");
    renderPlans();
    refreshMemPlans();
    setTimeout(() => evWrap.querySelector(`[data-id="${plan.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
    toast("🎉 ¡Parche publicado! Ya te apuntamos.");
  });

  /* =====================================================
     7b. Recuerdos: fotos y videos de los planes (se guardan en IndexedDB)
     ===================================================== */
  const idb = (() => {
    let dbp = null;
    const open = () => (dbp ||= new Promise((res, rej) => {
      const r = indexedDB.open("parchemonos", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("media", { keyPath: "id" });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
    const run = async (mode, fn) => {
      const db = await open();
      return new Promise((res, rej) => {
        const tx = db.transaction("media", mode);
        const req = fn(tx.objectStore("media"));
        tx.oncomplete = () => res(req?.result);
        tx.onerror = () => rej(tx.error);
        tx.onabort = () => rej(tx.error);
      });
    };
    return {
      all: () => run("readonly", (s) => s.getAll()),
      put: (v) => run("readwrite", (s) => s.put(v)),
      del: (id) => run("readwrite", (s) => s.delete(id)),
    };
  })();

  const SEED_MEMS = [];
  const MEM_LIMIT = { image: 10, video: 50 };
  const memGrid = $("#memGrid");
  const memFilter = $("#memFilter");
  let memItems = [];
  let memUrls = [];
  const planTitle = (id) => planById(id)?.title || (id === "otro" ? "Otro plan" : "Plan del parche");

  function refreshMemPlans() {
    const opts = allPlans()
      .slice()
      .sort((a, b) => daysUntil(a.date) - daysUntil(b.date))
      .map((p) => `<option value="${esc(p.id)}">${esc(p.title)} · ${fromISO(p.date).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}</option>`)
      .join("");
    $("#memPlan").innerHTML = `<option value="">Elige el plan…</option>${opts}<option value="otro">Otro plan</option>`;
    const cur = memFilter.value;
    const used = [...new Set(memItems.map((m) => m.planId))];
    memFilter.innerHTML = `<option value="all">📁 Todos los planes</option>` + used.map((id) => `<option value="${esc(id)}">${esc(planTitle(id))}</option>`).join("");
    memFilter.value = used.includes(cur) ? cur : "all";
  }

  async function loadMems() {
    let saved = [];
    try { saved = await idb.all(); } catch { /* sin IndexedDB: solo se ven los de ejemplo */ }
    memItems = [...saved, ...SEED_MEMS].sort((a, b) => b.createdAt - a.createdAt);
    refreshMemPlans();
    renderMems();
  }

  function renderMems() {
    memUrls.forEach((u) => URL.revokeObjectURL(u));
    memUrls = [];
    const f = memFilter.value;
    const list = memItems.filter((m) => f === "all" || !f || m.planId === f);
    if (!list.length) {
      memGrid.innerHTML = `<div class="mem-empty"><b>📸</b>Todavía no hay recuerdos de este plan.<br /><button type="button" class="btn btn--grad btn--sm" data-memup>📤 Sube el primero</button></div>`;
      return;
    }
    memGrid.innerHTML = list.map((m) => {
      let src = m.url ? slotImg(`mem-${m.id}`, m.url) : null;
      if (!src && m.blob) { src = URL.createObjectURL(m.blob); memUrls.push(src); }
      const when = new Date(m.createdAt).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
      const media = m.type === "video"
        ? `<video src="${esc(src)}" controls playsinline preload="metadata"></video>`
        : `<button type="button" class="mem__media" data-full="${esc(src)}" ${m.url ? `data-slot="mem-${esc(m.id)}"` : ""} aria-label="Ver foto en grande"><img src="${esc(src)}" alt="${esc(m.caption || "Foto del parche")}" loading="lazy" /></button>`;
      return `
        <figure class="mem" data-mid="${esc(m.id)}" style="margin:0 0 12px">
          <span class="mem__badge">${m.type === "video" ? "🎬 Video" : "📸 Foto"}</span>
          ${media}
          <figcaption class="mem__info">
            <span class="mem__plan">${esc(planTitle(m.planId))}</span>
            ${m.caption ? `<p class="mem__cap">${esc(m.caption)}</p>` : ""}
            <span class="mem__meta">
              <span>👤 ${esc(m.author || "Anónimo")}</span><span>🗓️ ${when}</span>
              ${m.own ? `<button type="button" data-memdel="${esc(m.id)}">🗑️ Borrar</button>` : `<button type="button" data-memrep="${esc(m.id)}">⚑ reportar</button>`}
            </span>
          </figcaption>
        </figure>`;
    }).join("");
  }
  memFilter.addEventListener("change", renderMems);

  memGrid.addEventListener("click", async (e) => {
    const full = e.target.closest("[data-full]");
    const del = e.target.closest("[data-memdel]");
    const rep = e.target.closest("[data-memrep]");
    if (e.target.closest("[data-memup]")) { openMem(memFilter.value !== "all" ? memFilter.value : ""); return; }
    if (full) { openLightbox(full.dataset.full); return; }
    if (del) {
      if (!confirm("¿Borrar este recuerdo?")) return;
      try { await idb.del(del.dataset.memdel); } catch { /* */ }
      memItems = memItems.filter((m) => m.id !== del.dataset.memdel);
      refreshMemPlans(); renderMems();
      toast("Recuerdo borrado");
    }
    if (rep) {
      const m = memItems.find((x) => x.id === rep.dataset.memrep);
      openReport({ who: m.author, evidence: { kind: m.type, text: `${planTitle(m.planId)}${m.caption ? ` — ${m.caption}` : ""}`, time: "" } });
    }
  });

  /* Subir recuerdos */
  const memModal = $("#memModal");
  const memFiles = $("#memFiles");
  const memDrop = $("#memDrop");
  const memPreviews = $("#memPreviews");
  const memErr = $("#memError");
  let memQueue = [];

  function addMemFiles(files) {
    memErr.textContent = "";
    for (const f of files) {
      if (memQueue.length >= 10) { memErr.textContent = "Máximo 10 archivos por vez."; break; }
      const type = f.type.startsWith("image/") ? "image" : f.type.startsWith("video/") ? "video" : null;
      if (!type) { memErr.textContent = `"${f.name}" no es foto ni video.`; continue; }
      if (f.size > MEM_LIMIT[type] * 1024 * 1024) { memErr.textContent = `"${f.name}" pesa más de ${MEM_LIMIT[type]} MB.`; continue; }
      memQueue.push({ file: f, type, url: URL.createObjectURL(f) });
    }
    renderMemQueue();
  }
  function renderMemQueue() {
    memPreviews.innerHTML = memQueue.map((q, i) => `
      <div class="mem-prev">
        ${q.type === "video" ? `<video src="${q.url}" muted playsinline></video><i>🎬</i>` : `<img src="${q.url}" alt="" />`}
        <button type="button" data-qdel="${i}" aria-label="Quitar">✕</button>
      </div>`).join("");
  }
  memPreviews.addEventListener("click", (e) => {
    const b = e.target.closest("[data-qdel]");
    if (!b) return;
    const [q] = memQueue.splice(+b.dataset.qdel, 1);
    URL.revokeObjectURL(q.url);
    renderMemQueue();
  });
  memDrop.addEventListener("click", () => memFiles.click());
  memFiles.addEventListener("change", () => { addMemFiles([...memFiles.files]); memFiles.value = ""; });
  ["dragenter", "dragover"].forEach((ev) => memDrop.addEventListener(ev, (e) => { e.preventDefault(); memDrop.classList.add("is-over"); }));
  ["dragleave", "drop"].forEach((ev) => memDrop.addEventListener(ev, (e) => { e.preventDefault(); memDrop.classList.remove("is-over"); }));
  memDrop.addEventListener("drop", (e) => addMemFiles([...(e.dataTransfer?.files || [])]));

  function openMem(planId = "") {
    memForm.reset();
    memQueue.forEach((q) => URL.revokeObjectURL(q.url));
    memQueue = [];
    renderMemQueue();
    memErr.textContent = "";
    refreshMemPlans();
    $("#memPlan").value = planId;
    lastFocus = document.activeElement;
    memModal.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeMem() {
    if (memModal.hidden) return;
    memModal.hidden = true;
    document.body.style.overflow = "";
    lastFocus?.focus?.({ preventScroll: true });
  }
  const memForm = $("#memForm");
  $("#memUploadBtn").addEventListener("click", () => openMem(memFilter.value !== "all" ? memFilter.value : ""));
  $$("[data-close]", memModal).forEach((el) => el.addEventListener("click", closeMem));

  memForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    memErr.textContent = "";
    const planId = $("#memPlan").value;
    const caption = $("#memCaption").value.trim();
    if (!memQueue.length) { memErr.textContent = "Elige al menos una foto o video."; return; }
    if (!planId) { memErr.textContent = "Elige de qué plan son."; return; }
    if (caption && (isOffensive(caption) || hasLink(caption))) { memErr.textContent = "🛡️ Esa descripción no cumple las reglas del parche."; return; }
    if (!$("#memConsent").checked) { memErr.textContent = "Confirma que las personas que salen aceptaron aparecer (regla de privacidad)."; return; }

    const btn = $("#memSubmit");
    btn.disabled = true;
    btn.textContent = "Subiendo…";
    let ok = 0;
    for (const q of memQueue) {
      const item = {
        id: `mem${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        type: q.type, blob: q.file, planId, caption,
        author: me?.nick || "Anónimo", own: true, createdAt: Date.now(),
      };
      try { await idb.put(item); memItems.unshift(item); ok++; } catch { /* sin espacio */ }
      URL.revokeObjectURL(q.url);
    }
    memQueue = [];
    btn.disabled = false;
    btn.textContent = "Publicar recuerdos 💜";
    if (!ok) { memErr.textContent = "No se pudieron guardar. Puede que el navegador no tenga espacio."; return; }
    closeMem();
    refreshMemPlans();
    memFilter.value = planId;
    if (memFilter.value !== planId) memFilter.value = "all";
    renderMems();
    $("#recuerdos").scrollIntoView({ behavior: "smooth" });
    toast(`💜 ${ok} recuerdo${ok === 1 ? "" : "s"} publicado${ok === 1 ? "" : "s"}`);
  });

  loadMems();

  /* =====================================================
     9. Chat
     ===================================================== */
  const chatApp = $("#chatApp");
  const body = $("#chatBody");
  const input = $("#msgInput");
  const micBtn = $("#micBtn");
  const sendBtn = $("#composeForm button[type=submit]");
  const composeForm = $("#composeForm");
  const recBar = $("#recBar");
  const recTime = $("#recTime");

  const NICK_COLORS = ["#ff3df0", "#b14dff", "#f5ff3d", "#3dffd0", "#ff9f3d", "#5ab0ff"];
  const PEOPLE = {};

  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const now = () => new Date().toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
  const waveBars = (n = 28, seed = Math.random() * 100) =>
    Array.from({ length: n }, (_, i) => {
      const h = 25 + Math.abs(Math.sin(seed + i * 0.7) * 55) + Math.abs(Math.cos(seed * 2 + i * 1.9)) * 20;
      return `<i style="--h:${Math.min(h, 100).toFixed(0)}%"></i>`;
    }).join("");

  function scrollDown() { body.scrollTop = body.scrollHeight; }

  // Stickers del parche
  const STICKERS = DATA.stickers.map((s, i) => ({ ...s, c: (i % 4) + 1 }));
  // sticker de emoji+texto o sticker con imagen (externo: PNG, WebP de WhatsApp, GIF animado…)
  const stickerHtml = (s) => s.img
    ? `<span class="stk stk--img"><img src="${esc(s.img)}" alt="${esc(s.t || "Sticker")}" loading="lazy" draggable="false" /></span>`
    : `<span class="stk stk--${s.c}"><span>${s.e}</span><b>${esc(s.t)}</b></span>`;

  const KIND_LABEL = { text: "Mensaje", voice: "Nota de voz", sticker: "Sticker", image: "Foto", gif: "GIF", video: "Video", poll: "Encuesta" };
  let msgSeq = 0;
  let pins = [];    // mensajes fijados: [{ mid, nick, preview }]
  let pinIdx = 0;

  function addMsg({ who = "me", nick, color, text, voice, sticker, media, poll, time = now() }) {
    // los mensajes que la persona envía ahora (sin hora fija) cuentan como interacción
    const live = who === "me" && arguments[0]?.time === undefined;
    const el = document.createElement("div");
    el.className = `msg msg--${who}`;
    el.dataset.mid = `msg${++msgSeq}`;
    let badge = "";
    const mem = who === "them" ? memberByNick(nick) : null;
    if (mem) {
      const r = roleById(mem.role);
      badge = ` <em class="role-badge" style="--rc:${esc(r.color)}" title="${esc(r.name)}">${esc(r.emoji)} ${esc(r.name)}</em>`;
    }
    const prof = who === "them" ? profileOf(nick) : null;
    const nickHtml = who === "them"
      ? `<button type="button" class="msg__nick" data-profile="${esc(nick)}" style="color:${color}">${esc(nick)} <small class="msg__handle">@${esc(prof.handle)}</small>${badge}</button>`
      : "";
    // foto de perfil al lado de los mensajes de los demás (como en los grupos de WhatsApp)
    const avatar = who === "them" ? `<button type="button" class="msg__av" data-profile="${esc(nick)}" aria-label="Ver perfil de ${esc(nick)}">${avatarInner(nick, color)}</button>` : "";
    let content;
    let bubble = "msg__bubble";
    let kind = "text";
    if (voice) {
      kind = "voice";
      content = `
        <div class="voice" data-dur="${voice.dur}">
          <button class="voice__play" aria-label="Reproducir nota de voz">${ICON_PLAY}</button>
          <span class="wave">${waveBars()}</span>
          <span class="voice__dur">${fmt(voice.dur)}</span>
        </div>`;
    } else if (poll) {
      kind = "poll";
      bubble += " msg__bubble--poll";
      content = `<div class="cpoll"></div>`;
    } else if (sticker) {
      kind = "sticker";
      bubble += " msg__bubble--bare";
      content = stickerHtml(sticker);
    } else if (media) {
      kind = media.type;
      bubble += " msg__bubble--media";
      content = media.type === "video"
        ? `<video src="${esc(media.url)}" controls playsinline preload="metadata"></video>`
        : `<button type="button" class="media" data-full="${esc(media.url)}" ${media.slot ? `data-slot="${esc(media.slot)}"` : ""} aria-label="Ver en grande"><img src="${esc(media.url)}" alt="${media.type === "gif" ? "GIF" : "Foto"} enviada al chat" loading="lazy" /></button>`;
      if (media.type === "gif") content += `<span class="msg__tag">GIF</span>`;
      if (text) content += `<span class="msg__text">${msgText(text, el)}</span>`;
    } else {
      content = `<span class="msg__text">${msgText(text, el)}</span>`;
    }
    const report = who === "them" ? `<button class="msg__report" type="button">⚑ reportar</button>` : `<span aria-label="Enviado">✓✓</span>`;
    const pinBtn = `<button class="msg__pin" type="button" aria-label="Fijar mensaje" title="Fijar mensaje">📌</button>`;
    el.innerHTML = `${avatar}<div class="${bubble}">${nickHtml}${content}<div class="msg__meta"><span>${time}</span>${pinBtn}${report}</div></div>`;
    if (voice?.url) $(".voice", el).dataset.url = voice.url;
    // datos que viajan como prueba si alguien reporta este mensaje
    const shown = sticker ? (sticker.img ? "[Sticker con imagen]" : `${sticker.e} ${sticker.t}`) : poll ? poll.q : text || "";
    el._pm = { nick: who === "them" ? nick : "", kind, text: shown, time };
    // texto corto para la barra de fijados
    const icon = { voice: "🎤 Nota de voz", sticker: "", image: "📷 Foto", gif: "🎞️ GIF", video: "🎬 Video", poll: "📊 " }[kind] ?? "";
    el._preview = `${icon}${kind === "poll" || kind === "sticker" || kind === "text" ? shown : text ? ` · ${text}` : ""}`;
    el._nick = who === "them" ? nick : "Tú";
    if (poll) { el._poll = { q: poll.q, options: poll.options.map((o) => ({ t: o.t, v: o.v || 0 })), mine: null }; renderChatPoll(el); }
    body.appendChild(el);
    scrollDown();
    if (live) countInteraction();
    return el;
  }
  /* --- Encuestas dentro del chat --- */
  function renderChatPoll(el) {
    const p = el._poll;
    const counts = p.options.map((o, k) => o.v + (p.mine === k ? 1 : 0));
    const total = counts.reduce((a, b) => a + b, 0);
    $(".cpoll", el).innerHTML = `
      <span class="cpoll__head">📊 Encuesta</span>
      <span class="cpoll__q">${esc(p.q)}</span>
      ${p.options.map((o, k) => {
        const pct = total ? Math.round((counts[k] / total) * 100) : 0;
        return `<button type="button" class="cpoll__opt ${p.mine === k ? "is-mine" : ""}" data-copt="${k}" aria-pressed="${p.mine === k}">
          <span class="cpoll__bar" style="width:${pct}%"></span>
          <span class="cpoll__t">${p.mine === k ? "✓ " : ""}${esc(o.t)}</span>
          <span class="cpoll__n">${counts[k]} · ${pct}%</span></button>`;
      }).join("")}
      <span class="cpoll__total">${total} voto${total === 1 ? "" : "s"}${p.mine == null ? " · toca una opción para votar" : ""}</span>`;
  }
  // votos simulados: apagados (el chat empieza en cero, solo cuentan votos reales)
  const SIMULATE = false;
  function simulatePollVotes(el) {
    if (!SIMULATE) return;
    let n = 3 + Math.floor(Math.random() * 5);
    const tick = () => {
      if (!el.isConnected || n-- <= 0) return;
      const k = Math.floor(Math.random() * el._poll.options.length);
      el._poll.options[k].v++;
      renderChatPoll(el);
      setTimeout(tick, 900 + Math.random() * 1800);
    };
    setTimeout(tick, 1500);
  }

  /* --- Mensajes fijados --- */
  function renderPins() {
    const bar = $("#pinnedBar");
    // quita fijados cuyo mensaje ya no existe
    pins = pins.filter((p) => body.querySelector(`[data-mid="${p.mid}"]`));
    $$(".msg", body).forEach((m) => m.classList.toggle("is-pinned", pins.some((p) => p.mid === m.dataset.mid)));
    $$(".msg__pin", body).forEach((b) => b.setAttribute("aria-label", b.closest(".msg").classList.contains("is-pinned") ? "Desfijar mensaje" : "Fijar mensaje"));
    if (!pins.length) { bar.hidden = true; return; }
    pinIdx = Math.min(pinIdx, pins.length - 1);
    const p = pins[pinIdx];
    bar.hidden = false;
    $("#pinnedLabel").textContent = pins.length > 1 ? `Mensaje fijado ${pinIdx + 1} de ${pins.length} · ${p.nick}` : `Mensaje fijado · ${p.nick}`;
    $("#pinnedText").textContent = p.preview || "Mensaje";
  }
  function togglePin(msgEl, announce = true) {
    const mid = msgEl.dataset.mid;
    const i = pins.findIndex((p) => p.mid === mid);
    if (i >= 0) {
      pins.splice(i, 1);
      if (announce) toast("📌 Mensaje desfijado");
    } else {
      pins.unshift({ mid, nick: msgEl._nick, preview: msgEl._preview });
      if (pins.length > 3) pins.pop(); // máximo 3 fijados, como en WhatsApp
      pinIdx = 0;
      if (announce) addSys(`📌 ${me?.nick || "Alguien"} fijó un mensaje`);
    }
    renderPins();
  }
  function goToPin() {
    const p = pins[pinIdx];
    const m = p && body.querySelector(`[data-mid="${p.mid}"]`);
    if (m) {
      body.scrollTo({ top: m.offsetTop - body.clientHeight / 3, behavior: reduceMotion ? "auto" : "smooth" });
      m.classList.remove("is-flash"); void m.offsetWidth; m.classList.add("is-flash");
      setTimeout(() => m.classList.remove("is-flash"), 1700);
    }
    // el siguiente toque muestra el siguiente fijado
    if (pins.length > 1) { pinIdx = (pinIdx + 1) % pins.length; renderPins(); }
  }

  function addSys(text, alert = false) {
    const el = document.createElement("div");
    el.className = alert ? "chat__sys chat__sys--alert" : "chat__sys";
    el.textContent = text;
    body.appendChild(el);
    scrollDown();
  }

  const ICON_PLAY = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 4.5v15l12-7.5z"/></svg>`;
  const ICON_PAUSE = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>`;

  // El chat empieza vacío (sin conversación de ejemplo)
  addSys("🛡️ Este chat es moderado. Cero acoso. Reporta lo que te incomode, es anónimo.");

  // Reproductor de notas de voz (real si hay audio grabado, simulado si no)
  let playing = null;
  function stopPlaying() {
    if (!playing) return;
    cancelAnimationFrame(playing.raf);
    playing.audio?.pause();
    playing.btn.innerHTML = ICON_PLAY;
    $$(".wave i", playing.voice).forEach((b) => b.classList.remove("is-played"));
    $(".voice__dur", playing.voice).textContent = fmt(+playing.voice.dataset.dur);
    playing = null;
  }
  body.addEventListener("click", (e) => {
    const play = e.target.closest(".voice__play");
    if (play) {
      const voice = play.closest(".voice");
      if (playing?.voice === voice) { stopPlaying(); return; }
      stopPlaying();
      const dur = +voice.dataset.dur;
      const bars = $$(".wave i", voice);
      const durEl = $(".voice__dur", voice);
      let audio = null;
      if (voice.dataset.url) { audio = new Audio(voice.dataset.url); audio.play().catch(() => {}); }
      const t0 = performance.now();
      playing = { voice, btn: play, audio };
      play.innerHTML = ICON_PAUSE;
      const step = (t) => {
        const elapsed = audio ? audio.currentTime : (t - t0) / 1000;
        const p = Math.min(elapsed / dur, 1);
        const lit = Math.floor(p * bars.length);
        bars.forEach((b, i) => b.classList.toggle("is-played", i < lit));
        durEl.textContent = fmt(Math.max(dur - elapsed, 0));
        if (p >= 1 || (audio && audio.ended)) { stopPlaying(); return; }
        playing.raf = requestAnimationFrame(step);
      };
      playing.raf = requestAnimationFrame(step);
      return;
    }
    const pic = e.target.closest(".media");
    if (pic) { openLightbox(pic.dataset.full); return; }
    const copt = e.target.closest("[data-copt]");
    if (copt) {
      const m = copt.closest(".msg");
      if (!me) { toast("Entra al chat para votar en la encuesta 🗳️"); return; }
      const k = +copt.dataset.copt;
      if (m._poll.mine == null) countInteraction();
      m._poll.mine = m._poll.mine === k ? null : k;
      renderChatPoll(m);
      return;
    }
    const pin = e.target.closest(".msg__pin");
    if (pin) {
      if (denied("pin")) return;
      togglePin(pin.closest(".msg"));
      return;
    }
    const rep = e.target.closest(".msg__report");
    if (rep) {
      const data = rep.closest(".msg")._pm;
      openReport({ who: data.nick, evidence: data, btn: rep });
    }
  });

  // Entrar al chat
  const joinModal = $("#joinModal");
  const colorRow = $("#colorRow");
  let me = JSON.parse(store.get("pm_me") || "null");
  let myColor = NICK_COLORS[0];

  colorRow.innerHTML = NICK_COLORS.map((c, i) =>
    `<button type="button" class="swatch" role="radio" aria-checked="${i === 0}" aria-label="Color ${i + 1}" data-color="${c}" style="background:${c};color:${c}"></button>`
  ).join("");
  colorRow.addEventListener("click", (e) => {
    const sw = e.target.closest(".swatch");
    if (!sw) return;
    myColor = sw.dataset.color;
    $$(".swatch", colorRow).forEach((s) => s.setAttribute("aria-checked", String(s === sw)));
  });

  let lastFocus = null;
  function openJoin() {
    if (me) return;
    const req = myRequest();
    if (req?.status === "pendiente") { toast("⏳ Tu solicitud ya está en revisión. Te avisamos apenas te acepten."); return; }
    if (memberByNick(req?.nick)?.status === "expulsado") return;
    lastFocus = document.activeElement;
    $("#memberList").innerHTML = members.filter((m) => m.status !== "expulsado" && m.role !== "prueba").map((m) => `<option value="${esc(m.nick)}"></option>`).join("");
    joinModal.hidden = false;
    document.body.style.overflow = "hidden";
    setTimeout(() => $("#nickInput").focus(), 50);
  }
  // mostrar el campo "¿Quién te recomienda?" solo si eligió esa opción
  $$('input[name="joinVia"]').forEach((r) => r.addEventListener("change", () => {
    const reco = $('input[name="joinVia"]:checked').value === "recomendacion";
    $("#recoField").hidden = !reco;
    if (reco) $("#joinReco").focus();
  }));
  function closeJoin() {
    if (joinModal.hidden) return;
    joinModal.hidden = true;
    document.body.style.overflow = "";
    lastFocus?.focus?.({ preventScroll: true });
  }
  $$("[data-close]", joinModal).forEach((el) => el.addEventListener("click", closeJoin));

  $$("[data-join]").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault();
    closeMenu();
    $("#chat").scrollIntoView({ behavior: "smooth" });
    if (!me) setTimeout(openJoin, reduceMotion ? 0 : 750);
  }));

  /* =====================================================
     Solicitudes de ingreso y roles
     - Quien quiere entrar envía una solicitud (normal o por recomendación).
     - Los admins la aceptan (normal o con período de prueba) o la rechazan en admin.html.
     ===================================================== */
  const lsJSON = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
  const loadRequests = () => lsJSON("pm_requests") || [];
  function myRequest() {
    const id = store.get("pm_my_request");
    return id ? loadRequests().find((r) => r.id === id) || null : null;
  }
  function myMember() { return me ? memberByNick(me.nick) : null; }
  function myRole() {
    const m = myMember();
    if (!m) return roleById("miembro");
    // el período de prueba se acaba solo cuando pasa la fecha
    if (m.role === "prueba" && m.trialUntil && daysUntil(m.trialUntil) < 0) return roleById("miembro");
    return roleById(m.role);
  }
  const can = (perm) => !!(me && myRole()?.perms?.[perm]);
  const NO_PERM = {
    pin: "📌 Solo los admins y moderadores pueden fijar mensajes.",
    poll: "📊 Tu rol todavía no puede crear encuestas.",
    media: "🖼️ Tu rol todavía no puede enviar fotos, videos ni GIFs.",
    plans: "🗓️ Tu rol todavía no puede proponer parches.",
  };
  function denied(perm) {
    if (!me) { toast("🙋 Primero solicita entrar al chat y espera que te acepten."); return true; }
    if (can(perm)) return false;
    const m = myMember();
    const trial = m?.role === "prueba" && m.trialUntil ? ` Tu período de prueba termina el ${fromISO(m.trialUntil).toLocaleDateString("es-CO", { day: "numeric", month: "long" })}.` : "";
    toast(NO_PERM[perm] + trial);
    return true;
  }

  function setLock(state, req) {
    showMyAccButtons(false);
    chatApp.classList.add("is-blurred");
    [input, micBtn, sendBtn, $("#mediaBtn"), $("#attachBtn")].forEach((el) => (el.disabled = true));
    $("#trialBar").hidden = true;
    const LOCKS = {
      nuevo:["💬", "Entra al chat", "Envía tu solicitud, preséntate y acepta las reglas. Los admins te dan acceso.", "🙋 Solicitar entrar"],
      pendiente: ["⏳", "Solicitud en revisión", `Hola ${req?.nick || ""} 👋 Los admins están revisando tu solicitud${req?.via === "recomendacion" ? ` (te recomendó ${req.recommendedBy})` : ""}. Te avisamos aquí apenas te acepten.`, "Cancelar solicitud"],
      rechazado: ["🙅", "Solicitud no aprobada", `Esta vez no fue posible.${req?.reason ? ` Motivo: ${req.reason}.` : ""} Si crees que es un error, puedes intentarlo de nuevo más adelante.`, "Enviar otra solicitud"],
      expulsado: ["⛔", "Fuiste expulsado", "No cumpliste las reglas del parche. Ya no puedes entrar al chat.", ""],
    };
    if (!LOCKS[state]) state = "nuevo";
    const L = LOCKS[state];
    $("#lockIcon").textContent = L[0];
    $("#lockTitle").textContent = L[1];
    $("#lockText").textContent = L[2];
    const btn = $("#openJoin");
    btn.hidden = !L[3];
    btn.textContent = L[3];
    btn.className = `btn btn--block ${state === "pendiente" ? "btn--ghost" : "btn--grad"}`;
    btn.dataset.state = state;
  }
  $("#openJoin").addEventListener("click", (e) => {
    e.stopImmediatePropagation();
    const st = e.currentTarget.dataset.state || "nuevo";
    if (st === "pendiente") {
      if (!confirm("¿Cancelar tu solicitud para entrar al parche?")) return;
      const id = store.get("pm_my_request");
      try { localStorage.setItem("pm_requests", JSON.stringify(loadRequests().filter((r) => r.id !== id))); } catch { /* */ }
      store.set("pm_my_request", "");
      syncMembership();
      toast("Solicitud cancelada");
      return;
    }
    if (st === "rechazado") store.set("pm_my_request", "");
    openJoin();
  }, true);

  function applyPerms() {
    const m = myMember();
    const r = myRole();
    $("#attachBtn").disabled = !can("media");
    // pestañas del panel de stickers según permisos
    $$('.media-panel__tabs [data-tab="gifs"], .media-panel__tabs [data-tab="files"]').forEach((t) => (t.hidden = !can("media")));
    $('.media-panel__tabs [data-tab="poll"]').hidden = !can("poll");
    if (!can("media") && (activeTab === "gifs" || activeTab === "files")) setTab("stickers");
    if (!can("poll") && activeTab === "poll") setTab("stickers");
    // barra de período de prueba
    const bar = $("#trialBar");
    if (m?.role === "prueba" && r.id === "prueba") {
      const n = m.trialUntil ? daysUntil(m.trialUntil) : null;
      bar.innerHTML = `🧪 <b>Período de prueba</b>${n != null ? ` · ${n === 0 ? "termina hoy" : `te quedan ${n} día${n === 1 ? "" : "s"}`}` : ""}${m.recommendedBy ? ` · te recomendó ${esc(m.recommendedBy)}` : ""}<br /><small>Por ahora puedes enviar texto, stickers y notas de voz.</small>`;
      bar.hidden = false;
    } else bar.hidden = true;
  }

  function unlockChat(first) {
    showMyAccButtons(true);
    chatApp.classList.remove("is-blurred");
    [input, micBtn, sendBtn, $("#mediaBtn")].forEach((el) => (el.disabled = false));
    $$("[data-join]").forEach((a) => (a.textContent = a.classList.contains("btn--sm") ? "Al chat" : a.textContent));
    applyPerms();
    if (first) {
      const r = myRole();
      addSys(`💜 ${me.nick} se unió al parche${r.id === "prueba" ? " (en período de prueba 🧪)" : ""}. ¡Bienvenid@!`);
      setTimeout(() => addSys(`👋 ${me.nick}, preséntate: tu nombre, tu edad y de dónde eres (regla 01) 😉`), 1400);
    }
  }

  // Revisa el estado de la solicitud y del miembro (también cuando un admin la cambia en otra pestaña)
  function syncMembership(fromAdmin = false) {
    members = readMembers();
    roles = readRoles();
    const req = myRequest();
    const nick = req?.nick || me?.nick;
    const mem = nick ? memberByNick(nick) : null;
    if (mem?.status === "expulsado") {
      me = null;
      store.set("pm_me", "null");
      setLock("expulsado");
      return;
    }
    const approved = req ? req.status === "aceptado" : !!me; // los que ya estaban antes siguen adentro
    if (approved) {
      const wasLocked = chatApp.classList.contains("is-blurred");
      me = { nick, color: req?.color || me?.color || mem?.color };
      store.set("pm_me", JSON.stringify(me));
      const firstTime = req && store.get("pm_welcomed") !== req.id;
      if (wasLocked) unlockChat(firstTime);
      else applyPerms();
      if (firstTime) {
        store.set("pm_welcomed", req.id);
        if (fromAdmin) toast(`🎉 ¡Te aceptaron en el parche${myRole().id === "prueba" ? " (en período de prueba)" : ""}!`);
      }
      return;
    }
    me = null;
    setLock(req ? req.status : "nuevo", req);
  }
  window.addEventListener("storage", (e) => {
    if (["pm_requests", "pm_members", "pm_roles"].includes(e.key)) { syncMembership(true); if (!accModal.hidden) renderMyAcc(); }
    if (e.key === "pm_interactions" && !accModal.hidden) renderMyAcc();
  });

  /* =====================================================
     Mi cuenta: código único, interacciones, strikes y advertencias
     ===================================================== */
  // mismo cálculo que el panel: el código sale del apodo y es igual en cualquier dispositivo
  function memberCode(nick) {
    let h = 2166136261;
    for (const ch of String(nick || "").trim().toLowerCase()) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
    return "PM-" + h.toString(36).toUpperCase().padStart(6, "0").slice(-6);
  }
  function myInteractions() { return (readLS("pm_interactions") || {})[String(me?.nick || "").toLowerCase()] || 0; }
  function countInteraction() {
    if (!me) return;
    const all = readLS("pm_interactions") || {};
    const k = me.nick.toLowerCase();
    all[k] = (all[k] || 0) + 1;
    try { localStorage.setItem("pm_interactions", JSON.stringify(all)); } catch { /* */ }
    if (!accModal.hidden) renderMyAcc();
  }
  const accModal = $("#accModal");
  function panelAccountOf(nick) {
    const list = readLS("pm_admin_accounts") || window.SITE_DATA?.adminAccounts || [];
    return list.find((a) => (a.nick || a.name || "").toLowerCase() === String(nick || "").toLowerCase() && a.active !== false) || null;
  }
  function renderMyAcc() {
    if (!me) return;
    const m = myMember() || { nick: me.nick, color: me.color, role: "miembro" };
    const r = myRole();
    const warns = m.warnings || [];
    const max = +CONFIG.STRIKES_MAX || 3;
    const color = me.color || m.color || "#ff3df0";
    $("#accAvatar").style.background = color;
    $("#accAvatar").style.setProperty("--ac", color);
    if (pendingPhoto === undefined) paintMyAvatar(profileOf(me.nick).photo);
    $("#accTitle").textContent = me.nick;
    $("#accHandle").textContent = `@${profileOf(me.nick).handle}${profileOf(me.nick).about ? ` · ${profileOf(me.nick).about}` : ""}`;
    $("#accRole").innerHTML = `<em class="role-badge" style="--rc:${esc(r.color)}">${esc(r.emoji)} ${esc(r.name)}</em>`;
    $("#accCode").textContent = m.code || memberCode(me.nick);
    $("#accInter").textContent = myInteractions();
    const st = $("#accStrikes");
    st.textContent = `${warns.length}/${max}`;
    st.className = warns.length >= max - 1 && warns.length ? "is-danger" : warns.length ? "is-warn" : "";
    $("#accSince").textContent = m.joinedAt ? fromISO(m.joinedAt).toLocaleDateString("es-CO", { month: "short", year: "numeric" }) : "Hoy";
    $("#accBar").innerHTML = Array.from({ length: max }, (_, i) => `<i class="${i < warns.length ? "is-on" : ""}"></i>`).join("");
    $("#accHint").textContent = warns.length
      ? (warns.length >= max ? "Llegaste al límite de strikes: los admins pueden expulsarte del parche." : `Te ${max - warns.length === 1 ? "queda 1 strike" : `quedan ${max - warns.length} strikes`} antes de la expulsión. Cuida las reglas 💜`)
      : `Con ${max} strikes se expulsa del parche. ¡Vas perfecto!`;
    $("#accWarns").innerHTML = warns.length
      ? warns.slice().reverse().map((w) => `<li>⚠️ ${esc(w.reason)}<small>${esc(w.date || "")}${w.by ? ` · por ${esc(w.by)}` : ""}</small></li>`).join("")
      : `<li class="is-empty">✅ No tienes advertencias. ¡Sigue así! 💜</li>`;
    const extra = [];
    if (m.role === "prueba" && m.trialUntil) extra.push(`🧪 Período de prueba hasta el <b>${esc(fromISO(m.trialUntil).toLocaleDateString("es-CO", { day: "numeric", month: "long" }))}</b>.`);
    if (m.recommendedBy) extra.push(`🤝 Te recomendó <b>${esc(m.recommendedBy)}</b>.`);
    const pa = panelAccountOf(me.nick);
    if (pa) extra.push(`🔑 Eres parte del equipo: tienes acceso al <a href="admin.html">panel de admins</a> con el usuario <b>${esc(pa.user)}</b>.`);
    $("#accExtra").innerHTML = extra.map((x) => `<p>${x}</p>`).join("");
  }
  function openMyAcc() {
    if (!me) { toast("🙋 Primero entra al grupo para ver tu cuenta."); return; }
    closeMenu();
    fillProfileForm();
    renderMyAcc();
    lastFocus = document.activeElement;
    accModal.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeMyAcc() {
    if (accModal.hidden) return;
    accModal.hidden = true;
    document.body.style.overflow = "";
    lastFocus?.focus?.({ preventScroll: true });
  }
  $$("[data-myacc]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); openMyAcc(); }));
  $$("[data-close]", accModal).forEach((el) => el.addEventListener("click", closeMyAcc));
  $("#accCopy").addEventListener("click", async () => {
    const code = $("#accCode").textContent;
    try { await navigator.clipboard.writeText(code); toast(`📋 Código ${code} copiado`); }
    catch { prompt("Copia tu código:", code); }
  });
  function showMyAccButtons(on) { $$("[data-myacc]").forEach((b) => (b.hidden = !on)); }

  /* =====================================================
     Perfil tipo WhatsApp: foto, @usuario e info · @menciones
     ===================================================== */
  function myNick() { try { return me?.nick || null; } catch { return null; } } // seguro aunque "me" aún no exista
  function normHandle(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/^@/, "").replace(/[^a-z0-9_.]/g, "").slice(0, 20);
  }
  function readProfiles() { return { ...(window.SITE_DATA?.profiles || {}), ...(readLS("pm_profiles") || {}) }; }
  function profileOf(nick) {
    const p = readProfiles()[String(nick || "").toLowerCase()] || {};
    return { photo: p.photo || null, handle: p.handle || normHandle(nick) || "parcero", about: p.about || "" };
  }
  function saveMyProfile(patch) {
    const all = readLS("pm_profiles") || {};
    const k = myNick().toLowerCase();
    all[k] = { ...(all[k] || {}), ...patch };
    try { localStorage.setItem("pm_profiles", JSON.stringify(all)); return true; } catch { return false; }
  }
  // todas las personas que se pueden mencionar: miembros + quienes han escrito en el chat
  function knownNicks() {
    const map = new Map();
    (members || []).forEach((m) => { if (m.status !== "expulsado") map.set(m.nick.toLowerCase(), m.nick); });
    Object.keys(PEOPLE).forEach((n) => map.set(n.toLowerCase(), n));
    $$(".msg__nick[data-profile]", body).forEach((b) => map.set(b.dataset.profile.toLowerCase(), b.dataset.profile));
    const mine = myNick();
    if (mine) map.set(mine.toLowerCase(), mine);
    return [...map.values()];
  }
  function nickByHandle(h) { h = normHandle(h); return knownNicks().find((n) => profileOf(n).handle === h) || null; }
  const initialOf = (nick) => (String(nick || "").match(/\p{L}|\p{N}/u) || ["?"])[0].toUpperCase();
  function avatarInner(nick, color) {
    const p = profileOf(nick);
    return p.photo
      ? `<img src="${esc(p.photo)}" alt="" loading="lazy" />`
      : `<span style="background:${esc(color || memberByNick(nick)?.color || "#b14dff")}">${esc(initialOf(nick))}</span>`;
  }
  // texto del mensaje con @menciones resaltadas (y avisa si te mencionan a ti)
  function msgText(text, el) {
    const mine = myNick();
    const myHandle = mine ? profileOf(mine).handle : null;
    return esc(text).replace(/(^|[\s(¡¿])@([a-z0-9_.]{2,20})/gi, (m, pre, h) => {
      const n = nickByHandle(h);
      if (!n) return m;
      if (myHandle && normHandle(h) === myHandle && el?.classList.contains("msg--them")) el.classList.add("msg--mentioned");
      return `${pre}<button type="button" class="mention" data-profile="${esc(n)}">@${esc(normHandle(h))}</button>`;
    });
  }

  // Ver el perfil de alguien (toca su foto, su nombre o su @)
  const profModal = $("#profModal");
  let profNick = null;
  function openProfile(nick) {
    if (!nick) return;
    if (myNick() && nick.toLowerCase() === myNick().toLowerCase()) { openMyAcc(); return; }
    profNick = nick;
    const p = profileOf(nick);
    const m = memberByNick(nick);
    const r = m ? roleById(m.role) : null;
    $("#profPhoto").innerHTML = avatarInner(nick, m?.color);
    $("#profName").textContent = nick;
    $("#profHandle").textContent = `@${p.handle}`;
    $("#profRole").innerHTML = r ? `<em class="role-badge" style="--rc:${esc(r.color)}">${esc(r.emoji)} ${esc(r.name)}</em>` : "";
    $("#profAbout").textContent = p.about || "¡Hola! Estoy en ParchéMonos 💜";
    $("#profCode").textContent = m?.code || memberCode(nick);
    $("#profSince").textContent = m?.joinedAt ? `Miembro desde ${fromISO(m.joinedAt).toLocaleDateString("es-CO", { month: "long", year: "numeric" })}` : "";
    lastFocus = document.activeElement;
    profModal.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeProfile() {
    if (profModal.hidden) return;
    profModal.hidden = true;
    document.body.style.overflow = "";
    lastFocus?.focus?.({ preventScroll: true });
  }
  $$("[data-close]", profModal).forEach((el) => el.addEventListener("click", closeProfile));
  $("#profMention").addEventListener("click", () => {
    const h = profileOf(profNick).handle;
    closeProfile();
    if (!me) { toast("🙋 Entra al grupo para mencionar a alguien."); return; }
    input.value = `${input.value.replace(/\s*$/, "")}${input.value.trim() ? " " : ""}@${h} `;
    input.focus();
  });
  $("#profReport").addEventListener("click", () => { const n = profNick; closeProfile(); openReport({ who: n }); });
  body.addEventListener("click", (e) => {
    const t = e.target.closest("[data-profile]");
    if (t) { e.stopPropagation(); openProfile(t.dataset.profile); }
  }, true);

  // Editar mi perfil (en "Mi cuenta")
  let pendingPhoto; // undefined = sin cambios · null = quitar · dataURL = nueva
  function fillProfileForm() {
    const p = profileOf(me.nick);
    pendingPhoto = undefined;
    $("#pfHandle").value = p.handle;
    $("#pfAbout").value = p.about;
    $("#pfErr").textContent = "";
    $("#pfPhotoDel").hidden = !p.photo;
  }
  function paintMyAvatar(photo) {
    const av = $("#accAvatar");
    if (photo) { av.innerHTML = `<img src="${esc(photo)}" alt="Tu foto de perfil" />`; av.classList.add("has-photo"); }
    else { av.textContent = initialOf(me.nick); av.classList.remove("has-photo"); }
  }
  $("#pfPhotoBtn").addEventListener("click", () => $("#pfPhotoFile").click());
  $("#accAvatar").addEventListener("click", () => $("#pfPhotoFile").click());
  $("#pfPhotoFile").addEventListener("change", async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast("Eso no es una imagen."); return; }
    const data = await compressImage(f, 320);
    if (!data) { toast("No se pudo leer la foto."); return; }
    pendingPhoto = data;
    paintMyAvatar(data);
    $("#pfPhotoDel").hidden = false;
    toast("📷 Foto lista. Toca \"Guardar perfil\".");
  });
  $("#pfPhotoDel").addEventListener("click", () => { pendingPhoto = null; paintMyAvatar(null); $("#pfPhotoDel").hidden = true; });
  $("#pfForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const err = $("#pfErr");
    err.textContent = "";
    const handle = normHandle($("#pfHandle").value);
    const about = $("#pfAbout").value.trim();
    if (handle.length < 3) { err.textContent = "Tu @usuario necesita mínimo 3 letras o números (sin espacios)."; return; }
    const owner = nickByHandle(handle);
    if (owner && owner.toLowerCase() !== me.nick.toLowerCase()) { err.textContent = `@${handle} ya lo usa ${owner}. Elige otro.`; return; }
    if (isOffensive(`${handle} ${about}`) || hasLink(about)) { err.textContent = "🛡️ Tu perfil tiene algo que no va con las reglas."; return; }
    const patch = { handle, about };
    if (pendingPhoto !== undefined) patch.photo = pendingPhoto;
    if (!saveMyProfile(patch)) { err.textContent = "No hay espacio para guardar la foto. Prueba con otra."; return; }
    $("#pfHandle").value = handle;
    renderMyAcc();
    toast("✅ Perfil guardado");
  });

  /* --- @menciones: al escribir "@" salen sugerencias --- */
  const mentionBox = $("#mentionBox");
  function mentionToken() {
    const pos = input.selectionStart ?? input.value.length;
    const m = input.value.slice(0, pos).match(/(^|\s)@([\p{L}\p{N}_.]{0,20})$/u);
    return m ? { start: pos - m[2].length - 1, end: pos, q: m[2] } : null;
  }
  function hideMentions() { mentionBox.hidden = true; mentionBox.innerHTML = ""; }
  function updateMentions() {
    const t = mentionToken();
    if (!t || !me) { hideMentions(); return; }
    const q = normHandle(t.q);
    const list = knownNicks()
      .filter((n) => n.toLowerCase() !== me.nick.toLowerCase())
      .map((n) => ({ n, p: profileOf(n) }))
      .filter((x) => !q || x.p.handle.includes(q) || normHandle(x.n).includes(q))
      .slice(0, 6);
    if (!list.length) { hideMentions(); return; }
    mentionBox.innerHTML = list.map((x, i) => `
      <button type="button" class="${i === 0 ? "is-first" : ""}" data-mpick="${esc(x.p.handle)}">
        <span class="msg__av">${avatarInner(x.n, memberByNick(x.n)?.color)}</span>
        <span><b>${esc(x.n)}</b><small>@${esc(x.p.handle)}</small></span>
      </button>`).join("");
    mentionBox.hidden = false;
  }
  function pickMention(h) {
    const t = mentionToken();
    if (!t) return;
    const v = input.value;
    input.value = `${v.slice(0, t.start)}@${h} ${v.slice(t.end)}`;
    const c = t.start + h.length + 2;
    input.setSelectionRange(c, c);
    input.focus();
    hideMentions();
  }
  input.addEventListener("input", updateMentions);
  input.addEventListener("click", updateMentions);
  input.addEventListener("blur", () => setTimeout(hideMentions, 150));
  input.addEventListener("keydown", (e) => {
    if (mentionBox.hidden) return;
    if (e.key === "Enter" || e.key === "Tab") {
      const first = $("[data-mpick]", mentionBox);
      if (first) { e.preventDefault(); pickMention(first.dataset.mpick); }
    } else if (e.key === "Escape") hideMentions();
  });
  mentionBox.addEventListener("mousedown", (e) => e.preventDefault()); // no pierde el foco del campo
  mentionBox.addEventListener("click", (e) => { const b = e.target.closest("[data-mpick]"); if (b) pickMention(b.dataset.mpick); });

  /* =====================================================
     Stickers externos: subir PNG / WebP (los de WhatsApp) / GIF animado, o desde un enlace
     ===================================================== */
  const MY_STK_MAX = 40;
  const myStickers = () => readLS("pm_my_stickers") || [];
  function saveMyStickers(list) { try { localStorage.setItem("pm_my_stickers", JSON.stringify(list)); return true; } catch { return false; } }
  function renderStickerGrid() {
    const mine = myStickers();
    $("#stickerGrid").innerHTML = `
      <p class="stk-sec">Mis stickers <small>${mine.length}/${MY_STK_MAX}</small></p>
      <button type="button" class="stk-add" data-stkadd><span>➕</span>Subir</button>
      <button type="button" class="stk-add" data-stkurl><span>🔗</span>Enlace</button>
      ${mine.map((s) => `<div class="stk-mine"><button type="button" data-mystk="${esc(s.id)}" aria-label="Enviar sticker">${stickerHtml({ img: s.src })}</button><button type="button" class="stk-del" data-mystkdel="${esc(s.id)}" aria-label="Borrar sticker">✕</button></div>`).join("")}
      <p class="stk-sec">Stickers del parche</p>
      ${STICKERS.map((s, i) => `<button type="button" data-sticker="${i}" aria-label="Sticker ${esc(s.t || "")}">${stickerHtml(s)}</button>`).join("")}
      <p class="stk-note">🚫 Nada de stickers sexuales ni ofensivos (regla 03). Se pueden reportar.</p>`;
  }
  renderStickerGrid();

  // reduce el sticker a 256 px sin perder la transparencia (los GIF se guardan tal cual para que se muevan)
  function stickerFromFile(file) {
    return new Promise((resolve) => {
      if (file.type === "image/gif") {
        if (file.size > 1.2 * 1024 * 1024) { resolve({ error: "El GIF pesa más de 1,2 MB." }); return; }
        const fr = new FileReader();
        fr.onload = () => resolve({ src: fr.result });
        fr.onerror = () => resolve({ error: "No se pudo leer el GIF." });
        fr.readAsDataURL(file);
        return;
      }
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, 256 / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        let src = c.toDataURL("image/webp", 0.9);
        if (!src.startsWith("data:image/webp")) src = c.toDataURL("image/png"); // Safari viejo no guarda WebP
        resolve({ src });
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve({ error: "No se pudo leer esa imagen." }); };
      img.src = url;
    });
  }
  function addMySticker(src) {
    const list = myStickers();
    if (list.length >= MY_STK_MAX) { toast(`Máximo ${MY_STK_MAX} stickers. Borra alguno con ✕.`); return; }
    list.unshift({ id: `k${Date.now().toString(36)}`, src });
    if (!saveMyStickers(list)) { toast("No hay espacio para más stickers. Borra alguno."); return; }
    renderStickerGrid();
    toast("✨ Sticker agregado a Mis stickers");
  }
  $("#stkFile").addEventListener("change", async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    for (const f of files.slice(0, 10)) {
      if (!/^image\/(png|webp|gif|jpeg)$/.test(f.type)) { toast("Usa imágenes PNG, WebP, GIF o JPG."); continue; }
      if (f.size > 5 * 1024 * 1024) { toast("Esa imagen pesa más de 5 MB."); continue; }
      const r = await stickerFromFile(f);
      if (r.error) toast(r.error); else addMySticker(r.src);
    }
  });
  $("#stickerGrid").addEventListener("click", (e) => {
    const t = e.target;
    if (t.closest("[data-stkadd]")) { if (!denied("media")) $("#stkFile").click(); return; }
    if (t.closest("[data-stkurl]")) {
      if (denied("media")) return;
      const url = (prompt("Pega el enlace de la imagen del sticker (PNG, WebP o GIF):", "https://") || "").trim();
      if (!/^https?:\/\/\S+$/i.test(url)) return;
      const probe = new Image();
      const timer = setTimeout(() => { probe.src = ""; toast("Ese enlace no carga. Prueba con otro."); }, 8000);
      probe.onload = () => { clearTimeout(timer); addMySticker(url); };
      probe.onerror = () => { clearTimeout(timer); toast("Ese enlace no es una imagen."); };
      probe.src = url;
      return;
    }
    const del = t.closest("[data-mystkdel]");
    if (del) {
      if (!confirm("¿Borrar este sticker de Mis stickers?")) return;
      saveMyStickers(myStickers().filter((s) => s.id !== del.dataset.mystkdel));
      renderStickerGrid();
      return;
    }
    const mine = t.closest("[data-mystk]");
    if (mine) {
      if (denied("media")) return;
      const s = myStickers().find((x) => x.id === mine.dataset.mystk);
      if (!s) return;
      addMsg({ who: "me", sticker: { img: s.src, t: "Sticker" } });
      toggleMedia(false);
      maybeReply();
      return;
    }
    const b = t.closest("[data-sticker]");
    if (!b || !me) return;
    addMsg({ who: "me", sticker: STICKERS[+b.dataset.sticker] });
    toggleMedia(false);
    maybeReply();
  });

  $("#joinForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const err = $("#joinError");
    const v = (id) => $(id).value.trim().replace(/\s+/g, " ");
    const nick = v("#nickInput"), name = v("#joinName"), city = v("#joinCity"), intro = $("#joinIntro").value.trim();
    const via = $('input[name="joinVia"]:checked').value;
    const reco = v("#joinReco");
    err.textContent = "";
    if (nick.length < 2) { err.textContent = "Tu apodo necesita al menos 2 letras."; return; }
    if (isOffensive(nick)) { err.textContent = "Ese apodo no va con el parche. Elige otro, porfa."; return; }
    if (memberByNick(nick)) { err.textContent = "Ese apodo ya lo usa alguien del parche. Elige otro."; return; }
    if (name.length < 2) { err.textContent = "Escribe tu nombre (solo lo ven los admins)."; return; }
    if (city.length < 2) { err.textContent = "Cuéntanos de dónde eres."; return; }
    if (isOffensive(`${name} ${city} ${intro}`) || hasLink(intro)) { err.textContent = "🛡️ Tu presentación tiene algo que no va con las reglas."; return; }
    let recommendedBy = null;
    if (via === "recomendacion") {
      const rm = memberByNick(reco);
      if (!rm || rm.status === "expulsado" || rm.role === "prueba") { err.textContent = "No encontramos a ese miembro. Escribe su apodo tal como sale en el chat (no puede estar en prueba)."; return; }
      recommendedBy = rm.nick;
    }
    if (!$("#pactCheck").checked) { err.textContent = "Para entrar tienes que aceptar las reglas de respeto."; return; }
    const req = {
      id: `S-${Date.now().toString(36).toUpperCase()}`,
      nick, color: myColor, name, city, intro, via, recommendedBy,
      age: +store.get("pm_age") || null,
      createdAt: new Date().toISOString(),
      status: "pendiente",
    };
    try {
      localStorage.setItem("pm_requests", JSON.stringify([req, ...loadRequests()]));
    } catch { err.textContent = "No se pudo enviar la solicitud. Intenta de nuevo."; return; }
    store.set("pm_my_request", req.id);
    closeJoin();
    syncMembership();
    toast(via === "recomendacion" ? `🙋 Solicitud enviada con la recomendación de ${recommendedBy}.` : "🙋 Solicitud enviada. Los admins la revisan pronto.");
  });

  // Filtro anti-acoso (básico, del lado del cliente)
  const BLOCKED = DATA.blocked;
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const BLOCKED_N = BLOCKED.map(norm);
  const hasLink = (s) => /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|co|net|org|me|ly|io|link|xyz)\b|wa\.me|t\.me)/i.test(s);
  function isOffensive(s) {
    const t = ` ${norm(s).replace(/[^a-z0-9ñ ]/g, " ").replace(/\s+/g, " ")} `;
    return BLOCKED_N.some((w) => t.includes(` ${w} `));
  }

  // Respuestas del parche (simuladas para la demo)
  const REPLIES = [
    "¡De una! 🔥", "Jajaja qué chimba", "Yo me apunto también 🙋‍♀️", "¿Alguien sale desde el norte? Nos vamos juntos",
    "Llevo parlante 🔊", "Uy sí, ese plan está muy bueno", "Confirmo 💜", "¿Y si después vamos por unas empanadas?",
  ];
  let typingTimer;
  function botSay(nick, text) { addMsg({ who: "them", nick, color: PEOPLE[nick], text }); }
  function maybeReply() {
    clearTimeout(typingTimer);
    if (!SIMULATE) return; // sin respuestas falsas: solo personas reales
    if (Math.random() < 0.35) return;
    const names = Object.keys(PEOPLE);
    typingTimer = setTimeout(() => {
      const nick = names[Math.floor(Math.random() * names.length)];
      if (Math.random() < 0.3) addMsg({ who: "them", nick, color: PEOPLE[nick], sticker: STICKERS[Math.floor(Math.random() * STICKERS.length)] });
      else botSay(nick, REPLIES[Math.floor(Math.random() * REPLIES.length)]);
    }, 1200 + Math.random() * 1800);
  }

  composeForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || !me) return;
    if (isOffensive(text)) {
      toast("🛡️ Mensaje bloqueado por el filtro anti-acoso. Aquí hablamos con respeto.");
      input.select();
      return;
    }
    if (hasLink(text)) {
      toast("❌ Nada de spam: los enlaces solo se publican con permiso de los administradores.");
      input.select();
      return;
    }
    addMsg({ who: "me", text });
    input.value = "";
    maybeReply();
  });

  /* Notas de voz: grabación real si el navegador lo permite, si no se simula */
  let rec = null;
  function setRecUI(on) {
    composeForm.hidden = on;
    recBar.hidden = !on;
  }
  async function startRec() {
    if (!me || rec) return;
    stopPlaying();
    rec = { secs: 0, chunks: [], media: null, stream: null, cancelled: false };
    recTime.textContent = "0:00";
    setRecUI(true);
    rec.timer = setInterval(() => {
      rec.secs++;
      recTime.textContent = fmt(rec.secs);
      if (rec.secs >= 120) finishRec(true);
    }, 1000);
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error("sin soporte");
      const r = rec;
      r.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (rec !== r) { r.stream.getTracks().forEach((t) => t.stop()); return; } // cancelado mientras pedía permiso
      r.media = new MediaRecorder(r.stream);
      r.media.ondataavailable = (ev) => ev.data.size && r.chunks.push(ev.data);
      r.media.start();
    } catch {
      /* sin micrófono: seguimos en modo demo */
    }
  }
  function finishRec(send) {
    if (!rec) return;
    const r = rec;
    rec = null;
    clearInterval(r.timer);
    setRecUI(false);
    const done = () => {
      r.stream?.getTracks().forEach((t) => t.stop());
      if (!send) { toast("Nota de voz cancelada"); return; }
      const dur = Math.max(r.secs, 1);
      const url = r.chunks.length ? URL.createObjectURL(new Blob(r.chunks, { type: r.media?.mimeType || "audio/webm" })) : null;
      addMsg({ who: "me", voice: { dur, url } });
      maybeReply();
    };
    if (r.media && r.media.state !== "inactive") { r.media.onstop = done; r.media.stop(); } else done();
    input.focus({ preventScroll: true });
  }
  micBtn.addEventListener("click", startRec);
  $("#recCancel").addEventListener("click", () => finishRec(false));
  $("#recSend").addEventListener("click", () => finishRec(true));

  // "En línea" que se mueve un poquito
  const online = $("#online");
  setInterval(() => {
    const n = Math.max(8, Math.min(19, +online.textContent + (Math.random() < 0.5 ? -1 : 1)));
    online.textContent = n;
  }, 7000);

  /* =====================================================
     Stickers, GIFs, fotos y videos
     ===================================================== */
  const mediaPanel = $("#mediaPanel");
  const mediaBtn = $("#mediaBtn");
  const fileInput = $("#fileInput");
  const gifGrid = $("#gifGrid");
  const gifNote = $("#gifNote");
  let activeTab = "stickers";
  let gifLoadedFor = null;

  function toggleMedia(force) {
    const open = force ?? mediaPanel.hidden;
    if (open && !me) return;
    mediaPanel.hidden = !open;
    mediaBtn.setAttribute("aria-expanded", String(open));
    if (open) { setTab(activeTab); scrollDown(); }
  }
  function setTab(tab) {
    activeTab = tab;
    $$(".media-panel__tabs button", mediaPanel).forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
    $$(".media-panel__pane", mediaPanel).forEach((p) => (p.hidden = p.dataset.pane !== tab));
    if (tab === "gifs" && gifLoadedFor === null) loadGifs("");
  }
  mediaBtn.addEventListener("click", () => toggleMedia());
  $(".media-panel__tabs", mediaPanel).addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]");
    if (b) setTab(b.dataset.tab);
  });

  // Stickers: la cuadrícula y los stickers externos están en la sección "Stickers externos"

  // Barra de mensajes fijados
  $("#pinnedGo").addEventListener("click", goToPin);
  $("#pinnedX").addEventListener("click", () => {
    if (denied("pin")) return;
    const p = pins[pinIdx];
    const m = p && body.querySelector(`[data-mid="${p.mid}"]`);
    if (m) togglePin(m);
  });

  // Crear encuesta
  const cpollOpts = $("#cpollOpts");
  function addCpollOpt() {
    if (cpollOpts.children.length >= 5) { toast("Máximo 5 opciones."); return; }
    const row = document.createElement("div");
    row.className = "cpoll-form__opt";
    row.innerHTML = `<input type="text" maxlength="40" placeholder="Opción ${cpollOpts.children.length + 1}" aria-label="Opción de la encuesta" /><button type="button" aria-label="Quitar opción">✕</button>`;
    $("button", row).addEventListener("click", () => { if (cpollOpts.children.length > 2) row.remove(); else $("input", row).value = ""; });
    cpollOpts.appendChild(row);
  }
  addCpollOpt(); addCpollOpt();
  $("#cpollAdd").addEventListener("click", addCpollOpt);
  $("#cpollForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (denied("poll")) return;
    const q = $("#cpollQ").value.trim();
    const options = $$("input", cpollOpts).map((i) => i.value.trim()).filter(Boolean);
    if (q.length < 3) { toast("Escribe la pregunta de la encuesta."); $("#cpollQ").focus(); return; }
    if (options.length < 2) { toast("La encuesta necesita al menos 2 opciones."); return; }
    if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) { toast("Hay opciones repetidas."); return; }
    const all = [q, ...options].join(" ");
    if (isOffensive(all)) { toast("🛡️ La encuesta tiene palabras que no van con las reglas."); return; }
    if (hasLink(all)) { toast("❌ Nada de enlaces sin permiso de los administradores."); return; }
    const el = addMsg({ who: "me", poll: { q, options: options.map((t) => ({ t, v: 0 })) } });
    simulatePollVotes(el);
    $("#cpollQ").value = "";
    cpollOpts.innerHTML = "";
    addCpollOpt(); addCpollOpt();
    toggleMedia(false);
    toast("📊 ¡Encuesta enviada al parche!");
  });

  // GIFs (búsqueda con GIPHY si hay clave configurada)
  async function loadGifs(q) {
    gifLoadedFor = q;
    if (!CONFIG.GIPHY_API_KEY) {
      gifGrid.innerHTML = `<div class="gif-empty" style="column-span:all">
        Para buscar GIFs, el admin tiene que poner la clave de GIPHY en <b>script.js</b> (CONFIG.GIPHY_API_KEY).
        <br /><button type="button" class="btn btn--ghost btn--sm" data-pick="image/gif">🌀 Mandar un GIF de tu cel</button></div>`;
      gifNote.textContent = "";
      return;
    }
    gifGrid.innerHTML = `<p class="gif-empty" style="column-span:all">Cargando GIFs…</p>`;
    const endpoint = q ? "search" : "trending";
    const url = `https://api.giphy.com/v1/gifs/${endpoint}?api_key=${encodeURIComponent(CONFIG.GIPHY_API_KEY)}&limit=24&rating=pg&lang=es${q ? `&q=${encodeURIComponent(q)}` : ""}`;
    try {
      const res = await fetch(url);
      const json = await res.json();
      if (gifLoadedFor !== q) return; // llegó una búsqueda más nueva
      const items = (json.data || []).map((g) => ({ thumb: g.images?.fixed_width_small?.url || g.images?.fixed_width?.url, full: g.images?.fixed_width?.url || g.images?.original?.url, title: g.title || "GIF" })).filter((g) => g.thumb && g.full);
      gifGrid.innerHTML = items.length
        ? items.map((g) => `<button type="button" data-gif="${esc(g.full)}" aria-label="${esc(g.title)}"><img src="${esc(g.thumb)}" alt="" loading="lazy" /></button>`).join("")
        : `<p class="gif-empty" style="column-span:all">No encontramos GIFs con eso 🤷</p>`;
      gifNote.textContent = "Powered by GIPHY";
    } catch {
      gifGrid.innerHTML = `<p class="gif-empty" style="column-span:all">No se pudieron cargar los GIFs. Revisa tu conexión.</p>`;
    }
  }
  let gifTimer;
  $("#gifQuery").addEventListener("input", (e) => {
    clearTimeout(gifTimer);
    gifTimer = setTimeout(() => loadGifs(e.target.value.trim()), 450);
  });
  $("#gifSearch").addEventListener("submit", (e) => { e.preventDefault(); loadGifs($("#gifQuery").value.trim()); });
  gifGrid.addEventListener("click", (e) => {
    const b = e.target.closest("[data-gif]");
    if (!b || denied("media")) return;
    addMsg({ who: "me", media: { type: "gif", url: b.dataset.gif } });
    toggleMedia(false);
    maybeReply();
  });

  // Fotos y videos desde el dispositivo
  const LIMITS = { image: 10, video: 30 }; // MB
  let pending = null;
  function pickFile(accept) {
    fileInput.accept = accept;
    fileInput.value = "";
    fileInput.click();
  }
  mediaPanel.addEventListener("click", (e) => {
    const b = e.target.closest("[data-pick]");
    if (b) pickFile(b.dataset.pick);
  });
  $("#attachBtn").addEventListener("click", () => { if (!denied("media")) pickFile("image/*,video/*"); });
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const isImg = file.type.startsWith("image/");
    const isVid = file.type.startsWith("video/");
    if (!isImg && !isVid) { toast("Solo puedes mandar fotos, GIFs o videos."); return; }
    const max = LIMITS[isImg ? "image" : "video"];
    if (file.size > max * 1024 * 1024) { toast(`Muy pesado: máximo ${max} MB para ${isImg ? "fotos" : "videos"}.`); return; }
    if (pending) URL.revokeObjectURL(pending.url);
    pending = { type: file.type === "image/gif" ? "gif" : isImg ? "image" : "video", url: URL.createObjectURL(file) };
    $("#previewMedia").innerHTML = pending.type === "video"
      ? `<video src="${pending.url}" muted playsinline></video>`
      : `<img src="${pending.url}" alt="Vista previa" />`;
    $("#previewCaption").value = "";
    toggleMedia(false);
    composeForm.hidden = true;
    $("#filePreview").hidden = false;
    $("#previewCaption").focus({ preventScroll: true });
  });
  function closePreview(revoke) {
    if (revoke && pending) URL.revokeObjectURL(pending.url);
    pending = null;
    $("#previewMedia").innerHTML = "";
    $("#filePreview").hidden = true;
    composeForm.hidden = false;
  }
  $("#previewCancel").addEventListener("click", () => closePreview(true));
  function sendPending() {
    if (!pending || denied("media")) return;
    const caption = $("#previewCaption").value.trim();
    if (caption && isOffensive(caption)) { toast("🛡️ Ese mensaje no pasa el filtro anti-acoso."); return; }
    addMsg({ who: "me", media: pending, text: caption });
    closePreview(false); // la URL sigue viva para que se vea en el chat
    maybeReply();
  }
  $("#previewSend").addEventListener("click", sendPending);
  $("#previewCaption").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); sendPending(); } });

  // Visor de imágenes
  const lightbox = $("#lightbox");
  function openLightbox(src) {
    $("#lightboxImg").src = src;
    lightbox.hidden = false;
  }
  function closeLightbox() {
    if (lightbox.hidden) return;
    lightbox.hidden = true;
    $("#lightboxImg").removeAttribute("src");
  }
  lightbox.addEventListener("click", closeLightbox);

  /* =====================================================
     Reportes: privados (anónimos) o públicos → les llegan a los admins
     ===================================================== */
  const reportModal = $("#reportModal");
  const reportForm = $("#reportForm");
  const repError = $("#repError");
  const repPublic = $("#repPublic");
  let reportCtx = null;

  function openReport({ who = "", evidence = null, btn = null } = {}) {
    reportCtx = { evidence, btn };
    reportForm.reset();
    repError.textContent = "";
    $("#repWho").value = who;
    $("#peopleList").innerHTML = Object.keys(PEOPLE).map((n) => `<option value="${esc(n)}"></option>`).join("");
    const ev = $("#repEvidence");
    if (evidence) {
      const detail = evidence.text ? `“${esc(evidence.text)}”` : `[${KIND_LABEL[evidence.kind] || "Mensaje"}]`;
      ev.innerHTML = `<small>${KIND_LABEL[evidence.kind] || "Mensaje"} reportado · ${esc(evidence.time || "")}</small>${detail}`;
      ev.hidden = false;
      $("#repWhere").value = "En el chat del grupo";
    } else {
      ev.hidden = true;
    }
    // el reporte público va con apodo, así que requiere haber entrado al chat
    repPublic.disabled = !me;
    repPublic.closest(".vis__opt").title = me ? "" : "Entra al chat con tu apodo para poder hacer reportes públicos";
    lastFocus = document.activeElement;
    reportModal.hidden = false;
    document.body.style.overflow = "hidden";
    setTimeout(() => (who ? $("#repReason") : $("#repWho")).focus(), 50);
  }
  function closeReport() {
    if (reportModal.hidden) return;
    reportModal.hidden = true;
    document.body.style.overflow = "";
    lastFocus?.focus?.({ preventScroll: true });
  }
  $$("[data-close]", reportModal).forEach((el) => el.addEventListener("click", closeReport));
  $$("[data-report]").forEach((b) => b.addEventListener("click", () => { closeMenu(); openReport(); }));

  // Reduce la captura para que pese poco
  function compressImage(file, maxSide = 1000) {
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
        resolve(c.toDataURL("image/jpeg", 0.72));
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }

  function saveReport(report) {
    const list = JSON.parse(store.get("pm_reports") || "[]");
    list.unshift(report);
    let saved = false;
    try { localStorage.setItem("pm_reports", JSON.stringify(list.slice(0, 200))); saved = true; } catch {
      // sin espacio: guardamos sin la imagen
      try { list[0] = { ...report, evidenceImage: null, note: "Captura demasiado pesada" }; localStorage.setItem("pm_reports", JSON.stringify(list.slice(0, 200))); saved = true; } catch { /* nada */ }
    }
    if (CONFIG.REPORT_ENDPOINT) {
      fetch(CONFIG.REPORT_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(report) })
        .catch(() => toast("⚠️ No se pudo enviar al servidor. Intenta de nuevo en un rato."));
      saved = true;
    }
    return saved;
  }

  reportForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    repError.textContent = "";
    const who = $("#repWho").value.trim();
    const reason = $("#repReason").value;
    const visibility = reportForm.repVis.value;
    if (who.length < 2) { repError.textContent = "Escribe el apodo de la persona que quieres reportar."; return; }
    if (me && who.toLowerCase() === me.nick.toLowerCase()) { repError.textContent = "No te puedes reportar a ti mismo, parcero 😅"; return; }
    if (!reason) { repError.textContent = "Elige el motivo del reporte."; return; }
    if (visibility === "publico" && !me) { repError.textContent = "Para un reporte público tienes que entrar al chat con tu apodo."; return; }

    const submitBtn = $("button[type=submit]", reportForm);
    submitBtn.disabled = true;
    const file = $("#repFile").files?.[0];
    const evidenceImage = file && file.type.startsWith("image/") ? await compressImage(file) : null;

    const report = {
      id: `R-${Date.now().toString(36).toUpperCase()}`,
      createdAt: new Date().toISOString(),
      reported: who,
      reason,
      where: $("#repWhere").value,
      details: $("#repDetails").value.trim(),
      visibility,
      reporter: visibility === "publico" ? me.nick : "Anónimo",
      evidenceMessage: reportCtx?.evidence || null,
      evidenceImage,
      status: "pendiente",
    };
    const ok = saveReport(report);
    submitBtn.disabled = false;
    if (!ok) { repError.textContent = "No se pudo guardar el reporte. Intenta de nuevo."; return; }

    if (reportCtx?.btn) { reportCtx.btn.textContent = "✓ reportado"; reportCtx.btn.classList.add("is-done"); }
    closeReport();
    if (visibility === "publico") {
      addSys(`📢 Reporte público: ${me.nick} reportó a ${who} por “${reason}”. Los admins ya lo están revisando 🛡️`, true);
      toast("📢 Reporte público enviado a los admins y avisado en el chat.");
    } else {
      toast("🔒 Reporte privado enviado. Solo lo ven los admins, nadie sabrá que fuiste tú.");
    }
  });

  /* Insignias del hero: llevan a su sección y la resaltan */
  function flash(el) {
    if (!el) return;
    el.classList.remove("is-flash");
    void el.offsetWidth; // reinicia la animación
    el.classList.add("is-flash");
    el.addEventListener("animationend", () => el.classList.remove("is-flash"), { once: true });
  }
  function goAndFlash(target, then) {
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    setTimeout(() => { flash(target); then?.(); }, reduceMotion ? 0 : 700);
  }
  $$("[data-badge]").forEach((b) => b.addEventListener("click", () => {
    const kind = b.dataset.badge;
    if (kind === "age") {
      goAndFlash($(".rule-big--age"), () => toast("🔞 Aquí solo entran personas de 18 a 36 años. Verificamos la edad antes de entrar."));
    } else if (kind === "zero") {
      goAndFlash($(".rule-big--zero"), () => toast("🚫 Cero acoso, cero contenido sexual y cero DM sin permiso = expulsión sin excepción."));
    } else if (kind === "live") {
      goAndFlash(chatApp, () => {
        toast(`🟢 Hay ${online.textContent} parceros en línea ahora mismo`);
        if (!me) openJoin(); else input.focus({ preventScroll: true });
      });
    } else if (kind === "filter") {
      goAndFlash(chatApp, () => {
        toast("🛡️ El filtro bloquea comentarios sexuales, piropos e insultos antes de que se envíen");
        if (me) { flash($(".chat__field")); input.focus({ preventScroll: true }); }
      });
    } else if (kind === "report") {
      openReport();
    } else if (kind === "audio") {
      goAndFlash(chatApp, () => {
        if (!me) { toast("🎙️ Entra al chat para mandar notas de voz"); openJoin(); }
        else { flash(micBtn); toast("🎙️ Toca el micrófono para grabar tu nota de voz"); }
      });
    }
  }));

  /* =====================================================
     Modo edición de imágenes (admins): index.html?editar
     ===================================================== */
  // aplica las imágenes cambiadas a los lugares fijos de la página
  function applyStaticImages() {
    const logo = slotImg("logo", "assets/logo.jpg");
    $$("img[data-logo]").forEach((i) => (i.src = logo));
    $("#favicon")?.setAttribute("href", logo);
    $$("[data-slot]").forEach((el) => {
      const slot = el.dataset.slot;
      if (slot === "logo" || slot.startsWith("plan-") || slot.startsWith("mem-")) return;
      const custom = customImgs[slot];
      if (el.classList.contains("card__icon")) {
        if (el.dataset.orig == null) el.dataset.orig = el.textContent;
        el.innerHTML = custom ? `<img src="${esc(custom)}" alt="" />` : esc(el.dataset.orig);
        return;
      }
      const img = el.tagName === "IMG" ? el : $("img", el);
      if (!img) return;
      if (img.dataset.orig == null) img.dataset.orig = img.getAttribute("src");
      img.src = custom || img.dataset.orig;
      if (el.dataset.full != null) el.dataset.full = img.src;
    });
  }
  applyStaticImages();

  function saveImgs() {
    try { localStorage.setItem("pm_imgs", JSON.stringify(customImgs)); return true; } catch { return false; }
  }
  function refreshAllImages() {
    applyStaticImages();
    renderPlans();
    renderMems();
  }

  const editing = /[?&]editar\b/.test(location.search);
  let isAdmin = false;
  try { isAdmin = sessionStorage.getItem("pm_admin") === "1"; } catch { /* */ }
  const slotMenu = $("#slotMenu");
  const slotFile = $("#slotFile");
  let activeSlot = null;

  if (editing && !isAdmin) {
    toast("🔒 Para editar imágenes entra primero al panel de admins (admin.html).");
  } else if (editing) {
    document.body.classList.add("is-editing");
    $("#editBar").hidden = false;
    openSite(); // los admins no pasan por la ventana de bienvenida en este modo
    toast("🖼️ Modo edición: toca cualquier imagen con borde amarillo");

    // en modo edición, tocar una imagen abre el menú en vez de su acción normal
    document.addEventListener("click", (e) => {
      if (e.target.closest("#slotMenu, #editBar")) return;
      const slotEl = e.target.closest("[data-slot]");
      if (!slotEl) { slotMenu.hidden = true; return; }
      e.preventDefault();
      e.stopPropagation();
      activeSlot = slotEl.dataset.slot;
      $("#slotReset").hidden = !customImgs[activeSlot];
      slotMenu.hidden = false;
      const w = slotMenu.offsetWidth, h = slotMenu.offsetHeight;
      slotMenu.style.left = `${Math.min(e.clientX, innerWidth - w - 10)}px`;
      slotMenu.style.top = `${Math.min(e.clientY, innerHeight - h - 10)}px`;
    }, true);
    window.addEventListener("scroll", () => (slotMenu.hidden = true), { passive: true });

    $("#slotChange").addEventListener("click", () => { slotMenu.hidden = true; slotFile.value = ""; slotFile.click(); });
    $("#slotReset").addEventListener("click", () => {
      slotMenu.hidden = true;
      delete customImgs[activeSlot];
      saveImgs();
      refreshAllImages();
      toast("↺ Imagen original restaurada");
    });
    slotFile.addEventListener("change", async () => {
      const f = slotFile.files?.[0];
      if (!f || !activeSlot) return;
      if (!f.type.startsWith("image/")) { toast("Eso no es una imagen."); return; }
      const small = activeSlot.startsWith("card-") || activeSlot === "logo";
      const data = await compressImage(f, small ? 500 : 1400);
      if (!data) { toast("No se pudo leer la imagen."); return; }
      const before = customImgs[activeSlot];
      customImgs[activeSlot] = data;
      if (!saveImgs()) {
        if (before) customImgs[activeSlot] = before; else delete customImgs[activeSlot];
        toast("⚠️ No hay espacio para más imágenes. Usa una más liviana o restaura otras.");
        return;
      }
      refreshAllImages();
      toast("✅ Imagen cambiada");
    });
    $("#editResetAll").addEventListener("click", () => {
      if (!confirm("¿Volver a poner TODAS las imágenes originales?")) return;
      Object.keys(customImgs).forEach((k) => delete customImgs[k]);
      saveImgs();
      refreshAllImages();
      toast("↺ Todas las imágenes originales restauradas");
    });
    $("#editExit").addEventListener("click", () => { location.href = location.pathname; });
  }

  // estado de la solicitud / rol al cargar (al final, cuando ya existe todo el chat)
  syncMembership();

  /* Título grande de la portada: se ajusta para que quepa completo en cualquier pantalla
     (celular pequeño, acostado, tablet, PC o TV) */
  function fitHeroTitle() {
    const el = $(".hero__title");
    if (!el) return;
    el.style.fontSize = "";
    const box = el.parentElement.clientWidth;
    const need = el.scrollWidth * 1.06; // + margen por la inclinación de la letra
    if (need > box) {
      const size = parseFloat(getComputedStyle(el).fontSize) * (box / need);
      el.style.fontSize = `${Math.max(size, 26)}px`;
    }
  }
  fitHeroTitle();
  document.fonts?.ready?.then(fitHeroTitle);
  let fitT;
  window.addEventListener("resize", () => { clearTimeout(fitT); fitT = setTimeout(fitHeroTitle, 120); });
  window.addEventListener("orientationchange", () => setTimeout(fitHeroTitle, 300));

  /* =====================================================
     Cifras automáticas
     - Parceros: miembros activos (suben solos cuando los admins aceptan solicitudes)
     - Planes hechos: parches cuya fecha ya pasó
     - Respeto: % de miembros sin sanciones (empieza en 0 hasta que haya miembros)
     - Tolerancia al acoso: casos de acoso confirmados por los admins
     ===================================================== */
  const HARASS = ["Acoso o mensajes insistentes", "Comentarios sexuales o piropos incómodos", "Fotos, videos o audios sin permiso", "Amenazas o violencia"];
  function computeStats() {
    // los personajes de ejemplo del chat no cuentan: solo personas reales
    const ms = readMembers().filter((m) => !m.demo && !DEFAULTS.DEMO_NICKS.includes(m.nick.toLowerCase()));
    const reports = readLS("pm_reports") || [];
    const confirmed = reports.filter((r) => r.status === "resuelto" || r.status === "expulsado");
    const sanctioned = new Set(confirmed.map((r) => String(r.reported || "").toLowerCase()));
    ms.filter((m) => m.status === "expulsado").forEach((m) => sanctioned.add(m.nick.toLowerCase()));
    const clean = ms.filter((m) => !sanctioned.has(m.nick.toLowerCase())).length;
    const harassLocal = confirmed.filter((r) => HARASS.includes(r.reason)).length;
    return {
      parceros: ms.filter((m) => m.status !== "expulsado").length,
      planes: allPlans().filter((p) => daysUntil(p.date) < 0).length,
      respeto: ms.length ? Math.round((clean / ms.length) * 100) : 0,
      acoso: Math.max(harassLocal, +(window.SITE_DATA?.stats?.harassCases) || 0),
    };
  }
  function updateStats() {
    const s = computeStats();
    Object.entries(s).forEach(([k, n]) => {
      const el = $(`[data-stat="${k}"]`);
      if (!el) return;
      el.dataset.count = n;
      if (el.dataset.seen) el.textContent = (el.dataset.prefix || "") + n + (el.dataset.suffix || "");
    });
    // etiqueta flotante de la portada: "{parceros} parceros 💜"
    const st = $('[data-text="hero.sticker2"]');
    if (st) {
      st.dataset.tpl ||= st.textContent;
      st.textContent = st.dataset.tpl.replace(/\{parceros\}/g, s.parceros);
    }
  }
  updateStats();
  window.addEventListener("storage", (e) => {
    if (["pm_members", "pm_reports", "pm_seed_plans", "pm_plans"].includes(e.key)) updateStats();
  });

  $("#year").textContent = new Date().getFullYear();
})();
