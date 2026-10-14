import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateRoomDto } from './create-room.dto';
import { UpdateComponentDto } from './update-component.dto';
import { UpdateRoomDto } from './update-room.dto';

async function errorsOf<T extends object>(
  cls: new () => T,
  body: object,
): Promise<string[]> {
  const errors = await validate(plainToInstance(cls, body));
  return errors.map((e) => e.property);
}

describe('architecture DTOs', () => {
  it('should reject a negative or fractional qtyMilli when patching a component', async () => {
    expect(await errorsOf(UpdateComponentDto, { qtyMilli: -1 })).toEqual([
      'qtyMilli',
    ]);
    expect(await errorsOf(UpdateComponentDto, { qtyMilli: 1.5 })).toEqual([
      'qtyMilli',
    ]);
  });

  it('should reject a materialSection that is not a MATERIALS slug when patching a component', async () => {
    expect(
      await errorsOf(UpdateComponentDto, { materialSection: 'shell' }),
    ).toEqual(['materialSection']);
    expect(
      await errorsOf(UpdateComponentDto, { materialSection: 'concrete' }),
    ).toEqual([]);
    expect(await errorsOf(UpdateComponentDto, { materialSection: null })).toEqual(
      [],
    );
  });

  it('should reject a zero-size room, an unknown floor or kind when patching a room', async () => {
    expect(await errorsOf(UpdateRoomDto, { wCm: 0 })).toEqual(['wCm']);
    expect(await errorsOf(UpdateRoomDto, { floor: 2 })).toEqual(['floor']);
    expect(await errorsOf(UpdateRoomDto, { kind: 'garage' })).toEqual(['kind']);
    expect(await errorsOf(UpdateRoomDto, { wCm: 400, name: 'Kitchen' })).toEqual(
      [],
    );
  });

  it('should require every geometry field when creating a room', async () => {
    const props = await errorsOf(CreateRoomDto, {
      code: 'GF-X',
      floor: 0,
      name: 'X',
      kind: 'hall',
    });
    expect(props.sort()).toEqual(['hCm', 'wCm', 'xCm', 'yCm']);
  });
});
