import { useState, useMemo } from 'react';
import {
  Brain, Clock, Flame, TrendingUp, Users, Hash, Twitter,
  Copy, CheckCheck, ExternalLink, ChevronDown, Star, Zap,
  Target, ArrowUpRight, AlertTriangle, CheckCircle, XCircle,
  Activity, Radio,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { formatTimeAgo } from '../lib/utils';
import type { UpcomingCoin, Prediction, PromoterPattern } from '../lib/database.types';
import type { Page } from '../lib/utils';

interface IntelligenceProps {
  onNavigate: (page: Page) => void;
}

function ConfidenceBar({ score }: { score: number }) {
  const color = score >= 80 ? 'from-emerald-500 to-green-400' : score >= 60 ? 'from-yellow-500 to-orange-400' : 'from-blue-500 to-cyan-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-700`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-bold w-9 text-right ${score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-yellow-400' : 'text-blue-400'}`}>{score}%</span>
    </div>
  );
}

function LaunchStatusBadge({ status }: { status: UpcomingCoin['status'] }) {
  const configs = {
    upcoming: { label: 'Upcoming', cls: 'bg-blue-500/20 text-blue-300 border-blue-500/30', icon: <Clock size={10} /> },
    launched: { label: 'Launched', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', icon: <CheckCircle size={10} /> },
    pumping: { label: 'Pumping', cls: 'bg-orange-500/20 text-orange-300 border-orange-500/30', icon: <TrendingUp size={10} /> },
    cancelled: { label: 'Cancelled', cls: 'bg-slate-600/20 text-slate-500 border-slate-600/30', icon: <XCircle size={10} /> },
  };
  const c = configs[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${c.cls}`}>
      {c.icon}{c.label}
    </span>
  );
}

function PredictionStatusBadge({ status }: { status: Prediction['status'] }) {
  const configs = {
    active: { label: 'Active', cls: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
    confirmed: { label: 'Confirmed', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    expired: { label: 'Expired', cls: 'bg-slate-600/20 text-slate-500 border-slate-600/30' },
    wrong: { label: 'Wrong', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  };
  const c = configs[status];
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${c.cls}`}>{c.label}</span>;
}

export default function Intelligence({ onNavigate }: IntelligenceProps) {
  const { upcomingCoins, predictions, promoterPatterns, channels, markPredictionRead, refetchIntelligence } = useApp();
  const [tab, setTab] = useState<'upcoming' | 'predictions' | 'clusters'>('upcoming');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [addingWatchlist, setAddingWatchlist] = useState<string | null>(null);

  function copyCA(ca: string, id: string) {
    navigator.clipboard.writeText(ca);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  async function addToWatchlist(ticker: string, name: string, ca: string | null, source: string) {
    setAddingWatchlist(ticker);
    await supabase.from('watchlist').upsert({
      coin_name: name,
      coin_ticker: ticker,
      contract_address: ca,
      notes: source,
      alert_threshold: 2,
    }, { onConflict: 'coin_ticker' });
    setAddingWatchlist(null);
  }

  async function updatePredictionStatus(id: string, status: Prediction['status']) {
    await supabase.from('predictions').update({ status }).eq('id', id);
    await refetchIntelligence();
  }

  async function updatePatternOutcome(id: string, outcome: PromoterPattern['outcome']) {
    await supabase.from('promoter_patterns').update({ outcome }).eq('id', id);
    await refetchIntelligence();
  }

  // Group promoter patterns by fingerprint
  const promoterClusters = useMemo(() => {
    const map = new Map<string, { fingerprint: string; patterns: PromoterPattern[]; channelNames: string[] }>();
    for (const p of promoterPatterns) {
      if (!map.has(p.pattern_fingerprint)) {
        map.set(p.pattern_fingerprint, { fingerprint: p.pattern_fingerprint, patterns: [], channelNames: p.channel_names });
      }
      map.get(p.pattern_fingerprint)!.patterns.push(p);
    }
    return Array.from(map.values()).sort((a, b) => b.patterns.length - a.patterns.length);
  }, [promoterPatterns]);

  const activePredictions = predictions.filter(p => p.status === 'active');
  const activeUpcoming = upcomingCoins.filter(c => c.status === 'upcoming');
  const crossPlatformUpcoming = activeUpcoming.filter(c => c.is_cross_platform);

  return (
    <div className="p-6 space-y-6">

      {/* Hero stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Upcoming Coins', value: activeUpcoming.length, sub: `${crossPlatformUpcoming.length} cross-platform`, icon: <Clock size={18} />, color: 'from-blue-500 to-cyan-500', border: 'border-blue-500/20 bg-blue-500/5' },
          { label: 'Active Predictions', value: activePredictions.length, sub: `${activePredictions.filter(p => p.confidence_score >= 70).length} high confidence`, icon: <Brain size={18} />, color: 'from-purple-500 to-violet-600', border: 'border-purple-500/20 bg-purple-500/5' },
          { label: 'Promoter Clusters', value: promoterClusters.length, sub: `${promoterClusters.filter(c => c.patterns.length >= 3).length} recurring`, icon: <Users size={18} />, color: 'from-orange-500 to-amber-500', border: 'border-orange-500/20 bg-orange-500/5' },
          { label: 'Pattern Matches', value: promoterPatterns.length, sub: 'total co-promotions', icon: <Activity size={18} />, color: 'from-emerald-500 to-teal-500', border: 'border-emerald-500/20 bg-emerald-500/5' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border p-5 ${s.border}`}>
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-white shadow-lg`}>{s.icon}</div>
            </div>
            <div className="text-3xl font-bold text-white">{s.value}</div>
            <div className="text-white/80 text-sm mt-0.5">{s.label}</div>
            <div className="text-slate-500 text-xs mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Cross-platform alert banner */}
      {crossPlatformUpcoming.length > 0 && (
        <div className="bg-gradient-to-r from-purple-950/60 to-blue-950/60 border border-purple-500/40 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Brain size={16} className="text-purple-400" />
            <span className="text-purple-300 font-black text-sm uppercase tracking-wide">Cross-Platform Pre-Launch Detected</span>
            <span className="bg-purple-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{crossPlatformUpcoming.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {crossPlatformUpcoming.slice(0, 3).map(coin => (
              <div key={coin.id} className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-white font-bold">{coin.coin_ticker}</span>
                  <span className="text-purple-300 text-xs">{coin.coin_name}</span>
                  <span className="ml-auto text-[9px] bg-purple-500/20 border border-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded-full font-bold">TG + X</span>
                </div>
                <div className="text-slate-400 text-xs mb-2">{coin.pre_launch_mentions} pre-launch mentions · {coin.source_channel_ids.length} sources</div>
                <ConfidenceBar score={coin.launch_confidence} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/50 rounded-xl p-1 w-fit">
        {([
          { id: 'upcoming', label: 'Upcoming Coins', count: activeUpcoming.length },
          { id: 'predictions', label: 'AI Predictions', count: activePredictions.length },
          { id: 'clusters', label: 'Promoter Clusters', count: promoterClusters.length },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${tab === t.id ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>
            {t.label}
            {t.count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${tab === t.id ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-400'}`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── UPCOMING COINS TAB ───────────────────────────────────────────────── */}
      {tab === 'upcoming' && (
        <div className="space-y-4">
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 flex items-start gap-3">
            <Clock size={15} className="text-blue-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-blue-300 font-semibold text-sm">How upcoming coins are detected</p>
              <p className="text-slate-400 text-xs leading-relaxed mt-1">
                MemeRadar scans every message for pre-launch keywords ("launching in X hours", "stealth launch", "fair launch", "countdown", etc.) and timestamps expected launch windows. Coins without a CA yet are still tracked — the CA gets added automatically when it drops in the channels.
              </p>
            </div>
          </div>

          {upcomingCoins.length === 0 ? (
            <div className="bg-slate-900 border border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center py-16 gap-3">
              <Clock size={36} className="text-slate-700" />
              <p className="text-slate-500 text-sm">No upcoming coins detected yet</p>
              <p className="text-slate-600 text-xs">Run a scan — pre-launch messages will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingCoins.map(coin => {
                const isExp = expanded === coin.id;
                const channelNames = channels.filter(c => coin.source_channel_ids.includes(c.id)).map(c => c.name);
                return (
                  <div key={coin.id} className={`bg-slate-900 border rounded-2xl overflow-hidden transition-all hover:border-slate-600/50
                    ${coin.status === 'upcoming' && coin.is_cross_platform ? 'border-purple-500/30' : coin.status === 'upcoming' ? 'border-blue-500/20' : coin.status === 'launched' ? 'border-emerald-500/20' : 'border-slate-700/50'}`}>
                    <div className="flex items-center gap-4 px-5 py-4 cursor-pointer" onClick={() => setExpanded(isExp ? null : coin.id)}>
                      {/* Icon */}
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold shrink-0
                        ${coin.status === 'upcoming' ? 'bg-gradient-to-br from-blue-600 to-cyan-600' : coin.status === 'launched' ? 'bg-gradient-to-br from-emerald-600 to-teal-600' : 'bg-slate-700'}`}>
                        <Clock size={20} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-white font-bold">{coin.coin_ticker}</span>
                          <span className="text-slate-400 text-sm">{coin.coin_name}</span>
                          <LaunchStatusBadge status={coin.status} />
                          {coin.is_cross_platform && (
                            <span className="text-[9px] bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded-full font-bold">TG + TWITTER</span>
                          )}
                        </div>
                        {/* Announced on — always visible, no expand needed */}
                        {channels.filter(c => coin.source_channel_ids.includes(c.id)).length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap mb-1">
                            <span className="text-slate-600 text-[9px]">announced on:</span>
                            {channels.filter(c => coin.source_channel_ids.includes(c.id)).map(ch => (
                              <span key={ch.id} className="inline-flex items-center gap-1 bg-slate-800 border border-slate-700/60 rounded-md px-1.5 py-0.5 text-[10px] text-slate-300 whitespace-nowrap">
                                <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: ch.avatar_color }} />
                                {ch.name}
                                {ch.type === 'twitter' ? <Twitter size={8} className="text-sky-400" /> : ch.channel_category === 'community' ? <Users size={8} className="text-purple-400" /> : <Hash size={8} className="text-blue-400" />}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                          <span className="flex items-center gap-1"><Radio size={10} />{coin.source_channel_ids.length} source{coin.source_channel_ids.length !== 1 ? 's' : ''}</span>
                          <span className="flex items-center gap-1"><Zap size={10} />{coin.pre_launch_mentions} pre-launch mentions</span>
                          {coin.expected_launch_at && (
                            <span className="flex items-center gap-1 text-orange-400">
                              <Clock size={10} />
                              {new Date(coin.expected_launch_at) > new Date()
                                ? `Est. launch: ${formatTimeAgo(coin.expected_launch_at)} from now`
                                : `Launch was ${formatTimeAgo(coin.expected_launch_at)} ago`}
                            </span>
                          )}
                          <span className="text-slate-600">First seen {formatTimeAgo(coin.first_mentioned_at)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className="text-slate-500 text-[10px] mb-1">Launch confidence</div>
                          <ConfidenceBar score={coin.launch_confidence} />
                        </div>
                        <ChevronDown size={15} className={`text-slate-600 transition-transform ${isExp ? 'rotate-180' : ''}`} />
                      </div>
                    </div>

                    {isExp && (
                      <div className="px-5 pb-5 border-t border-slate-800 pt-4 space-y-4">
                        {/* Sources */}
                        <div>
                          <div className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider mb-2">Detected In</div>
                          <div className="flex flex-wrap gap-2">
                            {channels.filter(c => coin.source_channel_ids.includes(c.id)).map(ch => (
                              <div key={ch.id} className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5">
                                <div className="w-4 h-4 rounded flex items-center justify-center text-white text-[9px] font-bold" style={{ backgroundColor: ch.avatar_color }}>
                                  {ch.name.charAt(0)}
                                </div>
                                <span className="text-slate-300 text-xs">{ch.name}</span>
                                {ch.type === 'twitter' ? <Twitter size={9} className="text-sky-400" /> : ch.channel_category === 'community' ? <Users size={9} className="text-purple-400" /> : <Hash size={9} className="text-blue-400" />}
                              </div>
                            ))}
                            {coin.source_channel_ids.length > channels.filter(c => coin.source_channel_ids.includes(c.id)).length && (
                              <span className="text-slate-600 text-xs py-1">+{coin.source_channel_ids.length - channels.filter(c => coin.source_channel_ids.includes(c.id)).length} more</span>
                            )}
                          </div>
                        </div>

                        {/* Teasers */}
                        {coin.raw_teasers.length > 0 && (
                          <div>
                            <div className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider mb-2">Message Teasers</div>
                            <div className="space-y-2">
                              {coin.raw_teasers.slice(0, 2).map((t, i) => (
                                <div key={i} className="bg-slate-800/60 border border-slate-700/30 rounded-xl px-4 py-3">
                                  <p className="text-slate-300 text-xs leading-relaxed">{t}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* CA if known */}
                        {coin.contract_address && (
                          <div className="flex items-center gap-3 bg-slate-800/50 rounded-xl px-4 py-2.5 border border-slate-700/30">
                            <div className="flex-1 min-w-0">
                              <div className="text-slate-500 text-[10px] mb-0.5">Contract Address</div>
                              <code className="text-slate-300 text-xs font-mono truncate block">{coin.contract_address}</code>
                            </div>
                            <button onClick={() => copyCA(coin.contract_address!, coin.id)}>
                              {copied === coin.id ? <CheckCheck size={13} className="text-emerald-400" /> : <Copy size={13} className="text-slate-500 hover:text-slate-200" />}
                            </button>
                            <a href={`https://dexscreener.com/search?q=${coin.contract_address}`} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-blue-400">
                              <ExternalLink size={13} />
                            </a>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <button onClick={() => addToWatchlist(coin.coin_ticker, coin.coin_name, coin.contract_address, `Pre-launch detected. Confidence: ${coin.launch_confidence}%`)}
                            disabled={addingWatchlist === coin.coin_ticker}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs font-semibold hover:bg-yellow-500/20 transition-all disabled:opacity-50">
                            <Star size={11} />{addingWatchlist === coin.coin_ticker ? 'Adding...' : 'Add to Watchlist'}
                          </button>
                          {coin.status === 'upcoming' && (
                            <button onClick={async () => { await supabase.from('upcoming_coins').update({ status: 'launched' }).eq('id', coin.id); await refetchIntelligence(); }}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/20 transition-all">
                              <CheckCircle size={11} />Mark Launched
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── PREDICTIONS TAB ─────────────────────────────────────────────────── */}
      {tab === 'predictions' && (
        <div className="space-y-4">
          <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-4 flex items-start gap-3">
            <Brain size={15} className="text-purple-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-purple-300 font-semibold text-sm">How predictions work</p>
              <p className="text-slate-400 text-xs leading-relaxed mt-1">
                MemeRadar builds a fingerprint of each promoter cluster — the set of channels that promote coins together. When the same cluster appears 2 or more times historically and fires again on a new coin, a prediction is generated with a confidence score based on cluster size, cross-platform presence, and historical accuracy.
              </p>
            </div>
          </div>

          {predictions.length === 0 ? (
            <div className="bg-slate-900 border border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center py-16 gap-3">
              <Brain size={36} className="text-slate-700" />
              <p className="text-slate-500 text-sm">No predictions yet</p>
              <p className="text-slate-600 text-xs text-center max-w-xs">Run multiple scans over time. Once the same promoter cluster fires 2+ times on different coins, MemeRadar will start predicting the next one.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {predictions.map(pred => {
                const isExp = expanded === `pred-${pred.id}`;
                return (
                  <div key={pred.id} onClick={() => { markPredictionRead(pred.id); setExpanded(isExp ? null : `pred-${pred.id}`); }}
                    className={`bg-slate-900 border rounded-2xl overflow-hidden cursor-pointer transition-all hover:border-slate-600/50
                      ${pred.confidence_score >= 80 ? 'border-emerald-500/30' : pred.confidence_score >= 60 ? 'border-yellow-500/20' : 'border-slate-700/50'}
                      ${!pred.is_read ? 'bg-purple-500/3' : ''}`}>

                    {/* Confidence bar at top */}
                    <div className={`h-1 ${pred.confidence_score >= 80 ? 'bg-gradient-to-r from-emerald-500 to-green-400' : pred.confidence_score >= 60 ? 'bg-gradient-to-r from-yellow-500 to-orange-400' : 'bg-gradient-to-r from-blue-500 to-cyan-400'}`}
                      style={{ width: `${pred.confidence_score}%` }} />

                    <div className="flex items-center gap-4 px-5 py-4">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold shrink-0
                        ${pred.confidence_score >= 80 ? 'bg-gradient-to-br from-emerald-600 to-green-700' : 'bg-gradient-to-br from-purple-600 to-violet-700'}`}>
                        <Target size={20} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-white font-bold">{pred.prediction_ticker}</span>
                          <span className="text-slate-400 text-sm">{pred.prediction_name}</span>
                          <PredictionStatusBadge status={pred.status} />
                          {!pred.is_read && <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                          <span>Launch: <span className="text-blue-400">{pred.expected_launch_window}</span></span>
                          <span>{pred.matching_channel_names.length} matching sources</span>
                          <span>{formatTimeAgo(pred.predicted_at)}</span>
                        </div>
                      </div>

                      <div className="shrink-0 w-28">
                        <div className="text-slate-500 text-[10px] mb-1 text-right">Confidence</div>
                        <ConfidenceBar score={pred.confidence_score} />
                      </div>

                      <ChevronDown size={15} className={`text-slate-600 shrink-0 transition-transform ${isExp ? 'rotate-180' : ''}`} />
                    </div>

                    {isExp && (
                      <div className="px-5 pb-5 border-t border-slate-800 pt-4 space-y-4" onClick={e => e.stopPropagation()}>
                        {/* Reasoning */}
                        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30">
                          <div className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider mb-2">Analysis</div>
                          <p className="text-slate-300 text-sm leading-relaxed">{pred.reasoning}</p>
                        </div>

                        {/* Matching channels */}
                        {pred.matching_channel_names.length > 0 && (
                          <div>
                            <div className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider mb-2">Cluster Members</div>
                            <div className="flex flex-wrap gap-2">
                              {pred.matching_channel_names.map(name => {
                                const ch = channels.find(c => c.name === name);
                                return (
                                  <div key={name} className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5">
                                    {ch && <div className="w-3.5 h-3.5 rounded flex items-center justify-center text-white text-[8px] font-bold" style={{ backgroundColor: ch.avatar_color }}>{ch.name.charAt(0)}</div>}
                                    <span className="text-slate-300 text-xs">{name}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {pred.prediction_ca && (
                          <div className="flex items-center gap-3 bg-slate-800/50 rounded-xl px-4 py-2.5 border border-slate-700/30">
                            <div className="flex-1 min-w-0">
                              <div className="text-slate-500 text-[10px] mb-0.5">Contract Address</div>
                              <code className="text-slate-300 text-xs font-mono truncate block">{pred.prediction_ca}</code>
                            </div>
                            <button onClick={() => copyCA(pred.prediction_ca!, `pred-${pred.id}`)}>
                              {copied === `pred-${pred.id}` ? <CheckCheck size={13} className="text-emerald-400" /> : <Copy size={13} className="text-slate-500 hover:text-slate-200" />}
                            </button>
                            <a href={`https://dexscreener.com/search?q=${pred.prediction_ca}`} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-blue-400">
                              <ExternalLink size={13} />
                            </a>
                          </div>
                        )}

                        <div className="flex items-center gap-2 flex-wrap">
                          <button onClick={() => addToWatchlist(pred.prediction_ticker, pred.prediction_name, pred.prediction_ca, `AI Prediction: ${pred.confidence_score}% confidence`)}
                            disabled={addingWatchlist === pred.prediction_ticker}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs font-semibold hover:bg-yellow-500/20 transition-all disabled:opacity-50">
                            <Star size={11} />{addingWatchlist === pred.prediction_ticker ? 'Adding...' : 'Add to Watchlist'}
                          </button>
                          <button onClick={() => updatePredictionStatus(pred.id, 'confirmed')}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/20 transition-all">
                            <CheckCircle size={11} />Confirmed
                          </button>
                          <button onClick={() => updatePredictionStatus(pred.id, 'wrong')}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-all">
                            <XCircle size={11} />Wrong
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── PROMOTER CLUSTERS TAB ───────────────────────────────────────────── */}
      {tab === 'clusters' && (
        <div className="space-y-4">
          <div className="bg-orange-500/5 border border-orange-500/20 rounded-2xl p-4 flex items-start gap-3">
            <Users size={15} className="text-orange-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-orange-300 font-semibold text-sm">Promoter cluster analysis</p>
              <p className="text-slate-400 text-xs leading-relaxed mt-1">
                Every time 2 or more of your sources promote the same coin, a cluster event is recorded. Clusters that repeat across multiple coins are the most valuable — they reveal coordinated pump groups. The more times a cluster fires, the more reliable the next prediction from that cluster.
              </p>
            </div>
          </div>

          {promoterClusters.length === 0 ? (
            <div className="bg-slate-900 border border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center py-16 gap-3">
              <Users size={36} className="text-slate-700" />
              <p className="text-slate-500 text-sm">No promoter clusters yet</p>
              <p className="text-slate-600 text-xs text-center max-w-xs">Clusters form when 2+ of your channels promote the same coin. Run more scans across multiple channels to build pattern history.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {promoterClusters.map(cluster => {
                const isExp = expanded === `cluster-${cluster.fingerprint}`;
                const latestPattern = cluster.patterns[0];
                const pumpedCount = cluster.patterns.filter(p => p.outcome === 'pumped').length;
                const successRate = cluster.patterns.length > 0 ? Math.round((pumpedCount / cluster.patterns.length) * 100) : 0;
                const clusterChannels = channels.filter(c => cluster.patterns[0].channel_ids.includes(c.id));

                return (
                  <div key={cluster.fingerprint} className={`bg-slate-900 border rounded-2xl overflow-hidden transition-all hover:border-slate-600/50
                    ${cluster.patterns.length >= 3 ? 'border-orange-500/30' : 'border-slate-700/50'}`}>
                    <div className="flex items-center gap-4 px-5 py-4 cursor-pointer" onClick={() => setExpanded(isExp ? null : `cluster-${cluster.fingerprint}`)}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0
                        ${cluster.patterns.length >= 4 ? 'bg-gradient-to-br from-red-500 to-orange-600' : cluster.patterns.length >= 2 ? 'bg-gradient-to-br from-orange-500 to-amber-600' : 'bg-slate-700'}`}>
                        {cluster.patterns.length}x
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {cluster.channelNames.slice(0, 3).map(name => (
                            <span key={name} className="text-white text-xs font-semibold bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-lg">{name}</span>
                          ))}
                          {cluster.channelNames.length > 3 && (
                            <span className="text-slate-500 text-xs">+{cluster.channelNames.length - 3} more</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span>{cluster.patterns.length} co-promotion event{cluster.patterns.length !== 1 ? 's' : ''}</span>
                          {pumpedCount > 0 && <span className="text-emerald-400">{pumpedCount} confirmed pumps</span>}
                          <span>Last: {formatTimeAgo(latestPattern.created_at)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {cluster.patterns.length >= 2 && (
                          <div className="text-right">
                            <div className="text-slate-500 text-[10px] mb-1">Cluster strength</div>
                            <ConfidenceBar score={Math.min(95, cluster.patterns.length * 20 + (successRate ?? 0) / 4)} />
                          </div>
                        )}
                        <ChevronDown size={15} className={`text-slate-600 transition-transform ${isExp ? 'rotate-180' : ''}`} />
                      </div>
                    </div>

                    {isExp && (
                      <div className="px-5 pb-5 border-t border-slate-800 pt-4 space-y-4">
                        {/* Channel breakdown */}
                        <div>
                          <div className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider mb-2">Cluster Members</div>
                          <div className="flex flex-wrap gap-2">
                            {clusterChannels.map(ch => (
                              <div key={ch.id} className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5">
                                <div className="w-4 h-4 rounded flex items-center justify-center text-white text-[9px] font-bold" style={{ backgroundColor: ch.avatar_color }}>
                                  {ch.name.charAt(0)}
                                </div>
                                <span className="text-slate-300 text-xs">{ch.name}</span>
                                {ch.type === 'twitter' ? <Twitter size={9} className="text-sky-400" /> : ch.channel_category === 'community' ? <Users size={9} className="text-purple-400" /> : <Hash size={9} className="text-blue-400" />}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Historical coins promoted */}
                        <div>
                          <div className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider mb-2">Coins Promoted Together</div>
                          <div className="space-y-2">
                            {cluster.patterns.map(p => (
                              <div key={p.id} className="flex items-center gap-3 bg-slate-800/40 rounded-xl px-4 py-2.5 border border-slate-700/30">
                                <span className="text-white text-sm font-bold w-24 shrink-0">{p.coin_ticker}</span>
                                <span className="text-slate-500 text-xs flex-1 truncate">{p.coin_name}</span>
                                <span className="text-slate-600 text-[10px]">{formatTimeAgo(p.created_at)}</span>
                                <div className="flex items-center gap-1">
                                  {(['pending', 'pumped', 'flat', 'rugged'] as const).map(outcome => (
                                    <button key={outcome} onClick={() => updatePatternOutcome(p.id, outcome)}
                                      className={`text-[9px] px-1.5 py-0.5 rounded border font-bold transition-all ${p.outcome === outcome
                                        ? outcome === 'pumped' ? 'bg-emerald-500/30 border-emerald-500/50 text-emerald-300'
                                          : outcome === 'rugged' ? 'bg-red-500/30 border-red-500/50 text-red-300'
                                          : outcome === 'flat' ? 'bg-slate-500/30 border-slate-500/50 text-slate-300'
                                          : 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400'
                                        : 'bg-transparent border-slate-700 text-slate-600 hover:border-slate-500'}`}>
                                      {outcome}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
