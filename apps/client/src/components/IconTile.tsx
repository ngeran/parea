// The iconography rule: no icon font — emoji glyphs sit in solid tinted
// tiles (TINT in theme.ts, precomputed composites the contrast gate
// asserts). The tile is purely decorative: the glyph is hidden from
// assistive tech, and the control around the tile carries the label.
import { Text, View } from "react-native";
import { TINT, useTheme, type TintHue } from "../theme";

export function IconTile({
  emoji,
  size = 48,
  shape = "square",
  hue = "ember",
}: {
  emoji: string;
  size?: 44 | 48 | 56;
  shape?: "square" | "circle";
  hue?: TintHue;
}) {
  const { c, themeName } = useTheme();
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: shape === "circle" ? size / 2 : Math.round(size * 0.3),
        backgroundColor: TINT[themeName][hue],
        // High contrast skips tints (they are all black there): a 3 px
        // outline keeps the tile visible instead (plan §4.3).
        borderWidth: themeName === "contrast" ? 3 : 0,
        borderColor: c.border,
      }}
    >
      <Text style={{ fontSize: Math.round(size * 0.54), lineHeight: Math.round(size * 0.64) }}>
        {emoji}
      </Text>
    </View>
  );
}
