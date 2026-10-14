import { act, fireEvent, screen, within } from '@testing-library/react';
import { notifyManager } from '@tanstack/react-query';
import { Route, Routes, useLocation } from 'react-router-dom';
import type { CostItem, ProjectSnapshot } from '@default-project/types';
import { autosaveQueue, AUTOSAVE_DELAY_MS } from '../../lib/autosave-queue';
import { queryKeys } from '../../lib/query-keys';
import { useUiStore } from '../../lib/ui-store';
import {
  fakeResponse,
  renderWithProviders,
  testQueryClient,
} from '../../testing/render';
import {
  applyItemPatch,
  normalise,
  type ProjectCache,
} from '../project/project-cache';
import { constructionSnapshot, patchItem, PID } from './construction-fixture';
import { ConstructionPage } from './construction-page';

const KEY = queryKeys.project(PID);

function LocationProbe() {
  const loc = useLocation();
  return (
    <output data-testid="location">{`${loc.pathname}${loc.search}`}</output>
  );
}

function setup(
  url: string,
  snapshot: ProjectSnapshot = constructionSnapshot(),
) {
  const rows = new Map(snapshot.items.map((i) => [i.id, i]));
  const fetchMock = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input, init) => {
      const path = String(input);
      if (init?.method === 'PATCH') {
        const id = path.split('/').pop() ?? '';
        const row: CostItem = {
          ...(rows.get(id) as CostItem),
          ...JSON.parse(String(init.body)),
        };
        rows.set(id, row);
        return fakeResponse(row);
      }
      return fakeResponse(
        { message: `No mock for ${init?.method ?? 'GET'} ${path}` },
        404,
      );
    });
  const client = testQueryClient();
  client.setQueryData<ProjectCache>(KEY, normalise(snapshot));
  const view = renderWithProviders(
    <Routes>
      <Route
        path="/projects/:projectId/construction/:section?"
        element={<ConstructionPage />}
      />
      <Route path="*" element={null} />
    </Routes>,
    { url, client },
  );
  const patches = () =>
    fetchMock.mock.calls
      .filter(([, init]) => init?.method === 'PATCH')
      .map(([input, init]) => ({
        url: String(input),
        body: JSON.parse(String(init?.body)),
      }));
  // Project reloads only (OrgCell loads the organisation list for its picker on its own).
  const gets = () =>
    fetchMock.mock.calls.filter(
      ([input, init]) =>
        (init?.method ?? 'GET') === 'GET' &&
        String(input).startsWith('/api/projects'),
    );
  return { client, view, patches, gets };
}

const renderAt = (section: string, snapshot?: ProjectSnapshot) =>
  setup(`/projects/${PID}/construction/${section}`, snapshot);

/** Lets TanStack notifications, promises and the queue settle (several rounds). */
const settle = async () => {
  for (let i = 0; i < 3; i++) await act(() => vi.advanceTimersByTimeAsync(0));
};

const banner = () =>
  screen.queryByRole('alert', { name: 'Schedule conflicts' });
const rowOf = (code: string) =>
  screen.getByText(code).closest('tr') as HTMLElement;

describe('ConstructionPage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    notifyManager.setScheduler((cb) => cb());
    autosaveQueue.__reset();
    useUiStore.setState({ lastSection: {} });
  });
  afterEach(() => {
    autosaveQueue.__reset();
    notifyManager.setScheduler((cb) => setTimeout(cb, 0));
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should show the late windows alert with "9 days" and mark the work Blocked [AC-05.1]', async () => {
    renderAt('windows-install');
    await settle();

    const items = within(banner() as HTMLElement).getAllByRole('listitem');
    expect(items[0].textContent).toContain(
      'Heat pump (MAT-HEA-001) arrive 20 Nov, 18 days',
    );
    expect(items[1].textContent).toContain(
      'Windows (MAT-WIN-001) arrive 28 Oct, 9 days after Window installation starts (19 Oct)',
    );
    const row = rowOf('WRK-WIN-001');
    expect(
      within(row).getByText('Blocked: Windows arrive 9 days late'),
    ).toBeTruthy();
    expect(row.querySelector('[data-conflict]')).not.toBeNull();
  });

  it('should drop the alert live when the delivery moves to the work start day [AC-05.2]', async () => {
    const { client, gets } = renderAt('windows-install');
    await settle();
    expect(banner()?.textContent).toContain('Windows (MAT-WIN-001)');

    // The same cache edit the Materials tab makes (useEditItem → setQueryData).
    act(() => {
      client.setQueryData<ProjectCache>(
        KEY,
        (c) => c && applyItemPatch(c, 'm-win', { deliveryDate: '2026-10-19' }),
      );
    });
    await settle();

    expect(banner()?.textContent).not.toContain('Windows (MAT-WIN-001)');
    expect(within(rowOf('WRK-WIN-001')).getByText('Ready')).toBeTruthy();
    expect(gets()).toHaveLength(0);
  });

  it('should shift the work start keeping the duration with exactly one PATCH [AC-05.3]', async () => {
    const { patches } = renderAt('windows-install');
    await settle();

    fireEvent.click(
      screen.getByRole('button', { name: 'Shift work start to 28 Oct' }),
    );
    await settle();
    expect(banner()?.textContent).not.toContain('Windows (MAT-WIN-001)');
    expect(patches()).toHaveLength(0);
    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS));
    await settle();

    expect(patches()).toEqual([
      {
        url: `/api/projects/${PID}/items/w-win`,
        body: { startDate: '2026-10-28', endDate: '2026-11-08' },
      },
    ]);
  });

  it('should reject an end before the start with "Invalid dates" and send no PATCH [AC-05.4]', async () => {
    const { patches } = renderAt('windows-install');
    await settle();
    const row = rowOf('WRK-WIN-001');

    fireEvent.click(within(row).getByRole('button', { name: 'Edit end date' }));
    const input = within(row).getByLabelText('end date');
    fireEvent.change(input, { target: { value: '2026-10-18' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS));
    await settle();

    expect(within(row).getByRole('alert').textContent).toContain(
      'Invalid dates',
    );
    expect(patches()).toHaveLength(0);
  });

  it('should show Invalid dates for a work whose stored end is before its start [AC-05.4]', async () => {
    renderAt(
      'shell',
      constructionSnapshot({
        items: patchItem('w-shell', { endDate: '2026-06-01' }),
      }),
    );
    await settle();

    expect(
      within(rowOf('WRK-SHL-001')).getByText('Invalid dates'),
    ).toBeTruthy();
    expect(banner()?.textContent).toContain(
      'Shell walls (WRK-SHL-001): end 1 Jun is before start 29 Jun',
    );
  });

  it('should draw a bar per work and a diamond per linked material, the late one in the risk tone [AC-05.5]', async () => {
    renderAt('windows-install');
    await settle();

    expect(screen.getAllByTestId('gantt-bar')).toHaveLength(3);
    const markers = screen.getAllByTestId('gantt-marker');
    expect(markers).toHaveLength(3);
    const late = markers.filter((m) => m.dataset.late);
    expect(late.map((m) => m.getAttribute('aria-label'))).toEqual([
      'Windows (MAT-WIN-001): 28 Oct 2026 — late for work',
      'Heat pump (MAT-HEA-001): 20 Nov 2026 — late for work',
    ]);
    expect(late.every((m) => m.className.includes('text-risk-600'))).toBe(true);
    const door = markers.find((m) =>
      m.getAttribute('aria-label')?.startsWith('Front door'),
    );
    expect(door?.className).not.toContain('text-risk-600');
    expect(screen.getByTestId('gantt-today')).toBeTruthy();
  });

  it('should show the reserve and its use by overruns without a table on contingency [AC-05.6]', async () => {
    renderAt('contingency');
    await settle();

    expect(screen.queryByRole('table')).toBeNull();
    const tile = (label: string) =>
      screen.getByText(label).nextElementSibling?.textContent;
    expect(tile('Reserve (approved)')).toBe('€20,000.00');
    expect(tile('Used by overruns')).toBe('€350.00');
    expect(tile('Remaining')).toBe('€19,650.00');
  });

  it('should badge each section with its number of conflicted works [AC-05.8]', async () => {
    renderAt('windows-install');
    await settle();

    const nav = screen.getByRole('navigation', {
      name: 'Construction sections',
    });
    expect(
      within(nav).getByRole('button', {
        name: /Window, door & stair installation/,
      }).textContent,
    ).toContain('1');
    expect(
      within(nav).getByRole('button', {
        name: /Heating & ventilation installation/,
      }).textContent,
    ).toContain('1');
    expect(
      within(nav).getByRole('button', { name: 'Shell construction' }),
    ).toBeTruthy();
    expect(
      within(nav).getByRole('button', { name: 'Contingency reserve' }),
    ).toBeTruthy();
  });

  it('should open the remembered section when none is in the URL and store a visited one [AC-05.9]', async () => {
    useUiStore.setState({ lastSection: { construction: 'heating-install' } });
    setup(`/projects/${PID}/construction`);
    await settle();
    expect(screen.getByText('WRK-HEA-001')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Shell construction' }));
    await settle();

    expect(useUiStore.getState().lastSection.construction).toBe('shell');
  });

  it('should open the first section when nothing is remembered [AC-05.9]', async () => {
    setup(`/projects/${PID}/construction`);
    await settle();

    expect(screen.getByText('WRK-SHL-001')).toBeTruthy();
  });

  it('should open the material row in Materials when its chip is clicked [AC-05.10]', async () => {
    renderWithProbe();
    await settle();

    fireEvent.click(
      within(rowOf('WRK-WIN-001')).getByRole('link', {
        name: /Windows · late/,
      }),
    );
    await settle();

    expect(screen.getByTestId('location').textContent).toBe(
      `/projects/${PID}/materials/windows-doors?highlight=m-win`,
    );
  });

  it('should PATCH the material requiredForWorkId when it is linked and null when unlinked [AC-05.11]', async () => {
    const { patches } = renderAt('heating-install');
    await settle();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Link materials to Heating installation',
      }),
    );
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /NYM-J/ }));
    fireEvent.click(
      within(dialog).getByRole('checkbox', { name: /Heat pump/ }),
    );
    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS));
    await settle();

    expect(patches()).toEqual(
      expect.arrayContaining([
        {
          url: `/api/projects/${PID}/items/m-ele`,
          body: { requiredForWorkId: 'w-hea' },
        },
        {
          url: `/api/projects/${PID}/items/m-hp`,
          body: { requiredForWorkId: null },
        },
      ]),
    );
    expect(patches()).toHaveLength(2);
  });

  it('should show which work a material is currently linked to [AC-05.11]', async () => {
    renderAt('heating-install');
    await settle();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Link materials to Heating installation',
      }),
    );

    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getAllByText(/currently: Window installation/)).toHaveLength(
      2,
    ); // windows + front door
    expect(dialog.queryByText(/currently: Heating installation/)).toBeNull(); // the heat pump is checked here instead
  });
});

function renderWithProbe() {
  const snapshot = constructionSnapshot();
  const client = testQueryClient();
  client.setQueryData<ProjectCache>(KEY, normalise(snapshot));
  return renderWithProviders(
    <Routes>
      <Route
        path="/projects/:projectId/construction/:section?"
        element={<ConstructionPage />}
      />
      <Route path="*" element={<LocationProbe />} />
    </Routes>,
    { url: `/projects/${PID}/construction/windows-install`, client },
  );
}
