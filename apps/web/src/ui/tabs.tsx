import { Link, useLocation } from 'react-router-dom';
import { cx, FOCUS, SOFT } from './cx';

export interface TabItem {
  label: string;
  /** Absolute route; the URL is the source of truth for the active tab. */
  to: string;
  /** Prefix that marks the tab active (default: `to`). Lets a tab link to a remembered sub-section. */
  match?: string;
}

export interface TabsProps {
  items: TabItem[];
  label: string;
}

function isActive(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Route-based tabs: a horizontal chip scroller on mobile, an underlined bar from `sm`. */
export function Tabs({ items, label }: TabsProps) {
  const { pathname } = useLocation();
  return (
    <div role="tablist" aria-label={label} className="-mx-1 flex min-w-0 gap-1 overflow-x-auto border-b border-line px-1">
      {items.map((item) => {
        const active = isActive(pathname, item.match ?? item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            role="tab"
            aria-selected={active}
            className={cx(
              'relative block shrink-0 rounded-t-lg px-3 py-2 text-sm whitespace-nowrap',
              SOFT,
              FOCUS,
              active
                ? 'font-semibold text-brand-600 after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-brand-500'
                : 'text-muted hover:bg-subtle hover:text-ink',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
