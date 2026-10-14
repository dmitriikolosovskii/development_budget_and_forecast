import type { ReactNode } from 'react';
import { cx } from './cx';

export type Tone = 'ok' | 'warn' | 'risk' | 'info' | 'brand' | 'muted';

export const TONE_CLASSES: Record<Tone, string> = {
  ok: 'bg-ok-50 text-ok-600',
  warn: 'bg-warn-50 text-warn-600',
  risk: 'bg-risk-50 text-risk-600',
  info: 'bg-info-50 text-info-600',
  brand: 'bg-brand-50 text-brand-600',
  muted: 'bg-subtle text-muted',
};

export interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
  title?: string;
  className?: string;
}

export function Badge({ tone = 'muted', children, title, className }: BadgeProps) {
  return (
    <span
      title={title}
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export interface PillProps {
  children: ReactNode;
  active?: boolean;
}

export function Pill({ children, active }: PillProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs',
        active ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-line text-muted',
      )}
    >
      {children}
    </span>
  );
}
