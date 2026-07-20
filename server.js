// ============================================================
//  ShortLink — Линк богиносгогч сервер
//  Node.js (Express) + SQLite (better-sqlite3) + nanoid
// ============================================================

const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");
const { customAlphabet } = require("nanoid");

const app = express();
const PORT = process.env.PORT || 3000;

// Deploy хийсний дараа өөрийн домэйноо энд тохируулна.
// Жишээ: BASE_URL=https://link.tanaisite.mn node server.js
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// ---------- Өгөгдлийн сан ----------
const db = new Database(path.join(__dirname, "links.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    original_url TEXT NOT NULL,
    clicks INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_links_code ON links(code);
`);

const insertLink = db.prepare(
  "INSERT INTO links (code, original_url) VALUES (?, ?)"
);
const findByCode = db.prepare("SELECT * FROM links WHERE code = ?");
const findByUrl = db.prepare(
  "SELECT * FROM links WHERE original_url = ? LIMIT 1"
);
const addClick = db.prepare(
  "UPDATE links SET clicks = clicks + 1 WHERE code = ?"
);

// 0/O, 1/l гэх мэт андуурагдах тэмдэгтгүй, 7 оронтой код
const nanoid = customAlphabet(
  "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ",
  7
);

// ---------- Middleware ----------
app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));

// Маш энгийн rate limit (IP тус бүр минутанд 30 хүсэлт)
const hits = new Map();
app.use("/api/", (req, res, next) => {
  const now = Date.now();
  const ip = req.ip;
  const rec = hits.get(ip) || { count: 0, start: now };
  if (now - rec.start > 60_000) {
    rec.count = 0;
    rec.start = now;
  }
  rec.count++;
  hits.set(ip, rec);
  if (rec.count > 30) {
    return res
      .status(429)
      .json({ error: "Хэт олон хүсэлт илгээлээ. Түр хүлээгээд дахин оролдоно уу." });
  }
  next();
});

// ---------- Туслах функц ----------
function validateUrl(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, error: "Линкний бүтэц буруу байна. http:// эсвэл https:// -ээр эхэлсэн эсэхийг шалгана уу." };
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    return { ok: false, error: "Зөвхөн http болон https линк дэмжигдэнэ." };
  }
  if (input.length > 2048) {
    return { ok: false, error: "Линк хэт урт байна (дээд тал нь 2048 тэмдэгт)." };
  }
  return { ok: true, url: url.href };
}

const RESERVED = new Set(["api", "assets", "index.html", "favicon.ico"]);

// ---------- API ----------

// Линк богиносгох
app.post("/api/shorten", (req, res) => {
  const { url: rawUrl, alias } = req.body || {};
  if (!rawUrl) {
    return res.status(400).json({ error: "url талбар шаардлагатай." });
  }

  const v = validateUrl(String(rawUrl).trim());
  if (!v.ok) return res.status(400).json({ error: v.error });

  // Custom alias өгсөн бол шалгах
  let code;
  if (alias) {
    const a = String(alias).trim();
    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(a)) {
      return res.status(400).json({
        error: "Alias нь 3-30 тэмдэгт, зөвхөн үсэг, тоо, - ба _ агуулна.",
      });
    }
    if (RESERVED.has(a.toLowerCase()) || findByCode.get(a)) {
      return res.status(409).json({ error: "Энэ alias аль хэдийн ашиглагдсан байна." });
    }
    code = a;
  } else {
    // Ижил линк өмнө нь богиносгосон бол дахин ашиглана
    const existing = findByUrl.get(v.url);
    if (existing) {
      return res.json({
        code: existing.code,
        shortUrl: `${BASE_URL}/${existing.code}`,
        originalUrl: existing.original_url,
        reused: true,
      });
    }
    do {
      code = nanoid();
    } while (findByCode.get(code));
  }

  insertLink.run(code, v.url);
  res.status(201).json({
    code,
    shortUrl: `${BASE_URL}/${code}`,
    originalUrl: v.url,
    reused: false,
  });
});

// Линкний статистик
app.get("/api/stats/:code", (req, res) => {
  const link = findByCode.get(req.params.code);
  if (!link) return res.status(404).json({ error: "Линк олдсонгүй." });
  res.json({
    code: link.code,
    originalUrl: link.original_url,
    shortUrl: `${BASE_URL}/${link.code}`,
    clicks: link.clicks,
    createdAt: link.created_at,
  });
});

// ---------- Redirect ----------
app.get("/:code", (req, res) => {
  const { code } = req.params;
  if (RESERVED.has(code.toLowerCase())) return res.status(404).end();
  const link = findByCode.get(code);
  if (!link) {
    return res
      .status(404)
      .send("<h1>404</h1><p>Ийм богино линк бүртгэлгүй байна.</p>");
  }
  addClick.run(code);
  res.redirect(301, link.original_url);
});

app.listen(PORT, () => {
  console.log(`ShortLink сервер ажиллаж байна: ${BASE_URL}`);
});
