// SOS — one tap on Home opens this screen with the alert ALREADY going out.
// No confirmation step: when someone feels unsafe, every extra step costs
// time. The alert texts every trusted contact switched on for alerts (and,
// when raised from a plan, the SMS carries the meeting's place and time).
// From here: "I'm OK" stand-down, or call 112 directly.
import { AccessibilityInfo, Linking, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Screen } from "../src/components/Screen";
import { BigButton } from "../src/components/BigButton";
import { Body } from "../src/components/ui";
import { api } from "../src/lib/api";
import { confirmDialog, toast } from "../src/lib/notify";
import { useT } from "../src/i18n";
import { useTheme } from "../src/theme";

type Phase = "sending" | "sent" | "nobody" | "failed";

interface SosResult {
  notified: number;
  contacts: number;
  names: string[];
}

export default function Sos() {
  const t = useT();
  const { c, f, space } = useTheme();
  const router = useRouter();
  const { planId } = useLocalSearchParams<{ planId?: string }>();
  const [phase, setPhase] = useState<Phase>("sending");
  const [result, setResult] = useState<SosResult | null>(null);
  const startedRef = useRef(false);

  const send = async () => {
    setPhase("sending");
    try {
      const r = await api<SosResult>("/safety/sos", {
        ...(planId ? { body: { plan_id: planId } } : { method: "POST" as const }),
      });
      setResult(r);
      setPhase(r.contacts === 0 ? "nobody" : "sent");
    } catch {
      setPhase("failed");
    }
  };

  useEffect(() => {
    // The push itself is the tap — send exactly once per visit.
    if (startedRef.current) return;
    startedRef.current = true;
    void send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Safety-critical outcome: speak it to screen-reader users too, whatever
  // the phase (Phase 6 rule 5 — the SOS result must never be silent).
  useEffect(() => {
    const msg =
      phase === "sent"
        ? `${t("sosSentTitle")}. ${t("sosSentBody", { names: result?.names.join(", ") ?? "" })}`
        : phase === "nobody"
          ? `${t("sosNoContactsTitle")}. ${t("sosNoContactsBody")}`
          : phase === "failed"
            ? t("sosFailed")
            : null;
    if (msg) AccessibilityInfo.announceForAccessibility(msg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const imOk = () => {
    // Standing down an active alert deserves the same Yes/No care as any
    // other irreversible action.
    confirmDialog(
      {
        title: t("sosImOkConfirmTitle"),
        body: t("sosImOkConfirmBody"),
        okLabel: t("yes"),
        cancelLabel: t("no"),
      },
      () => {
        void (async () => {
          try {
            await api("/safety/sos/ok", { method: "POST" });
            toast(t("sosOkSent"));
          } catch {
            toast(t("networkError"), "error");
          }
        })();
      },
    );
  };

  const call112 = () => void Linking.openURL("tel:112");

  return (
    <Screen
      title={phase === "sending" ? t("sosSending") : phase === "nobody" ? t("sosNoContactsTitle") : t("sosSentTitle")}
      showHome
    >
      {/* Live region: phase changes are announced on Android without
          needing the app to speak them manually. */}
      <View accessibilityLiveRegion="assertive">
        {phase === "sending" ? (
          <Body muted>{t("sosSending")}</Body>
        ) : phase === "sent" ? (
        <View style={{ gap: space.xl }}>
          <Text style={{ fontSize: 64, textAlign: "center" }}>🆘</Text>
          <Body>
            {t("sosSentBody", { names: result?.names.join(", ") ?? "" })}
          </Body>
          <BigButton label={t("sosImOk")} icon="👍" variant="success" size="big" onPress={() => void imOk()} />
          <BigButton label={t("call112")} icon="☎️" variant="soft" onPress={call112} />
        </View>
      ) : phase === "nobody" ? (
        <View style={{ gap: space.xl }}>
          <Body>{t("sosNoContactsBody")}</Body>
          <BigButton label={t("call112")} icon="☎️" size="big" onPress={call112} />
          <BigButton
            label={t("openSettings")}
            icon="⚙️"
            variant="soft"
            onPress={() => router.push("/settings/contacts")}
          />
        </View>
      ) : (
        <View style={{ gap: space.xl }}>
          <Text style={{ color: c.danger, fontSize: f.body, fontWeight: "700" }}>{t("sosFailed")}</Text>
          <BigButton label={t("call112")} icon="☎️" size="big" onPress={call112} />
          <BigButton label={t("tryAgain")} icon="🔄" variant="soft" onPress={() => void send()} />
        </View>
      )}
      </View>
    </Screen>
  );
}
