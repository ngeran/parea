// Chat — big bubbles, read-aloud on every received message, quick replies,
// the door to making a plan, and one-tap Report/Block in the header.
import {
  AccessibilityInfo,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MessageDTO } from "@parea/shared";
import { BigButton } from "../../src/components/BigButton";
import { Body, EmptyState, ErrorState } from "../../src/components/ui";
import { TextField } from "../../src/components/fields";
import { api, ApiError } from "../../src/lib/api";
import { toast } from "../../src/lib/notify";
import { speak, stopSpeaking } from "../../src/lib/speech";
import { useT } from "../../src/i18n";
import { useTheme } from "../../src/theme";
import { useStore } from "../../src/store";
import { useMatches, useMessages } from "../../src/lib/queries";

const QUICK_REPLIES = ["qrMorning", "qrOnMyWay", "qrSeeYou"] as const;

export default function Chat() {
  const t = useT();
  const { c, f, space, touch } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const myId = useStore((s) => s.profile?.id);
  const language = useStore((s) => s.language);
  const insets = useSafeAreaInsets();
  const matches = useMatches();
  const messages = useMessages(matchId ?? "");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  // Which message is being read aloud (the 🔊 button becomes ⏹ while active).
  const [readingId, setReadingId] = useState<string | null>(null);
  // Last message id announced to screen readers; null until the first load.
  const lastAnnounced = useRef<string | null>(null);

  const other = useMemo(
    () => matches.data?.matches.find((m) => m.id === matchId)?.other ?? null,
    [matches.data, matchId],
  );

  // The list is inverted (newest at the bottom visually), so newest first.
  const newestFirst = useMemo(
    () => [...(messages.data?.messages ?? [])].reverse(),
    [messages.data],
  );

  // Announce incoming messages to screen readers (Rule 5: live updates must
  // never be silent). The first load only primes the ref — no announcement.
  useEffect(() => {
    const list = messages.data?.messages ?? [];
    const latest = list[list.length - 1];
    if (!latest) return;
    if (lastAnnounced.current !== null && latest.id !== lastAnnounced.current && latest.sender_id !== myId) {
      AccessibilityInfo.announceForAccessibility(
        `${other?.first_name ? `${other.first_name}: ` : ""}${latest.body}`,
      );
    }
    lastAnnounced.current = latest.id;
  }, [messages.data, myId, other?.first_name]);

  const readAloud = (message: MessageDTO) => {
    if (readingId === message.id) {
      stopSpeaking();
      setReadingId(null);
    } else {
      speak(message.body, language);
      setReadingId(message.id);
    }
  };

  const send = async (body: string) => {
    const text = body.trim();
    if (!text) {
      toast(t("writeFirst"), "info");
      return;
    }
    setSending(true);
    try {
      const result = await api<{ message: MessageDTO }>(`/matches/${matchId}/messages`, {
        body: { body: text },
      });
      setDraft("");
      // Show our own message immediately; live events cover the other side.
      const current = queryClient.getQueryData<{ messages: MessageDTO[] }>(["messages", matchId]);
      if (current && !current.messages.some((m) => m.id === result.message.id)) {
        queryClient.setQueryData(["messages", matchId], {
          messages: [...current.messages, result.message],
        });
      }
    } catch (e) {
      toast(
        e instanceof ApiError && e.code === "message_blocked" ? t("messageBlocked") : t("networkError"),
        "error",
      );
    } finally {
      setSending(false);
    }
  };

  const bubble = (message: MessageDTO) => {
    const mine = message.sender_id === myId;
    return (
      <View
        accessible
        accessibilityLabel={`${mine ? "" : `${other?.first_name ?? ""}: `}${message.body}`}
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: space.s,
          justifyContent: mine ? "flex-end" : "flex-start",
          marginVertical: space.xs,
        }}
      >
        {!mine ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${readingId === message.id ? t("stop") : t("listen")}: ${message.body}`}
            accessibilityState={{ selected: readingId === message.id }}
            onPress={() => readAloud(message)}
            style={({ pressed }) => ({
              opacity: pressed ? 0.6 : 1,
              padding: space.s,
              minWidth: touch.min,
              minHeight: touch.min,
              alignItems: "center",
              justifyContent: "center",
            })}
          >
            <Text style={{ fontSize: f.title }}>{readingId === message.id ? "⏹" : "🔊"}</Text>
          </Pressable>
        ) : null}
        <View
          style={{
            maxWidth: "78%",
            backgroundColor: mine ? c.primarySoft : c.surface,
            borderRadius: 16,
            paddingHorizontal: space.l,
            paddingVertical: space.m,
          }}
        >
          <Text style={{ color: c.text, fontSize: f.body, lineHeight: f.body * 1.4 }}>
            {message.body}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header: back + the other person's name + the door to plans */}
      <View
        style={{
          paddingHorizontal: space.xl + insets.left + insets.right,
          paddingTop: Math.max(space.xl, insets.top + space.m),
          paddingBottom: space.m,
          borderBottomWidth: 1,
          borderBottomColor: c.surface,
          flexDirection: "row",
          alignItems: "center",
          gap: space.l,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("back")}
          onPress={() => router.canGoBack() && router.back()}
          style={({ pressed }) => ({
            opacity: pressed ? 0.6 : 1,
            minWidth: touch.min,
            minHeight: touch.min,
            alignItems: "center",
            justifyContent: "center",
          })}
        >
          <Text style={{ color: c.primary, fontSize: f.button, fontWeight: "700" }}>←</Text>
        </Pressable>
        <Text
          accessible
          accessibilityRole="header"
          style={{ color: c.text, fontSize: f.title, fontWeight: "700", flex: 1 }}
          numberOfLines={1}
        >
          {other?.first_name ?? ""}
        </Text>
        {other ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("makePlan")}
              onPress={() => router.push(`/plans/new?matchId=${matchId}`)}
              style={({ pressed }) => ({
                opacity: pressed ? 0.6 : 1,
                minHeight: touch.min,
                paddingHorizontal: space.s,
                justifyContent: "center",
                alignItems: "center",
              })}
            >
              <Text style={{ fontSize: f.title }}>📅</Text>
              <Text style={{ color: c.primary, fontSize: f.label, fontWeight: "600" }}>
                {t("makePlan")}
              </Text>
            </Pressable>
            {/* Safety: report + (optionally) block, one tap away mid-conversation. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("report")}
              onPress={() =>
                router.push(
                  `/report?targetId=${other.id}&name=${encodeURIComponent(other.first_name)}`,
                )
              }
              style={({ pressed }) => ({
                opacity: pressed ? 0.6 : 1,
                minHeight: touch.min,
                paddingHorizontal: space.s,
                justifyContent: "center",
                alignItems: "center",
              })}
            >
              <Text style={{ fontSize: f.title }}>🚩</Text>
              <Text style={{ color: c.danger, fontSize: f.label, fontWeight: "600" }}>
                {t("report")}
              </Text>
            </Pressable>
          </>
        ) : null}
      </View>

      {messages.isError || matches.isError ? (
        <View style={{ padding: space.xl }}>
          <ErrorState
            text={t("networkError")}
            retryLabel={t("tryAgain")}
            onRetry={() => {
              void messages.refetch();
              void matches.refetch();
            }}
          />
        </View>
      ) : !other && !messages.isLoading && !matches.isLoading ? (
        <View style={{ padding: space.xl }}>
          <EmptyState emoji="💬" text={t("noChats")} />
        </View>
      ) : (
        <FlatList
          data={newestFirst}
          renderItem={({ item }) => bubble(item)}
          keyExtractor={(m) => m.id}
          inverted
          contentContainerStyle={{
            padding: space.xl,
            paddingLeft: space.xl + insets.left,
            paddingRight: space.xl + insets.right,
          }}
          ListFooterComponent={
            messages.isLoading ? (
              <View style={{ padding: space.xl }}>
                <Body muted>{t("loading")}</Body>
              </View>
            ) : undefined
          }
        />
      )}

      {/* Quick replies + the input row — clears the home bar via the real inset */}
      <View
        style={{
          padding: space.l,
          paddingLeft: space.l + insets.left,
          paddingRight: space.l + insets.right,
          paddingBottom: space.l + insets.bottom,
          gap: space.m,
          borderTopWidth: 1,
          borderTopColor: c.surface,
        }}
      >
        <View style={{ flexDirection: "row", gap: space.s, flexWrap: "wrap" }}>
          {QUICK_REPLIES.map((key) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={t(key)}
              onPress={() => void send(t(key))}
              style={({ pressed }) => ({
                minHeight: 56,
                paddingHorizontal: space.l,
                borderRadius: 999,
                borderWidth: 2,
                borderColor: c.border,
                backgroundColor: pressed ? c.primarySoft : c.bg,
                alignItems: "center",
                justifyContent: "center",
              })}
            >
              <Text style={{ color: c.text, fontSize: f.label, fontWeight: "600" }}>{t(key)}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: space.m, alignItems: "flex-end" }}>
          <View style={{ flex: 1 }}>
            <TextField
              label={t("typeMessage")}
              value={draft}
              onChangeText={setDraft}
              placeholder={t("typeMessage")}
              multiline
              accessibilityLabel={t("typeMessage")}
            />
          </View>
          <View style={{ width: 120 }}>
            <BigButton label={t("send")} onPress={() => void send(draft)} busy={sending} size="min" />
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
