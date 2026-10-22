// Create request — 3 steps + confirm (plan §7.5):
//   What? (activity) → When? (day + time of day) → Where? (place + radius)
// Back + Home always visible; the confirm dialog says exactly what happens.
import { View } from "react-native";
import { router } from "expo-router";
import { useState } from "react";
import {
  ACTIVITIES,
  HELP_ACTIVITY_KEYS,
  PLACE_TYPES,
  activityLabel,
  placeTypeLabel,
  type RequestDTO,
} from "@parea/shared";
import { Screen } from "../../src/components/Screen";
import { BigButton } from "../../src/components/BigButton";
import { Body, Card } from "../../src/components/ui";
import { Chip, ChipGrid, RadioRow, SectionHeader } from "../../src/components/fields";
import { api, ApiError } from "../../src/lib/api";
import { ensureCoords } from "../../src/lib/location";
import { ackDialog, confirmDialog, toast } from "../../src/lib/notify";
import { toIso } from "../../src/lib/time";
import { useT } from "../../src/i18n";
import { useTheme } from "../../src/theme";
import { useStore } from "../../src/store";

const DAYS = [
  { offset: 0, key: "today" as const },
  { offset: 1, key: "tomorrow" as const },
  { offset: 3, key: "in3days" as const },
  { offset: 7, key: "in7days" as const },
];
const TIMES = [
  { hour: 10, key: "morning" as const },
  { hour: 13, key: "midday" as const },
  { hour: 16, key: "afternoon" as const },
  { hour: 19, key: "evening" as const },
];
const RADII = [2, 5, 15, 30];

export default function NewRequest() {
  const t = useT();
  const { space } = useTheme();
  const language = useStore((s) => s.language);

  const [step, setStep] = useState(1);
  const [activity, setActivity] = useState<string | null>(null);
  const [dayOffset, setDayOffset] = useState<number | null>(null);
  const [hour, setHour] = useState<number | null>(null);
  const [placeType, setPlaceType] = useState<string | null>(null);
  const [radius, setRadius] = useState(10);
  const [busy, setBusy] = useState(false);

  /** Hours already past today can't be picked for "Today". */
  const slotPassed = (offset: number, h: number) =>
    offset === 0 && new Date().getHours() >= h;

  const startsAt = (): string | null => {
    if (dayOffset === null || hour === null) return null;
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, 0, 0, 0);
    if (d.getTime() < Date.now() + 30 * 60 * 1000) return null; // must be ≥ 30 min ahead
    return toIso(d);
  };

  const send = async () => {
    const starts_at = startsAt();
    const coords = await ensureCoords();
    if (!starts_at || !activity || !placeType || !coords) {
      toast(t("locationNote"), "error");
      return;
    }
    setBusy(true);
    try {
      const result = await api<{ request: RequestDTO }>("/requests", {
        body: {
          activity,
          starts_at,
          place_type: placeType,
          lat: coords.lat,
          lng: coords.lng,
          radius_km: radius,
        },
      });
      // OK moves the screen — never navigate underneath an alert.
      ackDialog(t("requestSent"), t("ok"), () => router.replace(`/requests/${result.request.id}`));
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "";
      toast(
        code === "request_limit_open"
          ? t("limitOpen")
          : code === "request_limit_day"
            ? t("limitDay")
            : code === "location_needed"
              ? t("locationNote")
              : t("networkError"),
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmSend = () => {
    confirmDialog(
      {
        title: t("confirmSendTitle"),
        body: t("confirmSendBody", { km: radius }),
        okLabel: t("yesSend"),
        cancelLabel: t("noBack"),
      },
      () => void send(),
    );
  };

  const canNext = step === 1 ? !!activity : step === 2 ? startsAt() !== null : !!placeType;

  return (
    <Screen
      title={t("newRequestTitle")}
      showHome
      speakText={`${t("newRequestTitle")}. ${t("stepN", { n: step })}`}
      footer={
        <View style={{ gap: 8 }}>
          {!canNext ? <Body muted>{t("chooseOne")}</Body> : null}
          <BigButton
            label={step === 3 ? t("continue_") : t("next")}
            size="big"
            disabled={!canNext}
            busy={busy}
            onPress={() => (step < 3 ? setStep(step + 1) : confirmSend())}
          />
        </View>
      }
    >
      <Body muted>{t("stepN", { n: step })}</Body>

      {step === 1 ? (
        <View style={{ gap: space.m }}>
          <SectionHeader>{t("whatQ")}</SectionHeader>
          <View style={{ gap: space.m }}>
            {ACTIVITIES.filter((a) => !HELP_ACTIVITY_KEYS.includes(a.key)).map((a) => (
              <RadioRow
                key={a.key}
                emoji={a.emoji}
                label={activityLabel(a.key, language)}
                selected={activity === a.key}
                onSelect={() => setActivity(a.key)}
              />
            ))}
          </View>
          <SectionHeader>{t("helpHeader")}</SectionHeader>
          <Body muted>{t("helpHint")}</Body>
          <View style={{ gap: space.m }}>
            {ACTIVITIES.filter((a) => HELP_ACTIVITY_KEYS.includes(a.key)).map((a) => (
              <RadioRow
                key={a.key}
                emoji={a.emoji}
                label={activityLabel(a.key, language)}
                selected={activity === a.key}
                onSelect={() => setActivity(a.key)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {step === 2 ? (
        <View style={{ gap: space.xl }}>
          <View style={{ gap: space.m }}>
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
          </View>
          <View style={{ gap: space.m }}>
            <SectionHeader>{`${t("whenQ")} ⏰`}</SectionHeader>
            <ChipGrid>
              {TIMES.map((slot) => (
                <Chip
                  key={slot.key}
                  label={t(slot.key)}
                  selected={hour === slot.hour}
                  disabled={dayOffset === null || slotPassed(dayOffset, slot.hour)}
                  onToggle={() => setHour(slot.hour)}
                />
              ))}
            </ChipGrid>
          </View>
        </View>
      ) : null}

      {step === 3 ? (
        <View style={{ gap: space.xl }}>
          <View style={{ gap: space.m }}>
            <SectionHeader>{t("whereQ")}</SectionHeader>
            <View style={{ gap: space.m }}>
              {PLACE_TYPES.map((p) => (
                <RadioRow
                  key={p.key}
                  emoji={p.emoji}
                  label={placeTypeLabel(p.key, language)}
                  selected={placeType === p.key}
                  onSelect={() => setPlaceType(p.key)}
                />
              ))}
            </View>
          </View>
          <View style={{ gap: space.m }}>
            <SectionHeader>{t("radiusQ")}</SectionHeader>
            <ChipGrid>
              {RADII.map((km) => (
                <Chip
                  key={km}
                  label={`${km} km`}
                  selected={radius === km}
                  onToggle={() => setRadius(km)}
                />
              ))}
            </ChipGrid>
            <Card style={{ padding: 16 }}>
              <Body muted>{t("confirmSendBody", { km: radius })}</Body>
            </Card>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}
