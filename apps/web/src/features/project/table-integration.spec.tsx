import { act, fireEvent, screen } from '@testing-library/react';
import { makeItem, makeLine, makeSnapshot } from '@default-project/budget-engine';
import type { CostItem } from '@default-project/types';
import { autosaveQueue, AUTOSAVE_DELAY_MS } from '../../lib/autosave-queue';
import { queryKeys } from '../../lib/query-keys';
import { fakeResponse, mockApi, renderWithProviders, testQueryClient } from '../../testing/render';
import { EditableTable, MoneyCell, QtyCell, type Column } from '../../ui/editable-table';
import { normalise, type ProjectCache } from './project-cache';
import { useEditItem } from './use-edit-item';
import { useItem } from './use-item';
import { useItemIds } from './use-item-ids';
import { useProjectSummary } from './use-project-summary';

const PID = 'project-1';
const renders: Record<string, number> = {};

const COLUMNS: Column<CostItem>[] = [
  {
    id: 'qty',
    header: 'Qty',
    cell: (r, edit) => {
      renders[r.id] = (renders[r.id] ?? 0) + 1;
      return <QtyCell label={`qty ${r.id}`} milli={r.qtyMilli} unit={r.unit} onCommit={(qtyMilli) => edit({ qtyMilli })} />;
    },
  },
  { id: 'price', header: 'Price', cell: (r, edit) => <MoneyCell label={`price ${r.id}`} cents={r.unitPriceCents} onCommit={(unitPriceCents) => edit({ unitPriceCents })} /> },
];

function snapshot() {
  return makeSnapshot({
    budgetLines: [makeLine({ id: 'l1', approvedCents: 100_000 })],
    items: ['a', 'b', 'c'].map((id, i) => makeItem({ id, budgetLineId: 'l1', code: `MAT-ELE-00${i}`, qtyMilli: 1000, unitPriceCents: 10_000 })),
  });
}

function Table() {
  const ids = useItemIds(PID, 'l1');
  const edit = useEditItem(PID);
  const summary = useProjectSummary(PID);
  return (
    <EditableTable
      caption="Electrical"
      rowIds={ids}
      context={PID}
      useRow={useItem}
      columns={COLUMNS}
      onEdit={edit}
      footer={{ price: `planned ${summary?.project.planned}` }}
    />
  );
}

function setup() {
  const fetchMock = mockApi({
    'GET /api/projects/project-1': () => fakeResponse(snapshot()),
    'PATCH /api/projects/project-1/items/': () => fakeResponse(snapshot().items[0]),
  });
  const client = testQueryClient();
  client.setQueryData<ProjectCache>(queryKeys.project(PID), normalise(snapshot()));
  renderWithProviders(<Table />, { client });
  for (const k of Object.keys(renders)) renders[k] = 0;
  return { client, fetchMock };
}

const patches = (fetchMock: ReturnType<typeof mockApi>) => fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH');

describe('EditableTable with the project hooks', () => {
  beforeEach(() => {
    autosaveQueue.__reset();
    for (const k of Object.keys(renders)) delete renders[k];
  });

  it('should re-render only the edited row while the footer total changes [AC-02.6]', async () => {
    setup();

    fireEvent.click(screen.getByRole('button', { name: 'Edit qty b' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'qty b' }), { target: { value: '3' } });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'qty b' }), { key: 'Enter' });

    expect(await screen.findByText('planned 50000')).toBeTruthy();
    expect(renders['b']).toBeGreaterThan(0);
    expect(renders['a']).toBe(0);
    expect(renders['c']).toBe(0);
  });

  it('should not re-render any row when a refetch returns the same data [AC-02.6]', async () => {
    const { client } = setup();

    await act(() => client.refetchQueries({ queryKey: queryKeys.project(PID) }));

    expect(renders).toEqual({ a: 0, b: 0, c: 0 });
  });

  it('should reject invalid money input without saving [AC-02.4]', async () => {
    vi.useFakeTimers();
    const { fetchMock } = setup();

    for (const bad of ['12,5,0', '-3', 'abc']) {
      fireEvent.click(screen.queryByRole('button', { name: 'Edit price a' }) ?? screen.getByRole('textbox', { name: 'price a' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'price a' }), { target: { value: bad } });
      fireEvent.keyDown(screen.getByRole('textbox', { name: 'price a' }), { key: 'Enter' });
      expect(screen.getByRole('alert').textContent).toBe('Enter an amount like 1,234.56');
    }
    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2));

    expect(patches(fetchMock)).toHaveLength(0);
    vi.useRealTimers();
  });

  it('should save at once when the cell loses focus', async () => {
    vi.useFakeTimers();
    const { fetchMock } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Edit price a' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'price a' }), { target: { value: '1,234.56' } });
    fireEvent.blur(screen.getByRole('textbox', { name: 'price a' }));
    await act(() => vi.advanceTimersByTimeAsync(0));

    expect(patches(fetchMock)).toHaveLength(1);
    expect(JSON.parse(patches(fetchMock)[0][1]?.body as string)).toEqual({ unitPriceCents: 123456 });
    vi.useRealTimers();
  });
});
