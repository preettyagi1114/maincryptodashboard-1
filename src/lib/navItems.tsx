import { LayoutDashboard, Radio, Bell, Bookmark, Zap, Settings, Brain } from 'lucide-react';
import type { Page } from './utils';

interface NavItem {
  id: Page;
  label: string;
  icon: React.ReactNode;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { id: 'intelligence', label: 'Intelligence', icon: <Brain size={18} /> },
  { id: 'signals', label: 'Signal Feed', icon: <Zap size={18} /> },
  { id: 'channels', label: 'Channels', icon: <Radio size={18} /> },
  { id: 'watchlist', label: 'Watchlist', icon: <Bookmark size={18} /> },
  { id: 'alerts', label: 'Alerts', icon: <Bell size={18} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={18} /> },
];
