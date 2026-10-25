// Plans tab — upcoming meetings, soonest first, with the safety state at a
// glance (shared with the trusted contact? checked in?).
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PlanListItem } from "@parea/shared";
import { Avatar, Body, EmptyState, ErrorState, Title } from "../../src/components/ui";
import { formatWhen } from "../../src/lib/time";
import { useRefreshOnFocus } from "../../src/lib/useRefreshOnFocus";
import { useT } from "../../src/i18n";
import { ELEVATION, useTheme, withAlpha } from "../../src/theme";
import { useStore } from "../../src/store";
import { usePlans } from "../../src/lib/queries";

export default function Plans() {
  const t = useT();
  const { c, f, space, touch, radius, themeName } = useTheme();
  const router = useRouter();
  const language = useStore((s) => s.language);
  const insets = useSafeAreaInsets();
  const plans = usePlans();

  // Tab screens never remount — refetch stale data when the tab is revisited.
  useRefreshOnFocus(["plans"]);

  // Soonest meeting is the hero (the mockup's featured RSVP card); the rest
  // are compact avatar rows below it.
  const all = plans.data?.plans ?? [];
  const [next, ...rest] = all;

  const card = (plan: PlanListItem) => (
    <Pressable
      key={plan.id}
      accessibilityRole="button"
      accessibilityLabel={`${plan.place_name}, ${formatWhen(plan.starts_at, language)}, ${t("planWith", { name: plan.other.first_name })}`}
      onPress={() => router.push(`/plans/${plan.id}`)}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: space.m,
        backgroundColor: pressed ? c.primarySoft : c.surface,
        borderRadius: radius.md,
        padding: space.l,
        minHeight: touch.row,
        borderWidth: themeName === "contrast" ? 3 : 1,
        borderColor: themeName === "contrast" ? c.border : c.hairline,
      })}
    >
      <Avatar photoUrl={plan.other.photo_url ?? null} name={plan.other.first_name} size={48} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: c.text, fontSize: f.body, fontWeight: "700" }}>
          {plan.place_name}
        </Text>
        <Text style={{ color: c.accent, fontSize: f.label, fontWeight: "700" }}>
          📅 {formatWhen(plan.starts_at, language)}
        </Text>
        <Text style={{ color: c.textSecondary, fontSize: f.label }}>
          {t("planWith", { name: plan.other.first_name })}
        </Text>
      </View>
      <Text
        style={{
          color: plan.shared_with_contact_at ? c.success : c.textSecondary,
          fontSize: f.label,
          fontWeight: "600",
        }}
      >
        {plan.shared_with_contact_at ? "✓" : "○"}
      </Text>
    </Pressable>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ padding: space.xl, gap: space.xl, paddingTop: insets.top + space.xl }}
    >
      <Title>{t("plansTitle")}</Title>

      {plans.isLoading ? <Body muted>{t("loading")}</Body> : null}

      {plans.isError ? (
        <ErrorState
          text={t("networkError")}
          retryLabel={t("tryAgain")}
          onRetry={() => void plans.refetch()}
        />
      ) : null}

      {all.length === 0 && !plans.isLoading && !plans.isError ? (
        <EmptyState emoji="📅" text={t("noPlans")} />
      ) : null}

      {next ? (
        /* Featured hero — the next meeting, in primary fill with a glow. */
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t("nextMeeting")}: ${next.place_name}, ${formatWhen(next.starts_at, language)}`}
          onPress={() => router.push(`/plans/${next.id}`)}
          style={({ pressed }) => ({
            gap: space.s,
            backgroundColor: pressed ? c.primarySoft : c.primary,
            borderRadius: radius.lg,
            padding: space.xl,
            ...(themeName === "contrast"
              ? {}
              : { ...ELEVATION.md, shadowColor: c.primary, shadowOpacity: 0.35, shadowRadius: 12 }),
          })}
        >
          <Text
            style={{
              alignSelf: "flex-start",
              color: c.onPrimary,
              fontSize: f.label,
              fontWeight: "800",
              backgroundColor: withAlpha(c.onPrimary, 0.16),
              borderRadius: 999,
              paddingHorizontal: space.m,
              paddingVertical: 4,
              overflow: "hidden",
            }}
          >
            {t("nextMeeting")}
          </Text>
          <Text style={{ color: c.onPrimary, fontSize: f.title, fontWeight: "800" }}>
            📍 {next.place_name}
          </Text>
          <Text style={{ color: c.onPrimary, fontSize: f.body, fontWeight: "600" }}>
            📅 {formatWhen(next.starts_at, language)}
          </Text>
          <Text style={{ color: withAlpha(c.onPrimary, 0.85), fontSize: f.body }}>
            {t("planWith", { name: next.other.first_name })}
          </Text>
          <Text
            style={{
              color: withAlpha(c.onPrimary, 0.9),
              fontSize: f.label,
              fontWeight: "600",
            }}
          >
            {next.shared_with_contact_at ? `✓ ${t("sharedWithContact")}` : t("notSharedYet")}
          </Text>
        </Pressable>
      ) : null}

      <View style={{ gap: space.m }}>{rest.map(card)}</View>
    </ScrollView>
  );
}
