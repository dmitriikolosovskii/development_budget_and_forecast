import { fireEvent, screen, within } from '@testing-library/react';
import { Route, Routes, useParams } from 'react-router-dom';
import { makeItem, makeLine, makeSnapshot } from '@default-project/budget-engine';
import { useUiStore } from '../../lib/ui-store';
import { fakeResponse, mockApi, renderWithProviders } from '../../testing/render';
import { ProjectPage } from './project-page';

function SectionProbe() {
  const { section } = useParams();
  return <p>section={section}</p>;
}

function page(url: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/projects/:projectId" element={<ProjectPage />}>
        <Route path="materials/:section?" element={<SectionProbe />} />
        <Route path="land" element={<p>land</p>} />
      </Route>
    </Routes>,
    { url },
  );
}

export function fixtureSnapshot() {
  const line = makeLine({ id: 'l1', approvedCents: 1_000_000 });
  return makeSnapshot({
    budgetLines: [line],
    items: [
      makeItem({ id: 'a', budgetLineId: 'l1', qtyMilli: 2000, unitPriceCents: 300_000, committedCents: 400_000, actualCents: 150_000 }),
    ],
  });
}

describe('ProjectPage', () => {
  beforeEach(() => useUiStore.setState({ lastSection: {} }));

  it('should mark the Building materials tab active and pass the section [AC-02.2]', async () => {
    mockApi({ 'GET /api/projects/p1': () => fakeResponse(fixtureSnapshot()) });

    page('/projects/p1/materials/electrical');

    expect(screen.getByText('section=electrical')).toBeTruthy();
    const tablist = screen.getByRole('tablist', { name: 'Project sections' });
    expect(within(tablist).getByRole('tab', { name: 'Building materials' }).getAttribute('aria-selected')).toBe('true');
    expect(within(tablist).getByRole('tab', { name: 'Land' }).getAttribute('aria-selected')).toBe('false');
    expect(await screen.findByRole('heading', { name: 'Test project' })).toBeTruthy();
  });

  it('should show the five CFO numbers for the snapshot [AC-02.3]', async () => {
    mockApi({ 'GET /api/projects/p1': () => fakeResponse(fixtureSnapshot()) });

    page('/projects/p1/land');

    // planned 6,000; committed 4,000 → forecast 6,000; actual 1,500; open commitments 2,500; variance 4,000
    const value = async (label: string) => (await screen.findByText(label)).nextElementSibling?.textContent;
    expect(await value('Budget')).toBe('€10,000');
    expect(await value('Spent')).toBe('€1,500');
    expect(await value('Open commitments')).toBe('€2,500');
    expect(await value('Forecast (EAC)')).toBe('€6,000');
    expect(await value('Variance')).toBe('€4,000');
  });

  it('should show skeletons while the snapshot loads [AC-02.3]', () => {
    mockApi({ 'GET /api/projects/p1': () => new Promise<Response>(() => undefined) });

    page('/projects/p1/land');

    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThanOrEqual(5);
  });

  it('should show an error with a working retry when the snapshot fails [AC-02.3]', async () => {
    const fetchMock = mockApi({ 'GET /api/projects/p1': () => fakeResponse({ message: 'Project not found' }, 404) });

    page('/projects/p1/land');

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Project not found');
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('should link a tab to its remembered sub-section', async () => {
    mockApi({ 'GET /api/projects/p1': () => fakeResponse(fixtureSnapshot()) });
    useUiStore.setState({ lastSection: { materials: 'roofing' } });

    page('/projects/p1/land');

    expect(screen.getByRole('tab', { name: 'Building materials' }).getAttribute('href')).toBe('/projects/p1/materials/roofing');
  });
});
