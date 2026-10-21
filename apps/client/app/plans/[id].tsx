// Our plan — where, when, with whom; share with the trusted contact; the big
// green "I'M SAFE" after the meeting (asking harder once the time has passed),
// and SOS, whose alert carries this plan's place and time to the contacts.
import { Alert, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BigButton } from "../../src/components/BigButton";
import { Body, Card, EmptyState, Avatar } from "../../src/components/ui";
import { Screen } from "../../src/components/Screen";
import { api } from "../../src/lib/api";
import { formatWhen } from "../../src/lib/time";
import { useT } from "../../src/i18n";
import { useTheme } from "../../src/theme";
import { useStore } from "../../src/store";
import { errCode, usePlan } from "../../src/lib/queries";

export default function PlanDetail() {
  const t = useT();
  const { c, f, space } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const language = useStore((s) => s.language);
  const plan = usePlan(id ?? "");
  const [busy, setBusy] = useState(false);

  const share = async () => {
    setBusy(true);
    try {
      await api(`/plans/${id}/share`, { method: "POST" });
      await queryClient.invalidateQueries({ queryKey: ["plan", id] });
      await queryClient.invalidateQueries({ queryKey: ["plans"] });
      Alert.alert(t("planShared"));
    } catch (e) {
      if (errCode(e) === "no_trusted_contact") {
        Alert.alert(t("addContactFirst"), t("addContactBody"), [
          { text: t("cancel"), style: "cancel" },
          { text: t("openSettings"), onPress: () => router.push("/settings/contacts") },
        ]);
      } else {
        Alert.alert(t("genericError"), t("networkError"));
      }
    } finally {
      setBusy(false);
    }
  };

  const checkIn = async () => {
    setBusy(true);
    try {
      await api(`/plans/${id}/safe-checkin`, { method: "POST" });
      await queryClient.invalidateQueries({ queryKey: ["plan", id] });
      await queryClient.invalidateQueries({ queryKey: ["plans"] });
      Alert.alert(t("imSafeDone"));
    } catch {
      Alert.alert(t("genericError"), t("networkError"));
    } finally {
      setBusy(false);
    }
  };

  const cancelPlan = () => {
    Alert.alert(t("confirmCancelPlan"), "", [
      { text: t("keepIt"), style: "cancel" },
      {
        text: t("yesCancel"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await api(`/plans/${id}`, { method: "PATCH", body: { status: "cancelled" } });
              await queryClient.invalidateQueries({ queryKey: ["plans"] });
              router.back();
            } catch {
              Alert.alert(t("genericError"), t("networkError"));
            }
          })();
        },
      },
    ]);
  };

  if (plan.isLoading) {
    return (
      <Screen title={t("loading")}>
        <Body muted>{t("loading")}</Body>
      </Screen>
    );
  }

  if (plan.isError || !plan.data) {
    return (
      <Screen title={t("genericError")}>
        <EmptyState emoji="🌫️" text={t("noLongerAvailable")} />
        <BigButton
          label={t("tryAgain")}
          icon="🔄"
          variant="soft"
          onPress={() => void plan.refetch()}
        />
        <BigButton label={t("home")} icon="🏠" onPress={() => router.replace("/home")} />
      </Screen>
    );
  }

  const { plan: p } = plan.data;
  const checkedIn = p.safe_checkin_at !== null;
  // The meeting time passed without an "I'm safe" → the button asks harder.
  const overdue = !checkedIn && new Date(p.starts_at).getTime() < Date.now();

  return (
    <Screen title={t("planTitle")}>

      <Card>
        <Text style={{ color: c.text, fontSize: f.body + 2, fontWeight: "700" }}>📍 {p.place_name}</Text>
        <Text style={{ color: c.text, fontSize: f.body }}>📅 {formatWhen(p.starts_at, language)}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.m }}>
          <Avatar photoUrl={p.other.photo_url} name={p.other.first_name} size={56} />
          <Text style={{ color: c.textSecondary, fontSize: f.body }}>
            {t("planWith", { name: p.other.first_name })}
          </Text>
        </View>
        <Text
          style={{
            color: p.shared_with_contact_at ? c.success : c.textSecondary,
            fontSize: f.label,
            fontWeight: "600",
          }}
        >
          {p.shared_with_contact_at ? `✓ ${t("sharedWithContact")}` : t("notSharedYet")}
        </Text>
      </Card>

      {!p.shared_with_contact_at ? (
        <BigButton label={t("sharePlan")} icon="🔔" variant="soft" onPress={() => void share()} busy={busy} />
      ) : null}

      <View style={{ gap: space.m }}>
        {checkedIn ? (
          <Card>
            <Body>✅ {t("imSafeDone")}</Body>
          </Card>
        ) : (
          <>
            <BigButton
              label={overdue ? t("checkinUrgent") : t("imSafe")}
              icon="✅"
              variant="success"
              size="big"
              onPress={() => void checkIn()}
              busy={busy}
            />
            <Body muted>{t("safeNote")}</Body>
          </>
        )}
      </View>

      {/* SOS from a plan: the texted alert carries the place and time. */}
      <BigButton
        label={t("sosButton")}
        icon="🆘"
        variant="danger"
        onPress={() => router.push(`/sos?planId=${id}`)}
      />

      <BigButton label={t("cancelPlan")} variant="quiet" onPress={cancelPlan} />
    </Screen>
  );
}
