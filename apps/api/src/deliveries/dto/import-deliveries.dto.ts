import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsObject,
  IsString,
  MaxLength,
} from 'class-validator';

/** Rows above this count are refused; it also keeps the JSON body under Express's 100 kb default. */
export const MAX_IMPORT_ROWS = 500;

/**
 * `{fileName, rows}` from CONTRACTS §5. Rows stay plain objects of raw strings on purpose: headers
 * and every cell are validated row by row in the service, so one bad cell is a row error, not a 400.
 */
export class ImportDeliveriesDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName!: string;

  @IsArray()
  @ArrayMaxSize(MAX_IMPORT_ROWS)
  @IsObject({ each: true })
  rows!: Array<Record<string, unknown>>;
}
