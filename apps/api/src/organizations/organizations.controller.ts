import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import type { Organization } from '@prisma/client';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from './dto/organization.dto';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  findAll(): Promise<Organization[]> {
    return this.organizations.findAll();
  }

  @Post()
  create(@Body() dto: CreateOrganizationDto): Promise<Organization> {
    return this.organizations.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
  ): Promise<Organization> {
    return this.organizations.update(id, dto);
  }
}
