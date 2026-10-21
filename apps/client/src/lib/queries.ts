// TanStack Query hooks — one per feature. The WebSocket (LiveProvider)
// invalidates these keys as ServerEvents arrive; a missed event is healed
// by the next refetch because D1 is the source of truth.
import { useQuery } from "@tanstack/react-query";
import type {
  MatchDTO,
  MessageDTO,
  PlanListItem,
  PublicProfile,
  RequestDTO,
  SelfProfile,
  TrustedContactDTO,
} from "@parea/shared";
import { api } from "./api";
import { useStore } from "../store";
import type { Coords } from "./location";

export interface MyRequest extends RequestDTO {
  offered_count: number;
}

/** Pull the error code out of anything a screen catches. */
export function errCode(e: unknown): string {
  return e instanceof Error && "code" in e ? String((e as { code: unknown }).code) : "";
}

export function useToken(): string | null {
  return useStore((s) => s.token);
}

export function useMe() {
  const token = useToken();
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api<SelfProfile>("/me", { token: token! }),
    enabled: !!token,
  });
}

export function useMyRequests() {
  const token = useToken();
  return useQuery({
    queryKey: ["requests", "mine"],
    queryFn: () => api<{ requests: MyRequest[] }>("/requests/mine", { token: token! }),
    enabled: !!token,
  });
}

export function useNearbyRequests(coords: Coords | null) {
  const token = useToken();
  return useQuery({
    queryKey: ["requests", "nearby", coords?.lat, coords?.lng],
    queryFn: () =>
      api<{ requests: RequestDTO[] }>("/requests/nearby", {
        token: token!,
        query: coords ? { lat: coords.lat, lng: coords.lng } : undefined,
      }),
    enabled: !!token && !!coords,
  });
}

export function useMyRequest(requestId: string) {
  const token = useToken();
  return useQuery({
    queryKey: ["request", requestId],
    queryFn: () =>
      api<{ request: RequestDTO; my_response: string | null; offered_count: number }>(
        `/requests/${requestId}`,
        { token: token! },
      ),
    enabled: !!token && !!requestId,
  });
}

export function useOffers(requestId: string) {
  const token = useToken();
  return useQuery({
    queryKey: ["offers", requestId],
    queryFn: () =>
      api<{
        responses: Array<{ id: string; status: string; responder: PublicProfile }>;
      }>(`/requests/${requestId}/responses`, { token: token! }),
    enabled: !!token && !!requestId,
  });
}

export function useDiscover(coords: Coords | null) {
  const token = useToken();
  return useQuery({
    queryKey: ["discover", coords?.lat, coords?.lng],
    queryFn: () =>
      api<{ profile: PublicProfile | null }>("/discover", {
        token: token!,
        query: coords ? { lat: coords.lat, lng: coords.lng } : undefined,
      }),
    enabled: !!token && !!coords,
  });
}

export function useMatches() {
  const token = useToken();
  return useQuery({
    queryKey: ["matches"],
    queryFn: () => api<{ matches: MatchDTO[] }>("/matches", { token: token! }),
    enabled: !!token,
  });
}

export function useMessages(matchId: string) {
  const token = useToken();
  return useQuery({
    queryKey: ["messages", matchId],
    queryFn: () => api<{ messages: MessageDTO[] }>(`/matches/${matchId}/messages`, { token: token! }),
    enabled: !!token && !!matchId,
  });
}

export function usePlans() {
  const token = useToken();
  return useQuery({
    queryKey: ["plans"],
    queryFn: () => api<{ plans: PlanListItem[] }>("/plans", { token: token! }),
    enabled: !!token,
  });
}

export function usePlan(planId: string) {
  const token = useToken();
  return useQuery({
    queryKey: ["plan", planId],
    queryFn: () => api<{ plan: PlanListItem }>(`/plans/${planId}`, { token: token! }),
    enabled: !!token && !!planId,
  });
}

export function useTrustedContacts() {
  const token = useToken();
  return useQuery({
    queryKey: ["contacts"],
    queryFn: () => api<{ contacts: TrustedContactDTO[] }>("/me/trusted-contacts", { token: token! }),
    enabled: !!token,
  });
}
