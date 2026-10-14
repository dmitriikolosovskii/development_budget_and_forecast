import { NavLink } from 'react-router-dom';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { NAV_CONFIG, type NavGroup } from '../nav-config';
import { useUiStore } from '../../lib/ui-store';
import { cx, FOCUS, SOFT } from '../../ui/cx';

interface NavListProps {
  collapsed: boolean;
  onNavigate?: () => void;
}

const linkClass = (collapsed: boolean) => ({ isActive }: { isActive: boolean }) =>
  cx(
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm',
    SOFT,
    FOCUS,
    collapsed && 'justify-center px-0',
    isActive ? 'bg-brand-50 font-medium text-brand-600' : 'text-ink hover:bg-subtle',
  );

function Label({ collapsed, children }: { collapsed: boolean; children: string }) {
  return (
    <span className={cx('whitespace-nowrap transition-opacity duration-200', collapsed && 'sr-only')}>{children}</span>
  );
}

function Group({ group, collapsed, onNavigate }: NavListProps & { group: NavGroup }) {
  const Icon = group.icon;
  if (!group.children) {
    return (
      <li>
        <NavLink to={group.to} className={linkClass(collapsed)} onClick={onNavigate} title={collapsed ? group.label : undefined}>
          <Icon aria-hidden className="h-5 w-5 shrink-0" />
          <Label collapsed={collapsed}>{group.label}</Label>
        </NavLink>
      </li>
    );
  }
  if (collapsed) {
    return (
      <li>
        <NavLink to={group.to} className={linkClass(true)} title={group.label}>
          <Icon aria-hidden className="h-5 w-5 shrink-0" />
          <Label collapsed>{group.label}</Label>
        </NavLink>
      </li>
    );
  }
  return (
    <li>
      <p className="flex items-center gap-3 px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">
        <Icon aria-hidden className="h-4 w-4" />
        {group.label}
      </p>
      <ul className="space-y-0.5 pl-3">
        {group.children.map((child) => (
          <li key={child.to}>
            <NavLink to={child.to} end className={linkClass(false)} onClick={onNavigate}>
              <child.icon aria-hidden className="h-4 w-4 shrink-0" />
              <Label collapsed={false}>{child.label}</Label>
            </NavLink>
          </li>
        ))}
      </ul>
    </li>
  );
}

export function NavList({ collapsed, onNavigate }: NavListProps) {
  return (
    <ul className="space-y-1">
      {NAV_CONFIG.map((group) => (
        <Group key={group.label} group={group} collapsed={collapsed} onNavigate={onNavigate} />
      ))}
    </ul>
  );
}

/** Desktop/tablet sidebar: 272px ↔ 76px, state persisted in useUiStore. */
export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  return (
    <aside
      data-collapsed={collapsed}
      className={cx(
        'sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-300 ease-[var(--ease-soft)] sm:flex',
        collapsed ? 'w-[76px]' : 'w-[272px]',
      )}
    >
      <nav aria-label="Main" className="flex-1 overflow-y-auto p-3">
        <NavList collapsed={collapsed} />
      </nav>
      <div className="border-t border-line p-3">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cx('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-subtle', SOFT, FOCUS, collapsed && 'justify-center px-0')}
        >
          {collapsed ? <ChevronsRight aria-hidden className="h-5 w-5" /> : <ChevronsLeft aria-hidden className="h-5 w-5" />}
          <Label collapsed={collapsed}>Collapse</Label>
        </button>
      </div>
    </aside>
  );
}

/** Mobile off-canvas drawer behind the burger. */
export function MobileDrawer() {
  const open = useUiStore((s) => s.mobileNavOpen);
  const setOpen = useUiStore((s) => s.setMobileNavOpen);
  if (!open) return null;
  const close = () => setOpen(false);
  return (
    <div className="fixed inset-0 z-40 sm:hidden">
      <div aria-hidden className="absolute inset-0 bg-ink/30 animate-fade-in" onClick={close} />
      <div role="dialog" aria-modal="true" aria-label="Navigation" className="absolute inset-y-0 left-0 w-72 bg-surface p-3 shadow-[var(--shadow-soft)] animate-fade-in">
        <nav aria-label="Main">
          <NavList collapsed={false} onNavigate={close} />
        </nav>
      </div>
    </div>
  );
}
