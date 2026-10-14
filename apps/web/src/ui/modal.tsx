import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useIsMobile } from '../lib/use-media-query';
import { cx, FOCUS, SOFT } from './cx';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Force a bottom sheet regardless of the viewport. */
  variant?: 'auto' | 'sheet';
}

/** Dialog with overlay; a bottom sheet on mobile. Esc and overlay click close it. */
export function Modal({ open, onClose, title, children, footer, variant = 'auto' }: ModalProps) {
  const isMobile = useIsMobile();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const asSheet = variant === 'sheet' || isMobile;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      <div aria-hidden className="absolute inset-0 bg-ink/30 animate-fade-in" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(
          'relative z-10 flex max-h-[90vh] w-full flex-col bg-surface shadow-[var(--shadow-soft)] outline-none',
          asSheet ? 'rounded-t-[var(--radius-card)] animate-slide-up' : 'max-w-2xl rounded-[var(--radius-card)] animate-scale-in',
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 id={titleId} className="text-base font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className={cx('rounded-lg p-1 text-muted hover:bg-subtle hover:text-ink', SOFT, FOCUS)}
          >
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export type SheetProps = Omit<ModalProps, 'variant'>;

/** Always a bottom sheet (mobile row editor). */
export function Sheet(props: SheetProps) {
  return <Modal {...props} variant="sheet" />;
}
