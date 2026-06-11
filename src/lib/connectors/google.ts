import { readCred, writeCred, type StoredCred } from "./store";
import type { ConnectorKind } from "./types";

/**
 * Google OAuth 2.0 (web app) — shared by every Google-based connector (Gmail,
 * Google Calendar). One Cloud project / client id serves all of them; each
 * connector just requests its own scopes and registers its own callback.
 *
 * Setup (one-time, in Google Cloud Console):
 *  1. Create an OAuth 2.0 Client ID (type: Web application).
 *  2. Authorized redirect URIs (one per Google connector you enable):
 *       <app-origin>/api/connectors/gmail/oauth/callback
 *       <app-origin>/api/connectors/google-calendar/oauth/callback
 *  3. Enable the Gmail API and/or Google Calendar API for the project.
 *  4. Put the client id/secret in env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET.
 *
 * Every flow also requests `userinfo.email` so we know which address is "us"
 * when classifying inbound vs outbound. `access_type=offline` + `prompt=consent`
 * so we always get a refresh token.
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const EMAIL_SCOPE = "https://www.googleapis.com/auth/userinfo.email";

/** Per-connector Google scopes. */
const GOOGLE_SCOPES: Partial<Record<ConnectorKind, string[]>> = {
  gmail: ["https://www.googleapis.com/auth/gmail.readonly", EMAIL_SCOPE],
  "google-calendar": ["https://www.googleapis.com/auth/calendar.readonly", EMAIL_SCOPE],
};

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** Each Google connector registers its own callback in the Cloud Console. */
export function googleRedirectUri(origin: string, kind: ConnectorKind): string {
  return `${origin}/api/connectors/${kind}/oauth/callback`;
}

/** Build the consent URL and stash the CSRF state on this connector's credential. */
export async function buildGoogleAuthUrl(
  origin: string,
  state: string,
  kind: ConnectorKind,
): Promise<string> {
  await writeCred(kind, { oauthState: state, connected: false });
  const scopes = GOOGLE_SCOPES[kind] ?? [EMAIL_SCOPE];
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: googleRedirectUri(origin, kind),
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
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
    throw new Error(`Google token exchange → ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as TokenResponse;
}

/** Exchange an authorization code for tokens and persist them on `kind`. */
export async function exchangeGoogleCode(
  origin: string,
  code: string,
  kind: ConnectorKind,
): Promise<StoredCred> {
  const tok = await postToken({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: googleRedirectUri(origin, kind),
    grant_type: "authorization_code",
  });
  const accountEmail = await fetchAccountEmail(tok.access_token);
  return writeCred(kind, {
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token,
    expiresAt: Date.now() + tok.expires_in * 1000,
    accountEmail,
    connected: true,
    oauthState: undefined,
    error: undefined,
  });
}

/** A valid access token for `kind`, refreshing first if the stored one is near expiry. */
export async function getValidGoogleToken(kind: ConnectorKind): Promise<string> {
  const cred = await readCred(kind);
  if (!cred?.refreshToken && !cred?.accessToken) throw new Error("This Google connector isn't connected.");
  // 60s skew so we don't hand back a token that expires mid-request.
  if (cred.accessToken && cred.expiresAt && cred.expiresAt - 60_000 > Date.now()) {
    return cred.accessToken;
  }
  if (!cred.refreshToken) throw new Error("Google session expired — reconnect.");
  const tok = await postToken({
    refresh_token: cred.refreshToken,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    grant_type: "refresh_token",
  });
  await writeCred(kind, {
    accessToken: tok.access_token,
    expiresAt: Date.now() + tok.expires_in * 1000,
  });
  return tok.access_token;
}

async function fetchAccountEmail(accessToken: string): Promise<string | undefined> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return undefined;
    const json = (await res.json()) as { email?: string };
    return json.email;
  } catch {
    return undefined;
  }
}
