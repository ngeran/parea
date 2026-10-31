// Bottom tab bar: 4 labeled tabs, always visible, icon over text (never
// icons alone), big labels. The bar floats — a fully-rounded pill inset
// from the screen edges on a soft shadow — so it reads as part of the app,
// not a system chrome bar. Fade-free instant switching. The focused tab
// sits in a primarySoft pill (the fill carries selection; in the contrast
// theme that's a white pill with a black label). Cells stack emoji over
// label so long localized words never truncate the way a side-by-side row
// does in a quarter of a narrow phone.
//
// All heights here are explicit, not content/min-height driven: measured on
// device (pixel scan of a real screenshot), the navigation bar's own layout
// top-aligned its children and ignored both minHeight and paddingVertical —
// emoji ink sat on the bar's very first pixel row with a ~20 pt dead void
// below the labels. A fixed bar height + full-height cells + a fixed-height
// pill centered inside make the vertical centering deterministic no matter
// how the bar positions its children.
import { Tabs } from "expo-router";
import { Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT } from "../../src/i18n";
import { ELEVATION, useTheme } from "../../src/theme";

// Keep sceneStyle's clearance below in sync with these.
const TAB_BAR_HEIGHT = 72;
const ICON_SLOT = 28;
const PILL_HEIGHT = 58;

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  const { c, f, themeName } = useTheme();
  const contrast = themeName === "contrast";
  // Numeric width, not "100%": the tab bar's icon wrapper is content-sized,
  // so a percentage here resolved against nothing — the cell collapsed to
  // content width and iOS measured the label against an indefinite width,
  // which Fabric "solved" by truncating to the first letter ("H.", "C.").
  // Slot math: the bar insets 16 pt per side and splits into 4 cells,
  // capped at 120 so the selected pill stays a pill on wide screens (the
  // bar centers over the reading column on tablets).
  const { width: screenWidth } = useWindowDimensions();
  const cellWidth = Math.min((screenWidth - 32) / 4, 120);
  return (
    // Full bar height: whatever alignment the bar's internal layout applies
    // (it top-aligns), this cell spans it, so the pill centers from here.
    <View
      accessible
      accessibilityLabel={label}
      style={{
        width: cellWidth,
        // The bar's border sits inside its height (contrast adds 3 px per
        // edge, light/dark 1 px) — subtract it so the cell exactly fills the
        // bar's inner box even there.
        height: TAB_BAR_HEIGHT - (contrast ? 6 : 2),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        accessible={false}
        style={{
          alignSelf: "stretch",
          height: PILL_HEIGHT,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          backgroundColor: focused ? c.primarySoft : "transparent",
          // Contrast: the white pill needs its own 3 px edge on the black bar.
          // The border is always reserved (transparent when unfocused) so the
          // pill doesn't jump 3 px when selection moves.
          borderWidth: contrast ? 3 : 0,
          borderColor: focused ? c.outline : "transparent",
        }}
      >
        {/* Fixed slot: every emoji occupies the same box regardless of the
            glyph's own ink size (💬 renders ~10 pt tall, 🏠 ~19 pt), so the
            four icons share one optical center line and one icon→label gap. */}
        <View accessible={false} style={{ height: ICON_SLOT, alignItems: "center", justifyContent: "center" }}>
          <Text accessible={false} style={{ fontSize: 22, lineHeight: 26 }}>{emoji}</Text>
        </View>
        <Text
          accessible={false}
          numberOfLines={1}
          // Long localized words shrink instead of ellipsizing ("Ρυθμίσεις" at
          // xlarge text in a 360 px phone).
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          style={{
            color: focused ? (contrast ? c.onPrimary : c.onSoft) : c.onSurfaceVariant,
            fontSize: f.label,
            lineHeight: f.label * 1.3,
            fontWeight: focused ? "800" : "600",
          }}
        >
          {label}
        </Text>
      </View>
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
          // White card surface in light (the old container grey sat almost
          // on top of the cool-white page); a lifted container in dark;
          // black in contrast (both resolve through the tokens).
          backgroundColor: themeName === "dark" ? c.surfaceContainerHigh : c.surfaceContainerLowest,
          marginHorizontal: 16,
          marginBottom: 12 + insets.bottom,
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
          // Explicit height, not minHeight + paddingVertical: on device the
          // bar's internal layout top-aligned its children and dropped the
          // padding, so slack piled up under the labels. Fixed height makes
          // the full-height cells in TabIcon center the pill deterministically.
          // Labels still shrink to fit (minimumFontScale 0.75), so 72 pt holds
          // up to xlarge text.
          height: TAB_BAR_HEIGHT,
          overflow: "hidden",
        },
        tabBarShowLabel: false,
        // The floating bar overlays the screen, so every tab's content gets
        // bottom room to stay clear of it (bar 72 + margin 12 + gap) plus the
        // real home-bar inset.
        sceneStyle: { backgroundColor: c.background, marginBottom: 90 + insets.bottom },
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
