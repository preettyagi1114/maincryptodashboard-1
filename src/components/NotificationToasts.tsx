import { useEffect, useRef, useState } from 'react';
import { X, Flame, Zap, Radio, TrendingUp, Copy, CheckCheck, ExternalLink } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Alert } from '../lib/database.types';

interface Toast {
  alert: Alert;
  id: string;
}

const URGENCY_CONFIG = {
  critical: {
    border: 'border-red-500/60',
    bg: 'bg-red-950/90',
    glow: 'shadow-red-500/30',
    badge: 'bg-red-500 text-white',
    icon: <Flame size={16} className="text-red-400" />,
    label: 'CRITICAL',
    sound: true,
  },
  high: {
    border: 'border-orange-500/50',
    bg: 'bg-orange-950/90',
    glow: 'shadow-orange-500/20',
    badge: 'bg-orange-500 text-white',
    icon: <TrendingUp size={16} className="text-orange-400" />,
    label: 'HIGH',
    sound: true,
  },
  medium: {
    border: 'border-yellow-500/40',
    bg: 'bg-yellow-950/90',
    glow: 'shadow-yellow-500/10',
    badge: 'bg-yellow-500 text-black',
    icon: <Zap size={16} className="text-yellow-400" />,
    label: 'MEDIUM',
    sound: false,
  },
  info: {
    border: 'border-blue-500/30',
    bg: 'bg-slate-900/95',
    glow: 'shadow-blue-500/10',
    badge: 'bg-blue-500 text-white',
    icon: <Radio size={16} className="text-blue-400" />,
    label: 'INFO',
    sound: false,
  },
};

export default function NotificationToasts() {
  const { alerts, markAlertRead } = useApp();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Detect brand-new unread alerts that we haven't shown a toast for
    const newAlerts = alerts.filter(a => !a.is_read && !seenIds.current.has(a.id)).slice(0, 3);
    if (newAlerts.length === 0) return;

    for (const a of newAlerts) {
      seenIds.current.add(a.id);
    }

    setToasts(prev => {
      const next = [...newAlerts.map(a => ({ alert: a, id: a.id })), ...prev].slice(0, 5);
      return next;
    });

    // Request browser notification permission on first critical/high alert
    const hasCritical = newAlerts.some(a => a.urgency === 'critical' || a.urgency === 'high');
    if (hasCritical && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    if (hasCritical && 'Notification' in window && Notification.permission === 'granted') {
      for (const a of newAlerts.filter(x => x.urgency === 'critical' || x.urgency === 'high')) {
        new Notification(`MemeRadar: ${a.coin_ticker} Signal!`, {
          body: a.message.slice(0, 120),
          tag: a.id,
        });
      }
    }
  }, [alerts]);

  function dismiss(id: string) {
    setToasts(prev => prev.filter(t => t.id !== id));
    markAlertRead(id);
  }

  function copyCA(ca: string, id: string) {
    navigator.clipboard.writeText(ca);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
      {toasts.map((t, i) => {
        const cfg = URGENCY_CONFIG[t.alert.urgency ?? 'info'];
        return (
          <div
            key={t.id}
            className={`
              pointer-events-auto rounded-2xl border backdrop-blur-xl shadow-2xl
              ${cfg.border} ${cfg.bg} ${cfg.glow}
              transform transition-all duration-300
              ${i === 0 ? 'scale-100 opacity-100' : 'scale-98 opacity-90'}
            `}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            {/* Top urgency bar */}
            <div className={`h-1 rounded-t-2xl ${t.alert.urgency === 'critical' ? 'bg-gradient-to-r from-red-500 to-orange-500 animate-pulse' : t.alert.urgency === 'high' ? 'bg-gradient-to-r from-orange-500 to-yellow-500' : 'bg-gradient-to-r from-blue-500 to-cyan-500'}`} />

            <div className="p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {cfg.icon}
                  <span className="text-white font-bold text-base">{t.alert.coin_ticker}</span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${cfg.badge}`}>
                    {cfg.label}
                  </span>
                  {t.alert.alert_type === 'new_listing' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white">
                      NEW COIN
                    </span>
                  )}
                </div>
                <button
                  onClick={() => dismiss(t.id)}
                  className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
                >
                  <X size={14} />
                </button>
              </div>

              <p className="text-slate-300 text-xs leading-relaxed mb-3 line-clamp-3">{t.alert.message}</p>

              {/* Channel sources */}
              {t.alert.channel_names && t.alert.channel_names.length > 0 && (
                <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                  <span className="text-slate-600 text-[10px]">Sources:</span>
                  {t.alert.channel_names.map(name => (
                    <span key={name} className="text-[10px] bg-slate-800 border border-slate-700 text-slate-400 px-1.5 py-0.5 rounded-md">
                      {name}
                    </span>
                  ))}
                </div>
              )}

              {/* Heat score */}
              {(t.alert.heat_score ?? 0) > 0 && (
                <div className="flex items-center gap-1.5 mb-3">
                  <Flame size={11} className="text-orange-400" />
                  <span className="text-slate-400 text-[10px]">Heat score:</span>
                  <span className={`text-xs font-bold ${(t.alert.heat_score ?? 0) >= 100 ? 'text-red-400' : (t.alert.heat_score ?? 0) >= 70 ? 'text-orange-400' : 'text-yellow-400'}`}>
                    {t.alert.heat_score}
                  </span>
                </div>
              )}

              {/* CA copy + DEX link */}
              {t.alert.contract_address && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-800/80 rounded-lg px-3 py-1.5 border border-slate-700/50">
                    <code className="text-slate-400 text-[10px] font-mono">
                      {t.alert.contract_address.slice(0, 8)}...{t.alert.contract_address.slice(-6)}
                    </code>
                  </div>
                  <button
                    onClick={() => copyCA(t.alert.contract_address!, `toast-${t.id}`)}
                    className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-emerald-400 transition-colors"
                  >
                    {copied === `toast-${t.id}` ? <CheckCheck size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </button>
                  <a
                    href={`https://dexscreener.com/search?q=${t.alert.contract_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-blue-400 transition-colors"
                  >
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>

            {/* Auto-dismiss progress for info/medium */}
            {(t.alert.urgency === 'info' || t.alert.urgency === 'medium') && (
              <AutoDismissBar onDone={() => dismiss(t.id)} duration={t.alert.urgency === 'medium' ? 12000 : 8000} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function AutoDismissBar({ onDone, duration }: { onDone: () => void; duration: number }) {
  const [width, setWidth] = useState(100);

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, 100 - (elapsed / duration) * 100);
      setWidth(pct);
      if (pct === 0) { clearInterval(timer); onDone(); }
    }, 50);
    return () => clearInterval(timer);
  }, [duration, onDone]);

  return (
    <div className="h-0.5 bg-slate-800 rounded-b-2xl overflow-hidden">
      <div
        className="h-full bg-slate-600 transition-none rounded-b-2xl"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
