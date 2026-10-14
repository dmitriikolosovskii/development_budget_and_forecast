import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

export function Card({ padded = true, className, ...rest }: CardProps) {
  return (
    <div
      className={cx(
        'rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-soft)]',
        padded && 'p-4 sm:p-5',
        className,
      )}
      {...rest}
    />
  );
}

export interface SectionTitleProps {
  children: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

export function SectionTitle({ children, subtitle, actions }: SectionTitleProps) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-base font-semibold text-ink">{children}</h2>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
