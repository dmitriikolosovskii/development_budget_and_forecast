import {
  IsInt,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  OptionalNotNull,
  OptionalNullable,
} from '../../projects/dto/validators';

/** Caps keep area × land value per m² a safe integer (≤ 1e14 cents) and every Int inside 32 bits. */
export const LAND_CAPS = {
  areaM2: 1_000_000,
  plotCm: 1_000_000,
  landValuePerM2Cents: 100_000_000,
  grzBps: 10_000,
  gfzBps: 50_000,
  maxStoreys: 20,
  bearingCapacityKnM2: 100_000,
  groundwaterDepthCm: 100_000,
} as const;

const TEXT = 200;
const NOTES = 2000;

/** PATCH body: every field optional; `null` clears nullable columns only (NOT NULL columns → 400). */
export class UpdateLandDto {
  @OptionalNotNull() @IsString() @MaxLength(TEXT) address?: string;
  @OptionalNotNull() @IsString() @MaxLength(20) postalCode?: string;
  @OptionalNotNull() @IsString() @MaxLength(TEXT) municipality?: string;
  @OptionalNullable() @IsString() @MaxLength(TEXT) district?: string | null;
  @OptionalNotNull() @IsString() @MaxLength(TEXT) state?: string;
  @OptionalNullable() @IsString() @MaxLength(TEXT) cadastralRef?: string | null;
  @OptionalNotNull()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-90)
  @Max(90)
  lat?: number;
  @OptionalNotNull()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-180)
  @Max(180)
  lng?: number;
  @OptionalNotNull() @IsInt() @Min(0) @Max(LAND_CAPS.areaM2) areaM2?: number;
  @OptionalNotNull()
  @IsInt()
  @Min(0)
  @Max(LAND_CAPS.plotCm)
  plotWidthCm?: number;
  @OptionalNotNull()
  @IsInt()
  @Min(0)
  @Max(LAND_CAPS.plotCm)
  plotDepthCm?: number;
  @OptionalNotNull()
  @IsInt()
  @Min(0)
  @Max(LAND_CAPS.landValuePerM2Cents)
  landValuePerM2Cents?: number;
  @OptionalNotNull() @IsString() @MaxLength(TEXT) zoningPlan?: string;
  @OptionalNotNull() @IsInt() @Min(0) @Max(LAND_CAPS.grzBps) grzBps?: number;
  @OptionalNotNull() @IsInt() @Min(0) @Max(LAND_CAPS.gfzBps) gfzBps?: number;
  @OptionalNotNull()
  @IsInt()
  @Min(0)
  @Max(LAND_CAPS.maxStoreys)
  maxStoreys?: number;
  @OptionalNotNull() @IsString() @MaxLength(NOTES) roofRules?: string;
  @OptionalNullable() @IsString() @MaxLength(NOTES) buildingLineNotes?:
    | string
    | null;
  @OptionalNotNull() @IsString() @MaxLength(TEXT) soilType?: string;
  @OptionalNotNull() @IsString() @MaxLength(TEXT) soilClass?: string;
  @OptionalNullable()
  @IsInt()
  @Min(0)
  @Max(LAND_CAPS.bearingCapacityKnM2)
  bearingCapacityKnM2?: number | null;
  @OptionalNullable()
  @IsInt()
  @Min(0)
  @Max(LAND_CAPS.groundwaterDepthCm)
  groundwaterDepthCm?: number | null;
  @OptionalNullable() @IsString() @MaxLength(NOTES) contaminationNotes?:
    | string
    | null;
  @OptionalNullable() @IsString() @MaxLength(NOTES) slopeNotes?: string | null;
  @OptionalNullable() @IsString() @MaxLength(TEXT) orientation?: string | null;
  @OptionalNullable() @IsString() @MaxLength(NOTES) notes?: string | null;
}
