require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const uploadsDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = Date.now() + "-" + Math.round(Math.random() * 1e6) + ext;
    cb(null, name);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- Upload de imágenes ---
app.post("/api/upload", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No se envió archivo" });
  res.json({ url: "/uploads/" + req.file.filename });
});

// --- Productos ---
app.get("/api/products", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM products ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/products", async (req, res) => {
  try {
    const { name, category, price, old_price, badge, image } = req.body;
    const result = await pool.query(
      "INSERT INTO products (name, category, price, old_price, badge, image) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
      [name, category, price, old_price || null, badge || null, image]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/products/:id", async (req, res) => {
  try {
    const { name, category, price, old_price, badge, image } = req.body;
    const result = await pool.query(
      "UPDATE products SET name=$1, category=$2, price=$3, old_price=$4, badge=$5, image=$6 WHERE id=$7 RETURNING *",
      [name, category, price, old_price || null, badge || null, image, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Producto no encontrado" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/products/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM products WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Categorías ---
app.get("/api/categories", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM categories ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/categories", async (req, res) => {
  try {
    const { name, image } = req.body;
    const slug = name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const result = await pool.query(
      "INSERT INTO categories (name, slug, image) VALUES ($1,$2,$3) RETURNING *",
      [name, slug, image || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/categories/:id", async (req, res) => {
  try {
    const { name, image } = req.body;
    const slug = name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const result = await pool.query(
      "UPDATE categories SET name=$1, slug=$2, image=$3 WHERE id=$4 RETURNING *",
      [name, slug, image || null, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Categoría no encontrada" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/categories/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM categories WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

async function init() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price NUMERIC NOT NULL,
        old_price NUMERIC,
        badge TEXT,
        image TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        image TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    const count = await pool.query("SELECT COUNT(*) FROM categories");
    if (parseInt(count.rows[0].count) === 0) {
      const defaults = [
        { name: "Mujer", image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=500&q=80" },
        { name: "Hombre", image: "https://images.unsplash.com/photo-1490578474895-699cd4e2cf59?w=500&q=80" },
        { name: "Accesorios", image: "https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=500&q=80" },
        { name: "Calzado", image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=500&q=80" }
      ];
      for (const c of defaults) {
        await pool.query("INSERT INTO categories (name, slug, image) VALUES ($1,$2,$3) ON CONFLICT (slug) DO NOTHING", [c.name, c.name.toLowerCase(), c.image]);
      }
      console.log("Categorías por defecto insertadas");
    }
    console.log("Tablas listas");
  } catch (err) {
    console.error("Error inicializando:", err.message);
  }
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
}

init();
