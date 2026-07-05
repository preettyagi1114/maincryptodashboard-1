export type Page = 'dashboard' | 'channels' | 'signals' | 'watchlist' | 'alerts' | 'settings' | 'intelligence';

export function getConfidenceColor(score: number): string {
  if (score >= 85) return 'text-emerald-400';
  if (score >= 65) return 'text-yellow-400';
  return 'text-red-400';
}

export function getConfidenceBg(score: number): string {
  if (score >= 85) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  if (score >= 65) return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
  return 'bg-red-500/20 text-red-300 border-red-500/30';
}

export function getSentimentColor(s: string): string {
  if (s === 'bullish') return 'text-emerald-400';
  if (s === 'bearish') return 'text-red-400';
  return 'text-slate-400';
}

export function getSentimentBg(s: string): string {
  if (s === 'bullish') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  if (s === 'bearish') return 'bg-red-500/20 text-red-300 border-red-500/30';
  return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
}

export function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function truncateAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export const AVATAR_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
];

export function getAlertTypeLabel(type: string): string {
  const map: Record<string, string> = {
    cross_source: 'Cross-Source',
    new_listing: 'New Listing',
    volume_spike: 'Volume Spike',
    manual: 'Manual',
  };
  return map[type] ?? type;
}

export function getAlertTypeBg(type: string): string {
  const map: Record<string, string> = {
    cross_source: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    new_listing: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    volume_spike: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    manual: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  };
  return map[type] ?? 'bg-slate-500/20 text-slate-300 border-slate-500/30';
}
