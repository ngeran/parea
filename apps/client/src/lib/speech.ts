// Read-aloud (text-to-speech) — one of the two voice features (voice input
// arrives in the Phase 6 accessibility pass, with a native module).
import * as Speech from "expo-speech";
import type { Lang } from "@parea/shared";
import { localeOf } from "./api";

/** Speak `text` in the user's language, cancelling anything already playing. */
export function speak(text: string, lang: Lang): void {
  Speech.stop();
  Speech.speak(text, { language: localeOf(lang), rate: 0.95 });
}

export function stopSpeaking(): void {
  Speech.stop();
}
