// Settings tab — the profile hero first (face, badges, own words, real
// interests), then grouped rows, the volunteer + notification switches, a
// danger-tinted emergency card (real trusted contact, no dialing — the API
// returns only masked numbers), and a quiet sign-out.
import { ScrollView, Switch, Text, View } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { INTEREST_CHIPS, MOBILITY_LABELS, type SelfProfile } from "@parea/shared";
import { Avatar, Card, SettingsRow, Title } from "../../src/components/ui";
import { StatusBadge, QuoteWell, TrustNote } from "../../src/components/bits";
import { Chip, ChipGrid } from "../../src/components/fields";
import { BigButton } from "../../src/components/BigButton";
import { api } from "../../src/lib/api";
import { confirmDialog, toast } from "../../src/lib/notify";
import { useTrustedContacts } from "../../src/lib/queries";
import { useT, tr } from "../../src/i18n";
import { useTheme } from "../../src/theme";
import { useStore } from "../../src/store";

export default function Settings() {
  const t = useT();
  const { c, f, space, touch } = useTheme();
  const router = useRouter();
  const profile = useStore((s) => s.profile);
  const setProfile = useStore((s) => s.setProfile);
  const textSize = useStore((s) => s.textSize);
  const theme = useStore((s) => s.theme);
  const language = useStore((s) => s.language);
  const contacts = useTrustedContacts();
  const [pushBusy, setPushBusy] = useState(false);
  const [volunteerBusy, setVolunteerBusy] = useState(false);

  const sizeLabel =
    textSize === "normal" ? t("sizeNormal") : textSize === "large" ? t("sizeLarge") : t("sizeXLarge");
  const langLabel = language === "el" ? "Ελληνικά" : "English";
  const age = profile?.birth_year ? new Date().getFullYear() - profile.birth_year : null;
  const firstContact = contacts.data?.contacts[0];

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

  const signOut = () => {
    confirmDialog(
      { title: t("logout"), body: t("confirmLogout"), okLabel: t("yes"), cancelLabel: t("cancel") },
      () => void useStore.getState().signOut(),
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: space.xl, gap: space.xl, paddingTop: space.xxxl }}
    >
      <Title>{t("settingsTitle")}</Title>

      {/* Profile hero — face with badges, name + age, their own words. */}
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.l }}>
          <Avatar
            photoUrl={profile?.photo_url ?? null}
            name={profile?.first_name ?? "?"}
            size={72}
            badge={profile?.verified ? "verified" : profile?.volunteer ? "volunteer" : undefined}
          />
          <View style={{ flex: 1, gap: 6 }}>
            <Title>{profile?.first_name}</Title>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {age ? <StatusBadge emoji="🎂" label={tr(language, "yearsOld", { age })} hue="amber" /> : null}
              {profile?.verified ? (
                <StatusBadge emoji="✔" label={t("verifiedNeighbor")} hue="cyan" />
              ) : null}
              {profile?.volunteer ? (
                <StatusBadge emoji="🤝" label={t("volunteerBadge")} hue="success" />
              ) : null}
            </View>
          </View>
        </View>
        {profile?.about ? <QuoteWell>{profile.about}</QuoteWell> : null}
        {profile?.interests && profile.interests.length > 0 ? (
          <ChipGrid>
            {profile.interests.map((key) => {
              const chip = INTEREST_CHIPS.find((ch) => ch.key === key);
              return chip ? (
                <Chip key={key} as="tag" emoji={chip.emoji} label={chip.label[language]} />
              ) : null;
            })}
          </ChipGrid>
        ) : null}
      </Card>

      <View style={{ gap: space.m }}>
        <SettingsRow icon="📝" hue="ember" label={t("myDetails")} onPress={() => router.push("/settings/details")} />
        <SettingsRow
          icon="🅰️"
          hue="cyan"
          label={t("textSizeSetting")}
          value={sizeLabel}
          onPress={() => router.push("/settings/text-size")}
        />
        <SettingsRow
          icon="🌐"
          hue="amber"
          label={t("languageSetting")}
          value={langLabel}
          onPress={() => router.push("/settings/language")}
        />
        <SettingsRow
          icon="🌓"
          hue="cyan"
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
          hue="amber"
          label={t("radiusSetting")}
          value={profile ? `${profile.radius_km} km` : undefined}
          onPress={() => router.push("/settings/radius")}
        />
        {/* Mobility as an IconTile card — the tile mirrors the onboarding choice. */}
        <SettingsRow
          icon={profile?.mobility === "ride" ? "🚗" : profile?.mobility === "home" ? "🏠" : "🚶"}
          hue={profile?.mobility === "ride" ? "amber" : profile?.mobility === "home" ? "ember" : "cyan"}
          label={t("mobilityQ")}
          value={profile ? MOBILITY_LABELS[profile.mobility][language] : undefined}
          onPress={() => router.push("/settings/details")}
        />
        <SettingsRow icon="🤝" hue="success" label={t("contactsSetting")} onPress={() => router.push("/settings/contacts")} />
        <SettingsRow icon="🔐" hue="danger" label={t("privacySetting")} onPress={() => router.push("/settings/account")} />
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
          <Text style={{ fontSize: f.title, color: c.onSurface }}>🙋</Text>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: c.onSurface, fontSize: f.body, fontWeight: "600" }}>
              {t("volunteerSetting")}
            </Text>
            <Text style={{ color: c.onSurfaceVariant, fontSize: f.label, lineHeight: f.label * 1.3 }}>
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
            trackColor={{ false: c.outlineVariant, true: c.success }}
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
          <Text style={{ fontSize: f.title, color: c.onSurface }}>🔔</Text>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: c.onSurface, fontSize: f.body, fontWeight: "600" }}>
              {t("notificationsSetting")}
            </Text>
            <Text style={{ color: c.onSurfaceVariant, fontSize: f.label, lineHeight: f.label * 1.3 }}>
              {t("notificationsHint")}
            </Text>
          </View>
          <Switch
            accessibilityLabel={t("notificationsSetting")}
            value={profile?.push_enabled ?? true}
            onValueChange={(v) => void togglePush(v)}
            disabled={pushBusy}
            trackColor={{ false: c.outlineVariant, true: c.success }}
          />
        </View>
      </Card>

      {/* Emergency: the real first trusted contact (name + masked number —
          the API never exposes a dialable phone) and the SOS button. */}
      <Card variant="danger">
        <Text
          accessible
          accessibilityRole="header"
          style={{ color: c.onSurface, fontSize: f.body + 2, fontWeight: "800" }}
        >
          🆘 {t("emergencyTitle")}
        </Text>
        {firstContact ? (
          <View style={{ gap: 2 }}>
            <Text style={{ color: c.onSurfaceVariant, fontSize: f.label, fontWeight: "700" }}>
              {t("emergencyContact")}
            </Text>
            <Text style={{ color: c.onSurface, fontSize: f.body, fontWeight: "700" }}>
              {firstContact.name} · {firstContact.phone_masked}
            </Text>
          </View>
        ) : (
          // No contacts yet — honest empty state; the rows above link to
          // /settings/contacts where they can add one.
          <TrustNote emoji="🤝">{t("noContacts")}</TrustNote>
        )}
        <BigButton
          label={t("sosButton")}
          icon="🆘"
          variant="danger"
          onPress={() => router.push("/sos")}
        />
      </Card>

      <View style={{ gap: space.m }}>
        <SettingsRow icon="💬" hue="cyan" label={t("feedbackSetting")} onPress={() => router.push("/settings/feedback")} />
      </View>

      <BigButton label={t("logout")} icon="🚪" variant="quiet" onPress={signOut} />
    </ScrollView>
  );
}
