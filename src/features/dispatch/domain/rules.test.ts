import { describe, expect, it } from "vitest";
import { at, context, input, load, NOW } from "../test/factories";
import { isLocked, primaryError, validateLoad, validateTitle } from "./rules";
import { HOUR, MINUTE } from "./time";

describe("validateTitle", () => {
  it.each([
    ["", false],
    ["Gas", false],
    ["Gas#", false],
    ["Gas-N", true],
    ["x".repeat(35), true],
    ["x".repeat(36), false],
  ])("%j is valid: %s", (title, valid) => {
    expect(validateTitle(title) === undefined).toBe(valid);
  });

  it("ignores surrounding whitespace when counting", () => {
    expect(validateTitle("   Gas   ")).toBeDefined();
    expect(validateTitle(`  ${"x".repeat(35)}  `)).toBeUndefined();
  });
});

describe("isLocked", () => {
  it("locks loads that have started or finished", () => {
    expect(isLocked(load({ start: NOW - HOUR }), NOW)).toBe(true);
    expect(isLocked(load({ start: NOW }), NOW)).toBe(true);
    expect(isLocked(load({ start: NOW + MINUTE }), NOW)).toBe(false);
  });

  it("never locks unassigned loads, which are not on the timeline yet", () => {
    expect(isLocked(load({ driverId: null, start: NOW - HOUR }), NOW)).toBe(false);
  });
});

describe("validateLoad", () => {
  it("accepts a well-formed future load", () => {
    expect(validateLoad(input(), context()).valid).toBe(true);
  });

  it("enforces the title length", () => {
    expect(validateLoad(input({ title: "Gas" }), context()).errors.title).toMatch(/at least 5/);
    expect(validateLoad(input({ title: "x".repeat(36) }), context()).errors.title).toMatch(/35 characters or fewer/);
  });

  it("rejects starts in the past or right now", () => {
    expect(validateLoad(input({ start: NOW, end: NOW + HOUR }), context()).errors.start).toMatch(/future/);
  });

  it("requires the end to follow the start", () => {
    expect(validateLoad(input({ end: at(10, 18) }), context()).errors.end).toMatch(/after the start/);
  });

  it("allows exactly 24 hours, across a date boundary", () => {
    const result = validateLoad(input({ start: at(10, 18), end: at(11, 18) }), context());
    expect(result.valid).toBe(true);
  });

  it("rejects anything longer than 24 hours", () => {
    const result = validateLoad(input({ start: at(10, 18), end: at(11, 18, 15) }), context());
    expect(result.errors.end).toMatch(/24 hours/);
  });

  it("rejects overlapping loads for the same driver and reports the conflict", () => {
    const existing = load({ start: at(10, 17), end: at(10, 19) });
    const result = validateLoad(input(), context([existing]));
    expect(result.valid).toBe(false);
    expect(result.conflict).toBe(existing);
    expect(result.errors.conflict).toContain("QuickStop #31");
  });

  it("allows back-to-back loads", () => {
    const before = load({ start: at(10, 16), end: at(10, 18) });
    const after = load({ start: at(10, 20), end: at(10, 22) });
    expect(validateLoad(input(), context([before, after])).valid).toBe(true);
  });

  it("allows the same window for a different driver", () => {
    const existing = load({ driverId: "james", start: at(10, 17), end: at(10, 19) });
    expect(validateLoad(input(), context([existing])).valid).toBe(true);
  });

  it("does not treat a load as conflicting with itself when edited", () => {
    const original = load({ start: at(10, 17), end: at(10, 19) });
    const result = validateLoad(
      input({ start: at(10, 17, 30), end: at(10, 19, 30) }),
      context([original], { original })
    );
    expect(result.valid).toBe(true);
  });

  it("refuses any change to a load that has started", () => {
    const original = load({ start: NOW - HOUR, end: NOW + HOUR });
    const result = validateLoad(input(), context([original], { original }));
    expect(result.errors).toEqual({ locked: expect.stringMatching(/already started/) });
  });

  it("keeps gallons within the assigned truck's capacity", () => {
    expect(validateLoad(input({ driverId: "tom", gallons: 3_500 }), context()).errors.gallons).toMatch(/3,000 gal/);
    expect(validateLoad(input({ gallons: 0 }), context()).errors.gallons).toBeDefined();
  });

  it("skips driver checks for loads left in the unassigned queue", () => {
    const busy = load({ start: at(10, 17), end: at(10, 19) });
    expect(validateLoad(input({ driverId: null, gallons: 9_500 }), context([busy])).valid).toBe(true);
  });

  it("requires a backup terminal that differs from the primary", () => {
    const result = validateLoad(input({ backupTerminalId: "north" }), context());
    expect(result.errors.backupTerminalId).toBeDefined();
  });

  it("surfaces the most relevant error first", () => {
    const busy = load({ start: at(10, 17), end: at(10, 19) });
    const { errors } = validateLoad(input({ title: "Gas" }), context([busy]));
    expect(primaryError(errors)).toBe(errors.conflict);
  });
});
