// Trusted contacts — the people we may alert about a plan, a missed
// check-in or an SOS. Add with a short form, switch alerts per contact,
// delete with confirmation. Up to 5.
import { Switch, Text, View } from "react-native";
import { useState } from "react";
import { phoneSchema, type Relationship, type TrustedContactDTO } from "@parea/shared";
import { Screen } from "../../src/components/Screen";
import { BigButton } from "../../src/components/BigButton";
import { Body, Card, ErrorState } from "../../src/components/ui";
import { Chip, ChipGrid, TextField } from "../../src/components/fields";
import { api, ApiError } from "../../src/lib/api";
import { confirmDialog, toast } from "../../src/lib/notify";
import { useT } from "../../src/i18n";
import { useTheme } from "../../src/theme";
import { useStore } from "../../src/store";
import { useTrustedContacts } from "../../src/lib/queries";

const RELATIONSHIPS: Array<{ value: Relationship; key: "relChild" | "relSibling" | "relFriend" | "relCarer" | "relOther" }> = [
  { value: "child", key: "relChild" },
  { value: "sibling", key: "relSibling" },
  { value: "friend", key: "relFriend" },
  { value: "carer", key: "relCarer" },
  { value: "other", key: "relOther" },
];

const REL_KEY: Record<Relationship, "relChild" | "relSibling" | "relFriend" | "relCarer" | "relOther"> = {
  child: "relChild",
  sibling: "relSibling",
  friend: "relFriend",
  carer: "relCarer",
  other: "relOther",
};

export default function TrustedContacts() {
  const t = useT();
  const { c, f, space } = useTheme();
  const language = useStore((s) => s.language);
  const contacts = useTrustedContacts();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState<Relationship>("child");
  const [busy, setBusy] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const toggleAlerts = async (contact: TrustedContactDTO) => {
    if (togglingId) return;
    setTogglingId(contact.id);
    try {
      await api(`/me/trusted-contacts/${contact.id}`, {
        method: "PATCH",
        body: { notify: !contact.notify },
      });
      await contacts.refetch();
    } catch {
      toast(t("networkError"), "error");
    } finally {
      setTogglingId(null);
    }
  };

  const add = async () => {
    const raw = phone.replace(/[\s\-()]/g, "");
    const e164 = raw.startsWith("+") ? raw : `+30${raw}`;
    if (!name.trim() || !phoneSchema.safeParse(e164).success) {
      toast(t("invalidContactPhone"), "error");
      return;
    }
    setBusy(true);
    try {
      await api("/me/trusted-contacts", {
        body: { name: name.trim(), phone: e164, relationship },
      });
      setName("");
      setPhone("");
      await contacts.refetch();
      toast(t("contactAdded"));
    } catch (e) {
      toast(
        e instanceof ApiError && e.code === "contact_limit" ? t("contactsNote") : t("networkError"),
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = (contact: TrustedContactDTO) => {
    confirmDialog(
      {
        title: t("deleteContact"),
        body: t("confirmDeleteContact", { name: contact.name }),
        okLabel: t("deleteContact"),
        cancelLabel: t("cancel"),
        destructive: true,
      },
      () => {
        void (async () => {
          try {
            await api(`/me/trusted-contacts/${contact.id}`, { method: "DELETE" });
            await contacts.refetch();
          } catch {
            toast(t("networkError"), "error");
          }
        })();
      },
    );
  };

  return (
    <Screen
      title={t("contactsTitle")}
      avoidKeyboard
      footer={
        <BigButton
          label={t("addContact")}
          icon="➕"
          size="big"
          busy={busy}
          onPress={() => void add()}
        />
      }
    >
      <Body muted>{t("contactsNote")}</Body>

      {contacts.isError ? (
        <ErrorState
          text={t("networkError")}
          retryLabel={t("tryAgain")}
          onRetry={() => void contacts.refetch()}
        />
      ) : null}

      {contacts.data?.contacts.map((contact) => (
        <Card key={contact.id}>
          <Text style={{ color: c.text, fontSize: f.body, fontWeight: "700" }}>{contact.name}</Text>
          <Text style={{ color: c.textSecondary, fontSize: f.body }}>{contact.phone_masked}</Text>
          {/* Alerts switch: this contact receives SOS + plan texts when on. */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              minHeight: 56,
            }}
          >
            <Text style={{ color: c.textSecondary, fontSize: f.label }}>
              {t("contactAlerts")}: {contact.notify ? t("contactAlertsOn") : t("contactAlertsOff")}
            </Text>
            <Switch
              value={contact.notify}
              onValueChange={() => void toggleAlerts(contact)}
              disabled={togglingId !== null}
              accessibilityLabel={`${t("contactAlerts")}: ${contact.name}`}
              trackColor={{ false: c.border, true: c.success }}
            />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: c.textSecondary, fontSize: f.label }}>
              {t(REL_KEY[contact.relationship])}
            </Text>
            <BigButton label={t("deleteContact")} icon="🗑️" variant="quiet" size="min" onPress={() => remove(contact)} />
          </View>
        </Card>
      ))}

      <Card>
        <TextField label={t("contactName")} value={name} onChangeText={setName} />
        <TextField
          label={t("contactPhone")}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder={t("phonePlaceholder")}
        />
        <Body>{t("relationship")}</Body>
        <ChipGrid>
          {RELATIONSHIPS.map((rel) => (
            <Chip
              key={rel.value}
              label={t(rel.key)}
              selected={relationship === rel.value}
              onToggle={() => setRelationship(rel.value)}
            />
          ))}
        </ChipGrid>
      </Card>
    </Screen>
  );
}
