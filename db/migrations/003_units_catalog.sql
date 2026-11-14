-- Migration 003: saved condo units (U02), service catalogue and base prices (U03, U05, U06), and the
-- booking columns that point at them (U04). Requested by marn on 2026-11-14.
-- Safe to run twice. Only adds tables and columns; existing rows are untouched.
-- PROVISIONAL: categories (open item 8) and prices (open item 6) are the PWA's placeholder values.
-- Change them with UPDATE/INSERT once the client decides; no code change is needed.

CREATE TABLE IF NOT EXISTS service_categories (
  key         VARCHAR(30)  PRIMARY KEY CHECK (key ~ '^[a-z][a-z -]{1,29}$'),
  name        VARCHAR(60)  NOT NULL,
  description VARCHAR(200) NOT NULL DEFAULT '',
  sort_order  SMALLINT     NOT NULL DEFAULT 0,
  is_active   BOOLEAN      NOT NULL DEFAULT true          -- hide a category without deleting old bookings' key
);

-- One base price per category and service type. Durations stay in src/utils/contract.js (the PDF fixes them).
CREATE TABLE IF NOT EXISTS service_prices (
  category         VARCHAR(30) NOT NULL REFERENCES service_categories (key) ON UPDATE CASCADE,
  service_type     VARCHAR(10) NOT NULL CHECK (service_type IN ('CHECKUP', 'STANDARD', 'MAJOR')),
  base_price       INTEGER     NOT NULL CHECK (base_price >= 0),  -- pesos
  price_is_minimum BOOLEAN     NOT NULL DEFAULT false,            -- "starting price": parts or extra work may add to it
  PRIMARY KEY (category, service_type)
);

INSERT INTO service_categories (key, name, description, sort_order) VALUES
  ('plumbing',   'Plumbing',   'Leaks, clogged drains, low water pressure, toilets', 1),
  ('electrical', 'Electrical', 'Outlets, switches, breakers, lights and wiring',     2),
  ('cleaning',   'Cleaning',   'Unit cleaning, deep cleaning and aircon cleaning',   3),
  ('repairs',    'Repairs',    'Doors, cabinets, walls, furniture and windows',      4),
  ('locks',      'Locks',      'Lockouts, lock changes and smart locks',             5),
  ('moving',     'Moving',     'Boxes, furniture and whole-unit moves',              6)
ON CONFLICT (key) DO NOTHING;

-- Values from src/web/full.js CAT3 tiers (quick = CHECKUP, standard = STANDARD, major = MAJOR).
INSERT INTO service_prices (category, service_type, base_price, price_is_minimum) VALUES
  ('plumbing',   'CHECKUP',  250, false), ('plumbing',   'STANDARD',  450, false), ('plumbing',   'MAJOR',  800, true),
  ('electrical', 'CHECKUP',  300, false), ('electrical', 'STANDARD',  550, false), ('electrical', 'MAJOR', 1200, true),
  ('cleaning',   'CHECKUP',  800, false), ('cleaning',   'STANDARD', 1200, false), ('cleaning',   'MAJOR', 1700, false),
  ('repairs',    'CHECKUP',  400, false), ('repairs',    'STANDARD',  700, false), ('repairs',    'MAJOR', 1800, true),
  ('locks',      'CHECKUP',  650, false), ('locks',      'STANDARD',  900, false), ('locks',      'MAJOR', 1500, true),
  ('moving',     'CHECKUP', 1500, false), ('moving',     'STANDARD', 3500, false), ('moving',     'MAJOR', 6000, true)
ON CONFLICT (category, service_type) DO NOTHING;

-- A resident's saved condo units. The app caps it at 10 per resident.
CREATE TABLE IF NOT EXISTS resident_units (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID         NOT NULL REFERENCES residents (id) ON DELETE CASCADE,
  building    VARCHAR(100) NOT NULL,                 -- condo name, e.g. Avida Towers Prime Taft
  tower       VARCHAR(40)  NOT NULL DEFAULT '',
  floor       VARCHAR(10)  NOT NULL DEFAULT '',
  unit_number VARCHAR(20)  NOT NULL,
  street      VARCHAR(150) NOT NULL DEFAULT '',
  city        VARCHAR(60)  NOT NULL DEFAULT '',
  notes       VARCHAR(200) NOT NULL DEFAULT '',      -- access notes for the aide: gate, parking, landmark
  is_default  BOOLEAN      NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS resident_units_resident_idx ON resident_units (resident_id);
CREATE UNIQUE INDEX IF NOT EXISTS resident_units_one_default ON resident_units (resident_id) WHERE is_default;

-- bookings.address stays the text the aide reads; unit_id says which saved unit it came from.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS unit_id    UUID REFERENCES resident_units (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS symptoms   TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS base_price INTEGER CHECK (base_price >= 0);  -- copied from service_prices at booking time

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_category_fk') THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_category_fk
      FOREIGN KEY (category) REFERENCES service_categories (key) ON UPDATE CASCADE;
  END IF;
END $$;

-- Same setup as residents and bookings: row level security on, no policies, so only the owner
-- (user_side) reads or writes. Team 2's role needs a grant or policy once these are agreed.
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_prices     ENABLE ROW LEVEL SECURITY;
ALTER TABLE resident_units     ENABLE ROW LEVEL SECURITY;
