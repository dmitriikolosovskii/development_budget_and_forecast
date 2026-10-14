import {
  makeItem,
  makeLine,
  makeProject,
  makeSnapshot,
} from '@default-project/budget-engine';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fakeResponse,
  mockApi,
  renderWithProviders,
  testQueryClient,
} from '../../testing/render';
import { ProjectWizardPage } from './project-wizard-page';

/** One line per category + contingency; MATERIALS: 1,000,000 ¢ approved at 144 m² (→ 1,250,000 ¢ at 180 m²). */
function templateSnapshot() {
  return makeSnapshot({
    project: makeProject({
      id: 'tpl',
      slug: 'template-efh-144',
      isTemplate: true,
      startDate: '2026-04-01',
    }),
    budgetLines: [
      makeLine({
        id: 'pur',
        category: 'LAND',
        section: 'purchase',
        approvedCents: 9_000_000,
      }),
      makeLine({
        id: 'des',
        category: 'ARCHITECTURE',
        section: 'design',
        approvedCents: 4_000_000,
      }),
      makeLine({
        id: 'con',
        category: 'MATERIALS',
        section: 'concrete',
        approvedCents: 1_000_000,
      }),
      makeLine({
        id: 'shl',
        category: 'CONSTRUCTION',
        section: 'shell',
        approvedCents: 500_000,
      }),
      makeLine({
        id: 'ctg',
        category: 'CONSTRUCTION',
        section: 'contingency',
        approvedCents: 100_000,
      }),
      makeLine({
        id: 'web',
        category: 'MARKETING',
        section: 'website-seo',
        approvedCents: 300_000,
      }),
    ],
    items: [
      makeItem({
        budgetLineId: 'pur',
        code: 'SRV-PUR-001',
        unit: 'm2',
        qtyMilli: 520_000,
        unitPriceCents: 13_000,
      }),
      makeItem({
        budgetLineId: 'des',
        code: 'SRV-DES-001',
        unit: 'lump',
        qtyMilli: 1000,
        unitPriceCents: 4_000_000,
      }),
      makeItem({
        budgetLineId: 'con',
        code: 'MAT-CON-001',
        unit: 'm3',
        qtyMilli: 1002,
        unitPriceCents: 100_000,
      }),
      makeItem({
        budgetLineId: 'con',
        code: 'MAT-CON-002',
        unit: 'pcs',
        qtyMilli: 1000,
        unitPriceCents: 800_000,
      }),
      makeItem({
        budgetLineId: 'shl',
        code: 'WRK-SHL-001',
        unit: 'h',
        qtyMilli: 100_000,
        unitPriceCents: 5_000,
      }),
      makeItem({
        budgetLineId: 'web',
        code: 'SRV-WEB-001',
        unit: 'lump',
        qtyMilli: 1000,
        unitPriceCents: 250_000,
      }),
    ],
  });
}

function renderWizard(
  post: () => Response | Promise<Response> = () =>
    fakeResponse(makeSnapshot({ project: makeProject({ id: 'p9' }) }), 201),
) {
  const fetchMock = mockApi({
    'GET /api/projects/wizard/template': () => fakeResponse(templateSnapshot()),
    'POST /api/projects/wizard': post,
  });
  const client = testQueryClient();
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  renderWithProviders(
    <Routes>
      <Route path="/projects/new" element={<ProjectWizardPage />} />
      <Route
        path="/projects/:projectId/land"
        element={<p>Land tab of the new project</p>}
      />
    </Routes>,
    { url: '/projects/new', client },
  );
  return { fetchMock, invalidate };
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const clickNext = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
const step = (name: string) => screen.findByRole('heading', { level: 2, name });

async function toHouseStep() {
  type('Project name', 'Haus Test');
  type('Client', 'Familie Test');
  type('City', 'Leipzig');
  clickNext();
  await step('Land');
  type('Address', 'Parkweg 1');
  type('Postal code', '04103');
  type('Municipality', 'Leipzig');
  clickNext();
  await step('House');
}

async function toReviewStep() {
  await toHouseStep();
  clickNext();
  await step('Budget');
  await screen.findByText('€10,000.00');
  clickNext();
  await step('Review');
}

const posts = (fetchMock: ReturnType<typeof mockApi>) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');

describe('ProjectWizardPage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('should render the page heading before the template has loaded', () => {
    renderWizard();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Calculate project' }),
    ).toBeTruthy();
  });

  it('should block "Next" with messages while a step is invalid [AC-12.4]', async () => {
    renderWizard();

    clickNext();

    expect(await screen.findAllByText('Required')).toHaveLength(3);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Basics' }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('heading', { level: 2, name: 'Land' }),
    ).toBeNull();
  });

  it('should reject a living area outside 100–250 m² on the house step [AC-12.4]', async () => {
    renderWizard();
    await toHouseStep();

    type('Living area, m²', '260');
    clickNext();

    expect(
      await screen.findByText('Living area must be 100–250 m²'),
    ).toBeTruthy();
    expect(
      screen.queryByRole('heading', { level: 2, name: 'Budget' }),
    ).toBeNull();
  });

  it('should recalculate the budget estimate when the living area changes [AC-12.4]', async () => {
    renderWizard();
    await toHouseStep();
    clickNext();
    await step('Budget');
    expect(await screen.findByText('€10,000.00')).toBeTruthy(); // MATERIALS at 144 m²
    expect(
      (screen.getByLabelText('Approved Building materials') as HTMLInputElement)
        .value,
    ).toBe('10000.00');

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await step('House');
    type('Living area, m²', '180');
    clickNext();
    await step('Budget');

    expect(screen.getByTestId('estimate-value-MATERIALS').textContent).toBe(
      '€12,500.00',
    );
    expect(
      (screen.getByLabelText('Approved Building materials') as HTMLInputElement)
        .value,
    ).toBe('12500.00');
    expect(screen.queryByText('€10,000.00')).toBeNull();
  });

  it('should create the project, invalidate the list and open its Land tab [AC-12.5]', async () => {
    const { fetchMock, invalidate } = renderWizard();
    await toReviewStep();

    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));

    expect(await screen.findByText('Land tab of the new project')).toBeTruthy();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['projects'] });
    const [[url, init]] = posts(fetchMock);
    expect(url).toBe('/api/projects/wizard');
    const body = JSON.parse(String(init?.body));
    expect(Object.keys(body.approvedByCategory).sort()).toEqual([
      'ARCHITECTURE',
      'CONSTRUCTION',
      'LAND',
      'MARKETING',
      'MATERIALS',
    ]);
    expect(body.approvedByCategory.MATERIALS).toBe(1_000_000);
    expect(body).toMatchObject({
      name: 'Haus Test',
      house: { livingAreaM2: 144 },
      land: { municipality: 'Leipzig' },
    });
  });

  it('should disable "Create project" while the request runs and send one POST [AC-12.5]', async () => {
    let resolve: (r: Response) => void = () => undefined;
    const { fetchMock } = renderWizard(
      () => new Promise<Response>((r) => (resolve = r)),
    );
    await toReviewStep();

    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));
    const pending = await screen.findByRole('button', { name: 'Creating…' });
    fireEvent.click(pending);
    fireEvent.submit(pending.closest('form') as HTMLFormElement);

    expect((pending as HTMLButtonElement).disabled).toBe(true);
    expect(posts(fetchMock)).toHaveLength(1);
    resolve(
      fakeResponse(makeSnapshot({ project: makeProject({ id: 'p9' }) }), 201),
    );
    expect(await screen.findByText('Land tab of the new project')).toBeTruthy();
  });

  it('should stay on the review step and show the error when creation fails [AC-12.5]', async () => {
    renderWizard(() =>
      fakeResponse({ message: 'Template template-efh-144 not found' }, 404),
    );
    await toReviewStep();

    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));

    expect(
      await screen.findByText(
        /Could not create the project: Template template-efh-144 not found/,
      ),
    ).toBeTruthy();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Create project' }),
      ).toBeTruthy(),
    );
    expect(screen.queryByText('Land tab of the new project')).toBeNull();
  });
});
