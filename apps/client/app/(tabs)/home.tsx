// Home — the big "I'd like company" hero button, the paths to Nearby and
// Discover, and the user's own open requests. One primary action on screen.
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { activityLabel, placeTypeLabel } from "@parea/shared";
import { BigButton } from "../../src/components/BigButton";
import { Avatar, Body, Card, EmptyState, ErrorState } from "../../src/components/ui";
import { ensureCoords } from "../../src/lib/location";
import { toast } from "../../src/lib/notify";
import { registerPush } from "../../src/lib/push";
import { formatDistance, formatToday, formatWhen } from "../../src/lib/time";
import { useRefreshOnFocus } from "../../src/lib/useRefreshOnFocus";
import { useT } from "../../src/i18n";
import { ELEVATION, useTheme, withAlpha } from "../../src/theme";
import { useStore } from "../../src/store";
import { useMyRequests, usePlans } from "../../src/lib/queries";

export default function Home() {
  const t = useT();
  const { c, f, space, touch, radius, themeName } = useTheme();
  const router = useRouter();
  const profile = useStore((s) => s.profile);
  const coords = useStore((s) => s.coords);
  const setCoords = useStore((s) => s.setCoords);
  const language = useStore((s) => s.language);
  const token = useStore((s) => s.token);
  const myRequests = useMyRequests();
  const plans = usePlans();

  // Tab screens never remount — refetch stale data when the tab is revisited.
  useRefreshOnFocus(["requests", "mine"]);
  useRefreshOnFocus(["plans"]);

  // The three live counters under the greeting — real numbers, never filler.
  const openCount = myRequests.data?.requests.length ?? 0;
  const offersCount = myRequests.data?.requests.reduce((sum, r) => sum + r.offered_count, 0) ?? 0;
  const plansCount = plans.data?.plans.length ?? 0;
  const metrics: { n: number; label: string; color: string }[] = [
    { n: openCount, label: t("metricRequests"), color: c.primary },
    { n: offersCount, label: t("metricOffers"), color: c.accent },
    { n: plansCount, label: t("metricPlans"), color: c.success },
  ];

  // Best-effort push registration, once, after sign-in (native only).
  useEffect(() => {
    if (token) void registerPush();
  }, [token]);

  const shareLocation = async () => {
    const got = await ensureCoords();
    if (got) {
      setCoords(got);
      toast(t("locationShared"));
    } else {
      toast(t("locationFailed"), "error");
    }
  };

  const needsLocation = !profile?.lat && !coords;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ padding: space.xl, gap: space.xl, paddingTop: space.xxxl }}
    >
      {/* Greeting — the user's own avatar, today's date, then the name. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space.m,
          backgroundColor: c.surface,
          borderRadius: radius.lg,
          padding: space.xl,
          borderWidth: themeName === "contrast" ? 3 : 1,
          borderColor: themeName === "contrast" ? c.border : c.hairline,
        }}
      >
        <Avatar photoUrl={profile?.photo_url ?? null} name={profile?.first_name ?? "?"} size={56} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.textSecondary, fontSize: f.label, fontWeight: "600" }}>
            {t("todayLabel")}, {formatToday(language)}
          </Text>
          <Text
            accessible
            accessibilityRole="header"
            style={{ color: c.text, fontSize: f.hero, lineHeight: f.hero * 1.25, fontWeight: "800" }}
          >
            {t("hi", { name: profile?.first_name ?? "" })}
          </Text>
        </View>
      </View>

      {/* Live counters — each pill taps nothing; they are just a glance. */}
      <View style={{ flexDirection: "row", gap: space.s }}>
        {metrics.map((m) => (
          <View
            key={m.label}
            style={{
              flex: 1,
              alignItems: "center",
              gap: 2,
              backgroundColor: c.surface,
              borderRadius: radius.md,
              paddingVertical: space.m,
              borderWidth: themeName === "contrast" ? 3 : 1,
              borderColor: themeName === "contrast" ? c.border : c.hairline,
            }}
          >
            <Text style={{ color: m.color, fontSize: f.title, fontWeight: "800" }}>{m.n}</Text>
            <Text style={{ color: c.textSecondary, fontSize: f.label }}>{m.label}</Text>
          </View>
        ))}
      </View>

      {needsLocation ? (
        <Card>
          <Body>{t("locationNote")}</Body>
          <BigButton label={t("shareLocation")} icon="📍" variant="soft" onPress={() => void shareLocation()} />
        </Card>
      ) : null}

      {/* THE primary action — a glowing primary card: emoji tile, label +
          hint, trailing arrow (the mockup's hero, in app tokens). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t("idLikeCompany")}. ${t("askNearby")}`}
        onPress={() => router.push("/requests/new")}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: space.m,
          backgroundColor: c.primary,
          borderRadius: radius.lg,
          padding: space.xl,
          minHeight: touch.hero,
          opacity: pressed ? 0.9 : 1,
          ...(themeName === "contrast"
            ? {}
            : { ...ELEVATION.md, shadowColor: c.primary, shadowOpacity: 0.4, shadowRadius: 16 }),
        })}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: withAlpha(c.onPrimary, 0.16),
          }}
        >
          <Text style={{ fontSize: 30 }}>☕</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: c.onPrimary, fontSize: f.title, fontWeight: "800" }}>
            {t("idLikeCompany")}
          </Text>
          <Text style={{ color: withAlpha(c.onPrimary, 0.85), fontSize: f.label }}>
            {t("askNearby")}
          </Text>
        </View>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: withAlpha(c.onPrimary, 0.16),
          }}
        >
          <Text style={{ color: c.onPrimary, fontSize: f.title }}>→</Text>
        </View>
      </Pressable>

      {/* Secondary paths — selection-card rows with emoji tiles. */}
      {[
        { emoji: "👋", label: t("seeNearby"), to: "/requests/nearby" },
        { emoji: "🤝", label: t("discoverPeople"), to: "/discover" },
      ].map((row) => (
        <Pressable
          key={row.to}
          accessibilityRole="button"
          accessibilityLabel={row.label}
          onPress={() => router.push(row.to)}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: space.m,
            minHeight: touch.row,
            backgroundColor: pressed ? c.surfaceHigh : c.surface,
            borderRadius: radius.md,
            padding: space.l,
            borderWidth: themeName === "contrast" ? 3 : 1,
            borderColor: themeName === "contrast" ? c.border : c.hairline,
          })}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: c.surfaceHigh,
            }}
          >
            <Text style={{ fontSize: 24 }}>{row.emoji}</Text>
          </View>
          <Text style={{ color: c.text, fontSize: f.body, fontWeight: "700", flex: 1 }}>
            {row.label}
          </Text>
          <Text style={{ color: c.textSecondary, fontSize: f.title }}>›</Text>
        </Pressable>
      ))}

      {/* Emergency: a softly danger-tinted card so the red button lands on
          context. One tap opens /sos, which alerts immediately (no confirm). */}
      <View
        style={{
          gap: space.m,
          backgroundColor: themeName === "contrast" ? c.bg : withAlpha(c.danger, 0.12),
          borderRadius: radius.lg,
          padding: space.xl,
          borderWidth: themeName === "contrast" ? 3 : 1,
          borderColor: themeName === "contrast" ? c.border : c.hairline,
        }}
      >
        <Body>{t("sosHint")}</Body>
        <BigButton
          label={t("sosButton")}
          icon="🆘"
          variant="danger"
          onPress={() => router.push("/sos")}
        />
      </View>

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
                borderRadius: radius.md,
                padding: space.xl,
                gap: space.s,
                minHeight: touch.row,
                // Same card language as <Card>: hairline edge (3 px white
                // outline in the high-contrast theme, §4.3).
                borderWidth: themeName === "contrast" ? 3 : 1,
                borderColor: themeName === "contrast" ? c.border : c.hairline,
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
