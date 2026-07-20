import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { EntraStrategy } from './entra.strategy';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RbacGuard } from '../common/guards/rbac.guard';

/**
 * Wires Entra token validation and registers the two global guards, in order:
 *   1. JwtAuthGuard   — authenticates every request (unless @Public).
 *   2. RbacGuard      — authorizes against @RequirePermission metadata.
 */
@Module({
  imports: [PassportModule.register({ defaultStrategy: 'entra' }), UsersModule],
  controllers: [AuthController],
  providers: [
    EntraStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RbacGuard },
  ],
})
export class AuthModule {}
