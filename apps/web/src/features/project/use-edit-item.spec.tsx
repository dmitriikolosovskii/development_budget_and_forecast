import { act, fireEvent, render, screen } from '@testing-library/react';
import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { makeItem, makeLine, makeSnapshot } from '@default-project/budget-engine';
import type { CostItem } from '@default-project/types';
import { autosaveQueue, AUTOSAVE_DELAY_MS } from '../../lib/autosave-queue';
import { queryKeys } from '../../lib/query-keys';
import { useToastStore } from '../../lib/toast-store';
import { KpiStrip } from '../../ui/kpi-strip';
import { Toaster } from '../../ui/toast';
import { normalise, type ProjectCache } from './project-cache';
import { useEditItem } from './use-edit-item';
import { useProjectSummary } from './use-project-summary';

const PID = 'project-1';
const KEY = queryKeys.project(PID);

function fakeResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, text: async () => JSON.stringify(body), json: async () => body } as Response;
}

function snapshot(qtyMilli = 1000) {
  const line = makeLine({ id: 'l1', approvedCents: 100_000 });
  const a = makeItem({ id: 'a', budgetLineId: 'l1', qtyMilli, unitPriceCents: 50_000 });
  const b = makeItem({ id: 'b', budgetLineId: 'l1', qtyMilli: 0, unitPriceCents: 0, code: 'MAT-TST-900' });
  return makeSnapshot({ budgetLines: [line], items: [a, b] });
}

function Harness({ qty }: { qty: number }) {
  const summary = useProjectSummary(PID);
  const edit = useEditItem(PID);
  return (
    <>
      <KpiStrip summary={summary?.project} />
      <button type="button" onClick={() => edit('a', { qtyMilli: qty })}>
        set {qty}
      </button>
    </>
  );
}

function setup(fetchImpl: (url: string, init?: RequestInit) => Promise<Response>) {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => fetchImpl(String(input), init));
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  qc.setQueryData<ProjectCache>(KEY, normalise(snapshot()));
  const ui = (
    <QueryClientProvider client={qc}>
      <Harness qty={2000} />
      <Harness qty={3000} />
      <Toaster />
    </QueryClientProvider>
  );
  const view = render(ui);
  const patches = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH');
  return { qc, view, fetchMock, patches };
}

/** Lets pending promises and TanStack's 0 ms notify ticks run (several rounds: fetch → queue → cache → render). */
const settle = async () => {
  for (let i = 0; i < 3; i++) await act(() => vi.advanceTimersByTimeAsync(0));
};
const kpi = (label: string) => screen.getAllByText(label)[0].nextElementSibling?.textContent;

function patchedRow(body: string | undefined): CostItem {
  return { ...snapshot().items[0], ...JSON.parse(body ?? '{}') };
}

describe('useEditItem', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Deliver TanStack notifications synchronously: its default 0 ms setTimeout is faked here.
    notifyManager.setScheduler((cb) => cb());
    autosaveQueue.__reset();
    useToastStore.setState({ toasts: [] });
  });
  afterEach(() => {
    autosaveQueue.__reset();
    notifyManager.setScheduler((cb) => setTimeout(cb, 0));
    vi.useRealTimers();
  });

  it('should update the KPI at once and send exactly one merged PATCH 400 ms later [AC-02.4]', async () => {
    const { patches } = setup(async (_url, init) => fakeResponse(patchedRow(init?.body as string)));
    expect(kpi('Forecast (EAC)')).toBe('€500');

    fireEvent.click(screen.getAllByRole('button', { name: 'set 2000' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'set 3000' })[0]);
    await settle(); // TanStack notifies observers on the next tick; no PATCH has been sent yet

    expect(kpi('Forecast (EAC)')).toBe('€1,500');
    expect(kpi('Variance')).toBe('-€500');
    expect(patches()).toHaveLength(0);
    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 1));
    expect(patches()).toHaveLength(0);

    await act(() => vi.advanceTimersByTimeAsync(1));

    expect(patches()).toHaveLength(1);
    expect(patches()[0][0]).toBe('/api/projects/project-1/items/a');
    expect(JSON.parse(patches()[0][1]?.body as string)).toEqual({ qtyMilli: 3000 });
    expect(patches()[0][1]?.keepalive).toBe(true);
  });

  it('should roll back to the confirmed row and show a toast when the PATCH fails [AC-02.4] [AC-02.13]', async () => {
    const { qc } = setup(async () => fakeResponse({ message: 'qtyMilli must not be greater than 2000000000' }, 400));
    const otherRow = qc.getQueryData<ProjectCache>(KEY)?.itemsById['b'];

    fireEvent.click(screen.getAllByRole('button', { name: 'set 3000' })[0]);
    await settle();
    expect(kpi('Forecast (EAC)')).toBe('€1,500');
    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS));
    await settle();

    expect(kpi('Forecast (EAC)')).toBe('€500');
    expect(screen.getByRole('alert').textContent).toContain('qtyMilli must not be greater than 2000000000');
    expect(qc.getQueryData<ProjectCache>(KEY)?.itemsById['b']).toBe(otherRow);
  });

  it('should still send the PATCH when the editing component unmounts before 400 ms [AC-02.5]', async () => {
    const { view, patches } = setup(async (_url, init) => fakeResponse(patchedRow(init?.body as string)));

    fireEvent.click(screen.getAllByRole('button', { name: 'set 3000' })[0]);
    view.unmount();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);

    expect(patches()).toHaveLength(1);
  });

  it('should keep an unconfirmed edit when the project is refetched [AC-02.14]', async () => {
    const { qc } = setup(async (url, init) =>
      init?.method === 'PATCH' ? new Promise<Response>(() => undefined) : fakeResponse(snapshot(1000)),
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'set 3000' })[0]);
    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS));
    await act(() => qc.refetchQueries({ queryKey: KEY }));

    expect(qc.getQueryData<ProjectCache>(KEY)?.itemsById['a'].qtyMilli).toBe(3000);
    expect(kpi('Forecast (EAC)')).toBe('€1,500');
  });

  it('should keep a newer pending edit when an older save succeeds [AC-02.12]', async () => {
    let release: (r: Response) => void = () => undefined;
    const { qc } = setup(
      (_url, init) =>
        new Promise<Response>((resolve) => {
          release = () => resolve(fakeResponse(patchedRow(init?.body as string)));
        }),
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'set 2000' })[0]);
    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS));
    fireEvent.click(screen.getAllByRole('button', { name: 'set 3000' })[0]);
    await act(async () => release(fakeResponse({})));
    await settle();

    expect(qc.getQueryData<ProjectCache>(KEY)?.itemsById['a'].qtyMilli).toBe(3000);
  });

  it('should invalidate the projects list and analytics after a successful save [AC-02.15]', async () => {
    const { qc } = setup(async (_url, init) => fakeResponse(patchedRow(init?.body as string)));
    const invalidate = vi.spyOn(qc, 'invalidateQueries');

    fireEvent.click(screen.getAllByRole('button', { name: 'set 3000' })[0]);
    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS));
    await settle();

    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(['projects']);
    expect(keys).toContainEqual(['analytics']);
    expect(keys).not.toContainEqual(KEY);
  });
});
