// Types shared by client, server and admin.

export type Lang = "el" | "en";
export type Mobility = "walk" | "ride" | "home";
export type TextSize = "normal" | "large" | "xlarge";
export type ThemeName = "light" | "dark" | "contrast";
export type ReportReason = "scam" | "harassment" | "fake" | "other";
export type Relationship = "child" | "sibling" | "friend" | "carer" | "other";
export type RequestStatus = "open" | "matched" | "done" | "cancelled";
export type PlanStatus = "planned" | "done" | "cancelled";

/** Profile as other users see it. Never contains phone or exact location. */
export interface PublicProfile {
  id: string;
  first_name: string;
  photo_url: string | null;
  about: string;
  interests: string[];
  languages: Lang[];
  mobility: Mobility;
  verified: boolean;
  /** Admin-approved volunteer badge (helps others trust help requests). */
  volunteer: boolean;
  birth_year: number | null;
  /** km from the viewer — present only in radius-scoped listings */
  distance_km?: number;
}

/** Profile as its owner sees it (adds masked phone + preferences). */
export interface SelfProfile extends PublicProfile {
  phone_masked: string;
  radius_km: number;
  text_size: TextSize;
  theme: ThemeName;
  language: Lang;
  push_enabled: boolean;
  /** True while the volunteer application awaits admin review. */
  volunteer_requested: boolean;
  /** The owner's own (rounded) grid point — others never see it. */
  lat: number | null;
  lng: number | null;
}

export interface RequestDTO {
  id: string;
  activity: string;
  starts_at: string;
  place_type: string;
  lat: number;
  lng: number;
  radius_km: number;
  status: RequestStatus;
  created_at: string;
  owner: PublicProfile;
}

export interface MessageDTO {
  id: string;
  match_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  /** 0 clean · 1 delivered but flagged (links) · 2 blocked for review */
  flagged: 0 | 1 | 2;
}

export interface MatchDTO {
  id: string;
  source: "discover" | "request";
  created_at: string;
  other: PublicProfile;
  last_message: MessageDTO | null;
}

export interface PlanDTO {
  id: string;
  match_id: string;
  place_name: string;
  place_lat: number | null;
  place_lng: number | null;
  starts_at: string;
  status: PlanStatus;
  safe_checkin_at: string | null;
  shared_with_contact_at: string | null;
  created_at: string;
}

/** Plan as listed in the app — adds the other person (name + photo only). */
export interface PlanListItem extends PlanDTO {
  other: Pick<PublicProfile, "id" | "first_name" | "photo_url">;
}

export interface TrustedContactDTO {
  id: string;
  name: string;
  phone_masked: string;
  relationship: Relationship;
  notify: boolean;
}

export interface OtpRequestResult {
  ok: true;
  /** Only present in development mock mode (no real SMS is sent). */
  dev_code?: string;
}

export interface OtpVerifyResult {
  token: string;
  is_new_user: boolean;
  profile: SelfProfile;
}

export interface DiscoverCard {
  profile: PublicProfile | null;
}

/**
 * Live events pushed over `WS /events` (UserEvents Durable Object).
 * The client applies these into its query cache.
 */
export type ServerEvent =
  | { type: "response.created"; at: string; payload: { request_id: string; responder: PublicProfile } }
  | { type: "request.accepted"; at: string; payload: { request_id: string; match_id: string } }
  | { type: "request.declined"; at: string; payload: { request_id: string } }
  | { type: "request.nearby"; at: string; payload: { request: RequestDTO } }
  | { type: "match.created"; at: string; payload: { match_id: string; other: PublicProfile } }
  | { type: "message.new"; at: string; payload: { message: MessageDTO } }
  | { type: "plan.updated"; at: string; payload: { plan: PlanDTO } }
  | { type: "checkin.confirmed"; at: string; payload: { plan_id: string } };
