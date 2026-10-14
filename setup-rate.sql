CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read settings" ON settings FOR SELECT USING (true);
CREATE POLICY "Public update settings" ON settings FOR UPDATE USING (true);
CREATE POLICY "Public insert settings" ON settings FOR INSERT WITH CHECK (true);

INSERT INTO settings (key, value) VALUES
  ('exchange_rate', '0'),
  ('binance_id', ''),
  ('binance_email', ''),
  ('pago_movil_phone', ''),
  ('pago_movil_bank', ''),
  ('pago_movil_holder', ''),
  ('pago_movil_cedula', ''),
  ('bank_name', ''),
  ('bank_holder', ''),
  ('bank_account', ''),
  ('bank_rif', '')
ON CONFLICT (key) DO NOTHING;
