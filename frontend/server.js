/**
 * server.js — Simple static file server for Zoho Catalyst Slate.
 *
 * Next.js with output: "export" generates a static `out/` folder.
 * Slate doesn't support `next start` in static export mode, so this
 * lightweight Express server serves the pre-built static assets.
 *
 * Port is provided by Slate via $ZC_SLATE_PORT env variable.
 */
const http = require("http");
const path = require("path");
const fs = require("fs");

const PORT = process.env.ZC_SLATE_PORT || process.env.PORT || 3000;
const OUT_DIR = path.join(__dirname, "out");

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
  ".txt": "text/plain",
};

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/html" });
      res.end("<h1>404 Not Found</h1>");
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(data);
    }
  });
}

const server = http.createServer((req, res) => {
  // Strip query strings
  let urlPath = req.url.split("?")[0];

  // Security: prevent directory traversal
  const safePath = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, "");
  let filePath = path.join(OUT_DIR, safePath);

  // Check if file exists
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return serveFile(res, filePath);
  }

  // Try with .html extension (Next.js static export generates /page.html)
  if (fs.existsSync(filePath + ".html")) {
    return serveFile(res, filePath + ".html");
  }

  // Try /index.html inside directory
  const indexPath = path.join(filePath, "index.html");
  if (fs.existsSync(indexPath)) {
    return serveFile(res, indexPath);
  }

  // SPA fallback: serve root index.html for client-side routing
  const rootIndex = path.join(OUT_DIR, "index.html");
  if (fs.existsSync(rootIndex)) {
    return serveFile(res, rootIndex);
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Pramana UI static server running on port ${PORT}`);
  console.log(`Serving from: ${OUT_DIR}`);
});
