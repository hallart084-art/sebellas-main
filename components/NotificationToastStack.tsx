import React, { memo, useEffect } from 'react';

interface NotificationToast {
 id: string;
 title: string;
 message: string;
}

interface NotificationToastStackProps {
 toasts: NotificationToast[];
 onDismiss: (id: string) => void;
}

const NotificationToastStack: React.FC<NotificationToastStackProps> = ({ toasts, onDismiss }) => {
 useEffect(() => {
 if (toasts.length === 0) return;
 const timers = toasts.map((toast) =>
 window.setTimeout(() => onDismiss(toast.id), 4200)
 );
 return () => {
 timers.forEach((timer) => window.clearTimeout(timer));
 };
 }, [toasts, onDismiss]);

 if (toasts.length === 0) return null;

 return (
 <div className="fixed top-4 right-4 z-[1300] flex flex-col gap-2 w-[min(90vw,360px)]">
 {toasts.map((toast) => (
 <div key={toast.id} className="rounded-xl border border-indigo-300/40 bg-slate-900 text-slate-100 shadow-xl px-3 py-2">
 <div className="flex items-start justify-between gap-2">
 <div>
 <div className="text-[12px] font-semibold">{toast.title}</div>
 <div className="text-[12px] text-slate-300 mt-0.5">{toast.message}</div>
 </div>
 <button type="button" className="opacity-80 hover:opacity-100" onClick={() => onDismiss(toast.id)}>
 <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default memo(NotificationToastStack);
