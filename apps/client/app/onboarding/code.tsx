// Screen 3 of onboarding: the 6-digit SMS code. One big input, clear error
// on a wrong code, "new code" and "wrong number" always visible — the code
// is never lost to a typo or a silent timeout.
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import type { OtpRequestResult, OtpVerifyResult } from "@parea/shared";
import { Screen } from "../../src/components/Screen";
import { BigButton } from "../../src/components/BigButton";
import { Body } from "../../src/components/ui";
import { TextField } from "../../src/components/fields";
import { api, ApiError, CONSENT_VERSION } from "../../src/lib/api";
import { toast } from "../../src/lib/notify";
import { useT } from "../../src/i18n";
import { useTheme } from "../../src/theme";
import { useStore } from "../../src/store";

export default function CodeEntry() {
  const t = useT();
  const { c, f, space, radius } = useTheme();
  const params = useLocalSearchParams<{ phone: string; dev?: string }>();
  const phone = params.phone ?? "";
  const devCode = params.dev ?? "";
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const setSession = useStore((s) => s.setSession);

  const verify = async () => {
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError(t("wrongCode"));
      return;
    }
    setBusy(true);
    try {
      const result = await api<OtpVerifyResult>("/otp/verify", {
        body: { phone, code, consent_version: CONSENT_VERSION },
      });
      await setSession(result.token, result.profile);
      router.replace(result.is_new_user ? "/onboarding/profile" : "/home");
    } catch (e) {
      setError(e instanceof ApiError && e.status === 400 ? t("wrongCode") : t("networkError"));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    try {
      await api("/otp/request", { body: { phone } });
      setError(null);
      toast(t("codeSentTo", { phone }));
    } catch (e) {
      toast(
        e instanceof ApiError && e.code === "otp_cooldown" ? t("cooldownNote") : t("networkError"),
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={t("codeTitle")} speakText={t("codeSentTo", { phone })}>
      <Body>{t("codeSentTo", { phone })}</Body>
      <TextField
        label={t("codeTitle")}
        value={code}
        onChangeText={(text) => setCode(text.replace(/\D/g, "").slice(0, 6))}
        placeholder="123456"
        keyboardType="number-pad"
        error={error}
      />
      <BigButton label={t("verifyCode")} size="big" onPress={() => void verify()} busy={busy} />
      <BigButton label={t("resend")} variant="quiet" onPress={() => void resend()} busy={busy} />
      <BigButton
        label={t("wrongNumber")}
        variant="quiet"
        onPress={() => router.replace({ pathname: "/onboarding/phone", params: { phone } })}
      />
      {/* The server only sends dev_code when OTP_MOCK is on (production
          force-disables it), so the value itself is the gate — showing it in
          non-dev builds is what makes deployed test builds sign-in-able. */}
      {devCode ? (
        <View
          style={{ backgroundColor: c.primarySoft, borderRadius: radius.md, padding: space.l, gap: space.s }}
        >
          <Body muted>{t("devCode", { code: devCode })}</Body>
          <BigButton label={t("useDevCode")} variant="soft" size="min" onPress={() => setCode(devCode)} />
        </View>
      ) : null}
    </Screen>
  );
}
