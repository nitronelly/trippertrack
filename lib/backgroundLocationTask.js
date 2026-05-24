import * as TaskManager from "expo-task-manager";
import * as Battery from "expo-battery";
import {
  getStoredEventId,
  getStoredUserId,
  upsertPresenceFromBackgroundTask,
} from "./tripperBackend";

export const LOCATION_TASK_NAME = "trippertrack-background-location";
console.log("TT_BG_TASK_MODULE_LOADED:", LOCATION_TASK_NAME);
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.log("TT_BG_FIRE: task error =", error);
    return;
  }

  try {
    const locations = data?.locations;
    const latest = locations?.[0];

    console.log(
      "TT_BG_FIRE: fired, locations count =",
      locations?.length || 0
    );

    if (!latest?.coords) {
      console.log("TT_BG_FIRE: no latest coords");
      return;
    }

    console.log("TT_BG_FIRE: coords =", {
      latitude: latest.coords.latitude,
      longitude: latest.coords.longitude,
      accuracy: latest.coords.accuracy,
      timestamp: latest.timestamp,
    });

    const eventId = await getStoredEventId();
    console.log("TT_BG_FIRE: stored eventId =", eventId);

    if (!eventId) return;

    const batteryState = await Battery.getPowerStateAsync();
    const batteryLevel = batteryState?.batteryLevel ?? 0;
    const batteryPercent =
      batteryLevel < 0 ? 0 : Math.round(batteryLevel * 100);

    console.log("TT_BG_FIRE: upserting presence now");

    const userId = await getStoredUserId();
    console.log("TT_BG_FIRE: stored userId =", userId);

    await upsertPresenceFromBackgroundTask({
      eventId,
      userId,
      latitude: latest.coords.latitude,
      longitude: latest.coords.longitude,
      accuracyM: latest.coords.accuracy,
      batteryPercent,
      broadcasting: true,
      lastMovementAt: new Date().toISOString(),
    });

    console.log("TT_BG_UPSERT_OK:", {
      eventId,
      latitude: latest.coords.latitude,
      longitude: latest.coords.longitude,
      accuracyM: latest.coords.accuracy,
      batteryPercent,
    });
  } catch (e) {
    console.log("TT_BG_UPSERT_FAIL:", e);
  }
});