import { Client } from "@microsoft/microsoft-graph-client";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

const TENANT = "common";
const AUTH_BASE = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0`;

const COOKIE_OPTS = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 30,
};

function env(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

export function getAuthUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: env("OUTLOOK_CLIENT_ID"),
    response_type: "code",
    redirect_uri: env("OUTLOOK_REDIRECT_URI"),
    scope: env("OUTLOOK_SCOPES"),
    response_mode: "query",
    prompt: "select_account", // Always show account picker so user can choose a different account
    ...(state ? { state } : {}),
  });
  return `${AUTH_BASE}/authorize?${params}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export async function exchangeCodeForTokens(
  code: string
): Promise<TokenResponse> {
  const res = await fetch(`${AUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("OUTLOOK_CLIENT_ID"),
      client_secret: env("OUTLOOK_CLIENT_SECRET"),
      code,
      redirect_uri: env("OUTLOOK_REDIRECT_URI"),
      grant_type: "authorization_code",
      scope: env("OUTLOOK_SCOPES"),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  return res.json();
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<TokenResponse> {
  const res = await fetch(`${AUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("OUTLOOK_CLIENT_ID"),
      client_secret: env("OUTLOOK_CLIENT_SECRET"),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: env("OUTLOOK_SCOPES"),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${err}`);
  }

  return res.json();
}

export function getGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => done(null, accessToken),
  });
}

export async function saveTokens(
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
  userId?: string,
) {
  const jar = await cookies();
  jar.set("ol_at", accessToken, COOKIE_OPTS);
  jar.set("ol_rt", refreshToken, COOKIE_OPTS);
  jar.set("ol_exp", String(Date.now() + expiresIn * 1000), COOKIE_OPTS);

  const uid = userId || jar.get("ol_uid")?.value;
  if (uid) {
    await supabase.from("outlook_tokens").upsert(
      {
        user_id: uid,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  }
}

export async function clearTokens() {
  const jar = await cookies();
  jar.delete("ol_at");
  jar.delete("ol_rt");
  jar.delete("ol_exp");
  jar.delete("ol_uid");
}

export async function getValidAccessToken(): Promise<string | null> {
  const jar = await cookies();
  const at = jar.get("ol_at")?.value;
  const rt = jar.get("ol_rt")?.value;
  const exp = jar.get("ol_exp")?.value;

  if (!at || !rt || !exp) return null;

  const expiresAt = Number(exp);
  if (Date.now() < expiresAt - 60_000) {
    return at;
  }

  try {
    const refreshed = await refreshAccessToken(rt);
    await saveTokens(
      refreshed.access_token,
      refreshed.refresh_token,
      refreshed.expires_in
    );
    return refreshed.access_token;
  } catch {
    return null;
  }
}

export async function getUserId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get("ol_uid")?.value || null;
}

export async function getTokensForUser(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("outlook_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .single();

  if (!data) return null;

  const expiresAt = new Date(data.expires_at).getTime();
  if (Date.now() < expiresAt - 60_000) {
    return data.access_token;
  }

  try {
    const refreshed = await refreshAccessToken(data.refresh_token);
    await supabase.from("outlook_tokens").update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);
    return refreshed.access_token;
  } catch {
    return null;
  }
}

export async function upsertUser(accessToken: string): Promise<string> {
  const client = getGraphClient(accessToken);
  const me = await client.api("/me").select("mail,displayName,userPrincipalName").get();

  const email = (me.mail || me.userPrincipalName || "").toLowerCase();
  const name = me.displayName || "";

  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .single();

  if (existing) {
    await supabase
      .from("users")
      .update({ name, last_login: new Date().toISOString() })
      .eq("id", existing.id);

    const jar = await cookies();
    jar.set("ol_uid", existing.id, {
      path: "/",
      httpOnly: false,
      sameSite: "lax" as const,
      maxAge: 60 * 60 * 24 * 30,
    });
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from("users")
    .insert({ email, name })
    .select("id")
    .single();

  if (error || !created) throw new Error("Failed to create user");

  const jar = await cookies();
  jar.set("ol_uid", created.id, {
    path: "/",
    httpOnly: false,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 30,
  });
  return created.id;
}
