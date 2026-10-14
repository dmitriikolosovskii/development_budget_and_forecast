import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { autosaveQueue } from '../../lib/autosave-queue';
import { Toaster } from '../../ui/toast';
import { Header } from './header';
import { MobileDrawer, Sidebar } from './sidebar';

/** Flushes pending autosaves on route change and before the page unloads. */
function useAutosaveFlush() {
  const { pathname } = useLocation();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void autosaveQueue.flush();
  }, [pathname]);
  useEffect(() => {
    const onUnload = () => void autosaveQueue.flush();
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);
}

export interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  useAutosaveFlush();
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <Header />
      <MobileDrawer />
      <div className="flex">
        <Sidebar />
        <main className="min-w-0 flex-1 px-3 py-4 sm:px-6 sm:py-6">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
