import { screen } from '@testing-library/react';
import { makeLand } from '../architecture/architecture-fixtures';
import { PID, planSnapshot, renderWithPlan } from '../architecture/architecture-test-utils';
import { PlotDiagram } from './plot-diagram';

describe('PlotDiagram on the Land tab', () => {
  it('should show block 08 SitePlan with the house when the project has a plan', () => {
    renderWithPlan(<PlotDiagram projectId={PID} land={{ ...makeLand(), utilities: [] }} />);

    expect(screen.getByRole('img', { name: 'Site plan' })).toBeTruthy();
    expect(screen.getByTestId('site-house')).toBeTruthy();
  });

  it('should still show the plot without a house when the project has no plan', () => {
    renderWithPlan(<PlotDiagram projectId={PID} land={{ ...makeLand(), utilities: [] }} />, planSnapshot({ plan: null }));

    expect(screen.getByRole('img', { name: 'Site plan' })).toBeTruthy();
    expect(screen.queryByTestId('site-house')).toBeNull();
  });
});
