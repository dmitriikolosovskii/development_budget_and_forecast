import type { ReactNode } from 'react';
import { cx, FOCUS, SOFT } from './cx';
import { useIsMobile } from '../lib/use-media-query';

export interface SubNavItem {
  id: string;
  label: string;
  /** e.g. an overrun / late counter badge. */
  badge?: ReactNode;
}

export interface SubNavProps {
  items: SubNavItem[];
  active: string | undefined;
  onSelect: (id: string) => void;
  label?: string;
}

/** Sub-sections: a 220px left column from `lg`, a select on mobile, chips in between. */
export function SubNav({ items, active, onSelect, label = 'Sections' }: SubNavProps) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <label className="block text-sm">
        <span className="sr-only">{label}</span>
        <select
          aria-label={label}
          value={active ?? ''}
          onChange={(e) => onSelect(e.target.value)}
          className={cx('w-full rounded-lg border border-line bg-surface px-3 py-2', FOCUS)}
        >
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <nav aria-label={label} className="lg:w-[220px] lg:shrink-0">
      <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <li key={item.id}>
              <button
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelect(item.id)}
                className={cx(
                  'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm whitespace-nowrap',
                  SOFT,
                  FOCUS,
                  isActive ? 'bg-brand-50 font-medium text-brand-600' : 'text-ink hover:bg-subtle',
                )}
              >
                <span>{item.label}</span>
                {item.badge}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
