import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Playlist {
  id: string;
  name: string;
  _count: { items: number };
}

interface MediaAsset {
  id: string;
  type: 'IMAGE' | 'VIDEO' | 'WEB';
  filename: string;
  url: string;
}

interface RawItem {
  mediaAssetId: string;
  mediaAsset: { id: string; type: 'IMAGE' | 'VIDEO' | 'WEB'; filename: string };
  order: number;
  durationOverride: number | null;
}

interface PlaylistDetail {
  id: string;
  name: string;
  items: RawItem[];
}

interface Row {
  _key: string;
  mediaAssetId: string;
  filename: string;
  type: 'IMAGE' | 'VIDEO' | 'WEB';
  url: string;
  duration: string; // '' = use default
}

// ── Helpers ───────────────────────────────────────────────────────────────────

let _seq = 0;
const mk = () => `k${_seq++}`;

// ── Small components ──────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: 'IMAGE' | 'VIDEO' | 'WEB' }) {
  const cls = {
    IMAGE: 'bg-blue-100 text-blue-700',
    VIDEO: 'bg-purple-100 text-purple-700',
    WEB:   'bg-green-100 text-green-700',
  }[type];
  return <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-medium ${cls}`}>{type}</span>;
}

function AssetThumb({ type, url, filename }: { type: 'IMAGE' | 'VIDEO' | 'WEB'; url: string; filename: string }) {
  if (type === 'IMAGE' && url) {
    return <img src={url} alt={filename} className="w-10 h-10 object-cover rounded flex-shrink-0" loading="lazy" />;
  }
  const d = type === 'VIDEO'
    ? 'm15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z'
    : 'M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418';
  return (
    <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
      <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d={d} />
      </svg>
    </div>
  );
}

function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4Z" />
    </svg>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function PlaylistsPage() {
  // Playlist list
  const [playlists, setPlaylists]     = useState<Playlist[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError]     = useState('');

  // Selected playlist / editor
  const [selectedId, setSelectedId]       = useState<string | null>(null);
  const [detail, setDetail]               = useState<PlaylistDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [mediaAll, setMediaAll]           = useState<MediaAsset[]>([]);

  // Editor rows (local mutable copy of items)
  const [rows, setRows]         = useState<Row[]>([]);
  const [isDirty, setIsDirty]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState('');

  // Create form
  const [creating, setCreating]     = useState(false);
  const [newName, setNewName]       = useState('');
  const [createBusy, setCreateBusy] = useState(false);

  // Inline rename
  const [renamingId, setRenamingId]   = useState<string | null>(null);
  const [renameName, setRenameName]   = useState('');
  const [renameBusy, setRenameBusy]   = useState(false);

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Library multi-select
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set());

  const newNameRef = useRef<HTMLInputElement>(null);
  const renameRef  = useRef<HTMLInputElement>(null);

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadPlaylists = useCallback(async () => {
    setListError('');
    try {
      setPlaylists(await api.get<Playlist[]>('/playlists'));
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Failed to load playlists');
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => { loadPlaylists(); }, [loadPlaylists]);

  useEffect(() => {
    setPickerSelected(new Set());
    if (!selectedId) {
      setDetail(null);
      setRows([]);
      setIsDirty(false);
      return;
    }
    setLoadingDetail(true);
    setSaveError('');
    Promise.all([
      api.get<PlaylistDetail>(`/playlists/${selectedId}`),
      api.get<MediaAsset[]>('/media'),
    ]).then(([d, media]) => {
      const map = new Map(media.map(m => [m.id, m]));
      setMediaAll(media);
      setDetail(d);
      setRows(d.items.map(item => ({
        _key: mk(),
        mediaAssetId: item.mediaAssetId,
        filename: item.mediaAsset.filename,
        type: item.mediaAsset.type,
        url: map.get(item.mediaAssetId)?.url ?? '',
        duration: item.durationOverride != null ? String(item.durationOverride) : '',
      })));
      setIsDirty(false);
    }).catch(e => {
      setListError(e instanceof Error ? e.message : 'Failed to load playlist');
    }).finally(() => setLoadingDetail(false));
  }, [selectedId]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function selectPlaylist(id: string) {
    if (isDirty && !confirm('You have unsaved changes. Leave without saving?')) return;
    setSelectedId(id);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreateBusy(true);
    try {
      const created = await api.post<{ id: string }>('/playlists', { name });
      await loadPlaylists();
      setCreating(false);
      setNewName('');
      setSelectedId(created.id);
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Failed to create playlist');
    } finally {
      setCreateBusy(false);
    }
  }

  async function handleRename(id: string) {
    const name = renameName.trim();
    if (!name) return;
    setRenameBusy(true);
    try {
      await api.patch(`/playlists/${id}`, { name });
      setPlaylists(prev => prev.map(p => p.id === id ? { ...p, name } : p));
      if (detail?.id === id) setDetail(prev => prev ? { ...prev, name } : prev);
      setRenamingId(null);
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Rename failed');
    } finally {
      setRenameBusy(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await api.delete(`/playlists/${id}`);
      setPlaylists(prev => prev.filter(p => p.id !== id));
      if (selectedId === id) { setSelectedId(null); setDetail(null); setRows([]); }
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  }

  function moveRow(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
    setIsDirty(true);
  }

  function removeRow(i: number) {
    setRows(prev => prev.filter((_, idx) => idx !== i));
    setIsDirty(true);
  }

  function changeDuration(i: number, val: string) {
    if (val !== '' && !/^\d+$/.test(val)) return;
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, duration: val } : r));
    setIsDirty(true);
  }

  function addMedia(asset: MediaAsset) {
    setRows(prev => [...prev, {
      _key: mk(),
      mediaAssetId: asset.id,
      filename: asset.filename,
      type: asset.type,
      url: asset.url,
      duration: '',
    }]);
    setIsDirty(true);
  }

  function toggleAssetSelection(id: string) {
    setPickerSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAllAssets() {
    setPickerSelected(
      pickerSelected.size === mediaAll.length ? new Set() : new Set(mediaAll.map(a => a.id))
    );
  }

  function addSelected() {
    const toAdd = mediaAll.filter(a => pickerSelected.has(a.id));
    setRows(prev => [
      ...prev,
      ...toAdd.map(asset => ({
        _key: mk(),
        mediaAssetId: asset.id,
        filename: asset.filename,
        type: asset.type,
        url: asset.url,
        duration: '',
      })),
    ]);
    setPickerSelected(new Set());
    setIsDirty(true);
  }

  async function handleSave() {
    if (!selectedId) return;
    setSaving(true);
    setSaveError('');
    try {
      await api.put(`/playlists/${selectedId}/items`, rows.map((r, i) => ({
        mediaAssetId: r.mediaAssetId,
        order: i,
        durationOverride: r.duration !== '' ? Number(r.duration) : null,
      })));
      setIsDirty(false);
      await loadPlaylists();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => { if (creating)   newNameRef.current?.focus(); }, [creating]);
  useEffect(() => { if (renamingId) renameRef.current?.focus();  }, [renamingId]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex gap-6 items-start">

      {/* ── Left: playlist list ── */}
      <div className="w-72 flex-shrink-0">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Playlists</h1>
            <p className="mt-0.5 text-sm text-slate-500">Ordered sequences for your screens.</p>
          </div>
          {!creating && (
            <button
              onClick={() => { setCreating(true); setNewName(''); }}
              className="mt-1 inline-flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New
            </button>
          )}
        </div>

        {listError && (
          <div className="mb-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
            </svg>
            {listError}
          </div>
        )}

        {/* Inline create form */}
        {creating && (
          <form
            onSubmit={handleCreate}
            className="mb-2 bg-white rounded-xl border border-indigo-200 shadow-sm px-3 py-2.5 flex items-center gap-2"
          >
            <input
              ref={newNameRef}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Playlist name…"
              className="flex-1 text-sm text-slate-800 placeholder:text-slate-400 outline-none bg-transparent"
            />
            <button
              type="submit"
              disabled={!newName.trim() || createBusy}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 disabled:opacity-40"
            >
              {createBusy ? '…' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Cancel
            </button>
          </form>
        )}

        {/* List */}
        {loadingList ? (
          <div className="text-sm text-slate-400 text-center py-8">Loading…</div>
        ) : playlists.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white py-12 text-center">
            <p className="text-sm font-medium text-slate-500">No playlists yet</p>
            <p className="text-xs text-slate-400 mt-1">Click New to create one.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {playlists.map(p => (
              <div
                key={p.id}
                onClick={() => renamingId !== p.id && selectPlaylist(p.id)}
                className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                  selectedId === p.id
                    ? 'bg-indigo-50 border-indigo-200'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                {renamingId === p.id ? (
                  <form
                    onSubmit={e => { e.preventDefault(); handleRename(p.id); }}
                    onClick={e => e.stopPropagation()}
                    className="flex-1 flex items-center gap-1.5"
                  >
                    <input
                      ref={renameRef}
                      value={renameName}
                      onChange={e => setRenameName(e.target.value)}
                      className="flex-1 text-sm text-slate-800 outline-none bg-transparent"
                    />
                    <button
                      type="submit"
                      disabled={!renameName.trim() || renameBusy}
                      className="text-xs font-semibold text-indigo-600 disabled:opacity-40"
                    >
                      {renameBusy ? '…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenamingId(null)}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      ✕
                    </button>
                  </form>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${selectedId === p.id ? 'text-indigo-700' : 'text-slate-700'}`}>
                        {p.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {p._count.items} item{p._count.items !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div
                      className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        onClick={() => { setRenamingId(p.id); setRenameName(p.name); }}
                        className="p-1 rounded text-slate-400 hover:text-slate-600"
                        title="Rename"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(p.id, p.name)}
                        disabled={deletingId === p.id}
                        className="p-1 rounded text-slate-400 hover:text-red-600 disabled:opacity-50"
                        title="Delete"
                      >
                        {deletingId === p.id
                          ? <Spinner className="w-3.5 h-3.5" />
                          : (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                          )
                        }
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Right: editor ── */}
      {selectedId === null ? (
        <div className="flex-1 flex items-center justify-center py-24">
          <p className="text-sm text-slate-400">Select a playlist to edit, or create a new one.</p>
        </div>
      ) : loadingDetail ? (
        <div className="flex-1 flex items-center justify-center py-24 text-sm text-slate-400">Loading…</div>
      ) : detail ? (
        <div className="flex-1 min-w-0 space-y-4">

          {/* Editor header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-800">{detail.name}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{rows.length} item{rows.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="flex items-center gap-3">
              {isDirty && (
                <span className="text-xs font-medium text-amber-600">Unsaved changes</span>
              )}
              {saveError && (
                <span className="text-xs text-red-600">{saveError}</span>
              )}
              <button
                onClick={handleSave}
                disabled={!isDirty || saving}
                className="inline-flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? <><Spinner /> Saving…</> : 'Save'}
              </button>
            </div>
          </div>

          {/* Items list */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
              <h3 className="text-sm font-semibold text-slate-700">Items</h3>
              <span className="text-xs text-slate-400">Use arrows to reorder · duration blank = asset default</span>
            </div>

            {rows.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-slate-400">
                No items yet — add media from the library below.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {rows.map((row, i) => (
                  <div key={row._key} className="flex items-center gap-3 px-4 py-3">
                    <span className="text-xs text-slate-400 w-5 text-right flex-shrink-0 tabular-nums">{i + 1}</span>

                    <AssetThumb type={row.type} url={row.url} filename={row.filename} />

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{row.filename}</p>
                      <TypeBadge type={row.type} />
                    </div>

                    {/* Duration input */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={row.duration}
                        onChange={e => changeDuration(i, e.target.value)}
                        placeholder="default"
                        className="w-20 text-sm text-right text-slate-700 border border-slate-200 rounded-md px-2 py-1 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent"
                      />
                      <span className="text-xs text-slate-400 w-3">s</span>
                    </div>

                    {/* Up / down */}
                    <div className="flex flex-col flex-shrink-0">
                      <button
                        onClick={() => moveRow(i, -1)}
                        disabled={i === 0}
                        className="p-0.5 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20"
                        title="Move up"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                        </svg>
                      </button>
                      <button
                        onClick={() => moveRow(i, 1)}
                        disabled={i === rows.length - 1}
                        className="p-0.5 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20"
                        title="Move down"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                        </svg>
                      </button>
                    </div>

                    {/* Remove */}
                    <button
                      onClick={() => removeRow(i)}
                      className="p-1 rounded text-slate-400 hover:text-red-600 flex-shrink-0 transition-colors"
                      title="Remove"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Media library picker */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
              {mediaAll.length > 0 && (
                <input
                  type="checkbox"
                  checked={pickerSelected.size === mediaAll.length}
                  ref={el => { if (el) el.indeterminate = pickerSelected.size > 0 && pickerSelected.size < mediaAll.length; }}
                  onChange={toggleAllAssets}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 flex-shrink-0 cursor-pointer"
                />
              )}
              <h3 className="text-sm font-semibold text-slate-700 flex-1">Add from library</h3>
              {pickerSelected.size > 0 && (
                <button
                  onClick={addSelected}
                  className="inline-flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add selected ({pickerSelected.size})
                </button>
              )}
            </div>
            {mediaAll.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-400">
                No media in library yet. Upload some on the Media page.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {mediaAll.map(asset => (
                  <div
                    key={asset.id}
                    onClick={() => toggleAssetSelection(asset.id)}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                      pickerSelected.has(asset.id) ? 'bg-indigo-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={pickerSelected.has(asset.id)}
                      onChange={() => toggleAssetSelection(asset.id)}
                      onClick={e => e.stopPropagation()}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 flex-shrink-0 cursor-pointer"
                    />
                    <AssetThumb type={asset.type} url={asset.url} filename={asset.filename} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 truncate">{asset.filename}</p>
                      <TypeBadge type={asset.type} />
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); addMedia(asset); }}
                      className="p-1 rounded text-indigo-400 hover:text-indigo-600 hover:bg-indigo-100 flex-shrink-0 transition-colors"
                      title="Add to playlist"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      ) : null}
    </div>
  );
}
