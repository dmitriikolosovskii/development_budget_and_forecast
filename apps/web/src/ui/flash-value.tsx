import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from './cx';

export interface FlashValueProps {
  /** Flashes (bg-brand-50 → transparent, 600 ms) whenever this value changes. */
  value: unknown;
  children: ReactNode;
  className?: string;
}

export function FlashValue({ value, children, className }: FlashValueProps) {
  const first = useRef(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setTick((t) => t + 1);
  }, [value]);
  return (
    <span key={tick} className={cx('rounded', tick > 0 && 'animate-flash', className)}>
      {children}
    </span>
  );
}
