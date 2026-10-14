import { fireEvent, screen, within } from '@testing-library/react';
import { autosaveQueue } from '../../lib/autosave-queue';
import { Route, Routes } from 'react-router-dom';
import { fakeResponse, mockApi, renderWithProviders } from '../../testing/render';
import { makePlan, makeRooms } from './architecture-fixtures';
import { ArchitecturePage } from './architecture-page';
import { PID, planSnapshot, renderWithPlan } from './architecture-test-utils';

describe('ArchitecturePage', () => {
  beforeEach(() => autosaveQueue.__reset());

  it('should show the living area as Σ rooms and update it when a room width changes [AC-08.2]', async () => {
    mockApi({ 'PATCH /api/projects/project-1/plan/rooms/GF-LIV': () => fakeResponse({ ...makeRooms()[0], wCm: 600 }) });
    renderWithPlan(<ArchitecturePage />);

    expect(screen.getByTestId('living-area').textContent).toBe('143.65 m²');

    fireEvent.click(screen.getByTestId('room-GF-LIV'));
    fireEvent.change(within(screen.getByRole('dialog')).getByLabelText('Width (cm)'), { target: { value: '600' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('146.01 m²')).toBeTruthy();
    expect(screen.getByTestId('living-area').textContent).toBe('146.01 m²');
  });

  it('should render the passport, both drawings, the house sections and the ARCHITECTURE health panel', () => {
    renderWithPlan(<ArchitecturePage />);

    expect(screen.getByRole('img', { name: 'Ground floor plan' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Site plan' })).toBeTruthy();
    expect(screen.getAllByRole('tab')).toHaveLength(2 + 10);
    expect(screen.getByRole('tab', { name: 'Heating & ventilation' })).toBeTruthy();
  });

  it('should offer to create a plan when the project has none', async () => {
    const fetchMock = mockApi({ 'PATCH /api/projects/project-1/plan': () => fakeResponse(makePlan()) });
    renderWithPlan(<ArchitecturePage />, planSnapshot({ plan: null }));

    fireEvent.click(screen.getByRole('button', { name: 'Create plan' }));

    expect(await screen.findByTestId('living-area')).toBeTruthy();
    expect(fetchMock.mock.calls[0][1]?.method).toBe('PATCH');
  });

  it('should show an error state with retry when the project fails to load', async () => {
    mockApi({ 'GET /api/projects/project-1': () => fakeResponse({ message: 'Boom' }, 500) });
    renderWithProviders(
      <Routes>
        <Route path="/projects/:projectId/architecture" element={<ArchitecturePage />} />
      </Routes>,
      { url: `/projects/${PID}/architecture` },
    );

    expect(await screen.findByText('Boom')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });
});
