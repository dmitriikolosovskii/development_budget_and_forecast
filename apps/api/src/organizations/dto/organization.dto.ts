import { ORG_ROLES, type OrgRole } from '@default-project/types';
import {
  IsEmail,
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
  OptionalNotNull,
  OptionalNullable,
} from '../../projects/dto/validators';

export class CreateOrganizationDto {
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: 'slug must be kebab-case' })
  slug!: string;
  @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @IsIn(ORG_ROLES) role!: OrgRole;
  @OptionalNullable() @IsString() @MaxLength(100) legalForm?: string | null;
  @IsString() @MinLength(1) @MaxLength(300) address!: string;
  @IsString() @MinLength(1) @MaxLength(200) city!: string;
  @OptionalNullable() @IsString() @MaxLength(300) website?: string | null;
  @IsEmail() @MaxLength(200) email!: string;
  @IsString() @MinLength(1) @MaxLength(50) phone!: string;
  @IsString() @MinLength(1) @MaxLength(200) contactPerson!: string;
  @IsString() @MinLength(1) @MaxLength(200) contactRole!: string;
  @OptionalNotNull() @IsInt() @Min(0) @Max(365) paymentTermsDays?: number;
  @OptionalNullable() @IsInt() @Min(1) @Max(5) rating?: number | null;
  @OptionalNullable() @IsString() @MaxLength(2000) notes?: string | null;
}

/** The slug is the seed key and is not editable. */
export class UpdateOrganizationDto {
  @OptionalNotNull() @IsString() @MinLength(1) @MaxLength(200) name?: string;
  @OptionalNotNull() @IsIn(ORG_ROLES) role?: OrgRole;
  @OptionalNullable() @IsString() @MaxLength(100) legalForm?: string | null;
  @OptionalNotNull() @IsString() @MinLength(1) @MaxLength(300) address?: string;
  @OptionalNotNull() @IsString() @MinLength(1) @MaxLength(200) city?: string;
  @OptionalNullable() @IsString() @MaxLength(300) website?: string | null;
  @OptionalNotNull() @IsEmail() @MaxLength(200) email?: string;
  @OptionalNotNull() @IsString() @MinLength(1) @MaxLength(50) phone?: string;
  @OptionalNotNull()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  contactPerson?: string;
  @OptionalNotNull()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  contactRole?: string;
  @OptionalNotNull() @IsInt() @Min(0) @Max(365) paymentTermsDays?: number;
  @OptionalNullable() @IsInt() @Min(1) @Max(5) rating?: number | null;
  @OptionalNullable() @IsString() @MaxLength(2000) notes?: string | null;
}
