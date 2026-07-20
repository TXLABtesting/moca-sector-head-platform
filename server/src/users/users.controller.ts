import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpsertUserDto } from './dto/upsert-user.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

/**
 * User & permission administration. Guarded by the `permissions` section, which
 * only the System Admin (and chair) hold — mirroring the in-app Permissions
 * admin screen.
 */
@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermission('permissions', 'view')
  findAll() {
    return this.users.findAll();
  }

  @Get(':id')
  @RequirePermission('permissions', 'view')
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }

  @Post()
  @RequirePermission('permissions', 'add')
  create(@Body() dto: UpsertUserDto) {
    return this.users.upsert(dto);
  }

  @Patch(':id')
  @RequirePermission('permissions', 'edit')
  update(@Param('id') id: string, @Body() dto: UpsertUserDto) {
    return this.users.upsert({ ...dto, id });
  }

  @Patch(':id/active')
  @RequirePermission('permissions', 'status')
  setActive(@Param('id') id: string, @Body('active') active: boolean) {
    return this.users.setActive(id, active);
  }
}
