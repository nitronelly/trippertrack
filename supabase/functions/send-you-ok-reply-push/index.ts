
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const {
      eventId,
      toUserId,
      fromUserId,
      name,
    } = await req.json();

    if (!eventId || !toUserId || !fromUserId) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: senderMembership, error: senderMembershipError } =
      await supabaseAdmin
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

    const { data: recipientMembership, error: recipientMembershipError } =
      await supabaseAdmin
        .from("event_members")
        .select(`
          user_id,
          users:user_id (
            expo_push_token
          )
        `)
        .eq("event_id", eventId)
        .eq("user_id", toUserId)
        .is("left_at", null)
        .maybeSingle();

    if (recipientMembershipError) {
      throw recipientMembershipError;
    }

    if (!recipientMembership) {
      return new Response(JSON.stringify({ error: "Recipient not in event" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const recipientUser = Array.isArray(recipientMembership.users)
      ? recipientMembership.users[0]
      : recipientMembership.users;

    const recipientToken = recipientUser?.expo_push_token;

    if (!recipientToken) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const message = {
      to: recipientToken,
      sound: "default",
      priority: "high",
      channelId: "default",
      title: "👀 You OK?",
      body: `${name || "Someone"} checked on you`,
      data: {
        kind: "you_ok",
        fromUserId,
        toUserId,
        eventId,
      },
    };

    const expoRes = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const expoJson = await expoRes.json();
    console.log("Expo You OK push response full:", JSON.stringify(expoJson, null, 2));

    return new Response(
      JSON.stringify({ ok: true, sent: 1, expoJson }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("send-you-ok-push failed:", error);

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