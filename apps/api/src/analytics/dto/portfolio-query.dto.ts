import { IsOptional } from 'class-validator';
import { IsIsoDate } from '../../projects/dto/validators';

/** `GET /analytics/portfolio?today=YYYY-MM-DD`: the web sends `useToday()` so both sides use the same date. */
export class PortfolioQueryDto {
  @IsOptional()
  @IsIsoDate()
  today?: string;
}
