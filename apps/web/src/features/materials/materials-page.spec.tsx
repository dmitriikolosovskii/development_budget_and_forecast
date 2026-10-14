import { act, fireEvent, screen, within } from '@testing-library/react';
import { AUTOSAVE_DELAY_MS } from '../../lib/autosave-queue';
import { useUiStore } from '../../lib/ui-store';
import { makeItem } from '@default-project/budget-engine';
import type { CostItem } from '@default-project/types';
import { fakeResponse, kpi, lastPath, mockMaterialsApi, PID, renderMaterials, row, settle, useFakeClock } from './test-utils';

const MATERIALS = `/projects/${PID}/materials`;

function editCell(name: string, value: string, key: 'Enter' | 'blur' = 'Enter') {
  fireEvent.click(screen.getByRole('button', { name: `Edit ${name}` }));
  const input = screen.getByRole('textbox', { name });
  fireEvent.change(input, { target: { value } });
  if (key === 'Enter') fireEvent.keyDown(input, { key: 'Enter' });
  else fireEvent.blur(input);
}

const subNavButton = (label: string) =>
  within(screen.getByRole('navigation', { name: 'Material sections' })).getByRole('button', { name: new RegExp(label) });

describe('MaterialsPage', () => {
  useFakeClock();

  it('should update the row amount, section total and KPI strip before the PATCH when qty changes [AC-04.1]', async () => {
    const api = mockMaterialsApi();
    renderMaterials();
    await settle();
    expect(screen.getByTestId('planned-e1').textContent).toBe('€445.00');
    expect(screen.getByTestId('section-planned').textContent).toBe('€625.00');
    expect(kpi('Forecast (EAC)')).toBe('€14,275');

    editCell('quantity MAT-ELE-001', '600');
    await settle();

    expect(screen.getByTestId('planned-e1').textContent).toBe('€534.00');
    expect(screen.getByTestId('section-planned').textContent).toBe('€714.00');
    expect(kpi('Forecast (EAC)')).toBe('€14,364');
    expect(api.of('PATCH')).toHaveLength(0);
  });

  it('should update the row amount when the unit price changes [AC-04.1]', async () => {
    mockMaterialsApi();
    renderMaterials();
    await settle();

    editCell('unit price MAT-ELE-001', '1.00');
    await settle();

    expect(screen.getByTestId('planned-e1').textContent).toBe('€500.00');
    expect(screen.getByTestId('section-planned').textContent).toBe('€680.00');
  });

  it('should keep an unsaved edit across a section and a tab switch and send exactly one PATCH [AC-04.2]', async () => {
    const api = mockMaterialsApi();
    renderMaterials();
    await settle();

    editCell('quantity MAT-ELE-001', '600');
    await settle();
    fireEvent.click(subNavButton('Concrete & reinforcement'));
    await settle();
    fireEvent.click(screen.getByRole('tab', { name: 'Profitability' }));
    await settle();
    expect(lastPath()).toBe(`/projects/${PID}/profitability`);
    fireEvent.click(screen.getByRole('tab', { name: 'Building materials' }));
    await settle();
    fireEvent.click(subNavButton('Electrical'));
    await settle();
    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 3));
    await settle();

    expect(screen.getByTestId('planned-e1').textContent).toBe('€534.00');
    expect(api.of('PATCH')).toHaveLength(1);
    expect(api.of('PATCH')[0]).toMatchObject({ url: `/api/projects/${PID}/items/e1`, body: { qtyMilli: 600_000 } });
  });

  it('should show Late for work · 9 d for the windows and Delivered for the concrete [AC-04.3]', async () => {
    mockMaterialsApi();
    renderMaterials(`${MATERIALS}/windows-doors`);
    await settle();
    expect(within(row('w1')).getByText('Late for work · 9 d')).toBeTruthy();
    expect(within(row('w3')).queryByText(/Late for work/)).toBeNull();

    fireEvent.click(subNavButton('Concrete & reinforcement'));
    await settle();

    expect(within(row('c1')).getByText('Delivered')).toBeTruthy();
  });

  it('should show the work start as Needed by, linking to the row in Construction [AC-04.3]', async () => {
    mockMaterialsApi();
    renderMaterials(`${MATERIALS}/windows-doors`);
    await settle();

    const link = within(row('w1')).getByRole('link', { name: '19 Oct 2026' });

    expect(link.getAttribute('href')).toBe(`/projects/${PID}/construction/windows-install?highlight=w-win`);
  });

  it('should clear the late flag at once when the delivery moves to the work start day [AC-04.3]', async () => {
    mockMaterialsApi();
    renderMaterials(`${MATERIALS}/windows-doors`);
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'Edit MAT-WIN-001 delivery date' }));
    const input = screen.getByLabelText('MAT-WIN-001 delivery date');
    fireEvent.change(input, { target: { value: '2026-10-19' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await settle();

    expect(within(row('w1')).getByText('On time')).toBeTruthy();
    expect(within(row('w1')).queryByText(/Late for work/)).toBeNull();
  });

  it('should open the OrganizationModal for the supplier and close it with Esc [AC-04.4]', async () => {
    mockMaterialsApi();
    renderMaterials();
    await settle();

    fireEvent.click(within(row('e1')).getByRole('button', { name: 'Elektro-Großhandel Sachsen GmbH' }));
    await settle();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getAllByText('Elektro-Großhandel Sachsen GmbH').length).toBeGreaterThan(0);
    expect(within(dialog).queryByText('Elektro Krause e.K.')).toBeNull();
    expect(dialog.querySelector('a[href^="tel:"]')?.getAttribute('href')).toBe('tel:%2B493415550101');

    fireEvent.keyDown(document, { key: 'Escape' });
    await settle();

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(lastPath()).toBe(`${MATERIALS}/electrical`);
  });

  it.each(['12,5,0', '-3'])('should reject %s in a money cell with a message and no PATCH [AC-04.5]', async (text) => {
    const api = mockMaterialsApi();
    renderMaterials();
    await settle();

    editCell('unit price MAT-ELE-001', text);
    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 3));

    expect(screen.getByText('Enter an amount like 1,234.56')).toBeTruthy();
    expect(screen.getByTestId('planned-e1').textContent).toBe('€445.00');
    expect(api.of('PATCH')).toHaveLength(0);
  });

  it('should mark concrete and electrical as over budget in the SubNav, and count late materials [AC-04.7]', async () => {
    mockMaterialsApi();
    renderMaterials();
    await settle();

    expect(within(subNavButton('Concrete & reinforcement')).getByText('Over')).toBeTruthy();
    expect(within(subNavButton('Electrical')).getByText('Over')).toBeTruthy();
    expect(within(subNavButton('Masonry')).queryByText('Over')).toBeNull();
    expect(within(subNavButton('Masonry')).getByText('1 late')).toBeTruthy();
    expect(within(subNavButton('Windows, doors & stairs')).getByText('1 late')).toBeTruthy();
    expect(within(subNavButton('Electrical')).queryByText(/late/)).toBeNull();
  });

  it('should add a row with the next free code MAT-WIN-004 (no gap reuse) [AC-04.9]', async () => {
    const api = mockMaterialsApi();
    renderMaterials(`${MATERIALS}/windows-doors`);
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'Add material' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add material' })); // a double click creates one row
    await settle();

    expect(api.of('POST')).toHaveLength(1);
    expect(api.of('POST')[0].body).toMatchObject({ code: 'MAT-WIN-004', kind: 'MATERIAL', budgetLineId: 'l-win' });
    expect(screen.getByText('MAT-WIN-004')).toBeTruthy();
  });

  it('should retry once with a recomputed code when the server reports a code conflict [AC-04.9]', async () => {
    let posts = 0;
    const api = mockMaterialsApi(undefined, {
      POST: (call) =>
        ++posts === 1
          ? fakeResponse({ message: 'code already exists' }, 409)
          : fakeResponse(makeItem({ ...(call.body as Partial<CostItem>), id: 'new-x', projectId: PID })),
    });
    renderMaterials(`${MATERIALS}/windows-doors`);
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'Add material' }));
    await settle();

    expect(api.of('POST')).toHaveLength(2);
    expect(within(row('new-x')).getByText('MAT-WIN-004')).toBeTruthy();
  });

  it('should redirect to the remembered section and keep the query string [AC-04.10]', async () => {
    mockMaterialsApi();
    useUiStore.setState({ lastSection: { materials: 'electrical' } });
    renderMaterials(`${MATERIALS}?org=org-sup`);
    await settle();

    expect(lastPath()).toBe(`${MATERIALS}/electrical?org=org-sup`);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('should redirect to the first section when the remembered one is not a section of this project [AC-04.10]', async () => {
    mockMaterialsApi();
    useUiStore.setState({ lastSection: { materials: 'no-such-section' } });
    renderMaterials(MATERIALS);
    await settle();

    expect(lastPath()).toBe(`${MATERIALS}/concrete`);
    expect(useUiStore.getState().lastSection.materials).toBe('concrete');
  });

  it('should delete only after the inline confirmation, never through window.confirm [AC-04.11]', async () => {
    const api = mockMaterialsApi();
    const confirmSpy = vi.spyOn(window, 'confirm');
    renderMaterials(`${MATERIALS}/masonry`);
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'Delete MAT-MAS-001' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete MAT-MAS-001?' })).getByRole('button', { name: 'No' }));
    await settle();
    expect(api.of('DELETE')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Delete MAT-MAS-001' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete MAT-MAS-001?' })).getByRole('button', { name: 'Yes' }));
    await settle();

    expect(api.of('DELETE')).toHaveLength(1);
    expect(api.of('DELETE')[0].url).toBe(`/api/projects/${PID}/items/m1`);
    expect(document.querySelector('[data-row-id="m1"]')).toBeNull();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('should not allow deleting a material with recorded deliveries [AC-04.11]', async () => {
    mockMaterialsApi();
    renderMaterials(`${MATERIALS}/concrete`);
    await settle();

    const button = screen.getByRole('button', { name: 'Delete MAT-CON-001 (Has recorded deliveries)' });

    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Delete MAT-CON-001' })).toBeNull();
  });

  it('should render row cards with the name, amount and schedule, and edit in a sheet on mobile', async () => {
    mockMaterialsApi();
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({ ...original(query), matches: query === '(max-width: 639px)' })) as typeof window.matchMedia;
    try {
      renderMaterials(`${MATERIALS}/windows-doors`);
      await settle();

      const card = row('w1');
      expect(card.tagName).toBe('ARTICLE');
      expect(within(card).getByText('Late for work · 9 d')).toBeTruthy();
      expect(within(card).getByTestId('planned-w1').textContent).toBe('€4,800.00');
      fireEvent.click(within(card).getByRole('button', { name: 'Edit row' }));
      expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Edit quantity MAT-WIN-001' })).toBeTruthy();
    } finally {
      window.matchMedia = original;
    }
  });

  it('should lock Actual with a tooltip when the row has a DELIVERED delivery [AC-04.12]', async () => {
    mockMaterialsApi();
    renderMaterials(`${MATERIALS}/concrete`);
    await settle();

    expect(within(row('c1')).getByLabelText('Managed by delivery tracking')).toBeTruthy();
    expect(within(row('c1')).queryByRole('button', { name: 'Edit actual MAT-CON-001' })).toBeNull();

    fireEvent.click(subNavButton('Electrical'));
    await settle();

    expect(within(row('e1')).getByRole('button', { name: 'Edit actual MAT-ELE-001' })).toBeTruthy();
    expect(within(row('e1')).queryByLabelText('Managed by delivery tracking')).toBeNull();
  });

  it('should update the variance at once and send one budget-line PATCH when approved changes [AC-04.13]', async () => {
    const api = mockMaterialsApi();
    renderMaterials();
    await settle();
    expect(screen.getByTestId('section-variance').textContent).toBe('-€25.00');

    editCell('approved budget', '1,000.00');
    await settle();

    expect(screen.getByTestId('section-variance').textContent).toBe('€375.00');
    expect(within(screen.getByLabelText('Budget health')).getByText('Within budget')).toBeTruthy();
    expect(api.of('PATCH')).toHaveLength(0);
    await act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS));
    await settle();
    expect(api.of('PATCH')).toHaveLength(1);
    expect(api.of('PATCH')[0]).toMatchObject({ url: `/api/projects/${PID}/budget-lines/l-ele`, body: { approvedCents: 100_000 } });
  });
});
