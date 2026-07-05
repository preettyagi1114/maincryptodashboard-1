import { useMemo, useState } from 'react';
import {
  Flame, Zap, Bell, ArrowUpRight, Activity,
  Copy, CheckCheck, ExternalLink, Twitter, Hash, Users, Wifi,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatTimeAgo } from '../lib/utils';
import type { Page } from '../lib/utils';
import type { CoinHeat, Channel } from '../lib/database.types';

interface DashboardProps {
  onNavigate: (page: Page) => void;
}

function ChannelChip({ ch }: { ch: Channel }) {
  return (
    <span className="inline-flex items-center gap-1 bg-slate-800 border border-slate-700/60 rounded-md px-1.5 py-0.5 text-[10px] text-slate-300 whitespace-nowrap">
      <span
        className="w-2.5 h-2.5 rounded-sm shrink-0"
        style={{ backgroundColor: ch.avatar_color }}
      />
      {ch.name}
      {ch.type === 'twitter'
        ? <Twitter size={8} className="text-sky-400 shrink-0" />
        : ch.channel_category === 'community'
          ? <Users size={8} className="text-purple-400 shrink-0" />
          : <Hash size={8} className="text-blue-400 shrink-0" />}
    </span>
  );
}

function HeatBadge({ score }: { score: number }) {
  if (score >= 100) return (
    <div className="flex items-center gap-1 bg-red-500/20 border border-red-500/40 rounded-lg px-2 py-0.5">
      <Flame size={10} className="text-red-400 animate-pulse" />
      <span className="text-red-300 text-[10px] font-black">ULTRA HOT {score}</span>
    </div>
  );
  if (score >= 70) return (
    <div className="flex items-center gap-1 bg-orange-500/20 border border-orange-500/40 rounded-lg px-2 py-0.5">
      <Flame size={10} className="text-orange-400" />
      <span className="text-orange-300 text-[10px] font-bold">HOT {score}</span>
    </div>
  );
  if (score >= 40) return (
    <div className="flex items-center gap-1 bg-yellow-500/20 border border-yellow-500/40 rounded-lg px-2 py-0.5">
      <Activity size={10} className="text-yellow-400" />
      <span className="text-yellow-300 text-[10px] font-bold">{score}</span>
    </div>
  );
  return (
    <div className="flex items-center gap-1 bg-slate-700/50 border border-slate-600/40 rounded-lg px-2 py-0.5">
      <Activity size={10} className="text-slate-500" />
      <span className="text-slate-400 text-[10px]">{score}</span>
    </div>
  );
}

function CoinHeatCard({ coin, rank, onCopy, copied, sourceChannels }: {
  coin: CoinHeat;
  rank: number;
  onCopy: (ca: string, id: string) => void;
  copied: string | null;
  sourceChannels: Channel[];
}) {
  const rankColor = rank === 1
    ? 'text-yellow-300 bg-yellow-500/20 border-yellow-500/30'
    : rank === 2
    ? 'text-slate-300 bg-slate-500/20 border-slate-500/30'
    : rank === 3
    ? 'text-orange-400 bg-orange-500/20 border-orange-500/30'
    : 'text-slate-500 bg-slate-700/20 border-slate-700/30';

  return (
    <div className={`bg-slate-900 border rounded-2xl p-4 transition-all hover:border-slate-600/50 flex flex-col gap-3
      ${coin.is_ultra_hot ? 'border-red-500/30 bg-red-950/10' : coin.is_hot ? 'border-orange-500/20' : 'border-slate-700/50'}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-lg border text-xs font-black flex items-center justify-center shrink-0 ${rankColor}`}>
            #{rank}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-white font-bold">{coin.coin_ticker}</span>
              {coin.is_ultra_hot && <Flame size={12} className="text-red-400 animate-pulse" />}
            </div>
            <div className="text-slate-500 text-[10px]">{coin.coin_name}</div>
          </div>
        </div>
        <HeatBadge score={coin.heat_score} />
      </div>

      {sourceChannels.length > 0 && (
        <div>
          <div className="text-slate-600 text-[9px] font-semibold uppercase tracking-wider mb-1">Announced on</div>
          <div className="flex flex-wrap gap-1">
            {sourceChannels.map(ch => <ChannelChip key={ch.id} ch={ch} />)}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-1.5">
        <div className="bg-slate-800/50 rounded-lg p-1.5 text-center border border-slate-700/30">
          <div className="flex items-center justify-center gap-0.5 mb-0.5">
            <Hash size={8} className="text-blue-400" />
            <span className="text-white text-xs font-bold">{coin.channel_count}</span>
          </div>
          <div className="text-slate-600 text-[8px]">Channels</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-1.5 text-center border border-slate-700/30">
          <div className="flex items-center justify-center gap-0.5 mb-0.5">
            <Users size={8} className="text-purple-400" />
            <span className="text-white text-xs font-bold">{coin.community_count}</span>
          </div>
          <div className="text-slate-600 text-[8px]">Communities</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-1.5 text-center border border-slate-700/30">
          <div className="flex items-center justify-center gap-0.5 mb-0.5">
            <Twitter size={8} className="text-sky-400" />
            <span className="text-white text-xs font-bold">{coin.twitter_count}</span>
          </div>
          <div className="text-slate-600 text-[8px]">Twitter</div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-slate-500 text-xs">
          <Zap size={9} className="text-yellow-400" />
          <span>{coin.total_mentions} mentions</span>
        </div>
        {coin.cross_platform && (
          <span className="text-[9px] bg-gradient-to-r from-blue-500/20 to-sky-500/20 border border-blue-500/30 text-blue-300 px-1.5 py-0.5 rounded-full font-bold">
            CROSS-PLATFORM
          </span>
        )}
      </div>

      {coin.contract_address && (
        <div className="flex items-center gap-1.5 bg-slate-800/40 rounded-lg px-2.5 py-1.5 border border-slate-700/30">
          <code className="text-slate-500 text-[9px] font-mono flex-1 truncate">
            {coin.contract_address.slice(0, 8)}...{coin.contract_address.slice(-6)}
          </code>
          <button onClick={() => onCopy(coin.contract_address!, coin.id)} className="text-slate-600 hover:text-emerald-400 transition-colors">
            {copied === coin.id ? <CheckCheck size={10} className="text-emerald-400" /> : <Copy size={10} />}
          </button>
          <a href={`https://dexscreener.com/search?q=${coin.contract_address}`} target="_blank" rel="noopener noreferrer"
            className="text-slate-600 hover:text-blue-400 transition-colors">
            <ExternalLink size={10} />
          </a>
        </div>
      )}

      <div className="text-slate-700 text-[9px]">Last seen {formatTimeAgo(coin.last_seen_at)}</div>
    </div>
  );
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { channels, signals, alerts, heatCoins, mentions, monitoring, lastScan, triggerMonitor } = useApp();
  const [copied, setCopied] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<{ alertsFired: number; uniqueCoins: number } | null>(null);

  const activeChannels = channels.filter(c => c.is_active);
  const unreadAlerts = alerts.filter(a => !a.is_read).length;

  const tgChannels = channels.filter(c => c.type === 'telegram' && c.channel_category === 'channel');
  const tgCommunities = channels.filter(c => c.type === 'telegram' && c.channel_category === 'community');
  const twitterAccounts = channels.filter(c => c.type === 'twitter');

  const hotCoins = heatCoins.filter(c => c.is_hot || c.heat_score >= 30).slice(0, 6);
  const ultraHotCoins = heatCoins.filter(c => c.is_ultra_hot);

  const mentions24h = mentions.filter(m => Date.now() - new Date(m.detected_at).getTime() < 86400000);
  const crossAlerts24h = alerts.filter(a =>
    a.alert_type === 'cross_source' && Date.now() - new Date(a.fired_at).getTime() < 86400000
  );

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

  function copyCA(ca: string, id: string) {
    navigator.clipboard.writeText(ca);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  async function handleMonitor() {
    const result = await triggerMonitor();
    setScanResult(result);
    setTimeout(() => setScanResult(null), 6000);
  }

  const channelSignalMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of mentions24h) {
      if (m.channel_id) map.set(m.channel_id, (map.get(m.channel_id) ?? 0) + 1);
    }
    return map;
  }, [mentions24h]);

  return (
    <div className="p-6 space-y-6">
      {/* Scan status bar */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700/50 rounded-2xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-3 h-3 rounded-full ${monitoring ? 'bg-yellow-400 animate-pulse' : activeChannels.length > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            <div>
              <div className="text-white font-bold text-sm">
                {monitoring ? 'Scanning channels...' : activeChannels.length > 0 ? '24/7 Monitoring Active' : 'No channels configured'}
              </div>
              <div className="text-slate-500 text-xs mt-0.5">
                {lastScan ? `Last scan: ${formatTimeAgo(lastScan)}` : 'Never scanned'} · {activeChannels.length} active sources
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {scanResult && (
              <div className="text-emerald-400 text-xs bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
                {scanResult.uniqueCoins} coins · {scanResult.alertsFired} alerts fired
              </div>
            )}
            <button onClick={handleMonitor} disabled={monitoring || activeChannels.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
              <Wifi size={15} className={monitoring ? 'animate-pulse' : ''} />
              {monitoring ? 'Scanning...' : 'Scan Now'}
            </button>
          </div>
        </div>
      </div>

      {/* Ultra hot banner */}
      {ultraHotCoins.length > 0 && (
        <div className="bg-gradient-to-r from-red-950/60 to-orange-950/60 border border-red-500/40 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Flame size={16} className="text-red-400 animate-pulse" />
            <span className="text-red-300 font-black text-sm uppercase tracking-wide">Ultra Hot Coins — Act Fast!</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {ultraHotCoins.map(coin => {
              const sources = coinSourceChannels.get(coin.coin_ticker) ?? [];
              return (
                <div key={coin.id} className="flex flex-col gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <Flame size={12} className="text-red-400 shrink-0" />
                    <span className="text-white font-bold text-sm">{coin.coin_ticker}</span>
                    <span className="text-red-300 text-xs font-semibold">{coin.heat_score} heat</span>
                    {coin.contract_address && (
                      <button onClick={() => copyCA(coin.contract_address!, `banner-${coin.id}`)}>
                        {copied === `banner-${coin.id}` ? <CheckCheck size={12} className="text-emerald-400" /> : <Copy size={12} className="text-slate-500 hover:text-slate-300" />}
                      </button>
                    )}
                  </div>
                  {sources.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      <span className="text-slate-600 text-[9px] self-center">on:</span>
                      {sources.map(ch => <ChannelChip key={ch.id} ch={ch} />)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'TG Channels', value: tgChannels.length, active: tgChannels.filter(c => c.is_active).length, icon: <Hash size={18} />, color: 'from-blue-500 to-blue-700', border: 'border-blue-500/20 bg-blue-500/5' },
          { label: 'TG Communities', value: tgCommunities.length, active: tgCommunities.filter(c => c.is_active).length, icon: <Users size={18} />, color: 'from-purple-500 to-purple-700', border: 'border-purple-500/20 bg-purple-500/5' },
          { label: 'Twitter / X', value: twitterAccounts.length, active: twitterAccounts.filter(c => c.is_active).length, icon: <Twitter size={18} />, color: 'from-sky-500 to-sky-700', border: 'border-sky-500/20 bg-sky-500/5' },
          { label: 'Unread Alerts', value: unreadAlerts, active: alerts.length, icon: <Bell size={18} />, color: 'from-red-500 to-red-700', border: 'border-red-500/20 bg-red-500/5' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border p-5 ${s.border}`}>
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-white shadow-lg`}>{s.icon}</div>
              <span className="text-slate-600 text-xs">{s.active} active</span>
            </div>
            <div className="text-3xl font-bold text-white">{s.value}</div>
            <div className="text-slate-400 text-sm mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 24h metrics */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Mentions Today', value: mentions24h.length, color: 'text-yellow-400' },
          { label: 'Unique Coins', value: new Set(mentions24h.map(m => m.coin_ticker)).size, color: 'text-cyan-400' },
          { label: 'Cross-Source Alerts', value: crossAlerts24h.length, color: 'text-orange-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-700/50 rounded-xl px-4 py-3 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-slate-500 text-xs mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Heat map */}
      <div className="bg-slate-900 rounded-2xl border border-slate-700/50 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <Flame size={18} className="text-orange-400" />
            <h2 className="text-white font-bold text-sm">Coin Heat Map</h2>
            <span className="text-slate-500 text-xs">/ cross-channel profit signals</span>
          </div>
          <button onClick={() => onNavigate('signals')} className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1">
            Full feed <ArrowUpRight size={12} />
          </button>
        </div>
        {hotCoins.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Flame size={32} className="text-slate-700" />
            <p className="text-slate-500 text-sm">No heat data yet — run a scan to detect coins</p>
            <button onClick={handleMonitor} disabled={monitoring || activeChannels.length === 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-xl transition-colors disabled:opacity-50">
              {activeChannels.length === 0 ? 'Add Channels First' : 'Run First Scan'}
            </button>
          </div>
        ) : (
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {hotCoins.map((coin, i) => (
              <CoinHeatCard
                key={coin.id}
                coin={coin}
                rank={i + 1}
                onCopy={copyCA}
                copied={copied}
                sourceChannels={coinSourceChannels.get(coin.coin_ticker) ?? []}
              />
            ))}
          </div>
        )}
      </div>

      {/* Platform breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {[
          { title: 'Telegram Channels', icon: <Hash size={15} className="text-blue-400" />, items: tgChannels },
          { title: 'TG Communities', icon: <Users size={15} className="text-purple-400" />, items: tgCommunities },
          { title: 'Twitter / X', icon: <Twitter size={15} className="text-sky-400" />, items: twitterAccounts },
        ].map(section => (
          <div key={section.title} className="bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3.5 border-b border-slate-700/50">
              {section.icon}
              <span className="text-white text-sm font-semibold">{section.title}</span>
              <span className="ml-auto bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded-full">{section.items.length}</span>
            </div>
            <div className="divide-y divide-slate-800/60">
              {section.items.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <button onClick={() => onNavigate('channels')} className="text-slate-600 text-xs hover:text-blue-400 transition-colors">
                    + Add {section.title.toLowerCase()}
                  </button>
                </div>
              ) : section.items.slice(0, 6).map(ch => {
                const mentionCount = channelSignalMap.get(ch.id) ?? 0;
                return (
                  <div key={ch.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/30 transition-colors">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: ch.avatar_color }}>
                      {ch.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-xs font-semibold truncate">{ch.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${ch.is_active && ch.monitoring_status === 'active' ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                        <span className="text-slate-600 text-[10px] truncate">@{ch.username}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-xs font-bold ${mentionCount > 0 ? 'text-yellow-400' : 'text-slate-600'}`}>{mentionCount}</div>
                      <div className="text-slate-700 text-[9px]">24h</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Recent alerts */}
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <Bell size={17} className="text-red-400" />
            <h2 className="text-white font-bold text-sm">Recent Alerts</h2>
          </div>
          <button onClick={() => onNavigate('alerts')} className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1">
            All alerts <ArrowUpRight size={12} />
          </button>
        </div>
        {alerts.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <p className="text-slate-600 text-sm">No alerts yet — run a scan</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {alerts.slice(0, 8).map(alert => (
              <div key={alert.id} className={`flex items-start gap-4 px-5 py-3.5 hover:bg-slate-800/20 transition-colors ${!alert.is_read ? 'bg-blue-500/3' : ''}`}>
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                  alert.urgency === 'critical' ? 'bg-red-400 animate-pulse' :
                  alert.urgency === 'high' ? 'bg-orange-400' :
                  alert.urgency === 'medium' ? 'bg-yellow-400' :
                  !alert.is_read ? 'bg-blue-400' : 'bg-slate-700'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-white font-bold text-sm">{alert.coin_ticker}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-black ${
                      alert.urgency === 'critical' ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                      alert.urgency === 'high' ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' :
                      alert.urgency === 'medium' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' :
                      'bg-slate-500/20 text-slate-300 border-slate-500/30'}`}>
                      {(alert.urgency ?? 'info').toUpperCase()}
                    </span>
                    {alert.heat_score && alert.heat_score > 0 && (
                      <span className="text-orange-400 text-[10px] font-semibold flex items-center gap-0.5">
                        <Flame size={9} />{alert.heat_score}
                      </span>
                    )}
                    <span className="text-slate-600 text-[10px] ml-auto">{formatTimeAgo(alert.fired_at)}</span>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed truncate mb-1">{alert.message}</p>
                  {alert.channel_names && alert.channel_names.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className="text-slate-600 text-[9px] self-center">via:</span>
                      {alert.channel_names.map(name => {
                        const ch = channels.find(c => c.name === name);
                        return ch
                          ? <ChannelChip key={name} ch={ch} />
                          : <span key={name} className="text-[10px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded border border-slate-700">{name}</span>;
                      })}
                    </div>
                  )}
                </div>
                {alert.contract_address && (
                  <button onClick={() => copyCA(alert.contract_address!, `dash-${alert.id}`)} className="shrink-0 text-slate-600 hover:text-emerald-400 transition-colors">
                    {copied === `dash-${alert.id}` ? <CheckCheck size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
