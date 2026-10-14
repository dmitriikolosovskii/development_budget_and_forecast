import {
  HOUSE_SECTIONS,
  UNITS,
  type HouseSection,
  type Unit,
} from '@default-project/types';
import {
  IsIn,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  IsCappedInt,
  OptionalNotNull,
  OptionalNullable,
} from '../../projects/dto/validators';
import { MATERIAL_SECTIONS } from './validators';

/** A `qtyMilli` change is copied to every linked MATERIAL row in the same transaction (CONTRACTS §5). */
export class UpdateComponentDto {
  @OptionalNotNull() @IsString() @MinLength(1) @MaxLength(40) code?: string;
  @OptionalNotNull() @IsIn(HOUSE_SECTIONS) houseSection?: HouseSection;
  @OptionalNotNull() @IsString() @MinLength(1) @MaxLength(300) name?: string;
  @OptionalNotNull() @IsIn(UNITS) unit?: Unit;
  @OptionalNotNull() @IsCappedInt() qtyMilli?: number;
  @OptionalNullable() @IsIn(MATERIAL_SECTIONS) materialSection?: string | null;
  @OptionalNullable() @IsString() @MaxLength(2000) notes?: string | null;
  @OptionalNotNull() @IsInt() @Min(0) @Max(100_000) sortOrder?: number;
}
