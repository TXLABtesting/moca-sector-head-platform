import { MigrationInterface, QueryRunner } from 'typeorm';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Initial schema. Applies the authoritative DDL in server/db/schema.sql so the
 * SQL file stays the single source of truth for the full data model. Resolves
 * the file relative to the project root (works from both src and dist).
 */
export class InitSchema1700000000000 implements MigrationInterface {
  name = 'InitSchema1700000000000';

  private ddl(): string {
    const candidates = [
      join(process.cwd(), 'db', 'schema.sql'),
      join(__dirname, '..', '..', '..', 'db', 'schema.sql'),
    ];
    for (const p of candidates) {
      try {
        return readFileSync(p, 'utf8');
      } catch {
        /* try next */
      }
    }
    throw new Error(`schema.sql not found (looked in: ${candidates.join(', ')})`);
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(this.ddl());
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Full teardown — safe because this is the base migration.
    await queryRunner.query(`
      DROP TABLE IF EXISTS change_log, update_requests, ret_reports, committees,
        req_meetings, fin_models, reg_reports, audit_areas, audit_reports,
        actions, leaves, correspondence, office_tasks, minute_tasks, meetings,
        projects, sector_managers, users CASCADE;
      DROP FUNCTION IF EXISTS set_updated_at CASCADE;
    `);
  }
}
