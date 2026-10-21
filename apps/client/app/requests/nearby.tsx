// Nearby requests — open requests within range, nearest first (§7.6).
// Each card has one primary action: "I can join".
import { Alert, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { activityLabel, placeTypeLabel, type RequestDTO } from "@parea/shared";
import { BigButton } from "../../src/components/BigButton";
import { Body, EmptyState, ErrorState } from "../../src/components/ui";
import { Screen } from "../../src/components/Screen";
import { api, ApiError } from "../../src/lib/api";
import { ensureCoords } from "../../src/lib/location";
import { formatDistance, formatWhen } from "../../src/lib/time";
import { useT } from "../../src/i18n";
import { useTheme } from "../../src/theme";
import { useStore } from "../../src/store";
import { errCode, useNearbyRequests } from "../../src/lib/queries";

export default function Nearby() {
  const t = useT();
  const { c, f, space } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const language = useStore((s) => s.language);
  const coords = useStore((s) => s.coords);
  const setCoords = useStore((s) => s.setCoords);
  const [joining, setJoining] = useState<string | null>(null);
  const nearby = useNearbyRequests(coords);

  const refreshLocation = async () => {
    const got = await ensureCoords();
    if (got) setCoords(got);
    else Alert.alert(t("locationFailed"));
  };

  const join = async (requestId: string) => {
    setJoining(requestId);
    try {
      await api(`/requests/${requestId}/responses`, { method: "POST" });
      Alert.alert(t("canJoin"), t("joinSent"));
      // The request leaves the list once we refresh (already answered).
      await queryClient.invalidateQueries({ queryKey: ["requests", "nearby"] });
    } catch (e) {
      const code = errCode(e);
      Alert.alert(
        t("genericError"),
        code === "already_responded"
          ? t("askedToJoin")
          : code === "response_limit"
            ? t("responseLimit")
            : e instanceof ApiError && e.status === 404
              ? t("noLongerAvailable")
              : t("networkError"),
      );
      await queryClient.invalidateQueries({ queryKey: ["requests", "nearby"] });
    } finally {
      setJoining(null);
    }
  };

  const card = (request: RequestDTO) => (
    <View
      key={request.id}
      style={{ backgroundColor: c.surface, borderRadius: 16, padding: space.xl, gap: space.s }}
    >
      <Text style={{ color: c.text, fontSize: f.body + 2, fontWeight: "700" }}>
        {activityLabel(request.activity, language)}
      </Text>
      <Text style={{ color: c.text, fontSize: f.body }}>
        👤 {request.owner.first_name}
        {request.owner.birth_year
          ? `, ${new Date().getFullYear() - request.owner.birth_year}`
          : ""}
      </Text>
      {request.owner.volunteer ? (
        <Text
          accessibilityLabel={t("volunteerBadge")}
          style={{ color: c.text, fontSize: f.label, fontWeight: "700" }}
        >
          🤝 {t("volunteerBadge")}
        </Text>
      ) : null}
      <Text style={{ color: c.text, fontSize: f.body }}>📅 {formatWhen(request.starts_at, language)}</Text>
      <Text style={{ color: c.textSecondary, fontSize: f.body }}>
        {placeTypeLabel(request.place_type, language)} ·{" "}
        {request.owner.distance_km !== undefined
          ? t("kmAway", { d: formatDistance(request.owner.distance_km, language) })
          : ""}
      </Text>
      <BigButton
        label={t("canJoin")}
        icon="🙋"
        onPress={() => void join(request.id)}
        busy={joining === request.id}
      />
    </View>
  );

  return (
    <Screen title={t("nearbyTitle")}>
      {!coords ? (
        <EmptyState emoji="📍" text={t("locationNote")} />
      ) : nearby.isError ? (
        <ErrorState
          text={t("networkError")}
          retryLabel={t("tryAgain")}
          onRetry={() => void nearby.refetch()}
        />
      ) : !nearby.isLoading && (nearby.data?.requests.length ?? 0) === 0 ? (
        <EmptyState emoji="🌿" text={t("noneNearby")} />
      ) : nearby.isLoading ? (
        <Body muted>{t("loading")}</Body>
      ) : null}

      <View style={{ gap: space.xl }}>{nearby.data?.requests.map(card)}</View>

      {!coords ? (
        <BigButton label={t("shareLocation")} icon="📍" onPress={() => void refreshLocation()} />
      ) : null}
    </Screen>
  );
}
