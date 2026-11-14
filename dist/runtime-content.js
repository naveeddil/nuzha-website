// Loads the content saved in the secure admin portal (api/content.php) and applies it to every public page:
// Arabic fonts, contact numbers, social links, opening hours, the event message, an optional announcement bar,
// and whether internal menu review flags are shown. Pages keep their built-in content if the API is unavailable.
(() => {
  const allowedFonts = new Set(["Noto Kufi Arabic", "Tajawal", "Cairo", "Noto Naskh Arabic", "Alexandria"]);
  // Numbers built into the page markup and translations; replaced when the admin sets different ones.
  const defaults = {
    phone: {display: "013 373 1664", digits: "966133731664"},
    mobile: {display: "050 063 8543", digits: "966500638543"},
    whatsapp: {display: "053 003 5292", digits: "966530035292"},
    eventsPhone: {display: "+966 50 190 9933", digits: "966501909933"}
  };
  const socialIcons = {facebook: ["f", "Facebook"], google: ["G", "Google"], tiktok: ["♪", "TikTok"], instagram: ["◎", "Instagram"], snapchat: ["👻", "Snapchat"], x: ["𝕏", "X"]};
  let settings = null;

  const toDigits = value => {
    let d = String(value || "").replace(/\D/g, "");
    if (d.startsWith("00")) d = d.slice(2);
    if (d.startsWith("0")) d = "966" + d.slice(1);
    return d;
  };
  const isUrl = value => /^https:\/\/[^\s"'<>]+$/i.test(String(value || "").trim());
  const lang = () => (document.documentElement.lang === "ar" ? "ar" : "en");

  function numberChanges() {
    return Object.entries(defaults).map(([key, def]) => {
      const display = String(settings?.[key] || "").trim();
      const digits = toDigits(display);
      return display && digits.length >= 9 && digits !== def.digits ? {def, display, digits} : null;
    }).filter(Boolean);
  }

  function replaceText(root, changes) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (node.parentElement?.closest("script,style")) continue;
      let text = node.nodeValue;
      for (const c of changes) text = text.split(c.def.display).join(c.display);
      if (text !== node.nodeValue) node.nodeValue = text;
    }
    // Keep bilingual data attributes in step so language switching keeps the new numbers.
    document.querySelectorAll("[data-en],[data-ar]").forEach(el => {
      for (const attr of ["en", "ar"]) {
        let v = el.dataset[attr];
        if (!v) continue;
        for (const c of changes) v = v.split(c.def.display).join(c.display);
        el.dataset[attr] = v;
      }
    });
  }

  function applyNumbers() {
    const changes = numberChanges();
    if (!changes.length) return;
    document.querySelectorAll('a[href^="tel:"],a[href*="wa.me/"]').forEach(a => {
      const href = a.getAttribute("href");
      for (const c of changes) {
        if (href === `tel:+${c.def.digits}`) a.setAttribute("href", `tel:+${c.digits}`);
        if (href.includes(`wa.me/${c.def.digits}`)) a.setAttribute("href", href.replace(`wa.me/${c.def.digits}`, `wa.me/${c.digits}`));
      }
    });
    replaceText(document.body, changes);
  }

  function applySocials() {
    for (const key of Object.keys(socialIcons)) {
      const url = String(settings?.[key] || "").trim();
      if (!isUrl(url)) continue;
      document.querySelectorAll(`a[data-social="${key}"]`).forEach(a => { a.href = url; });
    }
    // Add links for networks the page markup does not include yet (e.g. Instagram, Snapchat, X).
    document.querySelectorAll(".social-links").forEach(group => {
      const compact = group.classList.contains("footer-socials");
      for (const [key, [icon, name]] of Object.entries(socialIcons)) {
        const url = String(settings?.[key] || "").trim();
        if (!isUrl(url) || group.querySelector(`[data-social="${key}"]`)) continue;
        const a = document.createElement("a");
        a.dataset.social = key; a.href = url; a.target = "_blank"; a.rel = "noreferrer"; a.setAttribute("aria-label", name);
        a.innerHTML = compact ? `<b>${icon}</b>` : `<b>${icon}</b><span>${name}</span>`;
        group.appendChild(a);
      }
    });
  }

  function applyLanguageText() {
    const l = lang();
    const hours = String(settings?.[l === "ar" ? "hoursAr" : "hoursEn"] || "").trim();
    if (hours) document.querySelectorAll('[data-t="hours"],[data-setting-text="hours"]').forEach(el => { el.textContent = hours; });
    const note = String(settings?.[l === "ar" ? "eventNoteAr" : "eventNoteEn"] || "").trim();
    if (note) {
      document.querySelectorAll('[data-t="menuNote"]').forEach(el => { el.textContent = note; });
      document.querySelectorAll(".menu-order-strip>strong").forEach(el => {
        el.dataset.en = settings.eventNoteEn || el.dataset.en;
        el.dataset.ar = settings.eventNoteAr || el.dataset.ar;
        el.textContent = note;
      });
    }
    const bar = document.querySelector(".announcement-bar span");
    if (bar) bar.textContent = (l === "ar" ? settings.announcementAr : settings.announcementEn) || settings.announcementEn || settings.announcementAr || "";
  }

  function applyAnnouncement() {
    const text = settings?.announcementEn || settings?.announcementAr;
    if (!settings?.announcementEnabled || !text) return;
    const id = `${settings.announcementEn || ""}|${settings.announcementAr || ""}`;
    try { if (sessionStorage.getItem("nuzha-announcement-closed") === id) return; } catch {}
    if (document.querySelector(".announcement-bar")) return;
    const bar = document.createElement(isUrl(settings.announcementLink) ? "a" : "div");
    bar.className = "announcement-bar";
    if (bar.tagName === "A") { bar.href = settings.announcementLink.trim(); bar.target = "_blank"; bar.rel = "noreferrer"; }
    bar.innerHTML = `<span></span><button type="button" aria-label="Close announcement">×</button>`;
    bar.querySelector("button").addEventListener("click", e => {
      e.preventDefault(); e.stopPropagation(); bar.remove();
      try { sessionStorage.setItem("nuzha-announcement-closed", id); } catch {}
    });
    document.body.appendChild(bar);
    if (!document.querySelector("#announcement-style")) {
      const style = document.createElement("style");
      style.id = "announcement-style";
      style.textContent = ".announcement-bar{position:fixed;top:84px;left:0;right:0;z-index:19;display:flex;align-items:center;justify-content:center;gap:14px;padding:9px 48px;background:var(--accent,#e8572a);color:#fff;font-weight:700;font-size:14px;text-align:center;text-decoration:none;box-shadow:0 6px 18px rgba(0,0,0,.12)}.announcement-bar button{position:absolute;inset-inline-end:14px;border:0;background:transparent;color:inherit;font-size:22px;line-height:1;cursor:pointer}@media(max-width:640px){.announcement-bar{top:72px;font-size:13px;padding:8px 40px}}";
      document.head.appendChild(style);
    }
  }

  function applyAll() {
    if (!settings) return;
    document.body.classList.toggle("hide-menu-flags", settings.showMenuFlags === false);
    applyNumbers();
    applySocials();
    applyAnnouncement();
    applyLanguageText();
  }

  // Phone numbers such as "+966 50 190 9933" are reordered by the browser inside Arabic (right-to-left) text.
  // Wrap each one in invisible left-to-right isolate marks (U+2066 … U+2069) so it always reads correctly.
  const LRI = "⁦", PDI = "⁩";
  const phonePattern = /\+?\d[\d  -]{6,}\d/g;
  function isolatePhones() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (!/\d{3}/.test(node.nodeValue) || node.parentElement?.closest("script,style,textarea,input")) continue;
      const text = node.nodeValue.split(LRI).join("").split(PDI).join("").replace(phonePattern, m => LRI + m + PDI);
      if (text !== node.nodeValue) node.nodeValue = text;
    }
  }
  let isolateQueued = false;
  const queueIsolate = () => {
    if (isolateQueued) return;
    isolateQueued = true;
    requestAnimationFrame(() => { isolateQueued = false; isolatePhones(); });
  };
  isolatePhones();
  new MutationObserver(queueIsolate).observe(document.body, {childList: true, subtree: true, characterData: true});

  // Page scripts rewrite translated text when the language changes; re-apply custom values afterwards.
  new MutationObserver(() => setTimeout(applyAll, 0)).observe(document.documentElement, {attributes: true, attributeFilter: ["lang"]});

  fetch("api/content.php", {credentials: "same-origin"})
    .then(r => (r.ok ? r.json() : null))
    .then(result => {
      const content = result?.content;
      if (!content) return;
      settings = content.settings || {};
      const heading = allowedFonts.has(settings.arabicHeadingFont) ? settings.arabicHeadingFont : "Noto Kufi Arabic";
      const body = allowedFonts.has(settings.arabicBodyFont) ? settings.arabicBodyFont : "Tajawal";
      document.documentElement.style.setProperty("--arabic-heading", `"${heading}",sans-serif`);
      document.documentElement.style.setProperty("--arabic-body", `"${body}",sans-serif`);
      // Image files that were renamed or removed after content was saved in the admin portal.
      const renamed = {"assets/hero-clean.png": "assets/hero-clean.jpg", "assets/feast-clean.png": "assets/feast-clean.jpg", "assets/rice-clean.png": "assets/rice-clean.jpg", "gallery-images/feasts--whole-lamb-platter.png": "gallery-images/feasts--whole-lamb-platter.jpg", "gallery-images/kitchen--moussaka.png": "gallery-images/kitchen--moussaka.jpg", "gallery-images/salads--fattoush.png": "gallery-images/salads--fattoush.jpg", "gallery-images/salads--tabbouleh.png": "gallery-images/salads--tabbouleh.jpg"};
      const removed = new Set(["gallery-images/dishes--special-plate.png"]);
      if (Array.isArray(content.gallery)) content.gallery = content.gallery.filter(x => !removed.has(x?.src)).map(x => ({...x, src: renamed[x.src] || x.src}));
      if (Array.isArray(content.menu)) content.menu = content.menu.map(x => ({...x, image: removed.has(x?.image) ? "assets/logo.png" : (renamed[x?.image] || x?.image)}));
      window.NUZHA_SERVER_CONTENT = content;
      window.dispatchEvent(new CustomEvent("nuzha:content", {detail: content}));
      applyAll();
    })
    .catch(() => {});
})();
