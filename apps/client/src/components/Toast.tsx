// The toast host — mounted once in the root layout, fed by notify.ts.
// Non-blocking (pointerEvents "box-none" lets taps pass through anywhere a
// toast isn't), announced politely to screen readers, and fully themed via
// the design tokens. Icon + color encode the kind, but the text alone
// already says it (never color-only).
import { Animated, Pressable, Text, View } from "react-native";
import { useEffect, useRef } from "react";
import { useToastStore, type ToastMessage } from "../lib/notify";
import { ELEVATION, useReduceMotion, useTheme } from "../theme";

const ICONS = { success: "✓", error: "⚠️", info: "ℹ️" } as const;

function ToastRow({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  const { c, f, radius, space, themeName } = useTheme();
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: false }).start();
  }, [opacity, reduceMotion]);

  const accent = toast.kind === "error" ? c.danger : c.success;
  return (
    <Animated.View style={{ opacity }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={toast.text}
        onPress={onDismiss}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space.m,
          backgroundColor: c.surface,
          borderRadius: radius.pill,
          borderWidth: themeName === "contrast" ? 3 : 1,
          borderColor: themeName === "contrast" ? c.border : c.hairline,
          paddingHorizontal: space.xl,
          paddingVertical: space.m,
          ...(themeName === "contrast" ? {} : ELEVATION.md),
        }}
      >
        <Text style={{ color: accent, fontSize: f.label, fontWeight: "700" }}>
          {ICONS[toast.kind]}
        </Text>
        <Text style={{ color: c.text, fontSize: f.label, fontWeight: "600", flexShrink: 1 }}>
          {toast.text}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/** Renders the active toasts above everything (mount in the root layout). */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  const { space } = useTheme();

  if (toasts.length === 0) return null;
  return (
    <View
      pointerEvents="box-none"
      accessibilityLiveRegion="polite"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        paddingTop: space.l,
        paddingHorizontal: space.xl,
        gap: space.s,
        alignItems: "center",
      }}
    >
      {toasts.map((t) => (
        <ToastRow key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </View>
  );
}
