import { fireEvent, screen } from '@testing-library/react';
import { mockMaterialsApi, renderMaterials, settle, useFakeClock } from './test-utils';

// Render counters per row id: the row itself (useItem runs once per row render) and the cells that
// subscribe on their own (schedule, locked actual / delete). Wrapping the real hooks keeps the behaviour.
const renders = vi.hoisted(() => ({ row: {} as Record<string, number>, schedule: {} as Record<string, number>, delivered: {} as Record<string, number> }));
const bump = (bucket: Record<string, number>, id: string) => (bucket[id] = (bucket[id] ?? 0) + 1);

vi.mock('../project/use-item', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../project/use-item')>();
  return {
    useItem: (projectId: string, itemId: string) => {
      bump(renders.row, itemId);
      return actual.useItem(projectId, itemId);
    },
  };
});

vi.mock('./use-materials', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./use-materials')>();
  return {
    ...actual,
    useItemSchedule: (projectId: string, itemId: string) => {
      bump(renders.schedule, itemId);
      return actual.useItemSchedule(projectId, itemId);
    },
    useHasDeliveredDeliveries: (projectId: string, itemId: string) => {
      bump(renders.delivered, itemId);
      return actual.useHasDeliveredDeliveries(projectId, itemId);
    },
  };
});

const reset = () => {
  for (const bucket of Object.values(renders)) for (const k of Object.keys(bucket)) delete bucket[k];
};
const total = (id: string) => (renders.row[id] ?? 0) + (renders.schedule[id] ?? 0) + (renders.delivered[id] ?? 0);

function commit(name: string, value: string) {
  fireEvent.click(screen.getByRole('button', { name: `Edit ${name}` }));
  const input = screen.getByLabelText(name);
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

describe('MaterialsPage re-renders', () => {
  useFakeClock();

  it('should not re-render the other row or its cells when one row quantity changes [AC-04.6]', async () => {
    mockMaterialsApi();
    renderMaterials();
    await settle();
    expect(renders.row['e2']).toBeGreaterThan(0); // the counters do see the rows
    reset();

    commit('quantity MAT-ELE-001', '600');
    await settle();

    expect(screen.getByTestId('planned-e1').textContent).toBe('€534.00');
    expect(renders.row['e1']).toBeGreaterThan(0);
    expect(total('e2')).toBe(0);
  });

  it('should not re-render the other row when one row delivery date (its schedule) changes [AC-04.6]', async () => {
    mockMaterialsApi();
    renderMaterials();
    await settle();
    reset();

    commit('MAT-ELE-001 delivery date', '2026-10-01');
    await settle();

    expect(screen.getAllByText('Overdue')).toHaveLength(1);
    expect(total('e2')).toBe(0);
  });
});
