// Wizard progress: the step label ("Step 2 of 3") plus a row of segments —
// filled through the current step, resting on surfaceHigh after it. Pure
// indicator: the Pressables it tracks stay the source of truth for screen
// readers (this bar is aria-hidden by nature — no accessibility props).
import { Text, View } from "react-native";
import { useTheme } from "../theme";

export function StepProgress({
  step,
  total,
  label,
}: {
  step: number;
  total: number;
  label: string;
}) {
  const { c, f, space, themeName } = useTheme();
  return (
    <View style={{ gap: space.s }}>
      <Text style={{ color: c.primary, fontSize: f.label, fontWeight: "700" }}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: "row",
          gap: space.s,
          height: 6,
          borderRadius: 3,
          // High contrast: surfaceHigh == bg there, so the resting segments
          // get a 2 px outline instead of a tone step.
          ...(themeName === "contrast" ? { borderWidth: 2, borderColor: c.border } : {}),
        }}
      >
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              borderRadius: 3,
              backgroundColor: i < step ? c.primary : themeName === "contrast" ? "transparent" : c.surfaceHigh,
            }}
          />
        ))}
      </View>
    </View>
  );
}
