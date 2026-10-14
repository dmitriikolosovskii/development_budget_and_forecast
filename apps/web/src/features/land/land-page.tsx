import { MapPin } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { Card } from '../../ui/card';
import { Skeleton } from '../../ui/skeleton';
import { EmptyState, ErrorState } from '../../ui/states';
import { useProjectSnapshot } from '../project/use-project-snapshot';
import { selectLand } from './land-cache';
import { LandCostsSection } from './land-sections/land-costs-section';
import { LocationSection } from './land-sections/location-section';
import { PlotSection } from './land-sections/plot-section';
import { SoilSection } from './land-sections/soil-section';
import { UtilitiesSection } from './land-sections/utilities-section';
import { ZoningSection } from './land-sections/zoning-section';
import { useCreateLand } from './use-create-land';

/** `/projects/:projectId/land`: the plot card (every field autosaved) and the LAND costs. */
export function LandPage() {
  const { projectId = '' } = useParams();
  const query = useProjectSnapshot(projectId, selectLand);
  const create = useCreateLand(projectId);

  if (query.isPending) {
    return (
      <Card>
        <Skeleton lines={8} />
      </Card>
    );
  }
  if (query.isError)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );

  const land = query.data;
  return (
    <div className="animate-[fade-in_180ms] space-y-4">
      {land ? (
        <>
          <LocationSection projectId={projectId} land={land} />
          <div className="grid gap-4 xl:grid-cols-2">
            <PlotSection projectId={projectId} land={land} />
            <ZoningSection projectId={projectId} land={land} />
          </div>
          <SoilSection projectId={projectId} land={land} />
          <UtilitiesSection projectId={projectId} land={land} />
        </>
      ) : (
        <EmptyState
          title="No land details yet"
          description="Add the plot to track its location, zoning, soil and utility connections."
          action={
            <button
              type="button"
              disabled={create.isPending}
              onClick={() => create.mutate()}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
            >
              <MapPin aria-hidden className="h-4 w-4" />
              Add land details
            </button>
          }
        />
      )}
      <LandCostsSection projectId={projectId} />
    </div>
  );
}
