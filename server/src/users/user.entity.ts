import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { UserType } from '../rbac/permissions';

/**
 * A platform user. Identity is federated to Microsoft Entra — there are no
 * local passwords. `entraOid` (the token `oid` claim) is the join key between
 * the Entra directory and this app's roles/permissions.
 */
@Entity({ name: 'users' })
export class User {
  /** Stable app id / display key (e.g. "samah", "chair"). */
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  /** Entra object id (oid claim). Unique, indexed — the auth join key. */
  @Index({ unique: true })
  @Column({ type: 'uuid', name: 'entra_oid', nullable: true })
  entraOid!: string | null;

  /** UPN / email from the token (upn or preferred_username). */
  @Column({ type: 'varchar', length: 256, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ type: 'varchar', length: 256, default: '' })
  job!: string;

  /** chair | office | sector | sysadmin */
  @Column({ type: 'varchar', length: 16 })
  type!: UserType;

  /** Access scope key (all | office | admin_affairs | hr | digital | cx). */
  @Column({ type: 'varchar', length: 32, default: 'office' })
  scope!: string;

  /** Full-access flag (chair / super-grant). */
  @Column({ type: 'boolean', default: false })
  all!: boolean;

  /** section -> grant letters, e.g. { "projects": "vaemsrn" }. */
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  grants!: Record<string, string>;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
