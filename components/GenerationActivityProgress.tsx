import React, { useState, useEffect, useRef } from 'react';

export interface ActivityLogItem {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  workerIndex?: number;
}

interface GenerationActivityProgressProps {
  isLoading: boolean;
  totalJobs: number;
  completedJobs: number;
  activeWorkers: number;
  currentConcept?: string;
  logs: ActivityLogItem[];
  onClearLogs?: () => void;
}

export const GenerationActivityProgress: React.FC<GenerationActivityProgressProps> = ({
  isLoading,
  totalJobs,
  completedJobs,
  activeWorkers,
  currentConcept,
  logs,
}) => {
  const [showLogs, setShowLogs] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);

  const percent = totalJobs > 0 ? Math.min(100, Math.round((completedJobs / totalJobs) * 100)) : 0;

  useEffect(() => {
    if (showLogs && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, showLogs]);

  if (!isLoading && logs.length === 0) {
    return null;
  }

  return (
    <div className="w-full rounded-2xl bg-[#141416] border border-white/[0.08] p-5 shadow-2xl text-white flex flex-col gap-3.5 transition-all">
      {/* Header with Title & Concurrency Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${isLoading ? 'bg-indigo-500 animate-ping' : 'bg-emerald-500'}`} />
          <span className="text-xs font-bold uppercase tracking-wider text-gray-200">
            {isLoading ? 'Aktivitas Proses AI (Real-time)' : 'Proses Selesai'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {activeWorkers > 1 && (
            <span className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <span className="material-symbols-outlined text-xs">bolt</span>
              <span>{activeWorkers} API Worker Berpikir Sekaligus</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => setShowLogs(prev => !prev)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-white px-2 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">
              {showLogs ? 'expand_less' : 'expand_more'}
            </span>
            <span>{showLogs ? 'Sembunyikan Log' : 'Buka Log'}</span>
          </button>
        </div>
      </div>

      {/* Progress Bar & Percentage */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-400 truncate max-w-[70%]">
            {isLoading ? (
              currentConcept ? `Sedang memproses: "${currentConcept}"` : 'Menghasilkan prompt...'
            ) : (
              logs.some(l => l.type === 'error') 
                ? (logs.some(l => l.type === 'success') ? 'Proses selesai dengan beberapa error' : 'Semua proses gagal')
                : 'Semua prompt berhasil dibuat!'
            )}
          </span>
          <span className="font-bold text-indigo-400">
            {percent}% ({completedJobs}/{totalJobs})
          </span>
        </div>

        <div className="w-full h-2.5 bg-black/40 rounded-full overflow-hidden border border-white/[0.06] p-0.5">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 rounded-full transition-all duration-300 ease-out shadow-[0_0_12px_rgba(99,102,241,0.5)]"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Live Activity Log Terminal */}
      {showLogs && (
        <div className="w-full max-h-48 overflow-y-auto bg-black/50 border border-white/[0.06] rounded-xl p-3 font-mono text-[11px] flex flex-col gap-1.5 scrollbar-thin scrollbar-thumb-white/10">
          {logs.map((log) => {
            let badgeColor = 'text-gray-400';
            let icon = 'info';

            if (log.type === 'success') {
              badgeColor = 'text-emerald-400';
              icon = 'check_circle';
            } else if (log.type === 'warning') {
              badgeColor = 'text-amber-400';
              icon = 'warning';
            } else if (log.type === 'error') {
              badgeColor = 'text-red-400';
              icon = 'cancel';
            }

            return (
              <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                <span className="text-gray-500 text-[10px] select-none shrink-0 pt-0.5">
                  [{log.timestamp}]
                </span>
                <span className={`material-symbols-outlined text-xs shrink-0 pt-0.5 ${badgeColor}`}>
                  {icon}
                </span>
                {log.workerIndex !== undefined && (
                  <span className="px-1.5 py-0.2 rounded bg-white/[0.08] text-gray-300 text-[10px] shrink-0">
                    W#{log.workerIndex}
                  </span>
                )}
                <span className={`flex-1 break-words ${badgeColor}`}>
                  {log.message}
                </span>
              </div>
            );
          })}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  );
};
