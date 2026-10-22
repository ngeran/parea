// Report a person — and optionally block them. Reached from the chat header.
// One screen, one primary action: pick a reason (big radio rows), say more
// if you want, send. Blocking ends the conversation on the server for good.
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Screen } from "../src/components/Screen";
import { BigButton } from "../src/components/BigButton";
import { Body, Card } from "../src/components/ui";
import { RadioRow, TextField } from "../src/components/fields";
import { api } from "../src/lib/api";
import { ackDialog, confirmDialog, toast } from "../src/lib/notify";
import { useT } from "../src/i18n";
import { useTheme } from "../src/theme";

type Reason = "scam" | "harassment" | "fake" | "other";

const REASONS: Array<{ value: Reason; key: "reasonScam" | "reasonHarassment" | "reasonFake" | "reasonOther" }> = [
  { value: "scam", key: "reasonScam" },
  { value: "harassment", key: "reasonHarassment" },
  { value: "fake", key: "reasonFake" },
  { value: "other", key: "reasonOther" },
];

export default function Report() {
  const t = useT();
  const { c, f, space } = useTheme();
  const router = useRouter();
  const { targetId, name } = useLocalSearchParams<{ targetId: string; name?: string }>();
  const [reason, setReason] = useState<Reason>("scam");
  const [details, setDetails] = useState("");
  const [block, setBlock] = useState(true); // safety-first default
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!targetId || busy) return;
    setBusy(true);
    try {
      await api("/safety/reports", {
        body: { target_id: targetId, reason, ...(details.trim() ? { details: details.trim() } : {}) },
      });
      if (block) {
        await api("/safety/blocks", { body: { blocked_id: targetId } });
      }
      // OK moves the screen — never navigate underneath an alert.
      ackDialog(t("reportSent"), t("ok"), () => router.replace("/home"));
    } catch {
      toast(t("networkError"), "error");
    } finally {
      setBusy(false);
    }
  };

  // Blocking is irreversible (ends the chat for good) — it gets an explicit
  // Yes/No even though it's on by default. The report alone doesn't need one.
  const confirmAndSend = () => {
    if (block) {
      confirmDialog(
        {
          title: t("confirmBlockTitle", { name: name ?? "" }),
          body: t("confirmBlockBody"),
          okLabel: t("yes"),
          cancelLabel: t("no"),
          destructive: true,
        },
        () => void send(),
      );
    } else {
      void send();
    }
  };

  return (
    <Screen
      title={t("reportTitle")}
      footer={
        <BigButton label={t("sendReport")} icon="📨" size="big" busy={busy} onPress={confirmAndSend} />
      }
    >
      <Body>{t("reportIntro", { name: name ?? "" })}</Body>

      <View style={{ gap: space.s }}>
        {REASONS.map((r) => (
          <RadioRow
            key={r.value}
            label={t(r.key)}
            selected={reason === r.value}
            onSelect={() => setReason(r.value)}
          />
        ))}
      </View>

      <TextField
        label={t("reportDetails")}
        value={details}
        onChangeText={setDetails}
        multiline
        accessibilityLabel={t("reportDetails")}
      />

      <Card>
        <RadioRow label={t("alsoBlock")} selected={block} onSelect={() => setBlock(true)} />
        <RadioRow label={t("notNow")} selected={!block} onSelect={() => setBlock(false)} />
        {block ? <Text style={{ color: c.textSecondary, fontSize: f.label }}>{t("alsoBlockHint")}</Text> : null}
      </Card>
    </Screen>
  );
}
