import {
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  OptionalNotNull,
  OptionalNullable,
} from '../../projects/dto/validators';
import { IsOffsetCm, IsSizeCm } from './validators';

/** PATCH /projects/:id/plan — every field optional; creates the plan with defaults on first use. */
export class UpdatePlanDto {
  @OptionalNotNull() @IsString() @MinLength(1) @MaxLength(200) name?: string;
  @OptionalNullable() @IsString() architectOrgId?: string | null;
  @OptionalNotNull() @IsString() @MaxLength(200) style?: string;
  @OptionalNotNull() @IsInt() @Min(1) @Max(5) storeys?: number;
  @OptionalNotNull() @IsString() @MaxLength(200) roofType?: string;
  @OptionalNotNull() @IsInt() @Min(0) @Max(90) roofPitchDeg?: number;
  @OptionalNotNull() @IsString() @MaxLength(200) energyStandard?: string;
  @OptionalNotNull() @IsString() @MaxLength(200) heatingSystem?: string;
  @OptionalNotNull() @IsInt() @Min(0) @Max(50) occupants?: number;
  @OptionalNotNull() @IsSizeCm() footprintWidthCm?: number;
  @OptionalNotNull() @IsSizeCm() footprintDepthCm?: number;
  @OptionalNotNull() @IsOffsetCm() siteOffsetXcm?: number;
  @OptionalNotNull() @IsOffsetCm() siteOffsetYcm?: number;
  @OptionalNullable() @IsString() @MaxLength(2000) notes?: string | null;
}
