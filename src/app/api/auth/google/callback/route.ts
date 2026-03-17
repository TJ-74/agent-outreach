import { NextRequest, NextResponse } from "next/server";
import {
  exchangeGoogleCodeForTokens,
  saveGoogleTokens,
  upsertGoogleUser,
} from "@/lib/google";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    const desc = req.nextUrl.searchParams.get("error_description") || "Auth denied";
    return NextResponse.redirect(
      new URL(`/settings?error=${encodeURIComponent(desc)}`, req.url)
    );
  }

  try {
    const tokens = await exchangeGoogleCodeForTokens(code);
    await upsertGoogleUser(tokens.access_token);
    await saveGoogleTokens(tokens.access_token, tokens.refresh_token, tokens.expires_in);

    return NextResponse.redirect(
      new URL("/settings?connected=true&provider=google", req.url)
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Token exchange failed";
    return NextResponse.redirect(
      new URL(`/settings?error=${encodeURIComponent(msg)}`, req.url)
    );
  }
}
