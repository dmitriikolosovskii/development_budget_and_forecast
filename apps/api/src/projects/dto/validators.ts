import { isIsoDate, MAX_INT_FIELD } from '@default-project/types';
import { applyDecorators } from '@nestjs/common';
import {
  IsInt,
  Max,
  Min,
  registerDecorator,
  ValidateIf,
  type ValidationOptions,
} from 'class-validator';

/** A calendar date `YYYY-MM-DD` that really exists. */
export function IsIsoDate(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyName) =>
    registerDecorator({
      name: 'isIsoDate',
      target: target.constructor,
      propertyName: String(propertyName),
      options: {
        message: `${String(propertyName)} must be a date in YYYY-MM-DD format`,
        ...options,
      },
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && isIsoDate(value),
      },
    });
}

/** Money/quantity field: `@IsInt() @Min(0) @Max(2_000_000_000)` (CONTRACTS §1). */
export function IsCappedInt(): PropertyDecorator {
  return applyDecorators(IsInt(), Min(0), Max(MAX_INT_FIELD));
}

/** Optional on PATCH, but `null` is rejected (the column is NOT NULL). */
export function OptionalNotNull(): PropertyDecorator {
  return ValidateIf((_object, value) => value !== undefined);
}

/** Optional and nullable: `null` clears the column, any other value is validated. */
export function OptionalNullable(): PropertyDecorator {
  return ValidateIf((_object, value) => value !== undefined && value !== null);
}
