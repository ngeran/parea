// Home — the big "I'd like company" hero button, the paths to Nearby and
// Discover, and the user's own open requests. One primary action on screen.
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { activityLabel, placeTypeLabel } from "@parea/shared";
import { BigButton } from "../../src/components/BigButton";
import { Body, Card, EmptyState, ErrorState, Title } from "../../src/components/ui";
import { ensureCoords } from "../../src/lib/location";
import { registerPush } from "../../src/lib/push";
import { formatDistance, formatWhen } from "../../src/lib/time";
import { useT } from "../../src/i18n";
import { useTheme } from "../../src/theme";
import { useStore } from "../../src/store";
import { useMyRequests } from "../../src/lib/queries";

export default function Home() {
  const t = useT();
  const { c, f, space, touch } = useTheme();
  const router = useRouter();
  const profile = useStore((s) => s.profile);
  const coords = useStore((s) => s.coords);
  const setCoords = useStore((s) => s.setCoords);
  const language = useStore((s) => s.language);
  const token = useStore((s) => s.token);
  const myRequests = useMyRequests();

  // Best-effort push registration, once, after sign-in (native only).
  useEffect(() => {
    if (token) void registerPush();
  }, [token]);

  const shareLocation = async () => {
    const got = await ensureCoords();
    if (got) {
      setCoords(got);
      Alert.alert(t("locationShared"));
    } else {
      Alert.alert(t("locationFailed"));
    }
  };

  const needsLocation = !profile?.lat && !coords;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ padding: space.xl, gap: space.xl, paddingTop: space.xxxl }}
    >
      <Title>{t("hi", { name: profile?.first_name ?? "" })}</Title>

      {needsLocation ? (
        <Card>
          <Body>{t("locationNote")}</Body>
          <BigButton label={t("shareLocation")} icon="📍" variant="soft" onPress={() => void shareLocation()} />
        </Card>
      ) : null}

      {/* THE primary action. */}
      <View style={{ gap: space.s }}>
        <BigButton
          label={t("idLikeCompany")}
          icon="☕"
          size="big"
          onPress={() => router.push("/requests/new")}
        />
        <Body muted>{t("askNearby")}</Body>
      </View>

      <BigButton
        label={t("seeNearby")}
        icon="👋"
        variant="soft"
        onPress={() => router.push("/requests/nearby")}
      />
      <BigButton
        label={t("discoverPeople")}
        icon="🤝"
        variant="soft"
        onPress={() => router.push("/discover")}
      />

      {/* Emergency: one tap opens /sos, which alerts immediately (no confirm). */}
      <BigButton
        label={t("sosButton")}
        icon="🆘"
        variant="danger"
        onPress={() => router.push("/sos")}
      />

      {myRequests.isError ? (
        <ErrorState
          text={t("networkError")}
          retryLabel={t("tryAgain")}
          onRetry={() => void myRequests.refetch()}
        />
      ) : null}

      {(myRequests.data?.requests.length ?? 0) > 0 ? (
        <View style={{ gap: space.m }}>
          <Text
            accessible
            accessibilityRole="header"
            style={{ color: c.text, fontSize: f.body + 2, fontWeight: "700" }}
          >
            {t("myRequests")}
          </Text>
          {myRequests.data!.requests.map((request) => (
            <Pressable
              key={request.id}
              accessibilityRole="button"
              accessibilityLabel={`${activityLabel(request.activity, language)}, ${formatWhen(request.starts_at, language)}`}
              onPress={() => router.push(`/requests/${request.id}`)}
              style={({ pressed }) => ({
                backgroundColor: pressed ? c.primarySoft : c.surface,
                borderRadius: 16,
                padding: space.xl,
                gap: space.s,
                minHeight: touch.row,
              })}
            >
              <Text style={{ color: c.text, fontSize: f.body, fontWeight: "700" }}>
                {activityLabel(request.activity, language)} · {formatWhen(request.starts_at, language)}
              </Text>
              <Text style={{ color: c.textSecondary, fontSize: f.label }}>
                {placeTypeLabel(request.place_type, language)}
              </Text>
              {request.offered_count > 0 ? (
                <Text style={{ color: c.primary, fontSize: f.label, fontWeight: "700" }}>
                  👋 {t("offersCount", { n: request.offered_count })}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
