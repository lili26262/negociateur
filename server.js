/* Le Négociateur : serveur.
   Garde la clé Anthropic côté serveur et relaie les requêtes de l'appli. */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY;
const PUBLIC_DIR = path.join(__dirname, "public");
const MAX_BODY = 12 * 1024 * 1024; // 12 Mo

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("too_large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function relayToAnthropic(payload) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

// Seuls ces modèles sont acceptés, pour éviter qu'on utilise la clé à d'autres fins.
const ALLOWED_MODEL = "claude-sonnet-4-6";

async function handleApi(req, res) {
  if (!API_KEY) {
    return send(res, 500, { error: "config" });
  }
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch (e) {
    return send(res, 400, { error: "bad_request" });
  }

  const payload = {
    model: ALLOWED_MODEL,
    max_tokens: Math.min(Number(body.max_tokens) || 1000, 4000),
    system: typeof body.system === "string" ? body.system.slice(0, 8000) : undefined,
    messages: Array.isArray(body.messages) ? body.messages : [],
  };
  if (!payload.system) delete payload.system;
  if (payload.messages.length === 0) {
    return send(res, 400, { error: "bad_request" });
  }

  try {
    const r = await relayToAnthropic(payload);
    if (!r.ok) {
      console.error("Anthropic error", r.status, JSON.stringify(r.data).slice(0, 300));
      return send(res, 502, { error: "upstream" });
    }
    return send(res, 200, r.data);
  } catch (e) {
    console.error("Relay failed", e && e.message);
    return send(res, 502, { error: "upstream" });
  }
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.normalize(path.join(PUBLIC_DIR, urlPath));
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, "Interdit", "text/plain");
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, "Introuvable", "text/plain; charset=utf-8");
    const type = TYPES[path.extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/analyse") {
    return handleApi(req, res);
  }
  if (req.method === "GET" || req.method === "HEAD") {
    return serveStatic(req, res);
  }
  send(res, 405, { error: "method" });
});

server.listen(PORT, () => {
  console.log("Le Négociateur écoute sur le port " + PORT);
  if (!API_KEY) console.warn("ATTENTION : ANTHROPIC_API_KEY n'est pas défini.");
});
