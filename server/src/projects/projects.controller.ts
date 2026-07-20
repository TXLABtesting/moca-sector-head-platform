import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { ApprovalDecisionDto, UpsertProjectDto } from './dto/project.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Principal } from '../rbac/permissions';

/**
 * Projects REST resource. This is the reference implementation of the pattern
 * every collection follows: list/read/create/update/delete gated by the section
 * grants, plus the approval sub-flow reserved for the Sector Head.
 */
@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @RequirePermission('projects', 'view')
  findAll(@CurrentUser() user: Principal) {
    return this.projects.findAll(user);
  }

  @Get(':id')
  @RequirePermission('projects', 'view')
  findOne(@Param('id') id: string) {
    return this.projects.findOne(id);
  }

  @Post()
  @RequirePermission('projects', 'add')
  create(@Body() dto: UpsertProjectDto) {
    return this.projects.create(dto);
  }

  @Patch(':id')
  @RequirePermission('projects', 'edit')
  update(@Param('id') id: string, @Body() dto: UpsertProjectDto) {
    return this.projects.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('projects', 'del')
  remove(@Param('id') id: string) {
    return this.projects.remove(id);
  }

  /** Owner submits completion for review (review grant). */
  @Post(':id/submit')
  @RequirePermission('projects', 'review')
  submit(@Param('id') id: string, @CurrentUser() user: Principal) {
    return this.projects.submitForApproval(id, user);
  }

  /** Sector-Head approves or returns. Only the chair passes RbacGuard here. */
  @Post(':id/decision')
  @RequirePermission('projects', 'approve')
  decide(@Param('id') id: string, @Body() dto: ApprovalDecisionDto, @CurrentUser() user: Principal) {
    return this.projects.decide(id, dto, user);
  }
}
