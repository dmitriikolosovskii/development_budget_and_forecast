import type { ReactNode } from 'react';
import { AlertTriangle, Construction, Inbox } from 'lucide-react';
import { Card } from './card';
import { cx, FOCUS, SOFT } from './cx';

export interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <Inbox aria-hidden className="h-8 w-8 text-muted" />
      <p className="font-medium text-ink">{title}</p>
      {description && <p className="max-w-md text-sm text-muted">{description}</p>}
      {action}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  error?: unknown;
  retry?: () => void;
}

export function ErrorState({ title = 'Something went wrong', error, retry }: ErrorStateProps) {
  const message = error instanceof Error ? error.message : undefined;
  return (
    <div role="alert" className="flex flex-col items-center gap-2 py-10 text-center">
      <AlertTriangle aria-hidden className="h-8 w-8 text-risk-600" />
      <p className="font-medium text-ink">{title}</p>
      {message && <p className="max-w-md text-sm text-muted">{message}</p>}
      {retry && (
        <button
          type="button"
          onClick={retry}
          className={cx('rounded-lg bg-brand-500 px-3 py-1.5 text-sm text-white hover:bg-brand-600', SOFT, FOCUS)}
        >
          Retry
        </button>
      )}
    </div>
  );
}

export interface ComingSoonProps {
  title: string;
  description?: string;
}

export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <Card className="animate-fade-in">
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <Construction aria-hidden className="h-8 w-8 text-brand-500" />
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <p className="text-sm text-muted">{description ?? 'This section is coming soon.'}</p>
      </div>
    </Card>
  );
}
