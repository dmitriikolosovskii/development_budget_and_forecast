import { ROOM_KINDS, type RoomKind } from '@default-project/types';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { IsPositionCm, IsSizeCm, ROOM_FLOORS } from './validators';

export class CreateRoomDto {
  @IsString() @MinLength(1) @MaxLength(40) code!: string;
  @IsIn(ROOM_FLOORS) floor!: number;
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsIn(ROOM_KINDS) kind!: RoomKind;
  @IsPositionCm() xCm!: number;
  @IsPositionCm() yCm!: number;
  @IsSizeCm() wCm!: number;
  @IsSizeCm() hCm!: number;
  @IsOptional() @IsInt() @Min(0) @Max(100_000) sortOrder?: number;
}
