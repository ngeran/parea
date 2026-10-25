// Conversations tab — one row per match: photo, name, last message.
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Body, EmptyState, ErrorState, Title, Avatar } from "../../src/components/ui";
import { formatWhen } from "../../src/lib/time";
import { useT } from "../../src/i18n";
import { useTheme } from "../../src/theme";
import { useStore } from "../../src/store";
import { useMatches } from "../../src/lib/queries";

export default function Chats() {
  const t = useT();
  const { c, f, space } = useTheme();
  const router = useRouter();
  const language = useStore((s) => s.language);
  const insets = useSafeAreaInsets();
  const matches = useMatches();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ padding: space.xl, gap: space.xl, paddingTop: insets.top + space.xl }}
    >
      <Title>{t("chatsTitle")}</Title>

      {matches.isLoading ? <Body muted>{t("loading")}</Body> : null}

      {matches.isError ? (
        <ErrorState
          text={t("networkError")}
          retryLabel={t("tryAgain")}
          onRetry={() => void matches.refetch()}
        />
      ) : null}

      {(matches.data?.matches.length ?? 0) === 0 && !matches.isLoading && !matches.isError ? (
        <EmptyState emoji="💬" text={t("noChats")} />
      ) : null}

      <View style={{ gap: space.m }}>
        {matches.data?.matches.map((match) => (
          <Pressable
            key={match.id}
            accessibilityRole="button"
            accessibilityLabel={`${match.other.first_name}. ${match.last_message?.body ?? ""}`}
            onPress={() => router.push(`/chat/${match.id}`)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: space.l,
              minHeight: 72,
              backgroundColor: pressed ? c.primarySoft : c.surface,
              borderRadius: 16,
              padding: space.l,
              borderWidth: 1,
              borderColor: c.hairline,
            })}
          >
            <Avatar photoUrl={match.other.photo_url} name={match.other.first_name} size={52} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: c.text, fontSize: f.body, fontWeight: "700" }}>
                {match.other.first_name}
              </Text>
              <Text numberOfLines={1} style={{ color: c.textSecondary, fontSize: f.label }}>
                {match.last_message?.body ?? ""}
              </Text>
            </View>
            {match.last_message ? (
              <Text style={{ color: c.textSecondary, fontSize: f.label }}>
                {formatWhen(match.last_message.created_at, language)}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
