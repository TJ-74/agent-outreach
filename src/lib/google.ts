import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

const GOOGLE_AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

const COOKIE_OPTS = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 30,
};

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  token_type: string;
  scope?: string;
}

interface GoogleProfile {
  email: string;
  name?: string;
}

function env(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

export function getGoogleAuthUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"),
    redirect_uri: env("GOOGLE_REDIRECT_URI"),
    response_type: "code",
    scope: env("GOOGLE_SCOPES"),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent select_account",
    ...(state ? { state } : {}),
  });

  return `${GOOGLE_AUTH_BASE}?${params.toString()}`;
}

export async function exchangeGoogleCodeForTokens(
  code: string
): Promise<GoogleTokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      redirect_uri: env("GOOGLE_REDIRECT_URI"),
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google token exchange failed: ${err}`);
  }

  return res.json();
}

export async function refreshGoogleAccessToken(
  refreshToken: string
): Promise<GoogleTokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google token refresh failed: ${err}`);
  }

  return res.json();
}

export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google user profile failed: ${err}`);
  }

  return res.json();
}

export async function saveGoogleTokens(
  accessToken: string,
  refreshToken: string | undefined,
  expiresIn: number
) {
  const jar = await cookies();
  jar.set("gg_at", accessToken, COOKIE_OPTS);
  jar.set("gg_exp", String(Date.now() + expiresIn * 1000), COOKIE_OPTS);

  if (refreshToken) {
    jar.set("gg_rt", refreshToken, COOKIE_OPTS);
  }
}

export async function clearGoogleTokens() {
  const jar = await cookies();
  jar.delete("gg_at");
  jar.delete("gg_rt");
  jar.delete("gg_exp");
  jar.delete("gg_uid");
}

export async function getValidGoogleAccessToken(): Promise<string | null> {
  const jar = await cookies();
  const accessToken = jar.get("gg_at")?.value;
  const refreshToken = jar.get("gg_rt")?.value;
  const exp = jar.get("gg_exp")?.value;

  if (!accessToken || !exp) return null;

  const expiresAt = Number(exp);
  if (Date.now() < expiresAt - 60_000) {
    return accessToken;
  }

  if (!refreshToken) return null;

  try {
    const refreshed = await refreshGoogleAccessToken(refreshToken);
    await saveGoogleTokens(
      refreshed.access_token,
      refreshed.refresh_token ?? refreshToken,
      refreshed.expires_in
    );
    return refreshed.access_token;
  } catch {
    return null;
  }
}

export async function upsertGoogleUser(accessToken: string): Promise<string> {
  const profile = await fetchGoogleProfile(accessToken);
  const email = (profile.email || "").toLowerCase();
  const name = profile.name || "";

  if (!email) {
    throw new Error("Google did not return an email address");
  }

  const jar = await cookies();
  const fallbackUid = jar.get("ol_uid")?.value || jar.get("gg_uid")?.value || null;

  const { data: existing, error: existingErr } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingErr) {
    if (fallbackUid) {
      jar.set("gg_uid", fallbackUid, {
        path: "/",
        httpOnly: false,
        sameSite: "lax" as const,
        maxAge: 60 * 60 * 24 * 30,
      });
      return fallbackUid;
    }
    throw new Error(`Failed to lookup user: ${existingErr.message}`);
  }

  if (existing) {
    await supabase
      .from("users")
      .update({ name, last_login: new Date().toISOString() })
      .eq("id", existing.id);

    jar.set("gg_uid", existing.id, {
      path: "/",
      httpOnly: false,
      sameSite: "lax" as const,
      maxAge: 60 * 60 * 24 * 30,
    });
    return existing.id;
  }

  const { data: created, error: createErr } = await supabase
    .from("users")
    .insert({ email, name, last_login: new Date().toISOString() })
    .select("id")
    .single();

  if (createErr || !created) {
    // If user was created elsewhere concurrently, fetch it and continue.
    const { data: fallback, error: fallbackErr } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .limit(1)
      .maybeSingle();

    if (fallbackErr || !fallback) {
      if (fallbackUid) {
        jar.set("gg_uid", fallbackUid, {
          path: "/",
          httpOnly: false,
          sameSite: "lax" as const,
          maxAge: 60 * 60 * 24 * 30,
        });
        return fallbackUid;
      }
      throw new Error(
        `Failed to create user: ${createErr?.message ?? "Unknown insert error"}`
      );
    }

    jar.set("gg_uid", fallback.id, {
      path: "/",
      httpOnly: false,
      sameSite: "lax" as const,
      maxAge: 60 * 60 * 24 * 30,
    });
    return fallback.id;
  }

  jar.set("gg_uid", created.id, {
    path: "/",
    httpOnly: false,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 30,
  });

  return created.id;
}

export async function getGoogleUserId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get("gg_uid")?.value || null;
}

function toBase64Url(input: string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function sendGmailEmail(args: {
  accessToken: string;
  to: string;
  subject: string;
  body: string;
  isHtml: boolean;
}) {
  const mime = [
    "MIME-Version: 1.0",
    `To: ${args.to}`,
    `Subject: ${args.subject}`,
    `Content-Type: ${args.isHtml ? "text/html" : "text/plain"}; charset=UTF-8`,
    "",
    args.body,
  ].join("\r\n");

  const raw = toBase64Url(mime);

  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail send failed: ${err}`);
  }

  return res.json();
}
