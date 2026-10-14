import { ROOM_KINDS, type RoomKind } from '@default-project/types';
import {
  IsIn,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { OptionalNotNull } from '../../projects/dto/validators';
import { IsPositionCm, IsSizeCm, ROOM_FLOORS } from './validators';

/** Overlaps are NOT validated here: they are a UI warning, never a blocked save (AC-08.3). */
export class UpdateRoomDto {
  @OptionalNotNull() @IsString() @MinLength(1) @MaxLength(40) code?: string;
  @OptionalNotNull() @IsIn(ROOM_FLOORS) floor?: number;
  @OptionalNotNull() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @OptionalNotNull() @IsIn(ROOM_KINDS) kind?: RoomKind;
  @OptionalNotNull() @IsPositionCm() xCm?: number;
  @OptionalNotNull() @IsPositionCm() yCm?: number;
  @OptionalNotNull() @IsSizeCm() wCm?: number;
  @OptionalNotNull() @IsSizeCm() hCm?: number;
  @OptionalNotNull() @IsInt() @Min(0) @Max(100_000) sortOrder?: number;
}
