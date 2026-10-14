require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/upload", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No se envió archivo" });
  try {
    const ext = path.extname(req.file.originalname);
    const fileName = Date.now() + "-" + Math.round(Math.random() * 1e6) + ext;
    const { data, error } = await supabase.storage.from("productos").upload(fileName, req.file.buffer, {
      contentType: req.file.mimetype
    });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("productos").getPublicUrl(fileName);
    if (!urlData || !urlData.publicUrl) throw new Error("No se pudo generar la URL pública");
    res.json({ url: urlData.publicUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/products", async (req, res) => {
  try {
    const { data, error } = await supabase.from("products").select("*").order("id", { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/products", async (req, res) => {
  try {
    const { name, category, price, image } = req.body;
    const { data, error } = await supabase.from("products").insert({ name, category, price, image }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/products/:id", async (req, res) => {
  try {
    const { name, category, price, image } = req.body;
    const { data, error } = await supabase.from("products").update({ name, category, price, image }).eq("id", req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/products/:id", async (req, res) => {
  try {
    const { error } = await supabase.from("products").delete().eq("id", req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/categories", async (req, res) => {
  try {
    const { data, error } = await supabase.from("categories").select("*").order("id", { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/categories", async (req, res) => {
  try {
    const { name, image } = req.body;
    const slug = name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const { data, error } = await supabase.from("categories").insert({ name, slug, image }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/categories/:id", async (req, res) => {
  try {
    const { name, image } = req.body;
    const slug = name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const { data, error } = await supabase.from("categories").update({ name, slug, image }).eq("id", req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/categories/:id", async (req, res) => {
  try {
    const { error } = await supabase.from("categories").delete().eq("id", req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Settings (datos de pago y tasa) ---
app.get("/api/settings", async (req, res) => {
  try {
    const { data, error } = await supabase.from("settings").select("*");
    if (error) throw error;
    const obj = {};
    data.forEach((row) => (obj[row.key] = row.value));
    res.json(obj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/settings", async (req, res) => {
  try {
    const entries = Object.entries(req.body);
    for (const [key, value] of entries) {
      const { error } = await supabase
        .from("settings")
        .upsert({ key, value: String(value), updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (error) throw error;
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
