// Menu extras for menu.html (loaded after menu.js, whose globals it uses: items, shown, lang, labels, escapeHtml,
// openDish's dialog, toolbar, grid, filters, waDigits, eventIconMarkup, render).
// - "My order": guests add dishes and quantities, then send the order on WhatsApp or show it to the waiter.
// - Photo zoom: tap the photo in a dish's details for a full-screen view with pinch, double-tap, wheel and +/- zoom.
// - View controls: photo size (2/3/4 dishes per row) and larger text, remembered on the device.
// - Tablet mode (menu.html?mode=tablet, or the installed app): website header, hero and footer are hidden, a slim bar
//   with language and "Start new order" is shown, and the table number is kept on the tablet. menu.html?mode=web turns it off.
(() => {
  const T = (en, ar) => (lang === "ar" ? ar : en);
  const keyOf = x => `${x.category}|${x.nameEn}`;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };
  const fmt = n => (Number.isInteger(n) ? String(n) : n.toFixed(2));
  const sar = n => `${fmt(n)} ${T("SAR", "ر.س")}`;
  const unitPrice = x => { if (x.priceMissing || x.price === "—") return null; const n = Number(String(x.price).replace(/[^\d.]/g, "")); return Number.isFinite(n) && n > 0 ? n : null; };
  const nameOf = x => (lang === "ar" ? x.nameAr : x.nameEn);
  const altOf = x => (lang === "ar" ? x.nameEn : x.nameAr);

  // ---------- tablet mode ----------
  const params = new URLSearchParams(location.search);
  if (params.get("mode") === "tablet") store.set("nuzha-tablet", true);
  if (params.get("mode") === "web") store.set("nuzha-tablet", false);
  const installed = matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches;
  const tablet = installed || store.get("nuzha-tablet", false) === true;
  document.body.classList.toggle("tablet-mode", tablet);
    if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});

  let tabletBar = null;
  if (tablet) {
    document.body.insertAdjacentHTML("afterbegin", '<div class="tablet-bar"><div class="tablet-brand"><img src="assets/logo.png" alt=""><span>Nuzha Restaurant<small>مطعم ومطبخ النزهة</small></span></div><div class="tablet-table"></div><div class="tablet-actions"><button type="button" class="tablet-lang"></button><button type="button" class="tablet-new"></button></div></div>');
    tabletBar = document.querySelector(".tablet-bar");
    tabletBar.querySelector(".tablet-lang").onclick = () => document.getElementById("langBtn")?.click();
    tabletBar.querySelector(".tablet-new").onclick = () => startNewOrder();
  }

  // ---------- order state ----------
  let order = store.get("nuzha-order", []).filter(r => r && r.key && r.qty > 0);
  let meta = {table: store.get("nuzha-table", ""), name: "", notes: ""};
  const save = () => store.set("nuzha-order", order);
  const qtyOf = key => order.find(r => r.key === key)?.qty || 0;
  const lines = () => order.map(r => ({...r, item: items.find(x => keyOf(x) === r.key && !x.hidden)})).filter(r => r.item);
  function setQty(key, qty) {
    qty = Math.max(0, Math.min(99, qty));
    const row = order.find(r => r.key === key);
    if (row) row.qty = qty; else if (qty) order.push({key, qty});
    order = order.filter(r => r.qty > 0);
    save();
    refresh();
  }
  const count = () => lines().reduce((s, r) => s + r.qty, 0);
  function totals() {
    let total = 0, byWeight = 0;
    for (const r of lines()) { const p = unitPrice(r.item); if (p === null) byWeight++; else total += p * r.qty; }
    return {total, byWeight};
  }

  // ---------- toolbar: view controls + order button ----------
  const grids = {2: "M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z", 3: "M2 2h6v6H2zM9 2h6v6H9zM16 2h6v6h-6zM2 9h6v6H2zM9 9h6v6H9zM16 9h6v6h-6zM2 16h6v6H2zM9 16h6v6H9zM16 16h6v6h-6z", 4: "M2 2h4v4H2zM7 2h4v4H7zM12 2h4v4h-4zM17 2h4v4h-4zM2 7h4v4H2zM7 7h4v4H7zM12 7h4v4h-4zM17 7h4v4h-4zM2 12h4v4H2zM7 12h4v4H7zM12 12h4v4h-4zM17 12h4v4h-4zM2 17h4v4H2zM7 17h4v4H7zM12 17h4v4h-4zM17 17h4v4h-4z"};
  toolbar.insertAdjacentHTML("beforeend", `<div class="menu-view-controls" role="group"><span class="mvc-label"></span>${[2, 3, 4].map(n => `<button type="button" class="mvc-cols" data-cols="${n}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${grids[n]}"/></svg></button>`).join("")}<button type="button" class="mvc-text">A+</button></div><button type="button" class="order-open"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10l1 3h3v2h-1.2l-1.6 10.2A2 2 0 0 1 16.2 21H7.8a2 2 0 0 1-2-1.8L4.2 9H3V7h3l1-3Zm-.8 5 1.6 10h8.4l1.6-10H6.2Zm2.3-3-.4 1h7.8l-.4-1h-7Z"/></svg><span class="order-open-label"></span><b class="order-count">0</b></button>`);
  const viewControls = toolbar.querySelector(".menu-view-controls"), orderOpen = toolbar.querySelector(".order-open");
  function applyView() {
    const cols = store.get("nuzha-cols", ""), big = store.get("nuzha-big-text", false);
    if (cols) document.body.dataset.cols = cols; else delete document.body.dataset.cols;
    document.body.classList.toggle("menu-text-lg", !!big);
    viewControls.querySelectorAll(".mvc-cols").forEach(b => b.setAttribute("aria-pressed", String(String(cols) === b.dataset.cols)));
    viewControls.querySelector(".mvc-text").setAttribute("aria-pressed", String(!!big));
  }
  viewControls.querySelectorAll(".mvc-cols").forEach(b => b.onclick = () => { const c = store.get("nuzha-cols", ""); store.set("nuzha-cols", String(c) === b.dataset.cols ? "" : b.dataset.cols); applyView(); });
  viewControls.querySelector(".mvc-text").onclick = () => { store.set("nuzha-big-text", !store.get("nuzha-big-text", false)); applyView(); };
  orderOpen.onclick = () => openOrder();
  applyView();

  // ---------- quantity controls on cards and in the dish dialog ----------
  const stopKeys = el => el.addEventListener("keydown", e => e.stopPropagation());
  function control(item, big) {
    const key = keyOf(item), q = qtyOf(key), wrap = document.createElement("div");
    wrap.className = `dish-qty${big ? " big" : ""}${q ? " has-qty" : ""}`;
    wrap.innerHTML = q
      ? `<button type="button" class="q-minus" aria-label="${T("Remove one", "إزالة واحد")}">−</button><span class="q-num" aria-live="polite">${q}</span><button type="button" class="q-plus" aria-label="${T("Add one more", "إضافة واحد")}">+</button>`
      : `<button type="button" class="q-add">+ ${big ? T("Add to my order", "أضف إلى طلبي") : T("Add", "أضف")}</button>`;
    wrap.addEventListener("click", e => {
      e.stopPropagation();
      const b = e.target.closest("button"); if (!b) return;
      setQty(key, qtyOf(key) + (b.classList.contains("q-minus") ? -1 : 1));
    });
    stopKeys(wrap);
    return wrap;
  }
  function decorateCards() {
    grid.querySelectorAll(".dish-card").forEach(card => {
      const item = shown[+card.dataset.i]; if (!item) return;
      let actions = card.querySelector(".dish-actions");
      if (!actions) {
        actions = document.createElement("div"); actions.className = "dish-actions";
        const more = card.querySelector(".dish-more");
        card.querySelector(".dish-body").append(actions);
        if (more) actions.prepend(more);
      }
      actions.querySelector(".dish-qty")?.remove();
      actions.append(control(item, false));
      card.classList.toggle("in-order", qtyOf(keyOf(item)) > 0);
    });
  }
  let openItem = null;
  function decorateDialog() {
    if (!openItem || !dialog.open) return;
    const copy = dialog.querySelector(".dish-dialog-copy"); if (!copy) return;
    let row = copy.querySelector(".dish-order-row");
    if (!row) { row = document.createElement("div"); row.className = "dish-order-row"; copy.querySelector(".dish-dialog-actions")?.before(row); }
    const q = qtyOf(keyOf(openItem)), p = unitPrice(openItem);
    row.innerHTML = "";
    row.append(control(openItem, true));
    if (q) row.insertAdjacentHTML("beforeend", `<button type="button" class="dish-view-order">${T("View my order", "عرض طلبي")}${p !== null ? ` · ${sar(p * q)}` : ""}</button>`);
    row.querySelector(".dish-view-order")?.addEventListener("click", () => { dialog.close(); openOrder(); });
  }
  document.addEventListener("nuzha:dish-opened", e => {
    openItem = e.detail;
    const media = dialog.querySelector(".dish-dialog-media");
    if (media) {
      media.insertAdjacentHTML("beforeend", `<span class="zoom-hint"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 3a7 7 0 0 1 5.6 11.2l4.6 4.6-1.4 1.4-4.6-4.6A7 7 0 1 1 10 3Zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm-1 2h2v2h2v2h-2v2H9v-2H7V9h2V7Z"/></svg>${T("Tap to enlarge", "اضغط للتكبير")}</span>`);
      media.setAttribute("role", "button"); media.tabIndex = 0;
      const open = () => openZoom(openItem.image, nameOf(openItem));
      media.onclick = open; media.onkeydown = ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); open(); } };
    }
    decorateDialog();
  });

  // ---------- order dialog ----------
  document.body.insertAdjacentHTML("beforeend", '<dialog class="order-dialog" aria-labelledby="orderTitle"><div class="order-inner"></div></dialog><dialog class="waiter-dialog" aria-labelledby="waiterTitle"><div class="waiter-inner"></div></dialog><dialog class="zoom-dialog" aria-label="Photo"><div class="zoom-stage"><img alt=""></div><div class="zoom-controls"><button type="button" data-z="out" aria-label="Zoom out">−</button><button type="button" data-z="reset" aria-label="Reset zoom">1:1</button><button type="button" data-z="in" aria-label="Zoom in">+</button></div><p class="zoom-help"></p><button type="button" class="zoom-close" aria-label="Close">×</button></dialog>');
  const orderDialog = document.querySelector(".order-dialog"), orderInner = orderDialog.querySelector(".order-inner");
  const waiterDialog = document.querySelector(".waiter-dialog"), waiterInner = waiterDialog.querySelector(".waiter-inner");
  [orderDialog, waiterDialog].forEach(d => d.addEventListener("click", e => { if (e.target === d) d.close(); }));
  let clearArmed = 0;

  function message() {
    const {total, byWeight} = totals(), out = [];
    out.push(T("New order — Nuzha Restaurant", "طلب جديد — مطعم ومطبخ النزهة"));
    if (meta.table) out.push(`${T("Table", "الطاولة")}: ${meta.table}`);
    if (meta.name) out.push(`${T("Name", "الاسم")}: ${meta.name}`);
    out.push("");
    for (const r of lines()) {
      const p = unitPrice(r.item);
      out.push(`• ${r.qty} × ${nameOf(r.item)} (${altOf(r.item)}) — ${p === null ? T("by weight", "حسب الوزن") : sar(p * r.qty)}`);
    }
    out.push("");
    out.push(`${T("Total", "الإجمالي")}: ${sar(total)}${byWeight ? T(" + items priced by weight", " + أصناف بالوزن") : ""}`);
    if (meta.notes) out.push(`${T("Notes", "ملاحظات")}: ${meta.notes}`);
    return out.join("\n");
  }

  function renderOrder() {
    const rows = lines(), {total, byWeight} = totals();
    clearArmed = 0;
    orderInner.innerHTML = `<header class="order-head"><h2 id="orderTitle">${T("Your order", "طلبك")}</h2><button type="button" class="order-close" aria-label="${T("Close", "إغلاق")}">×</button></header>
      ${rows.length ? `<ul class="order-lines">${rows.map(r => { const p = unitPrice(r.item); return `<li data-key="${escapeHtml(r.key)}"><img src="${escapeHtml(r.item.image)}" alt=""><div class="ol-name"><strong>${escapeHtml(nameOf(r.item))}</strong><small lang="${lang === "ar" ? "en" : "ar"}">${escapeHtml(altOf(r.item))}</small><span>${p === null ? T("Priced by weight", "السعر حسب الوزن") : `${sar(p)} ${T("each", "للواحد")}`}</span></div><div class="dish-qty has-qty"><button type="button" class="q-minus" aria-label="${T("Remove one", "إزالة واحد")}">−</button><span class="q-num">${r.qty}</span><button type="button" class="q-plus" aria-label="${T("Add one more", "إضافة واحد")}">+</button></div><b class="ol-total">${p === null ? "—" : sar(p * r.qty)}</b><button type="button" class="ol-remove" aria-label="${T("Remove dish", "حذف الصنف")}">×</button></li>`; }).join("")}</ul>
      <div class="order-sum"><span>${T("Total", "الإجمالي")}</span><b>${sar(total)}</b></div>${byWeight ? `<p class="order-note">${T("Plus dishes priced by weight — the waiter will confirm.", "بالإضافة إلى أصناف تُسعّر حسب الوزن — سيؤكدها النادل.")}</p>` : ""}
      <div class="order-fields"><label><span>${T("Table number", "رقم الطاولة")}</span><input class="of-table" inputmode="numeric" maxlength="8" value="${escapeHtml(meta.table)}"></label><label><span>${T("Name (optional)", "الاسم (اختياري)")}</span><input class="of-name" maxlength="60" value="${escapeHtml(meta.name)}"></label><label class="wide"><span>${T("Notes for the kitchen (optional)", "ملاحظات للمطبخ (اختياري)")}</span><textarea class="of-notes" rows="2" maxlength="300">${escapeHtml(meta.notes)}</textarea></label></div>
      <p class="order-note">${T("Prices are in Saudi Riyals. Your order is confirmed by our staff.", "الأسعار بالريال السعودي. يتم تأكيد الطلب من قبل فريقنا.")}</p>
      <div class="order-actions"><a class="order-wa" href="#" target="_blank" rel="noreferrer">${eventIconMarkup[1]}<span>${T("Send on WhatsApp", "إرسال عبر واتساب")}</span></a><button type="button" class="order-waiter">${T("Show to the waiter", "اعرض الطلب على النادل")}</button><button type="button" class="order-clear">${T("Start new order", "طلب جديد")}</button></div>`
      : `<p class="order-empty">${T("Your order is empty. Tap “+ Add” on any dish to start.", "طلبك فارغ. اضغط «+ أضف» على أي صنف للبدء.")}</p><div class="order-actions"><button type="button" class="order-back">${T("Browse the menu", "تصفح القائمة")}</button></div>`}`;
    orderInner.querySelector(".order-close").onclick = () => orderDialog.close();
    orderInner.querySelector(".order-back")?.addEventListener("click", () => orderDialog.close());
    orderInner.querySelectorAll(".order-lines li").forEach(li => li.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      const key = li.dataset.key;
      setQty(key, b.classList.contains("ol-remove") ? 0 : qtyOf(key) + (b.classList.contains("q-minus") ? -1 : 1));
    }));
    const wa = orderInner.querySelector(".order-wa");
    const syncWa = () => { if (wa) wa.href = `https://wa.me/${waDigits()}?text=${encodeURIComponent(message())}`; };
    orderInner.querySelector(".of-table")?.addEventListener("input", e => { meta.table = e.target.value.trim(); store.set("nuzha-table", meta.table); syncWa(); updateTableLabel(); });
    orderInner.querySelector(".of-name")?.addEventListener("input", e => { meta.name = e.target.value.trim(); syncWa(); });
    orderInner.querySelector(".of-notes")?.addEventListener("input", e => { meta.notes = e.target.value.trim(); syncWa(); });
    syncWa();
    orderInner.querySelector(".order-waiter")?.addEventListener("click", () => { orderDialog.close(); openWaiter(); });
    const clear = orderInner.querySelector(".order-clear");
    clear?.addEventListener("click", () => {
      if (clearArmed && Date.now() - clearArmed < 4000) { startNewOrder(); return; }
      clearArmed = Date.now(); clear.classList.add("armed"); clear.textContent = T("Tap again to clear the order", "اضغط مرة أخرى لمسح الطلب");
      setTimeout(() => { if (clear.isConnected && clearArmed) { clearArmed = 0; clear.classList.remove("armed"); clear.textContent = T("Start new order", "طلب جديد"); } }, 4000);
    });
  }
  function openOrder() { renderOrder(); if (!orderDialog.open) orderDialog.showModal(); }

  // ---------- waiter view ----------
  function openWaiter() {
    const rows = lines(), {total, byWeight} = totals(), now = new Date();
    const time = now.toLocaleTimeString(lang === "ar" ? "ar-SA" : "en-GB", {hour: "2-digit", minute: "2-digit"});
    waiterInner.innerHTML = `<header><div><p class="eyebrow">${T("ORDER FOR THE WAITER", "الطلب للنادل")}</p><h2 id="waiterTitle">${meta.table ? `${T("Table", "الطاولة")} ${escapeHtml(meta.table)}` : T("Table —", "الطاولة —")}</h2><span>${time}${meta.name ? ` · ${escapeHtml(meta.name)}` : ""}</span></div><b class="w-count">${count()} ${T("items", "أصناف")}</b></header>
      <ol class="waiter-lines">${rows.map(r => { const p = unitPrice(r.item); return `<li><b class="w-qty">${r.qty}×</b><div><strong lang="ar" dir="rtl">${escapeHtml(r.item.nameAr)}</strong><span lang="en" dir="ltr">${escapeHtml(r.item.nameEn)}</span></div><em>${p === null ? T("by weight", "حسب الوزن") : sar(p * r.qty)}</em></li>`; }).join("")}</ol>
      ${meta.notes ? `<p class="waiter-notes"><b>${T("Notes", "ملاحظات")}:</b> ${escapeHtml(meta.notes)}</p>` : ""}
      <div class="waiter-total"><span>${T("Total", "الإجمالي")}</span><b>${sar(total)}${byWeight ? T(" + by weight", " + بالوزن") : ""}</b></div>
      <div class="waiter-actions"><button type="button" class="w-back">${T("Back to edit", "رجوع للتعديل")}</button><button type="button" class="w-done">${T("Order taken — start new order", "تم استلام الطلب — طلب جديد")}</button></div>`;
    waiterInner.querySelector(".w-back").onclick = () => { waiterDialog.close(); openOrder(); };
    waiterInner.querySelector(".w-done").onclick = () => startNewOrder();
    if (!waiterDialog.open) waiterDialog.showModal();
  }

  function startNewOrder() {
    order = []; save(); meta.name = ""; meta.notes = "";
    [orderDialog, waiterDialog, dialog, zoomDialog].forEach(d => d.open && d.close());
    const search = toolbar.querySelector(".menu-search input");
    if (search && search.value) { search.value = ""; search.dispatchEvent(new Event("input")); }
    if (filter !== "all") { filter = "all"; render(); }
    refresh();
    scrollTo({top: 0, behavior: "smooth"});
  }

  // ---------- photo zoom ----------
  const zoomDialog = document.querySelector(".zoom-dialog"), zoomImg = zoomDialog.querySelector("img"), stage = zoomDialog.querySelector(".zoom-stage");
  let z = {s: 1, x: 0, y: 0}, pts = new Map(), pinch = null, lastTap = 0;
  const applyZ = () => { z.s = Math.min(5, Math.max(1, z.s)); if (z.s === 1) { z.x = 0; z.y = 0; } zoomImg.style.transform = `translate(${z.x}px, ${z.y}px) scale(${z.s})`; };
  function openZoom(src, alt) {
    zoomImg.src = src; zoomImg.alt = alt || ""; z = {s: 1, x: 0, y: 0}; applyZ();
    zoomDialog.querySelector(".zoom-help").textContent = T("Pinch, double-tap or use + and − to zoom", "استخدم إصبعين أو اضغط مرتين أو + و − للتكبير");
    if (!zoomDialog.open) zoomDialog.showModal();
  }
  zoomDialog.querySelector(".zoom-close").onclick = () => zoomDialog.close();
  zoomDialog.querySelectorAll("[data-z]").forEach(b => b.onclick = () => { if (b.dataset.z === "in") z.s *= 1.5; else if (b.dataset.z === "out") z.s /= 1.5; else z = {s: 1, x: 0, y: 0}; applyZ(); });
  stage.addEventListener("pointerdown", e => {
    stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = {d: Math.hypot(a.x - b.x, a.y - b.y), s: z.s}; }
    if (pts.size === 1) { const now = Date.now(); if (now - lastTap < 300) { z.s = z.s > 1 ? 1 : 2.5; applyZ(); } lastTap = now; }
  });
  stage.addEventListener("pointermove", e => {
    const prev = pts.get(e.pointerId); if (!prev) return;
    pts.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (pts.size === 2 && pinch) { const [a, b] = [...pts.values()]; z.s = pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d; applyZ(); }
    else if (pts.size === 1 && z.s > 1) { z.x += e.clientX - prev.x; z.y += e.clientY - prev.y; applyZ(); }
  });
  const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; };
  stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
  stage.addEventListener("wheel", e => { e.preventDefault(); z.s *= e.deltaY < 0 ? 1.15 : 1 / 1.15; applyZ(); }, {passive: false});
  zoomDialog.addEventListener("click", e => { if (e.target === zoomDialog) zoomDialog.close(); });

  // ---------- labels and refresh ----------
  function updateTableLabel() { if (tabletBar) tabletBar.querySelector(".tablet-table").textContent = meta.table ? `${T("Table", "الطاولة")} ${meta.table}` : ""; }
  function labelsNow() {
    viewControls.querySelector(".mvc-label").textContent = T("Photo size", "حجم الصور");
    viewControls.setAttribute("aria-label", T("Photo and text size", "حجم الصور والنص"));
    const names = {2: T("Large photos", "صور كبيرة"), 3: T("Medium photos", "صور متوسطة"), 4: T("Small photos", "صور صغيرة")};
    viewControls.querySelectorAll(".mvc-cols").forEach(b => { b.title = names[b.dataset.cols]; b.setAttribute("aria-label", names[b.dataset.cols]); });
    const tb = viewControls.querySelector(".mvc-text"); tb.title = T("Larger text", "نص أكبر"); tb.setAttribute("aria-label", tb.title);
    orderOpen.querySelector(".order-open-label").textContent = T("My order", "طلبي");
    if (tabletBar) {
      tabletBar.querySelector(".tablet-lang").textContent = lang === "ar" ? "English" : "العربية";
      tabletBar.querySelector(".tablet-new").textContent = T("Start new order", "طلب جديد");
      updateTableLabel();
    }
  }
  function refresh() {
    const n = count();
    orderOpen.querySelector(".order-count").textContent = n;
    orderOpen.classList.toggle("has-items", n > 0);
    decorateCards();
    decorateDialog();
    if (orderDialog.open) renderOrder();
  }
  document.addEventListener("nuzha:menu-rendered", () => { labelsNow(); refresh(); if (orderDialog.open) renderOrder(); });
  labelsNow();
  refresh();
})();
