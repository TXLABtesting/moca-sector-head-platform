import { SetMetadata } from '@nestjs/common';
import type { ActionKey } from '../../rbac/permissions';

export interface PermissionRequirement {
  section: string;
  action: ActionKey;
}

export const PERMISSION_KEY = 'permission';

/**
 * Declares the (section, action) a route requires. Enforced by RbacGuard.
 * Example: @RequirePermission('projects', 'edit')
 */
export const RequirePermission = (section: string, action: ActionKey) =>
  SetMetadata(PERMISSION_KEY, { section, action } as PermissionRequirement);
