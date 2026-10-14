import { itemPlannedCents } from '@default-project/budget-engine';
import type { CostItem, LandParcel, UtilityType } from '@default-project/types';

/**
 * Pure Land-tab rules (no React, no feature imports: block 08 may import this file).
 * Zero values come from a parcel created by the first PATCH, so they mean "not set" → `null`.
 */

/** Allowed footprint per B-Plan in cm²: m² × GRZ = areaM2 × grzBps / 10 000 m² = areaM2 × grzBps cm² (exact). */
export function allowedFootprintCm2(
  areaM2: number,
  grzBps: number,
): number | null {
  return areaM2 > 0 && grzBps > 0 ? areaM2 * grzBps : null;
}

/** Max gross floor area per GFZ in cm² (same arithmetic as GRZ). */
export function maxGrossFloorAreaCm2(
  areaM2: number,
  gfzBps: number,
): number | null {
  return areaM2 > 0 && gfzBps > 0 ? areaM2 * gfzBps : null;
}

export interface FootprintSource {
  footprintWidthCm: number;
  footprintDepthCm: number;
}

/** House footprint from the architecture plan, or `null` without a plan. */
export function houseFootprintCm2(
  plan: FootprintSource | null | undefined,
): number | null {
  if (!plan || plan.footprintWidthCm <= 0 || plan.footprintDepthCm <= 0)
    return null;
  return plan.footprintWidthCm * plan.footprintDepthCm;
}

export type FootprintStatus = 'WITHIN' | 'EXCEEDS';

/** Equal to the limit is still within it. `null` when either side is unknown. */
export function footprintStatus(
  allowedCm2: number | null,
  actualCm2: number | null,
): FootprintStatus | null {
  if (allowedCm2 === null || actualCm2 === null) return null;
  return actualCm2 <= allowedCm2 ? 'WITHIN' : 'EXCEEDS';
}

const m2 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });
/** 2,080,000 cm² → "208 m²", 2,084,000 → "208.4 m²". */
export function formatCm2AsM2(cm2: number): string {
  return `${m2.format(cm2 / 10_000)} m²`;
}

const metres = new Intl.NumberFormat('en-GB', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
/** 2600 cm → "26.00 m". */
export function formatCmAsM(cm: number): string {
  return `${metres.format(cm / 100)} m`;
}

/**
 * DIN 18300 soil class 1–7: a leading bare number ("4 (DIN 18300, …)", the seed format)
 * or "class|Klasse|BK" + number ("DIN 18300 class 4"). Anything else is unknown (`null`).
 */
export function parseSoilClass(text: string): number | null {
  const match =
    /^\s*([1-7])(?!\d)/.exec(text) ??
    /\b(?:class|klasse|bk)\s*([1-7])(?!\d)/i.exec(text);
  return match ? Number(match[1]) : null;
}

export const GROUNDWATER_RISK_CM = 200;
export const SOIL_CLASS_RISK = 5;

export interface SoilRisk {
  risk: boolean;
  reasons: string[];
}

/** BLOCK 07: groundwater shallower than 2 m or soil class ≥ 5 → warn. */
export function soilRisk(
  land: Pick<LandParcel, 'groundwaterDepthCm' | 'soilClass'>,
): SoilRisk {
  const reasons: string[] = [];
  if (
    land.groundwaterDepthCm !== null &&
    land.groundwaterDepthCm < GROUNDWATER_RISK_CM
  ) {
    reasons.push(
      `Groundwater at ${formatCmAsM(land.groundwaterDepthCm)} (< 2 m)`,
    );
  }
  const soilClass = parseSoilClass(land.soilClass);
  if (soilClass !== null && soilClass >= SOIL_CLASS_RISK)
    reasons.push(`Soil class ${soilClass} (≥ 5)`);
  return { risk: reasons.length > 0, reasons };
}

/** Plot price in cents = area × land value per m²; the API caps keep it a safe integer. */
export function plotPriceCents(
  areaM2: number,
  landValuePerM2Cents: number,
): number | null {
  return areaM2 > 0 && landValuePerM2Cents > 0
    ? areaM2 * landValuePerM2Cents
    : null;
}

/** Σ planned of a line's rows (rounded per row, never re-rounded: CONTRACTS §3). */
export function plannedTotalCents(items: CostItem[]): number {
  return items.reduce((sum, item) => sum + itemPlannedCents(item), 0);
}

// The type comes from the FIRST word(s) of the row name, so one row maps to at most one type:
// "Temporary site power and water" → none, "Sewer & stormwater connection" → SEWER only.
const LEADING_KEYWORDS: Array<[RegExp, UtilityType]> = [
  [/^district\s+heating\b/i, 'DISTRICT_HEATING'],
  [/^(?:power|electricity|electric)\b/i, 'POWER'],
  [/^(?:drinking\s+)?water\b/i, 'WATER'],
  [/^(?:sewer|sewage|wastewater)\b/i, 'SEWER'],
  [/^storm\s*water\b/i, 'STORMWATER'],
  [/^(?:telecom|fibre|fiber|broadband)\b/i, 'TELECOM'],
  [/^gas\b/i, 'GAS'],
];

export function utilityTypeForItem(name: string): UtilityType | null {
  const trimmed = name.trim();
  for (const [pattern, type] of LEADING_KEYWORDS)
    if (pattern.test(trimmed)) return type;
  return null;
}

export interface UtilityCosts {
  byType: Partial<Record<UtilityType, number>>;
  /** Rows that are not a connection of one type (wall entry, temporary site supply, …). */
  otherCents: number;
  totalCents: number;
}

/** Planned connection costs from the `site-development` rows, one type per row. */
export function utilityCosts(items: CostItem[]): UtilityCosts {
  const byType: Partial<Record<UtilityType, number>> = {};
  let otherCents = 0;
  let totalCents = 0;
  for (const item of items) {
    const cents = itemPlannedCents(item);
    totalCents += cents;
    const type = utilityTypeForItem(item.name);
    if (type) byType[type] = (byType[type] ?? 0) + cents;
    else otherCents += cents;
  }
  return { byType, otherCents, totalCents };
}

/** 0,0 is the blank default, not a real plot. */
export function hasCoordinates(lat: number, lng: number): boolean {
  return lat !== 0 || lng !== 0;
}

export function osmUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}
