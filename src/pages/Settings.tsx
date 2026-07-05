import { useState } from 'react';
import { Info, AlertTriangle, Wifi, Calendar, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function Settings() {
  const { channels, triggerMonitor, monitoring, lastScan, scanConfig, updateScanConfig } = useApp();
  const [scanResult, setScanResult] = useState<{ alertsFired: number; uniqueCoins: number; mentionsInserted: number; upcomingDetected: number } | null>(null);
  const [error, setError] = useState('');
  const [monitorSinceInput, setMonitorSinceInput] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  async function handleScan() {
    setError('');
    setScanResult(null);
    try {
      const result = await triggerMonitor();
      setScanResult(result);
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleSaveConfig() {
    if (!monitorSinceInput) return;
    setSavingConfig(true);
    await updateScanConfig(new Date(monitorSinceInput).toISOString());
    setSavingConfig(false);
    setMonitorSinceInput('');
  }

  const activeChannels = channels.filter(c => c.is_active);

  return (
    <div className="p-6 space-y-6">

      {/* Monitoring status */}
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-3 h-3 rounded-full ${monitoring ? 'bg-yellow-400 animate-pulse' : activeChannels.length > 0 ? 'bg-emerald-400' : 'bg-slate-600'}`} />
          <h2 className="text-white font-bold text-sm">Monitoring Status</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Active Sources', value: activeChannels.length },
            { label: 'Total Sources', value: channels.length },
            { label: 'Last Scan', value: lastScan ? new Date(lastScan).toLocaleTimeString() : 'Never' },
            { label: 'Status', value: monitoring ? 'Scanning...' : 'Ready' },
          ].map(s => (
            <div key={s.label} className="bg-slate-800/50 border border-slate-700/30 rounded-xl px-3 py-3 text-center">
              <div className="text-white text-sm font-bold">{s.value}</div>
              <div className="text-slate-500 text-[10px] mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
        <button onClick={handleScan} disabled={monitoring || activeChannels.length === 0}
          className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
          <Wifi size={16} className={monitoring ? 'animate-pulse' : ''} />
          {monitoring ? 'Scanning all channels...' : 'Run Manual Scan'}
        </button>
        {error && <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-300 text-sm">{error}</div>}
        {scanResult && (
          <div className="mt-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-emerald-300 text-sm">
            Scan complete: {scanResult.uniqueCoins} coins · {scanResult.mentionsInserted} mentions · {scanResult.upcomingDetected ?? 0} upcoming · {scanResult.alertsFired} alerts fired.
          </div>
        )}
      </div>

      {/* Scan-from date config */}
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700/50 flex items-center gap-2">
          <Calendar size={16} className="text-blue-400" />
          <h2 className="text-white font-semibold text-sm">Monitor From Date</h2>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3">
            <div className="flex items-start gap-2">
              <Clock size={13} className="text-blue-400 mt-0.5 shrink-0" />
              <p className="text-slate-400 text-xs leading-relaxed">
                Only messages sent <strong className="text-white">after</strong> this date are processed. Set this to today to ignore all historical promotions and only track fresh signals going forward. Current setting:{' '}
                <span className="text-blue-300 font-semibold">{scanConfig ? new Date(scanConfig.monitor_since).toLocaleString() : 'Loading...'}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="datetime-local"
              value={monitorSinceInput}
              onChange={e => setMonitorSinceInput(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
            <button
              onClick={() => setMonitorSinceInput(new Date().toISOString().slice(0, 16))}
              className="px-3 py-2.5 bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 rounded-xl text-sm transition-colors whitespace-nowrap"
            >
              Set to Now
            </button>
            <button
              onClick={handleSaveConfig}
              disabled={!monitorSinceInput || savingConfig}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            >
              {savingConfig ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* How monitoring works */}
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700/50 flex items-center gap-2">
          <Info size={16} className="text-blue-400" />
          <h2 className="text-white font-semibold text-sm">How the Detection System Works</h2>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div className="space-y-3">
            {[
              {
                title: 'CA Extraction',
                desc: 'The scanner reads messages and automatically detects EVM contract addresses (0x... 40-char hex) and Solana CAs (32–44 char base58). These are extracted regardless of formatting — inline text, captions, or forwarded messages.',
              },
              {
                title: 'Ticker Detection',
                desc: 'Coin tickers are detected by the $ prefix ($PEPE, $WIF) and by common memecoin suffix patterns (INU, DOGE, MOON, etc). Each ticker is normalized to uppercase.',
              },
              {
                title: 'Cross-Channel Matching',
                desc: 'After every scan, coins found across multiple channels are matched by ticker AND contract address. When the same coin appears in 2+ of your sources, a cross-source alert fires. The more sources, the higher the urgency.',
              },
              {
                title: 'Heat Score',
                desc: 'Each coin gets a heat score: TG Channel mention = 30pts, TG Community = 20pts, Twitter = 15pts, plus log(total mentions)×10. Above 60 = HOT, above 100 = ULTRA HOT (critical alert).',
              },
              {
                title: 'Alert Urgency Levels',
                desc: 'Info → Medium → High → Critical. Critical fires when heat ≥ 100 or coin is cross-platform (both TG and Twitter). Critical alerts also trigger browser notifications and never auto-dismiss.',
              },
            ].map(s => (
              <div key={s.title} className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                <div>
                  <span className="text-white text-sm font-semibold">{s.title}: </span>
                  <span className="text-slate-400 text-sm leading-relaxed">{s.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Real API integration note */}
      <div className="bg-orange-500/5 border border-orange-500/20 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle size={16} className="text-orange-400 mt-0.5 shrink-0" />
          <div className="space-y-2">
            <h3 className="text-orange-300 font-semibold text-sm">Connecting to Real Telegram & Twitter APIs</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              The current scanner simulates fetching messages. To connect to real Telegram channels and Twitter accounts, provide:
            </p>
            <ul className="space-y-1.5 text-xs text-slate-400">
              <li className="flex items-start gap-2"><span className="text-orange-400 font-bold shrink-0">Telegram:</span> A Bot Token from @BotFather. Add the bot to your channels/groups. The edge function will call <code className="bg-slate-800 px-1 rounded text-orange-300">getUpdates</code> or use webhooks.</li>
              <li className="flex items-start gap-2"><span className="text-sky-400 font-bold shrink-0">Twitter/X:</span> A Twitter API v2 Bearer Token. The function calls <code className="bg-slate-800 px-1 rounded text-sky-300">recent search</code> filtered to each account.</li>
            </ul>
            <p className="text-slate-500 text-xs">Once you have these tokens, they are stored as edge function secrets — never exposed to the browser. Share them with your developer to wire them in.</p>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700/50">
          <h2 className="text-white font-semibold text-sm">About MemeRadar</h2>
        </div>
        <div className="px-5 py-4 text-slate-400 text-sm leading-relaxed space-y-2">
          <p>MemeRadar monitors Telegram channels, Telegram communities/groups, and Twitter/X accounts simultaneously, extracting every coin CA and ticker mentioned in real-time.</p>
          <p>When multiple sources promote the same coin — a classic coordinated pump pattern — you get an instant alert with the coin's CA, heat score, and which channels triggered it, so you can act before the crowd.</p>
        </div>
      </div>
    </div>
  );
}
