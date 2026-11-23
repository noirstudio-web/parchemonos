/* =========================================================
   ParchéMonos · contenido por defecto
   Lo usan la página (script.js) y el panel de admins (admin.js).
   Los cambios que hacen los admins NO se guardan aquí, sino en
   site-data.js (publicado) o en el navegador del admin (vista previa).
   Formato de textos: **negrita** · salto de línea normal = <br>
   ========================================================= */
(function () {
  "use strict";

  const inDays = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  // [grupo, clave, etiqueta, texto por defecto, ¿varias líneas?]
  const TEXT_FIELDS = [
    ["Marca", "brand.1", "Nombre (parte blanca)", "Parché"],
    ["Marca", "brand.2", "Nombre (parte amarilla)", "Monos"],

    ["Bienvenida (ventana de entrada)", "gate.sec.t", "Título paso de seguridad", "Verificación de seguridad"],
    ["Bienvenida (ventana de entrada)", "gate.sec.d", "Texto paso de seguridad", "Antes de entrar revisamos tu conexión y que seas una persona real, no un bot. 🤖🚫", true],
    ["Bienvenida (ventana de entrada)", "gate.age.t", "Título paso de edad", "¿Tienes entre 18 y 36?"],
    ["Bienvenida (ventana de entrada)", "gate.age.d", "Texto paso de edad", "ParchéMonos es para personas de 18 a 36 años. Pon tu fecha de nacimiento y calculamos tu edad.", true],

    ["Inicio (portada)", "hero.eyebrow", "Texto pequeño de arriba", "Grupo de salidas · Colombia"],
    ["Inicio (portada)", "hero.sub", "Subtítulo (separa con •)", "Planes • Amigos • Aventuras"],
    ["Inicio (portada)", "hero.text", "Texto principal", "El parche para salir, conocer gente nueva y hacer amigos de verdad. **Llega solo, sal con parche.**", true],
    ["Inicio (portada)", "hero.cta1", "Botón 1", "Unirme al parche"],
    ["Inicio (portada)", "hero.cta2", "Botón 2", "Ver próximos planes"],
    ["Inicio (portada)", "hero.badge1", "Insignia 1", "🔞 De 18 a 36 años"],
    ["Inicio (portada)", "hero.badge2", "Insignia 2", "🚫 Cero acoso"],
    ["Inicio (portada)", "hero.badge3", "Insignia 3", "🎙️ Chat con audios"],
    ["Inicio (portada)", "hero.sticker1", "Etiqueta flotante 1", "¿Pa' dónde vamos? 🗺️"],
    ["Inicio (portada)", "hero.sticker2", "Etiqueta flotante 2 ({parceros} = número de parceros, se pone solo)", "{parceros} parceros 💜"],
    ["Inicio (portada)", "marquee", "Cinta que se mueve (separa con comas)", "Planes, Amigos, Aventuras, De 18 a 36, Cero acoso, Caminatas, Rumba"],

    ["¿Qué es el parche?", "parche.eyebrow", "Texto pequeño", "El parche"],
    ["¿Qué es el parche?", "parche.title", "Título", "¿Qué es el parche?"],
    ["¿Qué es el parche?", "parche.lead", "Descripción", "Un grupo de gente bacana que se reúne a salir. No importa si llegas solo: aquí nadie se queda por fuera. Proponemos planes, nos apuntamos y nos vemos allá.", true],
    ["¿Qué es el parche?", "card1.t", "Tarjeta 1 · título", "Miradores"],
    ["¿Qué es el parche?", "card1.d", "Tarjeta 1 · texto", "Atardeceres con la ciudad a los pies, tinto o cerveza en mano y buena charla hasta que prendan las luces.", true],
    ["¿Qué es el parche?", "card2.t", "Tarjeta 2 · título", "Caminatas"],
    ["¿Qué es el parche?", "card2.d", "Tarjeta 2 · texto", "Senderos, cascadas y montaña. Ritmo para todos, guía que se sabe el camino y nadie se queda atrás.", true],
    ["¿Qué es el parche?", "card3.t", "Tarjeta 3 · título", "Rumba"],
    ["¿Qué es el parche?", "card3.d", "Tarjeta 3 · texto", "Karaoke, salsa, reguetón o lo que suene. Rumba sana, en grupo, y todos volvemos a casa bien.", true],
    ["¿Qué es el parche?", "card4.t", "Tarjeta 4 · título", "Comida y más"],
    ["¿Qué es el parche?", "card4.d", "Tarjeta 4 · texto", "Food tours callejeros, paseo de olla, juegos de mesa, cine… si suena chimba, lo armamos.", true],

    // los números se calculan solos; aquí solo se cambia el texto de cada cifra
    ["Cifras (los números son automáticos)", "stat1.l", "Cifra 1 · miembros activos", "Parceros"],
    ["Cifras (los números son automáticos)", "stat2.l", "Cifra 2 · parches que ya pasaron", "Planes hechos"],
    ["Cifras (los números son automáticos)", "stat3.l", "Cifra 3 · % de miembros sin sanciones", "Respeto"],
    ["Cifras (los números son automáticos)", "stat4.l", "Cifra 4 · casos de acoso sancionados", "Tolerancia al acoso"],

    ["Próximos parches y Recuerdos", "planes.eyebrow", "Parches · texto pequeño", "Agenda"],
    ["Próximos parches y Recuerdos", "planes.title", "Parches · título", "Próximos parches"],
    ["Próximos parches y Recuerdos", "mem.eyebrow", "Recuerdos · texto pequeño", "Galería"],
    ["Próximos parches y Recuerdos", "mem.title", "Recuerdos · título", "Recuerdos del parche"],
    ["Próximos parches y Recuerdos", "mem.lead", "Recuerdos · descripción", "Fotos y videos de los planes que ya hicimos. ¿Fuiste? Sube los tuyos. 📸🎬", true],

    ["Reglas", "rules.eyebrow", "Bienvenida (texto pequeño)", "🔥💜 ¡Bienvenidos a ParchéMonos! 💜🔥"],
    ["Reglas", "rules.title", "Título", "Reglas del parche"],
    ["Reglas", "rules.lead", "Descripción", "🥳 Este es un espacio para conocer personas nuevas, hacer amistades, organizar salidas y disfrutar buenos parches. ¡La idea es conocer gente chévere y crear buenos momentos! 🫶✨", true],
    ["Reglas", "rules.age.n", "Bloque de edad · número grande", "18–36"],
    ["Reglas", "rules.age.t", "Bloque de edad · título", "Solo de 18 a 36 años"],
    ["Reglas", "rules.age.d", "Bloque de edad · texto", "El grupo, los planes y el chat son exclusivos para personas entre 18 y 36 años. Menores de 18 y mayores de 36 no pueden entrar. Si alguien no cumple la edad, sale del grupo.", true],
    ["Reglas", "rules.zero.n", "Bloque importante · número grande", "0"],
    ["Reglas", "rules.zero.t", "Bloque importante · título", "Cero contenido sexual y cero DM sin permiso"],
    ["Reglas", "rules.zero.d", "Bloque importante · texto", "⚠️ **Importante:** quien incumpla estas normas, especialmente las de contenido sexual o mensajes privados sin autorización, será expulsado del grupo.", true],
    ["Reglas", "rules.zero.k", "Bloque importante · aviso", "⛔ Expulsión sin excepción."],
    ["Reglas", "rule1.t", "Regla 01 · título", "✅ Preséntate"],
    ["Reglas", "rule1.d", "Regla 01 · texto", "Dinos tu nombre, edad y de dónde eres.", true],
    ["Reglas", "rule2.t", "Regla 02 · título", "🤝 Respeto ante todo"],
    ["Reglas", "rule2.d", "Regla 02 · texto", "Nada de insultos, acoso, indirectas ni faltas de respeto.", true],
    ["Reglas", "rule3.t", "Regla 03 · título", "🚫 Nada de contenido sexual"],
    ["Reglas", "rule3.d", "Regla 03 · texto", "No se permite hablar de sexo, enviar stickers pornográficos, imágenes ni contenido sexual.", true],
    ["Reglas", "rule4.t", "Regla 04 · título", "🔒 Respeta la privacidad"],
    ["Reglas", "rule4.d", "Regla 04 · texto", "Prohibido escribir al DM de cualquier integrante sin su autorización.", true],
    ["Reglas", "rule5.t", "Regla 05 · título", "❌ Nada de spam"],
    ["Reglas", "rule5.d", "Regla 05 · texto", "No publicidad, cadenas ni enlaces sin permiso de los administradores.", true],
    ["Reglas", "rule6.t", "Regla 06 · título", "💬 Buena convivencia"],
    ["Reglas", "rule6.d", "Regla 06 · texto", "Evitemos peleas y problemas innecesarios.", true],
    ["Reglas", "rule7.t", "Regla 07 · título", "🎉 ¡Propón tus parches!"],
    ["Reglas", "rule7.d", "Regla 07 · texto", "Puedes organizar salidas y compartir planes con el grupo.", true],
    ["Reglas", "rule8.t", "Regla 08 · título", "👑 Respeta a los administradores"],
    ["Reglas", "rule8.d", "Regla 08 · texto", "Sigue las indicaciones para mantener el orden.", true],
    ["Reglas", "rules.outro", "Cierre", "💜 ¡La idea es pasarla bueno, conocer gente y mantener un ambiente sano y agradable para todos! 🫶", true],

    ["Chat", "chat.eyebrow", "Texto pequeño", "Chat del grupo"],
    ["Chat", "chat.title", "Título", "Escríbele al grupo"],
    ["Chat", "chat.lead", "Descripción", "Propón un plan, pregunta quién se apunta o manda una nota de voz. Todo moderado para que el chat siga siendo un lugar seguro.", true],

    ["Footer", "footer.tag", "Frase del footer", "Planes · Amigos · Aventuras — Grupo de salidas"],
  ];

  // Imágenes que se pueden cambiar (los parches tienen la suya en la pestaña Parches)
  const IMAGE_SLOTS = [
    ["logo", "Logo (menú, bienvenida, chat e ícono de la pestaña)", "assets/logo.jpg"],
    ["hero", "Imagen grande de la portada", "assets/logo.jpg"],
    ["card-miradores", "Ícono tarjeta Miradores", "🌄"],
    ["card-caminatas", "Ícono tarjeta Caminatas", "🥾"],
    ["card-rumba", "Ícono tarjeta Rumba", "🪩"],
    ["card-comida", "Ícono tarjeta Comida y más", "🍔"],
  ];

  const CATS = [
    { name: "Mirador", icon: "🌄", tag: "aire" }, { name: "Caminata", icon: "🥾", tag: "aire" },
    { name: "Paseo", icon: "🏞️", tag: "aire" }, { name: "Deporte", icon: "⚽", tag: "aire" },
    { name: "Rumba", icon: "🪩", tag: "noche" }, { name: "Karaoke", icon: "🎤", tag: "noche" },
    { name: "Cultura", icon: "🎭", tag: "noche" }, { name: "Comida", icon: "🍔", tag: "comida" },
    { name: "Chill", icon: "🎲", tag: "comida" }, { name: "Otro", icon: "✨", tag: "otro" },
  ];

  // Parches oficiales: empieza vacío (los crean los admins en la pestaña Parches)
  const PLANS = [];

  // type: "choice" (respuesta concreta), "yesno" (Sí / No), "tf" (Verdadero / Falso)
  const QUIZ = [
    { type: "choice", q: "¿Qué edades pueden estar en el parche?", opts: ["De 16 a 30 años", "De 18 a 36 años", "Solo mayores de 21", "Cualquier edad"], a: "De 18 a 36 años" },
    { type: "choice", q: "Cuando entras al grupo, ¿qué debes hacer primero?", opts: ["Mandar stickers", "Presentarte: nombre, edad y de dónde eres", "Escribirle al DM a todos", "Quedarte callado"], a: "Presentarte: nombre, edad y de dónde eres" },
    { type: "choice", q: "¿Qué pasa si alguien envía contenido sexual o escribe al DM sin autorización?", opts: ["Le hacen una advertencia", "Lo silencian un día", "Es expulsado del grupo sin excepción", "No pasa nada"], a: "Es expulsado del grupo sin excepción" },
    { type: "choice", q: "¿Cuándo se puede publicar publicidad, cadenas o enlaces?", opts: ["Cuando quiera", "Solo los fines de semana", "Solo con permiso de los administradores", "Si son de un amigo"], a: "Solo con permiso de los administradores" },
    { type: "yesno", q: "¿Puedes escribirle al DM a una persona del grupo sin su autorización?", a: "No" },
    { type: "yesno", q: "¿Puedes proponer y organizar tus propios parches con el grupo?", a: "Sí" },
    { type: "yesno", q: "¿Se pueden mandar stickers pornográficos si es \"en chiste\"?", a: "No" },
    { type: "tf", q: "Las indirectas y las faltas de respeto están permitidas si no nombras a nadie.", a: "Falso" },
    { type: "tf", q: "Hay que seguir las indicaciones de los administradores para mantener el orden.", a: "Verdadero" },
    { type: "tf", q: "Una persona de 40 años puede entrar al parche.", a: "Falso" },
  ];

  const STICKERS = [
    { e: "🔥", t: "¡De una!" }, { e: "🙋", t: "Me apunto" }, { e: "🤙", t: "Qué chimba" },
    { e: "🥾", t: "Pa' la montaña" }, { e: "🪩", t: "¡Rumba!" }, { e: "🌄", t: "Atardecer" },
    { e: "💜", t: "Parche" }, { e: "😂", t: "Jajaja" }, { e: "🍕", t: "¿Y la comida?" },
    { e: "🫶", t: "Te cuido" }, { e: "⏰", t: "Voy tarde" }, { e: "🚫", t: "Cero acoso" },
  ];

  const BLOCKED_WORDS = ["mamacita", "mamasita", "mami rica", "que rica", "q rica", "estas rica", "estás rica", "bizcocho", "cuerpazo", "nudes", "nude", "pack", "pasame fotos", "pásame fotos", "manda fotos", "culo", "tetas", "senos", "follar", "cachar", "sexo", "sexy", "puta", "perra", "zorra", "gonorrea", "marica de mierda", "hijueputa"];

  /* Roles: permisos que da cada uno dentro del chat y la página.
     pin = fijar mensajes · poll = crear encuestas · media = fotos/videos/GIFs · plans = proponer parches
     fixed = no se puede borrar */
  const ROLES = [
    { id: "fundador", emoji: "👑", name: "Fundador", color: "#ffd23d", perms: { pin: true, poll: true, media: true, plans: true }, fixed: true },
    { id: "cofundador", emoji: "🌳", name: "Co Fundador", color: "#3dff8a", perms: { pin: true, poll: true, media: true, plans: true }, fixed: true },
    { id: "administrador", emoji: "🛡️", name: "Administrador", color: "#5ab0ff", perms: { pin: true, poll: true, media: true, plans: true } },
    { id: "moderador", emoji: "🔰", name: "Moderador", color: "#b14dff", perms: { pin: true, poll: true, media: true, plans: true } },
    { id: "staff", emoji: "👮🏼", name: "Staff", color: "#ff5a5a", perms: { pin: false, poll: true, media: true, plans: true } },
    { id: "org", emoji: "🎉", name: "Organizador", color: "#3dffd0", perms: { pin: false, poll: true, media: true, plans: true } },
    { id: "miembro", emoji: "💜", name: "Miembro", color: "#ff7ad9", perms: { pin: false, poll: true, media: true, plans: true }, fixed: true },
    { id: "prueba", emoji: "🧪", name: "En prueba", color: "#ff9f3d", perms: { pin: false, poll: false, media: false, plans: false }, fixed: true },
  ];

  // Miembros del parche: empieza vacío (entran cuando los admins aceptan solicitudes)
  const MEMBERS = [];
  // apodos de los personajes de ejemplo que había antes: nunca cuentan en las cifras
  const DEMO_NICKS = ["mono mod 🛡️", "vale 🌸", "la caminante", "juanchito", "santi"];

  const SETTINGS = {
    AGE_MIN: 18,
    AGE_MAX: 36,
    TRIAL_DAYS: 15,
    REPORT_ENDPOINT: "",
    GIPHY_API_KEY: "",
    BLOCKED_IPS: [],
    ALLOWED_COUNTRIES: [],
    BLOCK_DATACENTER: true,
    TURNSTILE_SITE_KEY: "",
  };

  window.PM_DEFAULTS = { TEXT_FIELDS, IMAGE_SLOTS, CATS, PLANS, QUIZ, STICKERS, BLOCKED_WORDS, SETTINGS, ROLES, MEMBERS, DEMO_NICKS };

  /* ---- Datos efectivos: navegador del admin (vista previa) > site-data.js (publicado) > por defecto ---- */
  const SD = window.SITE_DATA || {};
  const ls = (k) => { try { const v = localStorage.getItem(k); return v == null ? null : JSON.parse(v); } catch { return null; } };

  /* Reinicio a cero (una sola vez por navegador).
     Se conserva: roles, reglas (textos rules.* / ruleN.*), el test, cuentas/clave del panel, ajustes de seguridad y bloqueos por edad.
     Se borra: miembros, solicitudes, reportes, parches, recuerdos, chat, imágenes y demás textos. */
  const RESET_VERSION = "2026-11-22b";
  try {
    if (localStorage.getItem("pm_reset") !== RESET_VERSION) {
      const KEEP = ["pm_roles", "pm_quiz", "pm_settings", "pm_admin_accounts", "pm_admin_pin_hash", "pm_blocked", "pm_blocked_reason", "pm_blocked_ips"];
      const texts = ls("pm_texts");
      Object.keys(localStorage).filter((k) => k.startsWith("pm_") && !KEEP.includes(k)).forEach((k) => localStorage.removeItem(k));
      if (texts) {
        const rules = Object.fromEntries(Object.entries(texts).filter(([k]) => /^rules?\d*\./.test(k)));
        if (Object.keys(rules).length) localStorage.setItem("pm_texts", JSON.stringify(rules));
      }
      try { indexedDB.deleteDatabase("parchemonos"); } catch { /* */ }
      try { sessionStorage.removeItem("pm_admin_tab"); } catch { /* */ }
      localStorage.setItem("pm_reset", RESET_VERSION);
    }
  } catch { /* modo privado */ }

  // Migración: roles viejos (Admin / Moderador) → nuevos roles del staff
  const OLD_ROLE = { admin: "fundador", mod: "moderador" };
  const fixMembers = (list) => Array.isArray(list) ? list.map((m) => (OLD_ROLE[m.role] ? { ...m, role: OLD_ROLE[m.role] } : m)) : list;
  const fixRoles = (list) => Array.isArray(list) && list.some((r) => OLD_ROLE[r.id])
    ? [...ROLES, ...list.filter((r) => !OLD_ROLE[r.id] && !ROLES.some((d) => d.id === r.id))]
    : list;
  try {
    const lr = ls("pm_roles"), lm = ls("pm_members");
    if (lr) localStorage.setItem("pm_roles", JSON.stringify(fixRoles(lr)));
    if (lm) localStorage.setItem("pm_members", JSON.stringify(fixMembers(lm)));
  } catch { /* */ }
  if (SD.roles) SD.roles = fixRoles(SD.roles);
  if (SD.members) SD.members = fixMembers(SD.members);

  // Quita SIEMPRE a los personajes de ejemplo (Mono Mod, Vale, etc.) y sus parches, estén donde estén
  const isDemo = (n) => DEMO_NICKS.includes(String(n || "").trim().toLowerCase());
  const DEMO_PLAN_IDS = ["s1", "s2", "s3", "s4", "s5", "s6"];
  const cleanMembers = (l) => Array.isArray(l) ? l.filter((m) => !m.demo && !isDemo(m.nick)) : l;
  const cleanPlans = (l) => Array.isArray(l) ? l.filter((p) => !DEMO_PLAN_IDS.includes(p.id) && !isDemo(p.author)) : l;
  const cleanReqs = (l) => Array.isArray(l) ? l.filter((r) => !isDemo(r.nick)) : l;
  try {
    [["pm_members", cleanMembers], ["pm_seed_plans", cleanPlans], ["pm_plans", cleanPlans], ["pm_requests", cleanReqs]].forEach(([k, fn]) => {
      const v = ls(k);
      if (Array.isArray(v)) { const c = fn(v); if (c.length !== v.length) localStorage.setItem(k, JSON.stringify(c)); }
    });
  } catch { /* */ }
  if (SD.members) SD.members = cleanMembers(SD.members);
  if (SD.plans) SD.plans = cleanPlans(SD.plans);

  window.PM_DATA = {
    texts: { ...(SD.texts || {}), ...(ls("pm_texts") || {}) },
    imgs: { ...(SD.imgs || {}), ...(ls("pm_imgs") || {}) },
    plans: ls("pm_seed_plans") || SD.plans || PLANS,
    quiz: ls("pm_quiz") || SD.quiz || QUIZ,
    stickers: ls("pm_stickers") || SD.stickers || STICKERS,
    blocked: ls("pm_blocked_words") || SD.blocked || BLOCKED_WORDS,
    settings: { ...SETTINGS, ...(SD.settings || {}), ...(ls("pm_settings") || {}) },
    roles: ls("pm_roles") || SD.roles || ROLES,
    members: ls("pm_members") || SD.members || MEMBERS,
  };
})();
