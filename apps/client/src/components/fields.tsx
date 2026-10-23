// Form building blocks: labeled text fields, big radio rows and selectable
// chips. All ≥ 56 px, explicit roles/states, labels always visible (never
// placeholder-only), errors read out by screen readers via accessibilityLabel.
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useState } from "react";
import { ELEVATION, useTheme } from "../theme";

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
        <Text style={{ color: c.text, fontSize: f.body, fontWeight: "600" }}>{label}</Text>
      ) : null}
      <TextInput
        accessibilityLabel={accessibilityLabel ?? `${label}${error ? `. ${error}` : ""}`}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textSecondary}
        keyboardType={keyboardType}
        multiline={multiline}
        keyboardAppearance={c.bg === "#000000" ? "dark" : "light"}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          minHeight: 56,
          borderRadius: radius.md,
          // Focused fields get the strong 2 px primary ring (a clear focus
          // indicator matters more than décor); at rest a hairline on a
          // surface fill. High contrast keeps the 3 px outline always.
          borderWidth: themeName === "contrast" ? 3 : focused || error ? 2 : 1,
          borderColor: error ? c.danger : focused ? c.primary : themeName === "contrast" ? c.border : c.hairline,
          paddingHorizontal: 14,
          paddingVertical: multiline ? 12 : 0,
          fontSize: f.body,
          color: c.text,
          backgroundColor: c.surface,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
      {hint && !error ? (
        <Text style={{ color: c.textSecondary, fontSize: f.label }}>{hint}</Text>
      ) : null}
      {error ? <Text style={{ color: c.danger, fontSize: f.label }}>{error}</Text> : null}
    </View>
  );
}

/**
 * One radio choice as a selection card (the wizard's main building block):
 * circular emoji tile, title + optional subtitle, and a circular check
 * indicator that fills (with a soft glow) when selected. Whole card tappable,
 * ≥ 64 px.
 */
export function RadioRow({
  selected,
  label,
  subtitle,
  emoji,
  onSelect,
}: {
  selected: boolean;
  label: string;
  subtitle?: string;
  emoji?: string;
  onSelect: () => void;
}) {
  const { c, f, space, radius, themeName } = useTheme();
  // The glow is decoration — the high-contrast theme skips it, and the fill
  // + check carry the selection state instead.
  const glow = selected && themeName !== "contrast" ? { ...ELEVATION.sm, shadowColor: c.primary, shadowOpacity: 0.3, shadowRadius: 8 } : {};
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
        minHeight: 64,
        padding: space.m,
        borderRadius: radius.md,
        borderWidth: themeName === "contrast" ? 3 : 1,
        borderColor: selected ? c.primary : themeName === "contrast" ? c.border : c.hairline,
        backgroundColor: selected ? c.primarySoft : pressed ? c.surfaceHigh : c.surface,
        ...glow,
      })}
    >
      {emoji ? (
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: selected ? c.bg : c.surfaceHigh,
          }}
        >
          <Text style={{ fontSize: 22 }}>{emoji}</Text>
        </View>
      ) : null}
      {/* Selected fills use primarySoft → labels follow onSoft (flips to
          black in the high-contrast theme, where primarySoft is white). */}
      <View style={{ flex: 1, gap: 1 }}>
        <Text
          style={{
            color: selected ? c.onSoft : c.text,
            fontSize: f.body,
            fontWeight: selected ? "700" : "600",
          }}
        >
          {label}
        </Text>
        {subtitle ? (
          <Text style={{ color: selected ? c.onSoft : c.textSecondary, fontSize: f.label }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          borderWidth: 2,
          borderColor: selected ? c.primary : c.border,
          backgroundColor: selected ? c.primary : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selected ? (
          <Text style={{ color: c.onPrimary, fontSize: 16, fontWeight: "800" }}>✓</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * Selectable chip (single- or multi-select), ≥ 48 px, emoji + label + a
 * trailing ✓ that reserves its width so toggling never reflows the grid.
 */
export function Chip({
  label,
  emoji,
  selected,
  onToggle,
  disabled = false,
}: {
  label: string;
  emoji?: string;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  const { c, f, radius, space, themeName } = useTheme();
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
        borderRadius: radius.md,
        borderWidth: themeName === "contrast" ? 3 : 1,
        borderColor: selected ? c.primary : themeName === "contrast" ? c.border : c.hairline,
        backgroundColor: selected ? c.primarySoft : pressed ? c.surfaceHigh : c.surface,
        opacity: disabled ? 0.4 : 1,
      })}
    >
      {emoji ? <Text style={{ fontSize: f.body }}>{emoji}</Text> : null}
      {/* Same onSoft rule as RadioRow: labels on primarySoft fills. */}
      <Text
        style={{
          color: selected ? c.onSoft : c.text,
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
      style={{ color: c.text, fontSize: f.body + 2, fontWeight: "700", marginTop: space.m }}
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
