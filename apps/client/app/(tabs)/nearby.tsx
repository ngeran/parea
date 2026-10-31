// Nearby tab — people around me within my radius (nearest first). A ping
// ("wave") is the only way in: the recipient accepts before any chat opens,
// so nobody gets messages from strangers. Incoming waves surface at the top
// ("They waved at you"); outgoing ones show "Waiting…" — a silent decline
// looks the same, by design. The 💛 filter narrows the list to volunteers.
import { FlatList, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { INTEREST_CHIPS, type IncomingPingDTO, type NearbyPersonDTO } from "@parea/shared";
import { BigButton } from "../../src/components/BigButton";
import { StatPill, StatusBadge, FilterPills, QuoteWell, TrustNote } from "../../src/components/bits";
import { Avatar, Body, EmptyState, ErrorState } from "../../src/components/ui";
import { Chip } from "../../src/components/fields";
import { Screen } from "../../src/components/Screen";
import { COLUMN, CTA_GRADIENT, ELEVATION, useTheme } from "../../src/theme";
import { api, ApiError } from "../../src/lib/api";
import { ensureCoords } from "../../src/lib/location";
import { ackDialog, toast } from "../../src/lib/notify";
import { formatDistance } from "../../src/lib/time";
import { useRefreshOnFocus } from "../../src/lib/useRefreshOnFocus";
import { useT } from "../../src/i18n";
import { useStore } from "../../src/store";
import { errCode, useIncomingPings, useNearbyPeople } from "../../src/lib/queries";

type PersonFilter = "all" | "volunteers";

export default function NearbyPeople() {
  const t = useT();
  const { c, f, space, radius, themeName } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const language = useStore((s) => s.language);
  const coords = useStore((s) => s.coords);
  const setCoords = useStore((s) => s.setCoords);
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<PersonFilter>("all");
  const [pinging, setPinging] = useState<string | null>(null);
  const [handling, setHandling] = useState<string | null>(null);
  const people = useNearbyPeople(coords);
  const pings = useIncomingPings();

  // Tab screens never remount — refetch stale data when the tab is revisited.
  useRefreshOnFocus(["nearby", "pings"]);

  const refreshLocation = async () => {
    const got = await ensureCoords();
    if (got) setCoords(got);
    else toast(t("locationFailed"), "error");
  };

  const afterPingChange = async () => {
    await queryClient.invalidateQueries({ queryKey: ["nearby"] });
    await queryClient.invalidateQueries({ queryKey: ["pings"] });
  };

  const ping = async (person: NearbyPersonDTO) => {
    setPinging(person.id);
    try {
      await api(`/pings/${person.id}`, { method: "POST" });
      toast(t("pingSent", { name: person.first_name }));
      await afterPingChange();
    } catch (e) {
      const code = errCode(e);
      toast(
        code === "ping_limit"
          ? t("pingLimit")
          : e instanceof ApiError && e.status === 404
            ? t("noLongerAvailable")
            : t("networkError"),
        "error",
      );
      await afterPingChange();
    } finally {
      setPinging(null);
    }
  };

  const accept = async (pingId: string) => {
    setHandling(pingId);
    try {
      const result = await api<{ match_id: string }>(`/pings/${pingId}/accept`, { method: "POST" });
      await queryClient.invalidateQueries({ queryKey: ["matches"] });
      await afterPingChange();
      // The OK tap moves the screen — never navigate underneath an alert
      // (screen readers lose the announcement otherwise).
      ackDialog(t("mutualToast"), t("ok"), () => router.push(`/chat/${result.match_id}`));
    } catch {
      toast(t("networkError"), "error");
      await afterPingChange();
    } finally {
      setHandling(null);
    }
  };

  const decline = async (wave: IncomingPingDTO) => {
    setHandling(wave.id);
    try {
      await api(`/pings/${wave.id}/decline`, { method: "POST" });
      await afterPingChange();
    } catch {
      toast(t("networkError"), "error");
      await afterPingChange();
    } finally {
      setHandling(null);
    }
  };

  // First visit: get the rounded location before asking the server.
  if (!coords && !people.isFetching) {
    void ensureCoords();
  }

  const all = people.data?.people ?? [];
  const visible = all.filter((p) => filter === "all" || p.volunteer);
  const waves = pings.data?.pings ?? [];

  const waveCard = (wave: IncomingPingDTO) => (
    <View
      key={wave.id}
      style={{
        backgroundColor: c.primarySoft,
        borderRadius: radius.lg,
        padding: space.xl,
        gap: space.m,
        borderWidth: themeName === "contrast" ? 3 : 1,
        borderColor: themeName === "contrast" ? c.outline : c.primarySoft,
      }}
    >
      <Text
        accessible
        accessibilityRole="header"
        style={{ color: c.onSoft, fontSize: f.label, fontWeight: "800" }}
      >
        👋 {t("theyWaved")}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.m }}>
        <Avatar
          photoUrl={wave.from.photo_url}
          name={wave.from.first_name}
          size={48}
          imageKey={wave.from.id}
          badge={wave.from.volunteer ? "volunteer" : wave.from.verified ? "verified" : undefined}
        />
        <Text style={{ color: c.onSurface, fontSize: f.body, fontWeight: "800" }} accessible>
          {wave.from.first_name}
          {wave.from.birth_year
            ? `, ${t("yearsOld", { age: new Date().getFullYear() - wave.from.birth_year })}`
            : ""}
        </Text>
      </View>
      {wave.from.about ? <QuoteWell>{wave.from.about}</QuoteWell> : null}
      <View style={{ flexDirection: "row", gap: space.l }}>
        <View style={{ flex: 1 }}>
          <BigButton label={t("accept")} icon="👋" onPress={() => void accept(wave.id)} busy={handling === wave.id} />
        </View>
        <View style={{ flex: 1 }}>
          <BigButton
            label={t("declinePing")}
            variant="quiet"
            onPress={() => void decline(wave)}
            disabled={handling === wave.id}
          />
        </View>
      </View>
    </View>
  );

  // A person, not a form field: distance + trust badges, face, their own
  // words — then the one action the ping state allows.
  const card = (person: NearbyPersonDTO) => {
    const cta =
      person.ping === "incoming" && person.ping_id ? (
        <BigButton
          label={t("accept")}
          icon="👋"
          onPress={() => void accept(person.ping_id!)}
          busy={handling === person.ping_id}
        />
      ) : person.ping === "none" ? (
        <BigButton
          label={t("pingCta")}
          onPress={() => void ping(person)}
          busy={pinging === person.id}
        />
      ) : (
        // Outgoing (and silently-declined) waves just wait.
        <BigButton label={t("pingWaiting")} variant="quiet" disabled onPress={() => {}} />
      );
    return (
      <View
        style={{
          backgroundColor: c.surfaceContainer,
          borderRadius: radius.lg,
          padding: space.xl,
          gap: space.m,
          borderWidth: themeName === "contrast" ? 3 : 1,
          borderColor: themeName === "contrast" ? c.outline : c.outlineVariant,
        }}
      >
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.s, alignItems: "center" }}>
          {person.verified ? <StatusBadge emoji="✔" label={t("verifiedNeighbor")} hue="cyan" /> : null}
          {person.distance_km !== undefined ? (
            <StatusBadge
              emoji="📍"
              label={t("kmAway", { d: formatDistance(person.distance_km, language) })}
              hue="cyan"
            />
          ) : null}
          {person.volunteer ? (
            <StatusBadge emoji="🤝" label={t("volunteerBadge")} hue="success" />
          ) : null}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: space.m }}>
          <Avatar
            photoUrl={person.photo_url}
            name={person.first_name}
            size={52}
            imageKey={person.id}
            badge={person.volunteer ? "volunteer" : person.verified ? "verified" : undefined}
          />
          <Text
            accessible
            style={{ color: c.onSurface, fontSize: f.body, fontWeight: "800", flex: 1 }}
          >
            {person.first_name}
            {person.birth_year
              ? `, ${t("yearsOld", { age: new Date().getFullYear() - person.birth_year })}`
              : ""}
          </Text>
        </View>

        {person.about ? <QuoteWell>{person.about}</QuoteWell> : null}

        {person.interests.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {person.interests.map((key) => {
              const chip = INTEREST_CHIPS.find((ch) => ch.key === key);
              return chip ? (
                <Chip key={key} as="tag" emoji={chip.emoji} label={chip.label[language]} />
              ) : null;
            })}
          </View>
        ) : null}

        {cta}
      </View>
    );
  };

  const listHeader = (
    <View style={{ gap: space.xl, paddingBottom: space.xl }}>
      {/* The hero banner — count only when the real list says so. */}
      <LinearGradient
        colors={themeName === "dark" ? CTA_GRADIENT.dark : CTA_GRADIENT.light}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{
          borderRadius: radius.lg,
          padding: space.xl,
          gap: space.m,
          overflow: "hidden",
          ...(themeName === "contrast"
            ? { borderWidth: 3, borderColor: c.outline }
            : ELEVATION.md),
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
          <Text style={{ fontSize: f.body }}>🟢</Text>
          <Text style={{ color: c.ctaLabel, fontSize: f.label, fontWeight: "700" }}>
            {t("peoplePulse")}
          </Text>
        </View>
        <Text
          accessible
          accessibilityRole="header"
          style={{
            color: c.ctaLabel,
            fontSize: f.title,
            lineHeight: f.title * 1.25,
            fontWeight: "800",
          }}
        >
          {t("peopleHeroTitle")}
        </Text>
        <Text style={{ color: c.ctaLabel, fontSize: f.body, lineHeight: f.body * 1.4, fontWeight: "600" }}>
          {t("peopleHeroBody")}
        </Text>
        {visible.length > 0 ? (
          <View style={{ flexDirection: "row" }}>
            <StatPill n={visible.length} label={t("peopleCount", { n: visible.length })} hue="cyan" />
          </View>
        ) : null}
      </LinearGradient>

      {/* Waves waiting for my answer ride above the list. */}
      {waves.length > 0 ? <View style={{ gap: space.xl }}>{waves.map(waveCard)}</View> : null}

      {!coords ? (
        <EmptyState emoji="📍" text={t("locationNote")} />
      ) : people.isError ? (
        <ErrorState
          text={t("networkError")}
          retryLabel={t("tryAgain")}
          onRetry={() => void people.refetch()}
        />
      ) : !people.isLoading && all.length === 0 ? (
        <EmptyState emoji="🌿" text={t("noPeopleNearby")} />
      ) : null}

      {all.length > 0 ? (
        <View style={{ gap: space.m }}>
          <FilterPills
            options={[
              { value: "all", label: t("filterAll") },
              { value: "volunteers", label: `💛 ${t("volunteersFilter")}` },
            ]}
            value={filter}
            onChange={(v) => setFilter(v as PersonFilter)}
          />
          {visible.length === 0 ? <Body muted>{t("filterEmpty")}</Body> : null}
        </View>
      ) : null}
      {people.isLoading ? <Body muted>{t("loading")}</Body> : null}
    </View>
  );

  const listFooter = (
    <View style={{ gap: space.xl, paddingTop: space.xl }}>
      {all.length > 0 ? <TrustNote emoji="💚">{t("nearbyTrust")}</TrustNote> : null}
      {!coords ? <BigButton label={t("shareLocation")} icon="📍" onPress={() => void refreshLocation()} /> : null}
    </View>
  );

  return (
    <Screen title={t("peopleNearbyTitle")} scroll={false}>
      <FlatList
        data={visible}
        renderItem={({ item }) => card(item)}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        ItemSeparatorComponent={() => <View style={{ height: space.xl }} />}
        contentContainerStyle={{
          ...COLUMN,
          padding: space.xl,
          paddingLeft: space.xl + insets.left,
          paddingRight: space.xl + insets.right,
          paddingBottom: space.xxxl + insets.bottom,
        }}
      />
    </Screen>
  );
}
