CREATE TABLE IF NOT EXISTS products (
    id TEXT NOT NULL,
    name TEXT NOT NULL,
    price REAL NOT NULL CHECK (price >= 0 AND price <= 1000000),
    stock INTEGER NOT NULL CHECK (stock >= 0 AND stock <= 1000000),
    flavor TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (id, flavor)
);

INSERT OR IGNORE INTO products (id, name, price, stock, flavor) VALUES
    ('soya-pop', 'Soya Pop', 40, 0, 'Banana'),
    ('soya-pop', 'Soya Pop', 40, 0, 'Original'),
    ('soya-pop', 'Soya Pop', 40, 0, 'Cereal'),
    ('nutflix', 'Nutflix', 106, 0, '');

CREATE TABLE IF NOT EXISTS cart_items (
    product_id TEXT NOT NULL,
    flavor TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    PRIMARY KEY (product_id, flavor)
);

CREATE TABLE IF NOT EXISTS orders (
    order_number TEXT PRIMARY KEY COLLATE NOCASE,
    created_at TEXT NOT NULL,
    order_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_reservations (
    order_number TEXT NOT NULL REFERENCES orders(order_number) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    flavor TEXT NOT NULL DEFAULT '',
    quantity INTEGER NOT NULL CHECK (quantity > 0 AND quantity <= 1000000)
);

CREATE TRIGGER IF NOT EXISTS reserve_inventory_before_insert
BEFORE INSERT ON order_reservations
BEGIN
    SELECT CASE
        WHEN NOT EXISTS (
            SELECT 1 FROM products WHERE id = NEW.product_id AND flavor = NEW.flavor
        ) THEN RAISE(ABORT, 'unknown product')
        WHEN (
            SELECT stock FROM products WHERE id = NEW.product_id AND flavor = NEW.flavor
        ) < NEW.quantity THEN RAISE(ABORT, 'insufficient inventory')
    END;
END;

CREATE TRIGGER IF NOT EXISTS reserve_inventory_after_insert
AFTER INSERT ON order_reservations
BEGIN
    UPDATE products
    SET stock = stock - NEW.quantity
    WHERE id = NEW.product_id AND flavor = NEW.flavor;
END;

CREATE TABLE IF NOT EXISTS registrations (
    code TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    school TEXT NOT NULL,
    event TEXT NOT NULL,
    category TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    published INTEGER NOT NULL CHECK (published IN (0, 1)),
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value INTEGER NOT NULL CHECK (value >= 0)
);

INSERT OR IGNORE INTO settings (key, value) VALUES ('visitor_count', 0);

CREATE TABLE IF NOT EXISTS admin_sessions (
    token_hash TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_announcements_published_created
    ON announcements (published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_created
    ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_registrations_created
    ON registrations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expiry
    ON admin_sessions (expires_at);
