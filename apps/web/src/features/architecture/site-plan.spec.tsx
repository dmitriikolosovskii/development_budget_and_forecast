import { screen } from '@testing-library/react';
import { makeComponent, makeLand, makePlan, makeRooms } from './architecture-fixtures';
import { PID, planSnapshot, renderWithPlan } from './architecture-test-utils';
import { SitePlan } from './site-plan';

describe('SitePlan', () => {
  it('should place the seed house inside the plot with setbacks 4.0 / 7.0 / 8.0 / 8.0 m [AC-08.6]', () => {
    renderWithPlan(<SitePlan projectId={PID} />);

    expect(screen.getByTestId('setbacks').textContent).toBe('Street 4.0 m · Rear 7.0 m · Left 8.0 m · Right 8.0 m');
    expect(screen.getByText('208 m²')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByTestId('site-house').getAttribute('x')).toBe('800');
  });

  it('should warn when the house extends outside the plot [AC-08.6]', () => {
    renderWithPlan(
      <SitePlan projectId={PID} />,
      planSnapshot({ plan: { ...makePlan({ siteOffsetXcm: 1700 }), rooms: makeRooms(), components: [makeComponent()] } }),
    );

    expect(screen.getByRole('alert').textContent).toBe('House extends outside the plot');
  });

  it('should render the plot only when the project has no plan', () => {
    renderWithPlan(<SitePlan projectId={PID} />, planSnapshot({ plan: null }));

    expect(screen.getByText('No house plan yet')).toBeTruthy();
    expect(screen.queryByTestId('site-house')).toBeNull();
  });

  it('should say there is no plot data when the project has no land', () => {
    renderWithPlan(<SitePlan projectId={PID} />, planSnapshot({ land: null, plan: { ...makePlan(), rooms: [], components: [] } }));

    expect(screen.getByText('No plot data')).toBeTruthy();
  });

  it('should use the land plot size from the snapshot', () => {
    renderWithPlan(<SitePlan projectId={PID} />, planSnapshot({ land: { ...makeLand({ plotWidthCm: 1500 }), utilities: [] } }));

    expect(screen.getByRole('alert').textContent).toBe('House extends outside the plot');
  });
});
