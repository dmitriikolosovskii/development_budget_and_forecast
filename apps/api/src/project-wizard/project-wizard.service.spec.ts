import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { WizardInputDto } from './dto/wizard-input.dto';
import { ProjectWizardService, wizardSlug } from './project-wizard.service';
import { templateFixture, wizardInput } from './wizard-fixtures';

const MODELS = [
  'project',
  'budgetLine',
  'landParcel',
  'utilityConnection',
  'architecturePlan',
  'room',
  'boqComponent',
  'costItem',
] as const;
const WRITES = [
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
] as const;

type Fn = jest.Mock;
type ModelMock = Record<'create' | 'createMany' | (typeof WRITES)[number], Fn>;

function txMock(): Record<(typeof MODELS)[number], ModelMock> {
  const model = (): ModelMock => ({
    create: jest.fn().mockResolvedValue({}),
    createMany: jest.fn().mockResolvedValue({ count: 1 }),
    ...(Object.fromEntries(WRITES.map((w) => [w, jest.fn()])) as Record<
      (typeof WRITES)[number],
      Fn
    >),
  });
  return Object.fromEntries(MODELS.map((m) => [m, model()])) as Record<
    (typeof MODELS)[number],
    ModelMock
  >;
}

describe('ProjectWizardService', () => {
  let service: ProjectWizardService;
  let tx: ReturnType<typeof txMock>;
  let prisma: { project: { findUnique: Fn }; $transaction: Fn };
  let projects: { getSnapshot: Fn };
  const template = templateFixture();

  beforeEach(async () => {
    tx = txMock();
    prisma = {
      project: { findUnique: jest.fn().mockResolvedValue({ id: 'tpl' }) },
      $transaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    };
    projects = {
      getSnapshot: jest.fn((id: string) =>
        Promise.resolve(id === 'tpl' ? template : { project: { id } }),
      ),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProjectWizardService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProjectsService, useValue: projects },
      ],
    }).compile();
    service = moduleRef.get(ProjectWizardService);
  });

  it('should create the project in one transaction with creates only, never touching template rows [AC-12.3]', async () => {
    const result = await service.create(wizardInput());

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    for (const m of MODELS)
      for (const w of WRITES) expect(tx[m][w]).not.toHaveBeenCalled();

    const templateIds = new Set([
      'tpl',
      ...template.items.map((i) => i.id),
      ...template.budgetLines.map((l) => l.id),
      ...(template.plan?.components.map((c) => c.id) ?? []),
      ...(template.plan?.rooms.map((r) => r.id) ?? []),
      template.land?.id,
      template.plan?.id,
    ]);
    const written = MODELS.flatMap((m) => [
      ...tx[m].create.mock.calls.map(([arg]) => arg.data),
      ...tx[m].createMany.mock.calls.flatMap(([arg]) => arg.data),
    ]);
    expect(written.length).toBeGreaterThan(template.items.length);
    for (const row of written) expect(templateIds.has(row.id)).toBe(false);
    expect(tx.costItem.createMany).toHaveBeenCalledTimes(2); // unlinked rows first, then MATERIAL → WORK
    expect(result).toEqual({
      project: { id: tx.project.create.mock.calls[0][0].data.id },
    });
  });

  it('should answer 404 and write nothing when the template is missing [AC-12.9]', async () => {
    prisma.project.findUnique.mockResolvedValue(null);

    await expect(service.create(wizardInput())).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.template()).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('should answer 400 and write nothing for duplicate utility types or amounts beyond Int32 [AC-12.9]', async () => {
    const input = wizardInput();
    const dupes = wizardInput({
      land: {
        ...input.land,
        utilities: [
          { type: 'WATER', status: 'CONNECTED' },
          { type: 'WATER', status: 'IN_STREET' },
        ],
      },
    });
    const huge = wizardInput({ land: { ...input.land, areaM2: 100_000 } });

    await expect(service.create(dupes)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.create(huge)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('should retry with a new slug when the slug is taken', async () => {
    const taken = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['slug'] },
      },
    );
    prisma.$transaction.mockRejectedValueOnce(taken);

    await service.create(wizardInput());

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('should reject a living area outside 100–250 m² or a missing category amount in the DTO [AC-12.9]', async () => {
    const ok = wizardInput({
      approvedByCategory: {
        LAND: 1,
        ARCHITECTURE: 1,
        MATERIALS: 1,
        CONSTRUCTION: 1,
        MARKETING: 1,
      },
    });
    const bigHouse = { ...ok, house: { ...ok.house, livingAreaM2: 260 } };
    const missing = {
      ...ok,
      approvedByCategory: {
        LAND: 1,
        ARCHITECTURE: 1,
        MATERIALS: 1,
        CONSTRUCTION: 1,
      },
    };

    expect(await validate(plainToInstance(WizardInputDto, ok))).toHaveLength(0);
    expect(
      await validate(plainToInstance(WizardInputDto, bigHouse)),
    ).not.toHaveLength(0);
    expect(
      await validate(plainToInstance(WizardInputDto, missing)),
    ).not.toHaveLength(0);
  });
});

describe('wizardSlug', () => {
  it('should transliterate German umlauts and ß before stripping accents', () => {
    expect(wizardSlug('Haus Müller — Straße', 'ab12cd')).toBe(
      'haus-mueller-strasse-ab12cd',
    );
    expect(wizardSlug('Café Élise', 'ab12cd')).toBe('cafe-elise-ab12cd');
    expect(wizardSlug('!!!', 'ab12cd')).toBe('project-ab12cd');
  });
});
