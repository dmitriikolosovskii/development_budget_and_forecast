import { SitePlan } from '../architecture/site-plan';
import type { CachedLand } from './land-cache';

/**
 * The site diagram on the Land tab: block 08's `SitePlan` (plot to scale, buildable area, house from the plan,
 * north arrow), so Land and Architecture draw the same picture from the same snapshot.
 * Replaced 07's placeholder after `08.merged` (07 HANDOFF, DESIGN constraint 10). `land` stays in the props
 * so `location-section.tsx` is unchanged; SitePlan reads the land from the snapshot itself.
 */
export function PlotDiagram({ projectId }: { projectId: string; land: CachedLand }) {
  return <SitePlan projectId={projectId} />;
}
