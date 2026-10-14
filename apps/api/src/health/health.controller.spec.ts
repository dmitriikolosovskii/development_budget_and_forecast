import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  it('should report ok when the database answers', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]) };
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    const result = await moduleRef.get(HealthController).check();

    expect(result).toEqual({ status: 'ok', db: 'up' });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
