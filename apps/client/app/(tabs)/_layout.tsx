// Bottom tab bar: 4 labeled tabs, always visible, icons with text (never
// icons alone), big labels. The bar floats — inset from the screen edges on
// a soft shadow — so it reads as part of the app, not a system chrome bar.
// Fade-free instant switching.
import { Tabs } from "expo-router";
import { Text, View } from "react-native";
import { useT } from "../../src/i18n";
import { ELEVATION, useTheme } from "../../src/theme";

// Emoji + label, plus the active dot the mockups show above the icon. The
// dot reserves its slot (transparent when inactive) so tabs never reflow.
function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: "center", minWidth: 48 }}>
      <View
        style={{
          width: 18,
          height: 3,
          borderRadius: 2,
          marginBottom: 2,
          backgroundColor: focused ? c.primary : "transparent",
        }}
      />
      <Text accessible accessibilityLabel={label} style={{ fontSize: 22 }}>{emoji}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const t = useT();
  const { c, f, themeName } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textSecondary,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: c.surface,
          marginHorizontal: 16,
          marginBottom: 10,
          borderRadius: 24,
          borderTopWidth: 0,
          // High contrast: the white bar on black bg is its own outline;
          // no shadow decoration there (plan §4.3 keeps shadows out).
          ...(themeName === "contrast"
            ? { borderWidth: 3, borderColor: c.border }
            : { borderWidth: 1, borderColor: c.hairline, ...ELEVATION.md }),
          // Room for the 22 px emoji plus a 15 px+ label (the label follows
          // the user's text size, so the bar grows with it).
          height: 72,
          paddingBottom: 8,
          paddingTop: 6,
          overflow: "hidden",
        },
        tabBarLabelStyle: {
          fontSize: f.label,
          fontWeight: "600",
        },
        // The floating bar overlays the screen, so every tab's content gets
        // bottom room to stay clear of it (bar 72 + margin 10 + gap).
        sceneStyle: { backgroundColor: c.bg, marginBottom: 86 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: t("home"), tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label={t("home")} focused={focused} /> }}
      />
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
