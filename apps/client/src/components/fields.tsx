// Form building blocks: labeled text fields, big radio rows and selectable
// chips. All ≥ 56 px, explicit roles/states, labels always visible (never
// placeholder-only), errors read out by screen readers via accessibilityLabel.
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useState } from "react";
import { useTheme } from "../theme";

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
          minHeight: 64,
          borderRadius: radius.md,
          // Focused fields get the strong 2 px primary ring (a clear focus
          // indicator matters more than décor); at rest a hairline on a
          // surface fill. High contrast keeps the 3 px outline always.
          borderWidth: themeName === "contrast" ? 3 : focused || error ? 2 : 1,
          borderColor: error ? c.danger : focused ? c.primary : themeName === "contrast" ? c.border : c.hairline,
          paddingHorizontal: 16,
          paddingVertical: multiline ? 14 : 0,
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

/** One radio choice — whole row tappable, ≥ 72 px. */
export function RadioRow({
  selected,
  label,
  emoji,
  onSelect,
}: {
  selected: boolean;
  label: string;
  emoji?: string;
  onSelect: () => void;
}) {
  const { c, f, space, radius, themeName } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onSelect}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: space.m,
        minHeight: 72,
        paddingHorizontal: space.xl,
        borderRadius: radius.md,
        borderWidth: themeName === "contrast" ? 3 : 2,
        borderColor: selected ? c.primary : c.border,
        backgroundColor: selected ? c.primarySoft : pressed ? c.surface : c.bg,
      })}
    >
      {emoji ? <Text style={{ fontSize: f.title }}>{emoji}</Text> : null}
      {/* Selected fills use primarySoft → label follows onSoft (flips to
          black in the high-contrast theme, where primarySoft is white). */}
      <Text
        style={{
          color: selected ? c.onSoft : c.text,
          fontSize: f.body,
          fontWeight: "600",
          flex: 1,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          borderWidth: 3,
          borderColor: selected ? c.primary : c.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selected ? <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c.primary }} /> : null}
      </View>
    </Pressable>
  );
}

/** Selectable chip (single- or multi-select), ≥ 56 px, emoji + label. */
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
        minHeight: 56,
        paddingHorizontal: space.l,
        borderRadius: radius.pill,
        borderWidth: themeName === "contrast" ? 3 : 2,
        borderColor: selected ? c.primary : c.border,
        backgroundColor: selected ? c.primarySoft : pressed ? c.surface : c.bg,
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
        {selected ? "✓ " : ""}
        {label}
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
