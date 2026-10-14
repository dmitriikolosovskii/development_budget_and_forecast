import type { ProjectCache } from '../project/project-cache';
import { useProjectSnapshot } from '../project/use-project-snapshot';
import { Skeleton } from '../../ui/skeleton';
import { cx } from '../../ui/cx';
import { DRAW } from './drawing-colors';
import { NorthArrow } from './north-arrow';
import { allowedFootprintM2, formatAreaM2, formatMetres, isHouseOnPlot, siteSetbacks } from './plan-geometry';

/** Minimum distance to a boundary used for the buildable window (SächsBO § 6: 3 m). */
export const MIN_SETBACK_CM = 300;

export interface SitePlanProps {
  projectId: string;
  className?: string;
}

const selectSite = (c: ProjectCache) => ({ land: c.land, plan: c.plan });

interface DimProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
}

/** A dimension line with its length in metres. */
function Dim({ x1, y1, x2, y2, label }: DimProps) {
  const vertical = x1 === x2;
  return (
    <g aria-hidden>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={DRAW.brand} strokeWidth={6} strokeDasharray="18 12" />
      <text
        x={(x1 + x2) / 2 + (vertical ? 20 : 0)}
        y={(y1 + y2) / 2 - (vertical ? 0 : 16)}
        fontSize={56}
        textAnchor={vertical ? 'start' : 'middle'}
        fill={DRAW.brand}
      >
        {label}
      </text>
    </g>
  );
}

/**
 * Read-only site plan: the plot, the house at `siteOffset*`, setbacks to the four boundaries (street = top),
 * and the buildable window (3 m from every boundary, hatched) with the GRZ limit. Embedded by the Land tab.
 */
export function SitePlan({ projectId, className }: SitePlanProps) {
  const query = useProjectSnapshot(projectId, selectSite);
  if (query.isPending) return <Skeleton className={cx('h-64', className)} />;
  const land = query.data?.land;
  const plan = query.data?.plan;
  if (!land) return <p className={cx('text-sm text-muted', className)}>No plot data</p>;

  const W = land.plotWidthCm;
  const D = land.plotDepthCm;
  const pad = Math.round(Math.max(W, D) * 0.08);
  const setbacks = plan ? siteSetbacks(plan, land) : null;
  const onPlot = setbacks ? isHouseOnPlot(setbacks) : true;
  const allowed = allowedFootprintM2(land);
  const houseCm2 = plan ? plan.footprintWidthCm * plan.footprintDepthCm : 0;
  const houseM2 = houseCm2 / 10_000;

  return (
    <figure className={cx('space-y-2', className)}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`${-pad} ${-pad * 1.6} ${W + 2 * pad} ${D + pad * 2.6}`}
        role="img"
        aria-label="Site plan"
        className="h-auto w-full rounded-xl border border-line bg-surface"
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
      >
        <defs>
          <pattern id={`hatch-${projectId}`} width={40} height={40} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1={0} y1={0} x2={0} y2={40} stroke={DRAW.ok} strokeWidth={6} strokeOpacity={0.35} />
          </pattern>
        </defs>
        <text x={W / 2} y={-pad * 0.7} fontSize={70} textAnchor="middle" fill={DRAW.muted}>
          Street
        </text>
        <line x1={-pad} y1={-pad * 0.4} x2={W + pad} y2={-pad * 0.4} stroke={DRAW.line} strokeWidth={24} />
        <rect x={0} y={0} width={W} height={D} fill={DRAW.okSoft} stroke={DRAW.ink} strokeWidth={8} />
        {W > 2 * MIN_SETBACK_CM && D > 2 * MIN_SETBACK_CM && (
          <rect
            data-testid="buildable-area"
            x={MIN_SETBACK_CM}
            y={MIN_SETBACK_CM}
            width={W - 2 * MIN_SETBACK_CM}
            height={D - 2 * MIN_SETBACK_CM}
            fill={`url(#hatch-${projectId})`}
            stroke={DRAW.ok}
            strokeWidth={4}
            strokeDasharray="24 16"
          />
        )}
        {plan && setbacks && (
          <g>
            <rect
              data-testid="site-house"
              x={plan.siteOffsetXcm}
              y={plan.siteOffsetYcm}
              width={plan.footprintWidthCm}
              height={plan.footprintDepthCm}
              fill={onPlot ? DRAW.surface : DRAW.riskSoft}
              stroke={onPlot ? DRAW.ink : DRAW.risk}
              strokeWidth={onPlot ? 10 : 16}
            />
            <text
              x={plan.siteOffsetXcm + plan.footprintWidthCm / 2}
              y={plan.siteOffsetYcm + plan.footprintDepthCm / 2}
              fontSize={60}
              textAnchor="middle"
              fill={DRAW.ink}
            >
              House
            </text>
            {setbacks.street > 0 && (
              <Dim
                x1={plan.siteOffsetXcm + plan.footprintWidthCm / 2}
                y1={0}
                x2={plan.siteOffsetXcm + plan.footprintWidthCm / 2}
                y2={plan.siteOffsetYcm}
                label={formatMetres(setbacks.street)}
              />
            )}
            {setbacks.rear > 0 && (
              <Dim
                x1={plan.siteOffsetXcm + plan.footprintWidthCm / 2}
                y1={plan.siteOffsetYcm + plan.footprintDepthCm}
                x2={plan.siteOffsetXcm + plan.footprintWidthCm / 2}
                y2={D}
                label={formatMetres(setbacks.rear)}
              />
            )}
            {setbacks.left > 0 && (
              <Dim
                x1={0}
                y1={plan.siteOffsetYcm + plan.footprintDepthCm / 2}
                x2={plan.siteOffsetXcm}
                y2={plan.siteOffsetYcm + plan.footprintDepthCm / 2}
                label={formatMetres(setbacks.left)}
              />
            )}
            {setbacks.right > 0 && (
              <Dim
                x1={plan.siteOffsetXcm + plan.footprintWidthCm}
                y1={plan.siteOffsetYcm + plan.footprintDepthCm / 2}
                x2={W}
                y2={plan.siteOffsetYcm + plan.footprintDepthCm / 2}
                label={formatMetres(setbacks.right)}
              />
            )}
          </g>
        )}
        <NorthArrow x={W + pad / 2} y={pad * 0.2} size={pad * 0.6} />
      </svg>
      <figcaption className="space-y-1 text-sm text-muted">
        <p>
          Plot {formatMetres(W)} × {formatMetres(D)} · {land.areaM2} m² · GRZ {(land.grzBps / 10_000).toFixed(2)}: allowed
          footprint <span className="font-medium text-ink">{allowed} m²</span>
          {plan && (
            <>
              {' '}
              · house <span className={cx('font-medium', houseM2 > allowed ? 'text-risk-600' : 'text-ink')}>{formatAreaM2(houseCm2)}</span>
            </>
          )}
        </p>
        {setbacks && (
          <p data-testid="setbacks">
            Street {formatMetres(setbacks.street)} · Rear {formatMetres(setbacks.rear)} · Left {formatMetres(setbacks.left)} · Right{' '}
            {formatMetres(setbacks.right)}
          </p>
        )}
        {!plan && <p>No house plan yet</p>}
        {!onPlot && (
          <p role="alert" className="font-medium text-risk-600">
            House extends outside the plot
          </p>
        )}
      </figcaption>
    </figure>
  );
}
