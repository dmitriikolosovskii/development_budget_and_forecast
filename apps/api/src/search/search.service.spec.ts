import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { SearchService } from './search.service';

interface ProjectRow {
  id: string;
  name: string;
  code: string;
  city: string;
  clientName: string;
  isTemplate: boolean;
}
interface LineRow {
  id: string;
  projectId: string;
  category: string;
  section: string;
  name: string;
}
interface ItemRow {
  id: string;
  projectId: string;
  code: string;
  name: string;
  description: string | null;
  supplierId: string | null;
  contractorId: string | null;
  budgetLine: { category: string; section: string; name: string };
}
interface OrgRow {
  id: string;
  name: string;
  role: string;
  contactPerson: string;
  city: string;
  email: string;
}

interface Db {
  projects: ProjectRow[];
  lines: LineRow[];
  items: ItemRow[];
  orgs: OrgRow[];
}

const project = (id: string, name: string, isTemplate = false): ProjectRow => ({
  id,
  name,
  isTemplate,
  code: `KF-${id}`,
  city: 'Taucha',
  clientName: 'Family Becker',
});
const line = (
  id: string,
  projectId: string,
  category: string,
  section: string,
  name: string,
): LineRow => ({
  id,
  projectId,
  category,
  section,
  name,
});
const item = (
  id: string,
  projectId: string,
  name: string,
  over: Partial<ItemRow> = {},
): ItemRow => ({
  id,
  projectId,
  name,
  code: `MAT-HEA-${id}`,
  description: null,
  supplierId: null,
  contractorId: null,
  budgetLine: {
    category: 'MATERIALS',
    section: 'heating',
    name: 'Heating & ventilation',
  },
  ...over,
});
const org = (id: string, name: string, over: Partial<OrgRow> = {}): OrgRow => ({
  id,
  name,
  role: 'SUPPLIER',
  contactPerson: 'Anna Schulz',
  city: 'Leipzig',
  email: `${id}@example.de`,
  ...over,
});

/**
 * Prisma stand-in that honours the template filters the service passes, so a missing
 * `where` shows up as template rows in the output (not only as a call-argument mismatch).
 */
function fakePrisma(db: Db) {
  const templateIds = () =>
    new Set(db.projects.filter((p) => p.isTemplate).map((p) => p.id));
  const byProject = <T extends { projectId: string }>(
    rows: T[],
    where?: { project?: { isTemplate?: boolean } },
  ) =>
    where?.project?.isTemplate === false
      ? rows.filter((r) => !templateIds().has(r.projectId))
      : rows;
  return {
    project: {
      findMany: jest.fn(async (args?: { where?: { isTemplate?: boolean } }) =>
        args?.where?.isTemplate === false
          ? db.projects.filter((p) => !p.isTemplate)
          : db.projects,
      ),
    },
    costItem: {
      findMany: jest.fn(async (args?: { where?: object }) =>
        byProject(db.items, args?.where),
      ),
    },
    budgetLine: {
      findMany: jest.fn(async (args?: { where?: object }) =>
        byProject(db.lines, args?.where),
      ),
    },
    organization: { findMany: jest.fn(async () => db.orgs) },
  };
}

async function makeService(db: Db) {
  const prisma = fakePrisma(db);
  const moduleRef = await Test.createTestingModule({
    providers: [SearchService, { provide: PrismaService, useValue: prisma }],
  }).compile();
  return { service: moduleRef.get(SearchService), prisma };
}

const baseDb = (): Db => ({
  projects: [
    project('p1', 'Stadtvilla Taucha'),
    project('p2', 'Bungalow Markranstädt'),
    project('tpl', 'Template EFH', true),
  ],
  lines: [
    line('l1', 'p1', 'MATERIALS', 'heating', 'Heating & ventilation'),
    line('l-tpl', 'tpl', 'MATERIALS', 'heating', 'Heating & ventilation'),
  ],
  items: [
    item('i1', 'p1', 'Vaillant aroTHERM plus 7 kW', { contractorId: 'o-mb' }),
    item('i-tpl', 'tpl', 'Vaillant aroTHERM plus 7 kW', {
      contractorId: 'o-tpl',
    }),
    item('i-land', 'p2', 'Land plot Markranstädt', {
      code: 'SRV-PUR-001',
      budgetLine: {
        category: 'LAND',
        section: 'purchase',
        name: 'Land purchase',
      },
      supplierId: 'o-mb',
    }),
  ],
  orgs: [
    org('o-mb', 'Holzbau & Bedachung Mühlberg', {
      role: 'CONTRACTOR',
      contactPerson: 'Jens Mühlberg',
      city: 'Eilenburg',
    }),
    org('o-tpl', 'Template-only Haustechnik GmbH'),
    org('o-none', 'Lonely Haustechnik GmbH'),
  ],
});

describe('SearchService', () => {
  it('should find the heat pump regardless of case when q is "  AROTHERM " [AC-13.1]', async () => {
    const { service } = await makeService(baseDb());

    const results = await service.search('  AROTHERM ');

    const titles = results.map((r) => r.title);
    expect(titles).toContain('Vaillant aroTHERM plus 7 kW');
    expect(titles).not.toContain('Land plot Markranstädt');
    expect(await service.search('arothermx')).toEqual([]);
  });

  it('should find an umlaut organisation once when q is "muhlberg" [AC-13.1]', async () => {
    const { service } = await makeService(baseDb());

    const results = await service.search('muhlberg');

    const orgs = results.filter((r) => r.type === 'organization');
    expect(orgs.map((r) => r.title)).toEqual(['Holzbau & Bedachung Mühlberg']);
    expect(results.filter((r) => r.id === 'o-mb')).toHaveLength(1);
  });

  it('should exclude template projects and their rows when searching [AC-13.2]', async () => {
    const { service, prisma } = await makeService(baseDb());

    const results = await service.search('aro');
    const all = await service.search('template');
    const lines = await service.search('heating');

    expect(results.map((r) => r.id)).toEqual(['i1']);
    expect(all.map((r) => r.id)).toEqual(['o-tpl']); // the organisation itself is shared, the template project is not
    expect(lines.map((r) => r.id)).toEqual(['l1']);
    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isTemplate: false } }),
    );
    expect(prisma.costItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { project: { isTemplate: false } } }),
    );
  });

  it('should return at most 8 results per type when more rows match [AC-13.2]', async () => {
    const db = baseDb();
    db.items = Array.from({ length: 12 }, (_, i) =>
      item(
        `i${String(i).padStart(2, '0')}`,
        'p1',
        `Cable NYM-J ${'ABCDEFGHIJKL'[i]}`,
      ),
    );

    const results = await (await makeService(db)).service.search('cable');

    expect(results).toHaveLength(8);
    expect(results.map((r) => r.id)).toEqual([
      'i00',
      'i01',
      'i02',
      'i03',
      'i04',
      'i05',
      'i06',
      'i07',
    ]);
  });

  it('should cap the total at 30 in type order when every type has 8 matches [AC-13.9]', async () => {
    const ids = Array.from({ length: 9 }, (_, i) => String(i));
    const db: Db = {
      projects: ids.map((i) => project(`p${i}`, `Kairon project ${i}`)),
      lines: ids.map((i) =>
        line(`l${i}`, 'p0', 'MATERIALS', `s${i}`, `Kairon line ${i}`),
      ),
      items: ids.map((i) => item(`i${i}`, 'p0', `Kairon item ${i}`)),
      orgs: ids.map((i) => org(`o${i}`, `Kairon org ${i}`)),
    };

    const results = await (await makeService(db)).service.search('kairon');

    expect(results).toHaveLength(30);
    const types = results.map((r) => r.type);
    expect(types.slice(0, 8).every((t) => t === 'project')).toBe(true);
    expect(types.slice(8, 16).every((t) => t === 'item')).toBe(true);
    expect(types.slice(16, 24).every((t) => t === 'organization')).toBe(true);
    expect(types.slice(24)).toEqual([
      'line',
      'line',
      'line',
      'line',
      'line',
      'line',
    ]);
  });

  it('should rank title prefix matches before matches in other fields [AC-13.2]', async () => {
    const db = baseDb();
    db.items = [
      item('a', 'p1', 'Underfloor heating pipes', {
        description: 'cable ducts',
      }),
      item('b', 'p1', 'Cable NYM-J 3×1.5 mm²'),
      item('c', 'p1', 'Data cable Cat.7'),
    ];

    const results = await (await makeService(db)).service.search('cable');

    expect(results.map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('should link a MATERIALS item to its section row when building the result [AC-13.3]', async () => {
    const { service } = await makeService(baseDb());

    const [heatPump] = await service.search('arotherm');

    expect(heatPump).toEqual({
      type: 'item',
      id: 'i1',
      projectId: 'p1',
      title: 'Vaillant aroTHERM plus 7 kW',
      subtitle: 'MAT-HEA-i1 · Heating & ventilation · Stadtvilla Taucha',
      href: '/projects/p1/materials/heating?highlight=i1',
    });
  });

  it('should link a LAND item, a line and a project to their pages [AC-13.8]', async () => {
    const { service } = await makeService(baseDb());

    const land = (await service.search('land plot')).find(
      (r) => r.id === 'i-land',
    );
    const line = (await service.search('ventilation')).find(
      (r) => r.type === 'line',
    );
    const proj = (await service.search('taucha')).find(
      (r) => r.type === 'project',
    );

    expect(land?.href).toBe('/projects/p2/land?highlight=i-land');
    expect(line?.href).toBe('/projects/p1/materials/heating');
    expect(proj?.href).toBe('/projects/p1');
    expect(proj?.href).not.toContain('?');
  });

  it('should open the organisation in its first non-template project when it has rows [AC-13.7]', async () => {
    const { service } = await makeService(baseDb());

    const [mb] = (await service.search('mühlberg')).filter(
      (r) => r.type === 'organization',
    );
    const tplOnly = (await service.search('template-only')).find(
      (r) => r.id === 'o-tpl',
    );
    const none = (await service.search('lonely')).find(
      (r) => r.id === 'o-none',
    );

    expect(mb.href).toBe('/projects/p1/materials?org=o-mb'); // p1 is older than p2, both have its rows
    expect(mb.projectId).toBe('p1');
    expect(tplOnly?.href).toBe('/search?q=Template-only%20Haustechnik%20GmbH');
    expect(none?.href).toBe('/search?q=Lonely%20Haustechnik%20GmbH');
    expect(none?.projectId).toBeUndefined();
  });
});
