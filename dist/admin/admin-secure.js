// Nuzha secure content portal (served from /admin/, backed by api/admin.php).
// Content is saved to the server database and read by every public page through api/content.php.
const API = "../api/admin.php";
const fontChoices = {
  "Noto Kufi Arabic": "Noto Kufi Arabic — modern geometric",
  "Tajawal": "Tajawal — clean contemporary",
  "Cairo": "Cairo — strong and readable",
  "Noto Naskh Arabic": "Noto Naskh Arabic — traditional",
  "Alexandria": "Alexandria — compact modern"
};
const menuCategories = {bbq: "Barbecue grills · المشويات", breakfast: "Breakfast · الفطور", rice: "Rice items · الكبسات والأرز", fried: "Fried & fish · البروستد والأسماك", appetizers: "Appetizers · المقبلات", curries: "Curries · الإيدامات"};
const galleryCategories = {feasts: "Feasts", dishes: "Dishes", kitchen: "Kitchen", salads: "Salads & mezze", bbq: "Barbecue", hospitality: "Hospitality"};
const socialFields = {facebook: "Facebook page", instagram: "Instagram", tiktok: "TikTok", snapchat: "Snapchat", x: "X (Twitter)", google: "Google Business profile"};
const defaultSettings = {
  englishName: "Nuzha Restaurant", arabicName: "مطعم ومطبخ النزهة",
  phone: "013 373 1664", mobile: "050 063 8543", whatsapp: "053 003 5292", eventsPhone: "+966 50 190 9933",
  hoursEn: "", hoursAr: "", eventNoteEn: "", eventNoteAr: "",
  announcementEnabled: false, announcementEn: "", announcementAr: "", announcementLink: "",
  facebook: "https://www.facebook.com/354392161334869", instagram: "", tiktok: "", snapchat: "", x: "", google: "",
  addressEn: "Prince Sultan bin Abdulaziz, Al Faisaliyah, King Fahd Road, Al Nairyah 37481, Saudi Arabia",
  addressAr: "الأمير سلطان بن عبدالعزيز، الفيصلية، شارع الملك فهد، النعيرية 37481",
  arabicHeadingFont: "Noto Kufi Arabic", arabicBodyFont: "Tajawal",
  showMenuFlags: true, menuSections: {}
};
const seed = () => ({
  menu: structuredClone(window.NUZHA_MENU || []),
  gallery: structuredClone([...(window.NUZHA_GALLERY || []), ...(window.NUZHA_SYNCED_GALLERY || [])]),
  reviews: [],
  settings: structuredClone(defaultSettings)
});

let data = seed(), csrf = "", view = "dashboard", needsSetup = false, dirty = false, updatedAt = null;
let photoMap = {}, menuSearch = "", menuFilter = "all";
const $ = s => document.querySelector(s);
const esc = (v = "") => String(v ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
const isCdrMenu = menu => Array.isArray(menu) && menu.some(x => ["breakfast", "fried", "appetizers", "curries"].includes(x?.category));
const toDigits = v => { let d = String(v || "").replace(/\D/g, ""); if (d.startsWith("00")) d = d.slice(2); if (d.startsWith("0")) d = "966" + d.slice(1); return d; };

async function request(url, options = {}) {
  const headers = {...(options.headers || {})};
  if (csrf) headers["X-CSRF-Token"] = csrf;
  if (options.body && !headers["Content-Type"] && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  const response = await fetch(url, {credentials: "same-origin", ...options, headers});
  const result = await response.json().catch(() => ({ok: false, error: "Unexpected server response."}));
  if (!response.ok || !result.ok) throw new Error(result.error || "Request failed.");
  return result;
}

// ---------- Authentication ----------
async function start() {
  try {
    const session = await request(`${API}?action=session`);
    needsSetup = session.needsSetup; csrf = session.csrf || "";
    if (session.authenticated) return openPortal();
    showAuth();
  } catch (e) { showAuth(e.message); }
}
function showAuth(message = "") {
  authScreen.hidden = false; portal.hidden = true; setupTokenLabel.hidden = !needsSetup;
  authTitle.textContent = needsSetup ? "Create the first administrator" : "Administrator sign in";
  authIntro.textContent = needsSetup ? "Enter the private setup token from config.php, then create a strong account." : "Use your authorized administrator account.";
  authSubmit.textContent = needsSetup ? "Create secure account" : "Sign in";
  authError.textContent = message;
}
authForm.onsubmit = async e => {
  e.preventDefault(); authError.textContent = ""; authSubmit.disabled = true;
  try {
    const payload = {email: email.value, password: password.value};
    if (needsSetup) payload.setupToken = setupToken.value;
    const result = await request(`${API}?action=${needsSetup ? "setup" : "login"}`, {method: "POST", body: JSON.stringify(payload)});
    csrf = result.csrf; await openPortal();
  } catch (err) { authError.textContent = err.message; } finally { authSubmit.disabled = false; }
};

async function openPortal() {
  const [result, photos] = await Promise.all([
    request(`${API}?action=content`),
    fetch("../menu-restaurant-images.json").then(r => (r.ok ? r.json() : {})).catch(() => ({}))
  ]);
  photoMap = photos; csrf = result.csrf || csrf; updatedAt = result.updatedAt || null;
  const base = seed();
  data = result.content ? {...base, ...result.content, settings: {...base.settings, ...(result.content.settings || {})}} : base;
  if (!isCdrMenu(data.menu)) data.menu = base.menu; // replace the old 10-item sample menu
  const s = data.settings;
  if (s.phone === "053 003 5292" && (!s.whatsapp || toDigits(s.whatsapp) === "966530035292")) { s.phone = defaultSettings.phone; s.whatsapp = defaultSettings.whatsapp; }
  s.menuSections = s.menuSections || {};
  authScreen.hidden = true; portal.hidden = false; setDirty(false); render();
}

// ---------- Rendering ----------
function heading(eyebrow, title) { viewEyebrow.textContent = eyebrow; viewTitle.textContent = title; }
function render() {
  document.querySelectorAll("#adminNav button").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  ({dashboard: renderDashboard, menu: renderMenu, gallery: renderGallery, reviews: renderReviews, settings: renderSettings, backup: renderBackup}[view] || renderDashboard)();
}
const photoFor = x => (!x.customImage && photoMap[`${x.category}|${x.nameEn}`]) || x.image || "assets/logo.png";
const options = (map, selected) => {
  const entries = Object.entries(map);
  if (selected && !map[selected]) entries.push([selected, selected]);
  return entries.map(([v, label]) => `<option value="${esc(v)}" ${v === selected ? "selected" : ""}>${esc(label)}</option>`).join("");
};
const field = (label, input, cls = "") => `<label class="field ${cls}"><span>${label}</span>${input}</label>`;
const check = (label, attrs, checked, hint = "") => `<label class="check"><input type="checkbox" ${attrs} ${checked ? "checked" : ""}><span>${label}${hint ? `<small>${hint}</small>` : ""}</span></label>`;

function renderDashboard() {
  heading("ADMIN OVERVIEW", "Welcome.");
  const m = data.menu;
  const stats = [
    ["Menu items", m.length], ["Shown on menu", m.filter(x => !x.hidden).length], ["On homepage", m.filter(x => x.featured && !x.hidden).length],
    ["Need confirmation", m.filter(x => x.needsReview).length], ["Price by weight / missing", m.filter(x => x.price === "—" || !String(x.price).trim()).length],
    ["Gallery photos", data.gallery.length], ["Guest reviews", data.reviews.length], ["Last saved", updatedAt ? new Date(updatedAt.replace(" ", "T")).toLocaleString() : "Not yet"]
  ];
  adminWorkspace.innerHTML = `<div class="stat-grid">${stats.map(([k, v]) => `<article class="stat-card"><span>${k}</span><strong ${String(v).length > 6 ? 'class="small"' : ""}>${esc(v)}</strong></article>`).join("")}</div>
  <section class="panel"><h2>Quick actions</h2><div class="quick-actions">
    <button data-go="menu">Edit dishes & prices</button><button data-go="gallery">Upload photos</button>
    <button data-go="settings">Contact numbers, hours & announcement</button><button data-go="backup">Download a backup</button>
    <a href="../menu.html" target="_blank">Open public menu ↗</a></div>
  <p>Changes are stored on the server and appear for all visitors after you press <b>Save changes</b>. Uploaded photos are resized in your browser before upload so pages stay fast.</p></section>`;
}

function renderMenu() {
  heading("MENU MANAGER", "Dishes and prices.");
  const q = menuSearch.trim().toLowerCase();
  const rows = data.menu.map((x, i) => ({x, i})).filter(({x}) => (menuFilter === "all" || x.category === menuFilter) && (!q || `${x.nameEn} ${x.nameAr}`.toLowerCase().includes(q)));
  adminWorkspace.innerHTML = `<section class="panel"><div class="toolbar wrap">
      <input id="menuSearch" type="search" placeholder="Search dishes…" value="${esc(menuSearch)}">
      <select id="menuFilter"><option value="all">All categories (${data.menu.length})</option>${Object.entries(menuCategories).map(([k, v]) => `<option value="${k}" ${k === menuFilter ? "selected" : ""}>${esc(v)} (${data.menu.filter(x => x.category === k).length})</option>`).join("")}</select>
      <button id="addMenu" class="primary">+ Add dish</button></div>
    <p class="hint">Price: numbers only (SAR). Use “—” for “by weight / ask us”. Tick <b>Show on homepage</b> for up to 8 dishes to feature on the home page.</p>
    <div class="editor-list">${rows.length ? rows.map(({x, i}) => menuCard(x, i)).join("") : "<p>No dishes match.</p>"}</div></section>`;
  menuSearchEl().oninput = e => { menuSearch = e.target.value; const pos = e.target.selectionStart; renderMenu(); const el = menuSearchEl(); el.focus(); el.setSelectionRange(pos, pos); };
  $("#menuFilter").onchange = e => { menuFilter = e.target.value; renderMenu(); };
  $("#addMenu").onclick = () => {
    data.menu.unshift({category: menuFilter === "all" ? "bbq" : menuFilter, nameEn: "New dish", nameAr: "صنف جديد", descEn: "", descAr: "", price: "", image: "assets/logo.png", customImage: false, missingImage: true});
    menuSearch = ""; setDirty(); renderMenu();
  };
}
const menuSearchEl = () => $("#menuSearch");
function menuCard(x, i) {
  const d = `data-type="menu" data-i="${i}"`;
  return `<article class="editor-card menu-editor ${x.hidden ? "is-hidden" : ""}">
    <div class="photo-col"><img src="../${esc(photoFor(x))}" alt="">
      <label class="mini-button">Change photo<input type="file" accept="image/jpeg,image/png,image/webp" data-upload-menu="${i}"></label>
      ${x.customImage ? `<button class="mini-button" data-auto-photo="${i}">Use menu photo</button>` : ""}</div>
    <div class="editor-fields">
      ${field("Name (English)", `<input ${d} data-key="nameEn" value="${esc(x.nameEn)}">`)}
      ${field("الاسم (عربي)", `<input dir="rtl" ${d} data-key="nameAr" value="${esc(x.nameAr)}">`)}
      ${field("Description (English)", `<textarea ${d} data-key="descEn">${esc(x.descEn)}</textarea>`)}
      ${field("الوصف (عربي)", `<textarea dir="rtl" ${d} data-key="descAr">${esc(x.descAr)}</textarea>`)}
      ${field("Category", `<select ${d} data-key="category">${options(menuCategories, x.category)}</select>`)}
      ${field("Price (SAR)", `<input ${d} data-key="price" value="${esc(x.price)}" inputmode="decimal">`)}
      <div class="checks wide">
        ${check("Show on homepage", `${d} data-key="featured"`, x.featured)}
        ${check("Hide from menu", `${d} data-key="hidden"`, x.hidden, "e.g. sold out or seasonal")}
        ${check("Needs confirmation", `${d} data-key="needsReview"`, x.needsReview, "shows a gold flag publicly")}
      </div>
      ${x.needsReview ? `${field("Confirmation note (English)", `<input ${d} data-key="reviewEn" value="${esc(x.reviewEn)}">`)}${field("ملاحظة التأكيد (عربي)", `<input dir="rtl" ${d} data-key="reviewAr" value="${esc(x.reviewAr)}">`)}` : ""}
    </div>
    <div class="card-actions"><button title="Move up" data-move="menu" data-i="${i}" data-dir="-1">↑</button><button title="Move down" data-move="menu" data-i="${i}" data-dir="1">↓</button><button class="remove-btn" title="Delete dish" data-remove="menu" data-i="${i}">×</button></div>
  </article>`;
}

function renderGallery() {
  heading("GALLERY MANAGER", "Upload and describe images.");
  adminWorkspace.innerHTML = `<section class="panel"><div class="toolbar"><label class="file-button primary">+ Upload photos<input id="galleryUpload" type="file" accept="image/jpeg,image/png,image/webp" multiple></label><span class="hint">Large photos are resized to 1600 px before upload.</span></div>
    <div class="editor-list">${data.gallery.map((x, i) => {
      const d = `data-type="gallery" data-i="${i}"`;
      return `<article class="editor-card"><div class="photo-col"><img src="../${esc(x.src)}" alt=""></div><div class="editor-fields">
        ${field("Title (English)", `<input ${d} data-key="titleEn" value="${esc(x.titleEn)}">`)}
        ${field("العنوان (عربي)", `<input dir="rtl" ${d} data-key="titleAr" value="${esc(x.titleAr)}">`)}
        ${field("Category", `<select ${d} data-key="category">${options(galleryCategories, x.category)}</select>`)}
        ${field("Image file", `<input ${d} data-key="src" value="${esc(x.src)}">`)}
      </div><div class="card-actions"><button data-move="gallery" data-i="${i}" data-dir="-1">↑</button><button data-move="gallery" data-i="${i}" data-dir="1">↓</button><button class="remove-btn" data-remove="gallery" data-i="${i}">×</button></div></article>`;
    }).join("")}</div></section>`;
  $("#galleryUpload").onchange = async e => {
    const files = [...e.target.files];
    for (const file of files) {
      try {
        const path = await uploadFile(file);
        data.gallery.unshift({src: path, category: "dishes", titleEn: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "), titleAr: "صورة جديدة"});
      } catch (err) { toast(`${file.name}: ${err.message}`, true); }
    }
    setDirty(); renderGallery(); toast("Photos uploaded — press Save changes to publish them");
  };
}

function renderReviews() {
  heading("REVIEW MANAGER", "Verified customer feedback.");
  adminWorkspace.innerHTML = `<section class="panel"><div class="toolbar"><button id="addReview" class="primary">+ Add review</button></div>
    <p class="hint">Only add genuine reviews from real customers (for example copied from Google), with their permission.</p>
    <div class="editor-list">${data.reviews.map((x, i) => {
      const d = `data-type="reviews" data-i="${i}"`;
      return `<article class="editor-card no-photo"><div class="editor-fields">
        ${field("Review (English)", `<textarea ${d} data-key="en">${esc(x.en)}</textarea>`)}
        ${field("المراجعة (عربي)", `<textarea dir="rtl" ${d} data-key="ar">${esc(x.ar)}</textarea>`)}
        ${field("Customer name", `<input ${d} data-key="name" value="${esc(x.name)}">`)}
        ${field("Rating (1–5)", `<input type="number" min="1" max="5" ${d} data-key="rating" value="${esc(x.rating)}">`)}
      </div><div class="card-actions"><button class="remove-btn" data-remove="reviews" data-i="${i}">×</button></div></article>`;
    }).join("")}</div></section>`;
  $("#addReview").onclick = () => { data.reviews.unshift({en: "", ar: "", name: "", rating: 5}); setDirty(); renderReviews(); };
}

function fontOptions(selected) { return Object.entries(fontChoices).map(([v, label]) => `<option value="${v}" ${selected === v ? "selected" : ""}>${label}</option>`).join(""); }
function renderSettings() {
  heading("SITE SETTINGS", "Contact, hours, links and display.");
  const s = data.settings;
  const set = (key, extra = "") => `data-setting="${key}" ${extra}`;
  const text = (label, key, extra = "", cls = "") => field(label, `<input ${set(key, extra)} value="${esc(s[key])}">`, cls);
  const phoneHint = key => { const d = toDigits(s[key]); return d.length >= 9 ? `<small class="preview" data-preview="${key}">Calls/WhatsApp go to +${d}</small>` : `<small class="preview" data-preview="${key}"></small>`; };
  adminWorkspace.innerHTML = `
  <section class="panel"><h2>Contact numbers</h2><p class="hint">Updates every call and WhatsApp button on the website.</p><div class="settings-grid">
    <div>${text("Main telephone", "phone")}${phoneHint("phone")}</div>
    <div>${text("Mobile", "mobile")}${phoneHint("mobile")}</div>
    <div>${text("WhatsApp (main)", "whatsapp")}${phoneHint("whatsapp")}</div>
    <div>${text("Events, weddings & large orders (call/WhatsApp)", "eventsPhone")}${phoneHint("eventsPhone")}</div>
  </div></section>
  <section class="panel"><h2>Opening hours & event message</h2><p class="hint">Leave empty to keep the website's built-in text.</p><div class="settings-grid">
    ${text("Opening hours (English)", "hoursEn", 'placeholder="6 AM — 12 AM"')}
    ${text("ساعات العمل (عربي)", "hoursAr", 'dir="rtl" placeholder="٦ صباحاً — ١٢ ليلاً"')}
    ${field("Event message (English)", `<textarea ${set("eventNoteEn", 'placeholder="Planning a large order, gathering, celebration, wedding, or event? Call us directly or visit us to discuss your requirements."')}>${esc(s.eventNoteEn)}</textarea>`, "wide")}
    ${field("رسالة المناسبات (عربي)", `<textarea dir="rtl" ${set("eventNoteAr", 'placeholder="تخطط لطلب كبير أو تجمع أو احتفال أو زفاف أو مناسبة؟ اتصل بنا مباشرة أو تفضل بزيارتنا لمناقشة متطلباتك."')}>${esc(s.eventNoteAr)}</textarea>`, "wide")}
  </div></section>
  <section class="panel"><h2>Announcement bar</h2><p class="hint">A banner under the top navigation on every page — for offers, Ramadan hours or holiday closures. Visitors can close it.</p><div class="settings-grid">
    <div class="wide">${check("Show the announcement bar", set("announcementEnabled"), s.announcementEnabled)}</div>
    ${text("Announcement (English)", "announcementEn", 'placeholder="Ramadan hours: 8 PM – 3 AM"')}
    ${text("الإعلان (عربي)", "announcementAr", 'dir="rtl" placeholder="أوقات رمضان: ٨ مساءً – ٣ فجراً"')}
    ${text("Optional link (https://…)", "announcementLink", 'placeholder="https://wa.me/966530035292"', "wide")}
  </div></section>
  <section class="panel"><h2>Social & profile links</h2><p class="hint">Full addresses starting with https://. Empty links are not shown.</p><div class="settings-grid">
    ${Object.entries(socialFields).map(([k, label]) => text(label, k, 'type="url" placeholder="https://…"', "wide")).join("")}
  </div></section>
  <section class="panel"><h2>Menu display</h2><div class="settings-grid">
    <div class="wide">${check("Show internal flags on the public menu", set("showMenuFlags"), s.showMenuFlags !== false, "“Needs confirmation”, “Price needed” and “Temporary image” labels. Untick before the official launch.")}</div>
    ${Object.entries(menuCategories).map(([k, label]) => { const sec = s.menuSections[k] || {}; return `<div class="section-editor wide"><h3>${esc(label)}</h3><div class="settings-grid">
      ${field("Tagline (English)", `<input data-section="${k}" data-key="taglineEn" value="${esc(sec.taglineEn)}" placeholder="Default tagline">`)}
      ${field("الوصف المختصر (عربي)", `<input dir="rtl" data-section="${k}" data-key="taglineAr" value="${esc(sec.taglineAr)}" placeholder="الوصف الافتراضي">`)}
      ${field("Header photo (optional)", `<input data-section="${k}" data-key="image" value="${esc(sec.image)}" placeholder="Default photo">`)}
      <label class="mini-button">Upload header photo<input type="file" accept="image/jpeg,image/png,image/webp" data-upload-section="${k}"></label>
    </div></div>`; }).join("")}
  </div></section>
  <section class="panel"><h2>Identity & Arabic fonts</h2><div class="settings-grid">
    ${text("English name", "englishName")}${text("الاسم العربي", "arabicName", 'dir="rtl"')}
    ${field("Arabic heading font", `<select ${set("arabicHeadingFont")}>${fontOptions(s.arabicHeadingFont)}</select>`)}
    ${field("Arabic body font", `<select ${set("arabicBodyFont")}>${fontOptions(s.arabicBodyFont)}</select>`)}
    <div class="font-preview wide" id="fontPreview" dir="rtl"><strong>اجتمعوا حول المائدة واستمتعوا بالكرم.</strong><span>نكهات أصيلة مطهوة على مهل وولائم سخية نصنعها لمن تحبون.</span></div>
    ${field("Address (English, for records)", `<textarea ${set("addressEn")}>${esc(s.addressEn)}</textarea>`, "wide")}
    ${field("العنوان (عربي، للسجلات)", `<textarea dir="rtl" ${set("addressAr")}>${esc(s.addressAr)}</textarea>`, "wide")}
  </div></section>`;
  updateFontPreview();
}
function updateFontPreview() {
  const p = $("#fontPreview"); if (!p) return;
  p.querySelector("strong").style.fontFamily = `"${data.settings.arabicHeadingFont}",sans-serif`;
  p.querySelector("span").style.fontFamily = `"${data.settings.arabicBodyFont}",sans-serif`;
}

function renderBackup() {
  heading("BACKUP", "Download or restore content.");
  adminWorkspace.innerHTML = `<section class="panel"><h2>Download a backup</h2><p>Saves the menu, gallery, reviews and settings currently loaded in this portal (including unsaved edits) as a JSON file.</p><div class="toolbar"><button id="exportJson" class="primary">Download backup (.json)</button></div></section>
  <section class="panel"><h2>Restore from a backup</h2><p>Loads a backup file into the portal. Nothing is published until you press <b>Save changes</b>.</p><div class="toolbar"><label class="file-button">Choose backup file<input id="importJson" type="file" accept="application/json,.json"></label></div></section>`;
  $("#exportJson").onclick = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
    const a = Object.assign(document.createElement("a"), {href: URL.createObjectURL(blob), download: `nuzha-content-${new Date().toISOString().slice(0, 10)}.json`});
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $("#importJson").onchange = async e => {
    try {
      const parsed = JSON.parse(await e.target.files[0].text());
      if (!["menu", "gallery", "reviews", "settings"].every(k => k in parsed) || !Array.isArray(parsed.menu)) throw new Error("This file is not a Nuzha content backup.");
      const base = seed();
      data = {...base, ...parsed, settings: {...base.settings, ...parsed.settings}};
      setDirty(); toast("Backup loaded — review it, then press Save changes"); view = "dashboard"; render();
    } catch (err) { toast(err.message, true); }
  };
}

// ---------- Images ----------
// Resizes photos in the browser (max 1600 px) so uploads stay small; PNG/WebP keep transparency as WebP.
async function prepareImage(file, max = 1600) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Use a JPG, PNG or WebP image.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  const canvas = Object.assign(document.createElement("canvas"), {width: w, height: h});
  canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
  const type = file.type === "image/jpeg" ? "image/jpeg" : "image/webp";
  const blob = await new Promise(res => canvas.toBlob(res, type, 0.82));
  if (!blob || (scale === 1 && blob.size >= file.size)) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + (type === "image/jpeg" ? ".jpg" : ".webp"), {type});
}
async function uploadFile(file) {
  const form = new FormData();
  form.append("image", await prepareImage(file));
  const r = await request(`${API}?action=upload`, {method: "POST", body: form});
  return r.path;
}

// ---------- Editing ----------
function setDirty(value = true) {
  dirty = value;
  saveAll.textContent = dirty ? "Save changes ●" : "Saved";
  saveAll.classList.toggle("is-dirty", dirty);
}
window.addEventListener("beforeunload", e => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

adminNav.onclick = e => { const b = e.target.closest("button[data-view]"); if (b) { view = b.dataset.view; render(); } };
adminWorkspace.addEventListener("click", e => {
  const go = e.target.closest("[data-go]");
  if (go) { view = go.dataset.go; render(); return; }
  const rm = e.target.closest("[data-remove]");
  if (rm) {
    const list = data[rm.dataset.remove], item = list[+rm.dataset.i];
    const name = item?.nameEn || item?.titleEn || item?.name || "this item";
    if (confirm(`Delete “${name}”? It is removed from the website when you save.`)) { list.splice(+rm.dataset.i, 1); setDirty(); render(); }
    return;
  }
  const mv = e.target.closest("[data-move]");
  if (mv) {
    const list = data[mv.dataset.move], i = +mv.dataset.i, j = i + +mv.dataset.dir;
    if (j >= 0 && j < list.length) { [list[i], list[j]] = [list[j], list[i]]; setDirty(); render(); }
    return;
  }
  const auto = e.target.closest("[data-auto-photo]");
  if (auto) { const x = data.menu[+auto.dataset.autoPhoto]; x.customImage = false; setDirty(); render(); }
});
adminWorkspace.addEventListener("input", e => {
  const el = e.target;
  if (el.type === "file" || el.id === "menuSearch") return;
  const value = el.type === "checkbox" ? el.checked : el.value;
  if (el.dataset.setting) {
    data.settings[el.dataset.setting] = value;
    updateFontPreview();
    const preview = document.querySelector(`[data-preview="${el.dataset.setting}"]`);
    if (preview) { const d = toDigits(value); preview.textContent = d.length >= 9 ? `Calls/WhatsApp go to +${d}` : ""; }
  } else if (el.dataset.section) {
    const sec = data.settings.menuSections[el.dataset.section] ||= {};
    sec[el.dataset.key] = value;
  } else if (el.dataset.type) {
    const item = data[el.dataset.type][+el.dataset.i];
    item[el.dataset.key] = el.dataset.key === "rating" ? +value : value;
    if (el.dataset.key === "price") item.priceMissing = String(value).trim() === "—" || !String(value).trim();
    if (el.dataset.key === "needsReview" && el.type === "checkbox") { render(); }
  } else return;
  setDirty();
});
adminWorkspace.addEventListener("change", async e => {
  const el = e.target;
  if (el.dataset.uploadMenu !== undefined && el.files[0]) {
    try {
      const x = data.menu[+el.dataset.uploadMenu];
      x.image = await uploadFile(el.files[0]); x.customImage = true; x.missingImage = false;
      setDirty(); render(); toast("Photo uploaded — press Save changes to publish it");
    } catch (err) { toast(err.message, true); }
  }
  if (el.dataset.uploadSection && el.files[0]) {
    try {
      const sec = data.settings.menuSections[el.dataset.uploadSection] ||= {};
      sec.image = await uploadFile(el.files[0]);
      setDirty(); render(); toast("Header photo uploaded — press Save changes to publish it");
    } catch (err) { toast(err.message, true); }
  }
});

function validate() {
  const problems = [];
  const s = data.settings;
  for (const k of [...Object.keys(socialFields), "announcementLink"]) if (s[k] && !/^https:\/\/\S+$/i.test(String(s[k]).trim())) problems.push(`${socialFields[k] || "Announcement link"} must start with https://`);
  for (const k of ["phone", "mobile", "whatsapp", "eventsPhone"]) if (s[k] && toDigits(s[k]).length < 9) problems.push(`Check the ${k === "eventsPhone" ? "events" : k} number`);
  data.menu.forEach(x => { const p = String(x.price ?? "").trim(); if (p && p !== "—" && !/^\d+(\.\d{1,2})?$/.test(p)) problems.push(`Price for “${x.nameEn}” should be a number or —`); });
  if (data.menu.filter(x => x.featured && !x.hidden).length > 8) problems.push("Choose at most 8 dishes for the homepage");
  return problems;
}
saveAll.onclick = async () => {
  const problems = validate();
  if (problems.length) { toast(problems.slice(0, 3).join(" · "), true); return; }
  saveAll.disabled = true;
  try {
    const r = await request(`${API}?action=content`, {method: "POST", body: JSON.stringify(data)});
    updatedAt = r.savedAt || new Date().toISOString(); setDirty(false); toast("Changes published successfully");
    if (view === "dashboard") render();
  } catch (err) { toast(err.message, true); } finally { saveAll.disabled = false; }
};
logoutBtn.onclick = async () => {
  if (dirty && !confirm("You have unsaved changes. Log out anyway?")) return;
  try { await request(`${API}?action=logout`, {method: "POST"}); } finally { dirty = false; location.reload(); }
};
function toast(message, isError = false) {
  const el = $("#toast");
  el.textContent = message; el.classList.toggle("error", isError); el.classList.add("show");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), isError ? 6000 : 2800);
}
start();
