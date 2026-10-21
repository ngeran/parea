// Human-readable date formatting for SMS and push texts. The launch market
// is Greece, so Athens time is used — device time zones never reach the server.

import type { Lang } from "@parea/shared";

export function formatWhen(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleString(lang === "el" ? "el-GR" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Athens",
  });
}
