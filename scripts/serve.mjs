// Local preview server for the website in dist/.
// Usage (from nuzha-website):  node scripts/serve.mjs [port]
// Then open http://localhost:8080/ . Press Ctrl+C to stop.
// PHP endpoints do not run locally. GET api/content.php is forwarded (read-only) to the live site so the preview
// shows the menu, gallery, reviews and settings saved in the admin portal. Add --offline to use built-in content only.
// The admin portal (admin/) still needs the live server.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "dist");
const port = Number(process.argv.slice(2).find(a => /^\d+$/.test(a))) || 8080;
const offline = process.argv.includes("--offline");
// Networks that require a web proxy (HTTPS_PROXY): restart once with Node's built-in proxy support switched on.
if (!offline && (process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const {spawnSync} = await import("node:child_process");
  const child = spawnSync(process.execPath, process.argv.slice(1), {stdio: "inherit", env: {...process.env, NODE_USE_ENV_PROXY: "1"}});
  process.exit(child.status ?? 0);
}
const LIVE_CONTENT = "https://www.nuzharestaurant.com/api/content.php";
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".gif": "image/gif", ".ico": "image/x-icon", ".woff2": "font/woff2"
};

http.createServer((req, res) => {
  let urlPath;
  try { urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname); } catch { res.writeHead(400); return res.end("Bad request"); }
  if (urlPath === "/api/content.php" && req.method === "GET" && !offline) {
    fetch(LIVE_CONTENT, {headers: {accept: "application/json"}})
      .then(async r => { res.writeHead(r.status, {"content-type": "application/json; charset=utf-8", "cache-control": "no-store"}); res.end(await r.text()); })
      .catch(() => { res.writeHead(502, {"content-type": "text/plain"}); res.end("Live content unavailable"); });
    return;
  }
  if (urlPath.endsWith("/")) urlPath += "index.html";
  const file = path.join(root, urlPath);
  const blocked = !file.startsWith(root + path.sep) || /[\\/]private[\\/]/.test(file) || path.extname(file) === ".php";
  if (blocked || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, {"content-type": "text/plain"});
    return res.end("Not found");
  }
  res.writeHead(200, {"content-type": types[path.extname(file).toLowerCase()] || "application/octet-stream", "cache-control": "no-store"});
  fs.createReadStream(file).pipe(res);
}).listen(port, "127.0.0.1", () => console.log(`Nuzha preview: http://localhost:${port}/  (serving ${root}; ${offline ? "built-in content only" : "saved content from the live site"}; Ctrl+C to stop)`));
