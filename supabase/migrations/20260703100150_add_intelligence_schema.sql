/*
# Advanced Intelligence Schema — Upcoming Coins, Promoter Patterns, Predictions

## Purpose
Adds the intelligence layer to MemeRadar:
1. Track upcoming/pre-launch coins with expected launch windows
2. Map which sources (TG channels + X accounts) promote coins together (promoter clusters)
3. Build historical pattern fingerprints — when the same promoter cluster fires, predict the next coin
4. Store a scan_config table so monitoring only processes messages from "today onward" (no old data noise)

## New Tables

### `scan_config`
Single-row config for monitoring.
- `id` int (always 1)
- `monitor_since` timestamptz — all scans ignore messages before this timestamp
- `auto_scan_interval_minutes` int — how often to auto-scan (for future scheduler)
- `updated_at`

### `upcoming_coins`
Coins that have been announced/teased but not yet launched.
- `id` uuid
- `coin_ticker` text
- `coin_name` text
- `contract_address` text — may be null until launch
- `expected_launch_at` timestamptz — estimated launch window
- `launch_confidence` int 0-100 — how confident we are about the launch time
- `status` text: 'upcoming' | 'launched' | 'cancelled' | 'pumping'
- `source_channel_ids` text[] — which channels first mentioned it
- `source_types` text[] — 'telegram_channel' | 'telegram_community' | 'twitter'
- `pre_launch_mentions` int — number of mentions before launch
- `post_launch_mentions` int
- `first_mentioned_at` timestamptz
- `launched_at` timestamptz — when we first see real CA on-chain
- `raw_teasers` text[] — array of message snippets that announced it
- `heat_score` int
- `is_cross_platform` bool — mentioned on both TG and X before launch
- `created_at`

### `promoter_patterns`
Records every instance where a promoter cluster (set of channels) co-promoted a coin.
- `id` uuid
- `coin_ticker` text
- `coin_name` text
- `contract_address` text
- `channel_ids` text[] — channels that co-promoted
- `channel_names` text[] — for display
- `channel_types` text[] — telegram_channel | telegram_community | twitter
- `promotion_started_at` timestamptz — when first channel mentioned it
- `outcome` text: 'pending' | 'pumped' | 'rugged' | 'flat' — filled in later
- `max_heat_score` int — peak heat score reached
- `pattern_fingerprint` text — hash/key of the channel set for matching
- `created_at`

### `predictions`
AI-style predictions: when a promoter cluster fires again, what coin is likely next?
- `id` uuid
- `prediction_ticker` text — predicted coin ticker
- `prediction_name` text
- `prediction_ca` text — predicted CA if known
- `confidence_score` int 0-100
- `reasoning` text — human-readable explanation
- `supporting_pattern_ids` uuid[] — which promoter_patterns back this
- `matching_channel_ids` text[] — which of user's channels are in this cluster
- `matching_channel_names` text[]
- `status` text: 'active' | 'confirmed' | 'expired' | 'wrong'
- `predicted_at` timestamptz
- `expected_launch_window` text — e.g. "within 24h" or "2-5 days"
- `is_read` bool

## Modifications to existing tables
None — only additions. Existing schema untouched.

## Security
All new tables: RLS enabled, anon + authenticated open policies (single-tenant).
*/

-- ============================================================
-- scan_config (single row)
-- ============================================================
CREATE TABLE IF NOT EXISTS scan_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  monitor_since timestamptz NOT NULL DEFAULT now(),
  auto_scan_interval_minutes integer NOT NULL DEFAULT 30,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default row if not exists
INSERT INTO scan_config (id, monitor_since, updated_at)
VALUES (1, now(), now())
ON CONFLICT (id) DO NOTHING;

ALTER TABLE scan_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_scan_config" ON scan_config;
CREATE POLICY "anon_select_scan_config" ON scan_config FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_scan_config" ON scan_config;
CREATE POLICY "anon_insert_scan_config" ON scan_config FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_scan_config" ON scan_config;
CREATE POLICY "anon_update_scan_config" ON scan_config FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- upcoming_coins
-- ============================================================
CREATE TABLE IF NOT EXISTS upcoming_coins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coin_ticker text NOT NULL,
  coin_name text NOT NULL DEFAULT '',
  contract_address text,
  expected_launch_at timestamptz,
  launch_confidence integer NOT NULL DEFAULT 50 CHECK (launch_confidence BETWEEN 0 AND 100),
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','launched','cancelled','pumping')),
  source_channel_ids text[] NOT NULL DEFAULT '{}',
  source_types text[] NOT NULL DEFAULT '{}',
  pre_launch_mentions integer NOT NULL DEFAULT 0,
  post_launch_mentions integer NOT NULL DEFAULT 0,
  first_mentioned_at timestamptz NOT NULL DEFAULT now(),
  launched_at timestamptz,
  raw_teasers text[] NOT NULL DEFAULT '{}',
  heat_score integer NOT NULL DEFAULT 0,
  is_cross_platform boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_upcoming_coins_ticker ON upcoming_coins(coin_ticker);
CREATE INDEX IF NOT EXISTS idx_upcoming_coins_status ON upcoming_coins(status);
CREATE INDEX IF NOT EXISTS idx_upcoming_coins_created ON upcoming_coins(created_at DESC);

ALTER TABLE upcoming_coins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_upcoming" ON upcoming_coins;
CREATE POLICY "anon_select_upcoming" ON upcoming_coins FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_upcoming" ON upcoming_coins;
CREATE POLICY "anon_insert_upcoming" ON upcoming_coins FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_upcoming" ON upcoming_coins;
CREATE POLICY "anon_update_upcoming" ON upcoming_coins FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_upcoming" ON upcoming_coins;
CREATE POLICY "anon_delete_upcoming" ON upcoming_coins FOR DELETE TO anon, authenticated USING (true);

-- ============================================================
-- promoter_patterns
-- ============================================================
CREATE TABLE IF NOT EXISTS promoter_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coin_ticker text NOT NULL,
  coin_name text NOT NULL DEFAULT '',
  contract_address text,
  channel_ids text[] NOT NULL DEFAULT '{}',
  channel_names text[] NOT NULL DEFAULT '{}',
  channel_types text[] NOT NULL DEFAULT '{}',
  promotion_started_at timestamptz NOT NULL DEFAULT now(),
  outcome text NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending','pumped','rugged','flat')),
  max_heat_score integer NOT NULL DEFAULT 0,
  pattern_fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promoter_patterns_fingerprint ON promoter_patterns(pattern_fingerprint);
CREATE INDEX IF NOT EXISTS idx_promoter_patterns_ticker ON promoter_patterns(coin_ticker);
CREATE INDEX IF NOT EXISTS idx_promoter_patterns_created ON promoter_patterns(created_at DESC);

ALTER TABLE promoter_patterns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_patterns" ON promoter_patterns;
CREATE POLICY "anon_select_patterns" ON promoter_patterns FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_patterns" ON promoter_patterns;
CREATE POLICY "anon_insert_patterns" ON promoter_patterns FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_patterns" ON promoter_patterns;
CREATE POLICY "anon_update_patterns" ON promoter_patterns FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_patterns" ON promoter_patterns;
CREATE POLICY "anon_delete_patterns" ON promoter_patterns FOR DELETE TO anon, authenticated USING (true);

-- ============================================================
-- predictions
-- ============================================================
CREATE TABLE IF NOT EXISTS predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_ticker text NOT NULL,
  prediction_name text NOT NULL DEFAULT '',
  prediction_ca text,
  confidence_score integer NOT NULL DEFAULT 50 CHECK (confidence_score BETWEEN 0 AND 100),
  reasoning text NOT NULL DEFAULT '',
  supporting_pattern_ids uuid[] NOT NULL DEFAULT '{}',
  matching_channel_ids text[] NOT NULL DEFAULT '{}',
  matching_channel_names text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','confirmed','expired','wrong')),
  predicted_at timestamptz NOT NULL DEFAULT now(),
  expected_launch_window text NOT NULL DEFAULT 'unknown',
  is_read boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_predictions_status ON predictions(status);
CREATE INDEX IF NOT EXISTS idx_predictions_confidence ON predictions(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_predicted_at ON predictions(predicted_at DESC);

ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_predictions" ON predictions;
CREATE POLICY "anon_select_predictions" ON predictions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_predictions" ON predictions;
CREATE POLICY "anon_insert_predictions" ON predictions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_predictions" ON predictions;
CREATE POLICY "anon_update_predictions" ON predictions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_predictions" ON predictions;
CREATE POLICY "anon_delete_predictions" ON predictions FOR DELETE TO anon, authenticated USING (true);
