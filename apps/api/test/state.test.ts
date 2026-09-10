import { BOUNTY_STATUSES, type BountyStatus } from "@boltbounty/shared";
import { describe, expect, it } from "vitest";
import { IllegalTransition, transition, type BountyEvent } from "../src/bounties/state.js";

const at = (status: BountyStatus) => ({ id: "b1", status });

describe("transition", () => {
  // Every row of the table in BUILD_PLAN.md section 3.
  it.each<[BountyStatus, BountyEvent, BountyStatus]>([
    ["unfunded", "htlc_accepted", "funded"],
    ["unfunded", "expired", "expired"],
    ["funded", "submission_received", "submitted"],
    ["funded", "poster_cancelled", "cancelled"],
    ["funded", "expired", "expired"],
    ["submitted", "approved", "paid"],
    ["submitted", "rejected", "funded"],
    ["submitted", "expired", "expired"],
  ])("%s + %s -> %s", (from, event, to) => {
    expect(transition(at(from), event)).toBe(to);
  });

  it.each<[BountyStatus, BountyEvent]>([
    ["unfunded", "submission_received"],
    ["funded", "approved"],
    ["paid", "rejected"],
  ])("rejects %s + %s", (from, event) => {
    expect(() => transition(at(from), event)).toThrow(IllegalTransition);
  });

  it("terminal states accept no events", () => {
    const events: BountyEvent[] = ["htlc_accepted", "submission_received", "approved", "rejected", "expired", "poster_cancelled"];
    for (const status of ["paid", "cancelled", "expired"] as const) {
      for (const event of events) {
        expect(() => transition(at(status), event)).toThrow(IllegalTransition);
      }
    }
  });

  it("covers every status", () => {
    expect(BOUNTY_STATUSES).toHaveLength(6);
  });
});
