/*
# Memecoin Signal Tracker Schema

## Purpose
Supports a crypto memecoin trading dashboard that monitors Telegram and Twitter (X) channels
for coin mentions. Tracks which coins get promoted, by how many sources, and alerts the user
when cross-channel signal strength exceeds a threshold.

## Tables

### 1. `channels`
Stores the user's monitored Telegram channels and Twitter accounts.
- `id` — UUID primary key
- `name` — display name for the channel/account
- `type` — 'telegram' or 'twitter'
- `url` — the channel/profile link
- `username` — @handle or t.me slug
- `avatar_color` — hex color for the generated avatar
- `is_active` — whether monitoring is enabled
- `last_checked` — timestamp of last simulated scan
- `signal_count` — total signals ever seen from this source
- `created_at`

### 2. `coin_signals`
Each detected mention of a coin/token in a monitored source.
- `id` — UUID primary key
- `channel_id` — FK to channels
- `coin_name` — token name (e.g. "PEPE")
- `coin_ticker` — ticker symbol (e.g. "$PEPE")
- `contract_address` — optional CA pasted in the message
- `message_preview` — snippet of the source message
- `sentiment` — 'bullish', 'neutral', 'bearish'
- `confidence_score` — 0-100 confidence from pattern matching
- `cross_source_count` — how many distinct channels mentioned this coin recently
- `is_new_listing` — flagged as a brand new coin listing
- `detected_at`
- `created_at`

### 3. `watchlist`
User's personal watchlist of coins to track.
- `id` — UUID primary key
- `coin_name`
- `coin_ticker`
- `contract_address`
- `notes`
- `alert_threshold` — cross_source_count threshold to trigger alert
- `is_alerted` — whether the alert has already fired
- `added_at`

### 4. `alerts`
Log of fired alert notifications.
- `id` — UUID primary key
- `coin_ticker`
- `coin_name`
- `alert_type` — 'cross_source', 'new_listing', 'volume_spike', 'manual'
- `message` — human readable description
- `is_read` — read/unread
- `fired_at`

## Security
- RLS enabled on all tables with `anon, authenticated` policies (single-tenant, no login).
*/

-- ============================================================
-- CHANNELS
-- ============================================================
CREATE TABLE IF NOT EXISTS channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('telegram', 'twitter')),
  url text NOT NULL,
  username text NOT NULL,
  avatar_color text NOT NULL DEFAULT '#3B82F6',
  is_active boolean NOT NULL DEFAULT true,
  last_checked timestamptz,
  signal_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_channels" ON channels;
CREATE POLICY "anon_select_channels" ON channels FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_channels" ON channels;
CREATE POLICY "anon_insert_channels" ON channels FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_channels" ON channels;
CREATE POLICY "anon_update_channels" ON channels FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_channels" ON channels;
CREATE POLICY "anon_delete_channels" ON channels FOR DELETE TO anon, authenticated USING (true);

-- ============================================================
-- COIN SIGNALS
-- ============================================================
CREATE TABLE IF NOT EXISTS coin_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,
  coin_name text NOT NULL,
  coin_ticker text NOT NULL,
  contract_address text,
  message_preview text,
  sentiment text NOT NULL DEFAULT 'bullish' CHECK (sentiment IN ('bullish', 'neutral', 'bearish')),
  confidence_score integer NOT NULL DEFAULT 75 CHECK (confidence_score BETWEEN 0 AND 100),
  cross_source_count integer NOT NULL DEFAULT 1,
  is_new_listing boolean NOT NULL DEFAULT false,
  detected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coin_signals_ticker ON coin_signals(coin_ticker);
CREATE INDEX IF NOT EXISTS idx_coin_signals_detected_at ON coin_signals(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_coin_signals_channel_id ON coin_signals(channel_id);

ALTER TABLE coin_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_coin_signals" ON coin_signals;
CREATE POLICY "anon_select_coin_signals" ON coin_signals FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_coin_signals" ON coin_signals;
CREATE POLICY "anon_insert_coin_signals" ON coin_signals FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_coin_signals" ON coin_signals;
CREATE POLICY "anon_update_coin_signals" ON coin_signals FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_coin_signals" ON coin_signals;
CREATE POLICY "anon_delete_coin_signals" ON coin_signals FOR DELETE TO anon, authenticated USING (true);

-- ============================================================
-- WATCHLIST
-- ============================================================
CREATE TABLE IF NOT EXISTS watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coin_name text NOT NULL,
  coin_ticker text NOT NULL,
  contract_address text,
  notes text,
  alert_threshold integer NOT NULL DEFAULT 3,
  is_alerted boolean NOT NULL DEFAULT false,
  added_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_watchlist" ON watchlist;
CREATE POLICY "anon_select_watchlist" ON watchlist FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_watchlist" ON watchlist;
CREATE POLICY "anon_insert_watchlist" ON watchlist FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_watchlist" ON watchlist;
CREATE POLICY "anon_update_watchlist" ON watchlist FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_watchlist" ON watchlist;
CREATE POLICY "anon_delete_watchlist" ON watchlist FOR DELETE TO anon, authenticated USING (true);

-- ============================================================
-- ALERTS
-- ============================================================
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coin_ticker text NOT NULL,
  coin_name text NOT NULL,
  alert_type text NOT NULL CHECK (alert_type IN ('cross_source', 'new_listing', 'volume_spike', 'manual')),
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  fired_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alerts_fired_at ON alerts(fired_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_is_read ON alerts(is_read);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_alerts" ON alerts;
CREATE POLICY "anon_select_alerts" ON alerts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_alerts" ON alerts;
CREATE POLICY "anon_insert_alerts" ON alerts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_alerts" ON alerts;
CREATE POLICY "anon_update_alerts" ON alerts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_alerts" ON alerts;
CREATE POLICY "anon_delete_alerts" ON alerts FOR DELETE TO anon, authenticated USING (true);
