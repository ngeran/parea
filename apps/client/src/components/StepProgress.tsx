// Wizard progress: the step label ("Step 2 of 3"), optionally the named
// step pills (Τι · Πότε · Πού), plus a row of segments — filled through the
// current step, resting on a container tone after it. Pure indicator: the
// Pressables it tracks stay the source of truth for screen readers (this
// bar is aria-hidden by nature — no accessibility props).
import { Text, View } from "react-native";
import { useTheme } from "../theme";

export function StepProgress({
  step,
  total,
  label,
  steps,
}: {
  step: number;
  total: number;
  label: string;
  /** Optional names shown as numbered pills ("1 Τι · 2 Πότε · 3 Πού"). */
  steps?: string[];
}) {
  const { c, f, space, themeName } = useTheme();
  return (
    <View style={{ gap: space.s }}>
      <Text style={{ color: c.primary, fontSize: f.label, fontWeight: "700" }}>
        {label}
      </Text>
      {steps ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.s }}>
          {steps.map((name, i) => {
            const done = i < step - 1;
            const active = i === step - 1;
            return (
              <View
                key={name}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.s,
                  minHeight: 36,
                  paddingLeft: 6,
                  paddingRight: 14,
                  borderRadius: 999,
                  borderWidth: active ? 2 : themeName === "contrast" ? 3 : done ? 0 : 1,
                  borderColor: active
                    ? c.ctaFill
                    : themeName === "contrast"
                      ? c.border
                      : c.outlineVariant,
                  backgroundColor: done
                    ? c.ctaFill
                    : active
                      ? c.primarySoft
                      : "transparent",
                }}
              >
                {/* Number bubble — done steps invert (CTA fill, dark number). */}
                <View
                  accessible={false}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: done
                      ? "transparent"
                      : active
                        ? c.primarySoft
                        : "transparent",
                  }}
                >
                  <Text
                    style={{
                      color: done
                        ? c.ctaLabel
                        : active
                          ? c.onSoft
                          : c.onSurfaceVariant,
                      fontSize: f.label - 1,
                      fontWeight: "800",
                    }}
                  >
                    {i + 1}
                  </Text>
                </View>
                <Text
                  style={{
                    // Done pills invert: CTA fill → CTA label (gate-asserted).
                    color: done ? c.ctaLabel : active ? c.onSurface : c.onSurfaceVariant,
                    fontSize: f.label,
                    fontWeight: active ? "800" : done ? "700" : "600",
                  }}
                  numberOfLines={1}
                >
                  {name}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
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
              backgroundColor: i < step
                ? c.ctaFill
                : themeName === "contrast"
                  ? "transparent"
                  : c.surfaceContainerHigh,
            }}
          />
        ))}
      </View>
    </View>
  );
}
