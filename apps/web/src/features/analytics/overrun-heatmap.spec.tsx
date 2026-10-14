import { render, screen } from '@testing-library/react';
import { heatTone, OverrunHeatmap } from './overrun-heatmap';
import { makeAnalyticsProjects } from './portfolio-fixture';

describe('overrun heatmap', () => {
  it('should give a red tone to variance < 0 and green to variance ≥ 0 [AC-11.3]', () => {
    expect(heatTone({ approved: 100, forecast: 101, variance: -1 })).toBe(
      'risk',
    );
    expect(heatTone({ approved: 100, forecast: 100, variance: 0 })).toBe('ok');
    expect(heatTone({ approved: 100, forecast: 99, variance: 1 })).toBe('ok');
    expect(heatTone({ approved: 100, forecast: 101, variance: -1 })).not.toBe(
      'ok',
    );
    expect(heatTone({ approved: 0, forecast: 0, variance: 0 })).toBe('muted');
  });

  it('should render red and green cells with the variance percent of the approved budget [AC-11.3]', () => {
    render(<OverrunHeatmap projects={makeAnalyticsProjects()} />);

    // Taucha MATERIALS: approved 200,000, forecast 210,000 → −5.0 %
    const over = screen.getByTitle(/Stadtvilla Taucha · Materials/);
    const within = screen.getByTitle(/Villa Markkleeberg · Construction/);
    expect(over.getAttribute('data-tone')).toBe('risk');
    expect(over.className).toContain('bg-risk-50');
    expect(over.className).not.toContain('bg-ok-50');
    expect(over.textContent).toBe('-5%');
    expect(within.getAttribute('data-tone')).toBe('ok');
    expect(within.className).not.toContain('bg-risk-50');
  });
});
