// Row → DTO converters for API responses.

import type { MessageDTO, PlanDTO, PublicProfile, RequestDTO } from "@parea/shared";
import { publicProfile } from "./serialize";
import type { MessageRow, NearbyRequestRow, PlanRow, RequestRow } from "../types";

export function requestDto(request: RequestRow, owner: PublicProfile): RequestDTO {
  return {
    id: request.id,
    activity: request.activity,
    starts_at: request.starts_at,
    place_type: request.place_type,
    lat: request.lat,
    lng: request.lng,
    radius_km: request.radius_km,
    status: request.status,
    created_at: request.created_at,
    owner,
  };
}

export function nearbyRequestDto(row: NearbyRequestRow): RequestDTO {
  return requestDto(
    row,
    publicProfile(
      {
        id: row.owner_id,
        first_name: row.owner_first_name,
        photo_r2_key: row.owner_photo,
        about: row.owner_about,
        interests: row.owner_interests,
        languages: row.owner_languages,
        mobility: row.owner_mobility,
        verified: row.owner_verified,
        is_volunteer: row.owner_is_volunteer,
        birth_year: row.owner_birth_year,
      },
      row.distance_km,
    ),
  );
}

export function messageDto(row: MessageRow): MessageDTO {
  return {
    id: row.id,
    match_id: row.match_id,
    sender_id: row.sender_id,
    body: row.body,
    created_at: row.created_at,
    flagged: (row.flagged === 1 || row.flagged === 2 ? row.flagged : 0) as 0 | 1 | 2,
  };
}

export function planDto(row: PlanRow): PlanDTO {
  return {
    id: row.id,
    match_id: row.match_id,
    place_name: row.place_name,
    place_lat: row.place_lat,
    place_lng: row.place_lng,
    starts_at: row.starts_at,
    status: row.status,
    safe_checkin_at: row.safe_checkin_at,
    shared_with_contact_at: row.shared_with_contact_at,
    created_at: row.created_at,
  };
}
