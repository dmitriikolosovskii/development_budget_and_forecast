import {
  HOUSE_SECTIONS,
  UNITS,
  type HouseSection,
  type Unit,
} from '@default-project/types';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  IsCappedInt,
  OptionalNullable,
} from '../../projects/dto/validators';
import { MATERIAL_SECTIONS } from './validators';

export class CreateComponentDto {
  @IsString() @MinLength(1) @MaxLength(40) code!: string;
  @IsIn(HOUSE_SECTIONS) houseSection!: HouseSection;
  @IsString() @MinLength(1) @MaxLength(300) name!: string;
  @IsIn(UNITS) unit!: Unit;
  @IsCappedInt() qtyMilli!: number;
  @OptionalNullable() @IsIn(MATERIAL_SECTIONS) materialSection?: string | null;
  @OptionalNullable() @IsString() @MaxLength(2000) notes?: string | null;
  @IsOptional() @IsInt() @Min(0) @Max(100_000) sortOrder?: number;
}
