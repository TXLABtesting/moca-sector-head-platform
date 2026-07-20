import {
  IsBoolean, IsIn, IsObject, IsOptional, IsString, IsUUID, Length, ValidateIf,
} from 'class-validator';
import { SCOPES, UserType } from '../../rbac/permissions';

const USER_TYPES: UserType[] = ['chair', 'office', 'sector', 'sysadmin'];

/** Payload for the System Admin to create/update a platform user. */
export class UpsertUserDto {
  @IsString()
  @Length(2, 64)
  id!: string;

  /** Entra object id — required to let the person actually sign in. */
  @IsOptional()
  @IsUUID()
  entraOid?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsString()
  @Length(2, 128)
  name!: string;

  @IsOptional()
  @IsString()
  job?: string;

  @IsIn(USER_TYPES)
  type!: UserType;

  @IsIn(SCOPES as unknown as string[])
  scope!: string;

  @IsOptional()
  @IsBoolean()
  all?: boolean;

  /** section -> grant letters. Ignored for chair/all (full access implied). */
  @IsOptional()
  @IsObject()
  @ValidateIf((o) => !o.all)
  grants?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
