// Rule-based message moderation (MVP). Money requests are held and never
// delivered; links are delivered but flagged for the admin queue.
// (ML scoring is a later phase — see docs/PHASE-1-PLAN.md §3.7.)

export type Verdict = "clean" | "flag" | "block";

const MONEY_REQUEST_PATTERNS: RegExp[] = [
  /\b(send|wire|transfer)\s+(me\s+)?(money|cash|euros?|dollars?|\$|€)/i,
  // Greek: στείλε/στειλε/στελνε … (μου) χρήματα/λεφτά/ευρώ — accent-optional.
  // NOTE: Greek letters are NOT \w in JS regexes, so \b and \w* never match
  // around them; we use explicit [α-ω…] classes and (^|\s) anchors instead.
  /(^|\s)στε[α-ωάέίόύήώ]+\s+(μου\s+)?(χρ[ηήιί]μ[αά]τ[αά]|λ[εη]φτ[αά]|ευρ[ωώ])/i,
  /\bIBAN\b/i,
  /western\s+union/i,
  /\b(bitcoin|ethereum|usdt|crypto wallet|wallet address)\b/i,
  /\b\d{4}[\s-]\d{4}[\s-]\d{4}[\s-]\d{4}\b/, // card-number shape
];

const LINK_PATTERNS: RegExp[] = [/https?:\/\//i, /\bwww\./i];

export interface ModerationResult {
  verdict: Verdict;
  reasons: string[];
}

export function moderateMessage(body: string): ModerationResult {
  if (MONEY_REQUEST_PATTERNS.some((re) => re.test(body))) {
    return { verdict: "block", reasons: ["money_request"] };
  }
  const reasons: string[] = [];
  if (LINK_PATTERNS.some((re) => re.test(body))) reasons.push("link");
  if (reasons.length > 0) return { verdict: "flag", reasons };
  return { verdict: "clean", reasons: [] };
}
