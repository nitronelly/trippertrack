import React, { useEffect, useMemo, useRef, useState } from "react";
import * as Battery from "expo-battery";
import * as Location from "expo-location";
import MapView, { Marker, Polyline, AnimatedRegion } from "react-native-maps";
import * as Haptics from "expo-haptics";
import { supabase } from "../lib/supabase";
import AuthScreen from "../AuthScreen";
import { Accelerometer } from "expo-sensors";
import QRCode from "react-native-qrcode-svg";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as SMS from "expo-sms";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import * as Clipboard from "expo-clipboard";
import { startTripperTrackLocation, stopTripperTrackLocation } from "../lib/tripperTrackLocation";
import RadarScreen from "../components/RadarScreen";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  CURRENT_USER_ID_KEY,
  buildCrewFromBundle,
  clearStoredEventId,
  createEvent,
  createEventPin,
  deleteEventPin,
  updateEventPinLabel,
  getCurrentUserId,
  getStoredEventId,
  getServerTime,
  joinEventByCode,
  listEventMessages,
  listEventPins,
  loadEventBundle,
  renameEvent,
  sendEventMessage,
  sendEventPhotoMessage,
  sendNeedHelpAlert,
  sendYouOkCheckIn,
  sendYouOkReply,
  setStoredEventId,
  signOutEverywhere,
  subscribeToEvent,
  subscribeToEventMessages,
  subscribeToEventPins,
  updateMyProfile,
  upsertMyPresence,
  saveMyExpoPushToken,
  triggerNeedHelpPush,
  triggerYouOkPush,
  triggerYouOkReplyPush,
  getOrCreatePrivateThread,
  listPrivateMessages,
  sendPrivateMessage,
  sendPrivatePhotoMessage,
  subscribeToPrivateMessages,
  takePhoto,
  uploadChatImage,
  uploadPinImage,
  updateEventPinImage,
  leaveCurrentEvent,


} from "../lib/tripperBackend";

import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  Image,
  AppState,
  PanResponder,
  Alert,
  Share,

} from "react-native";


const COLORS = {
  bg: "#000000",
  card: "#0b0e13",
  card2: "#132238",
  border: "#242C3A",
  text: "#F4F7FB",
  sub: "#97A3B6",
  green: "#39D98A",
  amber: "#F5A623",
  red: "#FF5C6C",
  purple: "#7C5CFF",
  blue: "#3FA7FF",
  yellow: "#D9A61C",
  pinTent: "#2F9E44",
  pinCar: "#3FA7FF",
  pinMeet: "#D9A61C",
};



function getBatteryColor(battery) {
  if (battery == null) return "#999"; // unknown

  if (battery <= 10) return "#ff3b30";     // red
  if (battery <= 30) return "#ff9500";     // orange
  return "#34c759";                        // green
}


function getStatusColor(state) {
  switch (state) {
    case "ok":
    case "online":
      return COLORS.green;

    case "low":
    case "stale":
      return COLORS.amber;

    case "critical":
    case "offline":
      return COLORS.red;

    default:
      return COLORS.sub;
  }
}

function getPinColor(type) {
  switch (type) {
    case "tent":
      return "#4CAF50"; // green
    case "car":
      return "#2196F3"; // blue
    case "bar":
      return "#FF9800"; // orange
    case "stage":
      return "#E91E63"; // pink
    case "entrance":
      return "#00BCD4"; // cyan
    case "food":
      return "#8BC34A"; // lime
    case "custom":
      return "#9C27B0"; // purple
    default:
      return "#FFC107"; // yellow fallback
  }
}
function getPinEmoji(type) {
  switch (type) {
    case "tent":
      return "⛺";
    case "car":
      return "🚗";
    case "bar":
      return "🍺";
    case "stage":
      return "🎵";
    case "entrance":
      return "🚪";
    case "food":
      return "🍔";
    case "meetup":
      return "⏰";
    case "custom":
      return "📍";
    default:
      return "📍";
    case "comeFindMe":
      return "📡";
    case "radar":
      return "📡";
  }
}

function initials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
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

const MyLocationMarker = React.memo(function MyLocationMarker({
  coordinate,
  emoji,
  isSelected,
  isNavigating,
  heading,
  showGlow,
  onPress,
  tracksViewChanges,
  navColor = COLORS.blue,
}) {
  return (
    <Marker.Animated
      coordinate={coordinate}
      tracksViewChanges={tracksViewChanges}
      anchor={{ x: 0.5, y: 0.5 }}
      flat={false}
      onPress={onPress}
    >
      <View style={styles.myMarkerWrap} collapsable={false}>
        {showGlow && <View style={styles.myMarkerGlow} />}



        <View
          style={[
            styles.myMarkerEmojiWrap,
            isSelected && styles.myMarkerEmojiWrapSelected,
          ]}
        >
          <Text style={styles.myMarkerEmoji}>
            {emoji || "🧑"}
          </Text>
        </View>
      </View>
    </Marker.Animated>
  );
});

const EmojiMapMarker = React.memo(function EmojiMapMarker({
  markerId,
  coordinate,
  emoji,
  onPress,
  size = 24,
  isSelected = false,
}) {
  const [tracksViewChanges, setTracksViewChanges] = React.useState(true);

  useEffect(() => {
    setTracksViewChanges(true);

    const timer = setTimeout(() => {
      setTracksViewChanges(false);
    }, 350);

    return () => clearTimeout(timer);
  }, [markerId, emoji, isSelected]);

  return (
    <Marker
      identifier={markerId}
      coordinate={coordinate}
      tracksViewChanges={true}
      onPress={onPress}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View style={styles.markerOuter} collapsable={false}>
        <View
          style={[
            styles.emojiPinWrap,
            isSelected && styles.emojiPinWrapSelected,
          ]}
          collapsable={false}
        >
          <Text
            style={[
              styles.emojiOnly,
              { fontSize: size, lineHeight: size + 8 },
            ]}
          >
            {emoji || "🧭"}
          </Text>
        </View>
      </View>
    </Marker>
  );
});

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});


function CrewCard({ item, onPress, onFind, onYouOk }) {
  return (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {item.emoji || initials(item.name)}
        </Text>
      </View>

      <View style={styles.cardMain}>
        <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
          <View style={styles.cardTopRow}>
            <Text style={styles.name}>{item.name}</Text>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: getStatusColor(item.state) },
              ]}
            />
          </View>

          <Text
            style={[
              styles.statusText,
              { color: getStatusColor(item.state) },
            ]}
          >
            {item.status}
          </Text>

          <Text style={styles.lastSeen}>{item.lastSeen}</Text>

          <View style={styles.metaRow}>
            <Text style={[styles.metaText, { color: getBatteryColor(item.battery) }]}>
              🔋 {item.battery}%
            </Text>
            <Text style={styles.metaDivider}>•</Text>
            <Text style={styles.metaText}>{item.distance}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.cardButtonsRow}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.smallButton, styles.smallPurple]}
            onPress={() => onYouOk(item)}
          >
            <Text style={styles.smallButtonText}>You OK?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.smallButton, styles.smallGreen]}
            onPress={onFind}
          >
            <Text style={styles.smallButtonText}>Find</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function PrivateChatScreen({
  eventId,
  currentUserId,
  crew,
  selectedUserId,
  onSelectUser,
  dmUnreadByUserId,
  onOpenThread,
}) {
  const [pendingPhotoAsset, setPendingPhotoAsset] = useState(null);
  const privateUsers = useMemo(
    () => crew.filter((person) => !person.isMe),
    [crew]
  );

  const selectedUser = useMemo(() => {
    if (!privateUsers.length) return null;

    return (
      privateUsers.find((person) => person.id === selectedUserId) ||
      privateUsers[0]
    );
  }, [privateUsers, selectedUserId]);

  const [threadId, setThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);


  useEffect(() => {
    if (!selectedUser && privateUsers.length > 0) {
      onSelectUser?.(privateUsers[0].id);
    }
  }, [selectedUser, privateUsers, onSelectUser]);

  useEffect(() => {
    let isMounted = true;

    async function boot() {
      if (!eventId || !selectedUser?.id) {
        setThreadId(null);
        setMessages([]);
        return;
      }

      try {
        setLoading(true);

        const thread = await getOrCreatePrivateThread(eventId, selectedUser.id);
        if (!isMounted) return;

        setThreadId(thread.id);

        const rows = await listPrivateMessages(thread.id, 50);
        if (!isMounted) return;

        setMessages([...rows].reverse());
        onOpenThread?.(selectedUser.id);
      } catch (error) {
        console.log("PrivateChatScreen boot error:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    boot();

    return () => {
      isMounted = false;
    };
  }, [eventId, selectedUser?.id, onOpenThread]);

  useEffect(() => {
    if (!threadId) return;

    const unsubscribe = subscribeToPrivateMessages(threadId, (incoming) => {
      if (!incoming?.id) return;

      setMessages((prev) => {
        const existingIndex = prev.findIndex((item) => item.id === incoming.id);

        if (existingIndex >= 0) {
          const next = [...prev];

          next[existingIndex] = {
            ...next[existingIndex],
            ...incoming,
            // 🔥 THIS LINE IS THE FIX
            localImageUri:
              next[existingIndex].localImageUri || incoming.localImageUri || null,
          };

          return next;
        }

        return [...prev, incoming];
      });

      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd?.({ animated: true });
      });
    });

    return unsubscribe;
  }, [threadId]);

  async function handleSend() {
    const trimmed = draft.trim();
    if (!trimmed || !threadId || !eventId || sending) return;

    try {
      setSending(true);
      setDraft("");

      const created = await sendPrivateMessage(threadId, eventId, trimmed);

      setMessages((prev) => {
        if (prev.some((item) => item.id === created.id)) {
          return prev;
        }
        return [...prev, created];
      });

      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd?.({ animated: true });
      });
    } catch (error) {
      setDraft(trimmed);
      alert(error?.message || "Failed to send private message");
    } finally {
      setSending(false);
    }
  }


  async function handleOpenCamera() {
    if ((!selectedUser && typeof selectedUser !== "undefined") || sending) return;

    try {
      const asset = await takePhoto();
      if (!asset) return;

      setPendingPhotoAsset(asset);
    } catch (error) {
      alert(error?.message || "Could not open camera");
    }
  }

  async function handleSendPhoto() {
    if (!pendingPhotoAsset || !threadId || !eventId || sending) return;

    const photoAsset = pendingPhotoAsset;
    const photoUri = photoAsset.uri;
    const trimmed = draft.trim();
    const fallbackBody = trimmed ? `${trimmed}\n📷 Photo` : "📷 Photo";

    try {
      setSending(true);
      setDraft("");
      setPendingPhotoAsset(null);

      const filePath = `private/${threadId}/${Date.now()}.jpg`;
      const imageUrl = await uploadChatImage(photoAsset, filePath);

      const created = await sendPrivatePhotoMessage(
        threadId,
        eventId,
        fallbackBody,
        imageUrl
      );

      const createdWithLocalPhoto = {
        ...created,
        localImageUri: photoUri,
      };

      setMessages((prev) => {
        const existingIndex = prev.findIndex(
          (item) => item.id === createdWithLocalPhoto.id
        );

        if (existingIndex >= 0) {
          const next = [...prev];
          next[existingIndex] = {
            ...next[existingIndex],
            ...createdWithLocalPhoto,
            localImageUri:
              createdWithLocalPhoto.localImageUri ||
              next[existingIndex].localImageUri ||
              null,
          };
          return next;
        }

        return [...prev, createdWithLocalPhoto];
      });

      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd?.({ animated: true });
      });
    } catch (error) {
      setDraft(trimmed);
      setPendingPhotoAsset(photoAsset);
      alert(error?.message || "Failed to send photo");
    } finally {
      setSending(false);
    }
  }

  function formatMessageTime(dateString) {
    if (!dateString) return "";
    return new Date(dateString).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return (
    <KeyboardAvoidingView
      style={styles.chatScreenWrap}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={80}
    >
      <View style={{ flex: 1 }}>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.privateUserTabsRow}
          style={styles.privateUserTabsWrap}
          keyboardShouldPersistTaps="handled"
        >
          {privateUsers.map((person) => {
            const isSelected = selectedUser?.id === person.id;
            const unreadCount = dmUnreadByUserId?.[person.id] || 0;

            return (
              <TouchableOpacity
                key={person.id}
                activeOpacity={0.9}
                style={[
                  styles.privateUserChip,
                  isSelected && styles.privateUserChipSelected,
                ]}
                onPress={() => {
                  onSelectUser?.(person.id);
                  onOpenThread?.(person.id);
                }}
              >
                <Text style={styles.privateUserChipEmoji}>
                  {person.emoji || "🧭"}
                </Text>

                <Text
                  style={[
                    styles.privateUserChipText,
                    isSelected && styles.privateUserChipTextSelected,
                  ]}
                >
                  {person.name}
                </Text>

                {unreadCount > 0 && !isSelected ? (
                  <View style={styles.privateUnreadBadge}>
                    <Text style={styles.privateUnreadBadgeText}>
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.privateChatHeader}>
          <Text style={styles.privateChatTitle}>
            {selectedUser
              ? `${selectedUser.emoji || "🧭"} ${selectedUser.name}`
              : "Select someone"}
          </Text>
        </View>

        <FlatList
          ref={listRef}
          style={{ flex: 1 }}
          data={messages}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.chatListContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          removeClippedSubviews={false}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd?.({ animated: true })
          }
          renderItem={({ item }) => {
            const isMe = item.senderUserId === currentUserId;

            return (
              <View
                style={[
                  styles.chatRow,
                  isMe ? styles.chatRowMe : styles.chatRowOther,
                ]}
              >
                {!isMe && (
                  <View style={styles.chatAvatar}>
                    <Text style={styles.chatAvatarText}>
                      {item.senderEmoji || "🧭"}
                    </Text>
                  </View>
                )}

                <View
                  style={[
                    styles.chatBubble,
                    isMe ? styles.chatBubbleMe : styles.chatBubbleOther,
                  ]}
                >
                  {!isMe && (
                    <Text style={styles.chatSenderName}>
                      {item.senderName}
                    </Text>
                  )}

                  {(item.localImageUri || item.imageUrl) ? (
                    <Image
                      source={{ uri: item.localImageUri || item.imageUrl }}
                      style={styles.chatMessageImage}
                      resizeMode="cover"
                    />
                  ) : null}

                  <Text style={styles.chatBody}>{item.body}</Text>

                  <Text
                    style={[
                      styles.chatMeta,
                      isMe && styles.chatMetaMe,
                    ]}
                  >
                    {formatMessageTime(item.createdAt)}
                  </Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            loading ? (
              <View style={styles.placeholderWrap}>
                <Text style={styles.placeholderTitle}>Private Chat</Text>
                <Text style={styles.placeholderText}>Loading messages…</Text>
              </View>
            ) : (
              <View style={styles.placeholderWrap}>
                <Text style={styles.placeholderTitle}>Private Chat</Text>
                <Text style={styles.placeholderText}>
                  {selectedUser
                    ? `No messages yet with ${selectedUser.name}.`
                    : "No crew members available yet."}
                </Text>
              </View>
            )
          }
        />

        <View style={styles.chatComposerWrap}>
          <TextInput
            style={styles.chatInput}
            value={draft}
            onChangeText={setDraft}
            placeholder={
              selectedUser
                ? `Message ${selectedUser.name}...`
                : "Select someone to chat..."
            }
            placeholderTextColor={COLORS.sub}
            multiline={false}
            blurOnSubmit={false}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            editable={!!selectedUser}
          />

          <TouchableOpacity
            activeOpacity={0.9}
            style={[
              styles.chatCameraButton,
              (!selectedUser || sending) && styles.chatSendButtonDisabled,
            ]}
            onPress={handleOpenCamera}
            disabled={!selectedUser || sending}
          >
            <Text style={styles.chatCameraButtonText}>📷</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            style={[
              styles.chatSendButton,
              (!draft.trim() || sending || !selectedUser) &&
              styles.chatSendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!draft.trim() || sending || !selectedUser}
          >
            <Text style={styles.chatSendButtonText}>
              {sending ? "..." : "Send"}
            </Text>
          </TouchableOpacity>
        </View>
        {pendingPhotoAsset ? (
          <View style={styles.pinPickerOverlay}>
            <View style={styles.pinPickerCard}>
              <Text style={styles.pinPickerTitle}>Preview photo</Text>

              <Image
                source={{ uri: pendingPhotoAsset.uri }}
                style={styles.chatPhotoPreview}
                resizeMode="cover"
              />

              <Text style={styles.sheetSub}>
                Send this photo to {selectedUser?.name || "this chat"}?
              </Text>

              <View style={styles.sheetButtonsRow}>
                <TouchableOpacity
                  style={[styles.sheetBtnSmall, { backgroundColor: COLORS.card2 }]}
                  onPress={() => setPendingPhotoAsset(null)}
                  disabled={sending}
                >
                  <Text style={styles.sheetBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.sheetBtnSmall, { backgroundColor: COLORS.blue }]}
                  onPress={handleSendPhoto}
                  disabled={sending}
                >
                  <Text style={styles.sheetBtnText}>
                    {sending ? "Sending..." : "Send"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

function CrewScreen({
  crew,
  onPressPerson,
  onFindPerson,
  onYouOk,
}) {
  const lowBatteryCount = crew.filter(
    (person) => !person.isMe
  ).length;

  return (
    <>
      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          {crew.length} in crew • {lowBatteryCount} low battery
        </Text>
      </View>

      <FlatList
        data={crew}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CrewCard
            item={item}
            onPress={() => onPressPerson(item)}
            onFind={() => onFindPerson(item)}
            onYouOk={() => onYouOk(item)}
          />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </>
  );
}

function AlertsScreen({
  eventId,
  pinReloadKey,
  youOkReloadKey,
  activeTab,
  onIncomingAlert,
  onOpenAlert,
  onIncomingNeedHelp,
  currentUserId,
  onNeedHelp,
  crew,
}) {
  const [alerts, setAlerts] = useState([]);
  const [replyTargetAlert, setReplyTargetAlert] = useState(null);
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    if (!eventId) {
      setAlerts([]);
      return;
    }

    if (activeTab !== "alerts") {
      return;
    }

    loadAlerts();
  }, [eventId, pinReloadKey, youOkReloadKey, activeTab]);

  useEffect(() => {
    if (!eventId) return;

    const pinsChannel = supabase
      .channel(`alerts-pins-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_pins",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const isMeetupInsert =
            payload?.eventType === "INSERT" &&
            payload?.new?.pin_type === "meetup";

          if (isMeetupInsert) {
            onIncomingAlert?.();
          }

          if (activeTab === "alerts") {
            loadAlerts();
          }
        }
      )
      .subscribe();

    const checkinsChannel = supabase
      .channel(`alerts-checkins-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "check_ins",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const isInsert = payload?.eventType === "INSERT";
          const insertedKind = payload?.new?.kind;
          const isHelpInsert =
            insertedKind === "you_ok_reply_help" || insertedKind === "need_help";

          if (isInsert) {
            onIncomingAlert?.();
          }

          if (isInsert && isHelpInsert) {
            onIncomingNeedHelp?.({
              fromUserId: payload?.new?.from_user_id,
              toUserId: payload?.new?.to_user_id,
              kind: insertedKind,
            });
          }

          if (activeTab === "alerts") {
            loadAlerts();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(pinsChannel);
      supabase.removeChannel(checkinsChannel);
    };
  }, [eventId, activeTab, onIncomingAlert]);

  async function loadAlerts() {
    try {
      const pins = await listEventPins(eventId);

      const { data: members } = await supabase
        .from("event_members")
        .select(`
          user_id,
          users:user_id (
           name
          )
        `)
        .eq("event_id", eventId)
        .is("left_at", null);

      const nameMap = {};
      (members || []).forEach((m) => {
        const user = Array.isArray(m.users) ? m.users[0] : m.users;
        nameMap[m.user_id] = user?.name || "Someone";
      });

      const meetupAlerts = (pins || [])
        .filter((pin) => pin.type === "meetup" && pin.meetupAt)
        .map((pin) => {
          const creatorName = nameMap[pin.createdBy] || "Someone";

          return {
            id: `meetup-${pin.id}`,
            type: "meetup",
            text: `${creatorName} set a meetup for ${new Date(pin.meetupAt).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}`,
            createdAt: pin.createdAt,
            pinId: pin.id,
          };
        });

      const { data: checkIns, error } = await supabase
        .from("check_ins")
        .select("id, created_at, kind, status, from_user_id, to_user_id")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const checkInAlerts = (checkIns || []).map((item) => {
        const creatorName = nameMap[item.from_user_id] || "Someone";

        let text = `${creatorName} sent a check-in`;

        if (item.kind === "you_ok") {
          text = `${creatorName} checked on you`;
        } else if (item.kind === "you_ok_reply_ok") {
          text = `${creatorName} is fine`;
        } else if (item.kind === "you_ok_reply_help") {
          text = `${creatorName} needs help`;
        }

        return {
          id: `checkin-${item.id}`,
          type: "checkin",
          kind: item.kind,
          text,
          createdAt: item.created_at,
          fromUserId: item.from_user_id,
          toUserId: item.to_user_id,
          status: item.status,
        };
      });

      const combined = [...meetupAlerts, ...checkInAlerts].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setAlerts(combined);
    } catch (error) {
      setAlerts([]);
    }
  }

  function formatTimeAgo(dateString) {
    if (!dateString) return "";

    const diffMs = Date.now() - new Date(dateString).getTime();
    const mins = Math.max(0, Math.floor(diffMs / 60000));

    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min ago`;

    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function isReplyableYouOkAlert(item) {
    return (
      item?.type === "checkin" &&
      item?.kind === "you_ok" &&
      item?.toUserId === currentUserId
    );
  }

  async function handleReplyToYouOk(replyKind) {
    if (!replyTargetAlert?.fromUserId || !eventId) return;

    try {
      setSendingReply(true);

      const me = crew.find((person) => person.isMe);
      const fromUserId = me?.id || currentUserId || null;

      if (replyKind === "you_ok_reply_help") {
        await sendYouOkReply(eventId, replyTargetAlert.fromUserId, replyKind);

        if (fromUserId) {
          try {
            await triggerYouOkReplyPush({
              eventId,
              toUserId: replyTargetAlert.fromUserId,
              fromUserId,
              name: me?.name || "Someone",
              replyKind,
            });
          } catch (pushError) {
            console.log("You OK help reply push failed:", pushError);
          }
        }

        await onNeedHelp?.();
      } else {
        await sendYouOkReply(eventId, replyTargetAlert.fromUserId, replyKind);

        if (fromUserId) {
          try {
            await triggerYouOkReplyPush({
              eventId,
              toUserId: replyTargetAlert.fromUserId,
              fromUserId,
              name: me?.name || "Someone",
              replyKind,
            });
          } catch (pushError) {
            console.log("You OK fine reply push failed:", pushError);
          }
        }
      }

      setReplyTargetAlert(null);
      await loadAlerts();
    } catch (error) {
      alert(error?.message || "Failed to send reply");
    } finally {
      setSendingReply(false);
    }
  }

  return (
    <View style={styles.alertsWrap}>
      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.alertsListContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const isFresh =
            Date.now() - new Date(item.createdAt).getTime() < 120000;

          return (
            <TouchableOpacity
              activeOpacity={0.9}
              style={[
                styles.alertCard,
                isFresh && { borderColor: COLORS.blue },
              ]}
              onPress={() => {
                if (isReplyableYouOkAlert(item)) {
                  setReplyTargetAlert(item);
                  return;
                }

                onOpenAlert?.(item);
              }}
            >
              <Text style={styles.alertTitleText}>
                {item.type === "meetup" ? "⏰ " : "📡 "}
                {item.text}
              </Text>

              <Text style={styles.alertMetaText}>
                {formatTimeAgo(item.createdAt)}
                {isReplyableYouOkAlert(item) ? " • Tap to reply" : ""}
              </Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.placeholderWrap}>
            <Text style={styles.placeholderTitle}>Alerts</Text>
            <Text style={styles.placeholderText}>
              No alerts yet. Meetup pins and check-ins will appear here.
            </Text>
          </View>
        }
      />

      {replyTargetAlert && (
        <View style={styles.pinPickerOverlay}>
          <View style={styles.pinPickerCard}>
            <Text style={styles.pinPickerTitle}>Reply to check-in</Text>

            <Text style={styles.sheetSub}>
              {replyTargetAlert.text}
            </Text>

            <Text style={styles.sheetSub}>
              Send a quick response now.
            </Text>

            <View style={styles.sheetButtonsRow}>
              <TouchableOpacity
                style={[styles.sheetBtnSmall, { backgroundColor: COLORS.card2 }]}
                onPress={() => setReplyTargetAlert(null)}
                disabled={sendingReply}
              >
                <Text style={styles.sheetBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sheetBtnSmall, { backgroundColor: COLORS.green }]}
                onPress={() => handleReplyToYouOk("you_ok_reply_ok")}
                disabled={sendingReply}
              >
                <Text style={styles.sheetBtnText}>
                  {sendingReply ? "Sending..." : "I'm Fine"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sheetBtnSmall, { backgroundColor: COLORS.red }]}
                onPress={() => handleReplyToYouOk("you_ok_reply_help")}
                disabled={sendingReply}
              >
                <Text style={styles.sheetBtnText}>
                  {sendingReply ? "Sending..." : "Need Help"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function CrewChatScreen({
  eventId,
  currentUserId,
  activeTab,
  chatMode,
  onPressUser,
  onIncomingGroupMessage,
}) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [pendingPhotoAsset, setPendingPhotoAsset] = useState(null);
  const [latestGroupMessageId, setLatestGroupMessageId] = useState(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!eventId) return;

    const unsubscribe = subscribeToEventMessages(eventId, async (incoming) => {
      if (!incoming?.id) return;

      if (incoming.senderUserId !== currentUserId) {
        console.log("TT_GROUP_INCOMING_TO_CREW_CHAT", incoming);

        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch (e) {
          console.log("TT_MESSAGE_HAPTIC_FAIL", e);
        }

        onIncomingGroupMessage?.(incoming);
      }

      const groupChatIsOpen = activeTab === "chat" && chatMode === "group";

      if (incoming.senderUserId !== currentUserId && !groupChatIsOpen) {
        onIncomingGroupMessage?.(incoming);
      }
      setMessages((prev) => {
        if (prev.some((item) => item.id === incoming.id)) {
          return prev;
        }

        return [...prev, incoming];
      });

      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd?.({ animated: true });
      });
    });

    return unsubscribe;
  }, [eventId]);

  useEffect(() => {
    if (!eventId) {
      setMessages([]);
      setHasLoadedOnce(false);
      return;
    }

    if (activeTab !== "chat") {
      return;
    }

    loadMessages();
  }, [eventId, activeTab]);



  async function loadMessages() {
    try {
      const rows = await listEventMessages(eventId, 50);
      const ascending = [...rows].reverse();
      setMessages(ascending);
    } catch (error) {
      console.log("loadMessages error:", error);
    } finally {
      setHasLoadedOnce(true);
    }
  }

  async function handleSend() {
    const trimmed = draft.trim();
    if (!trimmed || !eventId || sending) return;

    try {
      setSending(true);
      setDraft("");

      const created = await sendEventMessage(eventId, trimmed);
      console.log("TT_GROUP_MESSAGE_SENT_CREATED", created);
      setMessages((prev) => {
        if (prev.some((item) => item.id === created.id)) {
          return prev;
        }
        return [...prev, created];
      });

      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd?.({ animated: true });
      });
    } catch (error) {
      setDraft(trimmed);
      alert(error?.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  async function handleOpenCamera() {
    if (!eventId || sending) return;

    try {
      const asset = await takePhoto();
      if (!asset) return;

      setPendingPhotoAsset(asset);
    } catch (error) {
      alert(error?.message || "Could not open camera");
    }
  }

  async function handleSendPhoto() {
    if (!pendingPhotoAsset || !eventId || sending) return;

    const photoAsset = pendingPhotoAsset;
    const photoUri = photoAsset.uri;
    const trimmed = draft.trim();
    const fallbackBody = trimmed ? `${trimmed}\n📷 Photo` : "📷 Photo";

    try {
      setSending(true);
      setDraft("");
      setPendingPhotoAsset(null);

      const filePath = `group/${eventId}/${Date.now()}.jpg`;
      const imageUrl = await uploadChatImage(photoAsset, filePath);

      const created = await sendEventPhotoMessage(eventId, fallbackBody, imageUrl);

      const createdWithLocalPhoto = {
        ...created,
        localImageUri: photoUri,
      };

      setMessages((prev) => {
        if (prev.some((item) => item.id === createdWithLocalPhoto.id)) {
          return prev;
        }
        return [...prev, createdWithLocalPhoto];
      });

      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd?.({ animated: true });
      });
    } catch (error) {
      setDraft(trimmed);
      setPendingPhotoAsset(photoAsset);
      alert(error?.message || "Failed to send photo");
    } finally {
      setSending(false);
    }
  }

  function formatMessageTime(dateString) {
    if (!dateString) return "";
    return new Date(dateString).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return (
    <KeyboardAvoidingView
      style={styles.chatScreenWrap}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={80}
    >


      <FlatList
        ref={listRef}
        style={{ flex: 1 }}
        data={messages}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.chatListContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        removeClippedSubviews={false}
        renderItem={({ item }) => {
          const isMe = item.senderUserId === currentUserId;

          return (
            <View
              style={[
                styles.chatRow,
                isMe ? styles.chatRowMe : styles.chatRowOther,
              ]}
            >
              {!isMe && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.chatAvatar}
                  onPress={() =>
                    onPressUser?.({
                      id: item.senderUserId,
                      name: item.senderName,
                    })
                  }
                >
                  <Text style={styles.chatAvatarText}>
                    {item.senderEmoji || "🧭"}
                  </Text>
                </TouchableOpacity>
              )}

              <View
                style={[
                  styles.chatBubble,
                  isMe ? styles.chatBubbleMe : styles.chatBubbleOther,
                ]}
              >
                {!isMe && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() =>
                      onPressUser?.({
                        id: item.senderUserId,
                        name: item.senderName,
                      })
                    }
                  >
                    <Text style={styles.chatSenderName}>
                      {item.senderName}
                    </Text>
                  </TouchableOpacity>
                )}

                {(item.localImageUri || item.imageUrl) ? (
                  <Image
                    source={{ uri: item.localImageUri || item.imageUrl }}
                    style={styles.chatMessageImage}
                    resizeMode="cover"
                  />
                ) : null}

                <Text style={styles.chatBody}>{item.body}</Text>

                <Text
                  style={[
                    styles.chatMeta,
                    isMe && styles.chatMetaMe,
                  ]}
                >
                  {formatMessageTime(item.createdAt)}
                </Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          hasLoadedOnce && messages.length === 0 ? (
            <View style={styles.placeholderWrap}>
              <Text style={styles.placeholderTitle}>Crew Chat</Text>
              <Text style={styles.placeholderText}>
                No messages yet. Say something to your crew.
              </Text>
            </View>
          ) : null
        }
      />

      <View style={styles.chatComposerWrap}>
        <TextInput
          style={styles.chatInput}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message the crew..."
          placeholderTextColor={COLORS.sub}
          multiline={false}
          blurOnSubmit={false}
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />

        <TouchableOpacity
          activeOpacity={0.9}
          style={[
            styles.chatCameraButton,
            sending && styles.chatSendButtonDisabled,
          ]}
          onPress={handleOpenCamera}
          disabled={sending}
        >
          <Text style={styles.chatCameraButtonText}>📷</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.9}
          style={[
            styles.chatSendButton,
            (!draft.trim() || sending) && styles.chatSendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!draft.trim() || sending}
        >
          <Text style={styles.chatSendButtonText}>
            {sending ? "..." : "Send"}
          </Text>
        </TouchableOpacity>
      </View>
      {pendingPhotoAsset ? (
        <View style={styles.pinPickerOverlay}>
          <View style={styles.pinPickerCard}>
            <Text style={styles.pinPickerTitle}>Preview photo</Text>

            <Image
              source={{ uri: pendingPhotoAsset?.uri }}
              style={styles.chatPhotoPreview}
              resizeMode="cover"
            />

            <Text style={styles.sheetSub}>
              Send this photo to the crew?
            </Text>

            <View style={styles.sheetButtonsRow}>
              <TouchableOpacity
                style={[styles.sheetBtnSmall, { backgroundColor: COLORS.card2 }]}
                onPress={() => setPendingPhotoAsset(null)}
                disabled={sending}
              >
                <Text style={styles.sheetBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sheetBtnSmall, { backgroundColor: COLORS.blue }]}
                onPress={handleSendPhoto}
                disabled={sending}
              >
                <Text style={styles.sheetBtnText}>
                  {sending ? "Sending..." : "Send"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}


function MapScreen({
  eventId,
  isActive,
  crew,
  myLocation,
  isStationary,
  focusRequest,
  onFocusHandled,
  onYouOk,
  onNeedHelp,
  onComeFindMeSms,
  isExpanded,
  onToggleExpanded,
  pinReloadKey,
  onPinsChanged,
}) {

  const [navigationTarget, setNavigationTarget] = useState(null);
  const [isMapSheetOpen, setIsMapSheetOpen] = useState(false);
  const [showRadar, setShowRadar] = useState(false);
  const [navMode, setNavMode] = useState("direct"); // "direct" | "street"
  const [radarTarget, setRadarTarget] = useState(null);
  const [selectedRadarTarget, setSelectedRadarTarget] = useState(null);
  const [walkingRouteCoords, setWalkingRouteCoords] = useState([]);
  const [walkingRouteText, setWalkingRouteText] = useState("");
  const [isFollowingNavigation, setIsFollowingNavigation] = useState(false);
  const [closePulseOn, setClosePulseOn] = useState(false);
  // { type: "friend", id: "..."} or { type: "pin", id: "..." } or null

  const [rawHeading, setRawHeading] = useState(null);
  const [smoothedHeading, setSmoothedHeading] = useState(0);
  const headingWatcherRef = useRef(null);
  const smoothedHeadingRef = useRef(0);
  const smoothedFriendCoordsRef = useRef({});
  const lastKnownFriendCoordsRef = useRef({});
  const [myMarkerTracksViewChanges, setMyMarkerTracksViewChanges] = useState(true);
  const pinViewDirectionRef = useRef(1);
  const [pinViewMode, setPinViewMode] = useState("small");
  const [nowTick, setNowTick] = useState(Date.now());
  const [isMeSelected, setIsMeSelected] = useState(false);
  const me = crew.find((person) => person.isMe);

  const [customPins, setCustomPins] = useState([]);
  const [comeFindMePin, setComeFindMePin] = useState(null);
  const [isEditingPin, setIsEditingPin] = useState(false);
  const [editLabel, setEditLabel] = useState("");
  const mapRef = useRef(null);
  const hasTriggeredNearHapticRef = useRef(false);
  const [distanceTrend, setDistanceTrend] = useState("");
  const [customPinCount, setCustomPinCount] = useState(0);
  const lastDistanceRef = useRef(null);
  const [selectedFriendId, setSelectedFriendId] = useState(null);
  const [pendingPinPhotoAsset, setPendingPinPhotoAsset] = useState(null);
  const [showPinPicker, setShowPinPicker] = useState(false);
  const [selectedPin, setSelectedPin] = useState(null);
  const isThisPinNavigating =
    navigationTarget?.type === "pin" &&
    navigationTarget?.id === selectedPin?.id;
  const isThisRadarNavigating =
    navigationTarget?.type === "radar" &&
    navigationTarget?.id === selectedRadarTarget?.id;
  const [deletePinTarget, setDeletePinTarget] = useState(null);
  const [pendingPinCoordinate, setPendingPinCoordinate] = useState(null);
  const pinSubRef = useRef(null);
  const pinSubEventIdRef = useRef(null);
  const stableDistanceRef = useRef(null);
  const [showMeetupPicker, setShowMeetupPicker] = useState(false);
  const [meetupDayOffset, setMeetupDayOffset] = useState(0);
  const [pendingRadarMeetPlace, setPendingRadarMeetPlace] = useState(null);
  const [meetupDraftTime, setMeetupDraftTime] = useState(() => {
    const next = new Date();
    next.setMinutes(next.getMinutes() + 30);
    next.setSeconds(0);
    next.setMilliseconds(0);
    return next;
  });
  const [meetupHour12, setMeetupHour12] = useState(9);
  const [meetupMinute, setMeetupMinute] = useState(30);
  const [meetupAmPm, setMeetupAmPm] = useState("PM");
  const selectedFriend = useMemo(() => {
    if (!crew || crew.length === 0) return null;

    if (selectedFriendId) {
      return crew.find((p) => p.id === selectedFriendId) ?? null;
    }

    return crew.find((p) => !p.isMe) ?? null;
  }, [selectedFriendId, crew]);

  const meetupDayLabel =
    meetupDayOffset === 0
      ? "Today"
      : `+${meetupDayOffset} day${meetupDayOffset > 1 ? "s" : ""}`;
  const mapSheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return (
            Math.abs(gestureState.dy) > 10 &&
            Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
          );
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy < -20) {
            setIsMapSheetOpen(true);
          }

          if (gestureState.dy > 20) {
            setIsMapSheetOpen(false);
          }
        },
      }),
    []
  );

  function formatPinDistance(pin) {
    const meters = getDistanceMeters(myLocation, pin?.coordinate);

    if (meters == null) return "Distance unknown";
    if (meters <= 8) return "Very close";
    if (meters <= 20) return "Nearby";
    if (meters < 1000) return `${meters}m away`;

    return `${(meters / 1000).toFixed(1)}km away`;
  }

  const sortedPinsForSheet = useMemo(() => {
    const allPins = [
      ...customPins,
      ...(radarTarget
        ? [
          {
            id: `radar-${radarTarget.id}`,
            label: radarTarget.name || "Radar place",
            coordinate: {
              latitude: radarTarget.latitude,
              longitude: radarTarget.longitude,
            },
            type: "radar",
            temporary: true,
          },
        ]
        : []),
    ];

    return allPins.sort((a, b) => {
      const aDist = getDistanceMeters(myLocation, a.coordinate);
      const bDist = getDistanceMeters(myLocation, b.coordinate);

      if (aDist == null && bDist == null) return 0;
      if (aDist == null) return 1;
      if (bDist == null) return -1;

      return aDist - bDist;
    });
  }, [customPins, radarTarget, myLocation]);

  function openPinFromSheet(pin) {
    if (!pin?.coordinate) return;

    lastDistanceRef.current = null;
    hasTriggeredNearHapticRef.current = false;
    setDistanceTrend("");
    setIsMeSelected(false);
    setSelectedFriendId(null);
    setSelectedPin(pin);
    setNavigationTarget(null);
    setPinViewMode("small");
    setIsMapSheetOpen(false);

    zoomToTarget(pin.coordinate);
  }

  function normalizeHeading(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return 0;
    return ((value % 360) + 360) % 360;
  }

  function getShortestAngleDelta(from, to) {
    const a = normalizeHeading(from);
    const b = normalizeHeading(to);
    let diff = b - a;

    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    return diff;
  }

  function getNextRoutePointAhead(currentLocation, routeCoords) {
    if (!currentLocation || !routeCoords?.length) return null;

    let closestIndex = 0;
    let closestDistance = Infinity;

    routeCoords.forEach((point, index) => {
      const distance = getDistanceMeters(currentLocation, point);

      if (distance != null && distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    // Aim a few points ahead so the arrow doesn't jitter on tiny route bends
    for (let i = closestIndex + 1; i < routeCoords.length; i += 1) {
      const distance = getDistanceMeters(currentLocation, routeCoords[i]);

      if (distance != null && distance >= 12) {
        return routeCoords[i];
      }
    }

    return routeCoords[routeCoords.length - 1];
  }

  function getBearing(from, to) {
    if (!from || !to) return 0;

    const lat1 = (from.latitude * Math.PI) / 180;
    const lon1 = (from.longitude * Math.PI) / 180;
    const lat2 = (to.latitude * Math.PI) / 180;
    const lon2 = (to.longitude * Math.PI) / 180;

    const dLon = lon2 - lon1;

    const y = Math.sin(dLon) * Math.cos(lat2);
    const x =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

    const bearing = (Math.atan2(y, x) * 180) / Math.PI;
    return (bearing + 360) % 360;
  }

  function startNavigation(targetType, targetId, targetCoordinate) {
    if (!targetCoordinate || !myLocation) return;
    lastDistanceRef.current = null;
    hasTriggeredNearHapticRef.current = false;
    setDistanceTrend("");
    setIsMeSelected(false);

    setNavigationTarget({ type: targetType, id: targetId });
    setIsFollowingNavigation(true);

    if (navMode === "street") {
      fetchWalkingRoute(myLocation, targetCoordinate);
    }

    mapRef.current?.animateToRegion(
      {
        latitude: myLocation.latitude,
        longitude: myLocation.longitude,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      },
      500
    );
  }

  function endNavigation() {
    setNavigationTarget(null);
    setIsFollowingNavigation(false);
    setWalkingRouteCoords([]);
    setWalkingRouteText("");
  }

  function smoothHeadingTowards(current, target, factor = 0.22) {
    const delta = getShortestAngleDelta(current, target);
    return normalizeHeading(current + delta * factor);
  }
  function formatMeetupCountdown(meetupAt, nowMs) {
    if (!meetupAt) return "";

    const targetMs = new Date(meetupAt).getTime();
    if (!Number.isFinite(targetMs)) return "";

    const diffMs = targetMs - nowMs;
    const diffMinutes = Math.round(diffMs / 60000);
    const absMinutes = Math.abs(diffMinutes);

    if (absMinutes <= 1) {
      return "Starting now";
    }

    if (diffMinutes > 0) {
      if (diffMinutes < 60) {
        return `In ${diffMinutes} min`;
      }

      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      return `In ${hours}h ${String(minutes).padStart(2, "0")}m`;
    }

    if (absMinutes < 60) {
      return `Started ${absMinutes} min ago`;
    }

    const hours = Math.floor(absMinutes / 60);
    const minutes = absMinutes % 60;
    return `Started ${hours}h ${String(minutes).padStart(2, "0")}m ago`;
  }

  const myAnimatedCoordinateRef = useRef(
    new AnimatedRegion({
      latitude: myLocation?.latitude || 0,
      longitude: myLocation?.longitude || 0,
      latitudeDelta: 0.001,
      longitudeDelta: 0.001,
    })
  );
  function buildMeetupIsoFromCustomPicker(hour12, minute, amPm, dayOffset = 0) {
    let hours24 = hour12 % 12;
    if (amPm === "PM") {
      hours24 += 12;
    }

    const target = new Date();
    target.setDate(target.getDate() + dayOffset);
    target.setHours(hours24);
    target.setMinutes(minute);
    target.setSeconds(0);
    target.setMilliseconds(0);

    return target.toISOString();
  }

  async function saveCustomTimedMeetupPin() {
    const coordinateToUse = pendingPinCoordinate
      ? pendingPinCoordinate
      : myLocation;

    if (!coordinateToUse) {
      alert("No pin location available yet");
      return;
    }

    if (!eventId) {
      alert("No active event for shared pin");
      return;
    }
    try {
      const createdPin = await createEventPin({
        eventId,
        type: "meetup",
        label:
          pendingRadarMeetPlace?.title ||
          pendingRadarMeetPlace?.name ||
          "Meetup",
        latitude: coordinateToUse.latitude,
        longitude: coordinateToUse.longitude,
        meetupAt: buildMeetupIsoFromCustomPicker(
          meetupHour12,
          meetupMinute,
          meetupAmPm,
          meetupDayOffset
        ),
      });
      await reloadSharedPins(eventId);
      onPinsChanged?.();

      lastDistanceRef.current = null;
      hasTriggeredNearHapticRef.current = false;
      setDistanceTrend("");

      setSelectedPin(createdPin);
      setIsMeSelected(false);
      setSelectedFriendId(null);

      setShowMeetupPicker(false);
      setPendingPinCoordinate(null);
      setPendingRadarMeetPlace(null);

      setRadarTarget(null);
      setSelectedRadarTarget(null);

      zoomToTarget(createdPin.coordinate);
    } catch (error) {
      alert(error?.message || JSON.stringify(error) || "Failed to create meetup pin");
    }
  }

  async function reloadSharedPins(targetEventId = eventId) {

    if (!targetEventId) {
      setCustomPins([]);
      setCustomPinCount(0);
      return;
    }

    try {
      const loadedPins = await listEventPins(targetEventId);

      setCustomPins(loadedPins);

      const customCount = loadedPins.filter(
        (pin) => pin.type === "custom"
      ).length;

      setCustomPinCount(customCount);
    } catch (error) {
    }
  }




  useEffect(() => {
    if (rawHeading == null) return;

    const next = smoothHeadingTowards(
      smoothedHeadingRef.current,
      rawHeading,
      0.45
    );

    smoothedHeadingRef.current = next;
    setSmoothedHeading(next);
  }, [rawHeading]);

  useEffect(() => {
    const store = smoothedFriendCoordsRef.current;

    friendMarkers.forEach((person) => {
      const lat = person.latitude;
      const lng = person.longitude;
      const distanceJump = getDistanceMeters(prev, {
        latitude: lat,
        longitude: lng,
      });

      if (distanceJump > 1000) {
        console.log("TT_REJECT_GPS_JUMP", {
          personId: person.id,
          distanceJump,
        });

        return;
      }
      if (
        typeof lat !== "number" ||
        !Number.isFinite(lat) ||
        typeof lng !== "number" ||
        !Number.isFinite(lng)
      ) return;

      if (!store[person.id]) {
        store[person.id] = { latitude: lat, longitude: lng };
        return;
      }

      const prev = store[person.id];

      // Smooth movement (lerp)
      store[person.id] = {
        latitude: prev.latitude + (lat - prev.latitude) * 0.25,
        longitude: prev.longitude + (lng - prev.longitude) * 0.25,
      };
    });

    // cleanup
    const liveIds = new Set(friendMarkers.map((p) => p.id));
    Object.keys(store).forEach((id) => {
      if (!liveIds.has(id)) delete store[id];
    });
  }, [friendMarkers]);


  useEffect(() => {
    if (!myLocation) return;

    myAnimatedCoordinateRef.current.timing({
      latitude: myLocation.latitude,
      longitude: myLocation.longitude,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [myLocation]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowTick(Date.now());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!crew || crew.length === 0) return;

    const others = crew.filter((p) => !p.isMe);
    if (others.length === 0) {
      setSelectedFriendId(null);
      return;
    }

    const selectedStillValid = others.some((p) => p.id === selectedFriendId);

    if (!selectedFriendId || !selectedStillValid) {
      setSelectedFriendId(others[0].id);
    }
  }, [crew, selectedFriendId]);

  useEffect(() => {
  }, [eventId]);

  useEffect(() => {
    setMyMarkerTracksViewChanges(true);

    const timer = setTimeout(() => {
      setMyMarkerTracksViewChanges(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [me?.emoji, isMeSelected, !!comeFindMePin, isNavigating]);

  const mapRegion = myLocation
    ? {
      latitude: myLocation.latitude,
      longitude: myLocation.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }
    : null;


  const friendMarkers = useMemo(() => {
    return crew
      .filter((person) => !person.isMe)
      .map((person) => ({
        id: person.id,
        name: person.name,
        emoji: person.emoji,
        battery: person.battery,
        state: person.state,
        lastSeen: person.lastSeen,
        distance: person.distance,
        latitude: person.latitude,
        longitude: person.longitude,
      }))
      .filter(
        (person) =>
          typeof person.latitude === "number" &&
          Number.isFinite(person.latitude) &&
          typeof person.longitude === "number" &&
          Number.isFinite(person.longitude)
      );
  }, [crew]);

  useEffect(() => {
    /* console.log(
       "TT_MAP_FRIEND_MARKERS",
       friendMarkers.map((p) => ({
         id: p.id,
         name: p.name,
         latitude: p.latitude,
         longitude: p.longitude,
       }))
     );*/
  }, [friendMarkers]);

  const friendCoords = useMemo(() => {
    const out = {};

    friendMarkers.forEach((person) => {
      out[person.id] = {
        latitude: person.latitude,
        longitude: person.longitude,
      };
    });

    return out;
  }, [friendMarkers]);

  const selectedTargetCoordinate = useMemo(() => {
    if (selectedRadarTarget) {
      return {
        latitude: selectedRadarTarget.latitude,
        longitude: selectedRadarTarget.longitude,
      };
    }

    if (selectedPin?.coordinate) {
      return selectedPin.coordinate;
    }

    return friendCoords[selectedFriendId] || null;
  }, [
    selectedRadarTarget?.latitude,
    selectedRadarTarget?.longitude,
    selectedPin?.coordinate,
    selectedFriendId,
    friendCoords,
  ]);


  const rawSelectedDistanceMeters = getDistanceMeters(
    myLocation,
    selectedTargetCoordinate
  );
  const isNavigating = !!selectedTargetCoordinate;



  useEffect(() => {
    let isActive = true;

    async function startHeadingWatch() {
      if (!navigationTarget || !selectedTargetCoordinate || showRadar) {
        if (headingWatcherRef.current?.remove) {
          headingWatcherRef.current.remove();
        }
        headingWatcherRef.current = null;
        setRawHeading(null);
        return;
      }

      try {
        const fg = await Location.requestForegroundPermissionsAsync();
        if (fg.status !== "granted") return;

        if (headingWatcherRef.current?.remove) {
          headingWatcherRef.current.remove();
        }

        headingWatcherRef.current = await Location.watchHeadingAsync((update) => {
          if (!isActive) return;

          const nextHeading =
            typeof update?.trueHeading === "number" && update.trueHeading >= 0
              ? update.trueHeading
              : update?.magHeading;

          if (typeof nextHeading !== "number" || !Number.isFinite(nextHeading)) {
            return;
          }

          const normalized = normalizeHeading(nextHeading);

          setRawHeading((prev) => {
            if (prev != null && Math.abs(prev - normalized) < 2) {
              return prev;
            }

            return normalized;
          });
        });
      } catch (error) {
        console.log("Heading watch failed:", error);
      }
    }

    startHeadingWatch();
    /*console.log("TT_MAP_RENDER_STATE", {
      myLocation,
      crew: crew.map((p) => ({
        id: p.id,
        name: p.name,
        isMe: p.isMe,
        latitude: p.latitude,
        longitude: p.longitude,
        state: p.state,
        lastSeen: p.lastSeen,
      })),
      friendMarkers,
      friendCoords,
    });*/

    return () => {
      isActive = false;
      if (headingWatcherRef.current?.remove) {
        headingWatcherRef.current.remove();
      }
      headingWatcherRef.current = null;
    };
  }, [
    navigationTarget?.type,
    navigationTarget?.id,
    selectedTargetCoordinate?.latitude,
    selectedTargetCoordinate?.longitude,
    showRadar,
  ]);

  useEffect(() => {
    if (!eventId) return;
    reloadSharedPins(eventId);
  }, [eventId, isActive]);

  useEffect(() => {
    if (!eventId) return;
    reloadSharedPins(eventId);
  }, [pinReloadKey, eventId]);



  useEffect(() => {
    if (!eventId) return;

    if (pinSubRef.current && pinSubEventIdRef.current === eventId) {
      return;
    }

    if (pinSubRef.current) {
      pinSubRef.current();
      pinSubRef.current = null;
      pinSubEventIdRef.current = null;
    }


    const unsubscribe = subscribeToEventPins(eventId, () => {
      reloadSharedPins(eventId);
    });

    pinSubRef.current = unsubscribe;
    pinSubEventIdRef.current = eventId;

    return () => {
      if (pinSubEventIdRef.current === eventId) {
        pinSubRef.current?.();
        pinSubRef.current = null;
        pinSubEventIdRef.current = null;
      }
    };
  }, [eventId]);

  const hasAutoCenteredMapRef = useRef(false);

  useEffect(() => {
    if (!isActive || !myLocation || !mapRef.current) return;
    if (hasAutoCenteredMapRef.current) return;

    hasAutoCenteredMapRef.current = true;

    const timer = setTimeout(() => {
      mapRef.current?.animateToRegion(
        {
          latitude: myLocation.latitude,
          longitude: myLocation.longitude,
          latitudeDelta: 0.006,
          longitudeDelta: 0.006,
        },
        500
      );
    }, 350);

    return () => clearTimeout(timer);
  }, [isActive, myLocation]);

  const nearbyCount = crew.filter((person) => {
    if (person.isMe) return false;

    const coord = friendCoords[person.id];
    const dist = getDistanceMeters(myLocation, coord);

    return dist != null && dist <= 150;
  }).length;

  const criticalCount = crew.filter(
    (person) => !person.isMe && person.battery <= 10
  ).length;

  const lowCount = crew.filter(
    (person) => !person.isMe && person.battery > 10 && person.battery <= 20
  ).length;


  const walkingArrowTargetCoordinate =
    navMode === "street" && walkingRouteCoords.length > 0
      ? getNextRoutePointAhead(myLocation, walkingRouteCoords)
      : null;

  const arrowTargetCoordinate =
    walkingArrowTargetCoordinate || selectedTargetCoordinate;

  const rawNavigationHeading =
    myLocation && arrowTargetCoordinate
      ? getBearing(myLocation, arrowTargetCoordinate)
      : 0;

  const selectedDistanceMeters = useMemo(() => {
    if (rawSelectedDistanceMeters == null) {
      stableDistanceRef.current = null;
      return null;
    }

    if (stableDistanceRef.current == null) {
      stableDistanceRef.current = rawSelectedDistanceMeters;
      return rawSelectedDistanceMeters;
    }

    const diff = Math.abs(
      rawSelectedDistanceMeters - stableDistanceRef.current
    );

    if (isStationary) {
      if (diff <= 6) {
        return stableDistanceRef.current;
      }

      const smoothed = Math.round(
        stableDistanceRef.current +
        (rawSelectedDistanceMeters - stableDistanceRef.current) * 0.25
      );

      stableDistanceRef.current = smoothed;
      return smoothed;
    }

    stableDistanceRef.current = rawSelectedDistanceMeters;
    return rawSelectedDistanceMeters;
  }, [rawSelectedDistanceMeters, isStationary]);

  const isCloseRangeArrival =
    !!navigationTarget &&
    selectedDistanceMeters != null &&
    selectedDistanceMeters <= 5;

  const navPointerRotation = normalizeHeading(
    rawNavigationHeading - smoothedHeading
  );

  const navPointerAligned =
    Math.abs(getShortestAngleDelta(smoothedHeading, rawNavigationHeading)) <= 18;

  const navPointerColor = navPointerAligned ? COLORS.green : COLORS.blue;
  const selectedDistanceLabel = useMemo(() => {
    if (selectedDistanceMeters == null) return "Unknown";

    const myAccuracy =
      typeof myLocation?.accuracyM === "number" ? myLocation.accuracyM : null;

    const selectedFriendAccuracy =
      selectedFriend && typeof selectedFriend.accuracyM === "number"
        ? selectedFriend.accuracyM
        : null;

    const worstAccuracy =
      myAccuracy != null && selectedFriendAccuracy != null
        ? Math.max(myAccuracy, selectedFriendAccuracy)
        : myAccuracy != null
          ? myAccuracy
          : selectedFriendAccuracy;

    if (worstAccuracy != null && worstAccuracy >= 60) {
      return "Location weak";
    }

    if (worstAccuracy != null && worstAccuracy >= 35) {
      if (selectedDistanceMeters <= 30) return "Nearby";
      if (selectedDistanceMeters <= 80) return "Close";
      if (selectedDistanceMeters < 1000) {
        return `~${Math.round(selectedDistanceMeters / 5) * 5}m away`;
      }
      return `~${(selectedDistanceMeters / 1000).toFixed(1)}km away`;
    }

    if (worstAccuracy != null && worstAccuracy >= 20) {
      if (selectedDistanceMeters <= 10) return "Very close";
      if (selectedDistanceMeters <= 25) return "Nearby";
      if (selectedDistanceMeters < 1000) {
        return `~${Math.round(selectedDistanceMeters / 5) * 5}m away`;
      }
      return `~${(selectedDistanceMeters / 1000).toFixed(1)}km away`;
    }

    if (selectedDistanceMeters <= 8) return "Very close";
    if (selectedDistanceMeters <= 20) return "Nearby";
    if (selectedDistanceMeters < 1000) return `${selectedDistanceMeters}m away`;
    return `${(selectedDistanceMeters / 1000).toFixed(1)}km away`;
  }, [selectedDistanceMeters, myLocation, selectedFriend]);



  useEffect(() => {
    if (selectedDistanceMeters == null) {
      setDistanceTrend("");
      lastDistanceRef.current = null;
      return;
    }

    if (selectedDistanceMeters <= 10) {
      setDistanceTrend("");
      lastDistanceRef.current = selectedDistanceMeters;
      return;
    }

    if (lastDistanceRef.current == null) {
      lastDistanceRef.current = selectedDistanceMeters;
      setDistanceTrend("");
      return;
    }

    const change = selectedDistanceMeters - lastDistanceRef.current;

    if (change <= -5) {
      setDistanceTrend("Getting hotter");
    } else if (change >= 5) {
      setDistanceTrend("Getting colder");
    } else {
      setDistanceTrend("Holding");
    }

    lastDistanceRef.current = selectedDistanceMeters;
  }, [selectedDistanceMeters, selectedPin, selectedFriendId]);

  useEffect(() => {
    if (!isCloseRangeArrival) {
      setClosePulseOn(false);
      return;
    }

    setClosePulseOn(true);

    const interval = setInterval(async () => {
      setClosePulseOn((prev) => !prev);

      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } catch (error) { }
    }, 1000);

    return () => clearInterval(interval);
  }, [isCloseRangeArrival]);
  useEffect(() => {
    async function triggerArrivalHaptic() {
      if (selectedDistanceMeters == null) return;

      // ARRIVAL
      if (selectedDistanceMeters <= 5) {
        if (!hasTriggeredNearHapticRef.current) {
          hasTriggeredNearHapticRef.current = true;

          try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (error) { }
        }
      }

      // RESET (important so it can trigger again)
      if (selectedDistanceMeters > 10) {
        hasTriggeredNearHapticRef.current = false;
      }
    }

    triggerArrivalHaptic();
  }, [selectedDistanceMeters]);

  useEffect(() => {
    if (!focusRequest || !myLocation) return;

    if (focusRequest.type === "me") {
      lastDistanceRef.current = null;
      hasTriggeredNearHapticRef.current = false;
      setDistanceTrend("");
      setSelectedPin(null);
      setIsMeSelected(true);
      setNavigationTarget(null);
      mapRef.current?.animateToRegion(
        {
          latitude: myLocation.latitude,
          longitude: myLocation.longitude,
          latitudeDelta: 0.0007,
          longitudeDelta: 0.0007,
        },
        500
      );

      onFocusHandled?.();
      return;
    }

    if (focusRequest.type === "friend") {
      const target =
        smoothedFriendCoordsRef.current[focusRequest.id] ||
        friendCoords[focusRequest.id];

      console.log("TT_FOCUS_FRIEND_REQUEST", {
        focusId: focusRequest.id,
        hasTarget: !!target,
        friendCoords,
      });

      lastDistanceRef.current = null;
      hasTriggeredNearHapticRef.current = false;
      setDistanceTrend("");

      // Important: switch the sheet even if coords are temporarily missing
      setSelectedFriendId(focusRequest.id);
      setIsMeSelected(false);
      setSelectedPin(null);
      setNavigationTarget(null);

      if (target) {
        zoomToTarget(target);
      }

      onFocusHandled?.();
      return;
    }

    if (focusRequest.type === "pin") {
      const targetPin = customPins.find((pin) => pin.id === focusRequest.pinId);
      if (!targetPin?.coordinate) return;

      lastDistanceRef.current = null;
      hasTriggeredNearHapticRef.current = false;
      setDistanceTrend("");
      setSelectedFriendId(null);
      setIsMeSelected(false);
      setSelectedPin(targetPin);
      setNavigationTarget(null);
      console.log("TT_MAP_FOCUS_FRIEND", {
        focusId: focusRequest.id,
        target,
        friendCoords,
      });
      zoomToTarget(targetPin.coordinate);
      onFocusHandled?.();
    }
  }, [focusRequest, myLocation, friendCoords, customPins]);

  useEffect(() => {
    if (!myLocation) return;

    setComeFindMePin((prev) =>
      prev
        ? {
          ...prev,
          coordinate: {
            latitude: myLocation.latitude,
            longitude: myLocation.longitude,
          },
        }
        : prev
    );

    setSelectedPin((prev) =>
      prev && prev.id === "come-find-me"
        ? {
          ...prev,
          coordinate: {
            latitude: myLocation.latitude,
            longitude: myLocation.longitude,
          },
        }
        : prev
    );
  }, [myLocation]);

  function buildMeetupIsoFromTime(selectedTime) {
    const now = new Date();

    const target = new Date();
    target.setHours(selectedTime.getHours());
    target.setMinutes(selectedTime.getMinutes());
    target.setSeconds(0);
    target.setMilliseconds(0);

    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }

    return target.toISOString();
  }

  const meetupHourOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const meetupMinuteOptions = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  function getRoundedMeetupDefaults() {
    const now = new Date();
    const next = new Date(now.getTime());
    next.setMinutes(Math.ceil(next.getMinutes() / 5) * 5);
    next.setSeconds(0);
    next.setMilliseconds(0);

    if (next.getMinutes() === 60) {
      next.setHours(next.getHours() + 1);
      next.setMinutes(0);
    }

    const hours24 = next.getHours();
    const minutes = next.getMinutes();

    const amPm = hours24 >= 12 ? "PM" : "AM";
    const hour12 = hours24 % 12 === 0 ? 12 : hours24 % 12;

    return {
      hour12,
      minute: minutes,
      amPm,
    };
  }

  function buildMeetupPreviewText(hour12, minute, amPm) {
    const now = new Date();

    let hours24 = hour12 % 12;
    if (amPm === "PM") hours24 += 12;

    const target = new Date();
    target.setHours(hours24);
    target.setMinutes(minute);
    target.setSeconds(0);
    target.setMilliseconds(0);

    const isTomorrow = target.getTime() <= now.getTime();
    if (isTomorrow) {
      target.setDate(target.getDate() + 1);
    }

    const minuteLabel = String(minute).padStart(2, "0");
    return `${isTomorrow ? "Tomorrow" : "Tonight"} at ${hour12}:${minuteLabel} ${amPm}`;
  }

  function cycleSelectedPinView() {
    if (!selectedPin?.imageUrl) return;

    setPinViewMode((prev) => {
      if (prev === "small") {
        pinViewDirectionRef.current = 1;
        return "half";
      }

      if (prev === "half") {
        return pinViewDirectionRef.current === 1 ? "full" : "small";
      }

      if (prev === "full") {
        pinViewDirectionRef.current = -1;
        return "half";
      }

      return "small";
    });
  }

  useEffect(() => {
    setPinViewMode("small");
    pinViewDirectionRef.current = 1;
  }, [selectedPin?.id]);

  async function handleComeFindMe() {
    if (!myLocation) {
      return;
    }

    setIsMeSelected(false);

    // TOGGLE OFF
    if (comeFindMePin) {
      setComeFindMePin(null);

      lastDistanceRef.current = null;
      hasTriggeredNearHapticRef.current = false;
      setDistanceTrend("");

      setSelectedPin((prev) =>
        prev && prev.id === "come-find-me" ? null : prev
      );

      return;
    }

    // TOGGLE ON
    const livePin = {
      id: "come-find-me",
      label: "Come Find Me",
      coordinate: {
        latitude: myLocation.latitude,
        longitude: myLocation.longitude,
      },
      type: "comeFindMe",
      temporary: true,
    };

    lastDistanceRef.current = null;
    hasTriggeredNearHapticRef.current = false;
    setDistanceTrend("");

    setComeFindMePin(livePin);
    setSelectedPin(livePin);
    zoomToTarget(livePin.coordinate);
    await onComeFindMeSms?.();
  }

  function openPinPicker() {
    if (!myLocation) {
      return;
    }
    setShowPinPicker(true);
  }


  async function updatePinLabel() {
    if (!selectedPin) return;

    const pinId = selectedPin.id;
    const trimmed = editLabel.trim();

    if (!trimmed) return;

    try {
      await updateEventPinLabel(pinId, trimmed);

      setSelectedPin((prev) =>
        prev && prev.id === pinId ? { ...prev, label: trimmed } : prev
      );

      setCustomPins((prev) =>
        prev.map((pin) =>
          pin.id === pinId ? { ...pin, label: trimmed } : pin
        )
      );

      setIsEditingPin(false);

      await reloadSharedPins(eventId);
      onPinsChanged?.();
    } catch (error) {
      console.log("updatePinLabel error:", error);
      alert(error?.message || "Failed to rename pin");
    }
  }

  async function handleAddPhotoToSelectedPin() {
    if (!selectedPin?.id || selectedPin.type === "comeFindMe") return;

    try {
      const pinId = selectedPin.id;

      const asset = await takePhoto();
      if (!asset) return;

      const filePath = `event-pins/${eventId}/${pinId}-${Date.now()}.jpg`;

      const imageUrl = await uploadPinImage(asset, filePath);

      await updateEventPinImage(pinId, imageUrl);

      const nextImageUrl = imageUrl;

      setSelectedPin((prev) =>
        prev && prev.id === pinId
          ? {
            ...prev,
            imageUrl: nextImageUrl,
          }
          : prev
      );

      setCustomPins((prev) =>
        prev.map((pin) =>
          pin.id === pinId
            ? {
              ...pin,
              imageUrl: nextImageUrl,
            }
            : pin
        )
      );

      setPinViewMode("small");

      await reloadSharedPins(eventId);
      onPinsChanged?.();
    } catch (error) {
      console.log("handleAddPhotoToSelectedPin error:", error);
      alert(error?.message || "Failed to add pin photo");
    }
  }

  function handleMapLongPress(event) {
    console.log("MAP LONG PRESS FIRED");
    const { coordinate } = event.nativeEvent;

    setPendingPinCoordinate(coordinate);
    setShowPinPicker(true);
    setSelectedPin(null);
    setIsMeSelected(false);
  }

  async function addTypedPin(type, label) {
    const coordinateToUse = pendingPinCoordinate
      ? pendingPinCoordinate
      : myLocation;

    if (!coordinateToUse) {
      alert("No pin location available yet");
      return;
    }

    if (!eventId) {
      alert("No active event for shared pin");
      return;
    }

    if (type === "meetup") {
      const defaults = getRoundedMeetupDefaults();
      setMeetupHour12(defaults.hour12);
      setMeetupMinute(defaults.minute);
      setMeetupAmPm(defaults.amPm);
      setMeetupDayOffset(0);
      setShowPinPicker(false);
      setShowMeetupPicker(true);
      return;
    }

    let imageUrl = null;

    if (pendingPinPhotoAsset) {
      const filePath = `event-pins/${eventId}/${Date.now()}.jpg`;
      imageUrl = await uploadPinImage(pendingPinPhotoAsset, filePath);
    }

    let finalLabel = label;

    if (type === "custom") {
      const next = customPinCount + 1;
      finalLabel = `Custom ${next}`;
    }

    try {
      setShowPinPicker(false);
      setPendingPinCoordinate(null);

      const createdPin = await createEventPin({
        eventId,
        type,
        label: finalLabel,
        latitude: coordinateToUse.latitude,
        longitude: coordinateToUse.longitude,
        meetupAt: null,
        imageUrl,
      });


      await reloadSharedPins(eventId);

      lastDistanceRef.current = null;
      hasTriggeredNearHapticRef.current = false;
      setDistanceTrend("");

      setSelectedPin(createdPin);
      zoomToTarget(createdPin.coordinate);
      setShowPinPicker(false);
      setPendingPinCoordinate(null);
    } catch (error) {
      alert(error?.message || JSON.stringify(error) || "Failed to create shared pin");
    }
  }


  function zoomToTarget(targetCoordinate) {
    if (!mapRef.current || !myLocation || !targetCoordinate) return;


    mapRef.current.fitToCoordinates(
      [
        {
          latitude: myLocation.latitude,
          longitude: myLocation.longitude,
        },
        {
          latitude: targetCoordinate.latitude,
          longitude: targetCoordinate.longitude,
        },
      ],
      {
        edgePadding: {
          top: 90,
          right: 60,
          bottom: selectedPin ? 100 : 80,
          left: 60,
        },
        animated: true,
      }
    );
  }



  function decodePolyline(t) {
    let points = [];
    let index = 0,
      lat = 0,
      lng = 0;

    while (index < t.length) {
      let b,
        shift = 0,
        result = 0;
      do {
        b = t.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlat = result & 1 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = t.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlng = result & 1 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }

    return points;
  }

  async function fetchWalkingRoute(from, to) {
    try {
      const url = `https://router.project-osrm.org/route/v1/foot/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=polyline`;

      const res = await fetch(url);
      const json = await res.json();

      if (!json.routes || json.routes.length === 0) return;

      const route = json.routes[0];

      const decoded = decodePolyline(route.geometry);
      setWalkingRouteCoords(decoded);

      const minutes = Math.round(route.duration / 60);
      setWalkingRouteText(`${minutes} min walk`);
    } catch (err) {
      console.log("Route fetch failed:", err);
    }
  }

  useEffect(() => {
    if (!isFollowingNavigation || !myLocation || !mapRef.current) return;

    mapRef.current.animateToRegion(
      {
        latitude: myLocation.latitude,
        longitude: myLocation.longitude,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      },
      600
    );
  }, [myLocation, isFollowingNavigation]);

  useEffect(() => {
    if (
      navMode === "street" &&
      myLocation &&
      selectedTargetCoordinate
    ) {
      fetchWalkingRoute(myLocation, selectedTargetCoordinate);
    }
  }, [
    navMode,
    myLocation?.latitude,
    myLocation?.longitude,
    selectedTargetCoordinate?.latitude,
    selectedTargetCoordinate?.longitude,
  ]);

  if (showRadar) {
    return (
      <RadarScreen
        userLocation={myLocation}
        onClose={() => setShowRadar(false)}
        onCreateMeetupFromRadar={async (place) => {
          console.log("TT_RADAR_CREATE_MEETUP_START", place);

          if (!place || !eventId) return;

          if (
            typeof place.latitude !== "number" ||
            !Number.isFinite(place.latitude) ||
            typeof place.longitude !== "number" ||
            !Number.isFinite(place.longitude)
          ) {
            alert("This Radar result has no usable location");
            return;
          }

          try {
            const isTimedEvent =
              place.type === "event" && !!place.startDateTime;

            if (!isTimedEvent) {
              setPendingPinCoordinate({
                latitude: place.latitude,
                longitude: place.longitude,
              });

              setPendingRadarMeetPlace(place);

              const defaults = getRoundedMeetupDefaults();

              setMeetupHour12(defaults.hour12);
              setMeetupMinute(defaults.minute);
              setMeetupAmPm(defaults.amPm);
              setMeetupDayOffset(0);

              setShowRadar(false);
              setShowMeetupPicker(true);

              return;
            }

            const createdPin = await createEventPin({
              eventId,
              type: "meetup",
              label: place.title || place.name || "Radar place",
              latitude: place.latitude,
              longitude: place.longitude,
              meetupAt: place.startDateTime,
              imageUrl: place.imageUrl || null,
            });

            await reloadSharedPins(eventId);
            onPinsChanged?.();

            setShowRadar(false);
            setSelectedPin(createdPin);
            setSelectedRadarTarget(null);
            setRadarTarget(null);
            setIsMeSelected(false);
            setSelectedFriendId(null);

            zoomToTarget(createdPin.coordinate);
          } catch (error) {
            alert(error?.message || "Failed to create meetup pin");
          }
        }}
        onGoToPlace={(place) => {
          setShowRadar(false);

          if (place?.latitude && place?.longitude) {
            setRadarTarget(place);
            setSelectedRadarTarget(place);
            setSelectedPin(null);
            setSelectedFriendId(null);
            setIsMeSelected(false);
            setNavigationTarget(null);

            setTimeout(() => {
              mapRef.current?.animateToRegion(
                {
                  latitude: place.latitude,
                  longitude: place.longitude,
                  latitudeDelta: 0.003,
                  longitudeDelta: 0.003,
                },
                500
              );
            }, 100);
          }
        }}
      />
    );
  }

  return (
    <View style={[styles.mapScreenWrap, { position: "relative" }]}>


      <View
        style={[
          styles.mapFull,
          !isExpanded && styles.mapFullAboveSheets,
        ]}
        pointerEvents="box-none"
      >
        {!myLocation || !mapRegion ? (
          <View style={styles.mapLoadingWrap}>
            <Text style={styles.mapLoadingTitle}>Getting your location…</Text>
            <Text style={styles.mapLoadingText}>
              Opening the map where you are
            </Text>
          </View>
        ) : (
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            initialRegion={mapRegion}
            showsUserLocation={false}
            showsCompass={false}
            showsScale={false}
            toolbarEnabled={false}
            moveOnMarkerPress={false}
            onLongPress={handleMapLongPress}          >
            {navMode === "direct" && selectedTargetCoordinate && (
              <Polyline
                coordinates={[myLocation, selectedTargetCoordinate]}
                strokeColor={selectedPin ? COLORS.yellow : COLORS.blue}
                strokeWidth={4}
                lineDashPattern={[6, 6]}
              />
            )}

            {navMode === "street" && walkingRouteCoords.length > 0 && (
              <Polyline
                coordinates={walkingRouteCoords}
                strokeColor={COLORS.purple}
                strokeWidth={5}
              />
            )}

            {/*walkingRouteCoords.length > 0 && (
              <Polyline
                coordinates={walkingRouteCoords}
                strokeColor={COLORS.purple}
                strokeWidth={5}
              />
            )*/}

            {myLocation && (
              <MyLocationMarker
                coordinate={myAnimatedCoordinateRef.current}
                tracksViewChanges={myMarkerTracksViewChanges}
                emoji={me?.emoji || "🧑"}
                isSelected={isMeSelected}
                isNavigating={false}
                heading={0}
                showGlow={!!comeFindMePin}
                onPress={() => {
                  lastDistanceRef.current = null;
                  hasTriggeredNearHapticRef.current = false;
                  setDistanceTrend("");
                  setSelectedPin(null);
                  setSelectedFriendId(null);
                  setIsMeSelected(true);
                  setNavigationTarget(null);

                  mapRef.current?.animateToRegion(
                    {
                      latitude: myLocation.latitude,
                      longitude: myLocation.longitude,
                      latitudeDelta: 1,
                      longitudeDelta: 1,
                    },
                    500
                  );
                }}
              />
            )}

            {customPins.map((pin) => (
              <EmojiMapMarker
                markerId={`pin-${pin.id}`}
                key={pin.id}
                coordinate={pin.coordinate}
                emoji={getPinEmoji(pin.type)}
                onPress={() => {
                  lastDistanceRef.current = null;
                  hasTriggeredNearHapticRef.current = false;
                  setDistanceTrend("");
                  setIsMeSelected(false);
                  setSelectedPin(pin);
                  zoomToTarget(pin.coordinate);
                }}
              />
            ))}

            {comeFindMePin && (
              <EmojiMapMarker
                markerId={`pin-${comeFindMePin.id}`}
                key={comeFindMePin.id}
                coordinate={comeFindMePin.coordinate}
                emoji={getPinEmoji(comeFindMePin.type)}
                onPress={() => {
                  lastDistanceRef.current = null;
                  hasTriggeredNearHapticRef.current = false;
                  setDistanceTrend("");
                  setSelectedPin(comeFindMePin);
                }}
              />
            )}

            {radarTarget && (
              <EmojiMapMarker
                markerId={`radar-${radarTarget.id}`}
                coordinate={{
                  latitude: radarTarget.latitude,
                  longitude: radarTarget.longitude,
                }}
                emoji="📡"
                size={28}
                onPress={() => {
                  setSelectedPin(null);
                  setSelectedFriendId(null);
                  setIsMeSelected(false);
                }}
              />
            )}

            {friendMarkers.map((person) => {
              const liveTarget = friendCoords[person.id];

              const target =
                liveTarget ||
                smoothedFriendCoordsRef.current[person.id];

              if (liveTarget) {
                smoothedFriendCoordsRef.current[person.id] = liveTarget;
              }
              const isSelected =
                selectedPin == null && selectedFriendId === person.id;

              if (!target) return null;

              return (
                <EmojiMapMarker
                  key={`friend-${person.id}`}
                  markerId={`friend-${person.id}`}
                  coordinate={target}
                  emoji={person.emoji || "🧭"}
                  size={28}
                  isSelected={isSelected}
                  onPress={() => {
                    lastDistanceRef.current = null;
                    hasTriggeredNearHapticRef.current = false;
                    setDistanceTrend("");
                    setSelectedFriendId(person.id);
                    setIsMeSelected(false);
                    setSelectedPin(null);
                    setNavigationTarget(null);

                    zoomToTarget(target);
                  }}
                />
              );
            })}
          </MapView>

        )}
        <TouchableOpacity
          onPress={() => setShowRadar(true)}
          style={styles.radarTopButton}
          activeOpacity={0.85}
        >
          <Text style={styles.radarTopButtonText}>📡</Text>
        </TouchableOpacity>

        {selectedTargetCoordinate && myLocation && (
          <View style={styles.navOverlayWrap} pointerEvents="none">
            {isCloseRangeArrival ? (
              <View style={styles.closeRangeWrap}>
                <View
                  style={[
                    styles.closeRangePulseRing,
                    closePulseOn && styles.closeRangePulseRingOn,
                  ]}
                />
                <View style={styles.closeRangeCore}>
                  <Text style={styles.closeRangeText}>👀</Text>
                </View>
              </View>
            ) : (
              <View
                style={[
                  styles.navOverlayPointer,
                  {
                    transform: [{ rotate: `${navPointerRotation}deg` }],
                  },
                ]}
              >
                <View
                  style={[
                    styles.navOverlayArrowHead,
                    { borderBottomColor: navPointerColor },
                  ]}
                />
                <View
                  style={[
                    styles.navOverlayArrowTail,
                    { backgroundColor: navPointerColor },
                  ]}
                />
              </View>
            )}
          </View>
        )}

        {!(selectedPin && pinViewMode !== "small") && (
          <View style={styles.mapStatusFloating}>
            <View style={styles.mapStatusPill}>
              <View
                style={[
                  styles.mapStatusDot,
                  { backgroundColor: COLORS.green },
                ]}
              />
              <Text style={styles.mapStatusText}>
                👥 {nearbyCount} nearby
                {lowCount > 0 ? ` • 🟠 ${lowCount} low` : ""}
                {criticalCount > 0 ? ` • 🔴 ${criticalCount} critical` : ""}
                {lowCount === 0 && criticalCount === 0 ? " • All good" : ""}
              </Text>
            </View>
          </View>
        )}
        <View style={styles.mapBottomRightControls}>
          <View style={styles.navModeToggle}>
            <TouchableOpacity
              style={[
                styles.navModeButton,
                navMode === "direct" && styles.navModeButtonActive,
              ]}
              onPress={() => {
                setNavMode("direct");
                setWalkingRouteCoords([]);
                setWalkingRouteText("");
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.navModeText}>🧭</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.navModeButton,
                navMode === "street" && styles.navModeButtonActive,
              ]}
              onPress={() => {
                setNavMode("street");

                if (myLocation && selectedTargetCoordinate) {
                  fetchWalkingRoute(myLocation, selectedTargetCoordinate);
                }
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.navModeText}>🚶</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.mapExpandFloating}
            onPress={onToggleExpanded}
            activeOpacity={0.85}
          >
            <Text style={styles.mapExpandIcon}>
              {isExpanded ? "✕" : "⛶"}
            </Text>
          </TouchableOpacity>
        </View>

      </View>




      {!isExpanded && !(selectedPin && pinViewMode !== "small") && (
        <View
          style={[
            styles.mapControlSheet,
            isMapSheetOpen && styles.mapControlSheetOpen,
            isMapSheetOpen && styles.mapControlSheetOverInfo,
          ]}
        >
          <View
            {...mapSheetPanResponder.panHandlers}
            style={styles.mapSheetHandleArea}
          >
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setIsMapSheetOpen((prev) => !prev)}
              style={styles.mapSheetHandleButton}
            >
              <View style={styles.mapSheetHandle} />

              <Text style={styles.mapSheetSummaryText}>
                👥 {crew.length} crew • 📍 {customPins.length} pins
              </Text>

              <Text style={styles.mapSheetChevron}>
                {isMapSheetOpen ? "⌄" : "⌃"}
              </Text>
            </TouchableOpacity>
          </View>

          {isMapSheetOpen ? (
            <View style={styles.mapSheetContent}>
              <View style={styles.mapSheetActionsRow}>

                <TouchableOpacity
                  style={[styles.mapSheetActionBtn, { backgroundColor: COLORS.yellow }]}
                  onPress={openPinPicker}
                >
                  <Text style={[styles.mapSheetActionText, { color: "#1A1405" }]}>
                    Meet Here
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.mapSheetActionBtn,
                    { backgroundColor: comeFindMePin ? COLORS.red : COLORS.green },
                  ]}
                  onPress={handleComeFindMe}
                >
                  <Text style={styles.mapSheetActionText}>
                    {comeFindMePin ? "Stop Sharing" : "Come Find Me"}
                  </Text>
                </TouchableOpacity>


              </View>
              <TouchableOpacity
                style={styles.mapSheetHelpBtn}
                onPress={onNeedHelp}
                activeOpacity={0.9}
              >
                <Text style={styles.mapSheetHelpText}>🚨 Need Help</Text>
              </TouchableOpacity>

              <Text style={styles.mapSheetSectionTitle}>Pins</Text>

              {sortedPinsForSheet.length === 0 ? (
                <Text style={styles.mapSheetEmptyText}>
                  No pins yet. Drop one with Meet Here or long press the map.
                </Text>
              ) : (
                <ScrollView
                  style={styles.mapSheetPinsList}
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                  keyboardShouldPersistTaps="handled"
                >
                  {sortedPinsForSheet.map((pin) => (
                    <TouchableOpacity
                      key={pin.id}
                      activeOpacity={0.85}
                      style={styles.mapSheetPinRow}
                      onPress={() => openPinFromSheet(pin)}
                      onLongPress={() => {
                        setDeletePinTarget(pin);
                      }}
                      delayLongPress={600}
                    >
                      <View style={styles.mapSheetPinIcon}>
                        <Text style={styles.mapSheetPinEmoji}>
                          {getPinEmoji(pin.type)}
                        </Text>
                      </View>

                      <View style={styles.mapSheetPinTextCol}>
                        <Text style={styles.mapSheetPinTitle} numberOfLines={1}>
                          {pin.label}
                        </Text>

                        <Text style={styles.mapSheetPinMeta} numberOfLines={1}>
                          {pin.type === "meetup" ? "Timed meetup" : "Saved pin"} •{" "}
                          {formatPinDistance(pin)}
                        </Text>
                      </View>

                      <Text style={styles.mapSheetPinArrow}>›</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          ) : null}
        </View>
      )}

      {!isExpanded && (
        <>
          {selectedRadarTarget ? (
            // 🔥 RADAR SHEET GOES HERE
            <View style={styles.friendSheetNew}>
              {navigationTarget && (
                <View style={styles.navInfoBar}>
                  <Text style={styles.navInfoText}>
                    {walkingRouteText || "Navigating..."}
                  </Text>
                </View>
              )}
              <Text style={styles.sheetName}>
                {selectedRadarTarget.title}
              </Text>

              <Text style={styles.sheetSub}>
                {selectedRadarTarget.venue}
              </Text>

              <Text style={styles.sheetSub}>
                {selectedRadarTarget.distanceText}
              </Text>

              <View style={styles.sheetButtonsRow}>
                <TouchableOpacity
                  style={[styles.sheetBtnSmall, { backgroundColor: COLORS.blue }]}
                  onPress={() => {
                    if (!selectedRadarTarget) return;

                    if (isThisRadarNavigating) {
                      endNavigation();
                      return;
                    }

                    startNavigation("radar", selectedRadarTarget.id, {
                      latitude: selectedRadarTarget.latitude,
                      longitude: selectedRadarTarget.longitude,
                    });
                  }}
                >
                  <Text style={styles.sheetBtnText}>
                    {isThisRadarNavigating ? "End Navigation" : "Navigate"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.sheetBtnSmall, { backgroundColor: COLORS.yellow }]}
                  onPress={async () => {
                    if (!selectedRadarTarget || !eventId) return;

                    try {
                      const createdPin = await createEventPin({
                        eventId,
                        type: "custom",
                        label: selectedRadarTarget.title || "Radar place",
                        latitude: selectedRadarTarget.latitude,
                        longitude: selectedRadarTarget.longitude,
                        meetupAt: null,
                        imageUrl: null,
                      });

                      await reloadSharedPins(eventId);
                      onPinsChanged?.();

                      setSelectedPin(createdPin);
                      setSelectedRadarTarget(null);
                      setRadarTarget(null);
                      setIsMeSelected(false);
                      setSelectedFriendId(null);

                      zoomToTarget(createdPin.coordinate);
                    } catch (error) {
                      alert(error?.message || "Failed to save Radar place");
                    }
                  }}
                >
                  <Text style={[styles.sheetBtnText, { color: "#1A1405" }]}>
                    Save Pin
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.sheetBtnSmall, { backgroundColor: COLORS.card2 }]}
                  onPress={() => setSelectedRadarTarget(null)}
                >
                  <Text style={styles.sheetBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>

          ) : selectedPin && pinViewMode !== "full" ? (
            <View
              style={[
                styles.friendSheetNew,

                pinViewMode === "half" &&
                selectedPin?.imageUrl &&
                styles.friendSheetNewHalf,
              ]}
            >

              {navigationTarget && (
                <View style={styles.navInfoBar}>
                  <Text style={styles.navInfoText}>
                    {walkingRouteText || "Navigating..."}
                  </Text>
                </View>
              )}

              {pinViewMode === "half" && selectedPin?.imageUrl ? (
                <>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={cycleSelectedPinView}
                  >
                    <Image
                      source={{ uri: selectedPin.imageUrl }}
                      style={styles.pinSheetHeroImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>

                  <View style={styles.pinSheetHalfInfo}>
                    {isEditingPin ? (
                      <TextInput
                        style={styles.editInput}
                        value={editLabel}
                        onChangeText={setEditLabel}
                        autoFocus
                        placeholder="Pin name"
                        placeholderTextColor={COLORS.sub}
                        returnKeyType="done"
                        onSubmitEditing={updatePinLabel}
                        onBlur={updatePinLabel}
                      />
                    ) : (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => {
                          if (selectedPin?.type === "comeFindMe") return;
                          setEditLabel(selectedPin.label || "");
                          setIsEditingPin(true);
                        }}
                      >
                        <Text style={styles.sheetName}>{selectedPin.label}</Text>
                      </TouchableOpacity>
                    )}

                    {selectedDistanceMeters != null && selectedDistanceLabel !== "Location weak" ? (
                      <Text style={styles.sheetSub}>
                        {selectedDistanceLabel}
                      </Text>
                    ) : null}

                    {selectedPin.type === "meetup" && selectedPin.meetupAt ? (
                      <>
                        <Text style={styles.sheetSub}>
                          Meetup time •{" "}
                          {new Date(selectedPin.meetupAt).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </Text>
                        <Text style={styles.sheetTrend}>
                          {formatMeetupCountdown(selectedPin.meetupAt, nowTick)}
                        </Text>
                      </>
                    ) : null}

                    {distanceTrend ? (
                      <Text style={styles.sheetTrend}>{distanceTrend}</Text>
                    ) : null}

                    <Text style={styles.pinSheetTapHint}>
                      Tap photo to expand full screen
                    </Text>
                  </View>
                </>
              ) : (
                <View style={styles.pinSheetHeaderRow}>
                  <View style={styles.pinSheetHeaderTextCol}>
                    {isEditingPin ? (
                      <TextInput
                        style={styles.editInput}
                        value={editLabel}
                        onChangeText={setEditLabel}
                        autoFocus
                        placeholder="Pin name"
                        placeholderTextColor={COLORS.sub}
                        returnKeyType="done"
                        onSubmitEditing={updatePinLabel}
                        onBlur={updatePinLabel}
                      />
                    ) : (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => {
                          if (selectedPin?.type === "comeFindMe") return;
                          setEditLabel(selectedPin.label || "");
                          setIsEditingPin(true);
                        }}
                      >
                        <Text style={styles.sheetName}>{selectedPin.label}</Text>
                      </TouchableOpacity>
                    )}

                    {selectedDistanceMeters != null && selectedDistanceLabel !== "Location weak" ? (
                      <Text style={styles.sheetSub}>
                        {selectedDistanceLabel}
                      </Text>
                    ) : null}

                    {selectedPin.type === "meetup" && selectedPin.meetupAt ? (
                      <>
                        <Text style={styles.sheetSub}>
                          Meetup time •{" "}
                          {new Date(selectedPin.meetupAt).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </Text>
                        <Text style={styles.sheetTrend}>
                          {formatMeetupCountdown(selectedPin.meetupAt, nowTick)}
                        </Text>
                      </>
                    ) : null}

                    {selectedPin?.type === "comeFindMe" && distanceTrend ? (
                      <Text style={styles.sheetTrend}>{distanceTrend}</Text>
                    ) : null}
                  </View>

                  <TouchableOpacity
                    activeOpacity={selectedPin?.imageUrl ? 0.9 : 1}
                    style={styles.pinSheetMediaWrap}
                    onPress={selectedPin?.imageUrl ? cycleSelectedPinView : undefined}
                    onLongPress={handleAddPhotoToSelectedPin}
                    delayLongPress={350}
                    disabled={selectedPin?.type === "comeFindMe"}
                  >
                    {selectedPin?.imageUrl ? (
                      <Image
                        source={{ uri: selectedPin.imageUrl }}
                        style={styles.pinSheetMediaImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.pinSheetEmojiFallback}>
                        <Text style={styles.pinSheetEmojiText}>
                          {getPinEmoji(selectedPin.type)}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {pinViewMode !== "half" && (
                <View style={styles.sheetButtonsRow}>
                  <TouchableOpacity
                    style={[styles.sheetBtnSmall, { backgroundColor: COLORS.blue }]}
                    onPress={() => {
                      if (!selectedPin?.coordinate) return;

                      if (isThisPinNavigating) {
                        endNavigation();
                        return;
                      }

                      startNavigation("pin", selectedPin.id, selectedPin.coordinate);
                    }}
                  >
                    <Text style={styles.sheetBtnText}>
                      {isThisPinNavigating ? "End Navigation" : "Navigate"}
                    </Text>
                  </TouchableOpacity>

                  {selectedPin.type !== "comeFindMe" && (
                    <TouchableOpacity
                      style={[styles.sheetBtnSmall, { backgroundColor: COLORS.yellow }]}
                      onPress={() => {
                        setEditLabel(selectedPin.label);
                        setIsEditingPin(true);
                      }}
                    >
                      <Text style={[styles.sheetBtnText, { color: "#1A1405" }]}>
                        Edit
                      </Text>
                    </TouchableOpacity>
                  )}


                </View>
              )}


            </View>
          ) : isMeSelected && me ? (
            <View style={styles.friendSheetNew}>
              <View style={styles.sheetTopRow}>
                <Text style={styles.sheetName}>{me.name}</Text>
                <Text style={styles.sheetName}>{me.emoji}</Text>
              </View>

              <Text style={styles.sheetSub}>You</Text>

              <Text style={styles.sheetSub}>
                🔋 {me.battery}% • {me.status}
              </Text>

              <View style={styles.sheetButtonsRow}>
                <TouchableOpacity
                  style={[
                    styles.sheetBtnSmall,
                    {
                      backgroundColor: comeFindMePin ? COLORS.red : COLORS.green,
                    },
                  ]}
                  onPress={handleComeFindMe}
                >
                  <Text style={styles.sheetBtnText}>
                    {comeFindMePin ? "Stop Sharing" : "Come Find Me"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.sheetBtnSmall, { backgroundColor: COLORS.blue }]}
                  onPress={() => {
                    if (!mapRef.current || !myLocation) return;

                    mapRef.current.animateToRegion(
                      {
                        latitude: myLocation.latitude,
                        longitude: myLocation.longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                      },
                      500
                    );
                  }}
                >
                  <Text style={styles.sheetBtnText}>Center</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.sheetBtnSmall, { backgroundColor: COLORS.card2 }]}
                  onPress={() => setIsMeSelected(false)}
                >
                  <Text style={styles.sheetBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : selectedFriend ? (
            <View style={styles.friendSheetNew}>
              <View style={styles.sheetTopRow}>
                {/* LEFT: dot + name */}
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: getStatusColor(selectedFriend.state) },
                    ]}
                  />

                  <Text style={{ fontSize: 20, marginLeft: 8 }}>
                    {selectedFriend.emoji || "🧭"}
                  </Text>

                  <Text style={[styles.sheetName, { marginLeft: 6 }]}>
                    {selectedFriend.name}
                  </Text>
                </View>

                {/* RIGHT: battery */}
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={{
                      width: 18,
                      height: 10,
                      borderWidth: 1,
                      borderColor: "#fff",
                      borderRadius: 2,
                      justifyContent: "center",
                      padding: 1,
                    }}
                  >
                    <View
                      style={{
                        width: `${selectedFriend.battery || 0}%`,
                        height: "100%",
                        backgroundColor:
                          selectedFriend.battery <= 10
                            ? "#ff3b30"
                            : selectedFriend.battery <= 20
                              ? "#ff9500"
                              : "#34c759",
                      }}
                    />
                  </View>

                  <Text style={[styles.sheetSub, { marginLeft: 4 }]}>
                    {selectedFriend.battery ?? "--"}%
                  </Text>
                </View>
              </View>

              <Text style={styles.sheetSub}>{selectedFriend.lastSeen}</Text>
              <Text style={[styles.sheetSub, { opacity: 0.7 }]}>
                {selectedFriend.movementText}
              </Text>

              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={styles.sheetSub}>
                  {selectedDistanceLabel}
                </Text>


              </View>

              {distanceTrend && distanceTrend !== "Holding" ? (
                <Text style={styles.sheetTrend}>{distanceTrend}</Text>
              ) : null}

              <View style={styles.sheetButtonsRow}>
                <TouchableOpacity
                  style={[styles.sheetBtnSmall, { backgroundColor: COLORS.purple }]}
                  onPress={() => onYouOk(selectedFriend)}
                >
                  <Text style={styles.sheetBtnText}>You OK?</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.sheetBtnSmall, { backgroundColor: COLORS.blue }]}
                  onPress={() => {
                    const target = friendCoords[selectedFriend.id];
                    if (!target) return;

                    const isThisFriendNavigating =
                      navigationTarget?.type === "friend" &&
                      navigationTarget?.id === selectedFriend.id;

                    if (isThisFriendNavigating) {
                      endNavigation();
                      return;
                    }

                    lastDistanceRef.current = null;
                    hasTriggeredNearHapticRef.current = false;
                    setDistanceTrend("");
                    setIsMeSelected(false);
                    setSelectedPin(null);

                    startNavigation("friend", selectedFriend.id, target);
                    zoomToTarget(target);
                  }}
                >
                  <Text style={styles.sheetBtnText}>
                    {navigationTarget?.type === "friend" &&
                      navigationTarget?.id === selectedFriend.id
                      ? "End Navigation"
                      : "Navigate"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.sheetBtnSmall, { backgroundColor: COLORS.red }]}
                  onPress={onNeedHelp}                >
                  <Text style={styles.sheetBtnText}>Help</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.friendSheetNew}>
              <Text style={styles.sheetName}>Waiting for crew…</Text>
              <Text style={styles.sheetSub}>
                Event created. Live members will appear here shortly.
              </Text>
            </View>
          )}
        </>
      )}

      {selectedPin && pinViewMode === "full" && selectedPin.imageUrl ? (
        <View style={styles.pinFullOverlay}>
          <TouchableOpacity
            activeOpacity={0.95}
            style={styles.pinFullOverlayTouchable}
            onPress={cycleSelectedPinView}
          >
            <Image
              source={{ uri: selectedPin.imageUrl }}
              style={styles.pinFullImage}
              resizeMode="contain"
            />

            <View style={styles.pinFullHintWrap}>
              <Text style={styles.pinFullHintText}>
                Tap photo to shrink
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      ) : null}



      {showPinPicker && (
        <View style={styles.pinPickerOverlay}>
          <View style={styles.pinPickerCard}>
            <Text style={styles.pinPickerTitle}>
              {pendingPinCoordinate ? "Drop a pin" : "Meet Here"}
            </Text>

            <View style={styles.pinPickerGrid}>
              <TouchableOpacity
                style={styles.pinTypeButton}
                onPress={() => addTypedPin("tent", "Tent")}
              >
                <Text style={styles.pinTypeText}>⛺ Tent</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.pinTypeButton}
                onPress={() => addTypedPin("car", "Car")}
              >
                <Text style={styles.pinTypeText}>🚗 Car</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.pinTypeButton}
                onPress={() => addTypedPin("food", "Food")}
              >
                <Text style={styles.pinTypeText}>🍔 Food</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.pinTypeButton}
                onPress={() => addTypedPin("bar", "Bar")}
              >
                <Text style={styles.pinTypeText}>🍺 Bar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.pinTypeButton}
                onPress={() => addTypedPin("stage", "Stage")}
              >
                <Text style={styles.pinTypeText}>🎵 Stage</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.pinTypeButton}
                onPress={() => addTypedPin("entrance", "Entrance")}
              >
                <Text style={styles.pinTypeText}>🚪 Entrance</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.pinTypeButton}
                onPress={() => addTypedPin("meetup", "Meetup")}
              >
                <Text style={styles.pinTypeText}>⏰ Timed Meetup</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.pinTypeButton, styles.pinTypeButtonWide]}
                onPress={() => addTypedPin("custom", "Custom")}
              >
                <Text style={styles.pinTypeText}>📍 Custom</Text>
              </TouchableOpacity>


            </View>

            <TouchableOpacity
              style={styles.pinPickerCancel}
              onPress={() => {
                setShowPinPicker(false);
                setPendingPinCoordinate(null);
              }}
            >
              <Text style={styles.pinPickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {showMeetupPicker && (
        <View style={styles.pinPickerOverlay}>
          <View style={styles.pinPickerCard}>
            <Text style={styles.pinPickerTitle}>Set meetup time</Text>

            <Text style={styles.sheetSub}>
              Pick a meetup time for this pin.
            </Text>

            <View style={styles.meetupPickerSection}>

              <View style={styles.meetupPickerSection}>
                <Text style={styles.meetupPickerLabel}>Day</Text>

                <View style={styles.meetupOptionsRow}>
                  {[

                    { label: "Today", value: 0 },
                    { label: "+1", value: 1 },
                    { label: "+2", value: 2 },
                    { label: "+3", value: 3 },
                    { label: "+4", value: 4 },
                    { label: "+5", value: 5 },
                    { label: "+6", value: 6 },
                    { label: "+7", value: 7 },

                  ].map((option) => {
                    const selected = meetupDayOffset === option.value;

                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.meetupOptionChip,
                          selected && styles.meetupOptionChipSelected,
                        ]}
                        onPress={() => setMeetupDayOffset(option.value)}
                      >
                        <Text
                          style={[
                            styles.meetupOptionText,
                            selected && styles.meetupOptionTextSelected,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <Text style={styles.meetupPickerLabel}>Hour</Text>
              <View style={styles.meetupOptionsRow}>
                {meetupHourOptions.map((hour) => {
                  const selected = meetupHour12 === hour;
                  return (
                    <TouchableOpacity
                      key={`hour-${hour}`}
                      style={[
                        styles.meetupOptionChip,
                        selected && styles.meetupOptionChipSelected,
                      ]}
                      onPress={() => setMeetupHour12(hour)}
                    >
                      <Text
                        style={[
                          styles.meetupOptionText,
                          selected && styles.meetupOptionTextSelected,
                        ]}
                      >
                        {hour}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.meetupPickerSection}>
              <Text style={styles.meetupPickerLabel}>Minutes</Text>
              <View style={styles.meetupOptionsRow}>
                {meetupMinuteOptions.map((minute) => {
                  const selected = meetupMinute === minute;
                  return (
                    <TouchableOpacity
                      key={`minute-${minute}`}
                      style={[
                        styles.meetupOptionChip,
                        selected && styles.meetupOptionChipSelected,
                      ]}
                      onPress={() => setMeetupMinute(minute)}
                    >
                      <Text
                        style={[
                          styles.meetupOptionText,
                          selected && styles.meetupOptionTextSelected,
                        ]}
                      >
                        {String(minute).padStart(2, "0")}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.meetupAmPmRow}>
              <TouchableOpacity
                style={[
                  styles.meetupAmPmButton,
                  meetupAmPm === "AM" && styles.meetupAmPmButtonSelected,
                ]}
                onPress={() => setMeetupAmPm("AM")}
              >
                <Text
                  style={[
                    styles.meetupAmPmText,
                    meetupAmPm === "AM" && styles.meetupAmPmTextSelected,
                  ]}
                >
                  AM
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.meetupAmPmButton,
                  meetupAmPm === "PM" && styles.meetupAmPmButtonSelected,
                ]}
                onPress={() => setMeetupAmPm("PM")}
              >
                <Text
                  style={[
                    styles.meetupAmPmText,
                    meetupAmPm === "PM" && styles.meetupAmPmTextSelected,
                  ]}
                >
                  PM
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.meetupPreviewCard}>
              <Text style={styles.meetupPreviewText}>
                {meetupDayLabel} at{" "}
                {`${meetupHour12}:${String(meetupMinute).padStart(2, "0")} ${meetupAmPm}`}
              </Text>
            </View>

            <View style={styles.sheetButtonsRow}>
              <TouchableOpacity
                style={[styles.sheetBtnSmall, { backgroundColor: COLORS.card2 }]}
                onPress={() => {
                  setShowMeetupPicker(false);
                  setPendingPinCoordinate(null);
                }}
              >
                <Text style={styles.sheetBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sheetBtnSmall, { backgroundColor: COLORS.yellow }]}
                onPress={saveCustomTimedMeetupPin}
              >
                <Text style={[styles.sheetBtnText, { color: "#1A1405" }]}>
                  Set
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {deletePinTarget && (
        <View style={[styles.pinPickerOverlay, { zIndex: 999, elevation: 999 }]}>
          <View style={styles.deleteConfirmCard}>
            <Text style={styles.pinPickerTitle}>Delete pin?</Text>

            <Text style={styles.sheetSub}>
              Delete "{deletePinTarget.label || "this pin"}"?
            </Text>

            <View style={styles.sheetButtonsRow}>
              <TouchableOpacity
                style={[styles.sheetBtnSmall, { backgroundColor: COLORS.card2 }]}
                onPress={() => setDeletePinTarget(null)}
              >
                <Text style={styles.sheetBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sheetBtnSmall, { backgroundColor: COLORS.red }]}
                onPress={async () => {
                  try {
                    await deleteEventPin(deletePinTarget.id);
                    await reloadSharedPins(eventId);
                    onPinsChanged?.();

                    if (selectedPin?.id === deletePinTarget.id) {
                      setSelectedPin(null);
                      setIsEditingPin(false);
                    }

                    setDeletePinTarget(null);
                  } catch (error) {
                    console.log("delete pin error:", error);
                    alert(error?.message || "Failed to delete pin");
                  }
                }}
              >
                <Text style={styles.sheetBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function EventGate({
  creating,
  joining,
  createTitle,
  setCreateTitle,
  joinCode,
  setJoinCode,
  onCreate,
  onJoin,
  onScanQr,
  onSignOut,
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.container, { justifyContent: "center" }]}>
        <Image
          source={require("../assets/images/icon.png")}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <Text style={styles.subtitle}>Create or join a live event</Text>

        <View style={styles.pinPickerCard}>
          <Text style={styles.pinPickerTitle}>Create event</Text>
          <TextInput
            style={styles.editInput}
            value={createTitle}
            onChangeText={setCreateTitle}
            placeholder="My Night Out"
            placeholderTextColor={COLORS.sub}
          />
          <TouchableOpacity
            style={[styles.bigAction, { width: "100%", backgroundColor: COLORS.green }]}
            onPress={onCreate}
            disabled={creating}
          >
            <Text style={styles.bigActionText}>
              {creating ? "Creating..." : "Create Event"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.pinPickerCard, { marginTop: 12 }]}>
          <Text style={styles.pinPickerTitle}>Join event</Text>

          <TextInput
            style={styles.editInput}
            value={joinCode}
            onChangeText={setJoinCode}
            autoCapitalize="characters"
            placeholder="Invite code"
            placeholderTextColor={COLORS.sub}
          />

          <View style={styles.joinActionsRow}>
            <TouchableOpacity
              style={[styles.bigAction, styles.joinHalfButton, { backgroundColor: COLORS.card2 }]}
              onPress={onScanQr}
            >
              <Text style={styles.bigActionText}>Scan QR</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bigAction, styles.joinHalfButton, { backgroundColor: COLORS.blue }]}
              onPress={onJoin}
              disabled={joining}
            >
              <Text style={styles.bigActionText}>
                {joining ? "Joining..." : "Join Event"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={{ marginTop: 20, alignItems: "center" }}
          onPress={onSignOut}
        >
          <Text style={styles.subtitle}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

async function registerForPushNotificationsAsync() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  if (!Device.isDevice) {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId;

  if (!projectId) {
    throw new Error("Project ID not found");
  }

  const token = (
    await Notifications.getExpoPushTokenAsync({
      projectId,
    })
  ).data;

  return token;
}

function TripperTrackMain() {
  const lastRefreshRef = useRef(0);
  const latestLocationRef = useRef(null);
  const lastKnownCrewCoordsRef = useRef({});
  const appStateRef = useRef(AppState.currentState);
  const resumeRefreshInFlightRef = useRef(false);
  const lastResumeRefreshAtRef = useRef(0);
  const [showRenameEventModal, setShowRenameEventModal] = useState(false);
  const [renameEventDraft, setRenameEventDraft] = useState("");
  const [groupUnread, setGroupUnread] = useState(false);
  const lastSeenGroupMessageIdRef = useRef(null);
  const latestGroupMessageIdRef = useRef(null);
  const [latestGroupMessageId, setLatestGroupMessageId] = useState(null);
  const [youOkTarget, setYouOkTarget] = useState(null);
  const [mapFocusRequest, setMapFocusRequest] = useState(null);
  const [tab, setTab] = useState("crew");
  const [youOkReloadKey, setYouOkReloadKey] = useState(0);
  const [pinReloadKey, setPinReloadKey] = useState(0);
  const [alertsUnread, setAlertsUnread] = useState(false);
  const tabRef = useRef("crew");
  const chatModeRef = useRef("group");
  const trackingStartedForRef = useRef(null);

  async function handleShareWhatsAppInvite() {
    if (!inviteCode) {
      alert("No invite code available yet");
      return;
    }

    const message =
      `Join my TripperTrack crew 👥📍\n\n` +
      `Invite code: ${inviteCode}\n\n` +
      `Open TripperTrack and join with this code.\n` +
      `trippertrack://join?code=${inviteCode}`;

    try {
      await Share.share({
        message,
      });
    } catch (e) {
      console.log("TT_SHARE_INVITE_FAIL", e);
      alert("Could not open share sheet");
    }
  }

  async function ensureTrackingStarted(targetEventId = eventId, targetUserId = currentUserId) {
    if (!targetEventId || !targetUserId) return;

    const key = `${targetEventId}:${targetUserId}`;
    if (trackingStartedForRef.current === key) return;

    // important: set BEFORE await so double refreshes cannot start it twice
    trackingStartedForRef.current = key;

    try {
      await startTripperTrackLocation({
        eventId: targetEventId,
        userId: targetUserId,
      });
    } catch (e) {
      trackingStartedForRef.current = null;
      console.log("TT_TS_ENSURE_START_FAIL", e);
    }
  }

  useEffect(() => {
    lastPresenceSentAtRef.current = 0;
    lastPresenceSentCoordsRef.current = null;
    lastMotionWakeAtRef.current = 0;
    wasStationaryRef.current = false;
  }, [eventId]);

  useEffect(() => {
    latestLocationRef.current = myLiveLocation;
  }, [myLiveLocation]);

  useEffect(() => {
    chatModeRef.current = chatMode;
  }, [chatMode]);

  const [showQrModal, setShowQrModal] = useState(false);

  const [copiedCode, setCopiedCode] = useState(false);

  const [eventId, setEventId] = useState(null);
  const [eventName, setEventName] = useState("My Night Out");
  const [inviteCode, setInviteCode] = useState("");

  const [createTitle, setCreateTitle] = useState("My Night Out");
  const [joinCode, setJoinCode] = useState("");
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [joiningEvent, setJoiningEvent] = useState(false);

  const [crew, setCrew] = useState([]);
  const me = crew.find((person) => person.isMe);

  const isOwner = me?.role === "owner";
  const [editingPerson, setEditingPerson] = useState(null);
  const [editPersonName, setEditPersonName] = useState("");
  const [editPersonEmoji, setEditPersonEmoji] = useState("🧑");
  const [editPhoneNumber, setEditPhoneNumber] = useState("");
  const [editEmergencyContactNumber, setEditEmergencyContactNumber] = useState("");
  const [editHelpSmsCrew, setEditHelpSmsCrew] = useState(false);
  const [editHelpSmsEmergency, setEditHelpSmsEmergency] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [myLiveLocation, setMyLiveLocation] = useState(null);
  const [myBatteryPercent, setMyBatteryPercent] = useState(0);

  const [isStationary, setIsStationary] = useState(false);
  const lastPresenceSentAtRef = useRef(0);
  const lastPresenceSentCoordsRef = useRef(null);
  const wasStationaryRef = useRef(false);
  const lastMotionWakeAtRef = useRef(0);

  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [hasScannedQr, setHasScannedQr] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [dmUnreadByUserId, setDmUnreadByUserId] = useState({});

  const [chatMode, setChatMode] = useState("group");
  const [selectedPrivateUserId, setSelectedPrivateUserId] = useState(null);
  const selectedPrivateUserIdRef = useRef(null);

  useEffect(() => {
    selectedPrivateUserIdRef.current = selectedPrivateUserId;
  }, [selectedPrivateUserId]);

  const totalDmUnread = Object.values(dmUnreadByUserId).reduce(
    (sum, count) => sum + count,
    0
  );

  function openRenameEventModal() {
    setRenameEventDraft(eventName || "");
    setShowRenameEventModal(true);
  }

  async function forceInitialPresenceWrite(targetEventId, locationOverride = null) {
    const loc = locationOverride || latestLocationRef.current || myLiveLocation;

    if (!targetEventId || !loc) return;

    try {
      console.log("TT_BG_UPSERT_START");
      if (
        typeof loc.latitude !== "number" ||
        !Number.isFinite(loc.latitude) ||
        typeof loc.longitude !== "number" ||
        !Number.isFinite(loc.longitude) ||
        Math.abs(loc.latitude) > 90 ||
        Math.abs(loc.longitude) > 180 ||
        (loc.latitude === 0 && loc.longitude === 0)
      ) {
        console.log("TT_REJECT_BAD_COORDS", {
          latitude: loc.latitude,
          longitude: loc.longitude,
        });
        return;
      }
      await upsertMyPresence({
        eventId: targetEventId,
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracyM: loc.accuracyM,
        batteryPercent: myBatteryPercent,
        broadcasting: true,
        lastMovementAt: new Date().toISOString(),
      });

      console.log("TT_BG_UPSERT_OK");

      lastPresenceSentAtRef.current = Date.now();
      lastPresenceSentCoordsRef.current = {
        latitude: loc.latitude,
        longitude: loc.longitude,
      };

      console.log("TT_FORCE_INITIAL_PRESENCE_OK", {
        eventId: targetEventId,
        latitude: loc.latitude,
        longitude: loc.longitude,
      });
    } catch (e) {
      console.log("TT_BG_UPSERT_FAIL:", e);
      console.log("TT_FORCE_INITIAL_PRESENCE_FAIL", e);
    }
  }

  async function handleAppResumeRefresh() {
    if (!eventId) return;
    if (resumeRefreshInFlightRef.current) return;

    const now = Date.now();

    // small cooldown so we do not double-fire on weird lifecycle transitions
    if (now - lastResumeRefreshAtRef.current < 4000) {
      return;
    }

    resumeRefreshInFlightRef.current = true;
    lastResumeRefreshAtRef.current = now;

    try {
      console.log("TT_RESUME_REFRESH_START", { eventId });

      let freshLoc = latestLocationRef.current || myLiveLocation || null;

      try {
        const fg = await Location.requestForegroundPermissionsAsync();

        if (fg.status === "granted") {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });

          freshLoc = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracyM: pos.coords.accuracy,
          };

          setMyLiveLocation(freshLoc);
          latestLocationRef.current = freshLoc;

          console.log("TT_RESUME_LOCATION_OK", freshLoc);
        }
      } catch (locError) {
        console.log("TT_RESUME_LOCATION_FAIL", locError);
      }

      if (freshLoc) {
        await forceInitialPresenceWrite(eventId, freshLoc);
      }

      await refreshBundle(eventId, freshLoc);
      setPinReloadKey((prev) => prev + 1);

      console.log("TT_RESUME_REFRESH_DONE", { eventId });
    } catch (error) {
      console.log("TT_RESUME_REFRESH_FAIL", error);
    } finally {
      resumeRefreshInFlightRef.current = false;
    }
  }

  async function handleCopyInviteCode() {
    if (!inviteCode) return;

    try {
      await Clipboard.setStringAsync(inviteCode);
      setCopiedCode(true);

      setTimeout(() => {
        setCopiedCode(false);
      }, 1500);
    } catch (e) {
      alert("Failed to copy code");
    }
  }

  async function handleSaveEventName() {
    try {
      const updated = await renameEvent(eventId, renameEventDraft);
      setEventName(updated.title || renameEventDraft.trim());
      setShowRenameEventModal(false);
    } catch (e) {
      alert(e?.message || "Failed to rename event");
    }
  }

  async function openQrScanner() {
    try {
      if (!cameraPermission?.granted) {
        const permissionResult = await requestCameraPermission();
        if (!permissionResult.granted) {
          alert("Camera permission is needed to scan invite QR codes.");
          return;
        }
      }

      setHasScannedQr(false);
      setShowQrScanner(true);
    } catch (e) {
      alert("Could not open camera");
    }
  }

  function handleQrScanned(result) {
    if (hasScannedQr) return;

    const rawValue = result?.data?.trim?.() || "";
    if (!rawValue) return;

    setHasScannedQr(true);

    let extractedCode = rawValue;

    const deepLinkMatch = rawValue.match(/[?&]code=([A-Z0-9]+)/i);
    if (deepLinkMatch?.[1]) {
      extractedCode = deepLinkMatch[1];
    }

    extractedCode = extractedCode.trim().toUpperCase();

    setJoinCode(extractedCode);
    setShowQrScanner(false);
  }



  useEffect(() => {
    let cancelled = false;
    let timeoutId;

    async function startTransistorsoftTracking() {
      if (!eventId || !currentUserId) return;

      try {
        console.log("TT_TS_EFFECT_START_REQUEST", {
          eventId,
          currentUserId,
        });

        await startTripperTrackLocation({
          eventId,
          userId: currentUserId,
        });

        if (!cancelled) {
          //  console.log("TT_TS_EFFECT_START_OK");
        }
      } catch (error) {
        console.log("TT_TS_EFFECT_START_FAIL", error);
      }
    }

    if (eventId && currentUserId) {
      timeoutId = setTimeout(() => {
        startTransistorsoftTracking();
      }, 2000);
    } else {
      stopTripperTrackLocation().catch((error) => {
        //  console.log("TT_TS_EFFECT_STOP_FAIL", error);
      });
    }

    return () => {
      cancelled = true;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [eventId, currentUserId]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      const previousAppState = appStateRef.current;
      appStateRef.current = nextAppState;

      const comingToForeground =
        (previousAppState === "background" || previousAppState === "inactive") &&
        nextAppState === "active";

      if (!comingToForeground) return;
      if (!eventId) return;

      console.log("TT_APPSTATE_ACTIVE_FROM_BG", {
        previousAppState,
        nextAppState,
        eventId,
      });

      handleAppResumeRefresh();
    });

    return () => {
      subscription.remove();
    };
  }, [eventId, myLiveLocation, myBatteryPercent]);

  async function handleCreateEvent() {
    try {
      setCreatingEvent(true);

      const event = await createEvent(createTitle);
      console.log("TT_HANDLE_CREATE_EVENT_RESULT", event);
      if (!event?.id) {
        throw new Error("Create failed: no event returned");
      }

      setEventId(event.id);
      setEventName(event.title || "My Night Out");
      setInviteCode(event.invite_code || "");

      await setStoredEventId(event.id);
      console.log("handleCreateEvent: stored event id", event.id);

      await forceInitialPresenceWrite(event.id, myLiveLocation);
      await refreshBundle(event.id, myLiveLocation);
      setPinReloadKey((prev) => prev + 1);
    } catch (e) {
      alert(e?.message || "Failed to create event");
    } finally {
      setCreatingEvent(false);
    }
  }

  const refreshTimeoutRef = useRef(null);
  const refreshSeqRef = useRef(0);

  async function refreshBundle(

    targetEventId = eventId,
    latestLocation = latestLocationRef.current
  ) {
    if (!targetEventId) return;

    const seq = ++refreshSeqRef.current;
    console.log("TT_REFRESH_START", { seq, targetEventId });

    try {
      const userId = await getCurrentUserId();
      const latestGroupMessage = await listEventMessages(targetEventId, 1);
      const newestGroupMessage = latestGroupMessage?.[0];
      if (newestGroupMessage?.id) {
        latestGroupMessageIdRef.current = newestGroupMessage.id;
        setLatestGroupMessageId(newestGroupMessage.id);
      }
      if (newestGroupMessage?.id) {
        if (!lastSeenGroupMessageIdRef.current) {
          lastSeenGroupMessageIdRef.current = newestGroupMessage.id;
        } else {
          const groupChatIsActuallyVisible =
            tabRef.current === "chat" &&
            chatModeRef.current === "group";

          if (groupChatIsActuallyVisible) {
            lastSeenGroupMessageIdRef.current = newestGroupMessage.id;
            setGroupUnread(false);
          } else if (
            newestGroupMessage.id !== lastSeenGroupMessageIdRef.current &&
            newestGroupMessage.senderUserId !== userId
          ) {
            console.log("TT_GROUP_UNREAD_POLL_SET", {
              messageId: newestGroupMessage.id,
              senderUserId: newestGroupMessage.senderUserId,
              userId,
              tab: tabRef.current,
              chatMode: chatModeRef.current,
            });

            setGroupUnread(true);
          }
        }
      }
      const bundle = await loadEventBundle(targetEventId);
      const safeBundle = {
        ...bundle,
        presence: bundle?.presence || bundle?.presenceRows || [],
        live_presence: bundle?.live_presence || bundle?.presenceRows || [],
        profiles: bundle?.profiles || [],
        members: bundle?.members || [],
        event: bundle?.event || [],
      };
      /* console.log("TT_BUNDLE_DEBUG", {
         hasBundle: !!bundle,
         keys: bundle ? Object.keys(bundle) : null,
         event: Array.isArray(bundle?.event) ? bundle.event.length : typeof bundle?.event,
         members: Array.isArray(bundle?.members) ? bundle.members.length : typeof bundle?.members,
         profiles: Array.isArray(bundle?.profiles) ? bundle.profiles.length : typeof bundle?.profiles,
         presence: Array.isArray(bundle?.presence) ? bundle.presence.length : typeof bundle?.presence,
         live_presence: Array.isArray(bundle?.live_presence) ? bundle.live_presence.length : typeof bundle?.live_presence,
       });*/
      const serverNow = await getServerTime();

      if (seq !== refreshSeqRef.current) {
        console.log("TT_REFRESH_DROP_STALE", { seq, targetEventId });
        return;
      }

      const eventRow = Array.isArray(bundle.event)
        ? bundle.event[0]
        : bundle.event;

      const rawMappedCrew = buildCrewFromBundle(
        safeBundle,
        userId,
        latestLocation,
        serverNow
      );

      const mappedCrew = rawMappedCrew.map((person) => {
        const liveKnown = lastKnownCrewCoordsRef.current[person.id];

        if (liveKnown) {
          return {
            ...person,
            latitude: liveKnown.latitude,
            longitude: liveKnown.longitude,
            accuracyM: liveKnown.accuracyM ?? person.accuracyM ?? null,
          };
        }

        const hasGoodCoords =
          typeof person.latitude === "number" &&
          Number.isFinite(person.latitude) &&
          typeof person.longitude === "number" &&
          Number.isFinite(person.longitude) &&
          Math.abs(person.latitude) <= 90 &&
          Math.abs(person.longitude) <= 180 &&
          !(person.latitude === 0 && person.longitude === 0);

        if (hasGoodCoords) {
          lastKnownCrewCoordsRef.current[person.id] = {
            latitude: person.latitude,
            longitude: person.longitude,
            accuracyM: person.accuracyM,
          };
        }

        return person;
      });

      /* console.log("TT_REFRESH_APPLY", {
         seq,
         targetEventId,
         currentUserId: userId,
         mappedCrew: mappedCrew.map((person) => ({
           id: person.id,
           name: person.name,
           state: person.state,
           status: person.status,
           lastSeen: person.lastSeen,
           movementText: person.movementText,
         })),
       });*/

      setCurrentUserId(userId);
      // ensureTrackingStarted(targetEventId, userId);
      setEventName(eventRow?.title || "My Night Out");
      setInviteCode(eventRow?.invite_code || "");
      console.log("TT_CREW_SET", {
        count: mappedCrew.length,
        names: mappedCrew.map((p) => p.name),
      });

      setCrew(mappedCrew);
    } catch (e) {
      console.log("TT_REFRESH_FAIL", {
        seq,
        targetEventId,
        message: e?.message || String(e),
      });
    }
  }

  useEffect(() => {
    if (tab !== "chat") return;
    if (chatMode !== "private") return;
    if (!latestGroupMessageId) return;
    if (!lastSeenGroupMessageIdRef.current) return;

    if (latestGroupMessageId !== lastSeenGroupMessageIdRef.current) {
      setGroupUnread(true);
    }
  }, [tab, chatMode, latestGroupMessageId]);

  function scheduleRefreshBundle(
    targetEventId = eventId,
    latestLocation = latestLocationRef.current
  ) {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = setTimeout(() => {
      refreshBundle(targetEventId, latestLocation);
    }, 250);
  }

  function applyPresenceRowToCrew(row) {
    if (!row?.user_id) return;

    const updatedMs = row.updated_at
      ? new Date(row.updated_at).getTime()
      : Date.now();

    const minsAgo = Math.max(0, Math.floor((Date.now() - updatedMs) / 60000));

    const battery = row.battery_percent ?? 0;
    const friendAccuracyM =
      typeof row.accuracy_m === "number"
        ? row.accuracy_m
        : typeof row.accuracyM === "number"
          ? row.accuracyM
          : null;

    let state = "offline";
    let status = "Location unavailable";
    let lastSeen = "No live location yet";

    if (row.broadcasting && updatedMs != null) {
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
      } else if (minsAgo <= 60) {
        state = "stale";
        status = "Possibly findable";
        lastSeen = `Last known location • ${minsAgo} min${minsAgo === 1 ? "" : "s"} ago`;
      } else {
        state = "offline";
        status = "Location not reliable";
        lastSeen = `Try messaging or calling • ${minsAgo} min${minsAgo === 1 ? "" : "s"} ago`;
      }
    }

    let movementText = "No movement data yet";

    const lastMovedMs = row.last_movement_at
      ? new Date(row.last_movement_at).getTime()
      : null;

    if (lastMovedMs != null) {
      const minsSinceMove = Math.max(
        0,
        Math.floor((Date.now() - lastMovedMs) / 60000)
      );

      if (minsSinceMove <= 1) {
        movementText = "Moving now";
      } else {
        movementText = `Still for ${minsSinceMove} min${minsSinceMove === 1 ? "" : "s"}`;
      }
    }
    const hasGoodCoords =
      typeof row.latitude === "number" &&
      Number.isFinite(row.latitude) &&
      typeof row.longitude === "number" &&
      Number.isFinite(row.longitude);

    if (hasGoodCoords) {
      lastKnownCrewCoordsRef.current[row.user_id] = {
        latitude: row.latitude,
        longitude: row.longitude,
        accuracyM: friendAccuracyM,
      };
    }
    setCrew((prev) =>
      prev.map((person) => {
        if (person.id !== row.user_id) return person;

        const nextPerson = {
          ...person,
          latitude: row.latitude ?? person.latitude ?? null,
          longitude: row.longitude ?? person.longitude ?? null,
          accuracyM: friendAccuracyM,
          battery,
          state,
          status,
          lastSeen,
          movementText,
          broadcasting: !!row.broadcasting,
        };

        if (
          !person.isMe &&
          myLiveLocation &&
          nextPerson.latitude != null &&
          nextPerson.longitude != null
        ) {
          const meters = getDistanceMeters(myLiveLocation, {
            latitude: nextPerson.latitude,
            longitude: nextPerson.longitude,
          });

          if (meters != null) {
            if (meters <= 8) nextPerson.distance = "Very close";
            else if (meters <= 20) nextPerson.distance = "Nearby";
            else if (meters < 1000) nextPerson.distance = `${Math.round(meters)}m away`;
            else nextPerson.distance = `${(meters / 1000).toFixed(1)}km away`;
          }
        }

        return nextPerson;
      })
    );
  }

  function handleCrewCardPress(person) {
    if (!person) return;

    if (person.isMe) {
      openPersonEditor(person);
      return;
    }

    setMapFocusRequest({
      type: "friend",
      id: person.id,
      ts: Date.now(),
    });

    setTab("map");
  }

  function handleOpenPrivateThread(userId) {
    if (!userId) return;

    setDmUnreadByUserId((prevUnread) => {
      const nextUnread = { ...prevUnread };
      delete nextUnread[userId];
      return nextUnread;
    });
  }

  useEffect(() => {
    const others = crew.filter((person) => !person.isMe);

    if (!others.length) {
      setSelectedPrivateUserId(null);
      return;
    }

    if (!selectedPrivateUserId) {
      setSelectedPrivateUserId(others[0].id);
      return;
    }

    const stillExists = others.some((person) => person.id === selectedPrivateUserId);
    if (!stillExists) {
      setSelectedPrivateUserId(others[0].id);
    }
  }, [crew, selectedPrivateUserId]);

  useEffect(() => {
    if (!eventId || !currentUserId) return;
    console.log("TT_DM_UNREAD_ATTACH", {
      eventId,
      currentUserId,
    });
    const channel = supabase
      .channel(`dm-unread-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "event_private_messages",
        },
        async (payload) => {
          try {
            const row = payload?.new;

            if (!row?.thread_id || !row?.sender_user_id || !row?.event_id) return;
            if (row.event_id !== eventId) return;
            const senderUserId = row.sender_user_id || row.senderUserId;

            if (senderUserId === currentUserId) return;

            const { data: thread, error } = await supabase
              .from("event_private_threads")
              .select("id, user_a_id, user_b_id")
              .eq("id", row.thread_id)
              .single();

            if (error || !thread) {
              return;
            }

            const isMyThread =
              thread.user_a_id === currentUserId ||
              thread.user_b_id === currentUserId;

            if (!isMyThread) return;

            const otherUserId =
              thread.user_a_id === currentUserId
                ? thread.user_b_id
                : thread.user_a_id;

            if (!otherUserId) return;

            const privateThreadAlreadyOpen =
              tabRef.current === "chat" &&
              chatModeRef.current === "private" &&
              selectedPrivateUserIdRef.current === otherUserId;

            if (privateThreadAlreadyOpen) return;

            console.log("increment unread for", otherUserId);

            setDmUnreadByUserId((prev) => ({
              ...prev,
              [otherUserId]: (prev[otherUserId] || 0) + 1,
            }));
          } catch (error) {
            console.log("dm unread listener error:", error);
          }
        }
      )
      .subscribe((status) => {
        console.log("dm unread channel status", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, currentUserId]);
  useEffect(() => {
    selectedPrivateUserIdRef.current = selectedPrivateUserId;
  }, [selectedPrivateUserId]);

  useEffect(() => {
    console.log("TT_GROUP_UNREAD_EFFECT_RUN", {
      eventId,
      currentUserId,
    });

    if (!eventId || !currentUserId) return;

    const channel = supabase
      .channel(`group-unread-${eventId}-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "event_messages",
          // filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const row = payload?.new;
          if (!row?.id) return;
          if (row.sender_user_id === currentUserId) return;

          const groupChatIsActuallyVisible =
            tabRef.current === "chat" &&
            chatModeRef.current === "group";

          console.log("TT_GROUP_UNREAD_CHECK", {
            messageId: row.id,
            tab: tabRef.current,
            chatMode: chatModeRef.current,
            groupChatIsActuallyVisible,
          });

          if (!groupChatIsActuallyVisible) {
            setGroupUnread(true);
          }
        }
      )
      .subscribe((status) => {
        console.log("TT_GROUP_UNREAD_STATUS", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, currentUserId]);
  useEffect(() => {
    let isActive = true;

    function openFromNotificationData(data) {
      if (!data) return;

      if (data.kind === "need_help" && data.fromUserId) {
        setAlertsUnread(true);
        setMapFocusRequest({
          type: "friend",
          id: data.fromUserId,
          ts: Date.now(),
        });
        setTab("map");
        return;
      }

      const isMeetupPush =
        data.kind === "meetup_soon" || data.kind === "meetup_now";

      if (isMeetupPush && data.pinId) {
        setAlertsUnread(true);
        setMapFocusRequest({
          type: "pin",
          pinId: data.pinId,
          ts: Date.now(),
        });
        setTab("map");
      }
    }

    async function setupPush() {
      try {
        const token = await registerForPushNotificationsAsync();
        if (!isActive || !token) return;

        await saveMyExpoPushToken(token);

        const lastResponse =
          await Notifications.getLastNotificationResponseAsync();

        const lastData =
          lastResponse?.notification?.request?.content?.data;

        openFromNotificationData(lastData);
      } catch (e) {
        console.log("setupPush error:", e);
      }
    }

    setupPush();

    const responseSub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response?.notification?.request?.content?.data || {};
        openFromNotificationData(data);
      }
    );

    return () => {
      isActive = false;
      responseSub.remove();
    };
  }, []);

  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  useEffect(() => {
    if (tab !== "map" && isMapExpanded) {
      setIsMapExpanded(false);
    }
  }, [tab, isMapExpanded]);

  useEffect(() => {
    if (tab !== "map") return;
    if (!eventId) return;

    //console.log("TT_MAP_TAB_REFRESH");

    refreshBundle(eventId, latestLocationRef.current);
    setPinReloadKey((prev) => prev + 1);
  }, [tab, eventId]);

  useEffect(() => {
    const boot = async () => {
      try {
        const userId = await getCurrentUserId();
        setCurrentUserId(userId);
        console.log("boot: current user", userId);

        const storedId = await getStoredEventId();
        console.log("boot: stored event id =", storedId);

        if (storedId) {
          console.log("TT_BOOT_REJOIN_EVENT_ONLY", storedId);

          setEventId(storedId);

          setTimeout(() => {
            refreshBundle(storedId, latestLocationRef.current);
            setPinReloadKey((prev) => prev + 1);
          }, 1000);
        }

        await AsyncStorage.setItem(CURRENT_USER_ID_KEY, userId);

        return userId;
      } catch (e) {
        console.log("boot error:", e);
      }
    };

    boot();
  }, []);
  useEffect(() => {
    if (!eventId) return;

    console.log("TT_SUBSCRIBE_ATTACH", { eventId });

    const unsubscribe = subscribeToEvent(eventId, {
      onPresenceChange: (payload) => {
        const row = payload?.new;
        if (!row?.user_id) return;

        const lat = Number(row.latitude);
        const lng = Number(row.longitude);

        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lng) ||
          Math.abs(lat) > 90 ||
          Math.abs(lng) > 180 ||
          (lat === 0 && lng === 0)
        ) {
          console.log("TT_REJECT_BAD_PRESENCE_ROW", {
            userId: row.user_id,
            lat,
            lng,
          });
          return;
        }

        console.log("TT_LIVE_PRESENCE_APPLY", {
          userId: row.user_id,
          lat,
          lng,
          updatedAt: row.updated_at,
        });

        lastKnownCrewCoordsRef.current[row.user_id] = {
          latitude: lat,
          longitude: lng,
          accuracyM: row.accuracy_m ?? null,
        };

        applyPresenceRowToCrew({
          ...row,
          latitude: lat,
          longitude: lng,
        });
      },

      onMembersChange: () => {
        scheduleRefreshBundle(eventId, latestLocationRef.current);
      },
    });

    return () => {
      console.log("TT_SUBSCRIBE_CLEANUP", { eventId });
      unsubscribe?.();
    };
  }, [eventId]);


  useEffect(() => {
    if (tab !== "chat") return;
    if (chatMode !== "group") return;
    if (!groupUnread) return;

    setGroupUnread(false);

    if (latestGroupMessageIdRef.current) {
      lastSeenGroupMessageIdRef.current = latestGroupMessageIdRef.current;
    }
  }, [tab, chatMode, groupUnread]);

  useEffect(() => {
    if (!eventId) return;

    const interval = setInterval(() => {
      console.log("TT_POLL_REFRESH_FIRE", {
        eventId,
        tab: tabRef.current,
      });

      refreshBundle(eventId, latestLocationRef.current);
    }, 100000);

    return () => clearInterval(interval);
  }, [eventId]);

  useEffect(() => {
    let interval;

    async function updateBattery() {
      try {
        const state = await Battery.getPowerStateAsync();
        const level = state.batteryLevel ?? 0;
        const percent = level < 0 ? 0 : Math.round(level * 100);
        setMyBatteryPercent(percent);
      } catch (e) {
      }
    }

    updateBattery();
    interval = setInterval(updateBattery, 10000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let lastMagnitude = null;
    let stillCount = 0;

    Accelerometer.setUpdateInterval(500);

    const sub = Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);

      if (lastMagnitude != null) {
        const delta = Math.abs(magnitude - lastMagnitude);

        if (delta < 0.02) {
          stillCount += 1;
        } else {
          stillCount = 0;
        }

        const nextStationary = stillCount >= 4;
        setIsStationary(nextStationary);


      }

      lastMagnitude = magnitude;
    });

    return () => {
      sub.remove();
    };
  }, []);

  useEffect(() => {
    async function handleMotionWake() {
      const wasStationary = wasStationaryRef.current;
      const isNowMoving = !isStationary;

      // only fire when we go from still -> moving
      if (!(wasStationary && isNowMoving)) {
        wasStationaryRef.current = isStationary;
        return;
      }

      if (!eventId || !myLiveLocation) {
        wasStationaryRef.current = isStationary;
        return;
      }

      const now = Date.now();

      // cooldown so tiny jitter doesn't spam writes
      if (now - lastMotionWakeAtRef.current < 15000) {
        console.log("TT_MOTION_WAKE_SKIP: cooldown active");
        wasStationaryRef.current = isStationary;
        return;
      }

      try {
        console.log("TT_MOTION_WAKE_FIRE", {
          latitude: myLiveLocation.latitude,
          longitude: myLiveLocation.longitude,
          accuracyM: myLiveLocation.accuracyM,
        });
        if (
          typeof myLiveLocation.latitude !== "number" ||
          !Number.isFinite(myLiveLocation.latitude) ||
          typeof myLiveLocation.longitude !== "number" ||
          !Number.isFinite(myLiveLocation.longitude) ||
          Math.abs(myLiveLocation.latitude) > 90 ||
          Math.abs(myLiveLocation.longitude) > 180 ||
          (myLiveLocation.latitude === 0 && myLiveLocation.longitude === 0)
        ) {
          console.log("TT_REJECT_MOTION_BAD_COORDS", myLiveLocation);
          return;
        }
        await upsertMyPresence({
          eventId,
          latitude: myLiveLocation.latitude,
          longitude: myLiveLocation.longitude,
          accuracyM: myLiveLocation.accuracyM,
          batteryPercent: myBatteryPercent,
          broadcasting: true,
          lastMovementAt: new Date().toISOString(),
        });

        lastPresenceSentAtRef.current = now;
        lastPresenceSentCoordsRef.current = {
          latitude: myLiveLocation.latitude,
          longitude: myLiveLocation.longitude,
        };
        lastMotionWakeAtRef.current = now;

        console.log("TT_MOTION_WAKE_UPSERT_OK");
      } catch (e) {
        console.log("TT_MOTION_WAKE_UPSERT_FAIL:", e);
      } finally {
        wasStationaryRef.current = isStationary;
      }
    }

    handleMotionWake();
  }, [isStationary, eventId, myLiveLocation, myBatteryPercent]);

  useEffect(() => {
    let subscription;


    async function startLiveLocation() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Highest,
            timeInterval: 3000,
            distanceInterval: 3,
          },
          async (pos) => {
            /*  console.log("TT_FG_FIRE: foreground watcher fired", {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
                timestamp: pos.timestamp,
              });*/

            const nextLoc = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracyM: pos.coords.accuracy,
            };

            setMyLiveLocation(nextLoc);

            if (!eventId) return;

            try {
              const now = Date.now();
              const lastSentAt = lastPresenceSentAtRef.current;
              const lastSentCoords = lastPresenceSentCoordsRef.current;

              const metersSinceLastSend = lastSentCoords
                ? getDistanceMeters(lastSentCoords, nextLoc)
                : null;

              const HEARTBEAT_MS = 30000;
              const MOVE_THRESHOLD_M = 5;

              const enoughTimePassed = now - lastSentAt >= HEARTBEAT_MS;
              const movedEnough =
                metersSinceLastSend != null && metersSinceLastSend >= MOVE_THRESHOLD_M;
              const firstSend = !lastSentCoords;

              /* console.log("TT_FG_CHECK:", {
                 firstSend,
                 metersSinceLastSend,
                 enoughTimePassed,
                 movedEnough,
                 heartbeatMs: HEARTBEAT_MS,
                 moveThresholdM: MOVE_THRESHOLD_M,
               });
 
               console.log("TT_DECISION:", {
                 firstSend,
                 metersSinceLastSend,
                 enoughTimePassed,
                 movedEnough,
               });*/

              const shouldSend = firstSend || movedEnough || enoughTimePassed;

              if (!shouldSend) {
                // console.log("TT_FG_SKIP: not sending presence");
                return;
              }

              // console.log("TT_DB_WRITE_START");
              if (
                typeof latitude !== "number" ||
                !Number.isFinite(latitude) ||
                typeof longitude !== "number" ||
                !Number.isFinite(longitude) ||
                Math.abs(latitude) > 90 ||
                Math.abs(longitude) > 180 ||
                (latitude === 0 && longitude === 0)
              ) {
                console.log("TT_REJECT_BAD_COORDS", {
                  latitude,
                  longitude,
                });
                return;
              }

              await upsertMyPresence({
                eventId,
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracyM: pos.coords.accuracy,
                batteryPercent: myBatteryPercent,
                broadcasting: true,
                lastMovementAt: movedEnough || firstSend ? new Date().toISOString() : null,
              });

              /* console.log("TT_FG_UPSERT_OK:", {
                 eventId,
                 latitude: pos.coords.latitude,
                 longitude: pos.coords.longitude,
                 accuracyM: pos.coords.accuracy,
                 batteryPercent: myBatteryPercent,
               });*/

              lastPresenceSentAtRef.current = now;
              lastPresenceSentCoordsRef.current = {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
              };
            } catch (e) {
              /*  console.log("TT_FG_UPSERT_FAIL:", e);*/
            }
          }
        );
      } catch (e) {
      }
    }

    startLiveLocation();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [eventId,]);





  async function handleJoinEvent() {
    try {
      setJoiningEvent(true);

      const event = await joinEventByCode(joinCode);
      //  console.log("TT_HANDLE_JOIN_EVENT_RESULT", event);
      if (!event?.id) {
        throw new Error("Join failed: no event returned");
      }

      setEventId(event.id);
      setEventName(event.title || "My Night Out");
      setInviteCode(event.invite_code || "");

      await setStoredEventId(event.id);
      console.log("handleJoinEvent: stored event id", event.id);
      await forceInitialPresenceWrite(event.id, myLiveLocation);
      await refreshBundle(event.id, myLiveLocation);
      setPinReloadKey((prev) => prev + 1);
    } catch (e) {
      alert(e?.message || "Failed to join event");
    } finally {
      setJoiningEvent(false);
    }
  }

  async function handleLeaveEvent() {
    const leavingEventId = eventId;

    try {
      if (leavingEventId) {
        await leaveCurrentEvent(leavingEventId);
      }
    } catch (e) {
      console.log("TT_LEAVE_EVENT_BACKEND_FAIL", e);
    }

    trackingStartedForRef.current = null;
    await stopTripperTrackLocation();
    await clearStoredEventId();

    setEventId(null);
    setCrew([]);
    setInviteCode("");
    setEventName("My Night Out");
    setPinReloadKey(0);
    setYouOkReloadKey(0);
    setAlertsUnread(false);
    setGroupUnread(false);
    setDmUnreadByUserId({});
    setSelectedPrivateUserId(null);
  }


  async function openYouOk(person) {
    if (!person || person.isMe || !eventId) return;
    setYouOkTarget(person);
  }

  async function sendYouOk() {
    if (!youOkTarget || !eventId) return;

    try {
      const me = crew.find((person) => person.isMe);

      await sendYouOkCheckIn(eventId, youOkTarget.id);

      try {
        await triggerYouOkPush({
          eventId,
          toUserId: youOkTarget.id,
          fromUserId: currentUserId,
          name: me?.name || "Someone",
        });
      } catch (pushError) {
        console.log("You OK push failed:", pushError);
      }

      setYouOkTarget(null);
      setYouOkReloadKey((prev) => prev + 1);
    } catch (e) {
      alert(e?.message || "Failed to send check-in");
    }
  }

  async function hasInternetConnection() {
    try {
      const controller = new AbortController();

      const timeout = setTimeout(() => {
        controller.abort();
      }, 2500);

      await fetch("https://www.google.com/generate_204", {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeout);
      return true;
    } catch (e) {
      return false;
    }
  }

  async function openComeFindMeSmsIfOffline() {
    const online = await hasInternetConnection();

    if (online) {
      return;
    }

    const isAvailable = await SMS.isAvailableAsync();
    if (!isAvailable) return;

    if (!myLiveLocation?.latitude || !myLiveLocation?.longitude) {
      return;
    }

    const me = crew.find((person) => person.isMe);
    const name = me?.name || "Someone";
    const battery =
      typeof myBatteryPercent === "number" ? `${myBatteryPercent}%` : "Unknown";

    const lat = myLiveLocation.latitude;
    const lng = myLiveLocation.longitude;

    const message =
      `📍 Come find me — I'm a bit lost\n\n` +
      `${name} is here:\n` +
      `https://maps.google.com/?q=${lat},${lng}\n\n` +
      `🔋 Battery: ${battery}\n` +
      `Sent from TripperTrack`;

    const crewNumbers = crew
      .filter((person) => !person.isMe)
      .map((person) => person.phoneNumber)
      .filter(Boolean);

    const uniqueRecipients = [...new Set(crewNumbers)];

    try {
      await SMS.sendSMSAsync(uniqueRecipients, message);
    } catch (e) {
      console.log("Come Find Me SMS failed:", e);
    }
  }

  async function openNeedHelpSms() {
    const isAvailable = await SMS.isAvailableAsync();
    if (!isAvailable) return;

    if (!myLiveLocation?.latitude || !myLiveLocation?.longitude) {
      return;
    }

    const me = crew.find((person) => person.isMe);
    const name = me?.name || "Someone";
    const battery =
      typeof myBatteryPercent === "number" ? `${myBatteryPercent}%` : "Unknown";

    const timestamp = new Date().toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });

    const lat = myLiveLocation.latitude;
    const lng = myLiveLocation.longitude;

    const message =
      `🚨 ${name} needs help\n\n` +
      `📍 Location:\nhttps://maps.google.com/?q=${lat},${lng}\n\n` +
      `🔋 Battery: ${battery}\n` +
      `⏱ Last seen: ${timestamp}`;

    const recipients = [];

    if (me?.helpSmsCrew) {
      const crewNumbers = crew
        .filter((person) => !person.isMe)
        .map((person) => person.phoneNumber)
        .filter(Boolean);

      recipients.push(...crewNumbers);
    }

    if (me?.helpSmsEmergency && me?.emergencyContactNumber) {
      recipients.push(me.emergencyContactNumber);
    }

    const uniqueRecipients = [...new Set(recipients)];

    if (uniqueRecipients.length === 0) {
      console.log("TT_HELP_SMS_SKIP: no SMS recipients selected");
      return;
    }

    try {
      await SMS.sendSMSAsync(uniqueRecipients, message);
    } catch (e) {
      console.log("Need help SMS failed:", e);
    }
  }

  async function handleNeedHelp() {
    if (!eventId) return;

    try {
      await sendNeedHelpAlert(eventId);
      setYouOkReloadKey((prev) => prev + 1);

      const me = crew.find((person) => person.isMe);
      const fromUserId = me?.id || currentUserId || null;

      if (
        myLiveLocation?.latitude != null &&
        myLiveLocation?.longitude != null &&
        fromUserId
      ) {
        try {
          await triggerNeedHelpPush({
            eventId,
            name: me?.name || "Someone",
            batteryPercent: myBatteryPercent,
            latitude: myLiveLocation.latitude,
            longitude: myLiveLocation.longitude,
            timestamp: new Date().toISOString(),
            fromUserId,
          });
        } catch (pushError) {
          console.log("Need help push failed:", pushError);
        }
      }

      try {
        await openNeedHelpSms();
      } catch (smsError) {
        console.log("Need help SMS failed:", smsError);
      }
    } catch (e) {
      console.log("handleNeedHelp error:", e);
      alert(e?.message || "Failed to send help alert");
    }
  }

  function handleFindPerson(person) {
    if (!person) return;
    //console.log("TT_FIND_PERSON", person);
    setMapFocusRequest({
      type: person.isMe ? "me" : "friend",
      id: person.id,
      ts: Date.now(),
    });

    setTab("map");
  }

  function handleMapFocusHandled() {
    setMapFocusRequest(null);
  }

  function handlePressChatUser(user) {
    if (!user?.id) return;

    setMapFocusRequest({
      type: user.id === currentUserId ? "me" : "friend",
      id: user.id,
      ts: Date.now(),
    });

    setTab("map");
  }

  function openPersonEditor(person) {
    if (!person.isMe) return;
    setEditingPerson(person);
    setEditPersonName(person.name);
    setEditPersonEmoji(person.emoji || "🧑");
    setEditPhoneNumber(person.phoneNumber || "");
    setEditEmergencyContactNumber(person.emergencyContactNumber || "");
    setEditHelpSmsCrew(!!person.helpSmsCrew);
    setEditHelpSmsEmergency(!!person.helpSmsEmergency);
  }

  async function savePersonEditor() {
    if (!editingPerson) return;

    const trimmedName = editPersonName.trim();
    if (!trimmedName) return;

    try {
      await updateMyProfile({
        name: trimmedName,
        emoji: editPersonEmoji,
        phoneNumber: editPhoneNumber,
        emergencyContactNumber: editEmergencyContactNumber,
        helpSmsCrew: editHelpSmsCrew,
        helpSmsEmergency: editHelpSmsEmergency,
      });

      setEditingPerson(null);

      if (eventId) {
        await refreshBundle(eventId, myLiveLocation);
      }
    } catch (e) {
      alert(e?.message || "Failed to save profile");
    }
  }



  if (!eventId) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ flex: 1 }}>
          <EventGate
            creating={creatingEvent}
            joining={joiningEvent}
            createTitle={createTitle}
            setCreateTitle={setCreateTitle}
            joinCode={joinCode}
            setJoinCode={setJoinCode}
            onCreate={handleCreateEvent}
            onJoin={handleJoinEvent}
            onScanQr={openQrScanner}
            onSignOut={signOutEverywhere}
          />

          {showQrScanner && (
            <View style={styles.pinPickerOverlay}>
              <View style={styles.scannerCard}>
                <Text style={styles.pinPickerTitle}>Scan invite QR</Text>

                <Text style={styles.sheetSub}>
                  Point the camera at a TripperTrack invite code.
                </Text>

                <View style={styles.scannerViewport}>
                  <CameraView
                    style={StyleSheet.absoluteFillObject}
                    facing="back"
                    barcodeScannerSettings={{
                      barcodeTypes: ["qr"],
                    }}
                    onBarcodeScanned={hasScannedQr ? undefined : handleQrScanned}
                  />
                </View>

                <View style={styles.sheetButtonsRow}>
                  <TouchableOpacity
                    style={[styles.sheetBtnSmall, { backgroundColor: COLORS.card2 }]}
                    onPress={() => {
                      setShowQrScanner(false);
                      setHasScannedQr(false);
                    }}
                  >
                    <Text style={styles.sheetBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View
        style={[
          styles.container,
          tab === "map" && isMapExpanded && styles.containerMapExpanded,
        ]}
      >

        {!(tab === "map" && isMapExpanded) && (
          <View style={styles.header}>
            <Image
              source={require("../assets/images/icon.png")}
              style={styles.headerLogo}
              resizeMode="contain"
            />

            <View style={styles.headerRight}>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.headerPill}
                  onPress={() => setShowQrModal(true)}
                >
                  <Text style={styles.headerPillText}>Show QR</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.headerPill}
                  onPress={handleShareWhatsAppInvite}
                >
                  <Text style={styles.headerPillText}>Invite</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.headerPill}
                  onPress={handleLeaveEvent}
                >
                  <View style={styles.headerPillDot} />
                  <Text style={styles.headerPillText}>Leave</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                activeOpacity={isOwner ? 0.85 : 1}
                onPress={isOwner ? openRenameEventModal : undefined}
              >
                <Text style={styles.headerEventName} numberOfLines={2}>
                  {eventName}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.contentArea}>
          <View style={[styles.screenWrap, tab !== "crew" && styles.hiddenScreen]}>
            <CrewScreen
              crew={crew}
              onPressPerson={handleCrewCardPress}
              onFindPerson={handleFindPerson}
              onYouOk={openYouOk}
            />
          </View>

          <View style={[styles.screenWrap, tab !== "map" && styles.hiddenScreen]}>
            <MapScreen
              eventId={eventId}
              isActive={tab === "map"}
              crew={crew}
              myLocation={myLiveLocation}
              isStationary={isStationary}
              focusRequest={mapFocusRequest}
              onFocusHandled={handleMapFocusHandled}
              onYouOk={openYouOk}
              onNeedHelp={handleNeedHelp}
              onComeFindMeSms={openComeFindMeSmsIfOffline}

              isExpanded={isMapExpanded}
              onToggleExpanded={() => setIsMapExpanded((prev) => !prev)}
              pinReloadKey={pinReloadKey}
              onPinsChanged={() => setPinReloadKey((prev) => prev + 1)}
            />
          </View>

          <View style={[styles.screenWrap, tab !== "alerts" && styles.hiddenScreen]}>
            <AlertsScreen
              eventId={eventId}
              pinReloadKey={pinReloadKey}
              youOkReloadKey={youOkReloadKey}
              activeTab={tab}
              currentUserId={currentUserId}
              onNeedHelp={handleNeedHelp}
              crew={crew}
              onIncomingAlert={() => {
                if (tabRef.current !== "alerts") {
                  setAlertsUnread(true);
                }
              }}
              onIncomingNeedHelp={(alert) => {
                if (!alert?.fromUserId) return;
                if (alert.toUserId !== currentUserId) return;

                setAlertsUnread(true);
                setMapFocusRequest({
                  type: "friend",
                  id: alert.fromUserId,
                  ts: Date.now(),
                });
                setTab("map");
              }}
              onOpenAlert={(alert) => {
                if (!alert) return;

                if (alert.type === "meetup" && alert.pinId) {
                  setMapFocusRequest({
                    type: "pin",
                    pinId: alert.pinId,
                    ts: Date.now(),
                  });
                  setTab("map");
                  return;
                }

                const isHelpAlert =
                  alert.type === "checkin" &&
                  (alert.kind === "you_ok_reply_help" || alert.kind === "need_help");

                if (isHelpAlert && alert.fromUserId) {
                  setMapFocusRequest({
                    type: "friend",
                    id: alert.fromUserId,
                    ts: Date.now(),
                  });
                  setTab("map");
                  return;
                }

                if (alert.type === "checkin" && alert.fromUserId) {
                  setMapFocusRequest({
                    type: "friend",
                    id: alert.fromUserId,
                    ts: Date.now(),
                  });
                  setTab("map");
                }
              }}
            />
          </View>

          <View style={[styles.screenWrap, tab !== "chat" && styles.hiddenScreen]}>
            <View style={styles.chatModeTabsWrap}>
              <TouchableOpacity
                style={[
                  styles.chatModeTab,
                  styles.chatModeTabWithDot,
                  chatMode === "group" && styles.chatModeTabActive,
                ]}
                onPress={() => {
                  setChatMode("group");
                  setGroupUnread(false);

                  if (latestGroupMessageIdRef.current) {
                    lastSeenGroupMessageIdRef.current = latestGroupMessageIdRef.current;
                  }
                }}
              >
                <Text
                  style={[
                    styles.chatModeTabText,
                    chatMode === "group" && styles.chatModeTabTextActive,
                  ]}
                >
                  Group
                </Text>

                {groupUnread && chatMode !== "group" ? (
                  <View style={styles.chatTabUnreadDot} />
                ) : null}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.chatModeTab,
                  styles.chatModeTabWithDot,
                  chatMode === "private" && styles.chatModeTabActive,
                ]}
                onPress={() => setChatMode("private")}
              >
                <Text
                  style={[
                    styles.chatModeTabText,
                    chatMode === "private" && styles.chatModeTabTextActive,
                  ]}
                >
                  Private
                </Text>

                {totalDmUnread > 0 && chatMode !== "private" ? (
                  <View style={styles.chatTabUnreadDot} />
                ) : null}
              </TouchableOpacity>
            </View>

            {chatMode === "group" ? (
              <CrewChatScreen
                eventId={eventId}
                currentUserId={currentUserId}
                activeTab={tab}
                chatMode={chatMode}
                onPressUser={handlePressChatUser}
                onIncomingGroupMessage={() => {
                  const groupChatIsActuallyVisible =
                    tabRef.current === "chat" &&
                    chatModeRef.current === "group";

                  console.log("TT_GROUP_UNREAD_FROM_CHAT_SCREEN", {
                    groupChatIsActuallyVisible,
                    tab: tabRef.current,
                    chatMode: chatModeRef.current,
                  });

                  if (!groupChatIsActuallyVisible) {
                    setGroupUnread(true);
                  }
                }}
              />
            ) : null}

            {chatMode === "private" ? (
              <PrivateChatScreen
                eventId={eventId}
                currentUserId={currentUserId}
                crew={crew}
                selectedUserId={selectedPrivateUserId}
                onSelectUser={setSelectedPrivateUserId}
                dmUnreadByUserId={dmUnreadByUserId}
                onOpenThread={handleOpenPrivateThread}
              />
            ) : null}
          </View>

          {youOkTarget && (
            <View style={styles.pinPickerOverlay}>
              <View style={styles.pinPickerCard}>
                <Text style={styles.pinPickerTitle}>You OK?</Text>
                <Text style={styles.sheetSub}>Check on {youOkTarget.name} now?</Text>
                <Text style={styles.sheetSub}>
                  This will send a quick check-in ping.
                </Text>

                <View style={styles.sheetButtonsRow}>
                  <TouchableOpacity
                    style={[styles.sheetBtnSmall, { backgroundColor: COLORS.card2 }]}
                    onPress={() => setYouOkTarget(null)}
                  >
                    <Text style={styles.sheetBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.sheetBtnSmall, { backgroundColor: COLORS.purple }]}
                    onPress={sendYouOk}
                  >
                    <Text style={styles.sheetBtnText}>Send</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {showRenameEventModal && (
            <View style={styles.pinPickerOverlay}>
              <View style={styles.pinPickerCard}>
                <Text style={styles.pinPickerTitle}>Rename event</Text>

                <TextInput
                  style={styles.editInput}
                  value={renameEventDraft}
                  onChangeText={setRenameEventDraft}
                  placeholder="Event name"
                  placeholderTextColor={COLORS.sub}
                />

                <View style={styles.sheetButtonsRow}>
                  <TouchableOpacity
                    style={[styles.sheetBtnSmall, { backgroundColor: COLORS.card2 }]}
                    onPress={() => setShowRenameEventModal(false)}
                  >
                    <Text style={styles.sheetBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.sheetBtnSmall, { backgroundColor: COLORS.green }]}
                    onPress={handleSaveEventName}
                  >
                    <Text style={styles.sheetBtnText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {editingPerson && (
            <View style={styles.pinPickerOverlay}>
              <View style={styles.pinPickerCard}>
                <ScrollView
                  contentContainerStyle={styles.editModalContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >


                  <TextInput
                    style={styles.editInput}
                    value={editPersonName}
                    onChangeText={setEditPersonName}
                    placeholder="Your name"
                    placeholderTextColor={COLORS.sub}
                  />

                  <TextInput
                    style={styles.editInput}
                    value={editPhoneNumber}
                    onChangeText={setEditPhoneNumber}
                    placeholder="Your phone number"
                    placeholderTextColor={COLORS.sub}
                    keyboardType="phone-pad"
                  />

                  <TextInput
                    style={styles.editInput}
                    value={editEmergencyContactNumber}
                    onChangeText={setEditEmergencyContactNumber}
                    placeholder="Emergency contact number"
                    placeholderTextColor={COLORS.sub}
                    keyboardType="phone-pad"
                  />

                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.smsSettingRow}
                    onPress={() => setEditHelpSmsCrew((prev) => !prev)}
                  >
                    <Text style={styles.smsSettingTick}>
                      {editHelpSmsCrew ? "☑" : "☐"}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.smsSettingTitle}>Help SMS crew</Text>
                      <Text style={styles.smsSettingSub}>
                        Opens SMS to crew numbers.
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.smsSettingRow}
                    onPress={() => setEditHelpSmsEmergency((prev) => !prev)}
                  >
                    <Text style={styles.smsSettingTick}>
                      {editHelpSmsEmergency ? "☑" : "☐"}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.smsSettingTitle}>Help SMS emergency contact</Text>
                      <Text style={styles.smsSettingSub}>
                        Opens SMS to your emergency contact when you press Need Help.
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <ScrollView
                    style={{ maxHeight: 250 }}
                    contentContainerStyle={styles.emojiPickerGrid}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled={true}
                  >
                    {[

                      "😎", "🤩", "🤪", "🤠", "😈", "🫠", "🥸", "🫨", "🥷", "🤖", "👾", "👽", "👻", "💀",
                      "🐻", "🦊", "🐸", "🐼", "🐯", "🦁", "🐵", "🐨", "🪿", "🦄", "🪅",
                      "🎧", "🔥", "🌈", "⚡", "🚀", "🍄", "🌙", "⭐", "🎱", "☄️",
                      "🍩", "🧁", "🍧", "🥑", "🍓", "🍉", "🍋‍🟩",
                      "🦀", "🪼", "🐠", "🦈",
                      "🦋", "🐝", "🐛", "🐞", "🐌",
                      "🏴‍☠️", "☢️", "☣️", "♠️"
                    ].map((emoji) => (
                      <TouchableOpacity
                        key={emoji}
                        style={[
                          styles.emojiOption,
                          editPersonEmoji === emoji && styles.emojiOptionSelected,
                        ]}
                        onPress={() => setEditPersonEmoji(emoji)}
                      >
                        <Text style={styles.emojiOptionText}>{emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <View style={styles.sheetButtonsRow}>
                    <TouchableOpacity
                      style={[styles.sheetBtnSmall, { backgroundColor: COLORS.card2 }]}
                      onPress={() => setEditingPerson(null)}
                    >
                      <Text style={styles.sheetBtnText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.sheetBtnSmall, { backgroundColor: COLORS.green }]}
                      onPress={savePersonEditor}
                    >
                      <Text style={styles.sheetBtnText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </View>
          )}

          {showQrModal && (
            <View style={styles.pinPickerOverlay}>
              <View style={styles.pinPickerCard}>
                <Text style={styles.pinPickerTitle}>Event invite QR</Text>

                <Text style={styles.sheetSub}>
                  Scan to join this TripperTrack event.
                </Text>

                <View style={styles.qrCard}>
                  {inviteCode ? (
                    <QRCode
                      value={`trippertrack://join?code=${inviteCode}`}
                      size={220}
                    />
                  ) : (
                    <Text style={styles.placeholderText}>No invite code yet</Text>
                  )}
                </View>

                <Text style={styles.qrCodeText}>
                  {inviteCode || "No code"}
                </Text>

                <Text style={styles.sheetSub}>
                  Invite code: {inviteCode || "Unavailable"}
                </Text>

                <View style={styles.sheetButtonsRow}>
                  <TouchableOpacity
                    style={[styles.sheetBtnSmall, { backgroundColor: COLORS.card2 }]}
                    onPress={() => setShowQrModal(false)}
                  >
                    <Text style={styles.sheetBtnText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          <View style={styles.tabBar}>
            <TouchableOpacity style={styles.tabItem} onPress={() => setTab("crew")}>
              <Text style={[styles.tabText, tab === "crew" && styles.tabActive]}>
                Crew
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.tabItem} onPress={() => setTab("map")}>
              <Text style={[styles.tabText, tab === "map" && styles.tabActive]}>
                Map
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => {
                setTab("alerts");
                setAlertsUnread(false);
              }}
            >
              <View style={styles.tabLabelWrap}>
                <Text style={[styles.tabText, tab === "alerts" && styles.tabActive]}>
                  Alerts
                </Text>
                {alertsUnread ? <View style={styles.alertsUnreadDot} /> : null}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => {
                setTab("chat");
              }}
            >
              <View style={styles.tabLabelWrap}>
                <Text style={[styles.tabText, tab === "chat" && styles.tabActive]}>
                  Chat
                </Text>
                {(groupUnread || totalDmUnread > 0) ? (
                  <View style={styles.alertsUnreadDot} />
                ) : null}
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView >
  );
}




export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  if (authLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
          <Text style={styles.title}>TripperTrack</Text>
          <Text style={styles.subtitle}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }
  return <TripperTrackMain />;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 16,
    paddingTop: 10,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingTop: 6,
  },

  title: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  subtitle: {
    color: COLORS.sub,
    fontSize: 13,
    marginTop: 2,
  },
  headerPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginTop: 6,
  },
  headerPillDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: COLORS.green,
    marginRight: 8,
  },
  headerPillText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
  },
  contentArea: {
    flex: 1,
  },
  banner: {
    backgroundColor: COLORS.card2,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  bannerText: {
    color: COLORS.sub,
    fontSize: 13,
    fontWeight: "600",
  },
  listContent: {
    paddingBottom: 16,
  },
  card: {
    flexDirection: "row",
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#20293A",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
  },
  cardMain: {
    flex: 1,
    minWidth: 0,
  },

  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  name: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
  },
  lastSeen: {
    color: COLORS.sub,
    fontSize: 13,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  metaText: {
    color: COLORS.sub,
    fontSize: 12,
    fontWeight: "600",
  },
  metaDivider: {
    color: COLORS.sub,
    marginHorizontal: 8,
  },
  cardButtonsRow: {
    flexDirection: "row",
    marginTop: 12,
  },
  smallButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginRight: 10,
    alignSelf: "flex-start",
  },

  smallPurple: {
    backgroundColor: COLORS.purple,
  },

  smallGreen: {
    backgroundColor: "#2F9E44",
  },
  smallButtonText: {
    color: "white",
    fontWeight: "800",
    fontSize: 13,
  },
  mapScreenWrap: {
    flex: 1,
  },
  mapBannerRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  smallBanner: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  mapBannerLeft: {
    backgroundColor: COLORS.card2,
  },
  smallBannerText: {
    color: COLORS.sub,
    fontSize: 12,
    fontWeight: "700",
  },
  fakeMap: {
    flex: 1,
    backgroundColor: "#101622",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    position: "relative",
    marginBottom: 12,
  },
  mapGridOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.18,
    backgroundColor: "transparent",
    borderRadius: 22,
  },
  mapPathOne: {
    position: "absolute",
    left: "-10%",
    top: "38%",
    width: "130%",
    height: 26,
    backgroundColor: "#182131",
    transform: [{ rotate: "8deg" }],
    borderRadius: 20,
  },
  mapPathTwo: {
    position: "absolute",
    left: "28%",
    top: "-5%",
    width: 22,
    height: "120%",
    backgroundColor: "#1A2435",
    transform: [{ rotate: "12deg" }],
    borderRadius: 20,
  },
  youMarker: {
    position: "absolute",
    left: "46%",
    top: "50%",
    backgroundColor: COLORS.text,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  youMarkerText: {
    color: COLORS.bg,
    fontWeight: "900",
    fontSize: 11,
  },
  pinWrap: {
    position: "absolute",
    alignItems: "center",
  },
  pinDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
    marginBottom: 4,
    borderWidth: 2,
    borderColor: "#FFFFFF22",
  },
  pinLabel: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "700",
    backgroundColor: "#00000055",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  friendMarker: {
    position: "absolute",
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  friendMarkerText: {
    fontWeight: "900",
    fontSize: 13,
  },
  mapActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  mapActionButton: {
    width: "48.5%",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  mapActionText: {
    color: "white",
    fontWeight: "800",
    fontSize: 15,
  },
  friendSheet: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 2,
  },
  friendSheetTop: {
    flexDirection: "row",
  },
  friendSheetAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#20293A",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  friendSheetAvatarText: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
  },
  friendSheetMain: {
    flex: 1,
  },
  friendSheetNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  friendSheetName: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
  },
  friendSheetStatus: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
  },
  friendSheetSub: {
    color: COLORS.sub,
    fontSize: 13,
    marginTop: 4,
  },
  friendSheetButtons: {
    flexDirection: "row",
    marginTop: 14,
    justifyContent: "space-between",
  },
  sheetButton: {
    width: "31.5%",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetButtonText: {
    color: "white",
    fontWeight: "800",
    fontSize: 13,
  },
  placeholderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
  },
  placeholderTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 10,
  },
  placeholderText: {
    color: COLORS.sub,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 10,
    marginBottom: 14,
  },
  bigAction: {
    width: "48.5%",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  bigActionText: {
    color: "white",
    fontSize: 16,
    fontWeight: "800",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
  },
  tabText: {
    color: COLORS.sub,
    fontSize: 14,
    fontWeight: "700",
  },
  tabActive: {
    color: COLORS.text,
  },
  mapFull: {
    flex: 1,
    backgroundColor: "#0F1625",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    marginBottom: 12,
  },

  youDotOuter: {
    position: "absolute",
    left: "48%",
    top: "52%",
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#3FA7FF55",
    alignItems: "center",
    justifyContent: "center",
  },

  youDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.blue,
  },

  pinDotSmall: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  friendMarkerNew: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },

  mapActionsRowNew: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  friendSheetNew: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 55,
    zIndex: 40,
    elevation: 40,
  },

  sheetTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  sheetName: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
  },

  sheetSub: {
    color: COLORS.sub,
    fontSize: 13,
    marginTop: 4,
  },

  sheetTrend: {
    color: COLORS.yellow,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 6,
  },

  sheetButtonsRow: {
    flexDirection: "row",
    flexWrap: "wrap",

    justifyContent: "space-between",
    marginTop: 10,
  },

  sheetBtnSmall: {
    flex: 0,
    width: "31.5%",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 6,
  },

  sheetBtnText: {
    color: "white",
    fontWeight: "800",
    fontSize: 12,
  },
  mapStatusRow: {
    marginBottom: 10,
  },

  mapStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  mapStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },

  mapStatusText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
  },

  pinPickerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center", // <-- THIS centers it higher
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    zIndex: 999,
    elevation: 999,
  },

  pinPickerCard: {
    width: "100%",
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 10,

  },

  pinPickerTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 14,
  },

  pinPickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  pinTypeButton: {
    width: "48%",
    backgroundColor: COLORS.card2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },

  pinTypeButtonWide: {
    width: "100%",
  },

  pinTypeText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
  },

  pinPickerCancel: {
    marginTop: 4,
    alignItems: "center",
    paddingVertical: 12,
  },

  pinPickerCancelText: {
    color: COLORS.sub,
    fontSize: 15,
    fontWeight: "700",
  },

  friendInitialMarker: {
    fontSize: 20,
    fontWeight: "800",
    textShadowColor: "#000",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  mapLoadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  mapLoadingTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
  },

  mapLoadingText: {
    color: COLORS.sub,
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
  },

  editInput: {
    width: "100%",
    backgroundColor: "#0F1625",
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 6,
    marginBottom: 4,
  },

  emojiPinWrap: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 36,
    minHeight: 36,
  },

  emojiOnly: {
    textAlign: "center",
    textShadowColor: "#000",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  markerOuter: {
    alignItems: "center",
    justifyContent: "center",
  },

  eventInput: {
    color: COLORS.text,
    fontSize: 14,
    marginTop: 4,
    fontWeight: "600",
  },

  emojiPickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 14,
    marginBottom: 10,
    paddingBottom: 18,
  },

  emojiOption: {
    width: "23%",
    backgroundColor: COLORS.card2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 10,
  },

  emojiOptionSelected: {
    borderColor: COLORS.blue,
    backgroundColor: "#162235",
  },

  emojiOptionText: {
    fontSize: 24,
  },

  myMarkerWrap: {
    alignItems: "center",
    justifyContent: "center",
  },

  myMarkerGlow: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(57, 217, 138, 0.22)",
    borderWidth: 2,
    borderColor: "rgba(57, 217, 138, 0.75)",
  },

  myMarkerEmojiWrap: {
    minWidth: 36,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  myMarkerEmoji: {
    fontSize: 20,
    lineHeight: 30,
    textAlign: "center",
    textShadowColor: "#000",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  screenWrap: {
    flex: 1,
  },

  hiddenScreen: {
    display: "none",
  },

  emojiPinWrapSelected: {
    transform: [{ scale: 0.85 }],
    shadowColor: COLORS.blue,
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 8,
  },


  myMarkerEmojiWrapSelected: {
    transform: [{ scale: 1.15 }],
    shadowColor: COLORS.blue,
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 8,
  },

  mapExpandFloating: {
    position: "absolute",
    right: 0,
    bottom: 0,
    backgroundColor: "#151B26",
    borderWidth: 1,
    borderColor: "#242C3A",
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
    elevation: 20,
  },

  mapExpandIcon: {
    color: "#F4F7FB",
    fontSize: 20,
    fontWeight: "800",
  },

  containerMapExpanded: {
    paddingTop: 0,
    paddingHorizontal: 0,

  },

  meetupPickerWrap: {
    marginTop: 12,
    marginBottom: 12,
    alignItems: "center",
  },

  meetupPickerSection: {
    marginTop: 14,
  },

  meetupPickerLabel: {
    color: COLORS.sub,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },

  meetupOptionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  meetupOptionChip: {
    minWidth: 44,
    backgroundColor: COLORS.card2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    marginBottom: 8,
  },

  meetupOptionChipSelected: {
    backgroundColor: "#162235",
    borderColor: COLORS.blue,
  },

  meetupOptionText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },

  meetupOptionTextSelected: {
    color: COLORS.text,
  },

  meetupAmPmRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 14,
  },

  meetupAmPmButton: {
    width: 90,
    backgroundColor: COLORS.card2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginHorizontal: 6,
  },

  meetupAmPmButtonSelected: {
    backgroundColor: "#162235",
    borderColor: COLORS.blue,
  },

  meetupAmPmText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
  },

  meetupAmPmTextSelected: {
    color: COLORS.text,
  },

  meetupPreviewCard: {
    marginTop: 16,
    backgroundColor: COLORS.card2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
  },

  meetupPreviewText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },

  alertsWrap: {
    flex: 1,
  },

  alertsListContent: {
    paddingBottom: 16,
  },

  alertCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
  },

  alertTitleText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
  },

  alertMetaText: {
    color: COLORS.sub,
    fontSize: 12,
    marginTop: 6,
  },

  alertCardFresh: {
    borderColor: COLORS.blue,
    backgroundColor: "#162235",
  },

  tabLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  alertsUnreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.blue,
    marginLeft: 6,
  },

  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  qrCard: {
    marginTop: 16,
    marginBottom: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  qrCodeText: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 2,
    marginBottom: 6,
  },

  joinActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },

  joinHalfButton: {
    width: "48.5%",
    marginBottom: 0,
  },

  scannerCard: {
    width: "100%",
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },

  scannerViewport: {
    marginTop: 16,
    marginBottom: 14,
    height: 320,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#000",
  },

  chatScreenWrap: {
    flex: 1,
  },

  chatListContent: {
    paddingBottom: 24,
    flexGrow: 1,
  },

  chatRow: {
    flexDirection: "row",
    marginBottom: 12,
    alignItems: "flex-end",
  },

  chatRowMe: {
    justifyContent: "flex-end",
  },

  chatRowOther: {
    justifyContent: "flex-start",
  },

  chatAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#20293A",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    marginBottom: 2,
  },

  chatAvatarText: {
    fontSize: 18,
  },

  chatBubble: {
    maxWidth: "78%",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },

  chatBubbleMe: {
    backgroundColor: "#1E5EFF",
    borderColor: "#1E5EFF",
  },

  chatBubbleOther: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
  },

  chatSenderName: {
    color: COLORS.sub,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6,
  },

  chatBody: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 20,
  },

  chatMeta: {
    color: "#C9D4FF",
    fontSize: 11,
    marginTop: 8,
    fontWeight: "700",
    textAlign: "right",
  },

  chatMetaMe: {
    color: "#DCE6FF",
  },

  chatComposerWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: COLORS.bg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    zIndex: 20,
    elevation: 20,
  },

  chatInput: {
    flex: 1,
    backgroundColor: "#0F1625",
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 48,
    marginRight: 10,
  },

  chatSendButton: {
    backgroundColor: COLORS.blue,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  chatSendButtonDisabled: {
    opacity: 0.45,
  },

  chatSendButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "800",
  },

  chatModeTabsWrap: {
    flexDirection: "row",
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 4,
    marginBottom: 12,
  },

  chatModeTab: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  chatModeTabActive: {
    backgroundColor: COLORS.blue,
  },

  chatModeTabText: {
    color: COLORS.sub,
    fontSize: 14,
    fontWeight: "800",
  },

  chatModeTabTextActive: {
    color: "white",
  },

  privateUserTabsWrap: {
    maxHeight: 54,
    marginBottom: 12,
  },

  privateUserTabsRow: {
    paddingRight: 8,
  },

  privateUserChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
    position: "relative",
  },

  privateUserChipSelected: {
    backgroundColor: "#162235",
    borderColor: COLORS.blue,
  },

  privateUserChipEmoji: {
    fontSize: 16,
    marginRight: 8,
  },

  privateUserChipText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },

  privateUserChipTextSelected: {
    color: COLORS.text,
  },

  privateUnreadDot: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.blue,
    borderWidth: 2,
    borderColor: COLORS.card,
  },

  privateChatHeader: {
    marginBottom: 10,
  },

  privateChatTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
  },

  privateUnreadBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: COLORS.blue,
    alignItems: "center",
    justifyContent: "center",
  },

  privateUnreadBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "800",
  },

  chatTabUnreadDot: {
    position: "absolute",
    top: 17,
    right: 30,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.blue,
  },

  chatModeTabWithDot: {
    position: "relative",
  },

  chatCameraButton: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    minWidth: 52,
    minHeight: 48,
  },

  chatCameraButtonText: {
    fontSize: 20,
  },

  chatPhotoPreview: {
    width: "100%",
    height: 320,
    borderRadius: 16,
    marginBottom: 12,
    backgroundColor: "#0F1625",
  },

  chatMessageImage: {
    width: 180,
    height: 180,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: "#0F1625",
  },

  pinEditButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },

  pinSheetHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  pinSheetHeaderTextCol: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },

  pinSheetMediaWrap: {
    width: 80,
    height: 80,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#0F1625",
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  pinSheetMediaImage: {
    width: "100%",
    height: "100%",
  },

  pinSheetEmojiFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.card2,
  },

  pinSheetEmojiText: {
    fontSize: 34,
    lineHeight: 38,
    textAlign: "center",
  },

  mapFullHalf: {
    flex: 0,
    height: "42%",
  },

  friendSheetNewHalf: {
    flex: 1,
  },

  pinSheetHeroImage: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    backgroundColor: "#0F1625",
  },

  pinSheetHalfInfo: {
    marginTop: 12,
  },

  pinSheetTapHint: {
    color: COLORS.sub,
    fontSize: 12,
    marginTop: 8,
  },

  pinFullOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(11, 15, 22, 0.96)",
    zIndex: 40,
    elevation: 40,
  },

  pinFullOverlayTouchable: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 24,
  },

  pinFullImage: {
    width: "100%",
    height: "88%",
    backgroundColor: "#0F1625",
  },

  pinFullHintWrap: {
    position: "absolute",
    bottom: 28,
    alignSelf: "center",
    backgroundColor: "rgba(21, 27, 38, 0.88)",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },

  pinFullHintText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
  },

  navArrowOnlyWrap: {
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateY: -2 }],
  },

  navArrowHead: {
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderBottomWidth: 18,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: COLORS.blue,
  },

  navArrowTail: {
    width: 4,
    height: 12,
    backgroundColor: COLORS.blue,
    marginTop: -2,
    borderRadius: 2,
  },

  mapControlSheet: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 0,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",

  },

  mapControlSheetOpen: {
    Height: 330,
  },

  mapSheetHandleArea: {
    backgroundColor: COLORS.card,
  },

  mapSheetHandleButton: {
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 14,
    alignItems: "center",
  },

  mapSheetHandle: {
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: COLORS.border,
    marginBottom: 8,
  },

  mapSheetSummaryText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800",
  },

  mapSheetChevron: {
    position: "absolute",
    right: 14,
    top: 18,
    color: COLORS.sub,
    fontSize: 18,
    fontWeight: "800",
  },

  mapSheetContent: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: 12,

  },

  mapSheetActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  mapSheetActionBtn: {
    width: "48.5%",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  mapSheetActionText: {
    color: "white",
    fontSize: 14,
    fontWeight: "800",
  },

  mapSheetSectionTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 8,
  },

  mapSheetEmptyText: {
    color: COLORS.sub,
    fontSize: 13,
    lineHeight: 18,
  },

  mapSheetPinsList: {
    maxHeight: 155,
  },

  mapSheetPinRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
  },

  mapSheetPinIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#0F1625",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  mapSheetPinEmoji: {
    fontSize: 16,
  },

  mapSheetPinTextCol: {
    flex: 1,
    minWidth: 0,
  },

  mapSheetPinTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "900",
  },

  mapSheetPinMeta: {
    color: COLORS.sub,
    fontSize: 12,
    marginTop: 3,
    fontWeight: "600",
  },

  mapSheetPinArrow: {
    color: COLORS.sub,
    fontSize: 24,
    marginLeft: 8,
  },

  mapStatusFloating: {
    position: "absolute",
    top: 12,
    left: 12,
    zIndex: 30,
    elevation: 30,
  },

  smsSettingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: COLORS.card2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
  },

  smsSettingTick: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
    marginRight: 10,
    marginTop: -2,
  },

  smsSettingTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "900",
  },

  smsSettingSub: {
    color: COLORS.sub,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },

  mapSheetHelpBtn: {
    backgroundColor: COLORS.red,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  mapSheetHelpText: {
    color: "white",
    fontSize: 14,
    fontWeight: "900",
  },

  editModalContent: {
    paddingBottom: 50,
  },


  navOverlayWrap: {
    position: "absolute",
    top: 10,
    right: 14,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(15, 22, 37, 0.88)",
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
    elevation: 999,
  },

  navOverlayPointer: {
    alignItems: "center",
    justifyContent: "center",
  },

  navOverlayArrowHead: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 20,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: COLORS.blue,
  },

  navOverlayArrowTail: {
    width: 5,
    height: 16,
    backgroundColor: COLORS.blue,
    marginTop: -2,
    borderRadius: 3,
  },

  deleteConfirmCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    width: "85%",
    alignSelf: "center",
  },

  radarTopButton: {
    position: "absolute",
    right: 76,   // 👈 move right (increase this)
    top: 10, // adjust depending on safe area


    width: 44,
    height: 44,
    borderRadius: 22,

    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderWidth: 1,
    borderColor: "#a855f7",

    alignItems: "center",
    justifyContent: "center",

    shadowColor: "#a855f7",
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  mapControlSheetOverInfo: {
    zIndex: 80,
    elevation: 80,
  },

  mapFullAboveSheets: {
    marginBottom: 230,
  },

  mapBottomRightControls: {
    position: "absolute",
    right: 16,
    bottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    zIndex: 40,
    elevation: 40,
  },

  navModeToggle: {
    flexDirection: "row",
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 999,
    padding: 4,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.35)",
    marginRight: 50,
  },

  navModeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },

  navModeButtonActive: {
    backgroundColor: COLORS.purple,
  },

  navModeText: {
    fontSize: 18,
  },

  closeRangeWrap: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },

  closeRangePulseRing: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(57, 217, 138, 0.75)",
    backgroundColor: "rgba(57, 217, 138, 0.14)",
  },

  closeRangePulseRingOn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderColor: "rgba(57, 217, 138, 1)",
    backgroundColor: "rgba(57, 217, 138, 0.24)",
  },

  closeRangeCore: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.green,
    alignItems: "center",
    justifyContent: "center",
  },

  closeRangeText: {
    fontSize: 15,
  },
  friendEmojiMarkerWrap: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },

  friendEmojiMarkerText: {
    fontSize: 28,
    lineHeight: 34,
    textAlign: "center",
    textShadowColor: "#000",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  headerLogo: {
    width: 90,
    height: 90,
    marginRight: 12,
  },

  headerRight: {
    flex: 1,
    justifyContent: "center",
  },

  headerEventName: {
    color: COLORS.sub,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: 8,
    textAlign: "center",
  },
})