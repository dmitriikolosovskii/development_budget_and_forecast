import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export const SEARCH_QUERY_MIN = 2;
export const SEARCH_QUERY_MAX = 64;

export class SearchQueryDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(SEARCH_QUERY_MIN, SEARCH_QUERY_MAX)
  q!: string;
}
