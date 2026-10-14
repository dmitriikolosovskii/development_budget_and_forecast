import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { HOUSE_SECTIONS, type HouseSection } from '@default-project/types';
import { Card, SectionTitle } from '../../ui/card';
import { cx, FOCUS, SOFT } from '../../ui/cx';
import { Skeleton } from '../../ui/skeleton';
import { EmptyState, ErrorState } from '../../ui/states';
import { BudgetHealthPanel } from '../project/budget-health-panel';
import {
  ArchitectureCosts,
  HouseSectionCostChart,
} from './architecture-totals';
import { BoqSection } from './boq-section';
import { FloorPlan } from './floor-plan';
import { HOUSE_SECTION_INFO } from './house-sections';
import { PlanPassport } from './plan-passport';
import { SitePlan } from './site-plan';
import { usePlan } from './use-plan';
import { useCreatePlan } from './use-plan-edits';

function HouseSections({ projectId }: { projectId: string }) {
  const [active, setActive] = useState<HouseSection>('SITE_FOUNDATION');
  return (
    <Card>
      <SectionTitle subtitle="What goes into the build and how much; quantities drive the linked Building materials rows">
        House sections
      </SectionTitle>
      <div
        role="tablist"
        aria-label="House sections"
        className="mb-4 flex gap-1 overflow-x-auto pb-1"
      >
        {HOUSE_SECTIONS.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={active === s}
            onClick={() => setActive(s)}
            className={cx(
              'shrink-0 rounded-full px-3 py-1 text-sm',
              active === s
                ? 'bg-brand-500 text-white'
                : 'bg-subtle text-muted hover:text-ink',
              SOFT,
              FOCUS,
            )}
          >
            {HOUSE_SECTION_INFO[s].label}
          </button>
        ))}
      </div>
      <div key={active} className="animate-fade-in">
        <BoqSection projectId={projectId} section={active} />
      </div>
    </Card>
  );
}

/** `/projects/:projectId/architecture`: passport, floor plan, site plan, BOQ by house section, totals. */
export function ArchitecturePage() {
  const { projectId = '' } = useParams();
  const query = usePlan(projectId);
  const createPlan = useCreatePlan(projectId);

  if (query.isPending) return <Skeleton className="h-96" lines={6} />;
  if (query.isError)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  if (!query.data) {
    return (
      <Card>
        <EmptyState
          title="No architecture plan yet"
          description="Start from the standard detached house for a family of 4 and adjust rooms and quantities."
          action={
            <button
              type="button"
              onClick={() => void createPlan()}
              className={cx(
                'rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600',
                SOFT,
                FOCUS,
              )}
            >
              Create plan
            </button>
          }
        />
      </Card>
    );
  }

  return (
    <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">
        <Card>
          <SectionTitle subtitle="Editable; saved automatically">
            Project passport
          </SectionTitle>
          <PlanPassport projectId={projectId} />
        </Card>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Card>
            <SectionTitle subtitle="Rooms are rectangles inside the outer walls">
              Floor plan
            </SectionTitle>
            <FloorPlan projectId={projectId} />
          </Card>
          <Card>
            <SectionTitle subtitle="The house on the plot with distances to the boundaries">
              Site plan
            </SectionTitle>
            <SitePlan projectId={projectId} />
          </Card>
        </div>
        <HouseSections projectId={projectId} />
        <HouseSectionCostChart projectId={projectId} />
        <Card>
          <SectionTitle subtitle="Design (HOAI work stages), engineering, permits and insurance">
            Architecture costs
          </SectionTitle>
          <ArchitectureCosts projectId={projectId} />
        </Card>
      </div>
      <aside className="2xl:sticky 2xl:top-4 2xl:self-start">
        <BudgetHealthPanel projectId={projectId} category="ARCHITECTURE" />
      </aside>
    </div>
  );
}
