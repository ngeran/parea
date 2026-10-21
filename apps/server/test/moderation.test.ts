// The scam filter: money requests are held (never delivered), links are
// delivered but flagged, ordinary conversation passes untouched.

import { describe, expect, it } from "vitest";
import { moderateMessage } from "../src/lib/moderation";

// (No database involved — pure unit tests.)

describe("moderateMessage", () => {
  it("blocks money requests in English", () => {
    expect(moderateMessage("Can you send me money for the bus?").verdict).toBe("block");
    expect(moderateMessage("My IBAN is GR16 0110 1050 0000 1054 7023 795").verdict).toBe("block");
    expect(moderateMessage("I always use western union").verdict).toBe("block");
  });

  it("blocks money requests in Greek (accented or not)", () => {
    expect(moderateMessage("Στείλε μου λεφτά για το ταξί").verdict).toBe("block");
    expect(moderateMessage("στείλε μου χρήματα σε παρακαλώ").verdict).toBe("block");
  });

  it("blocks card-number shapes", () => {
    expect(moderateMessage("charge this 4111 1111 1111 1111").verdict).toBe("block");
  });

  it("flags links but lets them through", () => {
    const res = moderateMessage("Here is the café page: https://example.com/kafe");
    expect(res.verdict).toBe("flag");
    expect(res.reasons).toContain("link");
  });

  it("passes normal conversation in both languages", () => {
    expect(moderateMessage("Καλημέρα! Πάμε για καφέ στο Ergon;").verdict).toBe("clean");
    expect(moderateMessage("See you at 11 near the church.").verdict).toBe("clean");
  });
});
