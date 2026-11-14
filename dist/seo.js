// Search-engine support shared by the public pages. Load it first (non-deferred) in <head>.
// - "?lang=ar" / "?lang=en" opens a page directly in that language, giving Arabic its own crawlable URL.
// - Keeps the canonical URL, page title, meta description, and Open Graph locale in step with the
//   visible language, and keeps the address bar shareable when visitors switch language.
(() => {
  const SITE = "https://www.nuzharestaurant.com";
  const pages = {
    "/": {
      en: ["Nuzha Restaurant | Saudi Mandi, Kabsa & Charcoal Grills in Al Nairyah", "Nuzha Restaurant (مطعم ومطبخ النزهة) in Al Nairyah serves charcoal grills, mandi and kabsa rice, Saudi breakfast and family feasts. Open daily 6 AM–12 AM. Dine-in, takeaway and event catering."],
      ar: ["مطعم ومطبخ النزهة | مندي وكبسة ومشويات على الفحم في النعيرية", "مطعم ومطبخ النزهة في النعيرية يقدم المشويات على الفحم والمندي والكبسة والفطور السعودي وولائم العائلة. مفتوح يومياً من ٦ صباحاً حتى ١٢ منتصف الليل. محلي وسفري وتجهيز المناسبات."]
    },
    "/menu.html": {
      en: ["Menu & Prices | Nuzha Restaurant, Al Nairyah", "Full Nuzha Restaurant menu with prices in SAR: charcoal grills, mandi and kabsa rice, breakfast, fried fish, appetizers and curries. Order by phone or WhatsApp in Al Nairyah."],
      ar: ["المنيو والأسعار | مطعم ومطبخ النزهة، النعيرية", "قائمة مطعم ومطبخ النزهة كاملة بالأسعار بالريال: مشويات على الفحم، مندي وكبسة، فطور، سمك مقلي، مقبلات وإيدامات. اطلب عبر الهاتف أو واتساب في النعيرية."]
    },
    "/gallery.html": {
      en: ["Food & Feast Gallery | Nuzha Restaurant, Al Nairyah", "Photos of Nuzha Restaurant's grills, mandi and kabsa platters, family feasts and kitchen in Al Nairyah, Saudi Arabia."],
      ar: ["معرض الصور | مطعم ومطبخ النزهة، النعيرية", "صور مشويات وصحون المندي والكبسة وولائم العائلة ومطبخ مطعم ومطبخ النزهة في النعيرية."]
    },
    "/reviews.html": {
      en: ["Guest Reviews | Nuzha Restaurant, Al Nairyah", "Read what guests say about Nuzha Restaurant in Al Nairyah: the food, generous portions and family-friendly welcome. Share your own review on Google."],
      ar: ["آراء الضيوف | مطعم ومطبخ النزهة، النعيرية", "اقرأ ما يقوله ضيوفنا عن مطعم ومطبخ النزهة في النعيرية: الطعام والكميات السخية والترحيب العائلي. شاركنا تقييمك على جوجل."]
    }
  };
  const path = location.pathname.endsWith("/index.html") ? location.pathname.slice(0, -"index.html".length) : location.pathname;
  const page = pages[path];

  // Apply ?lang= before the page scripts read the saved language.
  const requested = new URLSearchParams(location.search).get("lang");
  if (requested === "ar" || requested === "en") {
    try { localStorage.setItem("nuzha-lang", requested); } catch {}
  }

  function setMeta(selector, attr, value) {
    let el = document.head.querySelector(selector);
    if (!el) {
      el = document.createElement(selector.startsWith("link") ? "link" : "meta");
      const [, key, name] = selector.match(/\[(\w+)="([^"]+)"\]/);
      el.setAttribute(key, name);
      document.head.appendChild(el);
    }
    el.setAttribute(attr, value);
  }

  function sync() {
    const lang = document.documentElement.lang === "ar" ? "ar" : "en";
    const url = new URL(location.href);
    if (lang === "ar") url.searchParams.set("lang", "ar"); else url.searchParams.delete("lang");
    if (url.href !== location.href) history.replaceState(history.state, "", url);
    if (!page) return;
    const canonical = SITE + path + (lang === "ar" ? "?lang=ar" : "");
    setMeta('link[rel="canonical"]', "href", canonical);
    setMeta('meta[property="og:url"]', "content", canonical);
    setMeta('meta[property="og:locale"]', "content", lang === "ar" ? "ar_SA" : "en_US");
    setMeta('meta[property="og:locale:alternate"]', "content", lang === "ar" ? "en_US" : "ar_SA");
    const [title, description] = page[lang];
    document.title = title;
    setMeta('meta[name="description"]', "content", description);
    setMeta('meta[property="og:title"]', "content", title);
    setMeta('meta[property="og:description"]', "content", description);
  }

  new MutationObserver(sync).observe(document.documentElement, {attributes: true, attributeFilter: ["lang"]});
  document.addEventListener("DOMContentLoaded", sync);
})();
