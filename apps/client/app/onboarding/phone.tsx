// Screen 2 of onboarding: sign in with the phone number. No passwords —
// we send a 6-digit code by SMS. The consent tick is required for a new
// account (GDPR) and is always shown so it is never a surprise.
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { phoneSchema } from "@parea/shared";
import { Screen } from "../../src/components/Screen";
import { BigButton } from "../../src/components/BigButton";
import { Body, Card } from "../../src/components/ui";
import { TextField } from "../../src/components/fields";
import { api, ApiError } from "../../src/lib/api";
import { toast } from "../../src/lib/notify";
import { useT } from "../../src/i18n";
import { useTheme } from "../../src/theme";
import type { OtpRequestResult } from "@parea/shared";

export default function PhoneSignIn() {
  const t = useT();
  const { c, f, space, radius } = useTheme();
  const router = useRouter();
  // Returning from "wrong number?" restores what was typed.
  const params = useLocalSearchParams<{ phone?: string }>();
  const [phone, setPhone] = useState(params.phone ?? "");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    // Users type national numbers; the API speaks E.164. Default to +30.
    const raw = phone.replace(/[\s\-()]/g, "");
    const e164 = raw.startsWith("+") ? raw : `+30${raw}`;
    if (!phoneSchema.safeParse(e164).success) {
      setError(t("invalidPhone"));
      return;
    }
    if (!consent) {
      setError(t("consentRequired"));
      return;
    }
    setBusy(true);
    try {
      const result = await api<OtpRequestResult>("/otp/request", { body: { phone: e164 } });
      router.push({
        pathname: "/onboarding/code",
        // dev_code exists only in development mock mode; harmless otherwise.
        params: { phone: e164, dev: result.dev_code ?? "" },
      });
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "";
      toast(code === "otp_cooldown" ? t("cooldownNote") : t("networkError"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={t("signInTitle")} speakText={t("signInTitle")}>
      <TextField
        label={t("yourPhone")}
        value={phone}
        onChangeText={setPhone}
        placeholder={t("phonePlaceholder")}
        keyboardType="phone-pad"
        error={error}
      />
      <Body muted>{t("smsNote")}</Body>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: consent }}
        accessibilityLabel={t("consent")}
        onPress={() => setConsent(!consent)}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: space.m,
          minHeight: 64,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: radius.sm,
            borderWidth: 3,
            borderColor: consent ? c.primary : c.border,
            backgroundColor: consent ? c.primary : c.bg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {consent ? <Text style={{ color: c.onPrimary, fontSize: 22, fontWeight: "700" }}>✓</Text> : null}
        </View>
        <Text style={{ color: c.text, fontSize: f.body, flex: 1 }}>{t("consent")}</Text>
      </Pressable>

      <Card style={{ padding: space.m }}>
        <Body muted>{t("privacyNote")}</Body>
      </Card>

      <BigButton label={t("sendCode")} size="big" onPress={() => void submit()} busy={busy} />
    </Screen>
  );
}
