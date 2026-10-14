import { act, fireEvent, screen, within } from '@testing-library/react';
import { notifyManager } from '@tanstack/react-query';
import { Route, Routes, useLocation } from 'react-router-dom';
import {
  makeItem,
  makeLine,
  makeProject,
  makeSnapshot,
} from '@default-project/budget-engine';
import type { ProjectSnapshot } from '@default-project/types';
import { autosaveQueue } from '../../lib/autosave-queue';
import { queryKeys } from '../../lib/query-keys';
import {
  fakeResponse,
  mockApi,
  renderWithProviders,
  testQueryClient,
} from '../../testing/render';
import { normalise } from '../project/project-cache';
import { useEditItem } from '../project/use-edit-item';
import {
  BudgetVsForecastChart,
  CashflowSCurve,
  CostStructureDonut,
  WaterfallChart,
} from './charts';
import { ProfitabilityPage } from './profitability-page';

const PID = 'project-1';
const URL = `/projects/${PID}/profitability`;

// approved €10,000; one concrete item planned qty × €9,000 (forecast = planned while PLANNED)
function snapshot({ qtyMilli = 1000, markupBps = 1500 } = {}): ProjectSnapshot {
  return makeSnapshot({
    project: makeProject({ id: PID, markupBps }),
    budgetLines: [
      makeLine({
        id: 'con',
        projectId: PID,
        category: 'MATERIALS',
        section: 'concrete',
        name: 'Concrete & reinforcement',
        approvedCents: 1_000_000,
      }),
    ],
    items: [
      makeItem({
        id: 'i1',
        projectId: PID,
        budgetLineId: 'con',
        qtyMilli,
        unitPriceCents: 900_000,
        deliveryDate: '2026-11-03',
      }),
    ],
  });
}

function Location() {
  return <p data-testid="location">{useLocation().pathname}</p>;
}

function EditHarness() {
  const edit = useEditItem(PID);
  return (
    <button type="button" onClick={() => edit('i1', { qtyMilli: 2000 })}>
      double concrete
    </button>
  );
}

function renderPage(snap: ProjectSnapshot) {
  const client = testQueryClient();
  client.setQueryData(queryKeys.project(PID), normalise(snap));
  return renderWithProviders(
    <Routes>
      <Route
        path="/projects/:projectId/profitability"
        element={
          <>
            <ProfitabilityPage />
            <EditHarness />
          </>
        }
      />
      <Route path="*" element={<Location />} />
    </Routes>,
    { url: URL, client },
  );
}

const hero = (id: string) => screen.getByTestId(id).textContent ?? '';
const settle = async () => {
  for (let i = 0; i < 3; i++) await act(() => vi.advanceTimersByTimeAsync(0));
};

beforeAll(() => {
  // recharts' ResponsiveContainer needs ResizeObserver, which jsdom lacks (local stub; test-setup belongs to 02).
  if (!('ResizeObserver' in globalThis)) {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );
  }
});

describe('ProfitabilityPage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    notifyManager.setScheduler((cb) => cb());
    autosaveQueue.__reset();
  });
  afterEach(() => {
    autosaveQueue.__reset();
    notifyManager.setScheduler((cb) => setTimeout(cb, 0));
    vi.useRealTimers();
  });

  it('should recalculate contract price, profit and margin at once and send one PATCH after 400 ms when the markup changes to 12 % [AC-06.2]', async () => {
    const fetchMock = mockApi({
      [`PATCH /api/projects/${PID}`]: () =>
        fakeResponse({ ...snapshot().project, markupBps: 1200 }),
    });
    renderPage(snapshot());
    expect(hero('hero-contract-price')).toContain('€11,500');
    expect(hero('hero-forecast-profit')).toContain('€2,500');
    const marginBefore = screen.getByTestId('hero-margin').textContent;

    const input = screen.getByLabelText('Company markup %');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.change(input, { target: { value: '12' } });

    expect(hero('hero-contract-price')).toContain('€11,200');
    expect(hero('hero-forecast-profit')).toContain('€2,200');
    expect(screen.getByTestId('hero-margin').textContent).not.toBe(
      marginBefore,
    );
    const patches = () =>
      fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH');
    await act(() => vi.advanceTimersByTimeAsync(399));
    expect(patches()).toHaveLength(0);
    await act(() => vi.advanceTimersByTimeAsync(1));
    await settle();
    expect(patches()).toHaveLength(1);
    expect(JSON.parse(String(patches()[0][1]?.body))).toEqual({
      markupBps: 1200,
    });
  });

  it('should move the markup in 0.5 % steps with the slider [AC-06.2]', () => {
    mockApi({
      [`PATCH /api/projects/${PID}`]: () => fakeResponse(snapshot().project),
    });
    renderPage(snapshot());

    fireEvent.change(screen.getByLabelText('Company markup slider'), {
      target: { value: '1050' },
    });

    expect(hero('hero-contract-price')).toContain('€11,050');
    expect(
      (screen.getByLabelText('Company markup %') as HTMLInputElement).value,
    ).toBe('10.5');
  });

  it('should reject an invalid markup without saving it [AC-06.2]', async () => {
    const fetchMock = mockApi({});
    renderPage(snapshot());

    fireEvent.change(screen.getByLabelText('Company markup %'), {
      target: { value: 'abc' },
    });
    await act(() => vi.advanceTimersByTimeAsync(500));

    expect(
      screen.getByText('Enter a percentage between 0 and 30'),
    ).toBeTruthy();
    expect(hero('hero-contract-price')).toContain('€11,500');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should change EAC and profit without a reload when an item is edited elsewhere [AC-06.3]', () => {
    mockApi({
      [`PATCH /api/projects/${PID}/items/i1`]: () =>
        fakeResponse(snapshot({ qtyMilli: 2000 }).items[0]),
    });
    renderPage(snapshot());
    expect(hero('hero-forecast')).toContain('€9,000');

    fireEvent.click(screen.getByRole('button', { name: 'double concrete' }));

    expect(hero('hero-forecast')).toContain('€18,000');
    expect(hero('hero-forecast-profit')).toContain('-€6,500');
  });

  it('should show a negative profit in the risk tone with the label "Loss" [AC-06.4]', () => {
    renderPage(snapshot({ qtyMilli: 2000 }));

    const card = screen.getByTestId('hero-forecast-profit');
    expect(within(card).getByText(/Loss/)).toBeTruthy();
    expect(card.querySelector('.text-risk-600')).not.toBeNull();
    expect(within(card).queryByText(/Profit ·/)).toBeNull();
  });

  it('should not paint profit erosion red when the forecast is within budget [AC-06.13]', () => {
    renderPage(snapshot());

    expect(
      screen
        .getByTestId('hero-erosion')
        .querySelector('[data-tone]')
        ?.getAttribute('data-tone'),
    ).toBe('ok');
    expect(
      within(screen.getByTestId('hero-forecast-profit')).getByText(/Profit ·/),
    ).toBeTruthy();
  });

  it('should show margin 0 % and no NaN when the contract price is 0 [AC-06.13]', () => {
    const empty = makeSnapshot({
      project: makeProject({ id: PID }),
      budgetLines: [],
      items: [],
    });
    renderPage(empty);

    expect(screen.getByTestId('hero-margin').textContent).toBe('0%');
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
  });

  it('should open the line tab when a top-overruns row is clicked [AC-06.6]', () => {
    renderPage(snapshot({ qtyMilli: 2000 }));

    fireEvent.click(
      screen.getByRole('button', { name: 'Concrete & reinforcement' }),
    );

    expect(screen.getByTestId('location').textContent).toBe(
      `/projects/${PID}/materials/concrete`,
    );
  });
});

describe('profitability charts', () => {
  it('should render an empty state for every chart when there is no data [AC-06.5]', () => {
    renderWithProviders(
      <>
        <BudgetVsForecastChart rows={[]} />
        <WaterfallChart steps={[]} />
        <CostStructureDonut
          slices={[{ key: 'LAND', label: 'Land', value: 0 }]}
        />
        <CashflowSCurve months={[]} todayMonth="2026-10" />
      </>,
    );

    expect(screen.getAllByTestId('chart-empty')).toHaveLength(4);
  });

  it('should render charts with data without crashing [AC-06.5]', () => {
    renderWithProviders(
      <>
        <BudgetVsForecastChart
          rows={[
            {
              key: 'LAND',
              label: 'Land',
              approved: 1,
              actual: 1,
              openCommitments: 0,
              forecast: 1,
            },
          ]}
        />
        <CostStructureDonut
          slices={[{ key: 'LAND', label: 'Land', value: 5 }]}
        />
      </>,
    );

    expect(screen.queryAllByTestId('chart-empty')).toHaveLength(0);
    expect(screen.getByText('Budget vs forecast by category')).toBeTruthy();
  });
});
