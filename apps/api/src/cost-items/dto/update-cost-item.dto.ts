import {
  ITEM_STATUSES,
  UNITS,
  type ItemStatus,
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
  IsIsoDate,
  OptionalNotNull,
  OptionalNullable,
} from '../../projects/dto/validators';

/** PATCH body: every field optional; `kind` and `code` are immutable; `null` clears nullable fields only. */
export class UpdateCostItemDto {
  @OptionalNotNull() @IsString() @MinLength(1) budgetLineId?: string;
  @OptionalNotNull() @IsString() @MinLength(1) @MaxLength(300) name?: string;
  @OptionalNullable() @IsString() @MaxLength(2000) description?: string | null;
  @OptionalNotNull() @IsIn(UNITS) unit?: Unit;
  @OptionalNotNull() @IsCappedInt() qtyMilli?: number;
  @OptionalNotNull() @IsCappedInt() unitPriceCents?: number;
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
