// Plans tab — upcoming meetings, soonest first, with the safety state at a
// glance (shared with the trusted contact? checked in?).
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Body, EmptyState, ErrorState, Title } from "../../src/components/ui";
import { formatWhen } from "../../src/lib/time";
import { useT } from "../../src/i18n";
import { useTheme } from "../../src/theme";
import { useStore } from "../../src/store";
import { usePlans } from "../../src/lib/queries";

export default function Plans() {
  const t = useT();
  const { c, f, space, touch } = useTheme();
  const router = useRouter();
  const language = useStore((s) => s.language);
  const plans = usePlans();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ padding: space.xl, gap: space.xl, paddingTop: space.xxxl }}
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

      {(plans.data?.plans.length ?? 0) === 0 && !plans.isLoading && !plans.isError ? (
        <EmptyState emoji="📅" text={t("noPlans")} />
      ) : null}

      <View style={{ gap: space.m }}>
        {plans.data?.plans.map((plan) => (
          <Pressable
            key={plan.id}
            accessibilityRole="button"
            accessibilityLabel={`${plan.place_name}, ${formatWhen(plan.starts_at, language)}, ${t("planWith", { name: plan.other.first_name })}`}
            onPress={() => router.push(`/plans/${plan.id}`)}
            style={({ pressed }) => ({
              backgroundColor: pressed ? c.primarySoft : c.surface,
              borderRadius: 16,
              padding: space.xl,
              gap: space.s,
              minHeight: touch.row,
            })}
          >
            <Text style={{ color: c.text, fontSize: f.body, fontWeight: "700" }}>
              📍 {plan.place_name}
            </Text>
            <Text style={{ color: c.text, fontSize: f.body }}>
              📅 {formatWhen(plan.starts_at, language)}
            </Text>
            <Text style={{ color: c.textSecondary, fontSize: f.body }}>
              {t("planWith", { name: plan.other.first_name })}
            </Text>
            <Text
              style={{
                color: plan.shared_with_contact_at ? c.success : c.textSecondary,
                fontSize: f.label,
                fontWeight: "600",
              }}
            >
              {plan.shared_with_contact_at ? `✓ ${t("sharedWithContact")}` : t("notSharedYet")}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
