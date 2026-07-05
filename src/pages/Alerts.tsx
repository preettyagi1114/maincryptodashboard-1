import { useState } from 'react';
import {
  Bell, CheckCheck, Trash2, BellOff, Zap, Radio, TrendingUp, Tag,
  Flame, Copy, CheckCheck as CheckCheck2, ExternalLink, Users, Twitter, Hash,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { formatTimeAgo, getAlertTypeBg, getAlertTypeLabel } from '../lib/utils';
import type { Alert } from '../lib/database.types';

type AlertFilter = 'all' | 'unread' | 'critical' | 'high' | Alert['alert_type'];

const URGENCY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, info: 3 };

export default function AlertsPage() {
  const { alerts, markAlertRead, markAllAlertsRead, refetchAlerts } = useApp();
  const [filter, setFilter] = useState<AlertFilter>('all');
  const [copied, setCopied] = useState<string | null>(null);

  const filtered = alerts.filter(a => {
    if (filter === 'unread') return !a.is_read;
    if (filter === 'critical') return a.urgency === 'critical';
    if (filter === 'high') return a.urgency === 'high';
    if (filter === 'all') return true;
    return a.alert_type === filter;
  });

  const sorted = [...filtered].sort((a, b) => {
    const ua = URGENCY_ORDER[a.urgency ?? 'info'] ?? 3;
    const ub = URGENCY_ORDER[b.urgency ?? 'info'] ?? 3;
    if (ua !== ub) return ua - ub;
    return new Date(b.fired_at).getTime() - new Date(a.fired_at).getTime();
  });

  const unreadCount = alerts.filter(a => !a.is_read).length;
  const criticalCount = alerts.filter(a => a.urgency === 'critical').length;

  async function deleteAlert(id: string) {
    await supabase.from('alerts').delete().eq('id', id);
    await refetchAlerts();
  }

  async function deleteAll() {
    if (!confirm('Delete all alerts?')) return;
    await supabase.from('alerts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await refetchAlerts();
  }

  function copyCA(ca: string, id: string) {
    navigator.clipboard.writeText(ca);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  const URGENCY_STYLES: Record<string, { border: string; dot: string; label: string; bg: string }> = {
    critical: { border: 'border-red-500/40 bg-red-950/20', dot: 'bg-red-400 animate-pulse', label: 'bg-red-500/20 text-red-300 border-red-500/30', bg: '' },
    high: { border: 'border-orange-500/30', dot: 'bg-orange-400', label: 'bg-orange-500/20 text-orange-300 border-orange-500/30', bg: '' },
    medium: { border: 'border-yellow-500/20', dot: 'bg-yellow-400', label: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30', bg: '' },
    info: { border: 'border-slate-700/50', dot: 'bg-slate-600', label: 'bg-slate-700/50 text-slate-400 border-slate-600/30', bg: '' },
  };

  return (
    <div className="p-6 space-y-5">
      {/* Critical banner */}
      {criticalCount > 0 && (
        <div className="bg-gradient-to-r from-red-950/60 to-orange-950/40 border border-red-500/40 rounded-2xl p-4 flex items-center gap-3">
          <Flame size={20} className="text-red-400 animate-pulse shrink-0" />
          <div>
            <p className="text-red-300 font-bold text-sm">{criticalCount} critical signal{criticalCount > 1 ? 's' : ''} detected!</p>
            <p className="text-slate-400 text-xs">Cross-platform or ultra-hot coins found — review immediately</p>
          </div>
          <button onClick={() => setFilter('critical')} className="ml-auto px-3 py-1.5 bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-bold rounded-lg hover:bg-red-500/30 transition-colors">
            View Critical
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: alerts.length, color: 'text-white' },
          { label: 'Unread', value: unreadCount, color: 'text-blue-400' },
          { label: 'Critical / High', value: alerts.filter(a => a.urgency === 'critical' || a.urgency === 'high').length, color: 'text-red-400' },
          { label: 'Cross-Source', value: alerts.filter(a => a.alert_type === 'cross_source').length, color: 'text-orange-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-700/50 rounded-xl px-4 py-3">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-slate-500 text-xs mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter + actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { value: 'all', label: 'All' },
            { value: 'unread', label: `Unread (${unreadCount})` },
            { value: 'critical', label: 'Critical' },
            { value: 'high', label: 'High' },
            { value: 'cross_source', label: 'Cross-Source' },
            { value: 'new_listing', label: 'New Listing' },
          ].map(opt => (
            <button key={opt.value} onClick={() => setFilter(opt.value as AlertFilter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                filter === opt.value ? 'bg-blue-600/20 border-blue-500/50 text-blue-300' : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllAlertsRead} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 text-xs transition-colors">
              <CheckCheck size={13} /> Mark all read
            </button>
          )}
          {alerts.length > 0 && (
            <button onClick={deleteAll} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-red-400 text-xs transition-colors">
              <Trash2 size={13} /> Clear all
            </button>
          )}
        </div>
      </div>

      {/* Alert list */}
      {sorted.length === 0 ? (
        <div className="bg-slate-900 border border-slate-700/50 rounded-2xl flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
            <BellOff size={28} className="text-slate-600" />
          </div>
          <div className="text-center">
            <p className="text-slate-400 font-medium">No alerts</p>
            <p className="text-slate-600 text-sm mt-1">{filter !== 'all' ? 'No alerts match this filter' : 'Run a channel scan to detect signals'}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(alert => {
            const urgency = alert.urgency ?? 'info';
            const style = URGENCY_STYLES[urgency] ?? URGENCY_STYLES.info;
            return (
              <div key={alert.id} onClick={() => markAlertRead(alert.id)}
                className={`bg-slate-900 border rounded-2xl p-5 transition-all cursor-pointer group ${style.border} ${!alert.is_read ? 'bg-slate-900' : ''} hover:border-slate-500/50`}>
                {/* Urgency top bar */}
                <div className={`-mt-5 -mx-5 mb-4 h-0.5 rounded-t-2xl ${urgency === 'critical' ? 'bg-gradient-to-r from-red-500 to-orange-500' : urgency === 'high' ? 'bg-gradient-to-r from-orange-500 to-yellow-500' : urgency === 'medium' ? 'bg-yellow-500/50' : 'bg-slate-700'}`} />

                <div className="flex items-start gap-4">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${style.dot}`} />
                  <div className="flex-1 min-w-0">
                    {/* Header row */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="text-white font-bold">{alert.coin_ticker}</span>
                      <span className="text-slate-500 text-sm">{alert.coin_name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-black ${style.label}`}>
                        {urgency.toUpperCase()}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${getAlertTypeBg(alert.alert_type)}`}>
                        {getAlertTypeLabel(alert.alert_type)}
                      </span>
                      {alert.heat_score && alert.heat_score > 0 && (
                        <span className={`flex items-center gap-0.5 text-xs font-bold ${alert.heat_score >= 100 ? 'text-red-400' : alert.heat_score >= 70 ? 'text-orange-400' : 'text-yellow-400'}`}>
                          <Flame size={11} />{alert.heat_score}
                        </span>
                      )}
                      {!alert.is_read && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />}
                      <span className="text-slate-600 text-xs ml-auto">{formatTimeAgo(alert.fired_at)}</span>
                    </div>

                    <p className="text-slate-300 text-sm leading-relaxed mb-3">{alert.message}</p>

                    {/* Channel sources */}
                    {alert.channel_names && alert.channel_names.length > 0 && (
                      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                        <span className="text-slate-600 text-[10px]">Triggered by:</span>
                        {alert.channel_names.map(name => (
                          <span key={name} className="text-[10px] bg-slate-800 border border-slate-700 text-slate-400 px-1.5 py-0.5 rounded-md">{name}</span>
                        ))}
                      </div>
                    )}

                    {/* CA row */}
                    {alert.contract_address && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-800/50 rounded-lg px-3 py-1.5 border border-slate-700/30 min-w-0">
                          <code className="text-slate-400 text-[11px] font-mono truncate block">{alert.contract_address}</code>
                        </div>
                        <button onClick={e => { e.stopPropagation(); copyCA(alert.contract_address!, alert.id); }}
                          className="w-7 h-7 shrink-0 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 hover:text-emerald-400 transition-colors">
                          {copied === alert.id ? <CheckCheck size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        </button>
                        <a href={`https://dexscreener.com/search?q=${alert.contract_address}`} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="w-7 h-7 shrink-0 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 hover:text-blue-400 transition-colors">
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Delete */}
                  <button onClick={e => { e.stopPropagation(); deleteAlert(alert.id); }}
                    className="shrink-0 w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
