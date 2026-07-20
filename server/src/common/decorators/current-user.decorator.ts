import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Principal } from '../../rbac/permissions';

/** Injects the authenticated Principal resolved by EntraStrategy. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Principal => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as Principal;
  },
);
