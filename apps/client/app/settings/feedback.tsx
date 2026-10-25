// "Tell us what you think" — free text straight to the admin dashboard.
// One screen, one field, one button. No categories, no ticket numbers.
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Screen } from "../../src/components/Screen";
import { BigButton } from "../../src/components/BigButton";
import { TextField } from "../../src/components/fields";
import { api, ApiError } from "../../src/lib/api";
import { ackDialog, toast } from "../../src/lib/notify";
import { useT } from "../../src/i18n";
import { useStore } from "../../src/store";

export default function FeedbackScreen() {
  const t = useT();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (message.trim().length < 3 || busy) return;
    setBusy(true);
    try {
      await api("/feedback", {
        method: "POST",
        body: { message: message.trim() },
        token: useStore.getState().token ?? undefined,
      });
      // OK returns to Settings — never navigate underneath an alert.
      ackDialog(t("feedbackSent"), t("ok"), () => router.back());
    } catch (e) {
      toast(e instanceof ApiError ? e.message : t("networkError"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={t("feedbackSetting")} avoidKeyboard>
      <TextField
        label={t("feedbackSetting")}
        value={message}
        onChangeText={setMessage}
        placeholder={t("feedbackPlaceholder")}
        hint={t("feedbackHint")}
        multiline
      />
      <View style={{ gap: 8 }}>
        <BigButton
          label={t("feedbackSend")}
          size="big"
          disabled={message.trim().length < 3}
          busy={busy}
          onPress={() => void send()}
        />
      </View>
    </Screen>
  );
}
