import {
  ENERGY_STANDARDS,
  HEATING_OPTIONS,
  MAX_BPS,
  UTILITY_STATUSES,
  UTILITY_TYPES,
  WALL_TYPES,
  type UtilityStatus,
  type UtilityType,
} from '@default-project/types';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IsCappedInt, IsIsoDate } from '../../projects/dto/validators';

/** Living area the wizard accepts (BLOCK 12 step 3); narrower than the shared schema (20–2000). */
export const WIZARD_MIN_LIVING_AREA_M2 = 100;
export const WIZARD_MAX_LIVING_AREA_M2 = 250;

export class WizardUtilityDto {
  @IsIn(UTILITY_TYPES) type!: UtilityType;
  @IsIn(UTILITY_STATUSES) status!: UtilityStatus;
}

export class WizardLandDto {
  @IsString() @MinLength(1) @MaxLength(300) address!: string;
  @IsString() @MinLength(1) @MaxLength(20) postalCode!: string;
  @IsString() @MinLength(1) @MaxLength(200) municipality!: string;
  @IsString() @MinLength(1) @MaxLength(100) state!: string;
  @IsInt() @Min(1) @Max(1_000_000) areaM2!: number;
  @IsCappedInt() landValuePerM2Cents!: number;
  @IsInt() @Min(0) @Max(MAX_BPS) grzBps!: number;
  @IsInt() @Min(0) @Max(MAX_BPS) gfzBps!: number;
  @IsInt() @Min(1) @Max(20) maxStoreys!: number;
  @IsString() @MinLength(1) @MaxLength(100) soilClass!: string;
  @IsOptional() @IsInt() @Min(0) @Max(100_000) groundwaterDepthCm?: number;
  @IsArray()
  @ArrayMaxSize(UTILITY_TYPES.length)
  @ValidateNested({ each: true })
  @Type(() => WizardUtilityDto)
  utilities!: WizardUtilityDto[];
}

export class WizardHouseDto {
  @IsInt()
  @Min(WIZARD_MIN_LIVING_AREA_M2)
  @Max(WIZARD_MAX_LIVING_AREA_M2)
  livingAreaM2!: number;
  @IsIn([1, 2]) storeys!: 1 | 2;
  @IsIn(ENERGY_STANDARDS) energyStandard!: (typeof ENERGY_STANDARDS)[number];
  @IsIn(HEATING_OPTIONS) heating!: (typeof HEATING_OPTIONS)[number];
  @IsIn(WALL_TYPES) wallType!: (typeof WALL_TYPES)[number];
}

/** All five categories are required when the object is sent (zod 4 `z.record` over the enum requires every key). */
export class ApprovedByCategoryDto {
  @IsCappedInt() LAND!: number;
  @IsCappedInt() ARCHITECTURE!: number;
  @IsCappedInt() MATERIALS!: number;
  @IsCappedInt() CONSTRUCTION!: number;
  @IsCappedInt() MARKETING!: number;
}

export class WizardInputDto {
  @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @IsString() @MinLength(1) @MaxLength(200) clientName!: string;
  @IsString() @MinLength(1) @MaxLength(200) city!: string;
  @IsIsoDate() startDate!: string;
  @IsInt() @Min(0) @Max(MAX_BPS) markupBps!: number;
  @IsDefined()
  @ValidateNested()
  @Type(() => WizardLandDto)
  land!: WizardLandDto;
  @IsDefined()
  @ValidateNested()
  @Type(() => WizardHouseDto)
  house!: WizardHouseDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => ApprovedByCategoryDto)
  approvedByCategory?: ApprovedByCategoryDto;
}
