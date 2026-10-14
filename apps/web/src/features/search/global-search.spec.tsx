import { act, fireEvent, screen, within } from '@testing-library/react';
import { notifyManager } from '@tanstack/react-query';
import { Route, Routes, useLocation } from 'react-router-dom';
import type { SearchResult } from '@default-project/types';
import {
  fakeResponse,
  mockApi,
  renderWithProviders,
} from '../../testing/render';
import { GlobalSearch } from './global-search';

const RESULTS: SearchResult[] = [
  {
    type: 'project',
    id: 'p1',
    projectId: 'p1',
    title: 'Stadtvilla Taucha',
    subtitle: 'KF-2026-01 · Taucha',
    href: '/projects/p1',
  },
  {
    type: 'item',
    id: 'i1',
    projectId: 'p1',
    title: 'Heat pump Vaillant aroTHERM plus',
    subtitle: 'MAT-HEA-001 · Heating & ventilation · Stadtvilla Taucha',
    href: '/projects/p1/materials/heating?highlight=i1',
  },
];

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location">{location.pathname + location.search}</div>
  );
}

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

function renderSearch(results: SearchResult[] = RESULTS) {
  const fetchSpy = mockApi({ 'GET /api/search': () => fakeResponse(results) });
  renderWithProviders(
    <>
      <GlobalSearch />
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </>,
  );
  return fetchSpy;
}

const tick = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

async function type(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
  await tick(250);
  await tick(0);
}

describe('GlobalSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    notifyManager.setScheduler((cb) => cb());
  });
  afterEach(() => {
    notifyManager.setScheduler((cb) => setTimeout(cb, 0));
    vi.useRealTimers();
  });

  it('should focus the search when ⌘K or Ctrl+K is pressed [AC-13.4]', () => {
    renderSearch();
    const input = screen.getByRole('combobox', { name: 'Search' });

    fireEvent.keyDown(document, { key: 'k' });
    expect(document.activeElement).not.toBe(input);

    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(document.activeElement).toBe(input);

    input.blur();
    fireEvent.keyDown(document, { key: 'K', ctrlKey: true });
    expect(document.activeElement).toBe(input);
  });

  it('should navigate to the result when ↓ and Enter are pressed [AC-13.4]', async () => {
    renderSearch();
    const input = screen.getByRole('combobox', { name: 'Search' });
    await type(input, 'aro');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).toBe(
      screen.getAllByRole('option')[1].id,
    );
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByTestId('location').textContent).toBe(
      '/projects/p1/materials/heating?highlight=i1',
    );
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('should open the results page when Enter is pressed without an active option [AC-13.4]', async () => {
    renderSearch();
    const input = screen.getByRole('combobox', { name: 'Search' });
    await type(input, ' aro therm ');

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByTestId('location').textContent).toBe(
      '/search?q=aro%20therm',
    );
  });

  it('should close the results when Esc is pressed [AC-13.4]', async () => {
    renderSearch();
    const input = screen.getByRole('combobox', { name: 'Search' });
    await type(input, 'aro');
    const listbox = screen.getByRole('listbox', { name: 'Search results' });
    expect(within(listbox).getAllByRole('option')).toHaveLength(2);
    expect(
      within(listbox).getByRole('group', { name: 'Cost items' }),
    ).toBeTruthy();

    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByTestId('location').textContent).toBe('/');
  });

  it('should show "No results for …" when the API returns nothing [AC-13.5]', async () => {
    renderSearch([]);
    const input = screen.getByRole('combobox', { name: 'Search' });

    await type(input, 'zz');

    expect(screen.getByText('No results for “zz”')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('should show ErrorState when the API fails [AC-13.5]', async () => {
    mockApi({
      'GET /api/search': () => fakeResponse({ message: 'boom' }, 500),
    });
    renderWithProviders(<GlobalSearch />);
    const input = screen.getByRole('combobox', { name: 'Search' });

    await type(input, 'aro');

    expect(screen.getByRole('alert').textContent).toContain('Search failed');
    expect(screen.queryByText(/No results/)).toBeNull();
  });

  it('should not call the API when fewer than 2 characters are typed [AC-13.10]', async () => {
    const fetchSpy = renderSearch();
    const input = screen.getByRole('combobox', { name: 'Search' });

    await type(input, ' a ');
    await tick(1000);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByText('Type at least 2 characters')).toBeTruthy();
  });

  it('should call the API once only after the 250 ms debounce when typing [AC-13.10]', async () => {
    const fetchSpy = renderSearch();
    const input = screen.getByRole('combobox', { name: 'Search' });

    fireEvent.change(input, { target: { value: 'a' } });
    await tick(100);
    fireEvent.change(input, { target: { value: 'ar' } });
    await tick(100);
    fireEvent.change(input, { target: { value: 'aro' } });
    await tick(249);
    expect(fetchSpy).not.toHaveBeenCalled();

    await tick(1);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toBe('/api/search?q=aro');
  });

  describe('on mobile', () => {
    beforeEach(() => setMobile(true));

    it('should open a Sheet with a focused search input when the icon is tapped', async () => {
      renderSearch();
      expect(screen.queryByRole('combobox')).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Open search' }));
      await tick(0);

      const dialog = screen.getByRole('dialog', { name: 'Search' });
      expect(document.activeElement).toBe(
        within(dialog).getByRole('combobox', { name: 'Search' }),
      );
    });

    it('should close the list first and the Sheet second when Esc is pressed twice', async () => {
      renderSearch();
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
      await tick(0);
      const input = within(screen.getByRole('dialog')).getByRole('combobox', {
        name: 'Search',
      });
      await type(input, 'aro');

      fireEvent.keyDown(input, { key: 'Escape' });
      expect(screen.queryByRole('listbox')).toBeNull();
      expect(screen.getByRole('dialog')).toBeTruthy();

      fireEvent.keyDown(input, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('should close the Sheet when a result is picked', async () => {
      renderSearch();
      fireEvent.click(screen.getByRole('button', { name: 'Open search' }));
      await tick(0);
      const input = within(screen.getByRole('dialog')).getByRole('combobox', {
        name: 'Search',
      });
      await type(input, 'aro');

      fireEvent.click(screen.getAllByRole('option')[0]);

      expect(screen.getByTestId('location').textContent).toBe('/projects/p1');
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
