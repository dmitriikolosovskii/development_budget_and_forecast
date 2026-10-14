import {
  MAX_BPS,
  PROJECT_STATUSES,
  type ProjectStatus,
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
import { IsIsoDate, OptionalNotNull } from './validators';

export class CreateProjectDto {
  @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @IsString() @MinLength(1) @MaxLength(50) code!: string;
  @IsString() @MinLength(1) @MaxLength(200) clientName!: string;
  @IsString() @MinLength(1) @MaxLength(200) city!: string;
  @IsIsoDate() startDate!: string;
  @IsIsoDate() endDate!: string;
  @OptionalNotNull() @IsInt() @Min(0) @Max(MAX_BPS) markupBps?: number;
  @OptionalNotNull() @IsIn(PROJECT_STATUSES) status?: ProjectStatus;
}

export class UpdateProjectDto {
  @OptionalNotNull() @IsString() @MinLength(1) @MaxLength(200) name?: string;
  @OptionalNotNull()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  clientName?: string;
  @OptionalNotNull() @IsString() @MinLength(1) @MaxLength(200) city?: string;
  @OptionalNotNull() @IsIn(PROJECT_STATUSES) status?: ProjectStatus;
  @OptionalNotNull() @IsIsoDate() startDate?: string;
  @OptionalNotNull() @IsIsoDate() endDate?: string;
  @OptionalNotNull() @IsInt() @Min(0) @Max(MAX_BPS) markupBps?: number;
}

export class DuplicateProjectDto {
  @OptionalNotNull() @IsString() @MinLength(1) @MaxLength(200) name?: string;
}
