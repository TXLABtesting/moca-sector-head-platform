import 'reflect-metadata';
import dataSource from './data-source';
import { User } from '../users/user.entity';

/**
 * Seeds the organizational users and their permission grants (mirrors
 * app/src/domain/permissions.ts). Entra object ids are left null — a System
 * Admin maps each person's real Entra oid via the Permissions screen (or by
 * setting BOOTSTRAP_SYSADMIN_OID) before they can sign in.
 *
 * Idempotent: re-running updates the same rows by id. It seeds ROLES/GRANTS
 * only — it does NOT create any operational content (the platform starts empty,
 * like the demo).
 *
 * Run with:  npm run seed
 */
const USERS: Partial<User>[] = [
  { id: 'chair', name: 'فوزية الطاير', job: 'رئيس قطاع الخدمات المركزية', type: 'chair', scope: 'all', all: true, grants: {} },
  { id: 'moza', name: 'موزة المرزوقي', job: 'مسؤولة الصادر والوارد والمتابعات', type: 'office', scope: 'office',
    grants: { dashboard: 'v', correspondence: 'vaemsrn', myTasks: 've', projects: 'v', reportCenter: 'v', committees: 'v', assistant: 'v' } },
  { id: 'samah', name: 'سماح أبو شرخ', job: 'مسؤولة المحاضر واللجان والتوصيات والإجازات', type: 'office', scope: 'all',
    grants: { dashboard: 'v', meetings: 'vaer', minutes: 'vaemrn', minuteTasks: 'vaes', committees: 'vaemr', committeeDecisions: 'vaer', recommendations: 'vaer', leaves: 'vaemsrn', myTasks: 've', assistant: 'v' } },
  { id: 'fatma', name: 'فاطمه الرشيدى', job: 'مسؤولة المشاريع والتنسيق التنفيذي', type: 'office', scope: 'office',
    grants: { dashboard: 'v', projects: 'vaemsrn', projPhases: 'vae', projUpdates: 'vaer', projRisks: 'vae', myTasks: 've', reportCenter: 'v', meetings: 'v', minutes: 'v', assistant: 'v' } },
  { id: 'hagar', name: 'هاجر هلول', job: 'مسؤولة الإنجاز والمتابعة والتقارير المالية', type: 'office', scope: 'office',
    grants: { dashboard: 'v', finReports: 'vaemrn', reportLog: 'vae', projUpdates: 'vaer', myTasks: 've', projects: 'v', assistant: 'v' } },
  { id: 'saif', name: 'سيف بيضاني', job: 'مسؤول المشاريع والمراحل والمخاطر', type: 'office', scope: 'office',
    grants: { dashboard: 'v', projects: 'vaemsrn', projPhases: 'vae', projUpdates: 'vaer', projRisks: 'vae', myTasks: 've', reportCenter: 'v', assistant: 'v' } },
  { id: 'hasan', name: 'حسن همام', job: 'مسؤول الجودة والامتثال والتدقيق', type: 'office', scope: 'all',
    grants: { dashboard: 'v', auditReports: 'vaemrn', recommendations: 'vaesr', committees: 've', reportCenter: 've', myTasks: 've', assistant: 'v' } },
  { id: 'rashed', name: 'راشد النعيمي', job: 'مدير إدارة الشؤون الإدارية', type: 'sector', scope: 'admin_affairs',
    grants: { dashboard: 'v', projects: 'vrn', reportCenter: 'v', correspondence: 'v', assistant: 'v' } },
  { id: 'sysadmin', name: 'مدير النظام', job: 'إدارة النظام والصلاحيات', type: 'sysadmin', scope: 'all',
    grants: { dashboard: 'v', permissions: 'vaeds', assistant: 'v' } },
];

async function run() {
  await dataSource.initialize();
  const repo = dataSource.getRepository(User);

  const bootstrapOid = process.env.BOOTSTRAP_SYSADMIN_OID || '';
  for (const u of USERS) {
    const existing = await repo.findOne({ where: { id: u.id! } });
    const entity = repo.merge(existing ?? repo.create(), u as User);
    if (u.id === 'sysadmin' && bootstrapOid && !entity.entraOid) {
      entity.entraOid = bootstrapOid; // first admin can sign in immediately
    }
    await repo.save(entity);
    // eslint-disable-next-line no-console
    console.log(`seeded user ${u.id} (${u.type})`);
  }

  await dataSource.destroy();
  // eslint-disable-next-line no-console
  console.log('Seed complete. Map each user\'s Entra oid via the Permissions screen to enable sign-in.');
}

run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
