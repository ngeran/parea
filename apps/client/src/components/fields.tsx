// Form building blocks: labeled text fields, big radio rows and selectable
// chips. All ≥ 48 px, explicit roles/states, labels always visible (never
// placeholder-only), errors read out by screen readers via accessibilityLabel.
import { Pressable, Text, TextInput, View } from "react-native";
import { useState } from "react";
import { ELEVATION, TINT, useTheme, type TintHue } from "../theme";

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  error,
  keyboardType = "default",
  multiline = false,
  accessibilityLabel,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string | null;
  keyboardType?: "default" | "phone-pad" | "number-pad";
  multiline?: boolean;
  accessibilityLabel?: string;
}) {
  const { c, f, space, radius, themeName } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: space.s }}>
      {label ? (
        <Text style={{ color: c.onSurface, fontSize: f.body, fontWeight: "600" }}>{label}</Text>
      ) : null}
      <TextInput
        accessibilityLabel={accessibilityLabel ?? `${label}${error ? `. ${error}` : ""}`}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.onSurfaceVariant}
        keyboardType={keyboardType}
        multiline={multiline}
        keyboardAppearance={themeName === "light" ? "light" : "dark"}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          // 66 px rest height — the extra air matters at xlarge text.
          minHeight: 66,
          borderRadius: radius.md,
          // Focused fields get the strong 2 px CTA ring (a clear focus
          // indicator matters more than décor); at rest a hairline on a
          // surface fill. High contrast keeps the 3 px outline always.
          borderWidth: themeName === "contrast" ? 3 : focused || error ? 2 : 1,
          borderColor: error
            ? c.error
            : focused
              ? c.ctaFill
              : themeName === "contrast"
                ? c.border
                : c.outlineVariant,
          paddingHorizontal: 16,
          paddingVertical: multiline ? 14 : 0,
          fontSize: f.body,
          color: c.onSurface,
          backgroundColor: c.surfaceContainer,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
      {hint && !error ? (
        <Text style={{ color: c.onSurfaceVariant, fontSize: f.label }}>{hint}</Text>
      ) : null}
      {error ? <Text style={{ color: c.error, fontSize: f.label }}>{error}</Text> : null}
    </View>
  );
}

/**
 * One radio choice as a selection card (the wizard's main building block):
 * tinted emoji tile, title + optional subtitle, and a rounded-square check
 * that fills with the CTA color (plus a soft glow) when selected. Whole card
 * tappable, ≥ 68 px.
 */
export function RadioRow({
  selected,
  label,
  subtitle,
  emoji,
  hue = "ember",
  onSelect,
}: {
  selected: boolean;
  label: string;
  subtitle?: string;
  emoji?: string;
  hue?: TintHue;
  onSelect: () => void;
}) {
  const { c, f, space, radius, themeName } = useTheme();
  // The glow is decoration — the high-contrast theme skips it, and the fill
  // + check carry the selection state instead.
  const glow =
    selected && themeName !== "contrast"
      ? { ...ELEVATION.sm, shadowColor: c.ctaFill, shadowOpacity: 0.3, shadowRadius: 8 }
      : {};
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={subtitle ? `${label}. ${subtitle}` : label}
      accessibilityState={{ selected }}
      onPress={onSelect}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: space.m,
        minHeight: 68,
        padding: space.m,
        borderRadius: radius.md,
        borderWidth: selected ? 2 : themeName === "contrast" ? 3 : 1,
        borderColor: selected ? c.ctaFill : themeName === "contrast" ? c.border : c.outlineVariant,
        backgroundColor: selected
          ? c.primarySoft
          : pressed
            ? c.surfaceContainerHigh
            : c.surfaceContainer,
        ...glow,
      })}
    >
      {emoji ? (
        // Decorative tile — selected cards bleach it to the lowest surface
        // so the check, border and fill carry the state (never color-only).
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={{
            width: 44,
            height: 44,
            borderRadius: 13,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: selected ? c.surfaceContainerLowest : TINT[themeName][hue],
            borderWidth: themeName === "contrast" ? 3 : 0,
            borderColor: c.border,
          }}
        >
          <Text style={{ fontSize: 24, lineHeight: 28 }}>{emoji}</Text>
        </View>
      ) : null}
      {/* Selected fills use primarySoft → labels follow onSoft (flips to
          black in the high-contrast theme, where primarySoft is white). */}
      <View style={{ flex: 1, gap: 1 }}>
        <Text
          style={{
            color: selected ? c.onSoft : c.onSurface,
            fontSize: f.body,
            fontWeight: selected ? "700" : "600",
          }}
        >
          {label}
        </Text>
        {subtitle ? (
          <Text
            style={{ color: selected ? c.onSoft : c.onSurfaceVariant, fontSize: f.label }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {/* Rounded-square check in the CTA color — the mockup's marker. */}
      <View
        accessible={false}
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          borderWidth: 2,
          borderColor: selected ? c.ctaFill : c.outline,
          backgroundColor: selected ? c.ctaFill : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selected ? (
          <Text style={{ color: c.ctaLabel, fontSize: 16, fontWeight: "800" }}>✓</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * Chips: `as="select"` (default) is the single/multi-select pill, ≥ 48 px,
 * emoji + label + a trailing ✓ that reserves its width so toggling never
 * reflows the grid; `as="tag"` is a static pill for display-only lists
 * (interests on a profile — nothing to tap).
 */
export function Chip({
  label,
  emoji,
  selected = false,
  onToggle,
  disabled = false,
  as = "select",
}: {
  label: string;
  emoji?: string;
  selected?: boolean;
  onToggle?: () => void;
  disabled?: boolean;
  as?: "select" | "tag";
}) {
  const { c, f, radius, space, themeName } = useTheme();

  if (as === "tag") {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space.s,
          minHeight: 40,
          paddingLeft: space.m,
          paddingRight: space.l,
          paddingVertical: 8,
          borderRadius: radius.pill,
          backgroundColor: c.surfaceContainerHigh,
          borderWidth: themeName === "contrast" ? 3 : 0,
          borderColor: c.border,
        }}
      >
        {emoji ? <Text style={{ fontSize: f.body }}>{emoji}</Text> : null}
        <Text
          style={{ color: c.onSurface, fontSize: f.label, fontWeight: "600" }}
          numberOfLines={2}
        >
          {label}
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      onPress={onToggle}
      disabled={disabled}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: space.s,
        minHeight: 48,
        paddingLeft: space.l,
        paddingRight: space.m,
        paddingVertical: space.s,
        borderRadius: radius.pill,
        borderWidth: selected ? 2 : themeName === "contrast" ? 3 : 1,
        borderColor: selected ? c.ctaFill : themeName === "contrast" ? c.border : c.outlineVariant,
        backgroundColor: selected
          ? c.primarySoft
          : pressed
            ? c.surfaceContainerHigh
            : c.surfaceContainer,
        opacity: disabled ? 0.4 : 1,
      })}
    >
      {emoji ? <Text style={{ fontSize: f.body }}>{emoji}</Text> : null}
      {/* Same onSoft rule as RadioRow: labels on primarySoft fills. */}
      <Text
        style={{
          color: selected ? c.onSoft : c.onSurface,
          fontSize: f.label,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          width: 18,
          // onSoft, not primary: on primarySoft fills the primary mark can
          // drop below AA (and vanish in the high-contrast theme, where both
          // are white). onSoft follows the fill everywhere.
          color: selected ? c.onSoft : "transparent",
          fontSize: f.label + 2,
          fontWeight: "800",
          textAlign: "right",
        }}
      >
        ✓
      </Text>
    </Pressable>
  );
}

/** Bold section question inside a wizard screen. */
export function SectionHeader({ children }: { children: React.ReactNode }) {
  const { c, f, space } = useTheme();
  return (
    <Text
      accessible
      accessibilityRole="header"
      style={{ color: c.onSurface, fontSize: f.body + 2, fontWeight: "700", marginTop: space.m }}
    >
      {children}
    </Text>
  );
}

/** Chip grid wrapper (wraps chips, 16 px gaps). */
export function ChipGrid({ children }: { children: React.ReactNode }) {
  const { space } = useTheme();
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.m }}>{children}</View>;
}
