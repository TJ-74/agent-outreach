import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, saveTokens, upsertUser } from "@/lib/outlook";

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
    const tokens = await exchangeCodeForTokens(code);
    const userId = await upsertUser(tokens.access_token);
    await saveTokens(tokens.access_token, tokens.refresh_token, tokens.expires_in, userId);

    try {
      const base = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
      await fetch(`${base}/api/outlook/subscribe`, {
        method: "POST",
        headers: { Cookie: req.headers.get("cookie") ?? "" },
      });
    } catch {
      // subscription will be retried on next checkConnection
    }

    return NextResponse.redirect(
      new URL("/settings?connected=true&provider=outlook", req.url)
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Token exchange failed";
    return NextResponse.redirect(
      new URL(`/settings?error=${encodeURIComponent(msg)}`, req.url)
    );
  }
}
