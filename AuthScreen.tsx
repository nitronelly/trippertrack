import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { supabase } from "./lib/supabase";

export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);

  async function sendCode() {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      Alert.alert("Enter email", "Please enter your email address.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) {
        Alert.alert("Sign in error", error.message);
        return;
      }

      setStep("code");
      Alert.alert("Code sent", "Check your email for the 6-digit code.");
    } catch (e: any) {
      Alert.alert("Unexpected error", e?.message ?? "Failed to send code.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    if (!cleanCode) {
      Alert.alert("Enter code", "Please enter the code from your email.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanCode,
        type: "email",
      });

      if (error) {
        Alert.alert("Verify error", error.message);
        return;
      }

      await ensureUserProfile();
    } catch (e: any) {
      Alert.alert("Unexpected error", e?.message ?? "Failed to verify code.");
    } finally {
      setLoading(false);
    }
  }

  async function ensureUserProfile() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      Alert.alert("User error", userError.message);
      return;
    }

    if (!user) return;

    const { error: profileError } = await supabase.from("users").upsert({
      id: user.id,
      name: "New User",
      emoji: "🧭",
    });

    if (profileError) {
      Alert.alert("Profile error", profileError.message);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TripperTrack</Text>
      <Text style={styles.subtitle}>
        {step === "email"
          ? "Enter your email to get a login code"
          : "Enter the code from your email"}
      </Text>

      {step === "email" ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#7C8798"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={sendCode}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? "Sending..." : "Send Code"}
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder="6-digit code"
            placeholderTextColor="#7C8798"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={verifyCode}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? "Verifying..." : "Verify Code"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => setStep("email")}
            disabled={loading}
          >
            <Text style={styles.linkText}>Use a different email</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0F16",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    color: "#F4F7FB",
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 8,
  },
  subtitle: {
    color: "#97A3B6",
    fontSize: 14,
    marginBottom: 20,
  },
  input: {
    backgroundColor: "#151B26",
    borderWidth: 1,
    borderColor: "#242C3A",
    color: "#F4F7FB",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#3FA7FF",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  linkButton: {
    marginTop: 14,
    alignItems: "center",
  },
  linkText: {
    color: "#97A3B6",
    fontSize: 14,
    fontWeight: "600",
  },
});