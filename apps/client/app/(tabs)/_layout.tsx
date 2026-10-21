// Bottom tab bar: 4 labeled tabs, always visible, icons with text (never
// icons alone), 80 px tall with big labels. Fade-free instant switching.
import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useT } from "../../src/i18n";
import { useTheme } from "../../src/theme";

function TabIcon({ emoji, label }: { emoji: string; label: string }) {
  return <Text accessible accessibilityLabel={label} style={{ fontSize: 30 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  const t = useT();
  const { c, f } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textSecondary,
        tabBarStyle: {
          backgroundColor: c.bg,
          borderTopColor: c.border,
          borderTopWidth: 2,
          // Tall enough for the 30 px emoji plus an 18 px+ label (the label
          // follows the user's text size, so the bar grows with it).
          height: 92,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: f.label,
          fontWeight: "600",
        },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: t("home"), tabBarIcon: () => <TabIcon emoji="🏠" label={t("home")} /> }}
      />
      <Tabs.Screen
        name="chats"
        options={{ title: t("chatsTab"), tabBarIcon: () => <TabIcon emoji="💬" label={t("chatsTab")} /> }}
      />
      <Tabs.Screen
        name="plans"
        options={{ title: t("plansTab"), tabBarIcon: () => <TabIcon emoji="📅" label={t("plansTab")} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: t("settingsTitle"), tabBarIcon: () => <TabIcon emoji="⚙️" label={t("settingsTitle")} /> }}
      />
    </Tabs>
  );
}
