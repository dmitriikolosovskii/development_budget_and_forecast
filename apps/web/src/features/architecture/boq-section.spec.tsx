import { act, fireEvent, screen } from '@testing-library/react';
import { formatEur, makeItem, makeLine, makeSnapshot } from '@default-project/budget-engine';
import { autosaveQueue, AUTOSAVE_DELAY_MS } from '../../lib/autosave-queue';
import { queryKeys } from '../../lib/query-keys';
import { useToastStore } from '../../lib/toast-store';
import { fakeResponse, mockApi, renderWithProviders, testQueryClient } from '../../testing/render';
import { normalise, type ProjectCache } from '../project/project-cache';
import { useProjectSummary } from '../project/use-project-summary';
import { makeComponent, makePlan } from './architecture-fixtures';
import { BoqSection } from './boq-section';

const PID = 'project-1';

// concrete component 50 m³, linked to one MATERIAL row at €192.50/m³ → €9,625.00 planned
function snapshot() {
  return makeSnapshot({
    budgetLines: [makeLine({ id: 'l-con', category: 'MATERIALS', section: 'concrete', approvedCents: 2_190_000 })],
    items: [
      makeItem({
        id: 'mat-1',
        budgetLineId: 'l-con',
        code: 'MAT-CON-001',
        kind: 'MATERIAL',
        unit: 'm3',
        qtyMilli: 50_000,
        unitPriceCents: 19_250,
        boqComponentId: 'boq-1',
      }),
    ],
    plan: { ...makePlan(), rooms: [], components: [makeComponent()] },
  });
}

function MaterialsKpi() {
  const s = useProjectSummary(PID);
  return <output aria-label="materials planned">{s ? formatEur(s.byCategory.MATERIALS.planned) : ''}</output>;
}

function setup(patch: () => Response) {
  const fetchMock = mockApi({ 'PATCH /api/projects/project-1/plan/components/boq-1': patch });
  const client = testQueryClient();
  client.setQueryData<ProjectCache>(queryKeys.project(PID), normalise(snapshot()));
  renderWithProviders(
    <>
      <BoqSection projectId={PID} section="STRUCTURE" />
      <MaterialsKpi />
    </>,
    { client },
  );
  return { client, fetchMock };
}

function editQty(value: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Edit qty BOQ-STR-001' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'qty BOQ-STR-001' }), { target: { value } });
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'qty BOQ-STR-001' }), { key: 'Enter' });
}

// TanStack and React deliver cache updates on fake timers; 50 ms stays well below the 400 ms autosave
const settle = () => act(() => vi.advanceTimersByTimeAsync(50));

const item = (client: ReturnType<typeof testQueryClient>) =>
  client.getQueryData<ProjectCache>(queryKeys.project(PID))?.itemsById['mat-1'];

describe('BoqSection', () => {
  beforeEach(() => {
    autosaveQueue.__reset();
    useToastStore.setState({ toasts: [] });
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('should change the linked MATERIAL row and the MATERIALS KPI at once when the BOQ qty changes [AC-08.4]', async () => {
    const { client, fetchMock } = setup(() =>
      fakeResponse({ component: makeComponent({ qtyMilli: 60_000 }), updatedItemIds: ['mat-1'] }),
    );
    expect(screen.getByRole('status', { name: 'materials planned' }).textContent).toBe('€9,625.00');

    editQty('60');
    await settle();

    // before the PATCH: the linked row, its planned cost and the KPI already moved
    expect(item(client)?.qtyMilli).toBe(60_000);
    expect(screen.getByTestId('boq-planned-boq-1').textContent).toBe('€11,550.00');
    expect(screen.getByRole('status', { name: 'materials planned' }).textContent).toBe('€11,550.00');
    expect(fetchMock).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({ qtyMilli: 60_000 });
    expect(item(client)?.qtyMilli).toBe(60_000);
  });

  it('should roll back the linked qty and the KPI and show a toast when the PATCH fails [AC-08.10]', async () => {
    const { client } = setup(() => fakeResponse({ message: 'Server exploded' }, 500));

    editQty('60');
    await settle();
    expect(item(client)?.qtyMilli).toBe(60_000);
    expect(screen.getByTestId('boq-planned-boq-1').textContent).toBe('€11,550.00');

    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS));
    await settle();

    expect(item(client)?.qtyMilli).toBe(50_000);
    expect(screen.getByTestId('boq-planned-boq-1').textContent).toBe('€9,625.00');
    expect(screen.getByRole('status', { name: 'materials planned' }).textContent).toBe('€9,625.00');
    expect(useToastStore.getState().toasts.map((t) => t.text)).toEqual([
      'Changes were not saved and have been reverted: Server exploded',
    ]);
  });

  it('should keep a pending qty edit of the linked row from Building materials when the BOQ qty changes', async () => {
    const { client } = setup(() =>
      fakeResponse({ component: makeComponent({ qtyMilli: 60_000 }), updatedItemIds: ['mat-1'] }),
    );
    autosaveQueue.enqueue('item:mat-1', { qtyMilli: 55_000 }, {
      send: () => new Promise(() => undefined),
      onSuccess: () => undefined,
      rollback: () => undefined,
    });

    editQty('60');

    expect(item(client)?.qtyMilli).toBe(50_000);
  });
});
