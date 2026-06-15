import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

type DeviceStatus = 'PENDING' | 'CLAIMED' | 'DISABLED';

interface Device {
  id: string;
  name: string | null;
  status: DeviceStatus;
  lastSeenAt: string | null;
  currentItemId: string | null;
  locationId: string | null;
  location: { id: string; name: string } | null;
  playlistId: string | null;
  playlist: { id: string; name: string } | null;
  createdAt: string;
}

interface Location {
  id: string;
  name: string;
}

interface Playlist {
  id: string;
  name: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < 2 * 60 * 1000;
}

// ── Small components ──────────────────────────────────────────────────────────

function StatusBadge({ device }: { device: Device }) {
  if (device.status === 'PENDING') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Pending
      </span>
    );
  }
  if (device.status === 'DISABLED') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        Disabled
      </span>
    );
  }
  const online = isOnline(device.lastSeenAt);
  return online ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      Online
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
      Offline
    </span>
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

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
      <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
      </svg>
      {msg}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function DevicesPage() {
  const [devices, setDevices]     = useState<Device[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  // Claim dialog
  const [claimOpen, setClaimOpen]         = useState(false);
  const [claimCode, setClaimCode]         = useState('');
  const [claimName, setClaimName]         = useState('');
  const [claimLocationId, setClaimLocationId] = useState('');
  const [claimPlaylistId, setClaimPlaylistId] = useState('');
  const [claimBusy, setClaimBusy]         = useState(false);
  const [claimError, setClaimError]       = useState('');

  // Edit form
  const [editId, setEditId]           = useState<string | null>(null);
  const [editName, setEditName]       = useState('');
  const [editLocationId, setEditLocationId] = useState('');
  const [editPlaylistId, setEditPlaylistId] = useState('');
  const [editBusy, setEditBusy]       = useState(false);
  const [editError, setEditError]     = useState('');

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const claimCodeRef = useRef<HTMLInputElement>(null);
  const editNameRef  = useRef<HTMLInputElement>(null);

  // ── Data loading ───────────────────────────────────────────────────────────

  const refreshDevices = useCallback(async () => {
    try {
      setDevices(await api.get<Device[]>('/devices'));
    } catch {
      // silent refresh — don't overwrite an existing error banner
    }
  }, []);

  useEffect(() => {
    Promise.all([
      api.get<Device[]>('/devices'),
      api.get<Location[]>('/locations'),
      api.get<Playlist[]>('/playlists'),
    ]).then(([devs, locs, pls]) => {
      setDevices(devs);
      setLocations(locs);
      setPlaylists(pls);
    }).catch(e => {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }).finally(() => setLoading(false));
  }, []);

  // Auto-refresh every 30 s
  useEffect(() => {
    const id = setInterval(refreshDevices, 30_000);
    return () => clearInterval(id);
  }, [refreshDevices]);

  // ── Focus helpers ──────────────────────────────────────────────────────────

  useEffect(() => { if (claimOpen)  setTimeout(() => claimCodeRef.current?.focus(), 0); }, [claimOpen]);
  useEffect(() => { if (editId)     setTimeout(() => editNameRef.current?.focus(),  0); }, [editId]);

  // ── Claim ──────────────────────────────────────────────────────────────────

  function openClaim() {
    setClaimCode(''); setClaimName(''); setClaimLocationId(''); setClaimPlaylistId('');
    setClaimError(''); setClaimOpen(true);
  }

  function closeClaim() { setClaimOpen(false); setClaimError(''); }

  async function handleClaim(e: React.FormEvent) {
    e.preventDefault();
    setClaimBusy(true); setClaimError('');
    try {
      const claimed = await api.post<Device>('/devices/claim', {
        pairingCode: claimCode.trim().toUpperCase(),
        name: claimName.trim(),
        locationId: claimLocationId,
        ...(claimPlaylistId ? { playlistId: claimPlaylistId } : {}),
      });
      setDevices(prev => [claimed, ...prev]);
      closeClaim();
    } catch (e) {
      setClaimError(e instanceof Error ? e.message : 'Claim failed');
    } finally {
      setClaimBusy(false);
    }
  }

  // ── Edit ───────────────────────────────────────────────────────────────────

  function openEdit(d: Device) {
    setEditId(d.id);
    setEditName(d.name ?? '');
    setEditLocationId(d.locationId ?? '');
    setEditPlaylistId(d.playlistId ?? '');
    setEditError('');
  }

  function closeEdit() { setEditId(null); setEditError(''); }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editId) return;
    setEditBusy(true); setEditError('');
    try {
      const updated = await api.patch<Device>(`/devices/${editId}`, {
        name: editName.trim() || null,
        locationId: editLocationId || null,
        playlistId: editPlaylistId || null,
      });
      setDevices(prev => prev.map(d => d.id === editId ? updated : d));
      closeEdit();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setEditBusy(false);
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function handleDelete(d: Device) {
    if (!confirm(`Delete device "${d.name ?? d.id}"?`)) return;
    setDeletingId(d.id);
    try {
      await api.delete(`/devices/${d.id}`);
      setDevices(prev => prev.filter(x => x.id !== d.id));
      if (editId === d.id) closeEdit();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Devices</h1>
          <p className="mt-0.5 text-sm text-slate-500">Pair and manage your display screens.</p>
        </div>
        <button
          onClick={openClaim}
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
          </svg>
          Claim device
        </button>
      </div>

      {error && <div className="mb-5"><ErrorBanner msg={error} /></div>}

      {/* Edit form */}
      {editId && (
        <div className="mb-6 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-4">Edit Device</h2>
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input
                ref={editNameRef}
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder="e.g. Lobby Screen"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
              <select
                value={editLocationId}
                onChange={e => setEditLocationId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-white"
              >
                <option value="">— None —</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Playlist override <span className="text-xs font-normal text-slate-400">(optional — uses location default if blank)</span>
              </label>
              <select
                value={editPlaylistId}
                onChange={e => setEditPlaylistId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-white"
              >
                <option value="">— Use location default —</option>
                {playlists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            {editError && <ErrorBanner msg={editError} />}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={editBusy}
                className="inline-flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {editBusy && <Spinner />}
                {editBusy ? 'Saving…' : 'Save changes'}
              </button>
              <button type="button" onClick={closeEdit} className="text-sm text-slate-500 hover:text-slate-700 px-2 py-2">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Device table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-slate-400">Loading…</div>
      ) : devices.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white p-16 text-center">
          <svg className="mx-auto w-10 h-10 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 7.409A2.25 2.25 0 0 1 2.25 5.493V5.25" />
          </svg>
          <p className="text-sm font-medium text-slate-500">No devices yet</p>
          <p className="text-xs text-slate-400 mt-1">Register a device and claim it with its pairing code.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Column header */}
          <div className="grid grid-cols-[2fr_1fr_1.5fr_1.5fr_1fr_auto] gap-4 px-5 py-2.5 border-b border-slate-100 bg-slate-50">
            {['Name', 'Status', 'Location', 'Playlist', 'Activity', ''].map(h => (
              <span key={h} className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</span>
            ))}
          </div>

          <div className="divide-y divide-slate-100">
            {devices.map(d => (
              <div
                key={d.id}
                className={`grid grid-cols-[2fr_1fr_1.5fr_1.5fr_1fr_auto] gap-4 items-center px-5 py-4 transition-colors ${
                  editId === d.id ? 'bg-indigo-50' : 'hover:bg-slate-50'
                }`}
              >
                {/* Name */}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {d.name ?? <span className="text-slate-400 italic">Unnamed</span>}
                  </p>
                  <p className="text-xs text-slate-400 font-mono truncate">{d.id.slice(0, 12)}…</p>
                </div>

                {/* Status */}
                <div><StatusBadge device={d} /></div>

                {/* Location */}
                <div className="min-w-0">
                  {d.location
                    ? <span className="text-sm text-slate-600 truncate block">{d.location.name}</span>
                    : <span className="text-sm text-slate-400">—</span>}
                </div>

                {/* Playlist override */}
                <div className="min-w-0">
                  {d.playlist
                    ? <span className="text-sm text-slate-600 truncate block">{d.playlist.name}</span>
                    : <span className="text-xs text-slate-400">location default</span>}
                </div>

                {/* Activity */}
                <div>
                  {d.currentItemId
                    ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Playing</span>
                    : <span className="text-xs text-slate-400">Idle</span>}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => editId === d.id ? closeEdit() : openEdit(d)}
                    className={`p-1.5 rounded-md transition-colors ${
                      editId === d.id
                        ? 'bg-indigo-100 text-indigo-600'
                        : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                    title={editId === d.id ? 'Close' : 'Edit'}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(d)}
                    disabled={deletingId === d.id}
                    className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                    title="Delete"
                  >
                    {deletingId === d.id
                      ? <Spinner className="w-4 h-4" />
                      : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Auto-refresh footnote */}
      {!loading && devices.length > 0 && (
        <p className="mt-3 text-xs text-slate-400 text-right">Status refreshes every 30 s</p>
      )}

      {/* ── Claim dialog ── */}
      {claimOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={closeClaim}
          />
          {/* Modal card */}
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-slate-800">Claim device</h2>
              <button
                onClick={closeClaim}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleClaim} className="space-y-4">
              {/* Pairing code */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Pairing code <span className="text-red-500">*</span>
                </label>
                <input
                  ref={claimCodeRef}
                  type="text"
                  value={claimCode}
                  onChange={e => setClaimCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6))}
                  placeholder="ABC123"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tracking-widest uppercase text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-slate-400">Shown on the device screen after registration.</p>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Device name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={claimName}
                  onChange={e => setClaimName(e.target.value)}
                  placeholder="e.g. Lobby Screen"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Location <span className="text-red-500">*</span>
                </label>
                <select
                  value={claimLocationId}
                  onChange={e => setClaimLocationId(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-white"
                >
                  <option value="">Select a location…</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>

              {/* Playlist (optional) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Playlist override <span className="text-xs font-normal text-slate-400">(optional)</span>
                </label>
                <select
                  value={claimPlaylistId}
                  onChange={e => setClaimPlaylistId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-white"
                >
                  <option value="">— Use location default —</option>
                  {playlists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {claimError && <ErrorBanner msg={claimError} />}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={claimBusy || !claimCode || !claimName || !claimLocationId}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {claimBusy && <Spinner />}
                  {claimBusy ? 'Claiming…' : 'Claim device'}
                </button>
                <button
                  type="button"
                  onClick={closeClaim}
                  className="text-sm text-slate-500 hover:text-slate-700 px-3 py-2"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
