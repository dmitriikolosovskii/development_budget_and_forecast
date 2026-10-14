import {
  ITEM_KINDS,
  ITEM_STATUSES,
  UNITS,
  type ItemKind,
  type ItemStatus,
  type Unit,
} from '@default-project/types';
import {
  IsIn,
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  IsCappedInt,
  IsIsoDate,
  OptionalNotNull,
  OptionalNullable,
} from '../../projects/dto/validators';

// Not derived from UpdateCostItemDto: its ValidateIf would also switch off the "required" checks here.
export class CreateCostItemDto {
  @IsString() @MinLength(1) budgetLineId!: string;
  @IsIn(ITEM_KINDS) kind!: ItemKind;
  @Matches(/^(MAT|WRK|SRV)-[A-Z]{3}-\d{3,}$/, {
    message: 'code must look like MAT-ELE-003',
  })
  code!: string;
  @IsString() @MinLength(1) @MaxLength(300) name!: string;
  @IsIn(UNITS) unit!: Unit;
  @IsCappedInt() qtyMilli!: number;
  @IsCappedInt() unitPriceCents!: number;
  @OptionalNullable() @IsString() @MaxLength(2000) description?: string | null;
  @OptionalNotNull() @IsCappedInt() committedCents?: number;
  @OptionalNotNull() @IsCappedInt() actualCents?: number;
  @OptionalNotNull() @IsIn(ITEM_STATUSES) status?: ItemStatus;
  @OptionalNullable() @IsString() supplierId?: string | null;
  @OptionalNullable() @IsString() contractorId?: string | null;
  @OptionalNullable() @IsIsoDate() deliveryDate?: string | null;
  @OptionalNullable() @IsIsoDate() deliveredDate?: string | null;
  @OptionalNullable() @IsIsoDate() startDate?: string | null;
  @OptionalNullable() @IsIsoDate() endDate?: string | null;
  @OptionalNullable() @IsString() requiredForWorkId?: string | null;
  @OptionalNullable() @IsString() boqComponentId?: string | null;
  @OptionalNotNull() @IsInt() @Min(0) @Max(100_000) sortOrder?: number;
  @OptionalNullable() @IsString() @MaxLength(2000) notes?: string | null;
}
