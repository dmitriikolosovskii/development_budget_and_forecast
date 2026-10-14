import { catalogSections } from '@default-project/types';
import { applyDecorators } from '@nestjs/common';
import { IsInt, Max, Min } from 'class-validator';

/** Drawing geometry in cm (CONTRACTS §1). The 2e9 money cap does not apply; 1 km keeps w × h a safe integer. */
export const MAX_GEOMETRY_CM = 100_000;

export function IsSizeCm(): PropertyDecorator {
  return applyDecorators(IsInt(), Min(1), Max(MAX_GEOMETRY_CM));
}

export function IsPositionCm(): PropertyDecorator {
  return applyDecorators(IsInt(), Min(0), Max(MAX_GEOMETRY_CM));
}

/** Site offset of the house on the plot; may be negative (house sticking out = a warning, not an error). */
export function IsOffsetCm(): PropertyDecorator {
  return applyDecorators(IsInt(), Min(-MAX_GEOMETRY_CM), Max(MAX_GEOMETRY_CM));
}

export const ROOM_FLOORS = [0, 1] as const;

/** `BoqComponent.materialSection` must be a MATERIALS line slug (CONTRACTS §4). */
export const MATERIAL_SECTIONS = catalogSections('MATERIALS').map(
  (s) => s.section,
);
