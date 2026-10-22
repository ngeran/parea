// One request. The owner sees who offered and accepts one person; a joiner
// sees "waiting for their answer"; a newcomer sees "I can join".
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { activityLabel, placeTypeLabel } from "@parea/shared";
import { BigButton } from "../../src/components/BigButton";
import {
  Body,
  Card,
  EmptyState,
  ErrorState,
  Avatar,
  ProfileLine,
} from "../../src/components/ui";
import { Screen } from "../../src/components/Screen";
import { api } from "../../src/lib/api";
import { ackDialog, confirmDialog, toast } from "../../src/lib/notify";
import { formatWhen } from "../../src/lib/time";
import { useT } from "../../src/i18n";
import { useTheme } from "../../src/theme";
import { useStore } from "../../src/store";
import { errCode, useMyRequest, useOffers } from "../../src/lib/queries";

export default function RequestDetail() {
  const t = useT();
  const { c, f, space } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const language = useStore((s) => s.language);
  const myId = useStore((s) => s.profile?.id);
  const detail = useMyRequest(id ?? "");
  const offers = useOffers(detail.data?.request.owner.id === myId ? (id ?? "") : "");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["request", id] });
    await queryClient.invalidateQueries({ queryKey: ["offers", id] });
    await queryClient.invalidateQueries({ queryKey: ["requests", "mine"] });
  };

  const accept = (responseId: string, name: string) => {
    confirmDialog(
      {
        title: t("accept"),
        body: name,
        okLabel: t("yes"),
        cancelLabel: t("no"),
      },
      () => {
        void (async () => {
          setBusy(true);
          try {
            const result = await api<{ match_id: string }>(`/requests/responses/${responseId}/accept`, {
              method: "POST",
            });
            await queryClient.invalidateQueries({ queryKey: ["requests", "mine"] });
            // OK moves the screen — never navigate underneath an alert.
            ackDialog(t("matchedToast"), t("ok"), () =>
              router.replace(`/chat/${result.match_id}`),
            );
          } catch {
            toast(t("noLongerAvailable"), "error");
            await refresh();
          } finally {
            setBusy(false);
          }
        })();
      },
    );
  };

  const cancel = () => {
    confirmDialog(
      {
        title: t("confirmCancelTitle"),
        body: t("confirmCancelBody"),
        okLabel: t("yesCancel"),
        cancelLabel: t("keepIt"),
        destructive: true,
      },
      () => {
        void (async () => {
          try {
            await api(`/requests/${id}/cancel`, { method: "POST" });
            router.back();
          } catch {
            toast(t("noLongerAvailable"), "error");
          }
        })();
      },
    );
  };

  if (detail.isLoading) {
    return (
      <Screen title={t("loading")}>
        <Body muted>{t("loading")}</Body>
      </Screen>
    );
  }

  if (detail.isError) {
    return (
      <Screen title={t("genericError")}>
        <EmptyState emoji="🌫️" text={t("noLongerAvailable")} />
        <BigButton
          label={t("tryAgain")}
          icon="🔄"
          variant="soft"
          onPress={() => void detail.refetch()}
        />
        <BigButton label={t("home")} icon="🏠" onPress={() => router.replace("/home")} />
      </Screen>
    );
  }

  const { request, my_response: myResponse } = detail.data!;
  const isOwner = request.owner.id === myId;

  return (
    <Screen title={activityLabel(request.activity, language)}>

      <Card>
        <Text style={{ color: c.text, fontSize: f.body }}>📅 {formatWhen(request.starts_at, language)}</Text>
        <Text style={{ color: c.text, fontSize: f.body }}>📍 {placeTypeLabel(request.place_type, language)}</Text>
        <Text style={{ color: c.textSecondary, fontSize: f.label }}>
          {request.owner.first_name} · {t("kmAway", { d: `≈ ${request.radius_km} km` })}
        </Text>
      </Card>

      {isOwner ? (
        <View style={{ gap: space.xl }}>
          <Text accessible accessibilityRole="header" style={{ color: c.text, fontSize: f.body + 2, fontWeight: "700" }}>
            {t("whoOffers")}
          </Text>
          {offers.isError ? (
            <ErrorState
              text={t("networkError")}
              retryLabel={t("tryAgain")}
              onRetry={() => void offers.refetch()}
            />
          ) : (offers.data?.responses.length ?? 0) === 0 ? (
            <Body muted>{t("noOffersYet")}</Body>
          ) : null}
          <View style={{ gap: space.xl }}>
            {offers.data?.responses.map((offer) => (
              <Card key={offer.id}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space.l }}>
                  <Avatar photoUrl={offer.responder.photo_url} name={offer.responder.first_name} size={56} />
                  <View style={{ flex: 1 }}>
                    <ProfileLine person={offer.responder} lang={language} />
                    <Body muted>{offer.responder.about}</Body>
                  </View>
                </View>
                {offer.status === "offered" ? (
                  <BigButton
                    label={t("accept")}
                    icon="🤝"
                    onPress={() => accept(offer.id, offer.responder.first_name)}
                    busy={busy}
                  />
                ) : (
                  <Body>✓ {t("accept")}</Body>
                )}
              </Card>
            ))}
          </View>
          {request.status === "open" ? (
            <BigButton label={t("cancelRequest")} variant="quiet" onPress={cancel} />
          ) : null}
        </View>
      ) : myResponse === "offered" ? (
        <Card>
          <Body>⏳ {t("youOffered")}</Body>
        </Card>
      ) : request.status === "open" ? (
        <BigButton
          label={t("canJoin")}
          icon="🙋"
          onPress={() =>
            void (async () => {
              try {
                await api(`/requests/${id}/responses`, { method: "POST" });
                await refresh();
              } catch (e) {
                toast(
                  errCode(e) === "already_responded" ? t("askedToJoin") : t("noLongerAvailable"),
                  "error",
                );
                await refresh();
              }
            })()
          }
        />
      ) : (
        <EmptyState emoji="🌫️" text={t("cancelledRequest")} />
      )}
    </Screen>
  );
}
