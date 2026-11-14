-- Migration 004: Manongs (aides), their offers on a request, and what happens after one is accepted:
-- on the way / arrived, chat, extra charges, and the resident's rating. Requested by marn on 2026-11-14.
-- Safe to run twice. Only adds tables and columns; existing rows are untouched.
-- PROVISIONAL: not agreed with Team 2, who will own the aide side (ICM open items 36 to 39).

-- Stand-in for Team 2's aide accounts, seeded with the Manongs the PWA already draws.
CREATE TABLE IF NOT EXISTS aides (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         VARCHAR(30)  NOT NULL UNIQUE,          -- stable slug for seeds and tests
  full_name   VARCHAR(100) NOT NULL,
  skills      VARCHAR(100) NOT NULL DEFAULT '',
  categories  TEXT[]       NOT NULL DEFAULT '{}',    -- service_categories keys they take
  rating      NUMERIC(2,1) NOT NULL DEFAULT 5.0 CHECK (rating BETWEEN 0 AND 5),
  jobs_count  INTEGER      NOT NULL DEFAULT 0 CHECK (jobs_count >= 0),
  photo       VARCHAR(100) NOT NULL DEFAULT '',      -- path under src/web, e.g. assets/clariso.png
  vehicle     VARCHAR(60)  NOT NULL DEFAULT '',
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

INSERT INTO aides (key, full_name, skills, categories, rating, jobs_count, photo, vehicle) VALUES
  ('clariso', 'Clariso Perez',     'Plumbing & Electrical Master',     '{plumbing,electrical}', 4.9, 342, 'assets/clariso.png',  'White motorcycle, ABC 1234'),
  ('sofio',   'Sofio Penaflorida', 'Master Plumber & Pipe Specialist', '{plumbing}',            4.8, 128, 'assets/f5/sofio.png', 'Black motorcycle, NAB 2214'),
  ('ramon',   'Ramon Cruz',        'Plumbing',                         '{plumbing}',            4.7,  86, '', 'Blue motorcycle, TXV 902'),
  ('dante',   'Dante Reyes',       'Electrical',                       '{electrical}',          4.8, 154, '', 'Black motorcycle, MNB 331'),
  ('gordon',  'James Gordon',      'Cleaning',                         '{cleaning}',            4.9, 210, '', 'Arrives by jeep'),
  ('liza',    'Liza Santos',       'Cleaning',                         '{cleaning}',            4.8, 176, '', 'Arrives by jeep'),
  ('mario',   'Mario Tan',         'Locks and security',               '{locks}',               4.9, 301, '', 'Grey scooter, ZAB 118'),
  ('edgar',   'Edgar Lim',         'Locks',                            '{locks}',               4.6,  92, '', 'Red scooter, QRT 220'),
  ('jones',   'John Jones',        'Repairs and carpentry',            '{repairs}',             4.7, 164, '', 'Silver scooter, MCD 640'),
  ('paolo',   'Paolo Ramos',       'Repairs and carpentry',            '{repairs}',             4.8, 118, '', 'White van, NDA 7740'),
  ('rey',     'Rey Santos',        'Moving crew lead',                 '{moving}',              4.8, 240, '', 'White L300 van, NDA 4412'),
  ('benny',   'Benny Ocampo',      'Moving crew lead',                 '{moving}',              4.7, 133, '', 'Silver van, NCV 3305')
ON CONFLICT (key) DO NOTHING;

-- One answer per Manong per request (one round): take the resident's price, or counter once.
CREATE TABLE IF NOT EXISTS booking_offers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID        NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
  aide_id    UUID        NOT NULL REFERENCES aides (id),
  price      INTEGER     NOT NULL CHECK (price >= 0),           -- pesos
  kind       VARCHAR(7)  NOT NULL CHECK (kind IN ('accept', 'counter')),
  -- open: waiting for the resident. expired: another offer was taken (reopens if that Manong backs out).
  status     VARCHAR(9)  NOT NULL DEFAULT 'open'
               CHECK (status IN ('open', 'accepted', 'declined', 'withdrawn', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (booking_id, aide_id)
);

CREATE TABLE IF NOT EXISTS booking_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID         NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
  aide_id    UUID         NOT NULL REFERENCES aides (id),       -- the Manong in this conversation
  sender     VARCHAR(8)   NOT NULL CHECK (sender IN ('resident', 'aide')),
  body       VARCHAR(500) NOT NULL CHECK (length(body) > 0),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS booking_messages_booking_idx ON booking_messages (booking_id, created_at);

-- U14: materials, equipment and consumables. The resident approves each before it reaches the bill.
CREATE TABLE IF NOT EXISTS booking_charges (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID        NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
  aide_id    UUID        NOT NULL REFERENCES aides (id),
  label      VARCHAR(80) NOT NULL CHECK (length(label) > 0),
  amount     INTEGER     NOT NULL CHECK (amount > 0),
  status     VARCHAR(8)  NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS booking_charges_booking_idx ON booking_charges (booking_id);

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS aide_id        UUID REFERENCES aides (id),
  ADD COLUMN IF NOT EXISTS agreed_price   INTEGER CHECK (agreed_price >= 0),     -- the accepted offer (open item 32)
  -- Sub-status between Accepted/Confirmed and In Progress; the contract has no such states (open item 20).
  ADD COLUMN IF NOT EXISTS aide_status    VARCHAR(10) CHECK (aide_status IN ('on_the_way', 'arrived')),
  ADD COLUMN IF NOT EXISTS eta_minutes    SMALLINT CHECK (eta_minutes BETWEEN 0 AND 600),
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(5) CHECK (payment_method IN ('gcash', 'cash')),  -- recorded only (open item 7)
  ADD COLUMN IF NOT EXISTS rating         SMALLINT CHECK (rating BETWEEN 1 AND 5),                 -- U17
  ADD COLUMN IF NOT EXISTS praise         TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS review         VARCHAR(500) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tip            INTEGER CHECK (tip >= 0),
  ADD COLUMN IF NOT EXISTS reviewed_at    TIMESTAMPTZ;                                              -- U16: resident closed it
CREATE INDEX IF NOT EXISTS booking_offers_booking_idx ON booking_offers (booking_id);

ALTER TABLE aides            ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_offers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_charges  ENABLE ROW LEVEL SECURITY;
