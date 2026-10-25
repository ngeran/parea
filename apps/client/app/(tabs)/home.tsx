// Home — the big "I'd like company" hero button (the ember gradient card),
// the paths to Nearby and Discover, and the user's own open requests. One
// primary action on screen; every number shown is real (live query counts).
import { Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { activityLabel, placeTypeLabel } from "@parea/shared";
import { BigButton } from "../../src/components/BigButton";
import { IconTile } from "../../src/components/IconTile";
import { StatPill } from "../../src/components/bits";
import { Avatar, Body, Card, EmptyState, ErrorState } from "../../src/components/ui";
import { ensureCoords } from "../../src/lib/location";
import { toast } from "../../src/lib/notify";
import { registerPush } from "../../src/lib/push";
import { formatDistance, formatToday, formatWhen } from "../../src/lib/time";
import { useRefreshOnFocus } from "../../src/lib/useRefreshOnFocus";
import { useT } from "../../src/i18n";
import { CTA_GRADIENT, ELEVATION, useTheme, withAlpha } from "../../src/theme";
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

  // THE primary action — the mockup's gradient hero: white-mark tile, two
  // text lines and a trailing arrow, all in the CTA label color.
  const heroA11y = {
    accessibilityRole: "button" as const,
    accessibilityLabel: `${t("idLikeCompany")}. ${t("askNearby")}`,
    onPress: () => router.push("/requests/new"),
  };
  const heroPress = ({ pressed }: { pressed: boolean }) => ({
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: space.m,
    padding: space.xl,
    minHeight: touch.hero,
    width: "100%" as const,
    backgroundColor: themeName === "contrast" ? c.ctaFill : "transparent",
    borderWidth: themeName === "contrast" ? 3 : 0,
    borderColor: c.outline,
    opacity: pressed ? 0.92 : 1,
  });
  const heroInner = (
    <>
      <View
        accessible={false}
        style={{
          width: 56,
          height: 56,
          borderRadius: 17,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: c.surfaceContainerLowest,
        }}
      >
        <Text style={{ fontSize: 30 }}>☕</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: c.ctaLabel, fontSize: f.title, fontWeight: "800" }}>
          {t("idLikeCompany")}
        </Text>
        <Text style={{ color: c.ctaLabel, fontSize: f.label, fontWeight: "600" }}>
          {t("askNearby")}
        </Text>
      </View>
      <View
        accessible={false}
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: withAlpha(c.ctaLabel, 0.18),
        }}
      >
        <Text style={{ color: c.ctaLabel, fontSize: f.title }}>→</Text>
      </View>
    </>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: space.xl, gap: space.xl, paddingTop: space.xxxl }}
    >
      {/* Greeting — the user's own avatar, today's date, then the name. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space.m,
          backgroundColor: c.surfaceContainer,
          borderRadius: radius.lg,
          padding: space.xl,
          borderWidth: themeName === "contrast" ? 3 : 1,
          borderColor: themeName === "contrast" ? c.outline : c.outlineVariant,
        }}
      >
        <Avatar photoUrl={profile?.photo_url ?? null} name={profile?.first_name ?? "?"} size={56} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.onSurfaceVariant, fontSize: f.label, fontWeight: "600" }}>
            {t("todayLabel")}, {formatToday(language)}
          </Text>
          <Text
            accessible
            accessibilityRole="header"
            style={{ color: c.onSurface, fontSize: f.hero, lineHeight: f.hero * 1.25, fontWeight: "800" }}
          >
            {t("hi", { name: profile?.first_name ?? "" })}
          </Text>
        </View>
      </View>

      {/* Live counters — each pill taps nothing; they are just a glance. */}
      <View style={{ flexDirection: "row", gap: space.s }}>
        <StatPill n={openCount} label={t("metricRequests")} hue="ember" />
        <StatPill n={offersCount} label={t("metricOffers")} hue="cyan" />
        <StatPill n={plansCount} label={t("metricPlans")} hue="success" />
      </View>

      {needsLocation ? (
        <Card>
          <Body>{t("locationNote")}</Body>
          <BigButton label={t("shareLocation")} icon="📍" variant="soft" onPress={() => void shareLocation()} />
        </Card>
      ) : null}

      {themeName === "contrast" ? (
        <Pressable {...heroA11y} style={heroPress}>
          {heroInner}
        </Pressable>
      ) : (
        <LinearGradient
          colors={themeName === "dark" ? CTA_GRADIENT.dark : CTA_GRADIENT.light}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{
            borderRadius: radius.lg,
            overflow: "hidden",
            ...ELEVATION.md,
            shadowColor: c.ctaFill,
            shadowOpacity: 0.4,
            shadowRadius: 16,
          }}
        >
          <Pressable {...heroA11y} style={heroPress}>
            {heroInner}
          </Pressable>
        </LinearGradient>
      )}

      {/* Secondary paths — selection-card rows with emoji tiles. */}
      {[
        { emoji: "👋", hue: "cyan" as const, label: t("seeNearby"), to: "/requests/nearby" },
        { emoji: "🤝", hue: "amber" as const, label: t("discoverPeople"), to: "/discover" },
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
            backgroundColor: pressed ? c.surfaceContainerHigh : c.surfaceContainer,
            borderRadius: radius.md,
            padding: space.l,
            borderWidth: themeName === "contrast" ? 3 : 1,
            borderColor: themeName === "contrast" ? c.outline : c.outlineVariant,
          })}
        >
          <IconTile emoji={row.emoji} size={48} shape="circle" hue={row.hue} />
          <Text style={{ color: c.onSurface, fontSize: f.body, fontWeight: "700", flex: 1 }}>
            {row.label}
          </Text>
          <Text style={{ color: c.onSurfaceVariant, fontSize: f.title }}>›</Text>
        </Pressable>
      ))}

      {/* Emergency: a danger-tinted card so the red button lands on context.
          One tap opens /sos, which alerts immediately (no confirm). */}
      <Card variant="danger">
        <Body>{t("sosHint")}</Body>
        <BigButton
          label={t("sosButton")}
          icon="🆘"
          variant="danger"
          onPress={() => router.push("/sos")}
        />
      </Card>

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
            style={{ color: c.onSurface, fontSize: f.body + 2, fontWeight: "700" }}
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
                backgroundColor: pressed ? c.primarySoft : c.surfaceContainer,
                borderRadius: radius.md,
                padding: space.xl,
                gap: space.s,
                minHeight: touch.row,
                // Same card language as <Card>: hairline edge (3 px white
                // outline in the high-contrast theme, §4.3).
                borderWidth: themeName === "contrast" ? 3 : 1,
                borderColor: themeName === "contrast" ? c.outline : c.outlineVariant,
              })}
            >
              <Text style={{ color: c.onSurface, fontSize: f.body, fontWeight: "700" }}>
                {activityLabel(request.activity, language)} · {formatWhen(request.starts_at, language)}
              </Text>
              <Text style={{ color: c.onSurfaceVariant, fontSize: f.label }}>
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
