// Search distance — how far away people and requests can be. Presets only
// (no sliders): big taps, no fine motor skills needed.
import { Alert, View } from "react-native";
import { useState } from "react";
import type { SelfProfile } from "@parea/shared";
import { Screen } from "../../src/components/Screen";
import { Body } from "../../src/components/ui";
import { RadioRow } from "../../src/components/fields";
import { api } from "../../src/lib/api";
import { useT } from "../../src/i18n";
import { useStore } from "../../src/store";

const RADII = [2, 5, 10, 15, 30, 50];

export default function RadiusSetting() {
  const t = useT();
  const profile = useStore((s) => s.profile);
  const setProfile = useStore((s) => s.setProfile);
  const [busy, setBusy] = useState(false);

  const choose = async (km: number) => {
    if (busy || profile?.radius_km === km) return;
    setBusy(true);
    try {
      const updated = await api<SelfProfile>("/me", {
        method: "PATCH",
        body: { radius_km: km },
      });
      setProfile(updated);
      Alert.alert(t("radiusSaved"));
    } catch {
      Alert.alert(t("genericError"), t("networkError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={t("radiusSetting")}>
      <Body>{t("radiusQ")}</Body>
      <View style={{ gap: 16 }}>
        {RADII.map((km) => (
          <RadioRow
            key={km}
            selected={profile?.radius_km === km}
            label={`${km} km`}
            onSelect={() => void choose(km)}
          />
        ))}
      </View>
    </Screen>
  );
}
