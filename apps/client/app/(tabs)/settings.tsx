// Settings tab — the profile page: hero (face, badges, own words), the
// interests card (real count, editable in details), quick settings rows, a
// mobility card, the volunteer + notification switches, a danger-tinted
// emergency card (real trusted contact, no dialing — the API returns only
// masked numbers), and a quiet sign-out. Read-aloud recites the real data.
import { ScrollView, Switch, Text, View } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { INTEREST_CHIPS, MOBILITY_LABELS, type SelfProfile } from "@parea/shared";
import { Avatar, Card, SettingsRow, Title } from "../../src/components/ui";
import { StatusBadge, QuoteWell, TrustNote } from "../../src/components/bits";
import { Chip, ChipGrid } from "../../src/components/fields";
import { BigButton } from "../../src/components/BigButton";
import { IconTile } from "../../src/components/IconTile";
import { api } from "../../src/lib/api";
import { confirmDialog, toast } from "../../src/lib/notify";
import { useTrustedContacts } from "../../src/lib/queries";
import { useT, tr } from "../../src/i18n";
import { COLUMN, useTheme } from "../../src/theme";
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
  const insets = useSafeAreaInsets();
  const [pushBusy, setPushBusy] = useState(false);
  const [volunteerBusy, setVolunteerBusy] = useState(false);

  const sizeLabel =
    textSize === "normal" ? t("sizeNormal") : textSize === "large" ? t("sizeLarge") : t("sizeXLarge");
  const langLabel = language === "el" ? "Ελληνικά" : "English";
  const age = profile?.birth_year ? new Date().getFullYear() - profile.birth_year : null;
  const firstContact = contacts.data?.contacts[0];
  const interests = profile?.interests ?? [];

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
      contentContainerStyle={{
        ...COLUMN,
        padding: space.xl,
        gap: space.xl,
        paddingTop: insets.top + space.xl,
      }}
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
      </Card>

      {/* Interests — its own card with the real count and the honest way to
          change them (they are genuinely editable in details). */}
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space.s }}>
          <Title>{t("myInterests")}</Title>
          {interests.length > 0 ? (
            <StatusBadge emoji="✨" label={t("interestsSelected", { n: interests.length })} hue="success" />
          ) : null}
        </View>
        {interests.length > 0 ? (
          <ChipGrid>
            {interests.map((key) => {
              const chip = INTEREST_CHIPS.find((ch) => ch.key === key);
              return chip ? (
                <Chip key={key} as="tag" emoji={chip.emoji} label={chip.label[language]} />
              ) : null;
            })}
          </ChipGrid>
        ) : (
          <TrustNote emoji="✨">{t("interestsHint")}</TrustNote>
        )}
        <BigButton
          label={t("addInterest")}
          icon="➕"
          variant="quiet"
          size="min"
          onPress={() => router.push("/settings/details")}
        />
      </Card>

      <View style={{ gap: space.m }}>
        <SettingsRow
          icon="📝"
          hue="ember"
          label={t("editProfile")}
          onPress={() => router.push("/settings/details")}
        />
        <SettingsRow
          icon="🅰️"
          hue="cyan"
          label={t("textSizeSetting")}
          value={sizeLabel}
          pill={t("change")}
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
        <SettingsRow icon="🤝" hue="success" label={t("contactsSetting")} onPress={() => router.push("/settings/contacts")} />
        <SettingsRow icon="🔐" hue="danger" label={t("privacySetting")} onPress={() => router.push("/settings/account")} />
      </View>

      {/* Mobility — shown as the user's own sentence, changeable in details
          (which now actually edits it). */}
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.m }}>
          <IconTile
            emoji={profile?.mobility === "ride" ? "🚗" : profile?.mobility === "home" ? "🏠" : "🚶"}
            size={48}
            hue={profile?.mobility === "ride" ? "amber" : profile?.mobility === "home" ? "ember" : "cyan"}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: c.onSurface, fontSize: f.body, fontWeight: "700" }}>
              {t("mobilityQ")}
            </Text>
            {profile ? (
              <Text style={{ color: c.onSurfaceVariant, fontSize: f.label, lineHeight: f.label * 1.3 }}>
                {MOBILITY_LABELS[profile.mobility][language]}
              </Text>
            ) : null}
          </View>
        </View>
        <BigButton
          label={t("change")}
          variant="quiet"
          size="min"
          onPress={() => router.push("/settings/details")}
        />
      </Card>

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
          the API never exposes a dialable phone, so nothing dials), the SOS
          button, and the quiet door to managing contacts/alerts. */}
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
          // No contacts yet — honest empty state; the link below opens the
          // contacts screen where they can add one.
          <TrustNote emoji="🤝">{t("noContacts")}</TrustNote>
        )}
        <BigButton
          label={t("sosButton")}
          icon="🆘"
          variant="danger"
          onPress={() => router.push("/sos")}
        />
        <BigButton
          label={t("sosSettings")}
          variant="quiet"
          size="min"
          onPress={() => router.push("/settings/contacts")}
        />
      </Card>

      <View style={{ gap: space.m }}>
        <SettingsRow icon="💬" hue="cyan" label={t("feedbackSetting")} onPress={() => router.push("/settings/feedback")} />
      </View>

      <BigButton label={t("logout")} icon="🚪" variant="quiet" onPress={signOut} />
    </ScrollView>
  );
}
