import { randomBytes, randomUUID } from 'node:crypto';
import type { WizardInput } from '@default-project/types';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isUniqueViolation } from '../prisma/prisma-errors';
import {
  ProjectsService,
  type SnapshotResponse,
} from '../projects/projects.service';
import { TEMPLATE_SLUG } from '../seed-data/projects';
import {
  buildWizardProject,
  WizardRangeError,
  type WizardPlan,
} from './wizard-plan';

const SLUG_RETRIES = 3;

export function wizardSlug(name: string, suffix: string): string {
  // Umlauts first: NFKD would split "ü" into "u" + a combining mark.
  const base = name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'project'}-${suffix}`;
}

@Injectable()
export class ProjectWizardService {
  private readonly logger = new Logger(ProjectWizardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  /** `GET /projects/wizard/template`: the template snapshot the client estimates from. */
  async template(): Promise<SnapshotResponse> {
    const row = await this.prisma.project.findUnique({
      where: { slug: TEMPLATE_SLUG },
      select: { id: true },
    });
    if (!row)
      throw new NotFoundException(
        `Template ${TEMPLATE_SLUG} not found (run the seed)`,
      );
    return this.projects.getSnapshot(row.id);
  }

  /** `POST /projects/wizard`: one transaction of creates; the template is only read. */
  async create(input: WizardInput): Promise<SnapshotResponse> {
    const types = input.land.utilities.map((u) => u.type);
    const duplicate = types.find((t, i) => types.indexOf(t) !== i);
    if (duplicate)
      throw new BadRequestException(
        `land.utilities: ${duplicate} is listed twice`,
      );

    const template = await this.template();
    for (let attempt = 1; ; attempt++) {
      const suffix = randomBytes(3).toString('hex');
      let plan: WizardPlan;
      try {
        plan = buildWizardProject(template, input, {
          newId: randomUUID,
          slug: wizardSlug(input.name, suffix),
          code: `KF-${input.startDate.slice(0, 4)}-W${suffix.toUpperCase()}`,
        });
      } catch (error) {
        if (error instanceof WizardRangeError)
          throw new BadRequestException(error.message);
        throw error;
      }
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.project.create({ data: plan.project });
          await tx.budgetLine.createMany({ data: plan.budgetLines });
          await tx.landParcel.create({ data: plan.land });
          if (plan.utilities.length)
            await tx.utilityConnection.createMany({ data: plan.utilities });
          if (plan.plan) await tx.architecturePlan.create({ data: plan.plan });
          if (plan.rooms.length) await tx.room.createMany({ data: plan.rooms });
          if (plan.components.length)
            await tx.boqComponent.createMany({ data: plan.components });
          if (plan.items.length)
            await tx.costItem.createMany({ data: plan.items });
          if (plan.linkedItems.length)
            await tx.costItem.createMany({ data: plan.linkedItems });
        });
      } catch (error) {
        if (!isUniqueViolation(error, 'slug') || attempt >= SLUG_RETRIES) {
          if (isUniqueViolation(error))
            throw new ConflictException(
              'Could not allocate a unique project slug',
            );
          throw error;
        }
        this.logger.warn(
          `Slug collision for ${plan.project.slug}, retry ${attempt}`,
        );
        continue;
      }
      this.logger.log(
        `Wizard created ${plan.project.slug} (${plan.items.length + plan.linkedItems.length} rows, ${input.house.livingAreaM2} m²)`,
      );
      return this.projects.getSnapshot(plan.project.id);
    }
  }
}
