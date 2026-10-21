// Make a plan from a conversation: where (public place name) + when.
// The safety loop (share with trusted contact, I'm safe) lives on the plan
// screen this creates.
import { Alert, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import type { PlanDTO } from "@parea/shared";
import { Screen } from "../../src/components/Screen";
import { BigButton } from "../../src/components/BigButton";
import { Body } from "../../src/components/ui";
import { Chip, ChipGrid, SectionHeader, TextField } from "../../src/components/fields";
import { api, ApiError } from "../../src/lib/api";
import { toIso } from "../../src/lib/time";
import { useT } from "../../src/i18n";
import { useStore } from "../../src/store";

const DAYS = [
  { offset: 0, key: "today" as const },
  { offset: 1, key: "tomorrow" as const },
  { offset: 3, key: "in3days" as const },
];
const TIMES = [
  { hour: 10, key: "morning" as const },
  { hour: 13, key: "midday" as const },
  { hour: 16, key: "afternoon" as const },
  { hour: 19, key: "evening" as const },
];

export default function NewPlan() {
  const t = useT();
  const router = useRouter();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const [place, setPlace] = useState("");
  const [dayOffset, setDayOffset] = useState<number | null>(null);
  const [hour, setHour] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const startsAt = (): string | null => {
    if (dayOffset === null || hour === null) return null;
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, 0, 0, 0);
    if (d.getTime() < Date.now() + 30 * 60 * 1000) return null;
    return toIso(d);
  };

  const create = async () => {
    setError(null);
    const starts_at = startsAt();
    if (!place.trim()) {
      setError(t("planPlaceHint"));
      return;
    }
    if (!starts_at) {
      setError(t("whenQ"));
      return;
    }
    setBusy(true);
    try {
      const result = await api<{ plan: PlanDTO }>(`/plans/${matchId}/plan`, {
        body: { place_name: place.trim(), starts_at },
      });
      // OK moves the screen — never navigate underneath an alert.
      Alert.alert(t("planCreated"), undefined, [
        { text: t("ok"), onPress: () => router.replace(`/plans/${result.plan.id}`) },
      ]);
    } catch (e) {
      Alert.alert(
        t("genericError"),
        e instanceof ApiError && e.status === 409 ? t("planAlready") : t("networkError"),
      );
    } finally {
      setBusy(false);
    }
  };

  const canCreate = !!place.trim() && startsAt() !== null;

  return (
    <Screen
      title={t("makePlan")}
      footer={
        <BigButton label={t("createPlan")} size="big" disabled={!canCreate} busy={busy} onPress={() => void create()} />
      }
    >
      <TextField
        label={t("planPlaceQ")}
        value={place}
        onChangeText={setPlace}
        placeholder={t("planPlaceHint")}
        error={error}
        multiline
      />

      <View style={{ gap: 16 }}>
        <SectionHeader>{t("whenQ")}</SectionHeader>
        <ChipGrid>
          {DAYS.map((d) => (
            <Chip
              key={d.key}
              label={t(d.key)}
              selected={dayOffset === d.offset}
              onToggle={() => setDayOffset(d.offset)}
            />
          ))}
        </ChipGrid>
        <ChipGrid>
          {TIMES.map((slot) => (
            <Chip
              key={slot.key}
              label={t(slot.key)}
              selected={hour === slot.hour}
              disabled={dayOffset === null || (dayOffset === 0 && new Date().getHours() >= slot.hour)}
              onToggle={() => setHour(slot.hour)}
            />
          ))}
        </ChipGrid>
      </View>

      <Body muted>{t("planPlaceHint")}</Body>
    </Screen>
  );
}
