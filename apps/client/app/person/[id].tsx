// One person's profile — the page behind a tapped Nearby card, chat name or
// responder row. Real data only: public fields, our wave/match state, their
// open invites (joinable under the same rules as the nearby list). The hero
// band echoes the mockup's overlap layout; everything wears the theme, so
// light/dark/contrast and all three text sizes stay first-class.
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ACTIVITIES,
  INTEREST_CHIPS,
  MOBILITY_LABELS,
  activityLabel,
  placeTypeLabel,
  type PersonRequestDTO,
} from "@parea/shared";
import { BigButton } from "../../src/components/BigButton";
import { Avatar, Body, Card, EmptyState, ErrorState } from "../../src/components/ui";
import { StatusBadge, QuoteWell, TrustNote } from "../../src/components/bits";
import { Screen } from "../../src/components/Screen";
import { CTA_GRADIENT, ELEVATION, useTheme } from "../../src/theme";
import { api, ApiError, localeOf } from "../../src/lib/api";
import { toast, ackDialog } from "../../src/lib/notify";
import { formatDistance, formatWhen } from "../../src/lib/time";
import { useT } from "../../src/i18n";
import { useStore } from "../../src/store";
import { errCode, usePerson } from "../../src/lib/queries";

const LANG_NAMES: Record<string, string> = { el: "Ελληνικά", en: "English" };

export default function PersonProfile() {
  const { c, f, space, radius, themeName } = useTheme();
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const language = useStore((s) => s.language);
  const myId = useStore((s) => s.profile?.id);
  const person = usePerson(id ?? "");
  const [pinging, setPinging] = useState(false);
  const [handling, setHandling] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["person", id] }),
      queryClient.invalidateQueries({ queryKey: ["nearby"] }),
      queryClient.invalidateQueries({ queryKey: ["pings"] }),
      queryClient.invalidateQueries({ queryKey: ["matches"] }),
    ]);
  };

  const wave = async () => {
    if (!id) return;
    setPinging(true);
    try {
      await api(`/pings/${id}`, { method: "POST" });
      toast(t("pingSent", { name: person.data?.person.first_name ?? "" }));
      await refresh();
    } catch {
      toast(t("networkError"), "error");
      await refresh();
    } finally {
      setPinging(false);
    }
  };

  const acceptWave = async () => {
    const pingId = person.data?.ping_id;
    if (!pingId) return;
    setHandling(true);
    try {
      const result = await api<{ match_id: string }>(`/pings/${pingId}/accept`, { method: "POST" });
      await refresh();
      // The OK tap moves the screen — never navigate underneath an alert.
      ackDialog(t("mutualToast"), t("ok"), () => router.push(`/chat/${result.match_id}`));
    } catch {
      toast(t("networkError"), "error");
      await refresh();
    } finally {
      setHandling(false);
    }
  };

  const declineWave = async () => {
    const pingId = person.data?.ping_id;
    if (!pingId) return;
    setHandling(true);
    try {
      await api(`/pings/${pingId}/decline`, { method: "POST" });
      await refresh();
    } catch {
      toast(t("networkError"), "error");
      await refresh();
    } finally {
      setHandling(false);
    }
  };

  const join = async (request: PersonRequestDTO) => {
    setJoining(request.id);
    try {
      await api(`/requests/${request.id}/responses`, { method: "POST" });
      toast(t("joinSent"));
      await refresh();
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
      await refresh();
    } finally {
      setJoining(null);
    }
  };

  if (person.isError) {
    return (
      <Screen title={t("genericError")}>
        <EmptyState emoji="🌫️" text={t("noLongerAvailable")} />
        <BigButton label={t("tryAgain")} icon="🔄" variant="soft" onPress={() => void person.refetch()} />
        <BigButton label={t("home")} icon="🏠" onPress={() => router.replace("/home")} />
      </Screen>
    );
  }

  const data = person.data;
  const p = data?.person;
  const age = p?.birth_year ? new Date().getFullYear() - p.birth_year : null;
  const isSelf = p?.id != null && p.id === myId;
  const memberSince = data
    ? new Intl.DateTimeFormat(localeOf(language), { month: "long", year: "numeric" }).format(
        new Date(data.member_since),
      )
    : "";

  // The one action the current relationship allows — never two competing
  // primaries. Self has no footer: you don't wave at yourself.
  const footer =
    !data || isSelf
      ? undefined
      : data.connection === "accepted"
        ? (<BigButton
            label={t("openChat")}
            icon="💬"
            onPress={() => data.match_id && router.push(`/chat/${data.match_id}`)}
          />)
        : data.connection === "incoming"
          ? (<View style={{ flexDirection: "row", gap: space.l }}>
              <View style={{ flex: 1 }}>
                <BigButton
                  label={t("accept")}
                  icon="👋"
                  onPress={() => void acceptWave()}
                  busy={handling}
                />
              </View>
              <View style={{ flex: 1 }}>
                <BigButton
                  label={t("declinePing")}
                  variant="quiet"
                  onPress={() => void declineWave()}
                  disabled={handling}
                />
              </View>
            </View>)
          : data.connection === "outgoing"
            ? <BigButton label={t("pingWaiting")} variant="quiet" disabled onPress={() => {}} />
            : <BigButton label={t("pingCta")} icon="👋" onPress={() => void wave()} busy={pinging} />;

  const sectionTitle = (emoji: string, label: string) => (
    <Text
      accessible
      accessibilityRole="header"
      style={{ color: c.text, fontSize: f.title, fontWeight: "800" }}
    >
      {emoji} {label}
    </Text>
  );

  return (
    <Screen title={p?.first_name ?? t("loading")} footer={footer}>
      {person.isLoading || !p || !data ? (
        <Body muted>{t("loading")}</Body>
      ) : (
        <View style={{ gap: space.xl }}>
          {/* ── Hero: ember band + overlapping gradient-ring portrait ── */}
          <View style={{ alignItems: "center" }}>
            <LinearGradient
              colors={themeName === "dark" ? CTA_GRADIENT.dark : CTA_GRADIENT.light}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{
                position: "absolute",
                top: 0,
                left: -space.xl,
                right: -space.xl,
                height: 84,
                borderBottomLeftRadius: radius.xl,
                borderBottomRightRadius: radius.xl,
                ...(themeName === "contrast"
                  ? { backgroundColor: c.surfaceContainerHigh, borderWidth: 3, borderColor: c.outline }
                  : ELEVATION.md),
              }}
            />
            <View style={{ marginTop: 24 }}>
              <Avatar photoUrl={p.photo_url} name={p.first_name} size={116} imageKey={p.id} />
            </View>

            {/* Name + age pill, centered like the mockup's identity block */}
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "center",
                gap: space.s,
                marginTop: space.m,
              }}
            >
              <Text
                accessible
                accessibilityRole="header"
                style={{ color: c.text, fontSize: f.hero, fontWeight: "800", textAlign: "center" }}
              >
                {p.first_name}
              </Text>
              {age ? (
                <View
                  style={{
                    backgroundColor: c.primarySoft,
                    borderRadius: radius.pill,
                    paddingHorizontal: space.l,
                    paddingVertical: 6,
                    borderWidth: themeName === "contrast" ? 3 : 0,
                    borderColor: c.border,
                  }}
                >
                  <Text style={{ color: c.onSoft, fontSize: f.label, fontWeight: "800" }}>
                    {t("yearsOld", { age })}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Trust + distance badges */}
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: space.s,
                marginTop: space.m,
              }}
            >
              {p.verified ? <StatusBadge emoji="✔" label={t("verifiedNeighbor")} hue="cyan" /> : null}
              {p.volunteer ? <StatusBadge emoji="🤝" label={t("volunteerBadge")} hue="success" /> : null}
              {p.distance_km !== undefined ? (
                <StatusBadge
                  emoji="📍"
                  label={t("kmAway", { d: formatDistance(p.distance_km, language) })}
                  hue="cyan"
                />
              ) : null}
            </View>

            <Text style={{ color: c.textSecondary, fontSize: f.label, marginTop: space.s }}>
              🗓️ {t("memberSince", { date: memberSince })}
            </Text>
          </View>

          {/* ── Their live invites — real requests, joinable in place ── */}
          {data.requests.length > 0 ? (
            <View style={{ gap: space.m }}>
              {sectionTitle("✨", t("lookingFor"))}
              {data.requests.map((request) => {
                const emoji = ACTIVITIES.find((a) => a.key === request.activity)?.emoji ?? "✨";
                return (
                  <Card key={request.id}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: space.m }}>
                      <Text style={{ fontSize: f.title }}>{emoji}</Text>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={{ color: c.text, fontSize: f.body, fontWeight: "700" }}>
                          {activityLabel(request.activity, language)}
                        </Text>
                        <Text style={{ color: c.textSecondary, fontSize: f.label }}>
                          🕐 {formatWhen(request.starts_at, language)} ·{" "}
                          {placeTypeLabel(request.place_type, language)}
                        </Text>
                      </View>
                    </View>
                    {isSelf ? null : request.my_response ? (
                      <Body muted>⏳ {t("youOffered")}</Body>
                    ) : (
                      <BigButton
                        label={t("canJoin")}
                        icon="🙋"
                        onPress={() => void join(request)}
                        busy={joining === request.id}
                      />
                    )}
                  </Card>
                );
              })}
            </View>
          ) : null}

          {/* ── About — their own words in the quote well ── */}
          {p.about ? (
            <View style={{ gap: space.m }}>
              {sectionTitle("💬", t("personAbout"))}
              <QuoteWell>{p.about}</QuoteWell>
            </View>
          ) : null}

          {/* ── Interests — emoji bento tiles, two per row ── */}
          {p.interests.length > 0 ? (
            <View style={{ gap: space.m }}>
              {sectionTitle("💛", t("personInterests"))}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.m }}>
                {p.interests.map((key) => {
                  const chip = INTEREST_CHIPS.find((ch) => ch.key === key);
                  if (!chip) return null;
                  return (
                    <View
                      key={key}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: space.m,
                        flexGrow: 1,
                        flexBasis: "45%",
                        backgroundColor: c.surfaceContainerLow,
                        borderRadius: radius.md,
                        padding: space.m,
                        borderWidth: themeName === "contrast" ? 3 : 1,
                        borderColor: themeName === "contrast" ? c.border : c.hairline,
                      }}
                    >
                      <Text style={{ fontSize: f.title }}>{chip.emoji}</Text>
                      <Text
                        style={{ color: c.text, fontSize: f.label, fontWeight: "700", flex: 1 }}
                        numberOfLines={2}
                      >
                        {chip.label[language]}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* ── Languages & mobility — the quiet practical facts ── */}
          {p.languages.length > 0 || (!isSelf && MOBILITY_LABELS[p.mobility]) ? (
            <View style={{ gap: space.m }}>
              {p.languages.length > 0 ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space.s,
                    flexWrap: "wrap",
                  }}
                >
                  <Text style={{ color: c.textSecondary, fontSize: f.label, fontWeight: "700" }}>
                    {t("speaksLabel")}:
                  </Text>
                  {p.languages.map((lang) => (
                    <StatusBadge key={lang} emoji="🗣️" label={LANG_NAMES[lang] ?? lang} hue="amber" />
                  ))}
                </View>
              ) : null}
              {!isSelf && MOBILITY_LABELS[p.mobility] ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
                  <Text style={{ color: c.textSecondary, fontSize: f.label, fontWeight: "700" }}>
                    {t("mobilityLabel")}:
                  </Text>
                  <Text style={{ color: c.text, fontSize: f.label }}>
                    {MOBILITY_LABELS[p.mobility][language]}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Safety: report, one tap away on a stranger's page. */}
          {!isSelf ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("report")}
              onPress={() =>
                router.push(`/report?targetId=${p.id}&name=${encodeURIComponent(p.first_name)}`)
              }
              style={({ pressed }) => ({
                minHeight: 48,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={{ color: c.danger, fontSize: f.label, fontWeight: "700" }}>
                🚩 {t("report")}
              </Text>
            </Pressable>
          ) : null}

          <TrustNote emoji="💚">{t("nearbyTrust")}</TrustNote>
        </View>
      )}
    </Screen>
  );
}
