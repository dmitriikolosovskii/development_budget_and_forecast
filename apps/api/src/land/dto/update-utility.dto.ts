import { UTILITY_STATUSES, type UtilityStatus } from '@default-project/types';
import { IsIn, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';
import {
  OptionalNotNull,
  OptionalNullable,
} from '../../projects/dto/validators';

/** PATCH body for one utility (upsert by type); a new row defaults to `NOT_AVAILABLE`. */
export class UpdateUtilityDto {
  @OptionalNotNull() @IsIn(UTILITY_STATUSES) status?: UtilityStatus;
  @OptionalNullable() @IsInt() @Min(0) @Max(100_000) distanceM?: number | null;
  @OptionalNullable() @IsString() @MaxLength(200) provider?: string | null;
  @OptionalNullable() @IsString() @MaxLength(2000) notes?: string | null;
}
