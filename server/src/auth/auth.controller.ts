import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { effectivePerms, Principal } from '../rbac/permissions';

/**
 * Identity endpoints. The interactive login happens in the SPA via MSAL against
 * Entra; the API is a resource server. /me lets the freshly-authenticated SPA
 * learn who it is and what it may do (drives menu/visibility on the client).
 */
@ApiTags('auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  @Get('me')
  me(@CurrentUser() user: Principal) {
    return {
      id: user.id,
      name: user.name,
      type: user.type,
      scope: user.scope,
      all: !!user.all,
      permissions: effectivePerms(user),
    };
  }
}
