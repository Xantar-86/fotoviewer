-- Run this in your Supabase SQL editor (Database → SQL Editor → New query)

CREATE TABLE IF NOT EXISTS inkomen (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  platform TEXT NOT NULL,
  datum TEXT NOT NULL,
  bedrag FLOAT8 NOT NULL,
  beschrijving TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bestellingen (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  klant TEXT NOT NULL,
  platform TEXT NOT NULL,
  beschrijving TEXT DEFAULT '',
  prijs FLOAT8 NOT NULL,
  status TEXT DEFAULT 'Nieuw',
  datum TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable Row Level Security (single-user personal app)
ALTER TABLE inkomen DISABLE ROW LEVEL SECURITY;
ALTER TABLE bestellingen DISABLE ROW LEVEL SECURITY;
