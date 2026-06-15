import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Location {
  id: string;
  name: string;
  notes: string | null;
  playlistId: string | null;
  playlist: { id: string; name: string } | null;
  _count: { devices: number };
}

interface Playlist {
  id: string;
  name: string;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  // Form state — editId null = create, string = edit that location
  const [formOpen, setFormOpen]         = useState(false);
  const [editId, setEditId]             = useState<string | null>(null);
  const [formName, setFormName]         = useState('');
  const [formNotes, setFormNotes]       = useState('');
  const [formPlaylistId, setFormPlaylistId] = useState('');
  const [formBusy, setFormBusy]         = useState(false);
  const [formError, setFormError]       = useState('');

  // Per-row delete state
  const [deletingId, setDeletingId]     = useState<string | null>(null);
  const [deleteError, setDeleteError]   = useState<{ id: string; msg: string } | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setError('');
    try {
      const [locs, pls] = await Promise.all([
        api.get<Location[]>('/locations'),
        api.get<Playlist[]>('/playlists'),
      ]);
      setLocations(locs);
      setPlaylists(pls);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Focus name field when form opens
  useEffect(() => {
    if (formOpen) setTimeout(() => nameRef.current?.focus(), 0);
  }, [formOpen]);

  // ── Form helpers ───────────────────────────────────────────────────────────

  function openCreate() {
    setEditId(null);
    setFormName('');
    setFormNotes('');
    setFormPlaylistId('');
    setFormError('');
    setFormOpen(true);
    setDeleteError(null);
  }

  function openEdit(loc: Location) {
    setEditId(loc.id);
    setFormName(loc.name);
    setFormNotes(loc.notes ?? '');
    setFormPlaylistId(loc.playlistId ?? '');
    setFormError('');
    setFormOpen(true);
    setDeleteError(null);
  }

  function closeForm() {
    setFormOpen(false);
    setEditId(null);
    setFormError('');
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = formName.trim();
    if (!name) return;
    setFormBusy(true);
    setFormError('');
    try {
      const body = {
        name,
        notes: formNotes.trim() || null,
        playlistId: formPlaylistId || null,
      };
      if (editId) {
        const updated = await api.patch<Location>(`/locations/${editId}`, body);
        setLocations(prev => prev.map(l => l.id === editId ? { ...l, ...updated } : l));
      } else {
        await api.post<Location>('/locations', body);
        await loadAll();
      }
      closeForm();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setFormBusy(false);
    }
  }

  async function handleDelete(loc: Location) {
    if (!confirm(`Delete "${loc.name}"?`)) return;
    setDeletingId(loc.id);
    setDeleteError(null);
    try {
      await api.delete(`/locations/${loc.id}`);
      setLocations(prev => prev.filter(l => l.id !== loc.id));
      if (editId === loc.id) closeForm();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Delete failed';
      setDeleteError({ id: loc.id, msg });
    } finally {
      setDeletingId(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Locations</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Define locations and assign default playlists to them.
          </p>
        </div>
        {!formOpen && (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Location
          </button>
        )}
      </div>

      {/* Top-level error */}
      {error && (
        <div className="mb-5 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      {/* Create / Edit form */}
      {formOpen && (
        <div className="mb-6 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-4">
            {editId ? 'Edit Location' : 'New Location'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                ref={nameRef}
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="e.g. Main Lobby"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Notes <span className="text-xs font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                placeholder="Floor, building, contact…"
                rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-none"
              />
            </div>

            {/* Default playlist */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Default playlist <span className="text-xs font-normal text-slate-400">(optional)</span>
              </label>
              <select
                value={formPlaylistId}
                onChange={e => setFormPlaylistId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-white"
              >
                <option value="">— None —</option>
                {playlists.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Form error */}
            {formError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                </svg>
                {formError}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={!formName.trim() || formBusy}
                className="inline-flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {formBusy && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4Z" />
                  </svg>
                )}
                {formBusy ? 'Saving…' : editId ? 'Save changes' : 'Create location'}
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="text-sm text-slate-500 hover:text-slate-700 px-2 py-2"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Location list */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-slate-400">Loading…</div>
      ) : locations.length === 0 && !formOpen ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white p-16 text-center">
          <svg className="mx-auto w-10 h-10 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
          </svg>
          <p className="text-sm font-medium text-slate-500">No locations yet</p>
          <p className="text-xs text-slate-400 mt-1">Click New Location to create one.</p>
        </div>
      ) : locations.length > 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-4 px-5 py-2.5 border-b border-slate-100 bg-slate-50">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Default playlist</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Devices</span>
            <span className="sr-only">Actions</span>
          </div>

          <div className="divide-y divide-slate-100">
            {locations.map(loc => (
              <div key={loc.id}>
                <div
                  className={`grid grid-cols-[1fr_1fr_auto_auto] gap-4 items-center px-5 py-4 ${
                    editId === loc.id ? 'bg-indigo-50' : 'hover:bg-slate-50'
                  } transition-colors`}
                >
                  {/* Name + notes */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{loc.name}</p>
                    {loc.notes && (
                      <p className="text-xs text-slate-400 truncate mt-0.5">{loc.notes}</p>
                    )}
                  </div>

                  {/* Playlist */}
                  <div className="min-w-0">
                    {loc.playlist ? (
                      <span className="inline-flex items-center gap-1 text-sm text-slate-600">
                        <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                        </svg>
                        <span className="truncate">{loc.playlist.name}</span>
                      </span>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </div>

                  {/* Device count */}
                  <div className="text-sm text-slate-500 whitespace-nowrap">
                    {loc._count.devices > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 7.409A2.25 2.25 0 0 1 2.25 5.493V5.25" />
                        </svg>
                        {loc._count.devices}
                      </span>
                    ) : (
                      <span className="text-slate-300">0</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => editId === loc.id ? closeForm() : openEdit(loc)}
                      className={`p-1.5 rounded-md text-sm transition-colors ${
                        editId === loc.id
                          ? 'bg-indigo-100 text-indigo-600'
                          : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                      }`}
                      title={editId === loc.id ? 'Close' : 'Edit'}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(loc)}
                      disabled={deletingId === loc.id}
                      className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                      title="Delete"
                    >
                      {deletingId === loc.id ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4Z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* 409 delete error shown inline under the offending row */}
                {deleteError?.id === loc.id && (
                  <div className="flex items-start gap-2 px-5 py-2.5 bg-red-50 border-t border-red-100 text-sm text-red-700">
                    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                    </svg>
                    <span>
                      {deleteError.msg}
                      {' — '}
                      <span className="font-medium">reassign or remove its devices before deleting.</span>
                    </span>
                    <button
                      onClick={() => setDeleteError(null)}
                      className="ml-auto text-red-400 hover:text-red-600"
                      title="Dismiss"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
