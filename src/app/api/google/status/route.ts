import { NextResponse } from "next/server";
import {
  clearGoogleTokens,
  fetchGoogleProfile,
  getGoogleUserId,
  getValidGoogleAccessToken,
} from "@/lib/google";

export async function GET() {
  const accessToken = await getValidGoogleAccessToken();
  if (!accessToken) {
    return NextResponse.json({ connected: false });
  }

  try {
    const profile = await fetchGoogleProfile(accessToken);
    const userId = await getGoogleUserId();

    return NextResponse.json({
      connected: true,
      email: profile.email,
      name: profile.name ?? null,
      userId,
    });
  } catch {
    return NextResponse.json({ connected: false });
  }
}

export async function DELETE() {
  await clearGoogleTokens();
  return NextResponse.json({ disconnected: true });
}
