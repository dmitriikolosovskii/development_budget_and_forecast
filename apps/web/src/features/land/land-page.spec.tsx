import { act, fireEvent, screen, within } from '@testing-library/react';
import { notifyManager } from '@tanstack/react-query';
import { Link, Route, Routes } from 'react-router-dom';
import type { ProjectSnapshot } from '@default-project/types';
import { autosaveQueue } from '../../lib/autosave-queue';
import { queryKeys } from '../../lib/query-keys';
import { useToastStore } from '../../lib/toast-store';
import {
  fakeResponse,
  mockApi,
  renderWithProviders,
  testQueryClient,
} from '../../testing/render';
import { Toaster } from '../../ui/toast';
import { normalise } from '../project/project-cache';
import { landSnapshot, makeLand } from './land.fixtures';
import { LandPage } from './land-page';

const PID = 'project-1';
const LAND_URL = `/projects/${PID}/land`;

function Harness() {
  return (
    <>
      <Link to={`/projects/${PID}/materials`}>Go to materials</Link>
      <Link to={LAND_URL}>Go to land</Link>
      <Routes>
        <Route path="/projects/:projectId/land" element={<LandPage />} />
        <Route
          path="/projects/:projectId/materials"
          element={<p>Materials tab</p>}
        />
      </Routes>
      <Toaster />
    </>
  );
}

function renderLand(
  snapshot: ProjectSnapshot,
  routes: Parameters<typeof mockApi>[0] = {},
) {
  const fetchMock = mockApi(routes);
  const client = testQueryClient();
  client.setQueryData(queryKeys.project(PID), normalise(snapshot));
  const view = renderWithProviders(<Harness />, { url: LAND_URL, client });
  const calls = (method: string, path: string) =>
    fetchMock.mock.calls.filter(
      ([url, init]) =>
        (init?.method ?? 'GET') === method && String(url).endsWith(path),
    );
  return { ...view, fetchMock, calls };
}

/** Lets promises and TanStack notifications run under fake timers. */
const settle = async () => {
  for (let i = 0; i < 3; i++) await act(() => vi.advanceTimersByTimeAsync(0));
};

function editField(name: string, text: string) {
  fireEvent.click(screen.getByRole('button', { name: `Edit ${name}` }));
  const input = screen.getByRole('textbox', { name });
  fireEvent.change(input, { target: { value: text } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

const region = (name: string) => screen.getByRole('region', { name });
const landResponse = (patch: object) => () =>
  fakeResponse({ ...makeLand(), ...patch });

describe('LandPage', () => {
  beforeEach(() => {
    autosaveQueue.__reset();
    useToastStore.setState({ toasts: [] });
  });
  afterEach(() => {
    autosaveQueue.__reset();
    vi.restoreAllMocks();
  });

  it('should show the "Soil risk" warn badge when groundwater is 150 cm [AC-07.3]', () => {
    renderLand(
      landSnapshot({
        land: { ...makeLand({ groundwaterDepthCm: 150 }), utilities: [] },
      }),
    );

    const soil = region('Soil');
    expect(within(soil).getByText('Soil risk')).toBeTruthy();
    expect(
      within(soil).getByText('Groundwater at 1.50 m (< 2 m)'),
    ).toBeTruthy();
    expect(within(soil).queryByText('Soil OK')).toBeNull();
  });

  it('should show "Soil OK" and no risk badge when groundwater is 7 m and the class is 4 [AC-07.3]', () => {
    renderLand(landSnapshot());

    const soil = region('Soil');
    expect(within(soil).getByText('Soil OK')).toBeTruthy();
    expect(within(soil).queryByText('Soil risk')).toBeNull();
  });

  it('should show 208 m² allowed and "Within limit" for a 90 m² house on 520 m² with GRZ 40 % [AC-07.2]', () => {
    renderLand(landSnapshot());

    const zoning = region('Zoning');
    expect(
      within(zoning).getByTestId('allowed-footprint').textContent,
    ).toContain('208 m²');
    expect(within(zoning).getByTestId('house-footprint').textContent).toContain(
      '90 m²',
    );
    expect(within(zoning).getByText('Within limit')).toBeTruthy();
    expect(within(zoning).queryByText('Exceeds limit')).toBeNull();
  });

  it('should show the plot price next to the purchase line and the connection costs per utility [AC-07.10]', () => {
    renderLand(landSnapshot());

    const plot = region('Plot');
    expect(within(plot).getByTestId('plot-price').textContent).toContain(
      '€135,200.00',
    );
    expect(within(plot).getByTestId('purchase-planned').textContent).toContain(
      '€135,200.00',
    );
    expect(within(plot).getByText('Matches plot price')).toBeTruthy();
    const utilities = region('Utilities');
    expect(
      within(utilities).getByTestId('utility-cost-POWER').textContent,
    ).toContain('€2,300.00');
    expect(
      within(utilities).getByTestId('utility-cost-WATER').textContent,
    ).toContain('€3,000.00');
    expect(
      within(utilities).getByTestId('utility-cost-GAS').textContent,
    ).toContain('—');
    expect(
      within(utilities).getByTestId('utility-cost-other').textContent,
    ).toContain('€900.00');
  });

  it('should show the CFO five answers for the LAND category [AC-07.5]', () => {
    renderLand(landSnapshot());

    const costs = screen.getByRole('region', { name: 'Land costs' });
    const panel = within(costs).getByLabelText('Budget health');
    expect(within(panel).getByText('Budget health · Land')).toBeTruthy();
    for (const label of [
      'Approved budget',
      'Spent (actual)',
      'Costs & obligations',
      'Forecast (EAC)',
      'Variance',
    ]) {
      expect(within(panel).getByText(label)).toBeTruthy();
    }
    // approved LAND = 135,200 + 10,140 + 11,000 + 3,500 = €159,840
    expect(within(panel).getByText('€159,840')).toBeTruthy();
  });

  it('should open the cost section that holds the ?highlight= row [AC-07.5]', () => {
    const fetchMock = mockApi({});
    const client = testQueryClient();
    client.setQueryData(queryKeys.project(PID), normalise(landSnapshot()));
    renderWithProviders(<Harness />, {
      url: `${LAND_URL}?highlight=i-sur`,
      client,
    });

    const costs = screen.getByRole('region', { name: 'Land costs' });
    expect(within(costs).getByText('Soil survey')).toBeTruthy();
    expect(within(costs).queryByText('Plot purchase')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should render an empty state without an OSM link and send nothing on mount when land is null [AC-07.9]', async () => {
    const { fetchMock, calls } = renderLand(landSnapshot({ land: null }), {
      [`PATCH /api/projects/${PID}/land`]: landResponse({ address: '' }),
    });

    expect(screen.getByText('No land details yet')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /OpenStreetMap/ })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Soil' })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Add land details' }));

    expect(
      await screen.findByRole('region', { name: 'Location' }),
    ).toBeTruthy();
    expect(calls('PATCH', '/land')).toHaveLength(1);
    expect(calls('PATCH', '/land')[0][1]?.body).toBe('{}');
  });

  it('should show the OpenStreetMap link in a new tab without an iframe [AC-07.9]', () => {
    const { container } = renderLand(landSnapshot());

    const link = screen.getByRole('link', { name: /Open in OpenStreetMap/ });
    expect(link.getAttribute('href')).toBe(
      'https://www.openstreetmap.org/?mlat=51.3801&mlon=12.4936#map=17/51.3801/12.4936',
    );
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(container.querySelector('iframe')).toBeNull();
  });

  describe('autosave', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      notifyManager.setScheduler((cb) => cb());
    });
    afterEach(() => {
      notifyManager.setScheduler((cb) => setTimeout(cb, 0));
      vi.useRealTimers();
    });

    it('should send exactly one PATCH 400 ms after editing the land value and keep it across tabs [AC-07.4]', async () => {
      const { calls } = renderLand(landSnapshot(), {
        [`PATCH /api/projects/${PID}/land`]: landResponse({
          landValuePerM2Cents: 30_000,
        }),
      });

      editField('Land value per m²', '300');
      editField('Area (m²)', '540');
      await act(() => vi.advanceTimersByTimeAsync(399));
      expect(calls('PATCH', '/land')).toHaveLength(0);
      await act(() => vi.advanceTimersByTimeAsync(1));
      await settle();

      expect(calls('PATCH', '/land')).toHaveLength(1);
      expect(JSON.parse(String(calls('PATCH', '/land')[0][1]?.body))).toEqual({
        landValuePerM2Cents: 30_000,
        areaM2: 540,
      });

      fireEvent.click(screen.getByRole('link', { name: 'Go to materials' }));
      expect(screen.getByText('Materials tab')).toBeTruthy();
      fireEvent.click(screen.getByRole('link', { name: 'Go to land' }));

      expect(
        screen.getByRole('button', { name: 'Edit Land value per m²' })
          .textContent,
      ).toContain('€300.00');
    });

    it('should roll the value back and show a toast when the PATCH fails [AC-07.8]', async () => {
      renderLand(landSnapshot(), {
        [`PATCH /api/projects/${PID}/land`]: () =>
          fakeResponse({ message: 'boom' }, 500),
      });

      editField('Land value per m²', '300');
      expect(
        screen.getByRole('button', { name: 'Edit Land value per m²' })
          .textContent,
      ).toContain('€300.00');
      await act(() => vi.advanceTimersByTimeAsync(400));
      await settle();

      expect(
        screen.getByRole('button', { name: 'Edit Land value per m²' })
          .textContent,
      ).toContain('€260.00');
      expect(screen.getByText(/Changes were not saved/)).toBeTruthy();
    });

    it('should keep a pending utility edit when a land save succeeds [AC-07.8]', async () => {
      const { calls } = renderLand(landSnapshot(), {
        [`PATCH /api/projects/${PID}/land/utilities/WATER`]: () =>
          new Promise<Response>(() => undefined),
        [`PATCH /api/projects/${PID}/land`]: landResponse({
          landValuePerM2Cents: 30_000,
        }),
      });

      editField('Water distance (m)', '9');
      editField('Land value per m²', '300');
      await act(() => vi.advanceTimersByTimeAsync(400));
      await settle();

      expect(calls('PATCH', '/land')).toHaveLength(1);
      expect(calls('PATCH', '/land/utilities/WATER')).toHaveLength(1);
      expect(
        screen.getByRole('button', { name: 'Edit Land value per m²' })
          .textContent,
      ).toContain('€300.00');
      expect(
        screen.getByRole('button', { name: 'Edit Water distance (m)' })
          .textContent,
      ).toContain('9 m');
    });
  });
});
