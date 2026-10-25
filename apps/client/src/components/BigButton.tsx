// The only button component in the app. Full width, ≥ 56 px tall (72 for the
// hero action), icon always next to a text label, explicit accessibility
// role/label/state. One primary button per screen — variants make hierarchy
// obvious: primary > soft > success > danger > quiet. The primary wears THE
// CTA pair (ctaFill/ctaLabel — gradient-safe) and can render as a two-stop
// ember gradient with an optional eyebrow line above the label. Filled
// variants float on a soft shadow and give a tiny spring press (dropped
// entirely when the OS asks for reduced motion — plan §4.4).
import { Animated, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRef } from "react";
import { CTA_GRADIENT, ELEVATION, TINT, useReduceMotion, useTheme } from "../theme";

type Variant = "primary" | "soft" | "success" | "danger" | "quiet";
type Size = "min" | "normal" | "big";

export function BigButton({
  label,
  icon,
  eyebrow,
  onPress,
  variant = "primary",
  size = "normal",
  gradient = false,
  disabled = false,
  busy = false,
}: {
  label: string;
  icon?: string;
  /** Small line above the label (two-line CTA, e.g. "Next step"). */
  eyebrow?: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  /** Ember gradient fill (primary only; skipped in the high-contrast theme). */
  gradient?: boolean;
  disabled?: boolean;
  busy?: boolean;
}) {
  const { c, f, touch, radius, themeName } = useTheme();
  const reduceMotion = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;

  const height = size === "min" ? touch.min : size === "big" ? touch.hero : touch.button;
  const fontSize = size === "big" ? f.title : f.button;
  const filled = variant === "primary" || variant === "success" || variant === "danger";
  // Every variant reads its own fill/label pair — success and danger carry
  // their own on-colors (onSuccess/onError), the primary wears the CTA pair.
  const bg =
    variant === "primary" ? c.ctaFill
    : variant === "soft" ? c.primarySoft
    : variant === "success" ? c.success
    : variant === "danger" ? c.error
    : "transparent";
  const fg =
    variant === "primary" ? c.ctaLabel
    : variant === "soft" ? c.onSoft
    : variant === "success" ? c.onSuccess
    : variant === "danger" ? c.onError
    : c.primary;
  // Gradient is a primary-only decoration; the high-contrast theme keeps the
  // flat white fill + 3 px border branch.
  const stops =
    gradient && variant === "primary" && themeName !== "contrast"
      ? themeName === "dark"
        ? CTA_GRADIENT.dark
        : CTA_GRADIENT.light
      : null;

  // The one micro-interaction: a 3 % press-down spring. Under "reduce
  // motion" the button stays perfectly still — pressed opacity only.
  const animate = (to: number) => {
    if (reduceMotion) return;
    Animated.spring(scale, {
      toValue: to,
      speed: 50,
      bounciness: to === 1 ? 6 : 0,
      useNativeDriver: false,
    }).start();
  };

  const pressable = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={eyebrow ? `${eyebrow}. ${label}` : label}
      accessibilityState={{ disabled: disabled || busy }}
      onPress={onPress}
      onPressIn={() => animate(0.97)}
      onPressOut={() => animate(1)}
      disabled={disabled || busy}
      style={({ pressed }) => ({
        minHeight: height,
        borderRadius: radius.pill,
        backgroundColor: stops ? "transparent" : bg,
        // Plan §4.3: high-contrast theme gives every interactive element a
        // 3 px border. Elsewhere quiet buttons get a hairline + primary
        // text (modern outlined button).
        borderWidth: variant === "quiet" ? (themeName === "contrast" ? 3 : 1) : 0,
        borderColor: themeName === "contrast" ? c.border : c.primary,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 10,
        paddingHorizontal: 20,
        opacity: disabled || busy ? 0.5 : pressed ? 0.8 : 1,
      })}
    >
      {icon ? <Text style={{ fontSize: fontSize }}>{icon}</Text> : null}
      <View
        style={{
          flex: 1,
          alignItems: eyebrow ? "flex-start" : "center",
          gap: 1,
        }}
      >
        {eyebrow ? (
          <Text style={{ color: fg, fontSize: f.label, fontWeight: "700" }}>{eyebrow}</Text>
        ) : null}
        <Text
          style={{
            color: fg,
            fontSize,
            fontWeight: "700",
            textAlign: "center",
          }}
        >
          {busy ? "…" : label}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <Animated.View
      style={{
        transform: [{ scale }],
        borderRadius: radius.pill,
        // Filled buttons float on a glow tinted with their own fill (modern
        // "colored elevation"); outlined ("quiet") ones stay flat. The
        // high-contrast theme skips all shadow decoration.
        ...(filled && themeName !== "contrast"
          ? { ...ELEVATION.md, shadowColor: stops ? c.ctaFill : bg, shadowOpacity: 0.35, shadowRadius: 12 }
          : {}),
      }}
    >
      {stops ? (
        <LinearGradient
          colors={stops}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ borderRadius: radius.pill, overflow: "hidden" }}
        >
          {pressable}
        </LinearGradient>
      ) : (
        pressable
      )}
    </Animated.View>
  );
}

/** Small labeled icon-only action (read-aloud) — a cyan-tinted pill, ≥ 48 px. */
export function IconAction({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  const { c, f, touch, radius, themeName } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: touch.min,
        minWidth: touch.min,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        backgroundColor: TINT[themeName].cyan,
        borderWidth: themeName === "contrast" ? 3 : 0,
        borderColor: c.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ fontSize: f.title }}>{icon}</Text>
      {/* Dark cyan tints carry the cyan accent (gate-asserted); light tints
          carry onSurface. */}
      <Text
        style={{
          color: themeName === "dark" ? c.secondary : c.onSurface,
          fontSize: f.label,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
