import { COST_CATEGORIES, type CostCategory } from '@default-project/types';
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
import { IsCappedInt, OptionalNotNull } from '../../projects/dto/validators';

export class CreateBudgetLineDto {
  @IsIn(COST_CATEGORIES) category!: CostCategory;
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'section must be a kebab-case slug',
  })
  section!: string;
  @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @OptionalNotNull() @IsCappedInt() approvedCents?: number;
  @OptionalNotNull() @IsInt() @Min(0) @Max(10_000) sortOrder?: number;
}

/** Category and section are the line's identity and are not editable. */
export class UpdateBudgetLineDto {
  @OptionalNotNull() @IsString() @MinLength(1) @MaxLength(200) name?: string;
  @OptionalNotNull() @IsCappedInt() approvedCents?: number;
  @OptionalNotNull() @IsInt() @Min(0) @Max(10_000) sortOrder?: number;
}
