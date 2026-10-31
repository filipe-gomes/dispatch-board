import { describe, expect, it } from "vitest";
import { at } from "../test/factories";
import { HOUR } from "./time";
import { formatViewLabel, matchPreset, nowView, presetView, shiftView } from "./view";

describe("timeline views", () => {
  it("builds presets from the start of the anchor day", () => {
    expect(presetView("day", at(10, 15, 30))).toEqual({ start: at(10, 0), end: at(11, 0) });
    expect(presetView("week", at(10, 15))).toEqual({ start: at(10, 0), end: at(17, 0) });
  });

  it("steps by the visible span", () => {
    expect(shiftView(presetView("threeDays", at(10, 9)), 1)).toEqual({ start: at(13, 0), end: at(16, 0) });
    expect(shiftView(presetView("day", at(10, 9)), -1)).toEqual({ start: at(9, 0), end: at(10, 0) });
  });

  it("steps zoomed-in views by their own length", () => {
    const shift = nowView(at(10, 13, 20));
    expect(shift).toEqual({ start: at(10, 11), end: at(10, 19) });
    expect(shiftView(shift, 1)).toEqual({ start: at(10, 19), end: at(11, 3) });
    expect(shift.end - shift.start).toBe(8 * HOUR);
  });

  it("recognises preset spans and ignores custom zoom levels", () => {
    expect(matchPreset(presetView("twoWeeks", at(10, 0)))).toBe("twoWeeks");
    expect(matchPreset({ start: at(10, 0), end: at(10, 9) })).toBeUndefined();
  });

  it("labels the visible range", () => {
    expect(formatViewLabel(presetView("day", at(10, 0)))).toBe("Monday, August 10");
    expect(formatViewLabel(presetView("day", at(10, 0)), true)).toBe("Mon, Aug 10");
    expect(formatViewLabel(presetView("week", at(10, 0)))).toBe("Aug 10 – 16, 2026");
    expect(formatViewLabel(presetView("twoWeeks", at(25, 0)))).toBe("Aug 25 – Sep 7, 2026");
  });
});
