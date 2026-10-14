import type { PrismaClient } from '@prisma/client';
import { runSeed } from './write-seed';

interface Call {
  model: string;
  method: string;
  where: unknown;
  data: Record<string, unknown>;
}

/** A Prisma stand-in that records every call; any method other than `upsert` is recorded too, so the test can forbid it. */
function fakePrisma() {
  const calls: Call[] = [];
  const models = ['organization', 'project', 'budgetLine', 'landParcel', 'utilityConnection', 'architecturePlan', 'room', 'boqComponent', 'costItem', 'delivery'];
  const client: Record<string, unknown> = {
    $transaction: (fn: (tx: unknown) => Promise<unknown>, opts: { timeout: number }) => {
      calls.push({ model: '$', method: '$transaction', where: null, data: { timeout: opts.timeout } });
      return fn(client);
    },
  };
  for (const model of models) {
    client[model] = new Proxy(
      {},
      {
        get: (_t, method: string) => async (args: { where: unknown; create?: Record<string, unknown> }) => {
          calls.push({ model, method, where: args.where, data: args.create ?? {} });
          return { id: `${model}:${JSON.stringify(args.where)}` };
        },
      },
    );
  }
  return { client: client as unknown as PrismaClient, calls };
}

describe('runSeed', () => {
  it('should only upsert, inside transactions with a 60 s timeout, when seeding', async () => {
    const { client, calls } = fakePrisma();
    await runSeed(client);
    expect(new Set(calls.map((c) => c.method))).toEqual(new Set(['$transaction', 'upsert']));
    expect(calls.filter((c) => c.method === '$transaction').map((c) => c.data.timeout)).toEqual([60_000, 60_000, 60_000, 60_000, 60_000]);
  });

  it('should upsert on the unique keys of the schema', async () => {
    const { client, calls } = fakePrisma();
    await runSeed(client);
    const keysOf = (model: string) => new Set(calls.filter((c) => c.model === model).map((c) => Object.keys(c.where as object).join(',')));
    expect(keysOf('organization')).toEqual(new Set(['slug']));
    expect(keysOf('project')).toEqual(new Set(['slug']));
    expect(keysOf('budgetLine')).toEqual(new Set(['projectId_category_section']));
    expect(keysOf('landParcel')).toEqual(new Set(['projectId']));
    expect(keysOf('utilityConnection')).toEqual(new Set(['landId_type']));
    expect(keysOf('architecturePlan')).toEqual(new Set(['projectId']));
    expect(keysOf('room')).toEqual(new Set(['planId_code']));
    expect(keysOf('boqComponent')).toEqual(new Set(['planId_code']));
    expect(keysOf('costItem')).toEqual(new Set(['projectId_code']));
    expect(keysOf('delivery')).toEqual(new Set(['costItemId_deliveryNoteNo']));
  });

  it('should write works before the materials that point at them', async () => {
    const { client, calls } = fakePrisma();
    await runSeed(client);
    const items = calls.filter((c) => c.model === 'costItem');
    const position = (code: string) => items.findIndex((c) => (c.where as { projectId_code: { code: string } }).projectId_code.code === code);
    expect(position('WRK-WIN-001')).toBeLessThan(position('MAT-WIN-001'));
    const windows = items.find((c) => (c.where as { projectId_code: { code: string } }).projectId_code.code === 'MAT-WIN-001');
    expect(windows?.data.requiredForWorkId).toMatch(/^costItem:.*WRK-WIN-001/);
  });

  it('should make the same calls when run twice', async () => {
    const first = fakePrisma();
    const second = fakePrisma();
    await runSeed(first.client);
    await runSeed(second.client);
    expect(second.calls).toEqual(first.calls);
  });
});
