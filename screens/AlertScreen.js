import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
} from "react-native";
import { listEventPins } from "../lib/tripperBackend";
import { supabase } from "../lib/supabase";

const COLORS = {
  bg: "#0B0F16",
  card: "#151B26",
  border: "#242C3A",
  text: "#F4F7FB",
  sub: "#97A3B6",
};

export default function AlertsScreen({ eventId }) {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (!eventId) return;
    loadAlerts();
  }, [eventId]);

  async function loadAlerts() {
    try {
      // 1. Meetup pins
      const pins = await listEventPins(eventId);
      const meetupAlerts = pins
        .filter((p) => p.type === "meetup")
        .map((p) => ({
          id: `meetup-${p.id}`,
          type: "meetup",
          text: `Meetup set for ${new Date(p.meetupAt).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}`,
          createdAt: p.createdAt || p.created_at,
        }));

      // 2. You OK check-ins
      const { data: checkins } = await supabase
        .from("check_ins")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

      const checkinAlerts = (checkins || []).map((c) => ({
        id: `check-${c.id}`,
        type: "checkin",
        text: `${c.from_name || "Someone"} asked if you're OK`,
        createdAt: c.created_at,
      }));

      const combined = [...meetupAlerts, ...checkinAlerts].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      setAlerts(combined);
    } catch (e) {
      console.log("alerts error", e);
    }
  }

  function formatTimeAgo(date) {
    if (!date) return "";

    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);

    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;

    const hours = Math.floor(mins / 60);
    return `${hours}h ago`;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.text}>{item.text}</Text>
            <Text style={styles.sub}>
              {formatTimeAgo(item.createdAt)}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No alerts yet</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  text: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "600",
  },
  sub: {
    color: COLORS.sub,
    marginTop: 4,
    fontSize: 12,
  },
  empty: {
    color: COLORS.sub,
    textAlign: "center",
    marginTop: 40,
  },
});