// Home — the bento grid: greeting, real counters, the big "I'd like company"
// hero tile with its one big button, four tactile activity tiles (nearby
// walks, nearby coffee, volunteers, my schedule), the SOS card and the
// user's own open requests. One primary action on screen; every number is
// real (live query counts) — the mockup's presence/availability figures had
// no honest data behind them, so tiles show live invite counts instead.
import { Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, type ReactNode } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { activityLabel, placeTypeLabel } from "@parea/shared";
import { BigButton } from "../../src/components/BigButton";
import { IconTile } from "../../src/components/IconTile";
import { StatPill, StatusBadge } from "../../src/components/bits";
import { Avatar, Body, Card, EmptyState, ErrorState } from "../../src/components/ui";
import { localeOf } from "../../src/lib/api";
import { ensureCoords } from "../../src/lib/location";
import { toast } from "../../src/lib/notify";
import { registerPush } from "../../src/lib/push";
import { formatToday, formatWhen } from "../../src/lib/time";
import { useRefreshOnFocus } from "../../src/lib/useRefreshOnFocus";
import { useT } from "../../src/i18n";
import { CTA_GRADIENT, COLUMN, ELEVATION, useBreakpoint, useTheme, withAlpha, type TintHue } from "../../src/theme";
import { useStore } from "../../src/store";
import { useMyRequests, useNearbyRequests, usePlans } from "../../src/lib/queries";

export default function Home() {
  const t = useT();
  const { c, f, space, touch, radius, themeName } = useTheme();
  const router = useRouter();
  const profile = useStore((s) => s.profile);
  const coords = useStore((s) => s.coords);
  const setCoords = useStore((s) => s.setCoords);
  const language = useStore((s) => s.language);
  const token = useStore((s) => s.token);
  const insets = useSafeAreaInsets();
  const { isWide } = useBreakpoint();
  const myRequests = useMyRequests();
  const plans = usePlans();
  const nearby = useNearbyRequests(coords);

  // Tab screens never remount — refetch stale data when the tab is revisited.
  useRefreshOnFocus(["requests", "mine"]);
  useRefreshOnFocus(["requests", "nearby"]);
  useRefreshOnFocus(["plans"]);

  // The three live counters under the greeting — real numbers, never filler.
  const openCount = myRequests.data?.requests.length ?? 0;
  const offersCount = myRequests.data?.requests.reduce((sum, r) => sum + r.offered_count, 0) ?? 0;
  const plansCount = plans.data?.plans.length ?? 0;
  const nextPlan = plans.data?.plans[0];

  // Honest tile facts: the walk/coffee tiles count real open invites of
  // that activity nearby; absent coords or an empty list says so in words.
  const nearbyRequests = nearby.data?.requests ?? [];
  const walkCount = nearbyRequests.filter((r) => r.activity === "walk").length;
  const coffeeCount = nearbyRequests.filter((r) => r.activity === "coffee").length;

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

  /**
   * A tactile bento tile: emoji tile up top, title + colored-dot fact below.
   * `accent` carries the dot/subtitle color on plain container surfaces
   * (never on a tint); the high-contrast theme flattens it to white/black.
   */
  const tile = (
    emoji: string,
    hue: TintHue,
    title: string,
    subtitle: string,
    accent: "cyan" | "amber" | "neutral",
    trailing: ReactNode,
    onPress: () => void,
  ) => {
    const accentColor =
      themeName === "contrast"
        ? c.onSurface
        : accent === "cyan"
          ? c.secondary
          : accent === "amber"
            ? c.tertiary
            : c.onSurfaceVariant;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${subtitle}`}
        onPress={onPress}
        style={({ pressed }) => ({
          flexGrow: 1,
          minWidth: isWide ? "47%" : "100%",
          minHeight: 150,
          backgroundColor: pressed ? c.surfaceContainerHigh : c.surfaceContainer,
          borderRadius: radius.xl,
          padding: space.l,
          gap: space.m,
          justifyContent: "space-between",
          borderWidth: themeName === "contrast" ? 3 : 1,
          borderColor: themeName === "contrast" ? c.outline : c.outlineVariant,
        })}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
          <IconTile emoji={emoji} size={48} shape="circle" hue={hue} />
          {trailing}
        </View>
        <View style={{ gap: 4 }}>
          <Text style={{ color: c.onSurface, fontSize: f.body + 1, fontWeight: "700" }}>
            {title}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View
              accessible={false}
              style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accentColor }}
            />
            <Text
              style={{ color: accentColor, fontSize: f.label, fontWeight: "600" }}
              numberOfLines={2}
            >
              {subtitle}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

  const heroBody = (
    <>
      {/* Live badge — only when the real nearby list says so. */}
      {nearbyRequests.length > 0 ? (
        <View
          style={{
            alignSelf: "flex-start",
            flexDirection: "row",
            alignItems: "center",
            gap: space.s,
            backgroundColor: withAlpha(c.ctaLabel, 0.18),
            borderRadius: 999,
            paddingHorizontal: space.m,
            paddingVertical: 4,
          }}
        >
          <View
            accessible={false}
            style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c.ctaLabel }}
          />
          <Text style={{ color: c.ctaLabel, fontSize: f.label, fontWeight: "800" }}>
            {t("invitesNow", { n: nearbyRequests.length })}
          </Text>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.l }}>
        <View
          accessible={false}
          style={{
            width: 64,
            height: 64,
            borderRadius: 17,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: c.surfaceContainerLowest,
          }}
        >
          <Text style={{ fontSize: 30 }}>☕</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            accessible
            accessibilityRole="header"
            style={{ color: c.ctaLabel, fontSize: f.hero, lineHeight: f.hero * 1.15, fontWeight: "800" }}
          >
            {t("idLikeCompany")}
          </Text>
          <Text style={{ color: c.ctaLabel, fontSize: f.body, lineHeight: f.body * 1.35 }}>
            {t("askNearby")}
          </Text>
        </View>
      </View>
      {/* THE action — a light pill on the ember card, >60px tall. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("findCompanyNow")}
        onPress={() => router.push("/requests/new")}
        style={({ pressed }) => ({
          minHeight: 60,
          borderRadius: radius.md,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: space.m,
          paddingHorizontal: space.xl,
          backgroundColor: pressed ? c.surfaceContainer : c.surfaceContainerLowest,
          // Contrast: black pill on the white card, 3 px white edge.
          borderWidth: themeName === "contrast" ? 3 : 0,
          borderColor: c.outline,
        })}
      >
        <Text style={{ color: c.ctaFill, fontSize: f.button, fontWeight: "800" }}>
          {t("findCompanyNow")}
        </Text>
        <View
          accessible={false}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: withAlpha(c.ctaFill, 0.15),
          }}
        >
          <Text style={{ color: c.ctaFill, fontSize: f.title }}>▶</Text>
        </View>
      </Pressable>
    </>
  );

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

      {/* Live counters — each pill taps nothing; they are just a glance.
          Wraps to two rows on very narrow screens or huge text. */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.s }}>
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

      {/* The bento hero: ember gradient card (white card + 3 px edge in
          contrast), live invite badge, and the one big button inside. */}
      {themeName === "contrast" ? (
        <View
          style={{
            gap: space.m,
            padding: space.xl,
            borderRadius: radius.xl,
            backgroundColor: c.ctaFill,
            borderWidth: 3,
            borderColor: c.outline,
          }}
        >
          {heroBody}
        </View>
      ) : (
        <LinearGradient
          colors={themeName === "dark" ? CTA_GRADIENT.dark : CTA_GRADIENT.light}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{
            gap: space.m,
            padding: space.xl,
            borderRadius: radius.xl,
            overflow: "hidden",
            ...ELEVATION.md,
            shadowColor: c.ctaFill,
            shadowOpacity: 0.4,
            shadowRadius: 16,
          }}
        >
          {heroBody}
        </LinearGradient>
      )}

      {/* The four tactile tiles — two-up once the column is wide enough
          (tablet/landscape); stacked on phones. Facts are live counts. */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.m }}>
        {tile(
          "🚶",
          "cyan",
          t("tileWalk"),
          walkCount > 0 ? t("walkInvites", { n: walkCount }) : t("noInvites"),
          "cyan",
          <Text accessible={false} style={{ color: c.onSurfaceVariant, fontSize: f.title }}>›</Text>,
          () => router.push("/requests/nearby?filter=walk"),
        )}
        {tile(
          "☕",
          "amber",
          t("tileCoffee"),
          coffeeCount > 0 ? t("coffeeInvites", { n: coffeeCount }) : t("noInvites"),
          "amber",
          <Text accessible={false} style={{ color: c.onSurfaceVariant, fontSize: f.title }}>›</Text>,
          () => router.push("/requests/nearby?filter=coffee"),
        )}
        {tile(
          "🤝",
          "success",
          t("tileVolunteers"),
          t("volunteersHint"),
          "neutral",
          <StatusBadge emoji="💛" label={t("freeBadge")} hue="success" />,
          () => router.push("/discover"),
        )}
        {tile(
          "📅",
          "ember",
          t("tileSchedule"),
          nextPlan
            ? `${formatWhen(nextPlan.starts_at, language)} · ${t("planWith", { name: nextPlan.other.first_name })}`
            : t("scheduleEmpty"),
          "neutral",
          nextPlan ? (
            <Text
              accessible={false}
              style={{ color: c.secondary, fontSize: f.label, fontWeight: "800" }}
            >
              {new Date(nextPlan.starts_at).toLocaleTimeString(localeOf(language), {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          ) : null,
          () => router.push("/plans"),
        )}
      </View>

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
