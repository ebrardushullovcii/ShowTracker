import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export function AccountApprovalScreen({ email, unavailable = false }: { email?: string; unavailable?: boolean }) {
  const { signOut } = useAuthActions();
  const deleteAccount = useMutation(api.accountDeletion.request);
  const [deleting, setDeleting] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function leave(remove: boolean) {
    setBusy(true);
    setError(null);
    try {
      if (remove) await deleteAccount({ confirmation: "DELETE" });
      await signOut();
    } catch {
      setError("Unable to finish. Please try again.");
    } finally { setBusy(false); }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.brand}>ShowTracker</Text>
          <Text style={styles.title} accessibilityRole="header">{unavailable ? "Account unavailable" : "Awaiting approval"}</Text>
          {email ? <Text style={styles.text}>{email}</Text> : null}
          <Text style={styles.text}>{unavailable
            ? "Your account may be being deleted. Sign out to continue."
            : "New accounts require approval during our limited rollout. This screen updates when your access is approved. You can also sign in again later to check."}</Text>
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          <Pressable style={styles.button} disabled={busy} onPress={() => void leave(false)} accessibilityRole="button">
            <Text style={styles.buttonText}>{busy ? "Please wait..." : "Sign out"}</Text>
          </Pressable>
          {!unavailable && !deleting ? (
            <Pressable style={styles.secondary} disabled={busy} onPress={() => setDeleting(true)} accessibilityRole="button">
              <Text style={styles.text}>Delete my account</Text>
            </Pressable>
          ) : null}
          {deleting ? (
            <View style={styles.deleteBox}>
              <Text style={styles.text}>This permanently deletes your account and saved data. Removal normally completes within 24 hours. Type DELETE to confirm.</Text>
              <TextInput style={styles.input} value={confirmation} onChangeText={setConfirmation}
                autoCapitalize="characters" autoCorrect={false} editable={!busy}
                placeholder="DELETE" placeholderTextColor="#777" accessibilityLabel="Type DELETE to confirm account deletion" />
              <Pressable style={[styles.button, { opacity: confirmation === "DELETE" && !busy ? 1 : 0.5 }]}
                disabled={confirmation !== "DELETE" || busy} onPress={() => void leave(true)} accessibilityRole="button">
                <Text style={styles.buttonText}>Delete account permanently</Text>
              </Pressable>
              <Pressable style={styles.secondary} disabled={busy} onPress={() => { setDeleting(false); setConfirmation(""); }} accessibilityRole="button">
                <Text style={styles.text}>Cancel</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#09090b" },
  container: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  card: { width: "100%", maxWidth: 480, gap: 18 },
  brand: { color: "#ef4444", fontSize: 18, fontWeight: "700" },
  title: { color: "#fafafa", fontSize: 30, fontWeight: "700" },
  text: { color: "#b7b7c0", fontSize: 16, lineHeight: 24 },
  error: { color: "#fca5a5", fontSize: 16 },
  button: { minHeight: 48, padding: 12, backgroundColor: "#b91c1c", borderRadius: 8, alignItems: "center", justifyContent: "center" },
  buttonText: { color: "white", fontSize: 16, fontWeight: "600" },
  secondary: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  deleteBox: { gap: 16, borderTopWidth: 1, borderColor: "#333", paddingTop: 18 },
  input: { minHeight: 48, borderWidth: 1, borderColor: "#555", borderRadius: 8, padding: 12, color: "#fff", fontSize: 16 },
});
