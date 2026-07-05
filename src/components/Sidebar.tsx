import { useState } from 'react';
import {
  Bell, LayoutDashboard, Radio, Zap, Bookmark, Menu, X, ChevronRight, Brain,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Page } from '../lib/utils';
import { NAV_ITEMS } from '../lib/navItems';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const { unreadAlertCount, unreadPredictionCount } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Zap size={18} className="text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-tight tracking-wide">MemeRadar</div>
            <div className="text-slate-500 text-xs">Signal Tracker</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="text-slate-600 text-[10px] font-semibold uppercase tracking-widest px-3 pb-2">
          Navigation
        </div>
        {NAV_ITEMS.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { onNavigate(item.id); setMobileOpen(false); }}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group
                ${isActive
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }
              `}
            >
              <span className={`transition-colors ${isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
                {item.icon}
              </span>
              <span className="flex-1 text-left">{item.label}</span>
              {item.id === 'alerts' && unreadAlertCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center animate-pulse">
                  {unreadAlertCount > 99 ? '99+' : unreadAlertCount}
                </span>
              )}
              {item.id === 'intelligence' && unreadPredictionCount > 0 && (
                <span className="bg-purple-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {unreadPredictionCount}
                </span>
              )}
              {isActive && <ChevronRight size={14} className="text-blue-400" />}
            </button>
          );
        })}
      </nav>

      {/* Status */}
      <div className="px-4 py-4 border-t border-slate-700/50">
        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/30">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-xs font-semibold">Live Monitoring</span>
          </div>
          <p className="text-slate-500 text-[11px]">Real-time signal detection active</p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
        onClick={() => setMobileOpen(v => !v)}
      >
        {mobileOpen ? <X size={16} /> : <Menu size={16} />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside className={`
        lg:hidden fixed top-0 left-0 z-50 h-full w-64 bg-slate-900 border-r border-slate-700/50
        transform transition-transform duration-300
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {navContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-slate-900 border-r border-slate-700/50 h-screen sticky top-0">
        {navContent}
      </aside>
    </>
  );
}
