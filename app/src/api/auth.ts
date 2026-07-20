/**
 * Microsoft Entra ID (Azure AD) sign-in for the SPA — the client half of the
 * platform's SSO. Uses MSAL Browser with the Authorization Code + PKCE flow.
 *
 * This module is the production (`it` branch) replacement for the demo's
 * client-side username/password gate. Enable it by:
 *   1. `npm i @azure/msal-browser`
 *   2. setting VITE_ENTRA_* env vars (see .env.example),
 *   3. calling `initAuth()` before render and gating <App/> on an account.
 *
 * The acquired access token is attached by src/api/client.ts to every /api call;
 * the backend validates it against Entra's JWKS and maps the `oid` to a user.
 */
import {
  PublicClientApplication,
  InteractionRequiredAuthError,
  type AccountInfo,
  type Configuration,
} from '@azure/msal-browser';

const env = import.meta.env;

const config: Configuration = {
  auth: {
    clientId: env.VITE_ENTRA_CLIENT_ID as string,
    authority: `https://login.microsoftonline.com/${env.VITE_ENTRA_TENANT_ID}`,
    redirectUri: (env.VITE_ENTRA_REDIRECT_URI as string) || window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    // sessionStorage keeps tokens out of long-lived localStorage.
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
};

/** Scopes requested for the API access token (exposed by the API app reg). */
const API_SCOPE = (env.VITE_ENTRA_API_SCOPE as string) || 'api://REPLACE_ME/access_as_user';

export const msal = new PublicClientApplication(config);

let ready = false;
export async function initAuth(): Promise<AccountInfo | null> {
  if (!ready) {
    await msal.initialize();
    ready = true;
  }
  // Complete a redirect round-trip if we're returning from Entra.
  const result = await msal.handleRedirectPromise();
  if (result?.account) msal.setActiveAccount(result.account);

  const account = msal.getActiveAccount() ?? msal.getAllAccounts()[0] ?? null;
  if (account) msal.setActiveAccount(account);
  return account;
}

/** Kick off interactive sign-in (redirect). */
export function login(): Promise<void> {
  return msal.loginRedirect({ scopes: [API_SCOPE] });
}

export function logout(): Promise<void> {
  return msal.logoutRedirect();
}

export function currentAccount(): AccountInfo | null {
  return msal.getActiveAccount();
}

/**
 * Acquire an API access token — silently when possible, falling back to an
 * interactive redirect when the cached token can't be refreshed.
 */
export async function getAccessToken(): Promise<string> {
  const account = msal.getActiveAccount();
  if (!account) throw new Error('Not signed in');
  try {
    const res = await msal.acquireTokenSilent({ account, scopes: [API_SCOPE] });
    return res.accessToken;
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) {
      await msal.acquireTokenRedirect({ account, scopes: [API_SCOPE] });
    }
    throw e;
  }
}
