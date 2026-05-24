import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";


Deno.serve(async (req) => {
  try {
    const cronSecret = Deno.env.get("MEETUP_PUSH_CRON_SECRET");
    const cronHeader = req.headers.get("x-cron-secret");

    console.log("cronHeader:", cronHeader);
    console.log("cronSecret exists:", !!cronSecret);

    if (!cronSecret) {
      return new Response(
        JSON.stringify({ error: "Missing MEETUP_PUSH_CRON_SECRET" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (cronHeader !== cronSecret) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("process-meetup-push-queue: authorized request received");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: jobs, error: jobsError } = await supabase
      .from("meetup_push_jobs")
      .select("id, pin_id, event_id, kind, title, body, run_at")
      .eq("sent", false)
      .lte("run_at", new Date().toISOString())
      .order("run_at", { ascending: true })
      .limit(50);

    if (jobsError) {
      throw jobsError;
    }

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, processed: 0 }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    let processed = 0;

    for (const job of jobs) {
      const { data: pin, error: pinError } = await supabase
        .from("event_pins")
        .select("id, label, latitude, longitude, meetup_at")
        .eq("id", job.pin_id)
        .single();

      if (pinError || !pin) {
        console.log("Pin lookup failed", job.id, pinError);
        continue;
      }

      const { data: members, error: membersError } = await supabase
        .from("event_members")
        .select(`
          user_id,
          users:user_id (
            expo_push_token,
            name
          )
        `)
        .eq("event_id", job.event_id)
        .is("left_at", null);

      if (membersError) {
        console.log("Members lookup failed", job.id, membersError);
        continue;
      }

      const messages: any[] = [];

      for (const member of members || []) {
        const user = Array.isArray(member.users) ? member.users[0] : member.users;
        const token = user?.expo_push_token;

        if (!token || !String(token).startsWith("ExponentPushToken[")) {
          continue;
        }

        messages.push({
          to: token,
          sound: "default",
          title: job.title,
          body: job.body,
          data: {
            kind: job.kind,
            eventId: job.event_id,
            pinId: job.pin_id,
            latitude: pin.latitude,
            longitude: pin.longitude,
            meetupAt: pin.meetup_at,
            label: pin.label ?? "Meetup",
          },
        });
      }

      if (messages.length > 0) {
        const expoRes = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(messages),
        });

        const expoJson = await expoRes.json();
        console.log("Expo meetup push result:", JSON.stringify(expoJson));
      }

      const { error: updateError } = await supabase
        .from("meetup_push_jobs")
        .update({
          sent: true,
          sent_at: new Date().toISOString(),
        })
        .eq("id", job.id)
        .eq("sent", false);

      if (updateError) {
        console.log("Failed to mark sent", job.id, updateError);
        continue;
      }

      processed += 1;
    }

    return new Response(
      JSON.stringify({ ok: true, processed }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.log("process-meetup-push-queue error", error);

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