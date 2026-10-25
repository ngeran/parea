// Discover — one big card at a time, two huge buttons (§7.7). A mutual YES
// opens a chat. "Not now" is equally weighted: saying no must feel fine.
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MOBILITY_LABELS } from "@parea/shared";
import { BigButton } from "../src/components/BigButton";
import { Body, Avatar, EmptyState, ErrorState } from "../src/components/ui";
import { Screen } from "../src/components/Screen";
import { api } from "../src/lib/api";
import { ensureCoords } from "../src/lib/location";
import { ackDialog, toast } from "../src/lib/notify";
import { formatDistance } from "../src/lib/time";
import { useT } from "../src/i18n";
import { useTheme } from "../src/theme";
import { useStore } from "../src/store";
import { useDiscover } from "../src/lib/queries";

export default function Discover() {
  const t = useT();
  const { c, f, space } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const language = useStore((s) => s.language);
  const coords = useStore((s) => s.coords);
  const [busy, setBusy] = useState(false);
  const card = useDiscover(coords);

  const decide = async (yes: boolean) => {
    const person = card.data?.profile;
    if (!person || busy) return;
    setBusy(true);
    try {
      const result = await api<{ matched: boolean; match_id?: string }>(`/discover/${person.id}/decision`, {
        body: { yes },
      });
      await queryClient.invalidateQueries({ queryKey: ["discover"] });
      if (result.matched && result.match_id) {
        await queryClient.invalidateQueries({ queryKey: ["matches"] });
        // The OK tap moves the screen — never navigate underneath an alert
        // (screen readers lose the announcement otherwise).
        ackDialog(t("mutualToast"), t("ok"), () => router.replace(`/chat/${result.match_id}`));
      }
    } catch {
      // Fail loudly (Phase 6 rule 5): an unacknowledged "no" must not look
      // like the app ignored the tap.
      toast(t("networkError"), "error");
      await queryClient.invalidateQueries({ queryKey: ["discover"] });
    } finally {
      setBusy(false);
    }
  };

  // First visit: get the rounded location before asking the server.
  if (!coords && !card.isFetching) {
    void ensureCoords();
  }

  const person = card.data?.profile ?? null;

  const buttons = (
    /* Two equally huge buttons — yes and no both respected. */
    <View style={{ flexDirection: "row", gap: space.l }}>
      <View style={{ flex: 1 }}>
        <BigButton label={t("yesMeet")} size="big" onPress={() => void decide(true)} busy={busy} />
      </View>
      <View style={{ flex: 1 }}>
        <BigButton label={t("notNow")} size="big" variant="quiet" onPress={() => void decide(false)} busy={busy} />
      </View>
    </View>
  );

  return (
    <Screen title={t("discoverPeople")}>
      {!coords ? (
        <View style={{ gap: space.xl }}>
          <EmptyState emoji="📍" text={t("locationNote")} />
        </View>
      ) : card.isError ? (
        <ErrorState
          text={t("networkError")}
          retryLabel={t("tryAgain")}
          onRetry={() => void card.refetch()}
        />
      ) : card.isLoading ? (
        <Body muted>{t("loading")}</Body>
      ) : !person ? (
        <View style={{ gap: space.xl }}>
          <EmptyState emoji="🌿" text={t("noOneNew")} />
          <BigButton label={t("tryAgain")} icon="🔄" variant="soft" onPress={() => void card.refetch()} />
        </View>
      ) : (
        <>
          <View style={{ backgroundColor: c.surface, borderRadius: 24, padding: space.xl, alignItems: "center", gap: space.l }}>
            <Avatar photoUrl={person.photo_url} name={person.first_name} size={180} />
            <Text accessible accessibilityRole="header" style={{ color: c.text, fontSize: f.title, fontWeight: "700" }}>
              {person.first_name}
              {person.birth_year
                ? `, ${t("yearsOld", { age: new Date().getFullYear() - person.birth_year })}`
                : ""}
            </Text>
            {person.about ? (
              <Body>{person.about}</Body>
            ) : null}
            <Body muted>
              {MOBILITY_LABELS[person.mobility][language]}
              {person.distance_km !== undefined ? ` · ${formatDistance(person.distance_km, language)}` : ""}
            </Body>
            {person.verified ? (
              <Text style={{ color: c.success, fontSize: f.label, fontWeight: "700" }}>
                ✔ {t("verified")}
              </Text>
            ) : null}
            {person.volunteer ? (
              <Text
                accessibilityLabel={t("volunteerBadge")}
                style={{ color: c.text, fontSize: f.label, fontWeight: "700" }}
              >
                🤝 {t("volunteerBadge")}
              </Text>
            ) : null}
          </View>
          {buttons}
        </>
      )}
    </Screen>
  );
}
