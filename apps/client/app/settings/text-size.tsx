// Text size — the three levels, applied instantly (the screen itself
// re-renders at the chosen size, which IS the preview).
import { View } from "react-native";
import { Screen } from "../../src/components/Screen";
import { Body } from "../../src/components/ui";
import { RadioRow } from "../../src/components/fields";
import { useT } from "../../src/i18n";
import { useStore } from "../../src/store";
import type { TextSize } from "@parea/shared";

const SIZES: Array<{ value: TextSize; key: "sizeNormal" | "sizeLarge" | "sizeXLarge" }> = [
  { value: "normal", key: "sizeNormal" },
  { value: "large", key: "sizeLarge" },
  { value: "xlarge", key: "sizeXLarge" },
];

export default function TextSizeSetting() {
  const t = useT();
  const textSize = useStore((s) => s.textSize);
  const setPrefs = useStore((s) => s.setPrefs);

  return (
    <Screen title={t("textSizeSetting")} speakText={t("chooseTextSize")}>
      <Body>{t("chooseTextSize")}</Body>
      <View style={{ gap: 16 }}>
        {SIZES.map((size) => (
          <RadioRow
            key={size.value}
            selected={textSize === size.value}
            label={`Aa  ${t(size.key)}`}
            onSelect={() => void setPrefs({ textSize: size.value })}
          />
        ))}
      </View>
    </Screen>
  );
}
