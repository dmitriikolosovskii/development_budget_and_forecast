import { act, fireEvent, screen, within } from '@testing-library/react';
import { Link } from 'react-router-dom';
import { autosaveQueue } from '../../lib/autosave-queue';
import { useUiStore } from '../../lib/ui-store';
import { fakeResponse, mockApi, renderWithProviders } from '../../testing/render';
import { AppRoutes } from '../routes';
import { AppShell } from './app-shell';

function setMobile(mobile: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: mobile && query.includes('max-width: 639px'),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

function renderShell(url = '/deliveries', children = <AppRoutes />) {
  mockApi({ 'GET /api/health': () => fakeResponse({ status: 'ok', db: 'up' }) });
  return renderWithProviders(<AppShell>{children}</AppShell>, { url });
}

describe('AppShell', () => {
  beforeEach(() => {
    useUiStore.setState({ sidebarCollapsed: false, mobileNavOpen: false, lastSection: {} });
    autosaveQueue.__reset();
  });

  it('should collapse and expand the sidebar and keep the state after a remount [AC-02.1]', async () => {
    const first = renderShell();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));

    expect(screen.getByRole('button', { name: 'Expand sidebar' }).getAttribute('aria-expanded')).toBe('false');
    expect(JSON.parse(localStorage.getItem('kairon-ui') ?? '{}').state.sidebarCollapsed).toBe(true);
    first.unmount();
    // Simulate a fresh page: reset memory, put the persisted value back, rehydrate from storage.
    const stored = localStorage.getItem('kairon-ui') ?? '';
    useUiStore.setState({ sidebarCollapsed: false });
    localStorage.setItem('kairon-ui', stored);
    await act(() => useUiStore.persist.rehydrate());

    renderShell();

    const toggle = screen.getByRole('button', { name: 'Expand sidebar' });
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Collapse sidebar' }).getAttribute('aria-expanded')).toBe('true');
  });

  it('should show the navigation as a drawer behind the burger on mobile [AC-02.8]', () => {
    setMobile(true);
    renderShell();
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));

    const drawer = screen.getByRole('dialog', { name: 'Navigation' });
    fireEvent.click(within(drawer).getByRole('link', { name: 'Analytics' }));
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull();
  });

  it('should flush pending saves when the route changes [AC-02.5]', () => {
    const flush = vi.spyOn(autosaveQueue, 'flush').mockResolvedValue(undefined);
    renderShell('/a', <Link to="/b">go</Link>);
    expect(flush).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('link', { name: 'go' }));

    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('should flush pending saves before the page unloads [AC-02.15]', () => {
    const flush = vi.spyOn(autosaveQueue, 'flush').mockResolvedValue(undefined);
    renderShell();

    window.dispatchEvent(new Event('beforeunload'));

    expect(flush).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['/projects/new', 'Calculate project'],
    ['/deliveries', 'Delivery tracking'],
    ['/analytics', 'Analytics'],
    ['/search?q=x', 'Search'],
  ])('should render the placeholder page for %s [AC-02.16]', (url, title) => {
    renderShell(url);

    expect(screen.getByRole('heading', { name: title })).toBeTruthy();
  });

  it('should redirect / to the projects list [AC-02.16]', async () => {
    mockApi({ 'GET /api/projects': () => fakeResponse([]), 'GET /api/health': () => fakeResponse({}, 503) });
    renderWithProviders(<AppShell><AppRoutes /></AppShell>, { url: '/' });

    expect(await screen.findByText('No projects yet')).toBeTruthy();
  });
});
