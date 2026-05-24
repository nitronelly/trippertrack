import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const body = await req.json();

    const eventId = body.eventId;
    const userId = body.userId;

    if (!eventId || !userId) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing eventId or userId" }),
        { status: 400 }
      );
    }

    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const accuracyM = Number(body.accuracyM);
    const batteryPercent =
      body.batteryPercent == null ? null : Math.round(Number(body.batteryPercent));

    const hasGoodCoords =
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      (
        !Number.isFinite(accuracyM) ||
        accuracyM <= 150
      );

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const row: Record<string, unknown> = {
      event_id: eventId,
      user_id: userId,
      broadcasting: true,
      updated_at: new Date().toISOString(),
    };

    if (hasGoodCoords) {
      row.latitude = latitude;
      row.longitude = longitude;
      row.accuracy_m = Number.isFinite(accuracyM) ? accuracyM : null;

      if (Number.isFinite(batteryPercent)) {
        row.battery_percent = batteryPercent;
      }

      row.last_movement_at = new Date().toISOString();
      console.log("TT_EDGE_SKIP_BAD_COORDS", {
        rawLatitude: body.latitude,
        rawLongitude: body.longitude,
        rawAccuracyM: body.accuracyM,
        latitude,
        longitude,
        accuracyM,
      });
    }

    const { error } = await supabase
      .from("live_presence")
      .upsert(row, {
        onConflict: "event_id,user_id",
      });

    if (error) {
      return new Response(
        JSON.stringify({ ok: false, error: error.message }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        coordsUpdated: hasGoodCoords,
      }),
      { status: 200 }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      }),
      { status: 500 }
    );
  }
});