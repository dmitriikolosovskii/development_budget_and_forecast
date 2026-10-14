import { fireEvent, screen, within } from '@testing-library/react';
import { Route, Routes, useParams } from 'react-router-dom';
import {
  fakeResponse,
  mockApi,
  renderWithProviders,
} from '../../testing/render';
import { AnalyticsPage } from './analytics-page';
import {
  makeAnalyticsProjects,
  makeAnalyticsResponse,
} from './portfolio-fixture';

// jsdom has no ResizeObserver; recharts' ResponsiveContainer only needs the methods to exist.
const noop = () => undefined;
// 06's recharts components are covered by 06; here they are plain stubs (no layout in jsdom).
vi.mock('../profitability/charts', () => ({
  BudgetVsForecastChart: ({ rows }: { rows: unknown[] }) => (
    <div data-testid="budget-vs-forecast">{rows.length}</div>
  ),
  CashflowSCurve: ({ months }: { months: unknown[] }) => (
    <div data-testid="cashflow">{months.length}</div>
  ),
}));

class ResizeObserverStub {
  observe = noop;
  unobserve = noop;
  disconnect = noop;
}
beforeAll(() => vi.stubGlobal('ResizeObserver', ResizeObserverStub));
afterAll(() => vi.unstubAllGlobals());

function ProfitabilityStub() {
  const { projectId } = useParams();
  return <p>Profitability of {projectId}</p>;
}

function renderPage(url = '/analytics') {
  return renderWithProviders(
    <Routes>
      <Route path="/analytics" element={<AnalyticsPage />} />
      <Route
        path="/projects/:projectId/profitability"
        element={<ProfitabilityStub />}
      />
      <Route path="/projects/new" element={<p>Wizard</p>} />
    </Routes>,
    { url },
  );
}

const projectRows = () =>
  within(screen.getByRole('table', { name: 'Projects' }))
    .getAllByRole('row')
    .slice(1);

describe('AnalyticsPage', () => {
  it('should render the portfolio KPIs and every project when loaded', async () => {
    mockApi({
      'GET /api/analytics/portfolio': () =>
        fakeResponse(makeAnalyticsResponse()),
    });

    renderPage();

    const kpis = await screen.findByLabelText('Portfolio KPIs');
    expect(within(kpis).getByText('Projects over budget')).toBeTruthy();
    expect(within(kpis).getByText('1 of 3')).toBeTruthy();
    expect(projectRows()).toHaveLength(3);
    expect(screen.getByTestId('budget-vs-forecast').textContent).toBe('3');
    // fixture cash flow spans 2024-11 … 2027-06 → 32 continuous months
    expect(screen.getByTestId('cashflow').textContent).toBe('32');
  });

  it('should send the demo today to the API', async () => {
    const fetchSpy = mockApi({
      'GET /api/analytics/portfolio': () =>
        fakeResponse(makeAnalyticsResponse()),
    });

    renderPage();
    await screen.findByLabelText('Portfolio KPIs');

    expect(String(fetchSpy.mock.calls[0][0])).toBe(
      '/api/analytics/portfolio?today=2026-10-14',
    );
  });

  it('should show EmptyState and a Calculate project link when the portfolio is empty [AC-11.4]', async () => {
    mockApi({
      'GET /api/analytics/portfolio': () =>
        fakeResponse(makeAnalyticsResponse([])),
    });

    renderPage();

    expect(await screen.findByText('No projects yet')).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: 'Calculate project' })
        .getAttribute('href'),
    ).toBe('/projects/new');
    expect(screen.queryByLabelText('Portfolio KPIs')).toBeNull();
    expect(screen.queryByRole('table', { name: 'Projects' })).toBeNull();
  });

  it('should leave only Markranstädt in the table when the status filter is Completed [AC-11.5]', async () => {
    mockApi({
      'GET /api/analytics/portfolio': () =>
        fakeResponse(makeAnalyticsResponse()),
    });
    renderPage();
    await screen.findByLabelText('Portfolio KPIs');

    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'COMPLETED' },
    });

    expect(projectRows()).toHaveLength(1);
    expect(projectRows()[0].textContent).toContain('Bungalow Markranstädt');
    expect(
      screen.queryByRole('link', { name: 'Stadtvilla Taucha' }),
    ).toBeNull();
    expect(
      within(screen.getByLabelText('Portfolio KPIs')).getByText('0 of 1'),
    ).toBeTruthy();
  });

  it('should keep only projects of the chosen year when a period chip is pressed [AC-11.8]', async () => {
    mockApi({
      'GET /api/analytics/portfolio': () =>
        fakeResponse(makeAnalyticsResponse()),
    });
    renderPage();
    await screen.findByLabelText('Portfolio KPIs');

    fireEvent.click(screen.getByRole('button', { name: '2025' }));

    expect(
      screen.getByRole('button', { name: '2025' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(projectRows().map((r) => r.textContent)).toEqual([
      expect.stringContaining('Markranstädt'),
    ]);
  });

  it('should sort the table by a column and toggle the direction [AC-11.9]', async () => {
    mockApi({
      'GET /api/analytics/portfolio': () =>
        fakeResponse(makeAnalyticsResponse()),
    });
    renderPage();
    await screen.findByLabelText('Portfolio KPIs');
    const header = screen.getByRole('columnheader', { name: 'Variance' });
    const order = () =>
      projectRows().map(
        (r) =>
          within(r).getAllByRole('cell')[0].querySelector('a')?.textContent,
      );
    const before = order();

    fireEvent.click(within(header).getByRole('button'));
    const asc = order();
    fireEvent.click(within(header).getByRole('button'));

    expect(header.getAttribute('aria-sort')).toBe('descending');
    // variances: Markranstädt 0, Taucha −10,000, Markkleeberg +50,000
    expect(asc).toEqual([
      'Stadtvilla Taucha',
      'Bungalow Markranstädt',
      'Villa Markkleeberg',
    ]);
    expect(order()).toEqual([
      'Villa Markkleeberg',
      'Bungalow Markranstädt',
      'Stadtvilla Taucha',
    ]);
    expect(asc).not.toEqual(before);
  });

  it('should open the project Profitability tab when a row is clicked [AC-11.10]', async () => {
    mockApi({
      'GET /api/analytics/portfolio': () =>
        fakeResponse(makeAnalyticsResponse()),
    });
    renderPage();
    await screen.findByLabelText('Portfolio KPIs');

    fireEvent.click(
      screen
        .getByRole('columnheader', { name: 'Status' })
        .querySelector('button') as HTMLElement,
    );
    expect(screen.queryByText(/Profitability of/)).toBeNull();
    fireEvent.click(within(projectRows()[0]).getAllByRole('cell')[2]);

    expect(await screen.findByText(/Profitability of p-/)).toBeTruthy();
  });

  it('should show a skeleton while loading and keep the heading [AC-11.12]', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise(() => undefined),
    );

    renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Analytics' }),
    ).toBeTruthy();
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('Portfolio KPIs')).toBeNull();
  });

  it('should show an error with Retry that refetches when the API fails [AC-11.12]', async () => {
    let calls = 0;
    mockApi({
      'GET /api/analytics/portfolio': () =>
        ++calls === 1
          ? fakeResponse({ message: 'boom' }, 500)
          : fakeResponse(makeAnalyticsResponse()),
    });
    renderPage();

    const alert = await screen.findByRole('alert');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Analytics' }),
    ).toBeTruthy();
    expect(screen.queryByText('No projects yet')).toBeNull();
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));

    expect(await screen.findByLabelText('Portfolio KPIs')).toBeTruthy();
    expect(calls).toBe(2);
  });

  it('should treat a malformed response as an error, not as data', async () => {
    const [first] = makeAnalyticsProjects();
    const broken = {
      ...makeAnalyticsResponse(),
      projects: [{ ...first, cashflow: undefined }],
    };
    mockApi({ 'GET /api/analytics/portfolio': () => fakeResponse(broken) });

    renderPage();

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByLabelText('Portfolio KPIs')).toBeNull();
  });
});
