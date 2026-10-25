// Bottom tab bar: 4 labeled tabs, always visible, icons with text (never
// icons alone), big labels. The bar floats — a fully-rounded pill inset
// from the screen edges on a soft shadow — so it reads as part of the app,
// not a system chrome bar. Fade-free instant switching. The focused tab
// becomes a solid primary pill with the emoji + label inside it (the fill
// carries selection; in the contrast theme that's white on black).
import { Tabs } from "expo-router";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT } from "../../src/i18n";
import { ELEVATION, useTheme } from "../../src/theme";

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  const { c, f } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{
        width: "100%",
        minHeight: 56,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        borderRadius: 999,
        paddingHorizontal: 8,
        backgroundColor: focused ? c.primary : "transparent",
      }}
    >
      <Text accessible={false} style={{ fontSize: 20 }}>{emoji}</Text>
      <Text
        accessible={false}
        numberOfLines={1}
        style={{
          color: focused ? c.onPrimary : c.onSurfaceVariant,
          fontSize: f.label,
          fontWeight: focused ? "800" : "600",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const t = useT();
  const { c, themeName } = useTheme();
  // The bar floats above the home-indicator/home-bar — lift it by the real
  // inset (zeros on web) instead of a guessed constant.
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.onSurfaceVariant,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: c.surfaceContainer,
          marginHorizontal: 16,
          marginBottom: 10 + insets.bottom,
          // Wide screens: the pill bar centers over the reading column instead
          // of stretching across a tablet (self-sizing keeps phones as-is).
          alignSelf: "center",
          maxWidth: 720,
          borderRadius: 999,
          borderTopWidth: 0,
          // High contrast: the white bar on black bg is its own outline;
          // no shadow decoration there (plan §4.3 keeps shadows out).
          ...(themeName === "contrast"
            ? { borderWidth: 3, borderColor: c.outline }
            : { borderWidth: 1, borderColor: c.outlineVariant, ...ELEVATION.md }),
          // Room for the 56 px tab pill (emoji + label live inside it now,
          // so the built-in label is off) with the user's text size.
          height: 72,
          paddingBottom: 8,
          paddingTop: 6,
          overflow: "hidden",
        },
        tabBarShowLabel: false,
        // The floating bar overlays the screen, so every tab's content gets
        // bottom room to stay clear of it (bar 72 + margin 10 + gap) plus the
        // real home-bar inset.
        sceneStyle: { backgroundColor: c.background, marginBottom: 86 + insets.bottom },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: t("home"), tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label={t("home")} focused={focused} /> }}
      />
      {/* No unread dot on chats: the API has no read-state, so any dot would
          be a fake signal — honest data only. */}
      <Tabs.Screen
        name="chats"
        options={{ title: t("chatsTab"), tabBarIcon: ({ focused }) => <TabIcon emoji="💬" label={t("chatsTab")} focused={focused} /> }}
      />
      <Tabs.Screen
        name="plans"
        options={{ title: t("plansTab"), tabBarIcon: ({ focused }) => <TabIcon emoji="📅" label={t("plansTab")} focused={focused} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: t("settingsTitle"), tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" label={t("settingsTitle")} focused={focused} /> }}
      />
    </Tabs>
  );
}
