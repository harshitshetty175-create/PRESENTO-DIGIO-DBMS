/**
 * transitions.test.js — RULE-MIRROR unit tests.
 *
 * Self-contained mirror of the order state machine in lib/utils.ts
 * (`ORDER_TRANSITIONS` / `canTransition`). Plain `node --test`, no imports
 * from TS files. If lib/utils.ts changes, update this mirror to match.
 *
 * Rules mirrored (lib/utils.ts):
 *   PLACED           -> CONFIRMED, REJECTED, CANCELLED
 *   CONFIRMED        -> PREPARING, CANCELLED
 *   PREPARING        -> READY_FOR_PICKUP
 *   READY_FOR_PICKUP -> PICKED_UP
 *   PICKED_UP        -> OUT_FOR_DELIVERY
 *   OUT_FOR_DELIVERY -> DELIVERED
 *   DELIVERED / CANCELLED / REJECTED are terminal (no outgoing transitions).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// --- Begin mirror of lib/utils.ts (transcribed, not imported) -------------
const ORDER_TRANSITIONS = {
  PLACED: ["CONFIRMED", "REJECTED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY_FOR_PICKUP"],
  READY_FOR_PICKUP: ["PICKED_UP"],
  PICKED_UP: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
  REJECTED: [],
};

function canTransition(from, to) {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}
// --- End mirror -----------------------------------------------------------

describe("canTransition (rule mirror of lib/utils.ts)", () => {
  it("allows the happy path, step by step", () => {
    assert.equal(canTransition("PLACED", "CONFIRMED"), true);
    assert.equal(canTransition("CONFIRMED", "PREPARING"), true);
    assert.equal(canTransition("PREPARING", "READY_FOR_PICKUP"), true);
    assert.equal(canTransition("READY_FOR_PICKUP", "PICKED_UP"), true);
    assert.equal(canTransition("PICKED_UP", "OUT_FOR_DELIVERY"), true);
    assert.equal(canTransition("OUT_FOR_DELIVERY", "DELIVERED"), true);
  });

  it("allows PLACED -> CONFIRMED", () => {
    assert.equal(canTransition("PLACED", "CONFIRMED"), true);
  });

  it("allows PREPARING -> READY_FOR_PICKUP", () => {
    assert.equal(canTransition("PREPARING", "READY_FOR_PICKUP"), true);
  });

  it("allows OUT_FOR_DELIVERY -> DELIVERED", () => {
    assert.equal(canTransition("OUT_FOR_DELIVERY", "DELIVERED"), true);
  });

  it("allows cancellation from PLACED and CONFIRMED only", () => {
    assert.equal(canTransition("PLACED", "CANCELLED"), true);
    assert.equal(canTransition("CONFIRMED", "CANCELLED"), true);
    assert.equal(canTransition("PREPARING", "CANCELLED"), false);
    assert.equal(canTransition("OUT_FOR_DELIVERY", "CANCELLED"), false);
  });

  it("allows a restaurant to reject a freshly placed order", () => {
    assert.equal(canTransition("PLACED", "REJECTED"), true);
    assert.equal(canTransition("CONFIRMED", "REJECTED"), false);
  });

  it("rejects DELIVERED -> CANCELLED (terminal state)", () => {
    assert.equal(canTransition("DELIVERED", "CANCELLED"), false);
  });

  it("rejects PLACED -> DELIVERED (skipping the pipeline)", () => {
    assert.equal(canTransition("PLACED", "DELIVERED"), false);
  });

  it("rejects CANCELLED -> CONFIRMED (terminal state)", () => {
    assert.equal(canTransition("CANCELLED", "CONFIRMED"), false);
  });

  it("rejects backwards and sideways moves", () => {
    assert.equal(canTransition("DELIVERED", "PLACED"), false);
    assert.equal(canTransition("PREPARING", "CONFIRMED"), false);
    assert.equal(canTransition("OUT_FOR_DELIVERY", "PICKED_UP"), false);
    assert.equal(canTransition("REJECTED", "CONFIRMED"), false);
  });

  it("rejects unknown statuses", () => {
    assert.equal(canTransition("SHIPPED", "DELIVERED"), false);
    assert.equal(canTransition("PLACED", "SHIPPED"), false);
  });
});
