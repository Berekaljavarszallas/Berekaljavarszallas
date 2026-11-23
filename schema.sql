CREATE TABLE IF NOT EXISTS site_content (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS availability (
  date TEXT PRIMARY KEY,
  rooms_available INTEGER NOT NULL DEFAULT 6 CHECK (rooms_available BETWEEN 0 AND 6),
  apartment_available INTEGER NOT NULL DEFAULT 1 CHECK (apartment_available IN (0,1))
);
INSERT OR IGNORE INTO site_content (id, value) VALUES (1, '{"heroTitle":"Ahol a pihenés\\núj értelmet kap.","heroText":"Fedezd fel Diósgyőr hangulatát, a Bükk közelségét és a gondtalan kikapcsolódást a Berekalja Várszállás kényelmes szobáiban és apartmanjában.","heroImage":"https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=2000&q=85","roomsImage":"https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=85","apartmentImage":"https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=85","roomPrice":"","apartmentPrice":"","phone":"+36 30 370 7525","email":"berekaljavarszallas@gmail.com"}');
