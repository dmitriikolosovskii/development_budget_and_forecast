import { act, fireEvent, screen } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import type { SearchResult } from '@default-project/types';
import {
  fakeResponse,
  mockApi,
  renderWithProviders,
} from '../../testing/render';
import { SearchPage } from './search-page';

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
    subtitle: 'MAT-HEA-001 · Heating & ventilation',
    href: '/projects/p1/materials/heating?highlight=i1',
  },
];

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location">{location.pathname + location.search}</div>
  );
}

function renderPage(
  url: string,
  search: () => Response = () => fakeResponse(RESULTS),
) {
  const fetchSpy = mockApi({ 'GET /api/search': search });
  renderWithProviders(
    <Routes>
      <Route
        path="/search"
        element={
          <>
            <SearchPage />
            <LocationProbe />
          </>
        }
      />
    </Routes>,
    { url },
  );
  return fetchSpy;
}

describe('SearchPage', () => {
  it('should show "No results for …" when the API returns nothing [AC-13.5]', async () => {
    renderPage('/search?q=zz', () => fakeResponse([]));

    expect(await screen.findByText('No results for “zz”')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('should show ErrorState when the API fails [AC-13.5]', async () => {
    renderPage('/search?q=zz', () =>
      fakeResponse({ message: 'Database is down' }, 500),
    );

    const alert = await screen.findByRole('alert');

    expect(alert.textContent).toContain('Database is down');
    expect(screen.queryByText(/No results/)).toBeNull();
  });

  it('should render the heading without calling the API when q has 1 character [AC-13.10]', () => {
    const fetchSpy = renderPage('/search?q=x');

    expect(screen.getByRole('heading', { name: 'Search' })).toBeTruthy();
    expect(screen.getByText('Type at least 2 characters')).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should list every type with links when no type filter is set', async () => {
    renderPage('/search?q=aro');

    const link = await screen.findByRole('link', { name: /Heat pump/ });

    expect(link.textContent).toContain('Heat pump Vaillant aroTHERM plus');
    expect(link.getAttribute('href')).toBe(
      '/projects/p1/materials/heating?highlight=i1',
    );
    expect(
      screen.getByRole('link', { name: /Stadtvilla Taucha/ }),
    ).toBeTruthy();
    expect(link.querySelector('mark')?.textContent).toBe('aro');
  });

  it('should show only items when ?type=item is set [AC-13.11]', async () => {
    renderPage('/search?q=aro&type=item');

    expect(await screen.findByRole('link', { name: /Heat pump/ })).toBeTruthy();
    expect(
      screen.queryByRole('link', { name: /Stadtvilla Taucha/ }),
    ).toBeNull();
    expect(
      screen
        .getByRole('button', { name: 'Cost items (1)' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('should update ?type= in the URL when a filter chip is clicked [AC-13.11]', async () => {
    renderPage('/search?q=aro');
    await screen.findByRole('link', { name: /Heat pump/ });

    fireEvent.click(screen.getByRole('button', { name: 'Projects (1)' }));

    expect(screen.getByTestId('location').textContent).toBe(
      '/search?q=aro&type=project',
    );
    expect(screen.queryByRole('link', { name: /Heat pump/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'All (2)' }));
    expect(screen.getByTestId('location').textContent).toBe('/search?q=aro');
  });

  it('should put the submitted query into the URL when the form is submitted', async () => {
    const fetchSpy = renderPage('/search');

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search query' }), {
      target: { value: ' arotherm ' },
    });
    await act(async () => {
      fireEvent.submit(screen.getByRole('search', { name: 'Search page' }));
    });

    expect(screen.getByTestId('location').textContent).toBe(
      '/search?q=arotherm',
    );
    await screen.findByRole('link', { name: /Heat pump/ });
    expect(String(fetchSpy.mock.calls[0][0])).toBe('/api/search?q=arotherm');
  });
});
