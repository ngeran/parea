// Screen 4 of onboarding: profile setup, 3 short steps, Back on each.
//   1. photo (optional) + first name
//   2. about + interest chips
//   3. languages + mobility → Finish
// Finishing also asks for location (the rounded one — see lib/location).
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  INTEREST_CHIPS,
  MOBILITY_LABELS,
  type Lang,
  type Mobility,
  type SelfProfile,
} from "@parea/shared";
import { Screen } from "../../src/components/Screen";
import { BigButton } from "../../src/components/BigButton";
import { StepProgress } from "../../src/components/StepProgress";
import { StatusBadge, TrustNote } from "../../src/components/bits";
import { Body, Card, Avatar } from "../../src/components/ui";
import { Chip, ChipGrid, RadioRow, SectionHeader, TextField } from "../../src/components/fields";
import { api, uploadPhoto } from "../../src/lib/api";
import { ensureCoords } from "../../src/lib/location";
import { toast } from "../../src/lib/notify";
import { useT, tr } from "../../src/i18n";
import { useTheme } from "../../src/theme";
import { useStore } from "../../src/store";

const MOBILITIES: Mobility[] = ["walk", "ride", "home"];

export default function ProfileSetup() {
  const t = useT();
  const { c, f, space, themeName } = useTheme();
  const language = useStore((s) => s.language);
  const setProfile = useStore((s) => s.setProfile);

  const [step, setStep] = useState(1);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [about, setAbout] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [languages, setLanguages] = useState<Lang[]>([language]);
  const [mobility, setMobility] = useState<Mobility>("walk");
  const [error, setError] = useState<string | null>(null);
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

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const finish = async () => {
    setError(null);
    if (!firstName.trim()) {
      setError(t("nameRequired"));
      setStep(1);
      return;
    }
    if (languages.length === 0) {
      setError(t("needLanguage"));
      return;
    }
    setBusy(true);
    try {
      const token = useStore.getState().token!;
      let profile = await api<SelfProfile>("/me", {
        method: "PATCH",
        token,
        body: {
          first_name: firstName.trim(),
          about: about.trim(),
          interests,
          languages,
          mobility,
        },
      });
      if (photoUri) {
        try {
          await uploadPhoto(token, photoUri);
          profile = await api<SelfProfile>("/me", { token });
        } catch {
          // A photo that fails to upload never blocks the account.
          toast(t("photoNote"), "error");
        }
      }
      setProfile(profile);
      // Location powers everything nearby; asked once, stored rounded.
      const coords = await ensureCoords();
      if (!coords) toast(t("locationNote"), "info");
      router.replace("/home");
    } catch {
      toast(t("networkError"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title={t("setupTitle")}
      speakText={`${t("stepN", { n: step })}. ${t("setupTitle")}`}
      back={step === 1}
      footer={
        <BigButton
          label={step === 3 ? t("finish") : t("next")}
          size="big"
          gradient
          busy={busy}
          onPress={() => {
            if (step === 1 && !firstName.trim()) {
              setError(t("nameRequired"));
              return;
            }
            setError(null);
            if (step < 3) setStep(step + 1);
            else void finish();
          }}
        />
      }
    >
      <StepProgress
        step={step}
        total={3}
        label={t("stepN", { n: step })}
        steps={[t("profileStepPhoto"), t("profileStepAbout"), t("profileStepDetails")]}
      />

      {step === 1 ? (
        <View style={{ gap: space.xl }}>
          <View style={{ alignItems: "center", gap: space.l }}>
            {/* The avatar itself opens the picker — the ring + camera bubble
                mark it as tappable; the labeled soft button stays for anyone
                who misses it. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={photoUri ? t("changePhoto") : t("addPhoto")}
              onPress={() => void pickPhoto()}
            >
              <View>
                <Avatar photoUrl={photoUri} name={firstName || "?"} size={112} />
                <View
                  accessible={false}
                  importantForAccessibility="no-hide-descendants"
                  style={{
                    position: "absolute",
                    right: -2,
                    bottom: -2,
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: c.ctaFill,
                    borderWidth: themeName === "contrast" ? 3 : 0,
                    borderColor: c.outline,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 18 }}>📷</Text>
                </View>
              </View>
            </Pressable>
            <BigButton
              label={photoUri ? t("changePhoto") : t("addPhoto")}
              icon="📷"
              variant="soft"
              onPress={() => void pickPhoto()}
            />
            <Body muted>{t("photoNote")}</Body>
          </View>
          <TextField
            label={t("yourName")}
            value={firstName}
            onChangeText={setFirstName}
            placeholder={t("namePlaceholder")}
            error={error}
          />
        </View>
      ) : null}

      {step === 2 ? (
        <View style={{ gap: space.xl }}>
          <TextField
            label={t("aboutYou")}
            value={about}
            onChangeText={setAbout}
            placeholder={t("aboutPlaceholder")}
            multiline
            hint={`${about.length}/500`}
          />
          <View style={{ gap: space.m }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.m }}>
              <SectionHeader>{t("interestsQ")}</SectionHeader>
              {/* The mockup's counter pill — fills in as chips are tapped. */}
              {interests.length > 0 ? (
                <StatusBadge
                  emoji="✨"
                  label={t("interestsSelected", { n: interests.length })}
                  hue="success"
                />
              ) : null}
            </View>
            <Body muted>{t("interestsHint")}</Body>
            <ChipGrid>
              {INTEREST_CHIPS.map((chip) => (
                <Chip
                  key={chip.key}
                  emoji={chip.emoji}
                  label={chip.label[language]}
                  selected={interests.includes(chip.key)}
                  onToggle={() => setInterests(toggle(interests, chip.key))}
                />
              ))}
            </ChipGrid>
          </View>
        </View>
      ) : null}

      {step === 3 ? (
        <View style={{ gap: space.xl }}>
          <View style={{ gap: space.m }}>
            <SectionHeader>{t("languagesQ")}</SectionHeader>
            <ChipGrid>
              {(["el", "en"] as Lang[]).map((code) => (
                <Chip
                  key={code}
                  label={tr(language, code === "el" ? "greek" : "english")}
                  selected={languages.includes(code)}
                  onToggle={() => setLanguages(toggle(languages, code) as Lang[])}
                />
              ))}
            </ChipGrid>
            {error ? <Body>{error}</Body> : null}
          </View>
          <View style={{ gap: space.m }}>
            <SectionHeader>{t("mobilityQ")}</SectionHeader>
            <View style={{ gap: space.m }}>
              {MOBILITIES.map((m) => (
                <RadioRow
                  key={m}
                  selected={mobility === m}
                  label={MOBILITY_LABELS[m][language]}
                  emoji={m === "walk" ? "🚶" : m === "ride" ? "🚗" : "🏠"}
                  hue={m === "walk" ? "cyan" : m === "ride" ? "amber" : "ember"}
                  onSelect={() => setMobility(m)}
                />
              ))}
            </View>
          </View>
        </View>
      ) : null}

      {/* The privacy line sits under every step — the reassurance belongs to
          the whole form, not one field. */}
      <Card>
        <TrustNote>{t("privacyNote")}</TrustNote>
      </Card>
    </Screen>
  );
}
