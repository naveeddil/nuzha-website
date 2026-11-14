// Guest reviews page: overall rating, rating breakdown and every review saved in the admin portal.
// Reviews arrive through runtime-content.js (api/content.php) as the "nuzha:content" event.
(() => {
  let lang = (() => { try { return localStorage.getItem("nuzha-lang") || "en"; } catch { return "en"; } })();
  let reviews = null; // null while loading
  const overview = document.querySelector("#reviewsOverview");
  const list = document.querySelector("#reviewsList");
  const pager = document.querySelector("#reviewsPager");
  const PAGE_SIZE = 12; // reviews per page
  let page = 1;

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[c]);
  const ratingOf = r => { const v = parseFloat(r?.rating); return v > 0 && v <= 5 ? Math.round(v * 2) / 2 : null; };
  const stars = v => v ? `<span class="stars-rating" style="--rating:${v}" role="img" aria-label="${+v} / 5">★★★★★</span>` : "";
  const text = r => String(lang === "ar" ? (r.ar || r.en || "") : (r.en || r.ar || "")).trim();
  const t = (en, ar) => (lang === "ar" ? ar : en);

  function render() {
    if (reviews === null) {
      overview.innerHTML = `<p class="reviews-loading">${t("Loading reviews…", "جارٍ تحميل الآراء…")}</p>`;
      list.innerHTML = ""; pager.innerHTML = "";
      return;
    }
    const shown = reviews.filter(text);
    const rated = shown.map(ratingOf).filter(Boolean);
    if (!shown.length) {
      overview.innerHTML = "";
      pager.innerHTML = "";
      list.innerHTML = `<p class="reviews-empty">${t("Guest reviews will appear here soon.", "ستظهر آراء ضيوفنا هنا قريباً.")}</p>`;
      return;
    }
    if (rated.length) {
      const avg = rated.reduce((a, b) => a + b, 0) / rated.length;
      const rows = [5, 4, 3, 2, 1].map(n => {
        const count = rated.filter(v => Math.floor(v) === n).length;
        return `<div class="rating-row"><span>${n} ★</span><span class="rating-bar"><i style="width:${(count / rated.length) * 100}%"></i></span><span>${count}</span></div>`;
      }).join("");
      overview.innerHTML = `<div class="overview-score"><strong>${avg.toFixed(1)}</strong><div>${stars(avg.toFixed(2))}<span>${t(`Based on ${rated.length} guest review${rated.length === 1 ? "" : "s"}`, `بناءً على ${rated.length} من آراء الضيوف`)}</span></div></div>${rows}`;
    } else {
      overview.innerHTML = "";
    }
    const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
    page = Math.min(Math.max(1, page), pages);
    const from = (page - 1) * PAGE_SIZE;
    renderPager(pages, from, Math.min(from + PAGE_SIZE, shown.length), shown.length);
    list.innerHTML = shown.slice(from, from + PAGE_SIZE).map(r => `<article class="quote">${stars(ratingOf(r))}<blockquote>“${esc(text(r))}”</blockquote>${r.name ? `<p class="quote-author">— ${esc(r.name)}${r.source ? ` <span class="quote-source">· ${esc(r.source)}</span>` : ""}</p>` : ""}</article>`).join("");
  }

  // Page numbers with ellipses, e.g. 1 … 4 5 6 … 12
  function pageNumbers(pages) {
    if (pages <= 7) return Array.from({length: pages}, (_, i) => i + 1);
    const set = [...new Set([1, page - 1, page, page + 1, pages])].filter(n => n >= 1 && n <= pages).sort((a, b) => a - b);
    return set.flatMap((n, i) => (i && n - set[i - 1] > 1 ? ["…", n] : [n]));
  }
  function renderPager(pages, from, to, total) {
    if (pages <= 1) { pager.innerHTML = ""; return; }
    const btn = (label, target, extra = "") => `<button type="button" data-page="${target}" ${extra}>${label}</button>`;
    const numbers = pageNumbers(pages).map(n => (n === "…"
      ? '<span class="pager-gap">…</span>'
      : btn(n, n, n === page ? 'aria-current="page" class="is-current"' : `aria-label="${t("Page", "صفحة")} ${n}"`))).join("");
    pager.innerHTML = `<p class="pager-info">${t(`Showing ${from + 1}–${to} of ${total} reviews`, `عرض ${from + 1}–${to} من ${total} رأياً`)}</p>`
      + `<div class="pager-buttons">${btn(t("← Previous", "→ السابق"), page - 1, page === 1 ? "disabled" : "")}${numbers}${btn(t("Next →", "التالي ←"), page + 1, page === pages ? "disabled" : "")}</div>`;
  }
  pager.addEventListener("click", e => {
    const b = e.target.closest("button[data-page]");
    if (!b || b.disabled) return;
    page = +b.dataset.page;
    render();
    window.scrollTo({top: list.getBoundingClientRect().top + window.scrollY - 120, behavior: "smooth"});
  });

  function applyLanguage() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.querySelector("#langBtn").textContent = lang === "en" ? "العربية" : "English";
    document.querySelectorAll("[data-en]").forEach(el => { el.textContent = el.dataset[lang]; });
    render();
  }

  langBtn.onclick = () => { lang = lang === "en" ? "ar" : "en"; try { localStorage.setItem("nuzha-lang", lang); } catch {} applyLanguage(); };
  themeBtn.onclick = () => {
    const order = [null, "theme-night", "theme-rose"];
    const active = document.body.classList.contains("theme-night") ? 1 : document.body.classList.contains("theme-rose") ? 2 : 0;
    const next = order[(active + 1) % 3];
    document.body.classList.remove("theme-night", "theme-rose");
    if (next) document.body.classList.add(next);
  };
  document.querySelector(".menu-toggle").onclick = e => {
    const nav = document.querySelector(".site-header nav");
    nav.classList.toggle("open");
    e.currentTarget.setAttribute("aria-expanded", nav.classList.contains("open"));
  };

  window.addEventListener("nuzha:content", e => {
    reviews = Array.isArray(e.detail?.reviews) ? e.detail.reviews : [];
    page = 1;
    render();
  });
  // Guest feedback form → api/feedback.php. Entries wait in Admin → Reviews until approved.
  const form = document.querySelector("#feedbackForm");
  const status = document.querySelector("#feedbackStatus");
  const openedAt = Date.now();
  const say = (en, ar, ok) => { status.textContent = t(en, ar); status.className = `form-status ${ok ? "ok" : "error"}`; };
  if (form) form.addEventListener("submit", async e => {
    e.preventDefault();
    const f = new FormData(form);
    const body = {
      name: String(f.get("name") || "").trim(), rating: Number(f.get("rating") || 0), message: String(f.get("message") || "").trim(),
      contact: String(f.get("contact") || "").trim(), consent: f.get("consent") === "on", website: String(f.get("website") || ""), elapsed: Date.now() - openedAt
    };
    if (body.name.length < 2) return say("Please enter your name.", "الرجاء كتابة اسمك.");
    if (!body.rating) return say("Please choose a star rating.", "الرجاء اختيار عدد النجوم.");
    if (body.message.length < 10) return say("Please write a few words about your visit.", "الرجاء كتابة بضع كلمات عن زيارتك.");
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      const r = await fetch("api/feedback.php", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body), credentials: "same-origin"});
      const result = await r.json().catch(() => ({}));
      if (r.status === 429) return say("Thank you — we have already received your feedback. Please try again later.", "شكراً لك — وصلتنا رسالتك بالفعل. حاول مرة أخرى لاحقاً.");
      if (!r.ok || !result.ok) throw new Error(result.error || "failed");
      form.reset();
      say("Thank you! Your feedback has reached the Nuzha team.", "شكراً لك! وصلت رسالتك إلى فريق النزهة.", true);
    } catch {
      say("Sorry, your feedback could not be sent right now. Please try again or message us on WhatsApp.", "عذراً، تعذر إرسال رسالتك الآن. حاول مرة أخرى أو راسلنا عبر واتساب.");
    } finally {
      button.disabled = false;
    }
  });

  // If the content service is unavailable (for example in a local preview), stop showing "Loading".
  setTimeout(() => { if (reviews === null) { reviews = []; render(); } }, 4000);
  applyLanguage();
})();
