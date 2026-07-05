import { Bell, RefreshCw, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Page } from '../lib/utils';

interface TopbarProps {
  page: Page;
  onNavigate: (page: Page) => void;
  onRefresh: () => void;
  refreshing: boolean;
}

const PAGE_TITLES: Record<Page, string> = {
  dashboard: 'Dashboard',
  channels: 'Channel Manager',
  signals: 'Signal Feed',
  watchlist: 'Watchlist',
  alerts: 'Alert Center',
  settings: 'Settings',
  intelligence: 'Intelligence',
};

const PAGE_SUBTITLES: Record<Page, string> = {
  dashboard: 'Your real-time crypto signal overview',
  channels: 'Manage your Telegram & Twitter sources',
  signals: 'Live coin mention feed from all sources',
  watchlist: 'Coins you are tracking closely',
  alerts: 'Notifications when signals fire',
  settings: 'Configure your preferences',
  intelligence: 'Upcoming coins · AI predictions · Promoter cluster patterns',
};

export default function Topbar({ page, onNavigate, onRefresh, refreshing }: TopbarProps) {
  const { unreadAlertCount } = useApp();

  return (
    <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-700/50">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="pl-10 lg:pl-0">
          <h1 className="text-white font-bold text-lg leading-tight">{PAGE_TITLES[page]}</h1>
          <p className="text-slate-500 text-xs mt-0.5">{PAGE_SUBTITLES[page]}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-all text-sm"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => onNavigate('alerts')}
            className="relative flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-all"
          >
            <Bell size={16} />
            {unreadAlertCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white font-bold flex items-center justify-center">
                {unreadAlertCount > 9 ? '9+' : unreadAlertCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
