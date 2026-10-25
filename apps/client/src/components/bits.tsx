// Small reusable pieces for the redesigned screens: status badges, filter
// pills, quote wells, stat tiles and trust notes. All static (non-input)
// decoration around real data — every number shown here is passed in by the
// screen and must be real (no filler counts anywhere).
import { Pressable, Text, View } from "react-native";
import type { ReactNode } from "react";
import { TINT, useTheme, type ThemeColors, type TintHue } from "../theme";

/** The bright accent of a tint hue — labels on dark tints, colored numbers. */
function hueAccent(c: ThemeColors, hue: TintHue): string {
  switch (hue) {
    case "ember":
      return c.primary;
    case "cyan":
      return c.secondary;
    case "amber":
      return c.tertiary;
    case "success":
      return c.success;
    case "danger":
      return c.error;
  }
}

/**
 * A small tinted pill naming a state ("✔ Verified", "3 km away"). The label
 * follows the tint discipline: dark themes get the bright accent of the same
 * hue (≥ 7:1 on the tint), light/high-contrast get onSurface.
 */
export function StatusBadge({
  emoji,
  label,
  hue = "ember",
}: {
  emoji?: string;
  label: string;
  hue?: TintHue;
}) {
  const { c, f, radius, space, themeName } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.xs,
        backgroundColor: TINT[themeName][hue],
        borderRadius: radius.pill,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderWidth: themeName === "contrast" ? 3 : 0,
        borderColor: c.border,
      }}
    >
      {emoji ? <Text style={{ fontSize: f.label }}>{emoji}</Text> : null}
      <Text
        style={{
          color: themeName === "dark" ? hueAccent(c, hue) : c.onSurface,
          fontSize: f.label,
          fontWeight: "700",
        }}
        numberOfLines={2}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * Single-select filter row (the nearby list's activity filter). All options
 * stay visible — no horizontal scrolling — because Greek labels run long and
 * nothing that hides options is kind to screen readers. Selected = the soft
 * pair with a 2 px CTA outline; unselected = quiet card.
 */
export function FilterPills({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const { c, f, touch, radius, themeName } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityLabel={o.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => ({
              minHeight: touch.min,
              paddingHorizontal: 18,
              borderRadius: radius.pill,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: selected ? c.primarySoft : pressed ? c.surfaceContainerHigh : c.surfaceContainer,
              borderWidth: selected ? 2 : themeName === "contrast" ? 3 : 1,
              borderColor: selected ? c.ctaFill : themeName === "contrast" ? c.border : c.hairline,
            })}
          >
            <Text
              style={{
                color: selected ? c.onSoft : c.text,
                fontSize: f.label,
                fontWeight: selected ? "800" : "600",
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * An inset quotation — a neighbor's own words in their card, or the trust
 * line on welcome. A 4 px CTA-colored spine marks it as a quote, the italic
 * carries the voice.
 */
export function QuoteWell({ children }: { children: ReactNode }) {
  const { c, f, space, radius, themeName } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        gap: space.m,
        backgroundColor: c.surfaceContainerLow,
        borderRadius: radius.md,
        padding: space.l,
        borderWidth: themeName === "contrast" ? 3 : 1,
        borderColor: themeName === "contrast" ? c.border : c.hairline,
      }}
    >
      <View style={{ width: 4, borderRadius: 2, backgroundColor: c.ctaFill }} />
      <Text
        style={{
          flex: 1,
          color: c.text,
          fontSize: f.body,
          fontStyle: "italic",
          lineHeight: f.body * 1.45,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

/**
 * One real number + its label, as a tile ("2 offers"). The pair reads as a
 * single announcement to screen readers; the number wears the hue accent on
 * the plain container fill (asserted in the contrast gate). Callers pass a
 * real count or don't render the pill at all.
 */
export function StatPill({ n, label, hue = "ember" }: { n: number; label: string; hue?: TintHue }) {
  const { c, f, space, radius, themeName } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${n} ${label}`}
      style={{
        flex: 1,
        alignItems: "center",
        gap: 2,
        backgroundColor: c.surfaceContainer,
        borderRadius: radius.md,
        paddingVertical: space.m,
        paddingHorizontal: space.s,
        borderWidth: themeName === "contrast" ? 3 : 1,
        borderColor: themeName === "contrast" ? c.border : c.hairline,
      }}
    >
      <Text
        accessible={false}
        style={{ color: hueAccent(c, hue), fontSize: f.title, fontWeight: "800" }}
      >
        {n}
      </Text>
      <Text
        accessible={false}
        style={{ color: c.onSurfaceVariant, fontSize: f.label, textAlign: "center" }}
        numberOfLines={2}
      >
        {label}
      </Text>
    </View>
  );
}

/** A quiet reassurance line — lock emoji + one sentence under a form/CTA. */
export function TrustNote({ children, emoji = "🔒" }: { children: ReactNode; emoji?: string }) {
  const { c, f, space } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
      <Text style={{ fontSize: f.body }}>{emoji}</Text>
      <Text style={{ flex: 1, color: c.onSurfaceVariant, fontSize: f.label, lineHeight: f.label * 1.4 }}>
        {children}
      </Text>
    </View>
  );
}
