import { readCred, writeCred, type StoredCred } from "./store";

/**
 * Microsoft identity platform OAuth 2.0 — for the Outlook (Microsoft 365) mail
 * connector via Microsoft Graph.
 *
 * Setup (one-time, in the Azure portal → App registrations):
 *  1. Register an app; add a Web redirect URI:
 *       <app-origin>/api/connectors/outlook/oauth/callback
 *  2. Add a client secret.
 *  3. API permissions (delegated): Mail.Read, User.Read, offline_access, email, openid.
 *  4. Put credentials in env: MS_CLIENT_ID, MS_CLIENT_SECRET.
 *     Multi-tenant by default (MS_TENANT=common); pin a single tenant if needed.
 *
 * `offline_access` gets us a refresh token; the same scopes must be replayed on
 * refresh.
 */

const TENANT = process.env.MS_TENANT ?? "common";
const AUTH_URL = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize`;
const TOKEN_URL = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;
const SCOPES = ["offline_access", "openid", "email", "User.Read", "Mail.Read"];
const SCOPE_STR = SCOPES.join(" ");

export function microsoftConfigured(): boolean {
  return Boolean(process.env.MS_CLIENT_ID && process.env.MS_CLIENT_SECRET);
}

export function msRedirectUri(origin: string): string {
  return process.env.MS_REDIRECT_URI ?? `${origin}/api/connectors/outlook/oauth/callback`;
}

/** Build the consent URL and stash the CSRF state on the outlook credential. */
export async function buildMicrosoftAuthUrl(origin: string, state: string): Promise<string> {
  await writeCred("outlook", { oauthState: state, connected: false });
  const q = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID!,
    redirect_uri: msRedirectUri(origin),
    response_type: "code",
    response_mode: "query",
    scope: SCOPE_STR,
    state,
  });
  return `${AUTH_URL}?${q.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

async function postToken(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Microsoft token exchange → ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as TokenResponse;
}

/** Exchange an authorization code for tokens and persist them. */
export async function exchangeMicrosoftCode(origin: string, code: string): Promise<StoredCred> {
  const tok = await postToken({
    code,
    client_id: process.env.MS_CLIENT_ID!,
    client_secret: process.env.MS_CLIENT_SECRET!,
    redirect_uri: msRedirectUri(origin),
    grant_type: "authorization_code",
    scope: SCOPE_STR,
  });
  const accountEmail = await fetchAccountEmail(tok.access_token);
  return writeCred("outlook", {
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token,
    expiresAt: Date.now() + tok.expires_in * 1000,
    accountEmail,
    connected: true,
    oauthState: undefined,
    error: undefined,
  });
}

/** A valid access token, refreshing first if the stored one is near expiry. */
export async function getValidMicrosoftToken(): Promise<string> {
  const cred = await readCred("outlook");
  if (!cred?.refreshToken && !cred?.accessToken) throw new Error("Outlook isn't connected.");
  if (cred.accessToken && cred.expiresAt && cred.expiresAt - 60_000 > Date.now()) {
    return cred.accessToken;
  }
  if (!cred.refreshToken) throw new Error("Outlook session expired — reconnect.");
  const tok = await postToken({
    refresh_token: cred.refreshToken,
    client_id: process.env.MS_CLIENT_ID!,
    client_secret: process.env.MS_CLIENT_SECRET!,
    grant_type: "refresh_token",
    scope: SCOPE_STR,
  });
  await writeCred("outlook", {
    accessToken: tok.access_token,
    // MS may rotate the refresh token; keep the newest if present.
    ...(tok.refresh_token ? { refreshToken: tok.refresh_token } : {}),
    expiresAt: Date.now() + tok.expires_in * 1000,
  });
  return tok.access_token;
}

async function fetchAccountEmail(accessToken: string): Promise<string | undefined> {
  try {
    const res = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return undefined;
    const json = (await res.json()) as { mail?: string; userPrincipalName?: string };
    return (json.mail ?? json.userPrincipalName)?.toLowerCase();
  } catch {
    return undefined;
  }
}
