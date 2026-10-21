// Zod schemas = the API contract. The server validates every request body
// with these; the client reuses them for form validation.
import { z } from "zod";
import { ACTIVITY_KEYS, PLACE_TYPE_KEYS } from "./activities";

/** E.164 phone numbers, e.g. +306912345678 */
export const phoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, "phone must be in +<country><number> format");

/** ISO-8601 UTC instant ending in Z, seconds precision (matches the DB format). */
export const isoDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, "must be an ISO-8601 UTC instant (…T…Z)");

export const otpRequestSchema = z.object({ phone: phoneSchema });

export const otpVerifySchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, "code must be 6 digits"),
  /** Required when creating a new account — GDPR consent, e.g. "2026-10". */
  consent_version: z.string().max(20).optional(),
});

export const profilePatchSchema = z
  .object({
    first_name: z.string().trim().min(1).max(40).optional(),
    about: z.string().trim().max(500).optional(),
    interests: z.array(z.string().max(40)).max(20).optional(),
    languages: z.array(z.enum(["el", "en"])).min(1).max(5).optional(),
    mobility: z.enum(["walk", "ride", "home"]).optional(),
    // 65+ is self-declared: the oldest plausible and youngest plausible years.
    birth_year: z.number().int().min(1900).max(new Date().getFullYear() - 60).optional(),
    radius_km: z.number().int().min(1).max(50).optional(),
    text_size: z.enum(["normal", "large", "xlarge"]).optional(),
    theme: z.enum(["light", "dark", "contrast"]).optional(),
    language: z.enum(["el", "en"]).optional(),
    push_enabled: z.boolean().optional(),
    /**
     * Volunteer flag. Turning it on files an application for the admin
     * queue (`volunteer_requested`); the approved `is_volunteer` badge is
     * set by admins only. Turning it off clears both immediately.
     */
    volunteer: z.boolean().optional(),
  })
  .strict();

/** Feedback straight to the admin dashboard — free text, no category. */
export const feedbackCreateSchema = z
  .object({
    message: z.string().trim().min(3).max(2000),
  })
  .strict();

export const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/** One device per Expo push token; re-registering moves/updates the row. */
export const deviceRegisterSchema = z
  .object({
    push_token: z.string().min(10).max(500),
    platform: z.enum(["ios", "android", "web"]).optional(),
  })
  .strict();

export const requestCreateSchema = z.object({
  activity: z.enum(ACTIVITY_KEYS as [string, ...string[]]),
  starts_at: isoDateTime,
  place_type: z.enum(PLACE_TYPE_KEYS as [string, ...string[]]),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius_km: z.number().int().min(1).max(50),
});

export const discoverDecisionSchema = z.object({ yes: z.boolean() });

export const messageSendSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export const planCreateSchema = z.object({
  place_name: z.string().trim().min(1).max(120),
  place_lat: z.number().min(-90).max(90).nullable().optional(),
  place_lng: z.number().min(-180).max(180).nullable().optional(),
  starts_at: isoDateTime,
});

export const planUpdateSchema = z
  .object({
    place_name: z.string().trim().min(1).max(120).optional(),
    place_lat: z.number().min(-90).max(90).nullable().optional(),
    place_lng: z.number().min(-180).max(180).nullable().optional(),
    starts_at: isoDateTime.optional(),
    status: z.enum(["planned", "done", "cancelled"]).optional(),
  })
  .strict();

export const trustedContactSchema = z.object({
  name: z.string().trim().min(1).max(60),
  phone: phoneSchema,
  relationship: z.enum(["child", "sibling", "friend", "carer", "other"]),
  notify: z.boolean().optional(),
});

export const reportSchema = z.object({
  target_id: z.string().uuid(),
  reason: z.enum(["scam", "harassment", "fake", "other"]),
  details: z.string().trim().max(1000).optional(),
});

export const sosSchema = z
  .object({
    plan_id: z.string().uuid().optional(),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export type OtpRequestInput = z.infer<typeof otpRequestSchema>;
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;
export type ProfilePatchInput = z.infer<typeof profilePatchSchema>;
export type RequestCreateInput = z.infer<typeof requestCreateSchema>;
export type PlanCreateInput = z.infer<typeof planCreateSchema>;
export type PlanUpdateInput = z.infer<typeof planUpdateSchema>;
export type TrustedContactInput = z.infer<typeof trustedContactSchema>;
export type ReportInput = z.infer<typeof reportSchema>;
