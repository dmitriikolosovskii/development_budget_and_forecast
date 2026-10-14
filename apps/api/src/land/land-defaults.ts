import type { Prisma } from '@prisma/client';

/**
 * Blank values for a parcel created by the first PATCH (owner decision 2026-10-14).
 * The web app treats zero area/GRZ and 0,0 coordinates as "not set".
 */
export const LAND_DEFAULTS: Omit<
  Prisma.LandParcelUncheckedCreateInput,
  'projectId'
> = {
  address: '',
  postalCode: '',
  municipality: '',
  state: '',
  lat: 0,
  lng: 0,
  areaM2: 0,
  plotWidthCm: 0,
  plotDepthCm: 0,
  landValuePerM2Cents: 0,
  zoningPlan: '',
  grzBps: 0,
  gfzBps: 0,
  maxStoreys: 0,
  roofRules: '',
  soilType: '',
  soilClass: '',
};

/** Drops keys whose value is `undefined` (DTO class fields), so they never override defaults. */
export function definedOnly<T extends object>(input: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}
