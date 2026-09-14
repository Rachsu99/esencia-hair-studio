ALTER TABLE service_prices ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1));
ALTER TABLE service_prices ADD COLUMN created_at TEXT NOT NULL DEFAULT '2026-09-12T00:00:00.000Z';
ALTER TABLE service_prices ADD COLUMN description TEXT;

UPDATE service_prices
SET description = 'Includes shampoo, relaxing scalp massage, and a blow-dry for a smooth, polished finish.'
WHERE price_key = 'styling-blow-dry';

UPDATE service_prices
SET description = 'Dry styling on clean, dry hair to create soft curls or waves.'
WHERE price_key = 'styling-dry-style';

CREATE TABLE styling_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  price_key TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'remove', 'reorder')),
  old_label TEXT,
  new_label TEXT,
  old_amount_cents INTEGER,
  new_amount_cents INTEGER,
  old_sort_order INTEGER,
  new_sort_order INTEGER,
  old_is_active INTEGER,
  new_is_active INTEGER,
  changed_at TEXT NOT NULL,
  changed_by TEXT NOT NULL
);

CREATE INDEX idx_service_prices_active_category_sort
ON service_prices(is_active, category, sort_order);

CREATE INDEX idx_styling_audit_price_key_changed_at
ON styling_audit(price_key, changed_at);

PRAGMA optimize;
