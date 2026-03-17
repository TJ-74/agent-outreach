import { NextResponse } from "next/server";
import { getValidAccessToken, getGraphClient, clearTokens, getUserId } from "@/lib/outlook";

export async function GET() {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return NextResponse.json({ connected: false });
  }

  try {
    const client = getGraphClient(accessToken);
    const me = await client.api("/me").select("mail,displayName,userPrincipalName").get();
    const userId = await getUserId();

    return NextResponse.json({
      connected: true,
      email: me.mail || me.userPrincipalName,
      name: me.displayName,
      userId,
    });
  } catch {
    return NextResponse.json({ connected: false });
  }
}

export async function DELETE() {
  await clearTokens();
  return NextResponse.json({ disconnected: true });
}
