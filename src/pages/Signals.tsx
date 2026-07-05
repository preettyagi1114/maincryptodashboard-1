import { useState, useMemo } from 'react';
import {
  Search, Zap, Copy, CheckCheck, ExternalLink, ChevronDown,
  Star, Flame, Hash, Users, Twitter,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { formatTimeAgo, getConfidenceBg } from '../lib/utils';
import type { Page } from '../lib/utils';
import type { CoinSignal, CoinHeat, Channel } from '../lib/database.types';

interface SignalsProps {
  onNavigate: (page: Page) => void;
}

type SortBy = 'newest' | 'confidence' | 'cross_source' | 'heat';
type ViewMode = 'signals' | 'heat';

export default function Signals({ onNavigate }: SignalsProps) {
  const { signals, channels, heatCoins, mentions } = useApp();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [showNewOnly, setShowNewOnly] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState('all');
  const [minConfidence, setMinConfidence] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const [addingToWatchlist, setAddingToWatchlist] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('signals');
  const [typeFilter, setTypeFilter] = useState<'all' | 'telegram' | 'twitter'>('all');

  const activeChannels = channels.filter(c => c.is_active);

  // Map coin_ticker → deduped source channels
  const coinSourceChannels = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const m of mentions) {
      if (!m.channel_id) continue;
      if (!map.has(m.coin_ticker)) map.set(m.coin_ticker, new Set());
      map.get(m.coin_ticker)!.add(m.channel_id);
    }
    for (const s of signals) {
      if (!s.channel_id) continue;
      if (!map.has(s.coin_ticker)) map.set(s.coin_ticker, new Set());
      map.get(s.coin_ticker)!.add(s.channel_id);
    }
    const result = new Map<string, Channel[]>();
    for (const [ticker, ids] of map) {
      result.set(ticker, channels.filter(c => ids.has(c.id)));
    }
    return result;
  }, [mentions, signals, channels]);

  const filteredSignals = useMemo(() => {
    let list = [...signals];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.coin_ticker.toLowerCase().includes(q) ||
        s.coin_name.toLowerCase().includes(q) ||
        (s.contract_address ?? '').toLowerCase().includes(q)
      );
    }
    if (showNewOnly) list = list.filter(s => s.is_new_listing);
    if (selectedChannel !== 'all') list = list.filter(s => s.channel_id === selectedChannel);
    if (minConfidence > 0) list = list.filter(s => s.confidence_score >= minConfidence);
    if (typeFilter !== 'all') {
      const ids = new Set(channels.filter(c => c.type === typeFilter).map(c => c.id));
      list = list.filter(s => s.channel_id && ids.has(s.channel_id));
    }
    list.sort((a, b) => {
      if (sortBy === 'confidence') return b.confidence_score - a.confidence_score;
      if (sortBy === 'cross_source') return b.cross_source_count - a.cross_source_count;
      if (sortBy === 'heat') {
        const ha = heatCoins.find(h => h.coin_ticker === a.coin_ticker)?.heat_score ?? 0;
        const hb = heatCoins.find(h => h.coin_ticker === b.coin_ticker)?.heat_score ?? 0;
        return hb - ha;
      }
      return new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime();
    });
    return list;
  }, [signals, search, showNewOnly, selectedChannel, minConfidence, sortBy, typeFilter, channels, heatCoins]);

  const filteredHeat = useMemo(() => {
    let list = [...heatCoins];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(h =>
        h.coin_ticker.toLowerCase().includes(q) ||
        h.coin_name.toLowerCase().includes(q) ||
        (h.contract_address ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [heatCoins, search]);

  function copyCA(ca: string, id: string) {
    navigator.clipboard.writeText(ca);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  async function addToWatchlist(signal: CoinSignal) {
    setAddingToWatchlist(signal.id);
    await supabase.from('watchlist').upsert({
      coin_name: signal.coin_name,
      coin_ticker: signal.coin_ticker,
      contract_address: signal.contract_address,
      notes: 'Added from signal feed',
      alert_threshold: 3,
    }, { onConflict: 'coin_ticker' });
    setAddingToWatchlist(null);
  }

  async function addHeatToWatchlist(heat: CoinHeat) {
    await supabase.from('watchlist').upsert({
      coin_name: heat.coin_name,
      coin_ticker: heat.coin_ticker,
      contract_address: heat.contract_address,
      notes: `Heat score: ${heat.heat_score}. Added from heat map.`,
      alert_threshold: 3,
    }, { onConflict: 'coin_ticker' });
  }

  // Inline channel chip
  function ChannelChip({ ch }: { ch: Channel }) {
    return (
      <span className="inline-flex items-center gap-1 bg-slate-800 border border-slate-700/60 rounded-md px-1.5 py-0.5 text-[10px] text-slate-300 whitespace-nowrap">
        <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: ch.avatar_color }} />
        {ch.name}
        {ch.type === 'twitter'
          ? <Twitter size={8} className="text-sky-400 shrink-0" />
          : ch.channel_category === 'community'
            ? <Users size={8} className="text-purple-400 shrink-0" />
            : <Hash size={8} className="text-blue-400 shrink-0" />}
      </span>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {/* View toggle */}
      <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/50 rounded-xl p-1 w-fit">
        <button onClick={() => setViewMode('signals')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${viewMode === 'signals' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>
          Signal Feed
        </button>
        <button onClick={() => setViewMode('heat')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${viewMode === 'heat' ? 'bg-orange-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>
          <Flame size={14} />
          Heat Map
          {heatCoins.filter(h => h.is_ultra_hot).length > 0 && (
            <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black">
              {heatCoins.filter(h => h.is_ultra_hot).length}
            </span>
          )}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search ticker, name, contract address..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors" />
          </div>
          {viewMode === 'signals' && (
            <>
              <select value={selectedChannel} onChange={e => setSelectedChannel(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-300 text-sm focus:outline-none focus:border-blue-500 cursor-pointer">
                <option value="all">All Sources</option>
                {activeChannels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-300 text-sm focus:outline-none focus:border-blue-500 cursor-pointer">
                <option value="newest">Newest</option>
                <option value="confidence">Highest Confidence</option>
                <option value="cross_source">Most Sources</option>
                <option value="heat">Highest Heat</option>
              </select>
            </>
          )}
        </div>
        {viewMode === 'signals' && (
          <div className="flex items-center gap-2 flex-wrap">
            {(['all', 'telegram', 'twitter'] as const).map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${typeFilter === t ? 'bg-blue-600/20 border-blue-500/50 text-blue-300' : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600'}`}>
                {t === 'telegram' ? <Hash size={10} /> : t === 'twitter' ? <Twitter size={10} /> : null}
                {t === 'all' ? 'All Platforms' : t === 'telegram' ? 'Telegram' : 'Twitter/X'}
              </button>
            ))}
            <button onClick={() => setShowNewOnly(v => !v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${showNewOnly ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
              New Listings Only
            </button>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-slate-500 text-xs">Min confidence:</span>
              <select value={minConfidence} onChange={e => setMinConfidence(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-300 text-xs focus:outline-none focus:border-blue-500 cursor-pointer">
                <option value={0}>Any</option>
                <option value={50}>50%+</option>
                <option value={70}>70%+</option>
                <option value={85}>85%+</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Heat Map view */}
      {viewMode === 'heat' && (
        <>
          <div className="flex items-center gap-2">
            <Flame size={15} className="text-orange-400" />
            <span className="text-slate-400 text-sm"><span className="text-white font-semibold">{filteredHeat.length}</span> coins tracked</span>
          </div>
          {filteredHeat.length === 0 ? (
            <div className="bg-slate-900 border border-slate-700/50 rounded-2xl flex flex-col items-center justify-center py-16 gap-3">
              <Flame size={32} className="text-slate-700" />
              <p className="text-slate-500 text-sm">No heat data yet — run a scan from the Dashboard</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredHeat.map((heat, i) => {
                const heatSources = coinSourceChannels.get(heat.coin_ticker) ?? [];
                return (
                  <div key={heat.id} className={`bg-slate-900 border rounded-2xl overflow-hidden hover:border-slate-600/50 transition-all
                    ${heat.is_ultra_hot ? 'border-red-500/30' : heat.is_hot ? 'border-orange-500/20' : 'border-slate-700/50'}`}>
                    <div className="flex items-center gap-4 px-5 py-4 cursor-pointer"
                      onClick={() => setExpanded(expanded === `heat-${heat.id}` ? null : `heat-${heat.id}`)}>
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0
                        ${i < 3 ? 'bg-gradient-to-br from-orange-500 to-red-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                        #{i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-white font-bold">{heat.coin_ticker}</span>
                          <span className="text-slate-500 text-sm">{heat.coin_name}</span>
                          {heat.is_ultra_hot && (
                            <span className="bg-red-500/20 border border-red-500/30 text-red-300 text-[10px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                              <Flame size={8} />ULTRA HOT
                            </span>
                          )}
                          {heat.is_hot && !heat.is_ultra_hot && (
                            <span className="bg-orange-500/20 border border-orange-500/30 text-orange-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">HOT</span>
                          )}
                          {heat.cross_platform && (
                            <span className="bg-blue-500/20 border border-blue-500/30 text-blue-300 text-[10px] px-1.5 py-0.5 rounded-full">CROSS-PLATFORM</span>
                          )}
                        </div>
                        {/* Announced on — inline channel chips */}
                        {heatSources.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap mb-1">
                            <span className="text-slate-600 text-[9px]">announced on:</span>
                            {heatSources.map(ch => <ChannelChip key={ch.id} ch={ch} />)}
                          </div>
                        )}
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1"><Hash size={9} className="text-blue-400" />{heat.channel_count}</span>
                          <span className="flex items-center gap-1"><Users size={9} className="text-purple-400" />{heat.community_count}</span>
                          <span className="flex items-center gap-1"><Twitter size={9} className="text-sky-400" />{heat.twitter_count}</span>
                          <span>{heat.total_mentions} mentions</span>
                          <span>{formatTimeAgo(heat.last_seen_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-xl border
                          ${heat.heat_score >= 100 ? 'bg-red-500/20 border-red-500/30 text-red-300'
                            : heat.heat_score >= 70 ? 'bg-orange-500/20 border-orange-500/30 text-orange-300'
                            : heat.heat_score >= 40 ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300'
                            : 'bg-slate-700/50 border-slate-600/30 text-slate-400'}`}>
                          <Flame size={11} />
                          {heat.heat_score}
                        </div>
                        <ChevronDown size={15} className={`text-slate-600 transition-transform ${expanded === `heat-${heat.id}` ? 'rotate-180' : ''}`} />
                      </div>
                    </div>
                    {expanded === `heat-${heat.id}` && (
                      <div className="px-5 pb-4 border-t border-slate-800 pt-4 space-y-3">
                        {heat.contract_address && (
                          <div className="flex items-center gap-3 bg-slate-800/50 rounded-xl px-4 py-2.5 border border-slate-700/30">
                            <div className="flex-1">
                              <div className="text-slate-500 text-[10px] mb-0.5">Contract Address</div>
                              <code className="text-slate-300 text-xs font-mono">{heat.contract_address}</code>
                            </div>
                            <button onClick={() => copyCA(heat.contract_address!, `heat-${heat.id}`)}>
                              {copied === `heat-${heat.id}` ? <CheckCheck size={13} className="text-emerald-400" /> : <Copy size={13} className="text-slate-500 hover:text-slate-200" />}
                            </button>
                            <a href={`https://dexscreener.com/search?q=${heat.contract_address}`} target="_blank" rel="noopener noreferrer"
                              className="text-slate-500 hover:text-blue-400 transition-colors">
                              <ExternalLink size={13} />
                            </a>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <button onClick={() => addHeatToWatchlist(heat)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs font-semibold hover:bg-yellow-500/20 transition-all">
                            <Star size={11} /> Add to Watchlist
                          </button>
                          <div className="text-slate-600 text-xs">First seen: {formatTimeAgo(heat.first_seen_at)}</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Signal Feed view */}
      {viewMode === 'signals' && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={15} className="text-yellow-400" />
              <span className="text-slate-400 text-sm">
                <span className="text-white font-semibold">{filteredSignals.length}</span> signals found
              </span>
            </div>
            <span className="text-slate-600 text-xs">{signals.length} total</span>
          </div>

          {filteredSignals.length === 0 ? (
            <div className="bg-slate-900 border border-slate-700/50 rounded-2xl flex flex-col items-center justify-center py-16 gap-3">
              <Zap size={32} className="text-slate-700" />
              <p className="text-slate-400 text-sm">No signals match your filters</p>
              <button onClick={() => { setSearch(''); setShowNewOnly(false); setSelectedChannel('all'); }}
                className="text-blue-400 text-xs hover:text-blue-300">Clear filters</button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSignals.map(signal => {
                const heat = heatCoins.find(h => h.coin_ticker === signal.coin_ticker);
                const allSources = coinSourceChannels.get(signal.coin_ticker) ?? [];
                const isExp = expanded === signal.id;
                return (
                  <div key={signal.id} className="bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden hover:border-slate-600/50 transition-all">
                    <div className="flex items-center gap-4 px-5 py-4 cursor-pointer"
                      onClick={() => setExpanded(isExp ? null : signal.id)}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {signal.coin_ticker.replace(/\$/g, '').slice(0, 3)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-white font-bold">{signal.coin_ticker}</span>
                          <span className="text-slate-500 text-sm">{signal.coin_name}</span>
                          {signal.is_new_listing && (
                            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded-full">NEW</span>
                          )}
                          {heat && heat.is_ultra_hot && (
                            <span className="bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                              <Flame size={8} />ULTRA HOT
                            </span>
                          )}
                        </div>
                        {/* All channels this coin was announced on */}
                        {allSources.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap mb-1">
                            <span className="text-slate-600 text-[9px]">announced on:</span>
                            {allSources.map(ch => <ChannelChip key={ch.id} ch={ch} />)}
                          </div>
                        )}
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span>{formatTimeAgo(signal.detected_at)}</span>
                          <span>{signal.cross_source_count} source{signal.cross_source_count > 1 ? 's' : ''}</span>
                          {heat && (
                            <span className="flex items-center gap-0.5 text-orange-400">
                              <Flame size={9} />{heat.heat_score}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border ${getConfidenceBg(signal.confidence_score)}`}>
                          {signal.confidence_score}%
                        </div>
                        <ChevronDown size={15} className={`text-slate-600 transition-transform ${isExp ? 'rotate-180' : ''}`} />
                      </div>
                    </div>
                    {isExp && (
                      <div className="px-5 pb-4 border-t border-slate-800 pt-4 space-y-3">
                        {signal.message_preview && (
                          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/30">
                            <div className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider mb-1">Message Preview</div>
                            <p className="text-slate-300 text-sm leading-relaxed">{signal.message_preview}</p>
                          </div>
                        )}
                        {signal.contract_address && (
                          <div className="flex items-center gap-3 bg-slate-800/50 rounded-xl px-4 py-2.5 border border-slate-700/30">
                            <div className="flex-1">
                              <div className="text-slate-500 text-[10px] mb-0.5">Contract Address</div>
                              <code className="text-slate-300 text-xs font-mono">{signal.contract_address}</code>
                            </div>
                            <button onClick={() => copyCA(signal.contract_address!, `sig-${signal.id}`)}>
                              {copied === `sig-${signal.id}` ? <CheckCheck size={13} className="text-emerald-400" /> : <Copy size={13} className="text-slate-500 hover:text-slate-200" />}
                            </button>
                            <a href={`https://dexscreener.com/search?q=${signal.contract_address}`} target="_blank" rel="noopener noreferrer"
                              className="text-slate-500 hover:text-blue-400 transition-colors">
                              <ExternalLink size={13} />
                            </a>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <button onClick={() => addToWatchlist(signal)} disabled={addingToWatchlist === signal.id}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs font-semibold hover:bg-yellow-500/20 transition-all disabled:opacity-50">
                            <Star size={11} />
                            {addingToWatchlist === signal.id ? 'Adding...' : 'Add to Watchlist'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
