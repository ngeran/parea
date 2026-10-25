// Create request — 3 steps + confirm (plan §7.5):
//   What? (activity) → When? (day + time of day) → Where? (place + radius)
// Each step is filtered by the previous one: the place list follows the
// activity (a phone call has no meeting place — it's auto-set and the
// question disappears), "Another day…" expands the next two weeks, and
// "At a specific time…" expands an hour grid. Location is fetched when the
// last step opens — BEFORE any dialog — so a missing fix shows an inline
// error with a Retry instead of a confirm-popup that loops forever.
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import {
  ACTIVITIES,
  HELP_ACTIVITY_KEYS,
  PLACE_TYPES,
  PLACE_TYPE_KEYS,
  activityLabel,
  placeTypeLabel,
  type RequestDTO,
} from "@parea/shared";
import { Screen } from "../../src/components/Screen";
import { BigButton } from "../../src/components/BigButton";
import { StepProgress } from "../../src/components/StepProgress";
import { Body, Card, Title } from "../../src/components/ui";
import { Chip, ChipGrid, RadioRow, SectionHeader } from "../../src/components/fields";
import { api, ApiError } from "../../src/lib/api";
import { ensureCoords } from "../../src/lib/location";
import { ackDialog, confirmDialog, toast } from "../../src/lib/notify";
import { formatDayShort, toIso } from "../../src/lib/time";
import { activityHint, useT } from "../../src/i18n";
import { useTheme, type TintHue } from "../../src/theme";
import { useStore } from "../../src/store";

const DAYS = [
  { offset: 0, key: "today" as const },
  { offset: 1, key: "tomorrow" as const },
  { offset: 3, key: "in3days" as const },
  { offset: 7, key: "in7days" as const },
];
// The "Another day…" grid: every day of the next two weeks that the preset
// chips don't already cover.
const CUSTOM_DAYS = Array.from({ length: 14 }, (_, i) => i + 1).filter(
  (offset) => !DAYS.some((d) => d.offset === offset),
);
const TIMES = [
  { hour: 10, key: "morning" as const },
  { hour: 13, key: "midday" as const },
  { hour: 16, key: "afternoon" as const },
  { hour: 19, key: "evening" as const },
];
// The exact-time grid: whole hours 06:00–23:00 plus a :00/:30 minute row.
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6);
const MINUTES = [0, 30];
const RADII = [2, 5, 15, 30];

/**
 * Tile tint per choice — pure decoration (the emoji carries the meaning),
 * varied like the mockup's activity cards. Anything unmapped falls to ember.
 */
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
const PLACE_HUES: Record<string, TintHue> = {
  cafe: "ember",
  park: "cyan",
  walk_route: "cyan",
  supermarket: "amber",
  home_area: "success",
  call: "success",
  other: "ember",
};

/**
 * Which meeting places make sense per activity — step 3 only ever offers
 * these. A single-entry list auto-selects (a phone call IS by phone).
 * Activities not listed can pick any place.
 */
const ACTIVITY_PLACES: Record<string, readonly string[]> = {
  coffee: ["cafe"],
  supermarket: ["supermarket"],
  errands: ["supermarket", "home_area", "other"],
  meal: ["cafe", "other"],
  walk: ["park", "walk_route", "home_area"],
  call: ["call"],
  tech_help: ["home_area", "call", "other"],
  ride: ["other"],
  house_help: ["home_area"],
  paperwork: ["home_area", "call", "other"],
};

export default function NewRequest() {
  const t = useT();
  const { c, f, space } = useTheme();
  const language = useStore((s) => s.language);
  const coords = useStore((s) => s.coords);

  const [step, setStep] = useState(1);
  const [activity, setActivity] = useState<string | null>(null);
  const [dayOffset, setDayOffset] = useState<number | null>(null);
  const [customDaysOpen, setCustomDaysOpen] = useState(false);
  const [hour, setHour] = useState<number | null>(null);
  const [exactOpen, setExactOpen] = useState(false);
  const [exactHour, setExactHour] = useState<number | null>(null);
  const [exactMinute, setExactMinute] = useState<number>(0);
  const [placeType, setPlaceType] = useState<string | null>(null);
  const [radius, setRadius] = useState(10);
  const [busy, setBusy] = useState(false);
  const [locFailed, setLocFailed] = useState(false);

  const allowedPlaces = activity ? ACTIVITY_PLACES[activity] ?? PLACE_TYPE_KEYS : [];
  const isCall = activity === "call";
  // A phone call has no "how far away" — the request shows up to the largest
  // audience without asking a question that means nothing on the phone.
  const effectiveRadius = isCall ? RADII[RADII.length - 1] : radius;

  /** Pick an activity and keep step 3 consistent with it. */
  const selectActivity = (key: string) => {
    setActivity(key);
    const allowed = ACTIVITY_PLACES[key] ?? PLACE_TYPE_KEYS;
    if (allowed.length === 1) setPlaceType(allowed[0]);
    else if (placeType && !allowed.includes(placeType)) setPlaceType(null);
  };

  /** Hours already past today can't be picked for "Today". */
  const slotPassed = (offset: number, h: number) =>
    offset === 0 && new Date().getHours() >= h;

  /** "Today" dies entirely once its last slot is gone — the chip disables so
      the user is never stranded on a day with zero pickable times. */
  const dayDead = (offset: number) =>
    offset === 0 && TIMES.every((s) => slotPassed(offset, s.hour));

  /** Exact-time slots in the past (today only) are disabled, not hidden. */
  const exactSlotPassed = (h: number, m: number) => {
    if (dayOffset !== 0) return false;
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.getTime() < Date.now() + 30 * 60 * 1000;
  };

  const startsAt = (): string | null => {
    if (dayOffset === null) return null;
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    if (exactOpen) {
      if (exactHour === null) return null;
      d.setHours(exactHour, exactMinute, 0, 0);
    } else {
      if (hour === null) return null;
      d.setHours(hour, 0, 0, 0);
    }
    if (d.getTime() < Date.now() + 30 * 60 * 1000) return null; // must be ≥ 30 min ahead
    return toIso(d);
  };

  // Step 3 needs a position before anything can be sent — fetch it when the
  // step opens (never inside the confirm), with an inline Retry on failure.
  useEffect(() => {
    if (step !== 3 || coords || busy) return;
    let cancelled = false;
    void (async () => {
      try {
        const got = await ensureCoords();
        if (!cancelled && got) setLocFailed(false);
        else if (!cancelled) setLocFailed(true);
      } catch {
        if (!cancelled) setLocFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, coords, busy]);

  const send = async () => {
    const starts_at = startsAt();
    if (!starts_at || !activity || !placeType) {
      toast(t("chooseOne"), "error");
      return;
    }
    // Never let a location problem throw its way out of this function —
    // that is what made the confirm dialog look like it was looping.
    let fix = coords;
    if (!fix) {
      try {
        fix = await ensureCoords();
      } catch {
        fix = null;
      }
    }
    if (!fix) {
      setLocFailed(true);
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
          lat: fix.lat,
          lng: fix.lng,
          radius_km: effectiveRadius,
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
        body: t("confirmSendBody", { km: effectiveRadius }),
        okLabel: t("yesSend"),
        cancelLabel: t("noBack"),
      },
      () => void send(),
    );
  };

  const timeChosen = exactOpen ? exactHour !== null : hour !== null;
  const canNext = step === 1 ? !!activity : step === 2 ? startsAt() !== null : !!placeType && !!coords;

  return (
    <Screen
      title={t("newRequestTitle")}
      showHome
      avoidKeyboard
      footer={
        <View style={{ gap: 8 }}>
          {!canNext ? (
            <Body muted>{step === 3 && !coords ? t("locationNote") : t("chooseOne")}</Body>
          ) : null}
          <BigButton
            label={step === 3 ? t("continue_") : t("next")}
            eyebrow={step < 3 ? t("nextEyebrow") : undefined}
            size="big"
            gradient
            disabled={!canNext}
            busy={busy}
            onPress={() => (step < 3 ? setStep(step + 1) : confirmSend())}
          />
          {/* The mockup's trust line — reassurance right where hesitation
              peaks (before the first send). */}
          <Text
            accessible
            style={{ color: c.onSurfaceVariant, fontSize: f.label, textAlign: "center" }}
          >
            🔒 {t("noCharge")}
          </Text>
        </View>
      }
    >
      <StepProgress
        step={step}
        total={3}
        label={t("stepN", { n: step })}
        steps={[t("stepWhat"), t("stepWhen"), t("stepWhere")]}
      />

      {step === 1 ? (
        <View style={{ gap: space.m }}>
          {/* The mockup's big opening question + one line of guidance. */}
          <Title>{t("whatHero")}</Title>
          <Body muted>{t("wizardGuidance")}</Body>
          {/* Amber reassurance card — honest, no counts: what happens after
              the send and who decides. */}
          <Card variant="amber">
            <Body>💛 {t("wizardReassure")}</Body>
          </Card>
          <View style={{ gap: space.m }}>
            {ACTIVITIES.filter((a) => !HELP_ACTIVITY_KEYS.includes(a.key)).map((a) => (
              <RadioRow
                key={a.key}
                emoji={a.emoji}
                hue={ACTIVITY_HUES[a.key] ?? "ember"}
                label={activityLabel(a.key, language)}
                subtitle={activityHint(a.key, language)}
                selected={activity === a.key}
                onSelect={() => selectActivity(a.key)}
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
                hue={ACTIVITY_HUES[a.key] ?? "ember"}
                label={activityLabel(a.key, language)}
                subtitle={activityHint(a.key, language)}
                selected={activity === a.key}
                onSelect={() => selectActivity(a.key)}
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
                  disabled={dayDead(d.offset)}
                  onToggle={() => setDayOffset(d.offset)}
                />
              ))}
              {/* Selected iff the current day is one of the grid's custom
                  days — the grid itself stays open/closed independently. */}
              <Chip
                label={t("otherDay")}
                selected={dayOffset !== null && !DAYS.some((d) => d.offset === dayOffset)}
                onToggle={() => setCustomDaysOpen(!customDaysOpen)}
              />
            </ChipGrid>
            {customDaysOpen ? (
              <ChipGrid>
                {CUSTOM_DAYS.map((offset) => (
                  <Chip
                    key={offset}
                    label={formatDayShort(offset, language)}
                    selected={dayOffset === offset}
                    onToggle={() => setDayOffset(offset)}
                  />
                ))}
              </ChipGrid>
            ) : null}
          </View>
          <View style={{ gap: space.m }}>
            <SectionHeader>{`${t("whenQ")} ⏰`}</SectionHeader>
            <ChipGrid>
              {TIMES.map((slot) => (
                <Chip
                  key={slot.key}
                  label={t(slot.key)}
                  selected={!exactOpen && hour === slot.hour}
                  disabled={dayOffset === null || slotPassed(dayOffset, slot.hour)}
                  onToggle={() => setHour(slot.hour)}
                />
              ))}
              <Chip
                label={t("exactTime")}
                selected={exactOpen}
                disabled={dayOffset === null}
                onToggle={() => {
                  const open = !exactOpen;
                  setExactOpen(open);
                  if (open) setHour(null);
                  else setExactHour(null);
                }}
              />
            </ChipGrid>
            {exactOpen ? (
              <View style={{ gap: space.m }}>
                <Body muted>{t("pickHour")}</Body>
                <ChipGrid>
                  {HOURS.map((h) => (
                    <Chip
                      key={h}
                      label={`${String(h).padStart(2, "0")}`}
                      selected={exactHour === h}
                      disabled={exactSlotPassed(h, exactMinute)}
                      onToggle={() => setExactHour(h)}
                    />
                  ))}
                </ChipGrid>
                <ChipGrid>
                  {MINUTES.map((m) => (
                    <Chip
                      key={m}
                      label={m === 0 ? ":00" : ":30"}
                      selected={exactMinute === m}
                      onToggle={() => {
                        setExactMinute(m);
                        // The minute flip can push an already-picked hour
                        // into the past (today) — drop it so Continue
                        // doesn't silently deadlock.
                        if (exactHour !== null && exactSlotPassed(exactHour, m)) {
                          setExactHour(null);
                        }
                      }}
                    />
                  ))}
                </ChipGrid>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {step === 3 ? (
        <View style={{ gap: space.xl }}>
          {/* Location first: without it nothing can be sent, so it is the
              step's gate — with an inline Retry, not a looping dialog. */}
          {!coords ? (
            <Card>
              <Body>{t("locationNote")}</Body>
              <BigButton
                label={t("tryAgain")}
                icon="📍"
                variant="soft"
                busy={busy || (!coords && !locFailed)}
                onPress={() => {
                  setLocFailed(false);
                  // Re-running the gate effect is easiest via a state nudge.
                  void (async () => {
                    try {
                      const got = await ensureCoords();
                      if (!got) setLocFailed(true);
                    } catch {
                      setLocFailed(true);
                    }
                  })();
                }}
              />
            </Card>
          ) : null}

          {isCall ? (
            <Card>
              <Body>{t("callNoPlace")}</Body>
            </Card>
          ) : (
            <View style={{ gap: space.m }}>
              <SectionHeader>{t("whereQ")}</SectionHeader>
              <View style={{ gap: space.m }}>
                {PLACE_TYPES.filter((p) => allowedPlaces.includes(p.key)).map((p) => (
                  <RadioRow
                    key={p.key}
                    emoji={p.emoji}
                    hue={PLACE_HUES[p.key] ?? "ember"}
                    label={placeTypeLabel(p.key, language)}
                    selected={placeType === p.key}
                    onSelect={() => setPlaceType(p.key)}
                  />
                ))}
              </View>
            </View>
          )}

          {!isCall ? (
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
            </View>
          ) : null}

          <Card style={{ padding: 16 }}>
            <Body muted>{t("confirmSendBody", { km: effectiveRadius })}</Body>
          </Card>
        </View>
      ) : null}
    </Screen>
  );
}
