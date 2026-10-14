import { useCallback } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { EditableTable, HIGHLIGHT_MS, type Column } from './editable-table';

interface TestRow {
  id: string;
  name: string;
  qty: number;
}

type RowStore = UseBoundStore<StoreApi<{ rows: Record<string, TestRow> }>>;

function useTestRow(store: RowStore, id: string) {
  return store((s) => s.rows[id]);
}

const renders: Record<string, number> = {};

const COLUMNS: Column<TestRow>[] = [
  {
    id: 'name',
    header: 'Item',
    mobile: 'title',
    cell: (row) => {
      renders[row.id] = (renders[row.id] ?? 0) + 1;
      return row.name;
    },
  },
  {
    id: 'qty',
    header: 'Qty',
    align: 'right',
    cell: (row, edit) => (
      <button type="button" onClick={() => edit({ qty: row.qty + 1 })}>
        qty {row.id}: {row.qty}
      </button>
    ),
  },
];

function makeStore(): RowStore {
  return create(() => ({
    rows: {
      a: { id: 'a', name: 'Cable', qty: 1 },
      b: { id: 'b', name: 'Socket', qty: 2 },
      c: { id: 'c', name: 'Switch', qty: 3 },
    },
  }));
}

const ROW_IDS = ['a', 'b', 'c'];

/** Like a real tab: the parent re-renders on every edit because it shows a live total. */
function Harness({ store }: { store: RowStore }) {
  const total = store((s) => Object.values(s.rows).reduce((sum, r) => sum + r.qty, 0));
  const onEdit = useCallback(
    (id: string, patch: Partial<TestRow>) =>
      store.setState((s) => ({ rows: { ...s.rows, [id]: { ...s.rows[id], ...patch } } })),
    [store],
  );
  return (
    <EditableTable
      caption="Electrical"
      rowIds={ROW_IDS}
      context={store}
      useRow={useTestRow}
      columns={COLUMNS}
      onEdit={onEdit}
      footer={{ qty: `total ${total}` }}
    />
  );
}

function renderTable(store: RowStore, url = '/') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Harness store={store} />
    </MemoryRouter>,
  );
}

function setViewport(mobile: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: mobile && query.includes('max-width: 639px'),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

describe('EditableTable', () => {
  beforeEach(() => {
    for (const k of Object.keys(renders)) delete renders[k];
  });

  it('should re-render only the edited row when one row changes [AC-02.6]', () => {
    const store = makeStore();
    renderTable(store);
    for (const k of Object.keys(renders)) renders[k] = 0;

    fireEvent.click(screen.getByRole('button', { name: 'qty a: 1' }));

    expect(screen.getByRole('button', { name: 'qty a: 2' })).toBeTruthy();
    expect(screen.getByText('total 7')).toBeTruthy();
    expect(renders['a']).toBe(1);
    expect(renders['b']).toBe(0);
    expect(renders['c']).toBe(0);
  });

  it('should mark and scroll to the row from ?highlight and clear it after 2 s [AC-02.10]', () => {
    vi.useFakeTimers();
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => undefined);
    const { container } = renderTable(makeStore(), '/?highlight=b');

    const row = container.querySelector('[data-row-id="b"]') as HTMLElement;
    expect(row.hasAttribute('data-highlighted')).toBe(true);
    expect(scroll.mock.contexts[0]).toBe(row);
    expect(container.querySelector('[data-row-id="a"]')?.hasAttribute('data-highlighted')).toBe(false);

    act(() => vi.advanceTimersByTime(HIGHLIGHT_MS));

    expect(row.hasAttribute('data-highlighted')).toBe(false);
    vi.useRealTimers();
  });

  it('should render row cards instead of a table on mobile [AC-02.8]', () => {
    setViewport(true);
    renderTable(makeStore());

    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'Edit row' })).toHaveLength(3);
  });

  it('should render a table on desktop', () => {
    setViewport(false);
    renderTable(makeStore());

    expect(screen.getByRole('table', { name: 'Electrical' })).toBeTruthy();
    expect(screen.getAllByRole('row')).toHaveLength(5);
  });
});
