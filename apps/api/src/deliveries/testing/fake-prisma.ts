/**
 * In-memory stand-in for the Prisma calls DeliveriesService makes. `$transaction` runs the callback
 * on a staged copy and commits only when it resolves, so tests can check real state (idempotency,
 * rollback) instead of counting mock calls.
 */
export interface FakeItem {
  id: string;
  projectId: string;
  code: string;
  kind: 'MATERIAL' | 'WORK' | 'SERVICE';
  deliveryDate: string | null;
  deliveredDate: string | null;
  actualCents: number;
}

export interface FakeDelivery {
  id: string;
  projectId: string;
  costItemId: string;
  batchId: string | null;
  deliveryNoteNo: string;
  kind: 'EXPECTED' | 'DELIVERED';
  date: string;
  qtyMilli: number;
  invoiceCents: number | null;
  createdAt: Date;
}

export interface FakeBatch {
  id: string;
  projectId: string;
  fileName: string;
  totalRows: number;
  okRows: number;
  failedRows: number;
  errorsJson: string;
}

interface State {
  projects: string[];
  items: FakeItem[];
  deliveries: FakeDelivery[];
  batches: FakeBatch[];
}

type Where = Record<string, unknown>;

function matches(row: Record<string, unknown>, where: Where = {}): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (cond && typeof cond === 'object' && 'in' in cond)
      return (cond as { in: unknown[] }).in.includes(row[key]);
    return row[key] === cond;
  });
}

function pick<T extends object>(
  row: T,
  select?: Record<string, boolean>,
): Partial<T> {
  if (!select) return { ...row };
  const out: Partial<T> = {};
  for (const key of Object.keys(select))
    (out as Record<string, unknown>)[key] = (row as Record<string, unknown>)[
      key
    ];
  return out;
}

export class FakePrisma {
  state: State = { projects: [], items: [], deliveries: [], batches: [] };
  /** Throw inside `delivery.upsert` on this call number (1-based) to simulate a failure mid-transaction. */
  failOnUpsert: number | null = null;
  /** Options of every `$transaction` call, in order. */
  readonly transactions: unknown[] = [];
  private seq = 0;
  private upserts = 0;

  constructor(seed: Partial<State> = {}) {
    Object.assign(this.state, structuredClone({ ...this.state, ...seed }));
  }

  private client(s: State) {
    return {
      project: {
        findUnique: async ({ where }: { where: { id: string } }) =>
          s.projects.includes(where.id) ? { id: where.id } : null,
      },
      costItem: {
        findMany: async ({
          where,
          select,
        }: {
          where?: Where;
          select?: Record<string, boolean>;
        }) =>
          s.items
            .filter((i) => matches(i as never, where))
            .map((i) => pick(i, select)),
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<FakeItem>;
        }) => {
          const item = s.items.find((i) => i.id === where.id);
          if (!item) throw new Error(`no item ${where.id}`);
          Object.assign(item, data);
          return { ...item };
        },
      },
      delivery: {
        findMany: async ({
          where,
          select,
        }: {
          where?: Where;
          select?: Record<string, boolean>;
        }) =>
          s.deliveries
            .filter((d) => matches(d as never, where))
            .sort(
              (a, b) =>
                b.date.localeCompare(a.date) ||
                b.createdAt.getTime() - a.createdAt.getTime(),
            )
            .map((d) => pick(d, select)),
        upsert: async (args: {
          where: {
            costItemId_deliveryNoteNo: {
              costItemId: string;
              deliveryNoteNo: string;
            };
          };
          create: Omit<FakeDelivery, 'id' | 'createdAt'>;
          update: Partial<FakeDelivery>;
        }) => {
          this.upserts += 1;
          if (this.failOnUpsert === this.upserts)
            throw new Error('simulated failure');
          const key = args.where.costItemId_deliveryNoteNo;
          const found = s.deliveries.find(
            (d) =>
              d.costItemId === key.costItemId &&
              d.deliveryNoteNo === key.deliveryNoteNo,
          );
          if (found) return Object.assign(found, args.update);
          const created = {
            id: `d${++this.seq}`,
            createdAt: new Date(this.seq),
            ...args.create,
          } as FakeDelivery;
          s.deliveries.push(created);
          return created;
        },
      },
      importBatch: {
        create: async ({ data }: { data: Omit<FakeBatch, 'id'> }) => {
          const batch = { id: `b${++this.seq}`, ...data };
          s.batches.push(batch);
          return batch;
        },
      },
    };
  }

  get project() {
    return this.client(this.state).project;
  }
  get costItem() {
    return this.client(this.state).costItem;
  }
  get delivery() {
    return this.client(this.state).delivery;
  }
  get importBatch() {
    return this.client(this.state).importBatch;
  }

  async $transaction<T>(
    fn: (tx: ReturnType<FakePrisma['client']>) => Promise<T>,
    opts?: unknown,
  ): Promise<T> {
    this.transactions.push(opts);
    const staged = structuredClone(this.state);
    const result = await fn(this.client(staged));
    this.state = staged;
    return result;
  }

  item(id: string): FakeItem {
    const item = this.state.items.find((i) => i.id === id);
    if (!item) throw new Error(`no item ${id}`);
    return item;
  }
}
