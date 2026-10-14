import { fireEvent, screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { makeItem, makeLine, makeOrg, makeSnapshot } from '@default-project/budget-engine';
import { fakeResponse, mockApi, renderWithProviders } from '../../testing/render';
import { ProjectPage } from '../project/project-page';
import { OrgCell } from '../../ui/editable-table/cells';

function snapshot() {
  const org = makeOrg({ id: 'o1', name: 'Fenster Müller', legalForm: 'GmbH', phone: '+49 341 123 45', email: 'bau@fenster.example', contactPerson: 'Jonas Weber', contactRole: 'Site manager', role: 'SUPPLIER' });
  const work = makeItem({ id: 'w1', kind: 'WORK', code: 'WRK-WIN-001', name: 'Window installation', budgetLineId: 'l2', startDate: '2026-11-02', endDate: '2026-11-06' });
  const windows = makeItem({ id: 'm1', code: 'MAT-WIN-001', name: 'Triple-glazed windows', budgetLineId: 'l1', supplierId: 'o1', deliveryDate: '2026-11-11', requiredForWorkId: 'w1' });
  return makeSnapshot({ budgetLines: [makeLine({ id: 'l1' }), makeLine({ id: 'l2', category: 'CONSTRUCTION', section: 'windows-install' })], items: [windows, work], organizations: [org] });
}

function page(url: string) {
  mockApi({ 'GET /api/projects/p1': () => fakeResponse(snapshot()), 'GET /api/organizations': () => fakeResponse(snapshot().organizations) });
  return renderWithProviders(
    <Routes>
      <Route path="/projects/:projectId" element={<ProjectPage />}>
        <Route path="materials" element={<OrgCell orgId="o1" />} />
      </Route>
    </Routes>,
    { url },
  );
}

describe('OrganizationModal', () => {
  it('should show contacts and the organisation rows with dates when ?org is set [AC-02.7]', async () => {
    page('/projects/p1/materials?org=o1');

    const dialog = await screen.findByRole('dialog', { name: 'Fenster Müller GmbH' });
    expect(within(dialog).getByText('Jonas Weber')).toBeTruthy();
    expect(within(dialog).getByRole('link', { name: '+49 341 123 45' }).getAttribute('href')).toBe('tel:%2B4934112345');
    expect(within(dialog).getByRole('link', { name: 'bau@fenster.example' }).getAttribute('href')).toBe('mailto:bau%40fenster.example');
    expect(within(dialog).getByText('Triple-glazed windows')).toBeTruthy();
    expect(within(dialog).getByText('Delivery 11 Nov 2026')).toBeTruthy();
    expect(within(dialog).getByText('Late for work · 9 d')).toBeTruthy();
  });

  it('should open from an OrgCell and close on Escape [AC-02.7]', async () => {
    page('/projects/p1/materials');

    fireEvent.click(await screen.findByRole('button', { name: 'Fenster Müller' }));
    expect(await screen.findByRole('dialog', { name: 'Fenster Müller GmbH' })).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
