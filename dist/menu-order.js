// Menu extras for menu.html (loaded after menu.js, whose globals it uses: items, shown, lang, labels, escapeHtml,
// openDish's dialog, toolbar, grid, filters, waDigits, eventIconMarkup, render).
// - "My order": guests add dishes and quantities, then send the order on WhatsApp or show it to the waiter.
// - Photo zoom: tap the photo in a dish's details for a full-screen view with pinch, double-tap, wheel and +/- zoom.
// - View controls: photo size (2/3/4 dishes per row) and larger text, remembered on the device.
// - Tablet mode (only menu.html?mode=tablet, or the installed app): website header, hero and footer are hidden, a slim
//   bar with language and "Start new order" is shown. The order form asks for name, contact number and notes;
//   on tablets (app on a screen whose short side is 600 px or more) it also asks for the table number, kept on the device.
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
  // Only the app address (menu.html?mode=tablet, which the APK opens) or an installed app shows tablet mode.
  // It is deliberately not remembered, so the normal menu.html always shows the full website on every device.
  const params = new URLSearchParams(location.search);
  try { localStorage.removeItem("nuzha-tablet"); } catch {} // clear the old remembered setting
  const installed = matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches;
  const tablet = installed || params.get("mode") === "tablet";
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
  // Table number: only in the app on a tablet-sized screen (not on phones or the website).
  const tableField = tablet && Math.min(screen.width, screen.height) >= 600;
  let meta = {table: tableField ? store.get("nuzha-table", "") : "", name: "", phone: "", notes: ""};
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
  toolbar.insertAdjacentHTML("beforeend", `<div class="menu-view-controls" role="group">${[2, 3, 4].map(n => `<button type="button" class="mvc-cols" data-cols="${n}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${grids[n]}"/></svg></button>`).join("")}<button type="button" class="mvc-text">A+</button></div><button type="button" class="order-open"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10l1 3h3v2h-1.2l-1.6 10.2A2 2 0 0 1 16.2 21H7.8a2 2 0 0 1-2-1.8L4.2 9H3V7h3l1-3Zm-.8 5 1.6 10h8.4l1.6-10H6.2Zm2.3-3-.4 1h7.8l-.4-1h-7Z"/></svg><span class="order-open-label"></span><b class="order-count">0</b></button>`);
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
  // Category chips scroll sideways without a visible scrollbar: mouse wheel scrolls them, and fades show there is more.
  filters.addEventListener("wheel", e => { if (filters.scrollWidth <= filters.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; e.preventDefault(); filters.scrollLeft += (document.documentElement.dir === "rtl" ? -1 : 1) * e.deltaY; }, {passive: false});
  const chipEdges = () => { const max = filters.scrollWidth - filters.clientWidth, x = Math.abs(filters.scrollLeft); filters.classList.toggle("more-start", max > 2 && x > 2); filters.classList.toggle("more-end", max > 2 && x < max - 2); };
  filters.addEventListener("scroll", chipEdges, {passive: true}); addEventListener("resize", chipEdges); document.addEventListener("nuzha:menu-rendered", () => requestAnimationFrame(chipEdges));

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
    if (tableField && meta.table) out.push(`${T("Table", "الطاولة")}: ${meta.table}`);
    if (meta.name) out.push(`${T("Name", "الاسم")}: ${meta.name}`);
    if (meta.phone) out.push(`${T("Contact number", "رقم التواصل")}: ${meta.phone}`);
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
      <div class="order-fields">${tableField ? `<label><span>${T("Table number", "رقم الطاولة")}</span><input class="of-table" inputmode="numeric" maxlength="8" value="${escapeHtml(meta.table)}"></label>` : ""}<label><span>${T("Name", "الاسم")}</span><input class="of-name" maxlength="60" autocomplete="name" value="${escapeHtml(meta.name)}"></label><label class="${tableField ? "wide" : ""}"><span>${T("Contact number", "رقم التواصل")}</span><input class="of-phone" type="tel" inputmode="tel" dir="ltr" maxlength="20" autocomplete="tel" placeholder="05x xxx xxxx" value="${escapeHtml(meta.phone)}"></label><label class="wide"><span>${T("Notes for the kitchen", "ملاحظات للمطبخ")}</span><textarea class="of-notes" rows="3" maxlength="300" placeholder="${T("e.g. less spicy, no onion, extra bread", "مثال: حار أقل، بدون بصل، خبز إضافي")}">${escapeHtml(meta.notes)}</textarea></label></div>
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
    orderInner.querySelector(".of-phone")?.addEventListener("input", e => { meta.phone = e.target.value.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[^\d+ ]/g, "").trim(); syncWa(); });
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
    waiterInner.innerHTML = `<header><div><p class="eyebrow">${T("ORDER FOR THE WAITER", "الطلب للنادل")}</p><h2 id="waiterTitle">${tableField && meta.table ? `${T("Table", "الطاولة")} ${escapeHtml(meta.table)}` : escapeHtml(meta.name) || T("Order", "الطلب")}</h2><span>${time}${meta.name && tableField && meta.table ? ` · ${escapeHtml(meta.name)}` : ""}${meta.phone ? ` · <bdi dir="ltr">${escapeHtml(meta.phone)}</bdi>` : ""}</span></div><b class="w-count">${count()} ${T("items", "أصناف")}</b></header>
      <ol class="waiter-lines">${rows.map(r => { const p = unitPrice(r.item); return `<li><b class="w-qty">${r.qty}×</b><div><strong lang="ar" dir="rtl">${escapeHtml(r.item.nameAr)}</strong><span lang="en" dir="ltr">${escapeHtml(r.item.nameEn)}</span></div><em>${p === null ? T("by weight", "حسب الوزن") : sar(p * r.qty)}</em></li>`; }).join("")}</ol>
      ${meta.notes ? `<p class="waiter-notes"><b>${T("Notes", "ملاحظات")}:</b> ${escapeHtml(meta.notes)}</p>` : ""}
      <div class="waiter-total"><span>${T("Total", "الإجمالي")}</span><b>${sar(total)}${byWeight ? T(" + by weight", " + بالوزن") : ""}</b></div>
      <div class="waiter-actions"><button type="button" class="w-back">${T("Back to edit", "رجوع للتعديل")}</button><button type="button" class="w-done">${T("Order taken — start new order", "تم استلام الطلب — طلب جديد")}</button></div>`;
    waiterInner.querySelector(".w-back").onclick = () => { waiterDialog.close(); openOrder(); };
    waiterInner.querySelector(".w-done").onclick = () => startNewOrder();
    if (!waiterDialog.open) waiterDialog.showModal();
  }

  function startNewOrder() {
    order = []; save(); meta.name = ""; meta.phone = ""; meta.notes = "";
    [orderDialog, waiterDialog, dialog, zoomDialog, drawer].forEach(d => d.open && d.close());
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

  // ---------- side menu and contact page ----------
  // Contact details follow Admin -> Settings (phone, mobile, whatsapp, eventsPhone, hours, social links) with the
  // published defaults as fallback. Open the contact page directly with menu.html#contact.
  const P = {
    menu: "M3 6h18v2H3V6Zm0 5h18v2H3v-2Zm0 5h18v2H3v-2Z",
    bag: "M7 4h10l1 3h3v2h-1.2l-1.6 10.2A2 2 0 0 1 16.2 21H7.8a2 2 0 0 1-2-1.8L4.2 9H3V7h3l1-3Zm-.8 5 1.6 10h8.4l1.6-10H6.2Zm2.3-3-.4 1h7.8l-.4-1h-7Z",
    phone: "M6.6 10.8c1.7 3.4 3.2 4.9 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.2 1.2.4 2.5.7 3.8.7.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.7 21 3 13.3 3 3.7c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.7 3.8.1.4 0 .8-.3 1.1l-2.3 2.2Z",
    pin: "M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7Zm0 4.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z",
    clock: "M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm1 3v4.6l3.2 1.9-1 1.7-4.2-2.5V7h2Z",
    globe: "M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm6.9 9a8 8 0 0 0-3-5.5c.6 1.5 1 3.4 1.1 5.5h1.9ZM15 11c-.2-3-1.3-5.4-3-6-1.7.6-2.8 3-3 6h6Zm-8 0c.1-2.1.5-4 1.1-5.5a8 8 0 0 0-3 5.5H7Zm-1.9 2a8 8 0 0 0 3 5.5c-.6-1.5-1-3.4-1.1-5.5H5.1Zm3.9 0c.2 3 1.3 5.4 3 6 1.7-.6 2.8-3 3-6H9Zm8 0c-.1 2.1-.5 4-1.1 5.5a8 8 0 0 0 3-5.5H17Z",
    star: "m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2Z",
    calendar: "M7 2h2v2h6V2h2v2h3v18H4V4h3V2Zm11 8H6v10h12V10Z",
    home: "M12 3 2 11h3v10h6v-6h2v6h6V11h3L12 3Z",
    photos: "M3 5h18v14H3V5Zm2 2v8.6l4-4 3 3 2-2 5 5V7H5Zm11 1.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z",
    chevron: "m9 5 7 7-7 7-1.4-1.4 5.6-5.6-5.6-5.6L9 5Z",
    facebook: "M14 8h3V4h-3c-2.8 0-5 2.2-5 5v2H7v4h2v9h4v-9h3l1-4h-4V9c0-.6.4-1 1-1z",
    instagram: "M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm5 3.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Zm0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm5.5-4a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z",
    tiktok: "M16.6 3c.4 2.3 1.9 3.9 4.4 4.1v3.4c-1.6.1-3-.4-4.4-1.3v6.3c0 3.9-2.7 6.5-6.3 6.5A6.2 6.2 0 0 1 4 15.7c0-3.8 3.2-6.6 7.1-6.1v3.6c-1.9-.4-3.5.8-3.5 2.6 0 1.5 1.2 2.7 2.7 2.7 1.7 0 2.8-1.1 2.8-3.1V3h3.5z",
    snapchat: "M12 2c3.3 0 5.5 2.5 5.5 5.6v2.2l1.8-.6.7 1.6-2.4 1.2c.6 2.2 2.2 3.6 4.4 4.2l-.3 1.6c-1.2.3-2 .6-2.4 1.3-.3.6-.9.9-1.6.7-1.3-.3-2.5 0-3.6.8-1.3.9-3 .9-4.3 0-1.1-.8-2.3-1.1-3.6-.8-.7.2-1.3-.1-1.6-.7-.4-.7-1.2-1-2.4-1.3l-.3-1.6c2.2-.6 3.8-2 4.4-4.2L3.9 12l.7-1.6 1.8.6V7.6C6.5 4.5 8.7 2 12 2Z",
    x: "M4 3h4.6l4.1 5.6L17.6 3H20l-6.2 7.2L21 21h-4.6l-4.5-6.1L6.6 21H4.2l6.6-7.6L4 3Z"
  };
  const ico = (name, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[name]}"/></svg>`;
  const waIco = cls => eventIconMarkup[1].replace('class="event-action-icon"', `class="${cls}"`);
  const toIntl = v => { let d = String(v || "").replace(/\D/g, ""); if (d.startsWith("00")) d = d.slice(2); if (d.startsWith("0")) d = "966" + d.slice(1); return d; };
  const httpsUrl = v => (/^https:\/\/[^\s"'<>]+$/i.test(String(v || "").trim()) ? String(v).trim() : "");
  const MAPS = "https://www.google.com/maps/search/?api=1&query=Nuzha%20Restaurant%20Al%20Nairyah&query_place_id=ChIJLdhnS6y-zD8RepwxALWWiXo";
  const REVIEW = "https://search.google.com/local/writereview?placeid=ChIJLdhnS6y-zD8RepwxALWWiXo";
  function contactInfo() {
    const s = window.NUZHA_SERVER_CONTENT?.settings || {};
    return {
      phones: [[T("Restaurant", "المطعم"), s.phone || "013 373 1664"],[T("Mobile", "الجوال"), s.mobile || "050 063 8543"]],
      whatsapp: s.whatsapp || "053 003 5292",
      events: s.eventsPhone || "+966 50 190 9933",
      hours: String((lang === "ar" ? s.hoursAr : s.hoursEn) || "").trim() || T("Open daily, 6 AM – 12 AM", "مفتوح يومياً من ٦ صباحاً حتى ١٢ ليلاً"),
      address: T("Prince Sultan bin Abdulaziz, Al Faisaliyah, King Fahd Road, Al Nairyah 37481, Saudi Arabia", "الأمير سلطان بن عبدالعزيز، الفيصلية، شارع الملك فهد، النعيرية 37481، المملكة العربية السعودية"),
      socials: [["facebook", "Facebook", httpsUrl(s.facebook) || "https://www.facebook.com/354392161334869"], ["pin", T("Google Maps", "خرائط Google"), MAPS], ["star", T("Rate us on Google", "قيّمنا على Google"), REVIEW], ["instagram", "Instagram", httpsUrl(s.instagram)], ["tiktok", "TikTok", httpsUrl(s.tiktok)], ["snapchat", "Snapchat", httpsUrl(s.snapchat)], ["x", "X", httpsUrl(s.x)]].filter(x => x[2])
    };
  }
  document.body.insertAdjacentHTML("beforeend", '<dialog class="side-drawer"><div class="drawer-panel"></div></dialog>');
  const drawer = document.querySelector(".side-drawer"), drawerPanel = drawer.querySelector(".drawer-panel");
  let drawerView = "main";
  drawer.addEventListener("click", e => { if (e.target === drawer) drawer.close(); });
  const ext = 'target="_blank" rel="noreferrer"';
  const row = (icon, label, {href = "", action = "", badge = "", external = false, sub = "", trail = ""} = {}) => {
    const text = sub ? `<span class="dl-text">${label}<small>${sub}</small></span>` : `<span class="dl-text">${label}</span>`;
    const inner = `<span class="dl-ico">${icon}</span>${text}${badge}${trail || ico("chevron", "dl-chev")}`;
    return href ? `<a class="dl-item" href="${escapeHtml(href)}" ${external ? ext : ""}>${inner}</a>` : `<button type="button" class="dl-item" data-action="${action}">${inner}</button>`;
  };
  function renderDrawer() {
    const c = contactInfo(), n = count(), close = `<button type="button" class="drawer-close" aria-label="${T("Close", "إغلاق")}">×</button>`;
    drawer.setAttribute("aria-label", drawerView === "contact" ? T("Contact us", "اتصل بنا") : T("Menu", "القائمة"));
    if (drawerView === "contact") {
      drawerPanel.innerHTML = `<header class="drawer-bar"><button type="button" class="drawer-back" aria-label="${T("Back", "رجوع")}">${ico("chevron", "back-ico")}</button><h2>${T("Contact us", "اتصل بنا")}</h2>${close}</header>
        <div class="drawer-hero"><img src="assets/logo.png" alt=""><h3>Nuzha Restaurant</h3><p>مطعم ومطبخ النزهة</p></div>
        <section class="drawer-card"><div class="cc-row">${ico("pin", "cc-ico")}<p>${escapeHtml(c.address)}</p><a class="cc-btn ghost" href="${MAPS}" ${ext}>${T("Directions", "الاتجاهات")}</a></div><div class="cc-row">${ico("clock", "cc-ico")}<p>${escapeHtml(c.hours)}</p></div></section>
        <section class="drawer-card">${c.phones.map(([label, num]) => `<div class="cc-row"><span class="cc-tile">${ico("phone")}</span><div class="cc-num"><small>${label}</small><bdi dir="ltr">${escapeHtml(num)}</bdi></div><a class="cc-btn" href="tel:+${toIntl(num)}">${ico("phone")}<span>${T("Call now", "اتصل الآن")}</span></a></div>`).join("")}
          <div class="cc-row"><span class="cc-tile wa">${waIco("")}</span><div class="cc-num"><small>WhatsApp</small><bdi dir="ltr">${escapeHtml(c.whatsapp)}</bdi></div><a class="cc-btn wa" href="https://wa.me/${toIntl(c.whatsapp)}" ${ext}>${waIco("")}<span>${T("Chat", "مراسلة")}</span></a></div>
          <div class="cc-row"><span class="cc-tile gold">${ico("calendar")}</span><div class="cc-num"><small>${T("Events, weddings & large orders", "المناسبات والأعراس والطلبات الكبيرة")}</small><bdi dir="ltr">${escapeHtml(c.events)}</bdi></div><a class="cc-btn" href="tel:+${toIntl(c.events)}">${ico("phone")}<span>${T("Call now", "اتصل الآن")}</span></a></div></section>
        <section class="drawer-social"><h4>${T("Connect with us", "تواصل معنا")}</h4><div>${c.socials.map(([icon, label, url]) => `<a href="${escapeHtml(url)}" ${ext}>${ico(icon)}<span>${label}</span></a>`).join("")}</div></section>`;
    } else {
      drawerPanel.innerHTML = `<header class="drawer-head"><img src="assets/logo.png" alt=""><div><strong>Nuzha Restaurant</strong><span>مطعم ومطبخ النزهة</span><small>${ico("clock")}${escapeHtml(c.hours)}</small></div>${close}</header>
        <nav class="drawer-list">
          ${row(ico("bag"), T("My order", "طلبي"), {action: "order", badge: n ? `<b class="dl-badge">${n}</b>` : ""})}
          ${row(ico("phone"), T("Contact us", "اتصل بنا"), {action: "contact"})}
          ${row(ico("pin"), T("Directions", "الاتجاهات"), {href: MAPS, external: true})}
          ${row(ico("calendar"), T("Events & large orders", "المناسبات والطلبات الكبيرة"), {href: `tel:+${toIntl(c.events)}`, sub: `<bdi dir="ltr">${escapeHtml(c.events)}</bdi>`, trail: `<span class="dl-call" aria-label="${T("Call", "اتصال")}">${ico("phone")}</span>`})}
          ${row(ico("globe"), lang === "ar" ? "English" : "العربية", {action: "lang"})}
          ${tablet ? "" : `<hr>${row(ico("home"), T("Home", "الرئيسية"), {href: "index.html"})}${row(ico("photos"), T("Gallery", "معرض الصور"), {href: "gallery.html"})}${row(ico("star"), T("Testimonials", "آراء الضيوف"), {href: "reviews.html"})}`}
        </nav>
        <footer class="drawer-foot">© Nuzha Restaurant · مطعم ومطبخ النزهة</footer>`;
    }
    drawerPanel.querySelector(".drawer-close").onclick = () => drawer.close();
    drawerPanel.querySelector(".drawer-back")?.addEventListener("click", () => { drawerView = "main"; renderDrawer(); });
    drawerPanel.querySelectorAll("[data-action]").forEach(b => b.onclick = () => {
      const a = b.dataset.action;
      if (a === "order") { drawer.close(); openOrder(); }
      else if (a === "contact") { drawerView = "contact"; renderDrawer(); drawerPanel.scrollTop = 0; }
      else if (a === "lang") document.getElementById("langBtn")?.click();
    });
  }
  function openDrawer(view = "main") { drawerView = view; renderDrawer(); if (!drawer.open) drawer.showModal(); }
  const burger = cls => `<button type="button" class="${cls}" aria-label="Menu">${ico("menu")}</button>`;
  if (tabletBar) { tabletBar.insertAdjacentHTML("afterbegin", burger("tablet-burger")); tabletBar.querySelector(".tablet-burger").onclick = () => openDrawer(); }
  else { toolbar.insertAdjacentHTML("afterbegin", burger("drawer-open")); toolbar.querySelector(".drawer-open").onclick = () => openDrawer(); }
  if (location.hash === "#contact") setTimeout(() => openDrawer("contact"), 0);
  window.addEventListener("hashchange", () => { if (location.hash === "#contact") openDrawer("contact"); });

  // ---------- labels and refresh ----------
  function updateTableLabel() { if (tabletBar) tabletBar.querySelector(".tablet-table").textContent = tableField && meta.table ? `${T("Table", "الطاولة")} ${meta.table}` : ""; }
  function labelsNow() {
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
  document.addEventListener("nuzha:menu-rendered", () => { labelsNow(); refresh(); if (orderDialog.open) renderOrder(); if (drawer.open) renderDrawer(); });
  labelsNow();
  refresh();
})();
