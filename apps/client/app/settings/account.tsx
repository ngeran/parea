// Privacy & account — download all your data (GDPR), log out, delete account.
// Deletion is irreversible, so it asks twice in plain words (the server
// erases everything immediately). The export is written to a file and handed
// to the phone's share sheet, so it can be saved or emailed.
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { useState } from "react";
import { Screen } from "../../src/components/Screen";
import { BigButton } from "../../src/components/BigButton";
import { Body, Card } from "../../src/components/ui";
import { api } from "../../src/lib/api";
import { confirmDialog, toast } from "../../src/lib/notify";
import { useT } from "../../src/i18n";
import { useStore } from "../../src/store";

export default function Account() {
  const t = useT();
  const profile = useStore((s) => s.profile);
  const signOut = useStore((s) => s.signOut);
  const [busy, setBusy] = useState(false);

  const logout = () => {
    confirmDialog(
      {
        title: t("confirmLogout"),
        okLabel: t("logout"),
        cancelLabel: t("cancel"),
        destructive: true,
      },
      () => void signOut(),
    );
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
      toast(t("exportDone"));
    } catch {
      toast(t("networkError"), "error");
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = () => {
    confirmDialog(
      {
        title: t("confirmDeleteTitle"),
        body: t("confirmDeleteBody"),
        okLabel: t("yesDelete"),
        cancelLabel: t("keepAccount"),
        destructive: true,
      },
      () => {
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
    );
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
