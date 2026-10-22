// The only button component in the app. Full width, ≥ 64 px tall (96 for the
// hero action), icon always next to a text label, explicit accessibility
// role/label/state. One primary button per screen — variants make hierarchy
// obvious: primary > soft > danger > quiet. Filled variants float on a soft
// shadow and give a tiny spring press (dropped entirely when the OS asks
// for reduced motion — plan §4.4).
import { Animated, Pressable, Text } from "react-native";
import { useRef } from "react";
import { ELEVATION, useReduceMotion, useTheme } from "../theme";

type Variant = "primary" | "soft" | "success" | "danger" | "quiet";
type Size = "min" | "normal" | "big";

export function BigButton({
  label,
  icon,
  onPress,
  variant = "primary",
  size = "normal",
  disabled = false,
  busy = false,
}: {
  label: string;
  icon?: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  busy?: boolean;
}) {
  const { c, f, touch, radius, themeName } = useTheme();
  const reduceMotion = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;

  const height = size === "min" ? touch.min : size === "big" ? touch.hero : touch.button;
  const fontSize = size === "big" ? f.title : f.button;
  const filled = variant === "primary" || variant === "success" || variant === "danger";
  const bg =
    variant === "primary" ? c.primary
    : variant === "soft" ? c.primarySoft
    : variant === "success" ? c.success
    : variant === "danger" ? c.danger
    : "transparent";
  // High contrast flips soft/success fills to white, so their labels come
  // from tokens that follow the fill (onSoft/onPrimary), never hardcoded.
  const fg =
    variant === "primary" || variant === "danger" || variant === "success" ? c.onPrimary
    : variant === "soft" ? c.onSoft
    : c.primary;

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

  return (
    <Animated.View
      style={{
        transform: [{ scale }],
        borderRadius: radius.pill,
        // Filled buttons float; outlined ("quiet") ones stay flat.
        ...(filled && themeName !== "contrast" ? ELEVATION.sm : {}),
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: disabled || busy }}
        onPress={onPress}
        onPressIn={() => animate(0.97)}
        onPressOut={() => animate(1)}
        disabled={disabled || busy}
        style={({ pressed }) => ({
          minHeight: height,
          borderRadius: radius.pill,
          backgroundColor: bg,
          // Plan §4.3: high-contrast theme gives every interactive element a
          // 3 px border. Elsewhere quiet buttons get a hairline + primary
          // text (modern outlined button).
          borderWidth: variant === "quiet" ? (themeName === "contrast" ? 3 : 1) : 0,
          borderColor: themeName === "contrast" ? c.border : c.primary,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 12,
          paddingHorizontal: 24,
          opacity: disabled || busy ? 0.5 : pressed ? 0.8 : 1,
        })}
      >
        {icon ? <Text style={{ fontSize: fontSize }}>{icon}</Text> : null}
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
      </Pressable>
    </Animated.View>
  );
}

/** Small labeled icon-only action (read-aloud) — still ≥ 56 px. */
export function IconAction({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  const { c, f, touch } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: touch.min,
        minWidth: touch.min,
        paddingHorizontal: 8,
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ fontSize: f.title }}>{icon}</Text>
      <Text style={{ color: c.textSecondary, fontSize: f.label }}>{label}</Text>
    </Pressable>
  );
}
