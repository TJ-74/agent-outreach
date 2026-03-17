import { NextResponse } from "next/server";
import { getValidAccessToken, getGraphClient, getUserId } from "@/lib/outlook";
import { supabase } from "@/lib/supabase";

export async function POST() {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Missing user" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return NextResponse.json(
      { skipped: true, reason: "NEXT_PUBLIC_APP_URL not configured — webhook subscription disabled" },
      { status: 200 },
    );
  }
  const notificationUrl = `${appUrl}/api/outlook/webhook`;

  const expiry = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  try {
    const client = getGraphClient(accessToken);
    const subscription = await client.api("/subscriptions").post({
      changeType: "created",
      notificationUrl,
      resource: "/me/mailFolders('Inbox')/messages",
      expirationDateTime: expiry.toISOString(),
    });

    await supabase.from("outlook_subscriptions").upsert(
      {
        user_id: userId,
        subscription_id: subscription.id,
        expiry_at: subscription.expirationDateTime,
      },
      { onConflict: "subscription_id" },
    );

    return NextResponse.json({
      subscriptionId: subscription.id,
      expiry: subscription.expirationDateTime,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Subscription failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
