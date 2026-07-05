import { useState, useCallback } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import NotificationToasts from './components/NotificationToasts';
import Dashboard from './pages/Dashboard';
import Channels from './pages/Channels';
import Signals from './pages/Signals';
import WatchlistPage from './pages/Watchlist';
import AlertsPage from './pages/Alerts';
import Settings from './pages/Settings';
import Intelligence from './pages/Intelligence';
import type { Page } from './lib/utils';
import { Zap } from 'lucide-react';

function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center gap-6 z-50">
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-2xl shadow-blue-500/40">
          <Zap size={28} className="text-white" />
        </div>
        <div className="absolute -inset-2 rounded-3xl border-2 border-blue-500/30 animate-ping" />
      </div>
      <div className="text-center">
        <div className="text-white font-bold text-xl tracking-wide">MemeRadar</div>
        <div className="text-slate-500 text-sm mt-1">Loading signals...</div>
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

function AppInner() {
  const [page, setPage] = useState<Page>('dashboard');
  const [refreshing, setRefreshing] = useState(false);
  const { loading, refetchChannels, refetchSignals, refetchMentions, refetchHeat, refetchWatchlist, refetchAlerts, refetchIntelligence } = useApp();

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchChannels(), refetchSignals(), refetchMentions(), refetchHeat(), refetchWatchlist(), refetchAlerts(), refetchIntelligence()]);
    setRefreshing(false);
  }, [refetchChannels, refetchSignals, refetchMentions, refetchHeat, refetchWatchlist, refetchAlerts, refetchIntelligence]);

  if (loading) return <LoadingScreen />;

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      <Sidebar currentPage={page} onNavigate={setPage} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar page={page} onNavigate={setPage} onRefresh={handleRefresh} refreshing={refreshing} />
        <main className="flex-1 overflow-y-auto">
          {page === 'dashboard' && <Dashboard onNavigate={setPage} />}
          {page === 'channels' && <Channels />}
          {page === 'signals' && <Signals onNavigate={setPage} />}
          {page === 'watchlist' && <WatchlistPage />}
          {page === 'alerts' && <AlertsPage />}
          {page === 'settings' && <Settings />}
          {page === 'intelligence' && <Intelligence onNavigate={setPage} />}
        </main>
      </div>
      <NotificationToasts />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}
