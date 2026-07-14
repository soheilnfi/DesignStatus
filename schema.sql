-- Run this once against your Postgres database before starting the server.
-- (Neon/Supabase: paste into their SQL editor. Anywhere else: psql -f schema.sql)
-- Note: the server also applies this automatically on first request (see
-- src/lib/migrate.js), so manual application is optional.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  figma_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  uses_count INTEGER NOT NULL DEFAULT 0,
  subscription_active BOOLEAN NOT NULL DEFAULT FALSE,
  subscription_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  session_id TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | done | error
  token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  order_id TEXT UNIQUE NOT NULL,
  np_payment_id TEXT, -- unused leftover from the old NOWPayments integration
  tx_hash TEXT, -- Tron transaction id once a matching transfer is found
  status TEXT NOT NULL DEFAULT 'pending',
  amount NUMERIC, -- exact expected USDT amount (e.g. 5.000123) used to
                  -- disambiguate concurrent payers to the same wallet address
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Safe to re-run: adds the column used by direct-wallet-payment confirmation
-- if this table was created before that feature existed.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS tx_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_auth_sessions_state ON auth_sessions(state);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
