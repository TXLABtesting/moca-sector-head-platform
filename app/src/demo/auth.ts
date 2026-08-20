/* Demo-only authentication.
 *
 * The hosted demo runs entirely in the browser (GitHub Pages, no server), so
 * these credentials are fake and intended purely to let each person sign in to
 * their own portal for a realistic walkthrough. Data is shared in the browser's
 * local storage, so after members sign in and fill their sections, the chair can
 * sign in and see everyone's inputs. This file must NOT ship to production —
 * the IT build replaces it with Microsoft Entra (Azure AD) SSO. */

export interface DemoCredential {
  email: string;
  password: string;
  userId: string;   // maps to a SEED_USERS id
}

export const DEMO_CREDENTIALS: DemoCredential[] = [
  { email: 'fouzia.altayer@moca.gov.ae', password: 'chief@2026', userId: 'chair' },
  { email: 'moza.almarzouqi@moca.gov.ae', password: 'Moza@2026', userId: 'moza' },
  { email: 'samah.abusharkh@moca.gov.ae', password: 'Samah@2026', userId: 'samah' },
  { email: 'fatma.alrashidi@moca.gov.ae', password: 'Fatma@2026', userId: 'fatma' },
  { email: 'hagar.helal@moca.gov.ae', password: 'Hagar@2026', userId: 'hagar' },
  { email: 'saif.baydani@moca.gov.ae', password: 'Saif@2026', userId: 'saif' },
  { email: 'hasan.hammam@moca.gov.ae', password: 'Hasan@2026', userId: 'hasan' },
  { email: 'rashed.alnuaimi@moca.gov.ae', password: 'Rashed@2026', userId: 'rashed' },
  { email: 'admin@moca.gov.ae', password: 'Admin@2026', userId: 'sysadmin' },
];

/** Returns the matching userId, or null if the credentials are wrong. Accepts the
 *  full email, or just the local part before "@" (so "samah.abusharkh" also works).
 *  Both fields are trimmed — pasted values often carry a trailing space/newline. */
export function verifyCredentials(login: string, password: string): string | null {
  const raw = login.trim().toLowerCase();
  const local = raw.split('@')[0];
  const p = password.trim();
  const hit = DEMO_CREDENTIALS.find((c) => {
    const e = c.email.toLowerCase();
    return (e === raw || e.split('@')[0] === local) && c.password === p;
  });
  return hit ? hit.userId : null;
}
