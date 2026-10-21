// Privacy & account — download all your data (GDPR), log out, delete account.
// Deletion is irreversible, so it asks twice in plain words (the server
// erases everything immediately). The export is written to a file and handed
// to the phone's share sheet, so it can be saved or emailed.
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { Alert } from "react-native";
import { useState } from "react";
import { Screen } from "../../src/components/Screen";
import { BigButton } from "../../src/components/BigButton";
import { Body, Card } from "../../src/components/ui";
import { api } from "../../src/lib/api";
import { useT } from "../../src/i18n";
import { useStore } from "../../src/store";

export default function Account() {
  const t = useT();
  const profile = useStore((s) => s.profile);
  const signOut = useStore((s) => s.signOut);
  const [busy, setBusy] = useState(false);

  const logout = () => {
    Alert.alert(t("confirmLogout"), "", [
      { text: t("cancel"), style: "cancel" },
      { text: t("logout"), style: "destructive", onPress: () => void signOut() },
    ]);
  };

  // GDPR export: fetch everything, write a temp JSON file, open the share
  // sheet so it can be saved to Files / emailed to themselves.
  const exportData = async () => {
    setBusy(true);
    try {
      const data = await api<unknown>("/me/export");
      const file = new File(Paths.cache, "together-data.json");
      if (file.exists) file.delete();
      file.write(JSON.stringify(data, null, 2));
      await Sharing.shareAsync(file.uri, { mimeType: "application/json" });
      Alert.alert(t("exportDone"));
    } catch {
      Alert.alert(t("genericError"), t("networkError"));
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = () => {
    Alert.alert(t("confirmDeleteTitle"), t("confirmDeleteBody"), [
      { text: t("keepAccount"), style: "cancel" },
      {
        text: t("yesDelete"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            setBusy(true);
            try {
              await api("/me", { method: "DELETE" });
            } catch {
              // Even if the network hiccups, the session ends locally.
            } finally {
              await signOut();
              setBusy(false);
            }
          })();
        },
      },
    ]);
  };

  return (
    <Screen title={t("accountTitle")}>
      <Card>
        <Body>{t("signedInAs", { phone: profile?.phone_masked ?? "" })}</Body>
      </Card>

      <Card>
        <Body>{t("exportNote")}</Body>
      </Card>
      <BigButton label={t("exportData")} icon="⬇️" variant="soft" busy={busy} onPress={() => void exportData()} />

      <BigButton label={t("logout")} icon="🚪" variant="quiet" onPress={logout} />
      <BigButton label={t("deleteAccount")} icon="🗑️" variant="danger" onPress={deleteAccount} busy={busy} />
    </Screen>
  );
}
