import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Organization } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isUniqueViolation } from '../prisma/prisma-errors';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from './dto/organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Organization[]> {
    return this.prisma.organization.findMany({ orderBy: { name: 'asc' } });
  }

  async create(dto: CreateOrganizationDto): Promise<Organization> {
    try {
      return await this.prisma.organization.create({ data: dto });
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException(`Organization ${dto.slug} already exists`);
      throw error;
    }
  }

  async update(id: string, dto: UpdateOrganizationDto): Promise<Organization> {
    const found = await this.prisma.organization.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) throw new NotFoundException(`Organization ${id} not found`);
    return this.prisma.organization.update({ where: { id }, data: dto });
  }
}
