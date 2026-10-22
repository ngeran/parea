// My details — edit photo, name, about and interests. One Save action.
import { View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { INTEREST_CHIPS, type SelfProfile } from "@parea/shared";
import { Screen } from "../../src/components/Screen";
import { BigButton } from "../../src/components/BigButton";
import { Avatar, Body } from "../../src/components/ui";
import { Chip, ChipGrid, TextField } from "../../src/components/fields";
import { api, uploadPhoto } from "../../src/lib/api";
import { toast } from "../../src/lib/notify";
import { useT } from "../../src/i18n";
import { useStore } from "../../src/store";

export default function MyDetails() {
  const t = useT();
  const profile = useStore((s) => s.profile);
  const setProfile = useStore((s) => s.setProfile);
  const language = useStore((s) => s.language);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [firstName, setFirstName] = useState(profile?.first_name ?? "");
  const [about, setAbout] = useState(profile?.about ?? "");
  const [interests, setInterests] = useState<string[]>(profile?.interests ?? []);
  const [busy, setBusy] = useState(false);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  const save = async () => {
    if (!firstName.trim()) {
      toast(t("nameRequired"), "error");
      return;
    }
    setBusy(true);
    try {
      const token = useStore.getState().token!;
      let updated = await api<SelfProfile>("/me", {
        method: "PATCH",
        token,
        body: { first_name: firstName.trim(), about: about.trim(), interests },
      });
      if (photoUri) {
        await uploadPhoto(token, photoUri);
        updated = await api<SelfProfile>("/me", { token });
      }
      setProfile(updated);
      toast(t("saved"));
    } catch {
      toast(t("networkError"), "error");
    } finally {
      setBusy(false);
    }
  };

  const toggle = (key: string) =>
    setInterests(interests.includes(key) ? interests.filter((k) => k !== key) : [...interests, key]);

  return (
    <Screen
      title={t("detailsTitle")}
      footer={<BigButton label={t("save")} size="big" busy={busy} onPress={() => void save()} />}
    >
      <View style={{ alignItems: "center", gap: 16 }}>
        <Avatar photoUrl={photoUri ?? profile?.photo_url ?? null} name={firstName || "?"} size={112} />
        <BigButton
          label={photoUri ? t("changePhoto") : t("addPhoto")}
          icon="📷"
          variant="soft"
          size="min"
          onPress={() => void pickPhoto()}
        />
      </View>

      <TextField label={t("yourName")} value={firstName} onChangeText={setFirstName} placeholder={t("namePlaceholder")} />
      <TextField label={t("aboutYou")} value={about} onChangeText={setAbout} placeholder={t("aboutPlaceholder")} multiline />

      <View style={{ gap: 16 }}>
        <Body>{t("interestsQ")}</Body>
        <ChipGrid>
          {INTEREST_CHIPS.map((chip) => (
            <Chip
              key={chip.key}
              emoji={chip.emoji}
              label={chip.label[language]}
              selected={interests.includes(chip.key)}
              onToggle={() => toggle(chip.key)}
            />
          ))}
        </ChipGrid>
      </View>
    </Screen>
  );
}
