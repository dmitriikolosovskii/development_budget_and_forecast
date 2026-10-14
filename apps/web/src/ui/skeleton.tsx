import { cx } from './cx';

export interface SkeletonProps {
  className?: string;
  /** Number of stacked lines. */
  lines?: number;
}

export function Skeleton({ className, lines = 1 }: SkeletonProps) {
  return (
    <div data-testid="skeleton" aria-busy="true" aria-label="Loading" className="space-y-2">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={cx('h-4 animate-pulse rounded-md bg-subtle', className)} />
      ))}
    </div>
  );
}
