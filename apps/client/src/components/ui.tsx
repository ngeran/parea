// Small shared pieces: text styles, cards, settings rows, empty states and
// the authenticated avatar. Everything uses the design tokens via useTheme()
// and carries its accessibility roles/labels.
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { useMemo, useState } from "react";
import type { Lang, PublicProfile } from "@parea/shared";
import { API_BASE } from "../lib/api";
import { BigButton } from "./BigButton";
import { ELEVATION, useTheme } from "../theme";
import { useStore } from "../store";
import { useT } from "../i18n";
import { tr } from "../i18n";

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { c, space, radius, themeName } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: c.surface,
          borderRadius: radius.lg,
          padding: space.xl,
          gap: space.m,
          // High contrast: surface == bg there, so cards need an outline to
          // exist at all (plan §4.3 "3 px borders"). Elsewhere a hairline +
          // soft shadow carry the card — depth, not loud outlines.
          ...(themeName === "contrast"
            ? { borderWidth: 3, borderColor: c.border }
            : { borderWidth: 1, borderColor: c.hairline, ...ELEVATION.sm }),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  const { c, f } = useTheme();
  return (
    <Text accessible accessibilityRole="header" style={{ color: c.text, fontSize: f.title, lineHeight: f.title * 1.3, fontWeight: "700" }}>
      {children}
    </Text>
  );
}

export function Body({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  const { c, f } = useTheme();
  return (
    <Text style={{ color: muted ? c.textSecondary : c.text, fontSize: f.body, lineHeight: f.body * 1.4 }}>
      {children}
    </Text>
  );
}

/** A tappable settings row — ≥ 88 px, icon + label always together. */
export function SettingsRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress: () => void;
}) {
  const { c, f, touch, space, radius, themeName } = useTheme();
  // Press state as data (not just a style function) so the label color can
  // follow the fill: on primarySoft, labels use onSoft — which flips to
  // black in the high-contrast theme, where primarySoft is white.
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label + (value ? `, ${value}` : "")}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.m,
        minHeight: touch.row,
        paddingHorizontal: space.xl,
        backgroundColor: pressed ? c.primarySoft : c.surface,
        borderRadius: radius.md,
        // High contrast: surface == bg, so rows need a 3 px outline
        // (plan §4.3). Elsewhere a hairline defines the row against the bg.
        ...(themeName === "contrast"
          ? { borderWidth: 3, borderColor: c.border }
          : { borderWidth: 1, borderColor: c.hairline }),
      }}
    >
      <Text style={{ fontSize: f.title, color: pressed ? c.onSoft : c.text }}>{icon}</Text>
      <Text
        style={{
          color: pressed ? c.onSoft : c.text,
          fontSize: f.body,
          fontWeight: "600",
          flex: 1,
        }}
      >
        {label}
      </Text>
      {value ? (
        <Text style={{ color: pressed ? c.onSoft : c.textSecondary, fontSize: f.label }}>
          {value}
        </Text>
      ) : null}
      <Text style={{ color: pressed ? c.onSoft : c.textSecondary, fontSize: f.title }}>›</Text>
    </Pressable>
  );
}

export function EmptyState({ emoji, text }: { emoji: string; text: string }) {
  const { c, f, space } = useTheme();
  return (
    <View style={{ alignItems: "center", gap: space.l, paddingVertical: space.xxl }}>
      <Text style={{ fontSize: 52 }}>{emoji}</Text>
      <Text style={{ color: c.textSecondary, fontSize: f.body, textAlign: "center", lineHeight: f.body * 1.4 }}>
        {text}
      </Text>
    </View>
  );
}

/**
 * Fetch failed — message plus an optional Retry. Assertive live region so
 * screen readers announce the failure instead of leaving a silent screen
 * (Phase 6 rule 5: errors must never look like an empty state).
 */
export function ErrorState({
  text,
  onRetry,
  retryLabel,
}: {
  text: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  const { c, f, space } = useTheme();
  return (
    <View
      accessibilityLiveRegion="assertive"
      style={{ alignItems: "center", gap: space.l, paddingVertical: space.xxl }}
    >
      <Text style={{ fontSize: 52 }}>⚠️</Text>
      <Text style={{ color: c.danger, fontSize: f.body, textAlign: "center", lineHeight: f.body * 1.4 }}>
        {text}
      </Text>
      {onRetry ? (
        <BigButton label={retryLabel ?? "Retry"} variant="soft" onPress={onRetry} />
      ) : null}
    </View>
  );
}

/** One line: name · age · ✔ Verified (all in plain text, screen-reader friendly). */
export function ProfileLine({ person, lang }: { person: PublicProfile; lang: Lang }) {
  const { c, f } = useTheme();
  const t = useT();
  const age = person.birth_year ? new Date().getFullYear() - person.birth_year : null;
  return (
    <Text style={{ color: c.textSecondary, fontSize: f.body, lineHeight: f.body * 1.4 }}>
      {person.first_name}
      {age ? `, ${tr(lang, "yearsOld", { age })}` : ""}
      {person.verified ? `  ✔ ${t("verified")}` : ""}
      {person.volunteer ? `  🤝 ${t("volunteerBadge")}` : ""}
    </Text>
  );
}

/**
 * Avatar — the photo lives behind the session, so the image request carries
 * the Authorization header. No photo (or a failed load) shows the initial.
 */
export function Avatar({
  photoUrl,
  name,
  size = 96,
}: {
  photoUrl: string | null;
  name: string;
  size?: number;
}) {
  const { c, f } = useTheme();
  const token = useStore((s) => s.token);
  // Server photos arrive as absolute paths ("/photos/…") — prefix the API
  // base. Local file URIs (photo preview during setup) are used as-is.
  const uri = useMemo(
    () => (photoUrl ? (photoUrl.startsWith("/") ? `${API_BASE}${photoUrl}` : photoUrl) : null),
    [photoUrl],
  );
  if (!uri) {
    return (
      <View
        accessible
        accessibilityLabel={name}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: c.primarySoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* onSoft, not primary: in the high-contrast theme primarySoft is
            white and a primary-colored (white) initial would vanish. */}
        <Text style={{ color: c.onSoft, fontSize: size / 2.4, fontWeight: "700" }}>
          {name.trim().charAt(0).toUpperCase() || "?"}
        </Text>
      </View>
    );
  }
  return (
    <Image
      accessible
      accessibilityLabel={name}
      source={{ uri, headers: { authorization: `Bearer ${token ?? ""}` } }}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.surface }}
      contentFit="cover"
    />
  );
}
