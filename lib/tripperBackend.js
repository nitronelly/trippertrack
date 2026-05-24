import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import * as ImagePicker from "expo-image-picker";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system";

export const CURRENT_EVENT_ID_KEY = "trippertrack_current_event_id";
export const CURRENT_USER_ID_KEY = "trippertrack_current_user_id";

export async function getStoredUserId() {
  return AsyncStorage.getItem(CURRENT_USER_ID_KEY);
}

export async function upsertPresenceFromBackgroundTask({
  eventId,
  userId,
  latitude,
  longitude,
  accuracyM,
  batteryPercent,
  broadcasting = true,
  lastMovementAt = null,
}) {
  if (!eventId) throw new Error("Missing event id");
  if (!userId) throw new Error("Missing stored user id");

  const row = {
    event_id: eventId,
    user_id: userId,
    latitude,
    longitude,
    accuracy_m: accuracyM ?? null,
    battery_percent: batteryPercent ?? null,
    broadcasting,
    updated_at: new Date().toISOString(),
  };

  if (lastMovementAt) {
    row.last_movement_at = lastMovementAt;
  }

  console.log("TT_BG_DIRECT_UPSERT_START", {
    eventId,
    userId,
    latitude,
    longitude,
  });

  const { data, error } = await supabase
    .from("live_presence")
    .upsert(row, { onConflict: "event_id,user_id" })
    .select("event_id,user_id,updated_at,last_movement_at")
    .single();

  if (error) {
    console.log("TT_BG_DIRECT_UPSERT_ERROR", error);
    throw error;
  }

  console.log("TT_BG_DIRECT_UPSERT_OK", data);

  return data;
}

export async function getServerTime() {
  const { data, error } = await supabase.rpc("get_server_time");

  if (error) throw error;

  return new Date(data).getTime();
}

function makeInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function normalizeChatMessageRow(row) {
  const user = Array.isArray(row?.users) ? row.users[0] : row?.users;

  return {
    id: row.id,
    eventId: row.event_id,
    senderUserId: row.sender_user_id,
    body: row.body,
    imageUrl: row.image_url || null,
    createdAt: row.created_at,
    deletedAt: row.deleted_at ?? null,
    senderName: user?.name || "Someone",
    senderEmoji: user?.emoji || "🧭",
  };
}

function normalizePrivateThreadRow(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    userAId: row.user_a_id,
    userBId: row.user_b_id,
    createdAt: row.created_at,
    lastMessageAt: row.last_message_at,
  };
}

function normalizeRadarPostRow(row) {
  return {
    id: row.id,
    authorUserId: row.author_user_id,
    eventId: row.event_id,
    body: row.body,
    imageUrl: row.image_url || null,
    latitude: row.latitude,
    longitude: row.longitude,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    distanceMeters:
      typeof row.distance_meters === "number"
        ? Math.round(row.distance_meters)
        : null,
    authorName: row.author_name || "Someone",
    authorEmoji: row.author_emoji || "🧭",
  };
}

export async function pickImageFromLibrary() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.7,
  });

  if (result.canceled) return null;

  return result.assets[0].uri;
}

export async function takePhoto() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();

  if (!permission.granted) {
    throw new Error("Camera permission not granted");
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 0.8,
    base64: true,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  return result.assets[0];
}

export async function getCurrentUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) throw new Error("No signed-in user");

  return user.id;
}

export async function getStoredEventId() {
  return AsyncStorage.getItem(CURRENT_EVENT_ID_KEY);
}

export async function setStoredEventId(eventId) {
  if (!eventId) {
    console.log("setStoredEventId: removing stored event id");
    await AsyncStorage.removeItem(CURRENT_EVENT_ID_KEY);
    return;
  }

  console.log("setStoredEventId: saving", eventId);
  await AsyncStorage.setItem(CURRENT_EVENT_ID_KEY, eventId);

  const check = await AsyncStorage.getItem(CURRENT_EVENT_ID_KEY);
  console.log("setStoredEventId: read back", check);
}

export async function clearStoredEventId() {
  await AsyncStorage.removeItem(CURRENT_EVENT_ID_KEY);
}

export async function createEvent(title) {
  const userId = await getCurrentUserId();

  let event = null;
  let lastError = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const inviteCode = makeInviteCode();

    const { data, error } = await supabase
      .from("events")
      .insert({
        title: title?.trim() || "My Night Out",
        invite_code: inviteCode,
        created_by: userId,
        is_active: true,
      })
      .select()
      .limit(1);

    event = data?.[0];

    if (!error && event) {
      break;
    }

    lastError = error;
  }

  if (!event) {
    throw lastError || new Error("Failed to create event");
  }

  console.log("TT_CREATE_EVENT_MEMBER_INSERT_START", {
    eventId: event.id,
    userId,
  });

  const { error: memberError } = await supabase
    .from("event_members")
    .insert({
      event_id: event.id,
      user_id: userId,
      role: "owner",
      is_sharing: true,
    });

  if (memberError) {
    console.log("TT_CREATE_EVENT_MEMBER_INSERT_FAIL", memberError);
    throw memberError;
  }

  console.log("TT_CREATE_EVENT_MEMBER_INSERT_OK", {
    eventId: event.id,
    userId,
  });

  await setStoredEventId(event.id);
  return event;
}
export async function leaveCurrentEvent(eventId) {
  const userId = await getCurrentUserId();

  await supabase
    .from("live_presence")
    .upsert(
      {
        event_id: eventId,
        user_id: userId,
        broadcasting: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "event_id,user_id" }
    );

  const { error } = await supabase
    .from("event_members")
    .update({ left_at: new Date().toISOString() })
    .eq("event_id", eventId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function renameEvent(eventId, title) {
  if (!eventId) throw new Error("Missing event id");

  const trimmed = (title || "").trim();
  if (!trimmed) throw new Error("Title is empty");

  const { data, error } = await supabase
    .from("events")
    .update({
      title: trimmed,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function joinEventByCode(rawCode) {
  const code = (rawCode || "").trim().toUpperCase();
  console.log("TT_JOIN_EVENT_BY_CODE_RPC_RESULT", event);
  if (!code) {
    throw new Error("Enter an invite code");
  }

  const { data: event, error } = await supabase.rpc("join_event_by_code", {
    _code: code,
  });

  if (error) throw error;
  if (!event?.id) throw new Error("Event not found");

  await setStoredEventId(event.id);
  return event;
}

export async function loadEventBundle(eventId) {
  // console.log("TT_LOAD_BUNDLE_START", { eventId });

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId);

  if (eventError) throw eventError;

  const { data: members, error: membersError } = await supabase
    .from("event_members")
    .select(`
      id,
      event_id,
      user_id,
      role,
      joined_at,
      left_at,
      is_sharing,
      users:user_id (
       id,
       name,
       emoji,
       phone_number,
       emergency_contact_number,
       help_sms_crew,
       help_sms_emergency
      )
    `)
    .eq("event_id", eventId)
    .is("left_at", null);

  if (membersError) throw membersError;

  const { data: presenceRows, error: presenceError } = await supabase
    .from("live_presence")
    .select("*")
    .eq("event_id", eventId);

  if (presenceError) throw presenceError;

  /* console.log("TT_LOAD_BUNDLE_OK", {
     eventId,
     members: (members || []).map((m) => ({
       user_id: m.user_id,
       role: m.role,
     })),
     presenceRows: (presenceRows || []).map((row) => ({
       user_id: row.user_id,
       updated_at: row.updated_at,
       last_movement_at: row.last_movement_at,
       broadcasting: row.broadcasting,
       accuracy_m: row.accuracy_m,
       latitude: row.latitude,
       longitude: row.longitude,
     })),
   });*/

  return {
    event,
    members: members || [],
    presenceRows: presenceRows || [],
  };
}

export function buildCrewFromBundle(bundle, currentUserId, myLocation, nowOverride) {
  const presenceByUserId = new Map();

  for (const row of bundle.presenceRows || []) {
    presenceByUserId.set(row.user_id, row);
  }

  const now = nowOverride ?? Date.now();

  function formatSmartDistance(meters, myAccuracyM, friendAccuracyM) {
    if (meters == null) return "Unknown";

    const myAcc = typeof myAccuracyM === "number" ? myAccuracyM : null;
    const friendAcc = typeof friendAccuracyM === "number" ? friendAccuracyM : null;

    const worstAccuracy =
      myAcc != null && friendAcc != null
        ? Math.max(myAcc, friendAcc)
        : myAcc != null
          ? myAcc
          : friendAcc;

    if (worstAccuracy != null && worstAccuracy >= 60) {
      return "Location weak";
    }

    if (worstAccuracy != null && worstAccuracy >= 35) {
      if (meters <= 30) return "Nearby";
      if (meters <= 80) return "Close";
      if (meters < 1000) return `~${Math.round(meters / 5) * 5}m away`;
      return `~${(meters / 1000).toFixed(1)}km away`;
    }

    if (worstAccuracy != null && worstAccuracy >= 20) {
      if (meters <= 12) return "Very close";
      if (meters <= 30) return "Nearby";
      if (meters < 1000) return `~${Math.round(meters / 5) * 5}m away`;
      return `~${(meters / 1000).toFixed(1)}km away`;
    }

    if (meters <= 8) return "Very close";
    if (meters <= 20) return "Nearby";
    if (meters < 1000) return `${Math.round(meters)}m away`;
    return `${(meters / 1000).toFixed(1)}km away`;
  }

  return (bundle.members || []).map((member) => {
    const isMe = member.user_id === currentUserId;
    const profile = Array.isArray(member.users)
      ? member.users[0]
      : member.users || {};

    const presence = presenceByUserId.get(member.user_id);

    const updatedMs = presence?.updated_at
      ? new Date(presence.updated_at).getTime()
      : null;

    const minsAgo =
      updatedMs != null
        ? Math.max(0, Math.floor((now - updatedMs) / 60000))
        : null;

    const battery = presence?.battery_percent ?? 0;
    const friendAccuracyM =
      typeof presence?.accuracy_m === "number"
        ? presence.accuracy_m
        : typeof presence?.accuracyM === "number"
          ? presence.accuracyM
          : null;

    let state = "offline";
    let status = "Location unavailable";
    let lastSeen = "No live location yet";

    if (presence?.broadcasting && updatedMs != null) {

      // 🟢 GREEN — trust it, go find them
      if (minsAgo <= 45) {
        state = "ok";

        status = "Findable";

        if (minsAgo <= 1) {
          if (friendAccuracyM != null && friendAccuracyM >= 60) {
            lastSeen = "Live now • weak GPS";
          } else if (friendAccuracyM != null && friendAccuracyM >= 25) {
            lastSeen = "Live now • rough location";
          } else {
            lastSeen = "Live now";
          }
        } else {
          lastSeen = `Last update ${minsAgo} min${minsAgo === 1 ? "" : "s"} ago`;
        }

        // 🟡 YELLOW — caution, but still possibly useful
      } else if (minsAgo <= 60) {
        state = "stale";
        status = "Possibly findable";
        lastSeen = `Last known location • ${minsAgo} min${minsAgo === 1 ? "" : "s"} ago`;

        // 🔴 RED — don’t trust it
      } else {
        state = "offline";
        status = "Location not reliable";
        lastSeen = `Try messaging or calling • ${minsAgo} min${minsAgo === 1 ? "" : "s"} ago`;
      }
    }

    const latitude = presence?.latitude ?? null;
    const longitude = presence?.longitude ?? null;

    let distance = "Unknown";

    if (isMe) {
      distance = "You";
    } else if (
      myLocation &&
      latitude != null &&
      longitude != null
    ) {
      const meters = getDistanceMeters(myLocation, {
        latitude,
        longitude,
      });

      const myAccuracyM =
        typeof myLocation?.accuracyM === "number"
          ? myLocation.accuracyM
          : typeof myLocation?.accuracy_m === "number"
            ? myLocation.accuracy_m
            : null;

      distance = formatSmartDistance(meters, myAccuracyM, friendAccuracyM);
    }

    let movementText = "No movement data yet";

    const lastMovedMs = presence?.last_movement_at
      ? new Date(presence.last_movement_at).getTime()
      : null;

    if (lastMovedMs != null) {
      const minsSinceMove = Math.max(0, Math.floor((now - lastMovedMs) / 60000));

      if (minsSinceMove <= 1) {
        movementText = "Moving now";
      } else {
        movementText = `Still for ${minsSinceMove} min${minsSinceMove === 1 ? "" : "s"}`;
      }
    }

    /* console.log("TT_BUILD_CREW_MEMBER", {
       memberUserId: member.user_id,
       memberName: profile.name || "Unnamed",
       hasPresence: !!presence,
       updated_at: presence?.updated_at ?? null,
       last_movement_at: presence?.last_movement_at ?? null,
       broadcasting: presence?.broadcasting ?? null,
       latitude: presence?.latitude ?? null,
       longitude: presence?.longitude ?? null,
       minsAgo,
       movementText,
       state,
       status,
       lastSeen,
     });*/

    return {
      id: member.user_id,
      name: profile.name || "Unnamed",
      emoji: profile.emoji || "🧭",
      phoneNumber: profile.phone_number || "",
      emergencyContactNumber: profile.emergency_contact_number || "",
      helpSmsCrew: !!profile.help_sms_crew,
      helpSmsEmergency: !!profile.help_sms_emergency,
      isMe,
      status,
      lastSeen,
      movementText,
      battery,
      distance,
      state,
      latitude,
      longitude,
      accuracyM: friendAccuracyM,
      broadcasting: !!presence?.broadcasting,
      role: member.role,
    };
  });
}

export async function uploadChatImage(photoAsset, path) {
  try {
    if (!photoAsset) {
      throw new Error("Missing photo asset");
    }

    if (!photoAsset.base64) {
      throw new Error("Photo base64 missing");
    }

    const { error } = await supabase.storage
      .from("chat-images")
      .upload(path, decode(photoAsset.base64), {
        contentType: photoAsset.mimeType || "image/jpeg",
        upsert: false,
      });

    if (error) throw error;

    const { data } = supabase.storage
      .from("chat-images")
      .getPublicUrl(path);

    return data.publicUrl;
  } catch (e) {
    console.log("uploadChatImage error:", e);
    throw e;
  }
}

export async function upsertMyPresence({
  eventId,
  latitude,
  longitude,
  accuracyM,
  batteryPercent,
  broadcasting = true,
  lastMovementAt = null,
}) {
  const userId = await getCurrentUserId();

  const row = {
    event_id: eventId,
    user_id: userId,
    latitude,
    longitude,
    accuracy_m: accuracyM ?? null,
    battery_percent: batteryPercent ?? null,
    broadcasting,
    updated_at: new Date().toISOString(),
  };

  if (lastMovementAt) {
    row.last_movement_at = lastMovementAt;
  }

  const { error } = await supabase
    .from("live_presence")
    .upsert(row, { onConflict: "event_id,user_id" });

  if (error) throw error;
}



export function subscribeToEvent(eventId, handlers = {}) {
  const onAnyChange =
    typeof handlers === "function" ? handlers : null;

  const onPresenceChange =
    typeof handlers?.onPresenceChange === "function"
      ? handlers.onPresenceChange
      : onAnyChange;

  const onMembersChange =
    typeof handlers?.onMembersChange === "function"
      ? handlers.onMembersChange
      : onAnyChange;

  const channel = supabase
    .channel(`event-${eventId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "live_presence",
        filter: `event_id=eq.${eventId}`,
      },
      (payload) => {
        onPresenceChange?.(payload);
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "event_members",
        filter: `event_id=eq.${eventId}`,
      },
      (payload) => {
        onMembersChange?.(payload);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function sendYouOkCheckIn(eventId, toUserId) {
  const fromUserId = await getCurrentUserId();

  const { error } = await supabase.from("check_ins").insert({
    event_id: eventId,
    from_user_id: fromUserId,
    to_user_id: toUserId,
    kind: "you_ok",
    status: "pending",
  });

  if (error) throw error;
}

export async function sendYouOkReply(eventId, toUserId, replyKind) {
  const fromUserId = await getCurrentUserId();

  if (!eventId) throw new Error("Missing event id");
  if (!toUserId) throw new Error("Missing reply target");

  const allowedKinds = ["you_ok_reply_ok", "you_ok_reply_help"];
  if (!allowedKinds.includes(replyKind)) {
    throw new Error("Invalid reply kind");
  }

  const { error } = await supabase.from("check_ins").insert({
    event_id: eventId,
    from_user_id: fromUserId,
    to_user_id: toUserId,
    kind: replyKind,
    status: "acknowledged",
  });

  if (error) throw error;
}

export async function sendNeedHelpAlert(eventId) {
  const fromUserId = await getCurrentUserId();

  if (!eventId) throw new Error("Missing event id");

  const { data: members, error: membersError } = await supabase
    .from("event_members")
    .select("user_id")
    .eq("event_id", eventId)
    .is("left_at", null);

  if (membersError) throw membersError;

  const targets = (members || [])
    .map((m) => m.user_id)
    .filter((id) => id && id !== fromUserId);

  if (targets.length === 0) return;

  const rows = targets.map((toUserId) => ({
    event_id: eventId,
    from_user_id: fromUserId,
    to_user_id: toUserId,
    kind: "you_ok_reply_help",
    status: "acknowledged",
  }));

  const { error } = await supabase.from("check_ins").insert(rows);

  if (error) throw error;
}

export async function updateMyProfile({
  name,
  emoji,
  phoneNumber = "",
  emergencyContactNumber = "",
  helpSmsCrew = false,
  helpSmsEmergency = false,
}) {
  const userId = await getCurrentUserId();

  const cleanPhoneNumber = (phoneNumber || "").trim();
  const cleanEmergencyContactNumber = (emergencyContactNumber || "").trim();

  const { data, error } = await supabase
    .from("users")
    .update({
      name: name?.trim() || "Unnamed",
      emoji: emoji || "🧭",
      phone_number: cleanPhoneNumber || null,
      emergency_contact_number: cleanEmergencyContactNumber || null,
      help_sms_crew: !!helpSmsCrew,
      help_sms_emergency: !!helpSmsEmergency,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select();

  if (error) throw error;
  return data;
}

export async function saveMyExpoPushToken(expoPushToken) {
  const userId = await getCurrentUserId();

  if (!expoPushToken) return;

  const { error } = await supabase
    .from("users")
    .update({
      expo_push_token: expoPushToken,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) throw error;
}

export async function triggerNeedHelpPush({
  eventId,
  name,
  batteryPercent,
  latitude,
  longitude,
  timestamp,
  fromUserId,
}) {
  if (!eventId) throw new Error("Missing event id");

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) throw sessionError;
  if (!session?.access_token) {
    throw new Error("No active session token");
  }

  const { data, error } = await supabase.functions.invoke("send-need-help-push", {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: {
      eventId,
      name,
      batteryPercent,
      latitude,
      longitude,
      timestamp,
      fromUserId,
    },
  });

  console.log(
    "triggerNeedHelpPush response full:",
    JSON.stringify({ data, error }, null, 2)
  );

  if (error) {
    throw new Error(error.message || "Push function failed");
  }

  return data;
}

export async function triggerYouOkPush({
  eventId,
  toUserId,
  fromUserId,
  name,
}) {
  if (!eventId) throw new Error("Missing event id");
  if (!toUserId) throw new Error("Missing target user id");
  if (!fromUserId) throw new Error("Missing sender user id");

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) throw sessionError;
  if (!session?.access_token) {
    throw new Error("No active session token");
  }

  const { data, error } = await supabase.functions.invoke("send-you-ok-push", {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: {
      eventId,
      toUserId,
      fromUserId,
      name,
    },
  });

  if (error) {
    throw new Error(error.message || "You OK push function failed");
  }

  return data;
} // ✅ CLOSE FUNCTION


export async function triggerYouOkReplyPush({
  eventId,
  toUserId,
  fromUserId,
  name,
  replyKind,
}) {
  if (!eventId) throw new Error("Missing event id");
  if (!toUserId) throw new Error("Missing target user id");
  if (!fromUserId) throw new Error("Missing sender user id");
  if (!replyKind) throw new Error("Missing reply kind");

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) throw sessionError;
  if (!session?.access_token) {
    throw new Error("No active session token");
  }

  const { data, error } = await supabase.functions.invoke(
    "send-you-ok-reply-push",
    {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: {
        eventId,
        toUserId,
        fromUserId,
        name,
        replyKind,
      },
    }
  );

  if (error) {
    throw new Error(error.message || "You OK reply push failed");
  }

  return data;
}

export async function updateEventPinImage(pinId, imageUrl) {
  const { data, error } = await supabase
    .from("event_pins")
    .update({
      image_url: imageUrl,
    })
    .eq("id", pinId)
    .select(`
      id,
      image_url
    `);

  if (error) {
    console.log("updateEventPinImage error:", error);
    throw error;
  }

  const row = data?.[0];

  if (!row) {
    throw new Error("Pin image update did not persist");
  }

  return {
    id: row.id,
    imageUrl: row.image_url || null,
  };
}

export async function uploadPinImage(photoAsset, path) {
  try {
    if (!photoAsset) {
      throw new Error("Missing photo asset");
    }

    if (!photoAsset.base64) {
      throw new Error("Photo base64 missing");
    }

    const { error } = await supabase.storage
      .from("chat-images")
      .upload(path, decode(photoAsset.base64), {
        contentType: photoAsset.mimeType || "image/jpeg",
        upsert: false,
      });

    if (error) throw error;

    const { data } = supabase.storage
      .from("chat-images")
      .getPublicUrl(path);

    return data.publicUrl;
  } catch (e) {
    console.log("uploadPinImage error:", e);
    throw e;
  }
}

export async function listEventPins(eventId) {
  if (!eventId) return [];

  const { data, error } = await supabase
    .from("event_pins")
    .select(`
      id,
      event_id,
      created_by,
      pin_type,
      label,
      latitude,
      longitude,
      meetup_at,
      image_url,
      created_at
    `)
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    eventId: row.event_id,
    createdBy: row.created_by,
    type: row.pin_type,
    label: row.label,
    imageUrl: row.image_url || null,
    coordinate: {
      latitude: row.latitude,
      longitude: row.longitude,
    },
    meetupAt: row.meetup_at,
    createdAt: row.created_at,
  }));
}

export async function createEventPin({
  eventId,
  type,
  label,
  latitude,
  longitude,
  meetupAt = null,
  imageUrl = null,
}) {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("event_pins")
    .insert({
      event_id: eventId,
      created_by: userId,
      pin_type: type,
      label,
      latitude,
      longitude,
      meetup_at: meetupAt,
      image_url: imageUrl,
    })
    .select(`
      id,
      event_id,
      created_by,
      pin_type,
      label,
      image_url,
      latitude,
      longitude,
      meetup_at,
      created_at
    `)
    .single();

  if (error) throw error;

  return {
    id: data.id,
    eventId: data.event_id,
    createdBy: data.created_by,
    type: data.pin_type,
    label: data.label,
    imageUrl: data.image_url || null,
    coordinate: {
      latitude: data.latitude,
      longitude: data.longitude,
    },
    meetupAt: data.meetup_at,
    createdAt: data.created_at,
  };
}
export async function updateEventPinLabel(pinId, label) {
  const trimmed = (label || "").trim();

  if (!pinId) throw new Error("Missing pin id");
  if (!trimmed) throw new Error("Pin name is empty");

  const { data, error } = await supabase
    .from("event_pins")
    .update({ label: trimmed })
    .eq("id", pinId)
    .select(`
      id,
      label
    `)
    .single();

  if (error) throw error;

  return {
    id: data.id,
    label: data.label,
  };
}

export async function deleteEventPin(pinId) {
  if (!pinId) return;

  const { error } = await supabase
    .from("event_pins")
    .delete()
    .eq("id", pinId);

  if (error) throw error;
}

export function subscribeToEventPins(eventId, onPinsChanged) {
  const channel = supabase
    .channel(`event-pins-${eventId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "event_pins",
        filter: `event_id=eq.${eventId}`,
      },
      () => {
        onPinsChanged?.();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/* =========================
   CREW CHAT
========================= */

export async function listEventMessages(
  eventId,
  limit = 50,
  beforeCreatedAt = null
) {
  if (!eventId) return [];

  let query = supabase
    .from("event_messages")
    .select(`
      id,
      event_id,
      sender_user_id,
      body,
      image_url,
      created_at,
      deleted_at,
      users:sender_user_id (
        name,
        emoji
      )
    `)
    .eq("event_id", eventId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (beforeCreatedAt) {
    query = query.lt("created_at", beforeCreatedAt);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map(normalizeChatMessageRow);
}

export async function sendEventMessage(eventId, body) {
  const senderUserId = await getCurrentUserId();
  const trimmedBody = (body || "").trim();

  if (!eventId) throw new Error("Missing event id");
  if (!trimmedBody) throw new Error("Message is empty");

  const { data, error } = await supabase
    .from("event_messages")
    .insert({
      event_id: eventId,
      sender_user_id: senderUserId,
      body: trimmedBody,
    })
    .select(`
      id,
      event_id,
      sender_user_id,
      body,
      created_at,
      deleted_at,
      users:sender_user_id (
        name,
        emoji
      )
    `)
    .single();

  if (error) throw error;

  return normalizeChatMessageRow(data);
}

export async function sendEventPhotoMessage(eventId, body, imageUrl) {
  const senderUserId = await getCurrentUserId();
  const trimmedBody = (body || "").trim();

  if (!eventId) throw new Error("Missing event id");
  if (!trimmedBody && !imageUrl) throw new Error("Message is empty");

  const { data, error } = await supabase
    .from("event_messages")
    .insert({
      event_id: eventId,
      sender_user_id: senderUserId,
      body: trimmedBody || "📷 Photo",
      image_url: imageUrl || null,
    })
    .select(`
      id,
      event_id,
      sender_user_id,
      body,
      image_url,
      created_at,
      deleted_at,
      users:sender_user_id (
        name,
        emoji
      )
    `)
    .single();

  if (error) throw error;

  return normalizeChatMessageRow(data);
}

export function subscribeToEventMessages(eventId, onInsert) {
  const channel = supabase
    .channel(`event-messages-${eventId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "event_messages",
        filter: `event_id=eq.${eventId}`,
      },
      async (payload) => {
        try {
          const row = payload?.new;
          if (!row?.id) return;

          const { data, error } = await supabase
            .from("event_messages")
            .select(`
              id,
              event_id,
              sender_user_id,
              body,
              image_url,
              created_at,
              deleted_at,
              users:sender_user_id (
                name,
                emoji
              )
            `)
            .eq("id", row.id)
            .single();

          if (error) throw error;

          onInsert?.(normalizeChatMessageRow(data));
        } catch (error) {
          console.log("subscribeToEventMessages error:", error);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToGroupUnreadMessages(eventId, onInsert) {
  const channel = supabase
    .channel(
      `event-messages-unread-${eventId}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "event_messages",
        filter: `event_id=eq.${eventId}`,
      },
      (payload) => {
        try {
          const row = payload?.new;
          if (!row?.id) return;

          onInsert?.({
            id: row.id,
            eventId: row.event_id,
            senderUserId: row.sender_user_id,
            body: row.body,
            imageUrl: row.image_url || null,
            createdAt: row.created_at,
            deletedAt: row.deleted_at ?? null,
            senderName: "Someone",
            senderEmoji: "🧭",
          });
        } catch (error) {
          console.log("subscribeToGroupUnreadMessages error:", error);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/* =========================
   PRIVATE CHAT
========================= */

export async function getOrCreatePrivateThread(eventId, otherUserId) {
  if (!eventId) throw new Error("Missing event id");
  if (!otherUserId) throw new Error("Missing other user id");

  const { data, error } = await supabase.rpc("get_or_create_private_thread", {
    p_event_id: eventId,
    p_other_user_id: otherUserId,
  });

  if (error) throw error;

  return normalizePrivateThreadRow(data);
}

export async function listPrivateMessages(
  threadId,
  limit = 50,
  beforeCreatedAt = null
) {
  if (!threadId) return [];

  let query = supabase
    .from("event_private_messages")
    .select(`
      id,
      thread_id,
      event_id,
      sender_user_id,
      body,
      image_url,
      created_at,
      deleted_at,
      users:sender_user_id (
        name,
        emoji
      )
    `)
    .eq("thread_id", threadId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (beforeCreatedAt) {
    query = query.lt("created_at", beforeCreatedAt);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map((row) =>
    normalizeChatMessageRow({
      ...row,
      event_id: row.event_id,
    })
  );
}

export async function sendPrivateMessage(threadId, eventId, body) {
  const senderUserId = await getCurrentUserId();
  const trimmedBody = (body || "").trim();

  if (!threadId) throw new Error("Missing thread id");
  if (!eventId) throw new Error("Missing event id");
  if (!trimmedBody) throw new Error("Message is empty");

  const { data, error } = await supabase
    .from("event_private_messages")
    .insert({
      thread_id: threadId,
      event_id: eventId,
      sender_user_id: senderUserId,
      body: trimmedBody,
    })
    .select(`
      id,
      thread_id,
      event_id,
      sender_user_id,
      body,
      created_at,
      deleted_at,
      users:sender_user_id (
        name,
        emoji
      )
    `)
    .single();

  if (error) throw error;

  return normalizeChatMessageRow({
    ...data,
    event_id: data.event_id,
  });
}

export async function sendPrivatePhotoMessage(threadId, eventId, body, imageUrl) {
  const senderUserId = await getCurrentUserId();
  const trimmedBody = (body || "").trim();

  if (!threadId) throw new Error("Missing thread id");
  if (!eventId) throw new Error("Missing event id");
  if (!trimmedBody && !imageUrl) throw new Error("Message is empty");

  const { data, error } = await supabase
    .from("event_private_messages")
    .insert({
      thread_id: threadId,
      event_id: eventId,
      sender_user_id: senderUserId,
      body: trimmedBody || "📷 Photo",
      image_url: imageUrl || null,
    })
    .select(`
      id,
      thread_id,
      event_id,
      sender_user_id,
      body,
      image_url,
      created_at,
      deleted_at,
      users:sender_user_id (
        name,
        emoji
      )
    `)
    .single();

  if (error) throw error;

  return normalizeChatMessageRow({
    ...data,
    event_id: data.event_id,
  });
}

export function subscribeToPrivateMessages(threadId, onInsert) {
  const channel = supabase
    .channel(`private-messages-${threadId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "event_private_messages",
        filter: `thread_id=eq.${threadId}`,
      },
      async (payload) => {
        try {
          const row = payload?.new;
          if (!row?.id) return;

          const { data, error } = await supabase
            .from("event_private_messages")
            .select(`
              id,
              thread_id,
              event_id,
              sender_user_id,
              body,
              image_url,
              created_at,
              deleted_at,
              users:sender_user_id (
                name,
                emoji
              )
            `)
            .eq("id", row.id)
            .single();

          if (error) throw error;

          onInsert?.(
            normalizeChatMessageRow({
              ...data,
              event_id: data.event_id,
            })
          );
        } catch (error) {
          console.log("subscribeToPrivateMessages error:", error);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/* =========================
   RADAR
========================= */

export async function listRadarPostsNearby({
  latitude,
  longitude,
  radiusMeters = 1000,
  limit = 50,
}) {
  if (
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    typeof longitude !== "number" ||
    !Number.isFinite(longitude)
  ) {
    return [];
  }

  const { data, error } = await supabase.rpc("get_radar_posts_nearby", {
    p_lat: latitude,
    p_lng: longitude,
    p_radius_meters: radiusMeters,
    p_limit: limit,
  });

  if (error) throw error;

  return (data || []).map(normalizeRadarPostRow);
}

export async function createRadarPost({
  eventId,
  body,
  latitude,
  longitude,
  imageUrl = null,
}) {
  const authorUserId = await getCurrentUserId();
  const trimmedBody = (body || "").trim();

  if (!eventId) throw new Error("Missing event id");
  if (!trimmedBody) throw new Error("Post is empty");
  if (
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    typeof longitude !== "number" ||
    !Number.isFinite(longitude)
  ) {
    throw new Error("Missing post location");
  }

  const { data, error } = await supabase
    .from("radar_posts")
    .insert({
      author_user_id: authorUserId,
      event_id: eventId,
      body: trimmedBody,
      image_url: imageUrl,
      latitude,
      longitude,
    })
    .select(`
      id,
      author_user_id,
      event_id,
      body,
      image_url,
      latitude,
      longitude,
      created_at,
      expires_at
    `)
    .single();

  if (error) throw error;

  return {
    id: data.id,
    authorUserId: data.author_user_id,
    eventId: data.event_id,
    body: data.body,
    imageUrl: data.image_url || null,
    latitude: data.latitude,
    longitude: data.longitude,
    createdAt: data.created_at,
    expiresAt: data.expires_at,
  };
}

export async function deleteRadarPost(postId) {
  if (!postId) return;

  const { error } = await supabase
    .from("radar_posts")
    .delete()
    .eq("id", postId);

  if (error) throw error;
}

export async function signOutEverywhere() {
  await clearStoredEventId();
  await supabase.auth.signOut();
}

function getDistanceMeters(from, to) {
  if (!from || !to) return null;

  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(to.latitude - from.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) *
    Math.cos(lat2) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(earthRadius * c);
}