import { useCallback, useEffect, useRef, useState } from 'react';
import { auth } from '../auth/auth';

interface MediaAsset {
  id: string;
  type: 'IMAGE' | 'VIDEO' | 'WEB';
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  url: string;
}

type QueueStatus = 'pending' | 'uploading' | 'done' | 'error';
interface QueueItem {
  id: string;
  file: File;
  status: QueueStatus;
  progress: number;
  error?: string;
}

// Worker-pool concurrency: limit simultaneous in-flight uploads
async function runWithConcurrency(
  tasks: (() => Promise<void>)[],
  limit: number,
): Promise<void> {
  let index = 0;
  async function worker() {
    while (index < tasks.length) {
      await tasks[index++]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
}

function uploadWithProgress(
  file: File,
  onProgress: (pct: number) => void,
): Promise<MediaAsset> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append('file', file);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as MediaAsset);
        } catch {
          reject(new Error('Invalid response'));
        }
      } else if (xhr.status === 401) {
        auth.clearToken();
        window.location.href = '/login';
        reject(new Error('Session expired'));
      } else {
        let msg = `HTTP ${xhr.status}`;
        try { msg = (JSON.parse(xhr.responseText) as { message?: string }).message ?? msg; } catch { /* ignore */ }
        reject(new Error(msg));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error')));
    xhr.addEventListener('abort', () => reject(new Error('Cancelled')));

    xhr.open('POST', '/api/media');
    const token = auth.getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(form);
  });
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function UploadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className ?? 'w-4 h-4'}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4Z" />
    </svg>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: MediaAsset['type'] }) {
  const styles: Record<MediaAsset['type'], string> = {
    IMAGE: 'bg-blue-100 text-blue-700',
    VIDEO: 'bg-purple-100 text-purple-700',
    WEB:   'bg-green-100 text-green-700',
  };
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-medium ${styles[type]}`}>
      {type}
    </span>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Upload queue panel ─────────────────────────────────────────────────────────

function QueuePanel({
  queue,
  onDismiss,
}: {
  queue: QueueItem[];
  onDismiss: () => void;
}) {
  const done    = queue.filter(q => q.status === 'done').length;
  const failed  = queue.filter(q => q.status === 'error').length;
  const total   = queue.length;
  const allSettled = queue.every(q => q.status === 'done' || q.status === 'error');

  const summaryText = allSettled
    ? `${done} uploaded${failed ? `, ${failed} failed` : ''}`
    : `Uploading ${done + failed} / ${total}…`;

  return (
    <div className="mb-5 bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50">
        <span className="text-sm font-medium text-slate-700">{summaryText}</span>
        {allSettled && (
          <button
            onClick={onDismiss}
            className="text-slate-400 hover:text-slate-600 text-xs px-2 py-0.5 rounded hover:bg-slate-200 transition-colors"
          >
            Dismiss
          </button>
        )}
      </div>

      {/* Rows */}
      <ul className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
        {queue.map((item) => (
          <li key={item.id} className="px-4 py-2.5">
            <div className="flex items-center gap-3">
              {/* Status icon */}
              <div className="flex-shrink-0">
                {item.status === 'pending'   && <div className="w-4 h-4 rounded-full border-2 border-slate-300" />}
                {item.status === 'uploading' && <SpinnerIcon className="w-4 h-4 text-indigo-500" />}
                {item.status === 'done'      && (
                  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                )}
                {item.status === 'error'     && (
                  <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                )}
              </div>

              {/* Name + progress */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-700 truncate" title={item.file.name}>
                    {item.file.name}
                  </span>
                  <span className="text-[11px] text-slate-400 flex-shrink-0">
                    {formatBytes(item.file.size)}
                  </span>
                </div>
                {item.status === 'uploading' && (
                  <div className="mt-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-150"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
                {item.status === 'error' && (
                  <p className="mt-0.5 text-[11px] text-red-500">{item.error}</p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const CONCURRENCY = 3;

export function MediaPage() {
  const [assets, setAssets]       = useState<MediaAsset[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [queue, setQueue]         = useState<QueueItem[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dragCount, setDragCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDragging = dragCount > 0;
  const isUploading = queue.some(q => q.status === 'pending' || q.status === 'uploading');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = auth.getToken();
      const res = await fetch('/api/media', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 401) { auth.clearToken(); window.location.href = '/login'; return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAssets(await res.json() as MediaAsset[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load media');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleFiles(files: File[]) {
    if (files.length === 0) return;

    const items: QueueItem[] = files.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      status: 'pending',
      progress: 0,
    }));

    setQueue(items);

    const tasks = items.map((item) => async () => {
      setQueue(q => q.map(qi => qi.id === item.id ? { ...qi, status: 'uploading' } : qi));
      try {
        await uploadWithProgress(item.file, (pct) => {
          setQueue(q => q.map(qi => qi.id === item.id ? { ...qi, progress: pct } : qi));
        });
        setQueue(q => q.map(qi => qi.id === item.id ? { ...qi, status: 'done', progress: 100 } : qi));
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Upload failed';
        setQueue(q => q.map(qi => qi.id === item.id ? { ...qi, status: 'error', error: msg } : qi));
      }
    });

    await runWithConcurrency(tasks, CONCURRENCY);
    await load();
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    void handleFiles(files);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragCount(0);
    const files = Array.from(e.dataTransfer.files).filter(
      f => f.type.startsWith('image/') || f.type.startsWith('video/')
    );
    void handleFiles(files);
  }

  async function handleDelete(asset: MediaAsset) {
    if (!confirm(`Delete "${asset.filename}"?`)) return;
    setDeletingId(asset.id);
    try {
      const token = auth.getToken();
      const res = await fetch(`/api/media/${asset.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 401) { auth.clearToken(); window.location.href = '/login'; return; }
      if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div
      onDragEnter={() => setDragCount(c => c + 1)}
      onDragLeave={() => setDragCount(c => c - 1)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className={`relative transition-all duration-150 ${isDragging ? 'ring-2 ring-indigo-400 ring-offset-4 rounded-xl bg-indigo-50/40' : ''}`}
    >
      {/* Drag overlay label */}
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-indigo-400">
          <div className="flex flex-col items-center gap-2 text-indigo-600">
            <UploadIcon />
            <span className="text-sm font-medium">Drop files to upload</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Media</h1>
          <p className="mt-0.5 text-sm text-slate-500">Upload and manage images and videos. Drag and drop multiple files anywhere on this page.</p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={handleFileInputChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            <UploadIcon />
            Upload
          </button>
        </div>
      </div>

      {/* Upload queue */}
      {queue.length > 0 && (
        <QueuePanel queue={queue} onDismiss={() => setQueue([])} />
      )}

      {/* Library error */}
      {error && (
        <div className="mb-5 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      {/* Grid / empty state */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-slate-400">Loading…</div>
      ) : assets.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white p-16 text-center">
          <svg className="mx-auto w-10 h-10 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 0 0 1.5-1.5v-15a1.5 1.5 0 0 0-1.5-1.5H3.75a1.5 1.5 0 0 0-1.5 1.5v15a1.5 1.5 0 0 0 1.5 1.5Z" />
          </svg>
          <p className="text-sm font-medium text-slate-500">No media yet</p>
          <p className="text-xs text-slate-400 mt-1">Click Upload or drop files here to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="group relative bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-slate-300 hover:shadow-sm transition-all"
            >
              <div className="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
                {asset.type === 'IMAGE' ? (
                  <img src={asset.url} alt={asset.filename} className="w-full h-full object-cover" loading="lazy" />
                ) : asset.type === 'VIDEO' ? (
                  <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                ) : (
                  <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
                  </svg>
                )}
              </div>

              <button
                onClick={() => handleDelete(asset)}
                disabled={deletingId === asset.id}
                className="absolute top-2 right-2 p-1 bg-white/90 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-md border border-slate-200 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                title="Delete"
              >
                {deletingId === asset.id ? <SpinnerIcon className="w-3.5 h-3.5" /> : <TrashIcon />}
              </button>

              <div className="px-2.5 py-2">
                <p className="text-xs font-medium text-slate-700 truncate" title={asset.filename}>
                  {asset.filename}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <TypeBadge type={asset.type} />
                  <span className="text-[11px] text-slate-400">{formatBytes(asset.sizeBytes)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
