// Local preview server for the website in dist/.
// Usage (from nuzha-website):  node scripts/serve.mjs [port]
// Then open http://localhost:8080/ . Press Ctrl+C to stop.
// PHP endpoints (api/, admin/) do not run locally, so pages use their built-in static content.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "dist");
const port = Number(process.argv[2]) || 8080;
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".gif": "image/gif", ".ico": "image/x-icon", ".woff2": "font/woff2"
};

http.createServer((req, res) => {
  let urlPath;
  try { urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname); } catch { res.writeHead(400); return res.end("Bad request"); }
  if (urlPath.endsWith("/")) urlPath += "index.html";
  const file = path.join(root, urlPath);
  const blocked = !file.startsWith(root + path.sep) || /[\\/]private[\\/]/.test(file) || path.extname(file) === ".php";
  if (blocked || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, {"content-type": "text/plain"});
    return res.end("Not found");
  }
  res.writeHead(200, {"content-type": types[path.extname(file).toLowerCase()] || "application/octet-stream", "cache-control": "no-store"});
  fs.createReadStream(file).pipe(res);
}).listen(port, "127.0.0.1", () => console.log(`Nuzha preview: http://localhost:${port}/  (serving ${root}; Ctrl+C to stop)`));
