import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import {
  computeProfitability,
  makeItem,
  makeLine,
  makeSnapshot,
  summarizeProject,
} from '@default-project/budget-engine';
import type { Delivery, ImportResult } from '@default-project/types';
import {
  fakeResponse,
  mockApi,
  renderWithProviders,
} from '../../testing/render';
import { DeliveryTrackingPage } from './delivery-tracking-page';

const HEADER = 'itemCode,deliveryNoteNo,kind,date,quantity,invoiceAmountEur';

function fixture() {
  const line = makeLine({
    id: 'l1',
    section: 'concrete',
    category: 'MATERIALS',
    approvedCents: 1_000_000,
  });
  const snapshot = makeSnapshot({
    budgetLines: [line],
    items: [
      makeItem({
        id: 'con',
        code: 'MAT-CON-001',
        name: 'Ready-mix concrete',
        kind: 'MATERIAL',
        budgetLineId: 'l1',
        deliveryDate: '2026-10-01',
      }),
    ],
  });
  const summary = summarizeProject(snapshot).project;
  const listItem = {
    ...snapshot.project,
    summary,
    profitability: computeProfitability(summary, snapshot.project.markupBps),
  };
  return { snapshot, listItem, projectId: snapshot.project.id };
}

const logRow: Delivery = {
  id: 'd1',
  projectId: 'project-1',
  costItemId: 'con',
  batchId: null,
  deliveryNoteNo: 'LS-7',
  kind: 'DELIVERED',
  date: '2026-10-04',
  qtyMilli: 12500,
  invoiceCents: 240625,
  createdAt: '2026-10-04T10:00:00.000Z',
};

function setup(importResponse?: () => Response) {
  const { snapshot, listItem, projectId } = fixture();
  const fetchMock = mockApi({
    'GET /api/projects/project-1/deliveries': () => fakeResponse([logRow]),
    'GET /api/projects/project-1': () => fakeResponse(snapshot),
    'GET /api/projects': () => fakeResponse([listItem]),
    'POST /api/projects/project-1/deliveries/import':
      importResponse ?? (() => fakeResponse({ message: 'unexpected' }, 500)),
  });
  const view = renderWithProviders(<DeliveryTrackingPage />, {
    url: `/deliveries?project=${projectId}`,
  });
  return { ...view, fetchMock };
}

async function upload(csv: string, name = 'deliveries.csv') {
  const input = await screen.findByLabelText('CSV file');
  fireEvent.change(input, {
    target: { files: [new File([csv], name, { type: 'text/csv' })] },
  });
  return screen.findByRole('table', { name: 'Preview' });
}

describe('DeliveryTrackingPage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('should mark a bad date in the preview before anything is sent [AC-10.6]', async () => {
    const { fetchMock } = setup();

    const preview = await upload(
      `${HEADER}\nMAT-CON-001,LS-1,DELIVERED,2026-13-01,1,10.00\nMAT-CON-001,LS-2,DELIVERED,2026-10-02,1,10.00\n`,
    );

    const [, bad, good] = within(preview).getAllByRole('row');
    expect(
      within(bad).getByText('2026-13-01').getAttribute('aria-invalid'),
    ).toBe('true');
    expect(
      within(good).getByText('2026-10-02').hasAttribute('aria-invalid'),
    ).toBe(false);
    expect(screen.getByText('1 with problems')).toBeTruthy();
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === 'POST'),
    ).toBe(false);
  });

  it('should invalidate the project snapshot and show the result after a successful import [AC-10.6]', async () => {
    const result: ImportResult = {
      batchId: 'b1',
      totalRows: 2,
      okRows: 1,
      failedRows: 1,
      errors: [
        {
          row: 2,
          field: 'date',
          message: 'must be a real date in YYYY-MM-DD format',
        },
      ],
      updatedItemIds: ['con'],
    };
    const { client, fetchMock } = setup(() => fakeResponse(result, 201));
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await upload(
      `${HEADER}\nMAT-CON-001,LS-1,DELIVERED,2026-10-02,1,10.00\nMAT-CON-001,LS-2,DELIVERED,2026-13-01,1,10.00\n`,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    const card = await screen.findByTestId('import-result');
    expect(within(card).getByText('1 imported')).toBeTruthy();
    expect(
      within(
        within(card).getByRole('table', { name: 'Import errors' }),
      ).getByText('must be a real date in YYYY-MM-DD format'),
    ).toBeTruthy();
    expect(
      within(card)
        .getByRole('link', { name: 'MAT-CON-001 · Ready-mix concrete' })
        .getAttribute('href'),
    ).toBe('/projects/project-1/materials/concrete?highlight=con');
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ['project', 'project-1'],
      }),
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['deliveries', 'project-1'],
    });
    const post = fetchMock.mock.calls.find(
      ([, init]) => init?.method === 'POST',
    );
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({
      fileName: 'deliveries.csv',
      rows: [
        {
          itemCode: 'MAT-CON-001',
          deliveryNoteNo: 'LS-1',
          kind: 'DELIVERED',
          date: '2026-10-02',
          quantity: '1',
          invoiceAmountEur: '10.00',
        },
        {
          itemCode: 'MAT-CON-001',
          deliveryNoteNo: 'LS-2',
          kind: 'DELIVERED',
          date: '2026-13-01',
          quantity: '1',
          invoiceAmountEur: '10.00',
        },
      ],
    });
  });

  it('should block the import and not invalidate anything when headers are wrong', async () => {
    const { client } = setup();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const input = await screen.findByLabelText('CSV file');

    fireEvent.change(input, {
      target: { files: [new File(['code,date\nA,B\n'], 'bad.csv')] },
    });

    expect((await screen.findByRole('alert')).textContent).toMatch(
      /Wrong headers/,
    );
    expect(
      (screen.getByRole('button', { name: 'Import' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('should list deliveries with their status against the plan', async () => {
    setup();

    const log = await screen.findByRole('table', { name: 'Delivery log' });

    expect(within(log).getByText('LS-7')).toBeTruthy();
    expect(within(log).getByText('Late · 3 d')).toBeTruthy();
    expect(within(log).getByText('€2,406.25')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Kind'), {
      target: { value: 'EXPECTED' },
    });
    expect(within(log).queryByText('LS-7')).toBeNull();
  });
});
