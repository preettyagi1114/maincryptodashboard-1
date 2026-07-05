export interface Database {
  public: {
    Tables: {
      channels: { Row: Channel; Insert: Omit<Channel, 'id' | 'created_at'>; Update: Partial<Omit<Channel, 'id' | 'created_at'>>; };
      coin_signals: { Row: CoinSignal; Insert: Omit<CoinSignal, 'id' | 'created_at'>; Update: Partial<Omit<CoinSignal, 'id' | 'created_at'>>; };
      coin_mentions: { Row: CoinMention; Insert: Omit<CoinMention, 'id' | 'created_at'>; Update: Partial<Omit<CoinMention, 'id' | 'created_at'>>; };
      coin_heat: { Row: CoinHeat; Insert: Omit<CoinHeat, 'id'>; Update: Partial<Omit<CoinHeat, 'id'>>; };
      watchlist: { Row: WatchlistItem; Insert: Omit<WatchlistItem, 'id' | 'added_at'>; Update: Partial<Omit<WatchlistItem, 'id' | 'added_at'>>; };
      alerts: { Row: Alert; Insert: Omit<Alert, 'id' | 'fired_at'>; Update: Partial<Omit<Alert, 'id' | 'fired_at'>>; };
      upcoming_coins: { Row: UpcomingCoin; Insert: Omit<UpcomingCoin, 'id' | 'created_at'>; Update: Partial<Omit<UpcomingCoin, 'id' | 'created_at'>>; };
      promoter_patterns: { Row: PromoterPattern; Insert: Omit<PromoterPattern, 'id' | 'created_at'>; Update: Partial<Omit<PromoterPattern, 'id' | 'created_at'>>; };
      predictions: { Row: Prediction; Insert: Omit<Prediction, 'id'>; Update: Partial<Omit<Prediction, 'id'>>; };
      scan_config: { Row: ScanConfig; Insert: Partial<ScanConfig>; Update: Partial<ScanConfig>; };
    };
  };
}

export interface Channel {
  id: string;
  name: string;
  type: 'telegram' | 'twitter';
  channel_category: 'channel' | 'community' | 'account';
  url: string;
  username: string;
  avatar_color: string;
  platform_id: string | null;
  is_active: boolean;
  monitoring_status: 'active' | 'paused' | 'error';
  monitor_error: string | null;
  last_checked: string | null;
  last_signal_at: string | null;
  signal_count: number;
  total_mentions: number;
  created_at: string;
}

export interface CoinSignal {
  id: string;
  channel_id: string | null;
  coin_name: string;
  coin_ticker: string;
  contract_address: string | null;
  message_preview: string | null;
  sentiment: 'bullish' | 'neutral' | 'bearish';
  confidence_score: number;
  cross_source_count: number;
  is_new_listing: boolean;
  detected_at: string;
  created_at: string;
  channels?: Channel;
}

export interface CoinMention {
  id: string;
  channel_id: string | null;
  raw_text: string | null;
  coin_ticker: string;
  coin_name: string;
  contract_address: string | null;
  mention_count: number;
  detected_at: string;
  source_message_id: string | null;
  created_at: string;
  channels?: Channel;
}

export interface CoinHeat {
  id: string;
  coin_ticker: string;
  coin_name: string;
  contract_address: string | null;
  total_mentions: number;
  channel_count: number;
  community_count: number;
  twitter_count: number;
  heat_score: number;
  cross_platform: boolean;
  first_seen_at: string;
  last_seen_at: string;
  is_hot: boolean;
  is_ultra_hot: boolean;
  last_alert_fired_at: string | null;
  updated_at: string;
}

export interface UpcomingCoin {
  id: string;
  coin_ticker: string;
  coin_name: string;
  contract_address: string | null;
  expected_launch_at: string | null;
  launch_confidence: number;
  status: 'upcoming' | 'launched' | 'cancelled' | 'pumping';
  source_channel_ids: string[];
  source_types: string[];
  pre_launch_mentions: number;
  post_launch_mentions: number;
  first_mentioned_at: string;
  launched_at: string | null;
  raw_teasers: string[];
  heat_score: number;
  is_cross_platform: boolean;
  created_at: string;
}

export interface PromoterPattern {
  id: string;
  coin_ticker: string;
  coin_name: string;
  contract_address: string | null;
  channel_ids: string[];
  channel_names: string[];
  channel_types: string[];
  promotion_started_at: string;
  outcome: 'pending' | 'pumped' | 'rugged' | 'flat';
  max_heat_score: number;
  pattern_fingerprint: string;
  created_at: string;
}

export interface Prediction {
  id: string;
  prediction_ticker: string;
  prediction_name: string;
  prediction_ca: string | null;
  confidence_score: number;
  reasoning: string;
  supporting_pattern_ids: string[];
  matching_channel_ids: string[];
  matching_channel_names: string[];
  status: 'active' | 'confirmed' | 'expired' | 'wrong';
  predicted_at: string;
  expected_launch_window: string;
  is_read: boolean;
}

export interface WatchlistItem {
  id: string;
  coin_name: string;
  coin_ticker: string;
  contract_address: string | null;
  notes: string | null;
  alert_threshold: number;
  is_alerted: boolean;
  added_at: string;
}

export interface Alert {
  id: string;
  coin_ticker: string;
  coin_name: string;
  alert_type: 'cross_source' | 'new_listing' | 'volume_spike' | 'manual';
  message: string;
  is_read: boolean;
  heat_score: number | null;
  channel_names: string[] | null;
  contract_address: string | null;
  urgency: 'info' | 'medium' | 'high' | 'critical';
  fired_at: string;
}

export interface ScanConfig {
  id: number;
  monitor_since: string;
  auto_scan_interval_minutes: number;
  updated_at: string;
}
