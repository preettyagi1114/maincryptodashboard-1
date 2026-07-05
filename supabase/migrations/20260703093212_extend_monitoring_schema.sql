/*
# Extend MemeRadar schema for advanced 24/7 monitoring

## Changes

### 1. ALTER `channels`
- Add `channel_category` text: 'channel' | 'community' | 'account' — distinguishes Telegram channel vs group/community vs Twitter account
- Add `platform_id` text — the raw Telegram channel/group ID or Twitter user ID used by the monitoring bot
- Add `monitoring_status` text: 'active' | 'paused' | 'error' — real-time monitoring health
- Add `monitor_error` text — last error message if monitoring failed
- Add `total_mentions` integer — lifetime mention count
- Add `last_signal_at` timestamptz — when the last coin signal came in

### 2. NEW TABLE `coin_mentions`
Core high-frequency table. Every time a coin CA or ticker is seen in any channel, a row is inserted.
- `id` uuid PK
- `channel_id` FK channels
- `raw_text` text — the full message snippet containing the mention
- `coin_ticker` text — normalized ticker (e.g. $PEPE)
- `coin_name` text — inferred name
- `contract_address` text — CA extracted from message (EVM 0x... or Solana base58)
- `mention_count` int — how many times this coin appeared in this scan window
- `detected_at` timestamptz
- `source_message_id` text — original message ID from the platform

### 3. NEW TABLE `coin_heat`
Aggregated heat per coin across all channels — updated whenever mentions come in.
- `id` uuid PK
- `coin_ticker` text UNIQUE — deduplication key
- `coin_name` text
- `contract_address` text
- `total_mentions` int — across all channels
- `channel_count` int — distinct channels that mentioned it
- `community_count` int — distinct communities that mentioned it
- `twitter_count` int — distinct twitter accounts that mentioned it
- `heat_score` int — computed: channel_count*30 + community_count*20 + twitter_count*15 + log(total_mentions)*10
- `cross_platform` boolean — mentioned on both TG and Twitter
- `first_seen_at` timestamptz
- `last_seen_at` timestamptz
- `is_hot` boolean — auto-flag when heat_score >= 60
- `is_ultra_hot` boolean — heat_score >= 100
- `last_alert_fired_at` timestamptz — throttle alerts

### 4. ALTER `alerts`
- Add `heat_score` int — score at time of alert
- Add `channel_names` text[] — which channels triggered it
- Add `contract_address` text — CA for this alert
- Add `urgency` text: 'info' | 'medium' | 'high' | 'critical'

## Security
All tables use RLS with anon+authenticated open policies (single-tenant, no login).
*/

-- ============================================================
-- ALTER channels
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='channels' AND column_name='channel_category') THEN
    ALTER TABLE channels ADD COLUMN channel_category text NOT NULL DEFAULT 'channel' CHECK (channel_category IN ('channel','community','account'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='channels' AND column_name='platform_id') THEN
    ALTER TABLE channels ADD COLUMN platform_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='channels' AND column_name='monitoring_status') THEN
    ALTER TABLE channels ADD COLUMN monitoring_status text NOT NULL DEFAULT 'active' CHECK (monitoring_status IN ('active','paused','error'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='channels' AND column_name='monitor_error') THEN
    ALTER TABLE channels ADD COLUMN monitor_error text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='channels' AND column_name='total_mentions') THEN
    ALTER TABLE channels ADD COLUMN total_mentions integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='channels' AND column_name='last_signal_at') THEN
    ALTER TABLE channels ADD COLUMN last_signal_at timestamptz;
  END IF;
END $$;

-- ============================================================
-- coin_mentions
-- ============================================================
CREATE TABLE IF NOT EXISTS coin_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,
  raw_text text,
  coin_ticker text NOT NULL,
  coin_name text NOT NULL DEFAULT '',
  contract_address text,
  mention_count integer NOT NULL DEFAULT 1,
  detected_at timestamptz NOT NULL DEFAULT now(),
  source_message_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coin_mentions_ticker ON coin_mentions(coin_ticker);
CREATE INDEX IF NOT EXISTS idx_coin_mentions_ca ON coin_mentions(contract_address) WHERE contract_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_coin_mentions_channel ON coin_mentions(channel_id);
CREATE INDEX IF NOT EXISTS idx_coin_mentions_detected_at ON coin_mentions(detected_at DESC);

ALTER TABLE coin_mentions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_coin_mentions" ON coin_mentions;
CREATE POLICY "anon_select_coin_mentions" ON coin_mentions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_coin_mentions" ON coin_mentions;
CREATE POLICY "anon_insert_coin_mentions" ON coin_mentions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_coin_mentions" ON coin_mentions;
CREATE POLICY "anon_update_coin_mentions" ON coin_mentions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_coin_mentions" ON coin_mentions;
CREATE POLICY "anon_delete_coin_mentions" ON coin_mentions FOR DELETE TO anon, authenticated USING (true);

-- ============================================================
-- coin_heat
-- ============================================================
CREATE TABLE IF NOT EXISTS coin_heat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coin_ticker text NOT NULL,
  coin_name text NOT NULL DEFAULT '',
  contract_address text,
  total_mentions integer NOT NULL DEFAULT 0,
  channel_count integer NOT NULL DEFAULT 0,
  community_count integer NOT NULL DEFAULT 0,
  twitter_count integer NOT NULL DEFAULT 0,
  heat_score integer NOT NULL DEFAULT 0,
  cross_platform boolean NOT NULL DEFAULT false,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  is_hot boolean NOT NULL DEFAULT false,
  is_ultra_hot boolean NOT NULL DEFAULT false,
  last_alert_fired_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_coin_heat_ticker ON coin_heat(coin_ticker);
CREATE INDEX IF NOT EXISTS idx_coin_heat_score ON coin_heat(heat_score DESC);
CREATE INDEX IF NOT EXISTS idx_coin_heat_ca ON coin_heat(contract_address) WHERE contract_address IS NOT NULL;

ALTER TABLE coin_heat ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_coin_heat" ON coin_heat;
CREATE POLICY "anon_select_coin_heat" ON coin_heat FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_coin_heat" ON coin_heat;
CREATE POLICY "anon_insert_coin_heat" ON coin_heat FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_coin_heat" ON coin_heat;
CREATE POLICY "anon_update_coin_heat" ON coin_heat FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_coin_heat" ON coin_heat;
CREATE POLICY "anon_delete_coin_heat" ON coin_heat FOR DELETE TO anon, authenticated USING (true);

-- ============================================================
-- ALTER alerts: add new columns
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alerts' AND column_name='heat_score') THEN
    ALTER TABLE alerts ADD COLUMN heat_score integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alerts' AND column_name='channel_names') THEN
    ALTER TABLE alerts ADD COLUMN channel_names text[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alerts' AND column_name='contract_address') THEN
    ALTER TABLE alerts ADD COLUMN contract_address text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alerts' AND column_name='urgency') THEN
    ALTER TABLE alerts ADD COLUMN urgency text NOT NULL DEFAULT 'info' CHECK (urgency IN ('info','medium','high','critical'));
  END IF;
END $$;
