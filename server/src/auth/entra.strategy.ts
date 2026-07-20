import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import type { AppConfig } from '../config/configuration';
import { UsersService } from '../users/users.service';
import type { Principal } from '../rbac/permissions';

/** Raw claims we rely on from an Entra v2.0 access token. */
interface EntraClaims {
  oid: string;
  tid: string;
  aud: string;
  iss: string;
  name?: string;
  preferred_username?: string;
  upn?: string;
  roles?: string[];
  scp?: string;
}

/**
 * Validates Microsoft Entra ID (Azure AD) access tokens.
 *
 * - Signature is verified against the tenant JWKS (keys are fetched and cached
 *   by jwks-rsa; rotation is handled automatically).
 * - issuer + audience are pinned to our tenant / API app registration.
 * - The verified `oid` is resolved to a local User row, whose type/scope/grants
 *   drive RBAC. Unknown-but-valid identities are rejected (must be provisioned
 *   by a System Admin first) — closed by default.
 */
@Injectable()
export class EntraStrategy extends PassportStrategy(Strategy, 'entra') {
  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly users: UsersService,
  ) {
    const entra = config.get('entra', { infer: true });
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      audience: entra.audience,
      issuer: entra.issuer,
      algorithms: ['RS256'],
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: entra.jwksUri,
      }),
    });
  }

  async validate(claims: EntraClaims): Promise<Principal> {
    if (!claims?.oid) throw new UnauthorizedException('Token missing oid claim');

    const user = await this.users.findByEntraOid(claims.oid);
    if (!user || !user.active) {
      // Valid Entra user, but not provisioned in the platform (or deactivated).
      throw new UnauthorizedException('User is not provisioned for this platform');
    }

    // Keep lightweight profile fields fresh from the token.
    const email = claims.upn || claims.preferred_username || null;
    if (email && email !== user.email) {
      await this.users.touchProfile(user.id, { email, name: claims.name });
    }

    return {
      oid: claims.oid,
      id: user.id,
      name: user.name,
      type: user.type,
      scope: user.scope,
      all: user.all,
      grants: user.grants,
    };
  }
}
