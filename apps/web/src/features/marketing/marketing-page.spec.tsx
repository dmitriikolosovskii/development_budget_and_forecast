import { act, fireEvent, screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { notifyManager } from '@tanstack/react-query';
import {
  makeItem,
  makeLine,
  makeOrg,
  makeProject,
  makeSnapshot,
} from '@default-project/budget-engine';
import { BUDGET_CATALOG, type ProjectSnapshot } from '@default-project/types';
import { autosaveQueue, AUTOSAVE_DELAY_MS } from '../../lib/autosave-queue';
import { useUiStore } from '../../lib/ui-store';
import {
  fakeResponse,
  mockApi,
  renderWithProviders,
} from '../../testing/render';
import { ProjectPage } from '../project/project-page';
import { MarketingPage } from './marketing-page';

const PID = 'p1';
const MARKETING = BUDGET_CATALOG.filter((c) => c.category === 'MARKETING');
const AGENCY = makeOrg({
  id: 'org-ag',
  name: 'Nordlicht Immobilienmarketing GmbH',
  role: 'AGENCY',
  contactPerson: 'Paul Hartig',
});

const APPROVED: Record<string, number> = {
  listings: 160_000,
  'paid-search': 270_000,
  social: 300_000,
};

/**
 * 8 MARKETING lines + one CONSTRUCTION line that sets the size of the contract price.
 * Marketing forecast = listings 1,600 + paid-search 2,700 + social 3,000 = €7,300 (all PLANNED).
 */
function fixture(constructionApprovedCents: number): ProjectSnapshot {
  const lines = [
    ...MARKETING.map((c) =>
      makeLine({
        id: `m-${c.section}`,
        projectId: PID,
        category: 'MARKETING',
        section: c.section,
        name: c.name,
        sortOrder: c.sortOrder,
        approvedCents: APPROVED[c.section] ?? 0,
      }),
    ),
    makeLine({
      id: 'c-shell',
      projectId: PID,
      category: 'CONSTRUCTION',
      section: 'shell',
      name: 'Shell construction',
      approvedCents: constructionApprovedCents,
    }),
  ];
  const srv = (
    id: string,
    section: string,
    code: string,
    qty: number,
    price: number,
    extra = {},
  ) =>
    makeItem({
      id,
      projectId: PID,
      budgetLineId: `m-${section}`,
      kind: 'SERVICE',
      code,
      name: id,
      unit: 'lump',
      qtyMilli: qty * 1000,
      unitPriceCents: price,
      ...extra,
    });
  return makeSnapshot({
    project: makeProject({ id: PID, markupBps: 1500 }),
    budgetLines: lines,
    organizations: [AGENCY],
    items: [
      srv('ImmoScout24 package', 'listings', 'SRV-LST-001', 4, 40_000, {
        startDate: '2026-11-01',
        endDate: '2027-02-28',
      }),
      srv('Google Ads', 'paid-search', 'SRV-SEA-001', 1, 270_000, {
        startDate: '2026-11-01',
        endDate: '2027-02-28',
      }),
      srv('Meta lead ads', 'social', 'SRV-SOC-001', 3, 100_000, {
        startDate: '2026-10-01',
        endDate: '2026-12-31',
        contractorId: AGENCY.id,
      }),
    ],
  });
}

function setup(snapshot: ProjectSnapshot, url: string) {
  const fetchMock = mockApi({
    [`GET /api/projects/${PID}`]: () => fakeResponse(snapshot),
    [`PATCH /api/projects/${PID}/items/`]: () =>
      fakeResponse(snapshot.items[0]),
    'GET /api/organizations': () => fakeResponse([AGENCY]),
  });
  renderWithProviders(
    <Routes>
      <Route path="/projects/:projectId" element={<ProjectPage />}>
        <Route path="marketing/:section?" element={<MarketingPage />} />
      </Route>
    </Routes>,
    { url },
  );
  const patches = () =>
    fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH');
  return { fetchMock, patches };
}

const settle = async () => {
  for (let i = 0; i < 3; i++) await act(() => vi.advanceTimersByTimeAsync(0));
};

function editMoney(label: string, value: string) {
  fireEvent.click(screen.getByRole('button', { name: `Edit ${label}` }));
  fireEvent.change(screen.getByRole('textbox', { name: label }), {
    target: { value },
  });
  fireEvent.keyDown(screen.getByRole('textbox', { name: label }), {
    key: 'Enter',
  });
}

// The KPI strip, not the BudgetHealthPanel, which uses the same dt label.
const kpi = (label: string) =>
  screen
    .getAllByText(label, { selector: 'dt' })
    .find((el) => !el.closest('[aria-label="Budget health"]'))
    ?.nextElementSibling?.textContent;
// Sub-nav buttons carry an optional "Over" badge in their accessible name.
const navButton = (nav: HTMLElement, name: string) =>
  within(nav).getByRole('button', { name: new RegExp(`^${name}`) });
const legend = (name: string) =>
  within(screen.getByRole('list', { name: 'Channel mix legend' })).getByRole(
    'listitem',
    { name },
  );
const healthForecast = () =>
  within(screen.getByLabelText('Budget health')).getByText(
    (_, el) =>
      el?.tagName === 'DT' &&
      el.textContent?.startsWith('Forecast (EAC)') === true,
  ).nextElementSibling?.textContent;

describe('MarketingPage', () => {
  beforeEach(() => {
    useUiStore.setState({ lastSection: {} });
    autosaveQueue.__reset();
  });

  afterEach(() => {
    autosaveQueue.__reset();
  });

  describe('with fake timers', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      notifyManager.setScheduler((cb) => cb());
    });

    afterEach(() => {
      notifyManager.setScheduler((cb) => setTimeout(cb, 0));
      vi.useRealTimers();
    });

    it('should list the 8 marketing sections and keep an edit when switching sections [AC-09.1]', async () => {
      const { patches } = setup(
        fixture(60_000_000),
        `/projects/${PID}/marketing/listings`,
      );
      await settle();

      const nav = screen.getByRole('navigation', {
        name: 'Marketing channels',
      });
      expect(within(nav).getAllByRole('button')).toHaveLength(8);
      expect(navButton(nav, 'Sales commission')).toBeTruthy();

      editMoney('Unit price SRV-LST-001', '500.00');
      fireEvent.click(navButton(nav, 'Paid search'));
      await settle();
      expect(screen.getByText('SRV-SEA-001')).toBeTruthy();
      expect(screen.queryByText('SRV-LST-001')).toBeNull();

      fireEvent.click(navButton(nav, 'Property portals'));
      await settle();
      expect(
        screen.getByRole('button', { name: 'Edit Unit price SRV-LST-001' })
          .textContent,
      ).toBe('€500.00');

      await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS));
      await settle();
      expect(patches()).toHaveLength(1);
      expect(JSON.parse(patches()[0][1]?.body as string)).toEqual({
        unitPriceCents: 50_000,
      });
    });

    it('should update the donut legend, the MARKETING total and the KPI at once when paid-search cost changes [AC-09.2]', async () => {
      const { patches } = setup(
        fixture(60_000_000),
        `/projects/${PID}/marketing/paid-search`,
      );
      await settle();
      expect(legend('Paid search').textContent).toContain('€2,700');
      expect(healthForecast()).toBe('€7,300');
      expect(kpi('Forecast (EAC)')).toBe('€7,300');

      editMoney('Unit price SRV-SEA-001', '3,600.00');
      await settle();

      expect(legend('Paid search').textContent).toContain('€3,600');
      expect(healthForecast()).toBe('€8,200');
      expect(kpi('Forecast (EAC)')).toBe('€8,200');
      expect(patches()).toHaveLength(0);

      await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS));
      await settle();
      expect(patches()).toHaveLength(1);
    });
  });

  it('should flag a campaign as Running now when today is between its start and end [AC-09.3]', async () => {
    setup(fixture(60_000_000), `/projects/${PID}/marketing/social`);

    const row = (await screen.findByText('SRV-SOC-001')).closest(
      'tr',
    ) as HTMLElement;
    expect(
      within(row).getByText('Running now', { selector: 'span' }),
    ).toBeTruthy();
    expect(within(row).queryByText('Planned', { selector: 'span' })).toBeNull();
  });

  it('should show a Planned flag when the campaign starts after today [AC-09.3]', async () => {
    setup(fixture(60_000_000), `/projects/${PID}/marketing/paid-search`);

    const row = (await screen.findByText('SRV-SEA-001')).closest(
      'tr',
    ) as HTMLElement;
    // `span` = the campaign badge, not the "Planned" option of the status select
    expect(within(row).getByText('Planned', { selector: 'span' })).toBeTruthy();
    expect(
      within(row).queryByText('Running now', { selector: 'span' }),
    ).toBeNull();
  });

  it('should show an ok badge when the marketing share is at most 5 % of the contract price [AC-09.4]', async () => {
    // approved 600,000 + 7,300 → contract price 698,395; 7,300 / 698,395 = 1.05 %
    setup(fixture(60_000_000), `/projects/${PID}/marketing/listings`);

    const card = await screen.findByLabelText('Marketing share');
    expect(within(card).getByText('Within 5%')).toBeTruthy();
    expect(within(card).queryByText('Above 5%')).toBeNull();
  });

  it('should show a warn badge when the marketing share is above 5 % of the contract price [AC-09.4]', async () => {
    // approved 10,000 + 7,300 → contract price 19,895; 7,300 / 19,895 = 36.7 %
    setup(fixture(1_000_000), `/projects/${PID}/marketing/listings`);

    const card = await screen.findByLabelText('Marketing share');
    expect(within(card).getByText('Above 5%')).toBeTruthy();
    expect(within(card).queryByText('Within 5%')).toBeNull();
  });

  it('should open the organisation modal when the agency is clicked [AC-09.5]', async () => {
    setup(fixture(60_000_000), `/projects/${PID}/marketing/social`);

    fireEvent.click(await screen.findByRole('button', { name: AGENCY.name }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(AGENCY.name)).toBeTruthy();
    expect(within(dialog).getByText(/Paul Hartig/)).toBeTruthy();
  });

  it('should open the remembered section when the URL has no section', async () => {
    useUiStore.setState({ lastSection: { marketing: 'events' } });
    setup(fixture(60_000_000), `/projects/${PID}/marketing`);

    const nav = await screen.findByRole('navigation', {
      name: 'Marketing channels',
    });
    expect(
      await within(nav).findByRole('button', {
        name: 'Show house & open days',
        current: 'page',
      }),
    ).toBeTruthy();
  });
});
