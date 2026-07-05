import { useState } from 'react';
import {
  Plus, Trash2, Edit2, X, Star, Copy, CheckCheck, ExternalLink,
  Bell, BellOff,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { formatTimeAgo, truncateAddress } from '../lib/utils';
import type { WatchlistItem } from '../lib/database.types';

type FormData = {
  coin_name: string;
  coin_ticker: string;
  contract_address: string;
  notes: string;
  alert_threshold: number;
};

const EMPTY_FORM: FormData = {
  coin_name: '',
  coin_ticker: '',
  contract_address: '',
  notes: '',
  alert_threshold: 3,
};

export default function Watchlist() {
  const { watchlist, refetchWatchlist } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<WatchlistItem | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowForm(true);
  }

  function openEdit(item: WatchlistItem) {
    setEditing(item);
    setForm({
      coin_name: item.coin_name,
      coin_ticker: item.coin_ticker,
      contract_address: item.contract_address ?? '',
      notes: item.notes ?? '',
      alert_threshold: item.alert_threshold,
    });
    setError('');
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.coin_name.trim() || !form.coin_ticker.trim()) {
      setError('Coin name and ticker are required.');
      return;
    }
    setSaving(true);
    setError('');
    if (editing) {
      const { error: err } = await supabase.from('watchlist').update({
        coin_name: form.coin_name.trim(),
        coin_ticker: form.coin_ticker.trim().toUpperCase(),
        contract_address: form.contract_address.trim() || null,
        notes: form.notes.trim() || null,
        alert_threshold: form.alert_threshold,
      }).eq('id', editing.id);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase.from('watchlist').insert({
        coin_name: form.coin_name.trim(),
        coin_ticker: form.coin_ticker.trim().toUpperCase(),
        contract_address: form.contract_address.trim() || null,
        notes: form.notes.trim() || null,
        alert_threshold: form.alert_threshold,
      });
      if (err) { setError(err.message); setSaving(false); return; }
    }
    await refetchWatchlist();
    setSaving(false);
    setShowForm(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this coin from watchlist?')) return;
    await supabase.from('watchlist').delete().eq('id', id);
    await refetchWatchlist();
  }

  async function toggleAlerted(item: WatchlistItem) {
    await supabase.from('watchlist').update({ is_alerted: !item.is_alerted }).eq('id', item.id);
    await refetchWatchlist();
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="bg-slate-800/50 border border-slate-700/30 rounded-xl px-4 py-2 text-sm">
          <span className="text-slate-400">{watchlist.length}</span>
          <span className="text-slate-600 ml-1">coins tracked</span>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-500/20"
        >
          <Plus size={16} />
          Add Coin
        </button>
      </div>

      {/* Info box */}
      <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <Star size={16} className="text-yellow-400 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-yellow-300 font-semibold text-sm mb-0.5">Watchlist & Smart Alerts</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Add coins you want to track. When a watched coin is mentioned by multiple sources simultaneously, an alert fires automatically.
              Set your alert threshold (how many sources must mention it) per coin.
            </p>
          </div>
        </div>
      </div>

      {watchlist.length === 0 ? (
        <div className="bg-slate-900 border border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
            <Star size={28} className="text-slate-600" />
          </div>
          <div className="text-center">
            <p className="text-slate-400 font-medium">Watchlist is empty</p>
            <p className="text-slate-600 text-sm mt-1">Add coins to get notified when signals fire</p>
          </div>
          <button onClick={openAdd} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors">
            Add Your First Coin
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {watchlist.map(item => (
            <div
              key={item.id}
              className={`bg-slate-900 border rounded-2xl p-5 transition-all hover:border-slate-600/50 ${
                item.is_alerted ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-slate-700/50'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center text-white font-bold">
                    {item.coin_ticker.slice(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold">{item.coin_ticker}</span>
                      {item.is_alerted && (
                        <span className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          ALERTED
                        </span>
                      )}
                    </div>
                    <div className="text-slate-500 text-xs">{item.coin_name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openEdit(item)}
                    className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {item.contract_address && (
                <div className="bg-slate-800/50 rounded-xl px-3 py-2 border border-slate-700/30 mb-3">
                  <div className="text-slate-600 text-[10px] mb-0.5">Contract</div>
                  <div className="flex items-center gap-2">
                    <code className="text-slate-400 text-xs font-mono flex-1 truncate">
                      {truncateAddress(item.contract_address)}
                    </code>
                    <button onClick={() => copyToClipboard(item.contract_address!, item.id)}>
                      {copied === item.id ? <CheckCheck size={12} className="text-emerald-400" /> : <Copy size={12} className="text-slate-600 hover:text-slate-300" />}
                    </button>
                    <a
                      href={`https://dexscreener.com/search?q=${item.contract_address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-600 hover:text-blue-400 transition-colors"
                    >
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              )}

              {item.notes && (
                <p className="text-slate-500 text-xs mb-3 leading-relaxed">{item.notes}</p>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                  <Bell size={11} />
                  <span>Alert at <span className="text-white font-semibold">{item.alert_threshold}</span>+ sources</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 text-[10px]">{formatTimeAgo(item.added_at)}</span>
                  <button
                    onClick={() => toggleAlerted(item)}
                    title={item.is_alerted ? 'Mark as not alerted' : 'Mark as alerted'}
                    className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${
                      item.is_alerted
                        ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400'
                        : 'bg-slate-800 border-slate-700 text-slate-600 hover:text-slate-300'
                    }`}
                  >
                    {item.is_alerted ? <Bell size={11} /> : <BellOff size={11} />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700/50">
              <h3 className="text-white font-bold">{editing ? 'Edit Coin' : 'Add to Watchlist'}</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-200">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5 block">Coin Name</label>
                  <input
                    type="text"
                    value={form.coin_name}
                    onChange={e => setForm(f => ({ ...f, coin_name: e.target.value }))}
                    placeholder="e.g. Pepe"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5 block">Ticker</label>
                  <input
                    type="text"
                    value={form.coin_ticker}
                    onChange={e => setForm(f => ({ ...f, coin_ticker: e.target.value.toUpperCase() }))}
                    placeholder="e.g. $PEPE"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5 block">Contract Address (optional)</label>
                <input
                  type="text"
                  value={form.contract_address}
                  onChange={e => setForm(f => ({ ...f, contract_address: e.target.value }))}
                  placeholder="0x... or solana address"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5 block">Alert Threshold (# of sources)</label>
                <div className="flex items-center gap-3">
                  {[2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => setForm(f => ({ ...f, alert_threshold: n }))}
                      className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                        form.alert_threshold === n
                          ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                          : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600'
                      }`}
                    >
                      {n}+
                    </button>
                  ))}
                </div>
                <p className="text-slate-600 text-[10px] mt-1.5">Alert fires when this many distinct sources mention the coin within a short window</p>
              </div>

              <div>
                <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5 block">Notes (optional)</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. Seen on 3 channels, strong community..."
                  rows={2}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 text-red-300 text-sm">{error}</div>
              )}
            </div>
            <div className="flex items-center gap-3 px-6 pb-5">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 text-sm font-semibold transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all disabled:opacity-50">
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add to Watchlist'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
