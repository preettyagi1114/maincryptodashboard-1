import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Channel, CoinSignal, CoinMention, CoinHeat, WatchlistItem, Alert, UpcomingCoin, PromoterPattern, Prediction, ScanConfig } from '../lib/database.types';

interface AppContextValue {
  channels: Channel[];
  signals: CoinSignal[];
  mentions: CoinMention[];
  heatCoins: CoinHeat[];
  watchlist: WatchlistItem[];
  alerts: Alert[];
  upcomingCoins: UpcomingCoin[];
  promoterPatterns: PromoterPattern[];
  predictions: Prediction[];
  scanConfig: ScanConfig | null;
  unreadAlertCount: number;
  unreadPredictionCount: number;
  loading: boolean;
  monitoring: boolean;
  lastScan: string | null;
  refetchChannels: () => Promise<void>;
  refetchSignals: () => Promise<void>;
  refetchMentions: () => Promise<void>;
  refetchHeat: () => Promise<void>;
  refetchWatchlist: () => Promise<void>;
  refetchAlerts: () => Promise<void>;
  refetchIntelligence: () => Promise<void>;
  markAlertRead: (id: string) => Promise<void>;
  markAllAlertsRead: () => Promise<void>;
  markPredictionRead: (id: string) => Promise<void>;
  updateScanConfig: (monitorSince: string) => Promise<void>;
  triggerMonitor: (channelIds?: string[]) => Promise<{ alertsFired: number; uniqueCoins: number; mentionsInserted: number; upcomingDetected: number; predictionsGenerated: number }>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [signals, setSignals] = useState<CoinSignal[]>([]);
  const [mentions, setMentions] = useState<CoinMention[]>([]);
  const [heatCoins, setHeatCoins] = useState<CoinHeat[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [upcomingCoins, setUpcomingCoins] = useState<UpcomingCoin[]>([]);
  const [promoterPatterns, setPromoterPatterns] = useState<PromoterPattern[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [scanConfig, setScanConfig] = useState<ScanConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [monitoring, setMonitoring] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);

  const refetchChannels = useCallback(async () => {
    const { data } = await supabase.from('channels').select('*').order('created_at', { ascending: false });
    if (data) setChannels(data);
  }, []);

  const refetchSignals = useCallback(async () => {
    const { data } = await supabase.from('coin_signals').select('*, channels(*)').order('detected_at', { ascending: false }).limit(300);
    if (data) setSignals(data as CoinSignal[]);
  }, []);

  const refetchMentions = useCallback(async () => {
    const { data } = await supabase.from('coin_mentions').select('*, channels(*)').order('detected_at', { ascending: false }).limit(500);
    if (data) setMentions(data as CoinMention[]);
  }, []);

  const refetchHeat = useCallback(async () => {
    const { data } = await supabase.from('coin_heat').select('*').order('heat_score', { ascending: false }).limit(100);
    if (data) setHeatCoins(data);
  }, []);

  const refetchWatchlist = useCallback(async () => {
    const { data } = await supabase.from('watchlist').select('*').order('added_at', { ascending: false });
    if (data) setWatchlist(data);
  }, []);

  const refetchAlerts = useCallback(async () => {
    const { data } = await supabase.from('alerts').select('*').order('fired_at', { ascending: false }).limit(200);
    if (data) setAlerts(data);
  }, []);

  const refetchIntelligence = useCallback(async () => {
    try {
      const [u, p, pred, cfg] = await Promise.all([
        supabase.from('upcoming_coins').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('promoter_patterns').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('predictions').select('*').order('predicted_at', { ascending: false }).limit(50),
        supabase.from('scan_config').select('*').eq('id', 1).maybeSingle(),
      ]);
      if (u.data) setUpcomingCoins(u.data);
      if (p.data) setPromoterPatterns(p.data);
      if (pred.data) setPredictions(pred.data);
      if (cfg.data) setScanConfig(cfg.data as ScanConfig);
    } catch (e) {
      console.warn('refetchIntelligence error (non-fatal):', e);
    }
  }, []);

  const markAlertRead = useCallback(async (id: string) => {
    await supabase.from('alerts').update({ is_read: true }).eq('id', id);
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a));
  }, []);

  const markAllAlertsRead = useCallback(async () => {
    await supabase.from('alerts').update({ is_read: true }).eq('is_read', false);
    setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
  }, []);

  const markPredictionRead = useCallback(async (id: string) => {
    await supabase.from('predictions').update({ is_read: true }).eq('id', id);
    setPredictions(prev => prev.map(p => p.id === id ? { ...p, is_read: true } : p));
  }, []);

  const updateScanConfig = useCallback(async (monitorSince: string) => {
    await supabase.from('scan_config').update({ monitor_since: monitorSince, updated_at: new Date().toISOString() }).eq('id', 1);
    await refetchIntelligence();
  }, [refetchIntelligence]);

  const triggerMonitor = useCallback(async (channelIds?: string[]) => {
    setMonitoring(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/monitor-channels`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: channelIds ? JSON.stringify({ channel_ids: channelIds }) : undefined,
      });
      if (!res.ok) throw new Error(`Monitor failed: ${res.status}`);
      const result = await res.json();
      setLastScan(new Date().toISOString());
      await Promise.all([refetchChannels(), refetchSignals(), refetchMentions(), refetchHeat(), refetchAlerts(), refetchIntelligence()]);
      return {
        alertsFired: result.alertsFired ?? 0,
        uniqueCoins: result.uniqueCoins ?? 0,
        mentionsInserted: result.mentionsInserted ?? 0,
        upcomingDetected: result.upcomingDetected ?? 0,
        predictionsGenerated: result.predictionsGenerated ?? 0,
      };
    } finally {
      setMonitoring(false);
    }
  }, [refetchChannels, refetchSignals, refetchMentions, refetchHeat, refetchAlerts, refetchIntelligence]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        await Promise.all([
          refetchChannels(), refetchSignals(), refetchMentions(),
          refetchHeat(), refetchWatchlist(), refetchAlerts(), refetchIntelligence(),
        ]);
      } catch (e) {
        console.warn('Init error (non-fatal):', e);
      }
      setLoading(false);
    };
    init();

    const signalSub = supabase.channel('rt_signals').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'coin_signals' }, p => {
      setSignals(prev => [p.new as CoinSignal, ...prev].slice(0, 300));
    }).subscribe();

    const alertSub = supabase.channel('rt_alerts').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, p => {
      setAlerts(prev => [p.new as Alert, ...prev].slice(0, 200));
    }).subscribe();

    const heatSub = supabase.channel('rt_heat').on('postgres_changes', { event: '*', schema: 'public', table: 'coin_heat' }, () => {
      refetchHeat();
    }).subscribe();

    const upcomingSub = supabase.channel('rt_upcoming').on('postgres_changes', { event: '*', schema: 'public', table: 'upcoming_coins' }, () => {
      refetchIntelligence();
    }).subscribe();

    const predSub = supabase.channel('rt_predictions').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'predictions' }, p => {
      setPredictions(prev => [p.new as Prediction, ...prev].slice(0, 50));
    }).subscribe();

    return () => {
      signalSub.unsubscribe(); alertSub.unsubscribe(); heatSub.unsubscribe();
      upcomingSub.unsubscribe(); predSub.unsubscribe();
    };
  }, [refetchChannels, refetchSignals, refetchMentions, refetchHeat, refetchWatchlist, refetchAlerts, refetchIntelligence]);

  return (
    <AppContext.Provider value={{
      channels, signals, mentions, heatCoins, watchlist, alerts,
      upcomingCoins, promoterPatterns, predictions, scanConfig,
      unreadAlertCount: alerts.filter(a => !a.is_read).length,
      unreadPredictionCount: predictions.filter(p => !p.is_read && p.status === 'active').length,
      loading, monitoring, lastScan,
      refetchChannels, refetchSignals, refetchMentions, refetchHeat,
      refetchWatchlist, refetchAlerts, refetchIntelligence,
      markAlertRead, markAllAlertsRead, markPredictionRead,
      updateScanConfig, triggerMonitor,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
