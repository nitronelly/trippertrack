import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const {
      eventId,
      name,
      batteryPercent,
      latitude,
      longitude,
      timestamp,
      fromUserId,
    } = await req.json();

    if (
      !eventId ||
      !fromUserId ||
      latitude == null ||
      longitude == null
    ) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify sender is actually an active member of this event
    const { data: senderMembership, error: senderMembershipError } = await supabaseAdmin
      .from("event_members")
      .select("user_id")
      .eq("event_id", eventId)
      .eq("user_id", fromUserId)
      .is("left_at", null)
      .maybeSingle();

    if (senderMembershipError) {
      throw senderMembershipError;
    }

    if (!senderMembership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: members, error: membersError } = await supabaseAdmin
      .from("event_members")
      .select(`
        user_id,
        users:user_id (
          expo_push_token
        )
      `)
      .eq("event_id", eventId)
      .is("left_at", null);

    if (membersError) {
      throw membersError;
    }

    const recipientTokens =
      (members || [])
        .filter((member: any) => member.user_id !== fromUserId)
        .map((member: any) =>
          Array.isArray(member.users) ? member.users[0] : member.users
        )
        .map((userRow: any) => userRow?.expo_push_token)
        .filter(Boolean);

    if (recipientTokens.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const timeLabel = new Date(timestamp).toLocaleTimeString("en-GB", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Europe/London",
    });

    const mapUrl = `https://maps.google.com/?q=${latitude},${longitude}`;

    const messages = recipientTokens.map((token: string) => ({
      to: token,
      sound: "default",
      priority: "high",
      channelId: "default",
      title: "🚨 Need Help",
      body: `${name || "Someone"} needs help`,
      data: {
        kind: "need_help",
        fromUserId,
        eventId,
        latitude,
        longitude,
        batteryPercent,
        timestamp,
        mapUrl,
      },
    }));

    const expoRes = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const expoJson = await expoRes.json();
    console.log("Expo push response full:", JSON.stringify(expoJson, null, 2));
    return new Response(
      JSON.stringify({ ok: true, sent: messages.length, expoJson }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("send-need-help-push failed:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});