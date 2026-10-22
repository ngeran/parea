// Settings tab — plain grouped rows; everything is one tap from here.
import { ScrollView, Switch, Text, View } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import type { SelfProfile } from "@parea/shared";
import { Avatar, Card, SettingsRow, Title } from "../../src/components/ui";
import { api } from "../../src/lib/api";
import { confirmDialog, toast } from "../../src/lib/notify";
import { useT } from "../../src/i18n";
import { useTheme } from "../../src/theme";
import { useStore } from "../../src/store";

export default function Settings() {
  const t = useT();
  const { c, f, space, touch } = useTheme();
  const router = useRouter();
  const profile = useStore((s) => s.profile);
  const setProfile = useStore((s) => s.setProfile);
  const textSize = useStore((s) => s.textSize);
  const language = useStore((s) => s.language);
  const theme = useStore((s) => s.theme);
  const [pushBusy, setPushBusy] = useState(false);
  const [volunteerBusy, setVolunteerBusy] = useState(false);

  const sizeLabel =
    textSize === "normal" ? t("sizeNormal") : textSize === "large" ? t("sizeLarge") : t("sizeXLarge");
  const langLabel = language === "el" ? "Ελληνικά" : "English";

  const togglePush = async (on: boolean) => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      // PATCH /me returns the updated profile, like every settings screen.
      const updated = await api<SelfProfile>("/me", {
        method: "PATCH",
        body: { push_enabled: on },
        token: useStore.getState().token ?? undefined,
      });
      setProfile(updated);
    } catch {
      toast(t("networkError"), "error");
    } finally {
      setPushBusy(false);
    }
  };

  const toggleVolunteer = async (on: boolean) => {
    if (volunteerBusy) return;
    // Off is irreversible-ish (drops an existing badge) — confirm it.
    if (!on) {
      confirmDialog(
        {
          title: t("volunteerSetting"),
          body: t("volunteerOffConfirm"),
          okLabel: t("yes"),
          cancelLabel: t("cancel"),
          destructive: true,
        },
        () => void patchVolunteer(false),
      );
      return;
    }
    void patchVolunteer(true);
  };

  const patchVolunteer = async (on: boolean) => {
    setVolunteerBusy(true);
    try {
      const updated = await api<SelfProfile>("/me", {
        method: "PATCH",
        body: { volunteer: on },
        token: useStore.getState().token ?? undefined,
      });
      setProfile(updated);
      if (on) toast(t("volunteerApplied"));
    } catch {
      toast(t("networkError"), "error");
    } finally {
      setVolunteerBusy(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ padding: space.xl, gap: space.xl, paddingTop: space.xxxl }}
    >
      <Title>{t("settingsTitle")}</Title>

      <View style={{ flexDirection: "row", alignItems: "center", gap: space.l }}>
        <Avatar photoUrl={profile?.photo_url ?? null} name={profile?.first_name ?? "?"} size={96} />
        <View style={{ flex: 1 }}>
          <Title>{profile?.first_name}</Title>
        </View>
      </View>

      <View style={{ gap: space.m }}>
        <SettingsRow icon="📝" label={t("myDetails")} onPress={() => router.push("/settings/details")} />
        <SettingsRow
          icon="🅰️"
          label={t("textSizeSetting")}
          value={sizeLabel}
          onPress={() => router.push("/settings/text-size")}
        />
        <SettingsRow
          icon="🌐"
          label={t("languageSetting")}
          value={langLabel}
          onPress={() => router.push("/settings/language")}
        />
        <SettingsRow
          icon="🌓"
          label={t("appearanceSetting")}
          value={
            theme === "system"
              ? t("themeSystem")
              : theme === "dark"
                ? t("themeDark")
                : theme === "contrast"
                  ? t("themeContrast")
                  : t("themeLight")
          }
          onPress={() => router.push("/settings/appearance")}
        />
        <SettingsRow
          icon="📏"
          label={t("radiusSetting")}
          value={profile ? `${profile.radius_km} km` : undefined}
          onPress={() => router.push("/settings/radius")}
        />
        <SettingsRow icon="🤝" label={t("contactsSetting")} onPress={() => router.push("/settings/contacts")} />
        <SettingsRow icon="🔐" label={t("privacySetting")} onPress={() => router.push("/settings/account")} />
      </View>

      {/* Volunteer: switching on files an application; an admin approves it.
          The badge others see only appears after that review. */}
      <Card>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            minHeight: touch.min,
            gap: space.m,
          }}
        >
          <Text style={{ fontSize: f.title, color: c.text }}>🙋</Text>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: c.text, fontSize: f.body, fontWeight: "600" }}>
              {t("volunteerSetting")}
            </Text>
            <Text style={{ color: c.textSecondary, fontSize: f.label, lineHeight: f.label * 1.3 }}>
              {profile?.volunteer
                ? t("volunteerActive")
                : profile?.volunteer_requested
                  ? t("volunteerPending")
                  : t("volunteerHint")}
            </Text>
          </View>
          <Switch
            accessibilityLabel={t("volunteerSetting")}
            value={(profile?.volunteer ?? false) || (profile?.volunteer_requested ?? false)}
            onValueChange={(v) => void toggleVolunteer(v)}
            disabled={volunteerBusy}
          />
        </View>
      </Card>

      {/* Notifications: one honest switch, wired to profiles.push_enabled. */}
      <Card>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            minHeight: touch.min,
            gap: space.m,
          }}
        >
          <Text style={{ fontSize: f.title, color: c.text }}>🔔</Text>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: c.text, fontSize: f.body, fontWeight: "600" }}>
              {t("notificationsSetting")}
            </Text>
            <Text style={{ color: c.textSecondary, fontSize: f.label, lineHeight: f.label * 1.3 }}>
              {t("notificationsHint")}
            </Text>
          </View>
          <Switch
            accessibilityLabel={t("notificationsSetting")}
            value={profile?.push_enabled ?? true}
            onValueChange={(v) => void togglePush(v)}
            disabled={pushBusy}
          />
        </View>
      </Card>

      <View style={{ gap: space.m }}>
        <SettingsRow icon="💬" label={t("feedbackSetting")} onPress={() => router.push("/settings/feedback")} />
      </View>
    </ScrollView>
  );
}
