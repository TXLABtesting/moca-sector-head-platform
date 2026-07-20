/* Demo-only authentication.
 *
 * The hosted demo runs entirely in the browser (GitHub Pages, no server), so
 * these credentials are fake and intended purely to let each person sign in to
 * their own portal for a realistic walkthrough. Data is shared in the browser's
 * local storage, so after members sign in and fill their sections, the chair can
 * sign in and see everyone's inputs. This file must NOT ship to production —
 * the IT build replaces it with Microsoft Entra (Azure AD) SSO. */

export interface DemoCredential {
  username: string;
  password: string;
  userId: string;   // maps to a SEED_USERS id
}

export const DEMO_CREDENTIALS: DemoCredential[] = [
  { username: 'fawzia.altayer', password: 'Chair@2026', userId: 'chair' },
  { username: 'moza.almarzouqi', password: 'Moza@2026', userId: 'moza' },
  { username: 'samah.abusharkh', password: 'Samah@2026', userId: 'samah' },
  { username: 'fatma.alrashidi', password: 'Fatma@2026', userId: 'fatma' },
  { username: 'hagar.helal', password: 'Hagar@2026', userId: 'hagar' },
  { username: 'saif.baydani', password: 'Saif@2026', userId: 'saif' },
  { username: 'hasan.hammam', password: 'Hasan@2026', userId: 'hasan' },
  { username: 'rashed.alnuaimi', password: 'Rashed@2026', userId: 'rashed' },
  { username: 'admin', password: 'Admin@2026', userId: 'sysadmin' },
];

/** Returns the matching userId, or null if the credentials are wrong. */
export function verifyCredentials(username: string, password: string): string | null {
  const u = username.trim().toLowerCase();
  const hit = DEMO_CREDENTIALS.find((c) => c.username.toLowerCase() === u && c.password === password);
  return hit ? hit.userId : null;
}
