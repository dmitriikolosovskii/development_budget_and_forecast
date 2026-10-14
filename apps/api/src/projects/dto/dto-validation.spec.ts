import {
  BadRequestException,
  ValidationPipe,
  type ArgumentMetadata,
} from '@nestjs/common';
import { CreateCostItemDto } from '../../cost-items/dto/create-cost-item.dto';
import { UpdateCostItemDto } from '../../cost-items/dto/update-cost-item.dto';
import { CreateProjectDto } from './project.dto';

// The same pipe options as main.ts.
const pipe = new ValidationPipe({ whitelist: true, transform: true });
const body = (metatype: ArgumentMetadata['metatype']): ArgumentMetadata => ({
  type: 'body',
  metatype,
});
const valid = {
  budgetLineId: 'l1',
  kind: 'MATERIAL',
  code: 'MAT-ELE-001',
  name: 'Cable',
  unit: 'm',
  qtyMilli: 1000,
  unitPriceCents: 89,
};

describe('DTO validation', () => {
  it.each([
    ['a negative amount', { unitPriceCents: -1 }],
    ['a fractional amount', { unitPriceCents: 1.5 }],
    ['an amount above the 32-bit cap', { qtyMilli: 2_000_000_001 }],
    ['an unknown kind', { kind: 'LABOUR' }],
    ['a bad date', { deliveryDate: '2026-02-30' }],
    ['a missing budget line', { budgetLineId: undefined }],
  ])('should reject %s when creating an item', async (_label, patch) => {
    await expect(
      pipe.transform({ ...valid, ...patch }, body(CreateCostItemDto)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should strip unknown keys and accept the 2e9 cap', async () => {
    const dto = await pipe.transform(
      { ...valid, qtyMilli: 2_000_000_000, hacker: true },
      body(CreateCostItemDto),
    );
    expect(dto).not.toHaveProperty('hacker');
    expect(dto.qtyMilli).toBe(2_000_000_000);
  });

  it('should reject null for a NOT NULL field when patching', async () => {
    await expect(
      pipe.transform({ qtyMilli: null }, body(UpdateCostItemDto)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should accept null for a nullable field when patching', async () => {
    await expect(
      pipe.transform({ deliveryDate: null }, body(UpdateCostItemDto)),
    ).resolves.toEqual({ deliveryDate: null });
  });

  it('should strip kind and code when patching (they are immutable)', async () => {
    await expect(
      pipe.transform({ kind: 'WORK', code: 'X' }, body(UpdateCostItemDto)),
    ).resolves.toEqual({});
  });

  it('should require ISO dates for a project', async () => {
    const project = {
      name: 'P',
      code: 'P-1',
      clientName: 'C',
      city: 'L',
      startDate: '01.04.2026',
      endDate: '2027-03-31',
    };
    await expect(
      pipe.transform(project, body(CreateProjectDto)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
