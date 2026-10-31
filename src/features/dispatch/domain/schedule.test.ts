import { describe, expect, it } from "vitest";
import { at, driver, load } from "../test/factories";
import {
  buildScheduleIndex,
  findAvailableDrivers,
  findConflict,
  findNextOpenStart,
  overlaps,
  suggestAssignment,
} from "./schedule";
import { HOUR } from "./time";

describe("overlaps", () => {
  it("treats intervals as half-open", () => {
    expect(overlaps({ start: 0, end: 10 }, { start: 10, end: 20 })).toBe(false);
    expect(overlaps({ start: 0, end: 11 }, { start: 10, end: 20 })).toBe(true);
    expect(overlaps({ start: 5, end: 6 }, { start: 0, end: 20 })).toBe(true);
  });
});

describe("buildScheduleIndex", () => {
  it("groups loads by driver, sorted by start, and skips unassigned loads", () => {
    const late = load({ start: at(10, 18), end: at(10, 19) });
    const early = load({ start: at(10, 8), end: at(10, 9) });
    const queued = load({ driverId: null });
    const index = buildScheduleIndex([late, queued, early]);
    expect(index.get("maria")).toEqual([early, late]);
    expect([...index.keys()]).toEqual(["maria"]);
  });
});

describe("findConflict", () => {
  const schedule = [load({ start: at(10, 8), end: at(10, 10) }), load({ start: at(10, 14), end: at(10, 16) })];

  it("finds the overlapping load", () => {
    expect(findConflict(schedule, { start: at(10, 15), end: at(10, 17) })).toBe(schedule[1]);
  });

  it("ignores the load being edited", () => {
    expect(findConflict(schedule, { start: at(10, 15), end: at(10, 17) }, schedule[1].id)).toBeUndefined();
  });

  it("returns nothing for free time", () => {
    expect(findConflict(schedule, { start: at(10, 10), end: at(10, 14) })).toBeUndefined();
    expect(findConflict(undefined, { start: 0, end: 1 })).toBeUndefined();
  });
});

describe("findNextOpenStart", () => {
  const schedule = [
    load({ start: at(10, 8), end: at(10, 10) }),
    load({ start: at(10, 11), end: at(10, 13) }),
    load({ start: at(10, 16), end: at(10, 17) }),
  ];

  it("keeps the requested start when it is free", () => {
    expect(findNextOpenStart(schedule, 2 * HOUR, at(10, 13, 30))).toBe(at(10, 13, 30));
  });

  it("skips gaps that are too short", () => {
    // 10:00–11:00 is only one hour, so a two-hour load lands after the 11:00–13:00 run.
    expect(findNextOpenStart(schedule, 2 * HOUR, at(10, 9))).toBe(at(10, 13));
  });

  it("rounds up to the next quarter hour", () => {
    expect(findNextOpenStart([], HOUR, at(10, 9, 7))).toBe(at(10, 9, 15));
  });
});

describe("findAvailableDrivers", () => {
  it("returns drivers free for the slot whose truck can carry the load", () => {
    const maria = driver();
    const james = driver({ id: "james" });
    const tom = driver({ id: "tom", capacityGallons: 3_000 });
    const index = buildScheduleIndex([load({ start: at(10, 14), end: at(10, 16) })]);
    const free = findAvailableDrivers([maria, james, tom], index, { start: at(10, 15), end: at(10, 17) }, 8_000);
    expect(free).toEqual([james]);
  });
});

describe("suggestAssignment", () => {
  it("prefers the driver who can start soonest", () => {
    const maria = driver();
    const james = driver({ id: "james" });
    const index = buildScheduleIndex([load({ start: at(10, 13), end: at(10, 18) })]);
    const queued = load({ driverId: null, start: at(10, 14), end: at(10, 16) });
    expect(suggestAssignment([maria, james], index, queued, at(10, 12))).toEqual({ driver: james, start: at(10, 14) });
  });

  it("moves an overdue load to the earliest bookable time", () => {
    const queued = load({ driverId: null, start: at(10, 9), end: at(10, 11) });
    const suggestion = suggestAssignment([driver()], new Map(), queued, at(10, 12, 15));
    expect(suggestion?.start).toBe(at(10, 12, 15));
  });

  it("returns null when no truck is big enough", () => {
    const queued = load({ driverId: null, gallons: 9_500 });
    expect(suggestAssignment([driver({ capacityGallons: 3_000 })], new Map(), queued, at(10, 12))).toBeNull();
  });
});
