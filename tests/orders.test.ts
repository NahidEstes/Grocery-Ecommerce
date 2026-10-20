import test from "node:test";
import assert from "node:assert/strict";
import {
  deliveryDays,
  isValidDelivery,
  formatDelivery,
} from "../src/lib/orders";

test("delivery slots close one hour before they start in Dhaka time", () => {
  const now = new Date("2026-10-20T08:30:00Z");
  const today = deliveryDays(now)[0];
  assert.equal(today.date, "2026-10-20");
  assert.deepEqual(
    today.slots.map((slot) => slot.id),
    ["evening"],
  );
  assert.equal(
    isValidDelivery({ date: today.date, slot: "morning" }, now),
    false,
  );
  assert.equal(
    isValidDelivery({ date: today.date, slot: "evening" }, now),
    true,
  );
  assert.equal(
    isValidDelivery({ date: "2026-10-25", slot: "morning" }, now),
    false,
  );
  assert.deepEqual(deliveryDays(new Date("2026-10-20T12:00:00Z"))[0].slots, []);
});
test("delivery dates use the service timezone and roll over the year", () => {
  assert.equal(
    deliveryDays(new Date("2026-10-20T23:15:00Z"))[0].date,
    "2026-10-21",
  );
  assert.deepEqual(
    deliveryDays(new Date("2026-12-31T06:00:00Z")).map((day) => day.date),
    ["2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03", "2027-01-04"],
  );
  assert.match(
    formatDelivery({ date: "2026-10-21", slot: "afternoon" }),
    /21 Oct 2026, 12 PM – 2 PM/,
  );
});
test("the booking cutoff is enforced at the exact hour", () => {
  const selection = { date: "2026-10-20", slot: "morning" } as const;
  assert.equal(
    isValidDelivery(selection, new Date("2026-10-20T02:59:00Z")),
    true,
  );
  assert.equal(
    isValidDelivery(selection, new Date("2026-10-20T03:00:00Z")),
    false,
  );
});
