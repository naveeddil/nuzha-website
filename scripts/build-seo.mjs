// Regenerates the search-engine metadata for the public pages.
// Usage (from nuzha-website):  node scripts/build-seo.mjs
// Run it after changing menu-data.js, contact details, opening hours, or page titles.
//
// Writes:
//   - a managed <!-- seo:start --> ... <!-- seo:end --> block in the <head> of each public page
//     (title, description, hreflang, Open Graph/Twitter tags, icons, seo.js, JSON-LD structured data)
//   - dist/sitemap.xml and dist/robots.txt
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const SITE = "https://www.nuzharestaurant.com";
const dist = path.resolve(import.meta.dirname, "..", "dist");
const today = new Date().toISOString().slice(0, 10);

const restaurant = {
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "@id": `${SITE}/#restaurant`,
  name: "Nuzha Restaurant",
  alternateName: "مطعم ومطبخ النزهة",
  url: `${SITE}/`,
  logo: `${SITE}/assets/icon-512.png`,
  image: [`${SITE}/assets/og-image.jpg`],
  description: "Saudi restaurant in Al Nairyah serving charcoal grills, mandi and kabsa rice, breakfast, fried fish, appetizers and curries, with dine-in, takeaway and catering for gatherings, weddings and events.",
  telephone: "+966133731664",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Prince Sultan bin Abdulaziz, King Fahd Road, Al Faisaliyah",
    addressLocality: "Al Nairyah",
    addressRegion: "Eastern Province",
    postalCode: "37481",
    addressCountry: "SA"
  },
  geo: {"@type": "GeoCoordinates", latitude: 27.46913, longitude: 48.47136},
  hasMap: "https://www.google.com/maps/search/?api=1&query=Nuzha%20Restaurant%20Al%20Nairyah&query_place_id=ChIJLdhnS6y-zD8RepwxALWWiXo",
  openingHoursSpecification: [{
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    opens: "06:00",
    closes: "23:59"
  }],
  servesCuisine: ["Saudi", "Arabian", "Middle Eastern", "Barbecue"],
  priceRange: "SAR 5–160",
  currenciesAccepted: "SAR",
  hasMenu: `${SITE}/menu.html`,
  contactPoint: [{
    "@type": "ContactPoint",
    telephone: "+966501909933",
    contactType: "events and large orders",
    availableLanguage: ["Arabic", "English"]
  }],
  sameAs: ["https://www.facebook.com/354392161334869"]
};

const ctx = {window: {}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(dist, "menu-data.js"), "utf8"), ctx);
const sectionNames = {bbq: "Barbecue grills", breakfast: "Breakfast", rice: "Rice items", fried: "Fried & fish", appetizers: "Appetizers", curries: "Curries"};
const sectionNamesAr = {bbq: "المشويات", breakfast: "الفطور", rice: "الكبسات والأرز", fried: "البروستد والأسماك", appetizers: "المقبلات", curries: "الإيدامات"};
const sections = [];
for (const item of ctx.window.NUZHA_MENU) {
  let section = sections.find(s => s.key === item.category);
  if (!section) sections.push(section = {key: item.category, items: []});
  section.items.push(item);
}
const menu = {
  "@context": "https://schema.org",
  "@type": "Menu",
  "@id": `${SITE}/menu.html#menu`,
  name: "Nuzha Restaurant menu",
  url: `${SITE}/menu.html`,
  inLanguage: ["en", "ar"],
  provider: {"@id": `${SITE}/#restaurant`},
  hasMenuSection: sections.map(s => ({
    "@type": "MenuSection",
    name: sectionNames[s.key] || s.key,
    alternateName: sectionNamesAr[s.key],
    hasMenuItem: s.items.map(x => {
      const menuItem = {"@type": "MenuItem", name: x.nameEn, alternateName: x.nameAr, description: x.descEn};
      if (/^\d+(\.\d+)?$/.test(String(x.price))) menuItem.offers = {"@type": "Offer", price: String(x.price), priceCurrency: "SAR"};
      return menuItem;
    })
  }))
};

const pages = [
  {file: "index.html", path: "/", title: "Nuzha Restaurant | Saudi Mandi, Kabsa & Charcoal Grills in Al Nairyah",
   description: "Nuzha Restaurant (مطعم ومطبخ النزهة) in Al Nairyah serves charcoal grills, mandi and kabsa rice, Saudi breakfast and family feasts. Open daily 6 AM–12 AM. Dine-in, takeaway and event catering.",
   jsonld: [restaurant], priority: "1.0"},
  {file: "menu.html", path: "/menu.html", title: "Menu & Prices | Nuzha Restaurant, Al Nairyah",
   description: "Full Nuzha Restaurant menu with prices in SAR: charcoal grills, mandi and kabsa rice, breakfast, fried fish, appetizers and curries. Order by phone or WhatsApp in Al Nairyah.",
   jsonld: [menu], priority: "0.9"},
  {file: "gallery.html", path: "/gallery.html", title: "Food & Feast Gallery | Nuzha Restaurant, Al Nairyah",
   description: "Photos of Nuzha Restaurant's grills, mandi and kabsa platters, family feasts and kitchen in Al Nairyah, Saudi Arabia.",
   jsonld: [], priority: "0.6"}
];

const esc = s => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const jsonScript = obj => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;

for (const p of pages) {
  const file = path.join(dist, p.file);
  let html = fs.readFileSync(file, "utf8");
  const nl = html.includes("\r\n") ? "\r\n" : "\n";
  const url = SITE + p.path;
  const block = [
    "<!-- seo:start (generated by scripts/build-seo.mjs; edit that script, not this block) -->",
    `<script src="seo.js"></script>`,
    `<title>${esc(p.title)}</title>`,
    `<meta name="description" content="${esc(p.description)}">`,
    `<meta name="robots" content="index,follow,max-image-preview:large">`,
    `<link rel="alternate" hreflang="en" href="${url}">`,
    `<link rel="alternate" hreflang="ar" href="${url}?lang=ar">`,
    `<link rel="alternate" hreflang="x-default" href="${url}">`,
    `<meta property="og:type" content="${p.path === "/" ? "restaurant.restaurant" : "website"}">`,
    `<meta property="og:site_name" content="Nuzha Restaurant | مطعم ومطبخ النزهة">`,
    `<meta property="og:title" content="${esc(p.title)}">`,
    `<meta property="og:description" content="${esc(p.description)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${SITE}/assets/og-image.jpg">`,
    `<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="Mixed charcoal grill platter at Nuzha Restaurant">`,
    `<meta property="og:locale" content="en_US"><meta property="og:locale:alternate" content="ar_SA">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="theme-color" content="#17382e">`,
    `<link rel="icon" type="image/png" sizes="32x32" href="assets/icon-32.png">`,
    `<link rel="icon" type="image/png" sizes="192x192" href="assets/icon-192.png">`,
    `<link rel="apple-touch-icon" href="assets/apple-touch-icon.png">`,
    ...p.jsonld.map(jsonScript),
    "<!-- seo:end -->"
  ].join(nl);
  if (html.includes("<!-- seo:start")) {
    html = html.replace(/<!-- seo:start[\s\S]*?<!-- seo:end -->/, block);
  } else {
    // First run: remove the original title/description and insert the managed block after the viewport tag.
    html = html.replace(/\s*<title>[\s\S]*?<\/title>/, "").replace(/\s*<meta name="description"[^>]*>/, "");
    const anchor = html.match(/<meta name="viewport"[^>]*>/);
    if (!anchor) throw new Error(`${p.file}: viewport meta not found`);
    html = html.replace(anchor[0], anchor[0] + nl + block);
  }
  fs.writeFileSync(file, html);
  console.log(`updated ${p.file}`);
}

const alt = u => [
  `    <xhtml:link rel="alternate" hreflang="en" href="${u}"/>`,
  `    <xhtml:link rel="alternate" hreflang="ar" href="${u}?lang=ar"/>`,
  `    <xhtml:link rel="alternate" hreflang="x-default" href="${u}"/>`
].join("\n");
const urls = pages.flatMap(p => [SITE + p.path, `${SITE + p.path}?lang=ar`].map(loc => `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <priority>${p.priority}</priority>
${alt(SITE + p.path)}
  </url>`));
fs.writeFileSync(path.join(dist, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join("\n")}
</urlset>
`);
fs.writeFileSync(path.join(dist, "robots.txt"), `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /admin.html
Disallow: /api/
Disallow: /private/

Sitemap: ${SITE}/sitemap.xml
`);
console.log("wrote sitemap.xml and robots.txt");
