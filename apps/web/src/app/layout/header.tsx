import { Link } from 'react-router-dom';
import { Building2, Menu } from 'lucide-react';
import { HealthBadge } from '../../features/health/health-badge';
import { GlobalSearch } from '../../features/search/global-search';
import { useUiStore } from '../../lib/ui-store';
import { cx, FOCUS } from '../../ui/cx';

export function Header() {
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/90 px-3 backdrop-blur sm:px-4">
      <button
        type="button"
        aria-label="Open navigation"
        onClick={() => setMobileNavOpen(true)}
        className={cx('rounded-lg p-1.5 text-ink hover:bg-subtle sm:hidden', FOCUS)}
      >
        <Menu aria-hidden className="h-5 w-5" />
      </button>
      <Link to="/projects" className={cx('flex items-center gap-2 font-semibold text-ink', FOCUS)}>
        <Building2 aria-hidden className="h-5 w-5 text-brand-500" />
        <span className="hidden sm:inline">Kairon Budget</span>
      </Link>
      <div className="flex flex-1 justify-center">
        <GlobalSearch />
      </div>
      <div className="hidden text-xs text-muted md:block">
        <HealthBadge />
      </div>
    </header>
  );
}
