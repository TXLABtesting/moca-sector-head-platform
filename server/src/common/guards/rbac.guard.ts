import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY, PermissionRequirement } from '../decorators/require-permission.decorator';
import { can, canApprove, Principal } from '../../rbac/permissions';

/**
 * Authorization guard. Reads the @RequirePermission(section, action) metadata
 * and checks it against the authenticated Principal's grants. Runs after
 * JwtAuthGuard, so req.user is always present for protected routes.
 *
 * The `approve` action is additionally constrained: only the Sector Head can
 * approve, and only on approvable sections (projects, leaves, meeting requests).
 */
@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = this.reflector.getAllAndOverride<PermissionRequirement>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!req) return true; // no explicit requirement → authentication is enough

    const principal = context.switchToHttp().getRequest().user as Principal | undefined;
    if (!principal) throw new ForbiddenException('No authenticated principal');

    if (req.action === 'approve' && !canApprove(principal, req.section)) {
      throw new ForbiddenException('Only the Sector Head may approve this item');
    }
    if (!can(principal, req.section, req.action)) {
      throw new ForbiddenException(`Missing permission: ${req.section}:${req.action}`);
    }
    return true;
  }
}
