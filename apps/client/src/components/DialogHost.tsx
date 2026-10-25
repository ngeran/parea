// The dialog host — mounted once in the root layout, fed by notify.ts.
// Replaces system popups (window.confirm on web, Alert.alert on native) so
// every question wears the app's own colors, type, and buttons. One dialog
// at a time: a dimmed backdrop, a surface card, and two big buttons.
import { Animated, Pressable, View } from "react-native";
import { useEffect, useRef } from "react";
import { useDialogStore } from "../lib/notify";
import { BigButton } from "./BigButton";
import { Body, Title } from "./ui";
import { ELEVATION, useReduceMotion, useTheme } from "../theme";

export function DialogHost() {
  const dialog = useDialogStore((s) => s.dialog);
  const close = useDialogStore((s) => s.close);
  const { c, space, radius, themeName } = useTheme();
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (!dialog || reduceMotion) return;
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: false }).start();
  }, [dialog, opacity, reduceMotion]);

  if (!dialog) return null;

  const dismiss = () => close();
  const confirm = () => {
    close();
    dialog.onOk?.();
  };

  return (
    <Animated.View
      accessibilityRole="dialog"
      accessibilityLabel={dialog.title}
      accessibilityViewIsModal
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity,
        backgroundColor: "rgba(0,0,0,0.45)",
        alignItems: "center",
        justifyContent: "center",
        padding: space.xl,
      }}
    >
      {/* Backdrop tap = Cancel (never for ack-only, which needs the OK tap). */}
      <Pressable
        accessibilityLabel={dialog.cancelLabel}
        onPress={dialog.ackOnly ? undefined : dismiss}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <View
        style={{
          width: "100%",
          maxWidth: 420,
          gap: space.m,
          backgroundColor: c.surfaceContainer,
          borderRadius: radius.lg,
          padding: space.xl,
          borderWidth: themeName === "contrast" ? 3 : 1,
          borderColor: themeName === "contrast" ? c.outline : c.outlineVariant,
          ...(themeName === "contrast" ? {} : ELEVATION.md),
        }}
      >
        <Title>{dialog.title}</Title>
        {dialog.body ? <Body>{dialog.body}</Body> : null}
        <View style={{ gap: space.s, marginTop: space.s }}>
          <BigButton
            label={dialog.okLabel ?? "OK"}
            variant={dialog.destructive ? "danger" : "primary"}
            onPress={confirm}
          />
          {!dialog.ackOnly ? (
            <BigButton label={dialog.cancelLabel ?? "Cancel"} variant="quiet" onPress={dismiss} />
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}
