// Nearby requests — open requests within range, nearest first (§7.6).
// A gradient hero with the REAL live count (never invented), activity
// filter pills, and one card per neighbor: activity + distance badges,
// face with verification badge, their own words in a quote well, interest
// tags, read-aloud per card, and a single action: "I can join".
import { FlatList, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ACTIVITIES,
  INTEREST_CHIPS,
  activityLabel,
  placeTypeLabel,
  type RequestDTO,
} from "@parea/shared";
import { BigButton } from "../../src/components/BigButton";
import { StatPill, StatusBadge, FilterPills, QuoteWell, TrustNote } from "../../src/components/bits";
import { Avatar, Body, EmptyState, ErrorState } from "../../src/components/ui";
import { Chip } from "../../src/components/fields";
import { Screen } from "../../src/components/Screen";
import { COLUMN, CTA_GRADIENT, ELEVATION, useTheme, withAlpha, type TintHue } from "../../src/theme";
import { api, ApiError } from "../../src/lib/api";
import { ensureCoords } from "../../src/lib/location";
import { toast } from "../../src/lib/notify";
import { formatDistance, formatWhen } from "../../src/lib/time";
import { useT } from "../../src/i18n";
import { useStore } from "../../src/store";
import { errCode, useNearbyRequests } from "../../src/lib/queries";

// Tile/badge tint per activity — decoration only; the emoji + label carry
// the meaning (same mapping the wizard uses).
const ACTIVITY_HUES: Record<string, TintHue> = {
  coffee: "ember",
  meal: "amber",
  walk: "cyan",
  call: "success",
  supermarket: "amber",
  errands: "cyan",
  tech_help: "success",
  ride: "cyan",
  house_help: "amber",
  paperwork: "success",
};
const FILTER_KEYS = ["coffee", "walk", "meal"] as const;
const ACT_EMOJI = Object.fromEntries(ACTIVITIES.map((a) => [a.key, a.emoji]));

export default function Nearby() {
  const t = useT();
  const { c, f, space, radius, themeName } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const language = useStore((s) => s.language);
  const coords = useStore((s) => s.coords);
  const setCoords = useStore((s) => s.setCoords);
  const insets = useSafeAreaInsets();
  const [joining, setJoining] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const nearby = useNearbyRequests(coords);

  const refreshLocation = async () => {
    const got = await ensureCoords();
    if (got) setCoords(got);
    else toast(t("locationFailed"), "error");
  };

  const join = async (requestId: string) => {
    setJoining(requestId);
    try {
      await api(`/requests/${requestId}/responses`, { method: "POST" });
      toast(t("joinSent"));
      // The request leaves the list once we refresh (already answered).
      await queryClient.invalidateQueries({ queryKey: ["requests", "nearby"] });
    } catch (e) {
      const code = errCode(e);
      toast(
        code === "already_responded"
          ? t("askedToJoin")
          : code === "response_limit"
            ? t("responseLimit")
            : e instanceof ApiError && e.status === 404
              ? t("noLongerAvailable")
              : t("networkError"),
        "error",
      );
      await queryClient.invalidateQueries({ queryKey: ["requests", "nearby"] });
    } finally {
      setJoining(null);
    }
  };

  const requests = nearby.data?.requests ?? [];
  const visible = requests.filter((r) => filter === "all" || r.activity === filter);

  // A neighbor, not a form field: badges, face, their own words, then the
  // single action. Distance gets the cyan pill (the mockup's signature).
  const card = (request: RequestDTO) => {
    return (
      <View
        style={{
          backgroundColor: c.surfaceContainer,
          borderRadius: radius.lg,
          padding: space.xl,
          gap: space.m,
          borderWidth: themeName === "contrast" ? 3 : 1,
          borderColor: themeName === "contrast" ? c.outline : c.outlineVariant,
        }}
      >
        {/* Badges row: what + (verified) + distance, wrapping for long Greek. */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.s, alignItems: "center" }}>
          <StatusBadge
            emoji={ACT_EMOJI[request.activity] ?? "☕"}
            label={activityLabel(request.activity, language)}
            hue={ACTIVITY_HUES[request.activity] ?? "ember"}
          />
          {request.owner.verified ? (
            <StatusBadge emoji="✔" label={t("verifiedNeighbor")} hue="cyan" />
          ) : null}
          {request.owner.distance_km !== undefined ? (
            <StatusBadge
              emoji="📍"
              label={t("kmAway", { d: formatDistance(request.owner.distance_km, language) })}
              hue="cyan"
            />
          ) : null}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: space.m }}>
          <Avatar
            photoUrl={request.owner.photo_url ?? null}
            name={request.owner.first_name}
            size={52}
            imageKey={request.owner.id}
            badge={request.owner.volunteer ? "volunteer" : request.owner.verified ? "verified" : undefined}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: c.onSurface, fontSize: f.body, fontWeight: "800" }}>
              {request.owner.first_name}
              {request.owner.birth_year
                ? `, ${new Date().getFullYear() - request.owner.birth_year}`
                : ""}
            </Text>
            {request.owner.volunteer ? (
              <Text
                accessibilityLabel={t("volunteerBadge")}
                style={{ color: c.success, fontSize: f.label, fontWeight: "700" }}
              >
                🤝 {t("volunteerBadge")}
              </Text>
            ) : null}
          </View>
        </View>

        <Text style={{ color: c.onSurface, fontSize: f.body }}>
          📅 {formatWhen(request.starts_at, language)}
        </Text>
        <Text style={{ color: c.onSurfaceVariant, fontSize: f.body }}>
          {placeTypeLabel(request.place_type, language)}
        </Text>

        {request.owner.about ? (
          <QuoteWell>{request.owner.about}</QuoteWell>
        ) : null}

        {request.owner.interests.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {request.owner.interests.map((key) => {
              const chip = INTEREST_CHIPS.find((ch) => ch.key === key);
              return chip ? (
                <Chip key={key} as="tag" emoji={chip.emoji} label={chip.label[language]} />
              ) : null;
            })}
          </View>
        ) : null}

        <BigButton
          label={t("canJoin")}
          icon="🙋"
          onPress={() => void join(request.id)}
          busy={joining === request.id}
        />
      </View>
    );
  };

  // The list header (hero + states + filters) and footer ride inside the
  // FlatList so everything scrolls together — nearby is the one unbounded
  // list in the app, so it virtualizes instead of mapping into a ScrollView.
  const listHeader = (
    <View style={{ gap: space.xl, paddingBottom: space.xl }}>
      {/* The hero banner — count only when the real list says so. */}
      <LinearGradient
        colors={themeName === "dark" ? CTA_GRADIENT.dark : CTA_GRADIENT.light}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{
          borderRadius: radius.lg,
          padding: space.xl,
          gap: space.m,
          overflow: "hidden",
          ...(themeName === "contrast"
            ? { borderWidth: 3, borderColor: c.outline }
            : ELEVATION.md),
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
          <Text style={{ fontSize: f.body }}>🟢</Text>
          <Text style={{ color: c.ctaLabel, fontSize: f.label, fontWeight: "700" }}>
            {t("nearbyPulse")}
          </Text>
        </View>
        <Text
          accessible
          accessibilityRole="header"
          style={{
            color: c.ctaLabel,
            fontSize: f.title,
            lineHeight: f.title * 1.25,
            fontWeight: "800",
          }}
        >
          {t("nearbyHeroTitle")}
        </Text>
        <Text style={{ color: c.ctaLabel, fontSize: f.body, lineHeight: f.body * 1.4, fontWeight: "600" }}>
          {t("nearbyHeroBody")}
        </Text>
        {requests.length > 0 ? (
          <View style={{ flexDirection: "row" }}>
            <StatPill n={requests.length} label={t("nearbyCount", { n: requests.length })} hue="cyan" />
          </View>
        ) : null}
      </LinearGradient>

      {!coords ? (
        <EmptyState emoji="📍" text={t("locationNote")} />
      ) : nearby.isError ? (
        <ErrorState
          text={t("networkError")}
          retryLabel={t("tryAgain")}
          onRetry={() => void nearby.refetch()}
        />
      ) : !nearby.isLoading && requests.length === 0 ? (
        <EmptyState emoji="🌿" text={t("noneNearby")} />
      ) : null}

      {requests.length > 0 ? (
        <View style={{ gap: space.m }}>
          <FilterPills
            options={[
              { value: "all", label: t("filterAll") },
              ...FILTER_KEYS.map((key) => ({ value: key, label: activityLabel(key, language) })),
            ]}
            value={filter}
            onChange={setFilter}
          />
          {visible.length === 0 ? <Body muted>{t("filterEmpty")}</Body> : null}
        </View>
      ) : null}
      {nearby.isLoading ? <Body muted>{t("loading")}</Body> : null}
    </View>
  );

  const listFooter = (
    <View style={{ gap: space.xl, paddingTop: space.xl }}>
      {requests.length > 0 ? <TrustNote emoji="💚">{t("nearbyTrust")}</TrustNote> : null}
      {!coords ? (
        <BigButton label={t("shareLocation")} icon="📍" onPress={() => void refreshLocation()} />
      ) : (
        <BigButton
          label={t("nearbyCreateRequest")}
          icon="✨"
          variant="soft"
          onPress={() => router.push("/requests/new")}
        />
      )}
    </View>
  );

  return (
    <Screen title={t("nearbyTitle")} scroll={false}>
      <FlatList
        data={visible}
        renderItem={({ item }) => card(item)}
        keyExtractor={(r) => r.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        ItemSeparatorComponent={() => <View style={{ height: space.xl }} />}
        contentContainerStyle={{
          ...COLUMN,
          padding: space.xl,
          paddingLeft: space.xl + insets.left,
          paddingRight: space.xl + insets.right,
          paddingBottom: space.xxxl + insets.bottom,
        }}
      />
    </Screen>
  );
}
