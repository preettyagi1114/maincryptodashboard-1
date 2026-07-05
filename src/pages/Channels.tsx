import { useState, useMemo } from 'react';
import {
  Plus, Trash2, Edit2, X, ExternalLink, Copy, CheckCheck,
  ToggleLeft, ToggleRight, Hash, Users, Twitter, RefreshCw, AlertCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { AVATAR_COLORS, formatTimeAgo } from '../lib/utils';
import type { Channel } from '../lib/database.types';

type FormData = {
  name: string;
  type: 'telegram' | 'twitter';
  channel_category: 'channel' | 'community' | 'account';
  url: string;
  username: string;
  avatar_color: string;
};

const EMPTY_FORM: FormData = {
  name: '',
  type: 'telegram',
  channel_category: 'channel',
  url: '',
  username: '',
  avatar_color: AVATAR_COLORS[0],
};

const SECTION_CONFIGS = [
  {
    key: 'tg_channel' as const,
    title: 'Telegram Channels',
    subtitle: 'Public/private announcement channels',
    icon: <Hash size={16} className="text-blue-400" />,
    badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    filter: (c: Channel) => c.type === 'telegram' && c.channel_category === 'channel',
  },
  {
    key: 'tg_community' as const,
    title: 'Telegram Communities',
    subtitle: 'Groups and communities with discussion',
    icon: <Users size={16} className="text-purple-400" />,
    badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    filter: (c: Channel) => c.type === 'telegram' && c.channel_category === 'community',
  },
  {
    key: 'twitter' as const,
    title: 'Twitter / X Accounts',
    subtitle: 'Crypto influencers and alpha callers',
    icon: <Twitter size={16} className="text-sky-400" />,
    badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    filter: (c: Channel) => c.type === 'twitter',
  },
];

export default function Channels() {
  const { channels, refetchChannels, triggerMonitor, monitoring } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Channel | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [scanningId, setScanningId] = useState<string | null>(null);

  function openAdd(preset?: Partial<FormData>) {
    setEditing(null);
    setForm({ ...EMPTY_FORM, ...preset });
    setError('');
    setShowForm(true);
  }

  function openEdit(ch: Channel) {
    setEditing(ch);
    setForm({
      name: ch.name,
      type: ch.type,
      channel_category: ch.channel_category ?? 'channel',
      url: ch.url,
      username: ch.username,
      avatar_color: ch.avatar_color,
    });
    setError('');
    setShowForm(true);
  }

  // Auto-detect URL type and category
  function handleUrlChange(url: string) {
    setForm(f => {
      let updated = { ...f, url };
      if (url.includes('t.me/joinchat') || url.includes('t.me/+')) {
        updated = { ...updated, type: 'telegram', channel_category: 'community' };
      } else if (url.includes('t.me/')) {
        updated = { ...updated, type: 'telegram', channel_category: 'channel' };
        const match = url.match(/t\.me\/([^/?]+)/);
        if (match && !f.username) updated.username = match[1];
      } else if (url.includes('x.com/') || url.includes('twitter.com/')) {
        updated = { ...updated, type: 'twitter', channel_category: 'account' };
        const match = url.match(/(?:x|twitter)\.com\/([^/?]+)/);
        if (match && !f.username) updated.username = match[1];
      }
      return updated;
    });
  }

  async function handleSave() {
    if (!form.name.trim() || !form.url.trim() || !form.username.trim()) {
      setError('Name, URL, and username are required.');
      return;
    }
    setSaving(true);
    setError('');

    const payload = {
      name: form.name.trim(),
      type: form.type,
      channel_category: form.type === 'twitter' ? 'account' : form.channel_category,
      url: form.url.trim(),
      username: form.username.trim().replace('@', ''),
      avatar_color: form.avatar_color,
      monitoring_status: 'active' as const,
    };

    if (editing) {
      const { error: err } = await supabase.from('channels').update(payload).eq('id', editing.id);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase.from('channels').insert({ ...payload, is_active: true });
      if (err) { setError(err.message); setSaving(false); return; }
    }

    await refetchChannels();
    setSaving(false);
    setShowForm(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this channel? All its signals and mentions will also be deleted.')) return;
    await supabase.from('channels').delete().eq('id', id);
    await refetchChannels();
  }

  async function toggleActive(ch: Channel) {
    const newStatus = ch.is_active ? 'paused' : 'active';
    await supabase.from('channels').update({ is_active: !ch.is_active, monitoring_status: newStatus }).eq('id', ch.id);
    await refetchChannels();
  }

  async function scanChannel(id: string) {
    setScanningId(id);
    await triggerMonitor([id]);
    setScanningId(null);
  }

  function copyUrl(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  const ChannelCard = ({ ch }: { ch: Channel }) => (
    <div className={`bg-slate-900 border rounded-2xl p-5 transition-all ${
      ch.is_active && ch.monitoring_status === 'active' ? 'border-slate-700/50 hover:border-slate-600/50' :
      ch.monitoring_status === 'error' ? 'border-red-500/30 bg-red-950/10' :
      'border-slate-800 opacity-60'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg"
              style={{ backgroundColor: ch.avatar_color }}>
              {ch.name.charAt(0).toUpperCase()}
            </div>
            <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
              ch.monitoring_status === 'error' ? 'bg-red-500' :
              ch.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
            }`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold text-sm">{ch.name}</span>
              {ch.channel_category === 'channel' && <Hash size={11} className="text-blue-400" />}
              {ch.channel_category === 'community' && <Users size={11} className="text-purple-400" />}
              {ch.type === 'twitter' && <Twitter size={11} className="text-sky-400" />}
            </div>
            <div className="text-slate-500 text-xs">@{ch.username}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => scanChannel(ch.id)} disabled={scanningId === ch.id || monitoring || !ch.is_active}
            className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-cyan-400 transition-colors disabled:opacity-40" title="Scan now">
            <RefreshCw size={11} className={scanningId === ch.id ? 'animate-spin text-cyan-400' : ''} />
          </button>
          <button onClick={() => openEdit(ch)} className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
            <Edit2 size={11} />
          </button>
          <button onClick={() => handleDelete(ch.id)} className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-red-400 transition-colors">
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* Error state */}
      {ch.monitoring_status === 'error' && ch.monitor_error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 mb-3">
          <AlertCircle size={12} className="text-red-400 mt-0.5 shrink-0" />
          <p className="text-red-300 text-[10px]">{ch.monitor_error}</p>
        </div>
      )}

      {/* URL */}
      <div className="flex items-center gap-2 mb-4">
        <ExternalLink size={11} className="text-slate-600 shrink-0" />
        <a href={ch.url} target="_blank" rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 text-xs truncate flex-1 transition-colors">
          {ch.url}
        </a>
        <button onClick={() => copyUrl(ch.url, ch.id)} className="shrink-0 text-slate-600 hover:text-slate-300 transition-colors">
          {copied === ch.id ? <CheckCheck size={11} className="text-emerald-400" /> : <Copy size={11} />}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: 'Total Signals', value: ch.signal_count },
          { label: 'Mentions', value: ch.total_mentions },
          { label: 'Last Signal', value: ch.last_signal_at ? formatTimeAgo(ch.last_signal_at) : 'Never' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/40 rounded-lg p-2 text-center border border-slate-700/20">
            <div className="text-white text-xs font-bold">{s.value}</div>
            <div className="text-slate-600 text-[9px] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Footer: toggle */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-800">
        <div className="text-slate-600 text-[10px]">
          {ch.last_checked ? `Checked ${formatTimeAgo(ch.last_checked)}` : 'Never checked'}
        </div>
        <button onClick={() => toggleActive(ch)} className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${ch.is_active ? 'text-emerald-400' : 'text-slate-500'}`}>
          {ch.is_active ? <ToggleRight size={22} className="text-emerald-400" /> : <ToggleLeft size={22} className="text-slate-600" />}
          {ch.is_active ? 'Active' : 'Paused'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="bg-slate-800/50 border border-slate-700/30 rounded-xl px-4 py-2 text-sm">
          <span className="text-slate-400">{channels.filter(c => c.is_active).length}</span>
          <span className="text-slate-600 ml-1">/ {channels.length} active</span>
        </div>
        <button onClick={() => openAdd()}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-500/20">
          <Plus size={16} />
          Add Channel
        </button>
      </div>

      {/* How it works */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-5 space-y-3">
        <h3 className="text-blue-300 font-semibold text-sm">How monitoring works</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: '1', text: 'Paste the Telegram channel/group link or Twitter profile URL' },
            { icon: '2', text: 'MemeRadar scans for coin tickers ($NAME) and contract addresses (0x... / Solana CA)' },
            { icon: '3', text: 'When 2+ sources mention the same coin, a cross-source alert fires instantly' },
          ].map(s => (
            <div key={s.icon} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-600/40 border border-blue-500/40 text-blue-300 text-xs font-bold flex items-center justify-center shrink-0">{s.icon}</div>
              <p className="text-slate-400 text-xs leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sections */}
      {SECTION_CONFIGS.map(section => {
        const sectionChannels = channels.filter(section.filter);
        return (
          <section key={section.key}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700">{section.icon}</div>
              <div>
                <h2 className="text-white font-semibold text-sm">{section.title}</h2>
                <p className="text-slate-600 text-xs">{section.subtitle}</p>
              </div>
              <span className="ml-auto bg-slate-800 text-slate-400 text-xs px-2 py-0.5 rounded-full border border-slate-700">{sectionChannels.length}</span>
              <button
                onClick={() => openAdd({
                  type: section.key === 'twitter' ? 'twitter' : 'telegram',
                  channel_category: section.key === 'twitter' ? 'account' : section.key === 'tg_channel' ? 'channel' : 'community',
                })}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-400 transition-colors border border-slate-700 rounded-lg px-2 py-1"
              >
                <Plus size={11} /> Add
              </button>
            </div>
            {sectionChannels.length === 0 ? (
              <div className="bg-slate-900 border border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center py-10 gap-3">
                {section.icon}
                <p className="text-slate-500 text-sm">No {section.title.toLowerCase()} yet</p>
                <button onClick={() => openAdd({
                  type: section.key === 'twitter' ? 'twitter' : 'telegram',
                  channel_category: section.key === 'twitter' ? 'account' : section.key === 'tg_channel' ? 'channel' : 'community',
                })} className="text-blue-400 hover:text-blue-300 text-xs transition-colors">+ Add one</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {sectionChannels.map(ch => <ChannelCard key={ch.id} ch={ch} />)}
              </div>
            )}
          </section>
        );
      })}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700/50 sticky top-0 bg-slate-900 z-10">
              <h3 className="text-white font-bold">{editing ? 'Edit Channel' : 'Add Channel'}</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-200"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-5">

              {/* URL first — auto-detects everything */}
              <div>
                <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5 block">
                  Channel / Account URL <span className="text-blue-400 normal-case font-normal">(auto-detects type)</span>
                </label>
                <input type="url" value={form.url} onChange={e => handleUrlChange(e.target.value)}
                  placeholder="https://t.me/channelname  or  https://x.com/username"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors" />
              </div>

              {/* Type + Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 block">Platform</label>
                  <div className="flex gap-2">
                    {(['telegram', 'twitter'] as const).map(t => (
                      <button key={t} onClick={() => setForm(f => ({ ...f, type: t, channel_category: t === 'twitter' ? 'account' : f.channel_category === 'account' ? 'channel' : f.channel_category }))}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${form.type === t ? t === 'telegram' ? 'bg-blue-600/20 border-blue-500/50 text-blue-300' : 'bg-sky-600/20 border-sky-500/50 text-sky-300' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                        {t === 'telegram' ? 'Telegram' : 'Twitter/X'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 block">Type</label>
                  {form.type === 'twitter' ? (
                    <div className="py-2 text-center text-sky-300 text-xs bg-sky-600/10 border border-sky-500/30 rounded-xl">Account</div>
                  ) : (
                    <div className="flex gap-2">
                      {(['channel', 'community'] as const).map(cat => (
                        <button key={cat} onClick={() => setForm(f => ({ ...f, channel_category: cat }))}
                          className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all capitalize ${form.channel_category === cat ? 'bg-purple-600/20 border-purple-500/50 text-purple-300' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5 block">Display Name</label>
                  <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. CryptoGems TG"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5 block">Username</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 text-sm">@</span>
                    <input type="text" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value.replace('@', '') }))}
                      placeholder="username"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-7 pr-3 py-2.5 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors" />
                  </div>
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 block">Avatar Color</label>
                <div className="flex items-center gap-2">
                  {AVATAR_COLORS.map(c => (
                    <button key={c} onClick={() => setForm(f => ({ ...f, avatar_color: c }))}
                      className={`w-7 h-7 rounded-lg transition-all ${form.avatar_color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : 'hover:scale-105'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 text-red-300 text-sm">{error}</div>
              )}
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 text-sm font-semibold transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all disabled:opacity-50">
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Channel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
