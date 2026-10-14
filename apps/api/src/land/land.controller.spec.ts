import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { LandController } from './land.controller';
import { LandService } from './land.service';

// A real HTTP round trip (no supertest in the repo): the global ValidationPipe and the
// ParseEnumPipe on `:type` run exactly as in main.ts.
describe('LandController (HTTP validation)', () => {
  let app: INestApplication;
  let base: string;
  const service = { updateLand: jest.fn(), upsertUtility: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [LandController],
      providers: [{ provide: LandService, useValue: service }],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.listen(0);
    base = `${await app.getUrl()}/api/projects/p1/land`.replace(
      '[::1]',
      'localhost',
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    service.updateLand.mockReset().mockResolvedValue({ id: 'land-1' });
    service.upsertUtility.mockReset().mockResolvedValue({ id: 'u1' });
  });

  const patch = (path: string, body: unknown) =>
    fetch(`${base}${path}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('should return 400 when areaM2 is negative [AC-07.1]', async () => {
    const res = await patch('', { areaM2: -1 });

    expect(res.status).toBe(400);
    expect(service.updateLand).not.toHaveBeenCalled();
  });

  it('should return 200 and pass a valid patch to the service [AC-07.1]', async () => {
    const res = await patch('', { areaM2: 520, landValuePerM2Cents: 26_000 });

    expect(res.status).toBe(200);
    expect(service.updateLand).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ areaM2: 520 }),
    );
  });

  it.each([
    ['null on a NOT NULL column', { areaM2: null }],
    ['null on a NOT NULL string', { address: null }],
    ['areaM2 over the cap', { areaM2: 1_000_001 }],
    ['land value per m² over the cap', { landValuePerM2Cents: 100_000_001 }],
    ['GRZ over 100 %', { grzBps: 10_001 }],
    ['latitude out of range', { lat: 91 }],
    ['a fractional integer field', { groundwaterDepthCm: 1.5 }],
    ['a too long address', { address: 'x'.repeat(201) }],
  ])('should return 400 for %s [AC-07.6]', async (_name, body) => {
    const res = await patch('', body);

    expect(res.status).toBe(400);
    expect(service.updateLand).not.toHaveBeenCalled();
  });

  it('should accept null to clear groundwater depth [AC-07.6]', async () => {
    const res = await patch('', { groundwaterDepthCm: null });

    expect(res.status).toBe(200);
    expect(service.updateLand).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ groundwaterDepthCm: null }),
    );
  });

  it('should return 400 for an unknown utility type [AC-07.7]', async () => {
    const res = await patch('/utilities/WIFI', { status: 'CONNECTED' });

    expect(res.status).toBe(400);
    expect(service.upsertUtility).not.toHaveBeenCalled();
  });

  it('should return 400 for an unknown utility status [AC-07.7]', async () => {
    const res = await patch('/utilities/WATER', { status: 'FOO' });

    expect(res.status).toBe(400);
    expect(service.upsertUtility).not.toHaveBeenCalled();
  });

  it('should upsert a valid utility patch by type [AC-07.7]', async () => {
    const res = await patch('/utilities/WATER', {
      status: 'CONNECTED',
      distanceM: 4,
    });

    expect(res.status).toBe(200);
    expect(service.upsertUtility).toHaveBeenCalledWith(
      'p1',
      'WATER',
      expect.objectContaining({ status: 'CONNECTED', distanceM: 4 }),
    );
  });
});
