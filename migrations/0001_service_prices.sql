CREATE TABLE service_prices (
  price_key TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  amount_cents INTEGER CHECK (amount_cents IS NULL OR (amount_cents >= 0 AND amount_cents <= 5000000)),
  display_type TEXT NOT NULL CHECK (display_type IN ('fixed', 'from', 'surcharge', 'consultation')),
  sort_order INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL DEFAULT 'initial migration',
  CHECK ((display_type = 'consultation' AND amount_cents IS NULL) OR (display_type != 'consultation' AND amount_cents IS NOT NULL))
);

CREATE TABLE price_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  price_key TEXT NOT NULL REFERENCES service_prices(price_key),
  old_amount_cents INTEGER,
  new_amount_cents INTEGER,
  changed_at TEXT NOT NULL,
  changed_by TEXT NOT NULL
);

CREATE INDEX idx_service_prices_category_sort
ON service_prices(category, sort_order);

CREATE INDEX idx_price_audit_price_key_changed_at
ON price_audit(price_key, changed_at);

INSERT INTO service_prices (price_key, category, label, amount_cents, display_type, sort_order, version, updated_at, updated_by) VALUES
  ('haircuts-ladies', 'Haircuts', 'Ladies Haircut', 8500, 'fixed', 10, 1, '2026-09-12T00:00:00.000Z', 'initial migration'),
  ('haircuts-treatment', 'Haircuts', 'Shampoo, Treatment & Haircut', 9500, 'fixed', 20, 1, '2026-09-12T00:00:00.000Z', 'initial migration'),
  ('keratin-short', 'Keratin', 'Short Hair', 18000, 'from', 30, 1, '2026-09-12T00:00:00.000Z', 'initial migration'),
  ('keratin-medium', 'Keratin', 'Medium Hair', 23000, 'from', 40, 1, '2026-09-12T00:00:00.000Z', 'initial migration'),
  ('keratin-long', 'Keratin', 'Long Hair', 28000, 'from', 50, 1, '2026-09-12T00:00:00.000Z', 'initial migration'),
  ('keratin-extra-long-thick', 'Keratin', 'Extra Long / Thick Hair', 33000, 'from', 60, 1, '2026-09-12T00:00:00.000Z', 'initial migration'),
  ('nanoplasty-short', 'Nanoplasty', 'Short Hair', 28000, 'from', 70, 1, '2026-09-12T00:00:00.000Z', 'initial migration'),
  ('nanoplasty-medium', 'Nanoplasty', 'Medium Hair', 34000, 'from', 80, 1, '2026-09-12T00:00:00.000Z', 'initial migration'),
  ('nanoplasty-long', 'Nanoplasty', 'Long Hair', 40000, 'from', 90, 1, '2026-09-12T00:00:00.000Z', 'initial migration'),
  ('nanoplasty-extra-long-thick', 'Nanoplasty', 'Extra Long / Thick Hair', 55000, 'from', 100, 1, '2026-09-12T00:00:00.000Z', 'initial migration'),
  ('extensions-tape', 'Hair Extensions', 'Tape Extensions', NULL, 'consultation', 110, 1, '2026-09-12T00:00:00.000Z', 'initial migration'),
  ('extensions-k-tip', 'Hair Extensions', 'K-Tip Extensions', NULL, 'consultation', 120, 1, '2026-09-12T00:00:00.000Z', 'initial migration'),
  ('removal-tape', 'Extension Removal', 'Tape Extension Removal', 6000, 'from', 130, 1, '2026-09-12T00:00:00.000Z', 'initial migration'),
  ('removal-k-tip', 'Extension Removal', 'K-Tip Extension Removal', 10000, 'from', 140, 1, '2026-09-12T00:00:00.000Z', 'initial migration'),
  ('styling-blow-dry', 'Styling', 'Shampoo & Blow-Dry', 5500, 'fixed', 150, 1, '2026-09-12T00:00:00.000Z', 'initial migration'),
  ('styling-dry-style', 'Styling', 'Dry Style – Curls & Waves', 4500, 'fixed', 160, 1, '2026-09-12T00:00:00.000Z', 'initial migration'),
  ('styling-extra-long-thick', 'Styling', 'Extra Long / Thick Hair', 1000, 'surcharge', 170, 1, '2026-09-12T00:00:00.000Z', 'initial migration');

PRAGMA optimize;
