import { screen, within } from '@testing-library/react';
import { fakeResponse, mockApi, renderWithProviders } from '../testing/render';
import App from './app';

describe('App', () => {
  it('should render the shell with banner, main navigation and the API status [AC-02.9]', async () => {
    mockApi({
      'GET /api/health': () => fakeResponse({}, 503),
      'GET /api/projects': () => fakeResponse([]),
    });

    renderWithProviders(<App />, { url: '/projects' });

    const banner = screen.getByRole('banner');
    expect(within(banner).getByText('Kairon Budget')).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByText('Projects')).toBeTruthy();
    expect(within(nav).getByRole('link', { name: 'Calculate project' }).getAttribute('href')).toBe('/projects/new');
    expect(within(nav).getByRole('link', { name: 'Current projects' }).getAttribute('href')).toBe('/projects');
    expect(within(nav).getByRole('link', { name: 'Delivery tracking' })).toBeTruthy();
    expect(within(nav).getByRole('link', { name: 'Analytics' })).toBeTruthy();
    expect(await within(banner).findByText('API: unavailable')).toBeTruthy();
    expect(within(banner).getByRole('status').textContent).toBe('API: unavailable');
  });
});
