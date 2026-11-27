/* Development serves current runtime files, never cached copies from an earlier build. */
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
if (require("node:fs").existsSync(path.join(root, ".env"))) process.loadEnvFile(path.join(root, ".env"));
const api = new Map([
  ["/api/plan", require("../functions/api.cjs").handler],
  ["/api/live", require("../functions/live.cjs").handler],
]);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".ttf": "font/ttf", ".woff2": "font/woff2" };
const server = http.createServer(async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  const handler = api.get(new URL(req.url, "http://localhost").pathname);
  if (handler) {
    try { await handler(req, res); }
    catch { if (!res.headersSent) res.writeHead(500, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "The server could not finish this request. Try again." })); }
    return;
  }
  if (!["GET", "HEAD"].includes(req.method)) { res.writeHead(405).end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const relative = pathname === "/" ? "/index.html" : pathname;
    if (!/^\/(?:index\.html$|(?:js|css|assets)\/)/.test(relative)) { res.writeHead(404).end(); return; }
    const file = path.resolve(root, "." + relative);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    const content = await fs.readFile(file);
    res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
    if (path.extname(file) === ".otf") res.setHeader("Content-Type", "font/otf");
    res.setHeader("Content-Length", content.length);
    res.end(req.method === "HEAD" ? undefined : content);
  } catch { res.writeHead(404).end("Not found"); }
});
server.on("error", error => { console.error(error.message); process.exitCode = 1; });
const port = Number(process.env.PORT) || 8000;
server.listen(port, "127.0.0.1", () => console.log(`Personal OS: http://127.0.0.1:${port} (fresh files; caching disabled)`));
