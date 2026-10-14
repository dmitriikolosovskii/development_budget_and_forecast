import { useEffect } from 'react';
import { X } from 'lucide-react';
import { showToast, useToastStore, type ToastMessage } from '../lib/toast-store';
import { cx, FOCUS, SOFT } from './cx';

const TOAST_TTL_MS = 5000;

const TONE: Record<ToastMessage['tone'], string> = {
  info: 'border-info-600/30',
  ok: 'border-ok-600/30',
  risk: 'border-risk-600/40 text-risk-600',
};

function ToastItem({ toast }: { toast: ToastMessage }) {
  const dismiss = useToastStore((s) => s.dismiss);
  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), TOAST_TTL_MS);
    return () => clearTimeout(timer);
  }, [dismiss, toast.id]);
  return (
    <div
      role="alert"
      className={cx(
        'pointer-events-auto flex items-start gap-3 rounded-xl border bg-surface px-4 py-3 text-sm shadow-[var(--shadow-soft)] animate-fade-in',
        TONE[toast.tone],
      )}
    >
      <span className="flex-1">{toast.text}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => dismiss(toast.id)}
        className={cx('rounded text-muted hover:text-ink', SOFT, FOCUS)}
      >
        <X aria-hidden className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Renders the toast stack; mounted once in AppShell. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-3 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4 sm:w-96">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

export function useToast() {
  return showToast;
}
