import { describe, expect, it } from "vitest";
import { at } from "../test/factories";
import { dragWindow } from "./timeline-model";

describe("dragWindow", () => {
  const earliest = at(10, 12, 15);

  it("runs from the press to the pointer, snapped to quarter hours", () => {
    expect(dragWindow(at(10, 14, 4), at(10, 16, 7), earliest)).toEqual({ start: at(10, 14), end: at(10, 16) });
  });

  it("makes the press the end when dragging left", () => {
    expect(dragWindow(at(10, 16), at(10, 14), earliest)).toEqual({ start: at(10, 14), end: at(10, 16) });
  });

  it("is at least a quarter hour long", () => {
    expect(dragWindow(at(10, 14), at(10, 14, 3), earliest)).toEqual({ start: at(10, 14), end: at(10, 14, 15) });
  });

  it("stops at 24 hours, keeping the press in place", () => {
    expect(dragWindow(at(10, 14), at(11, 18), earliest)).toEqual({ start: at(10, 14), end: at(11, 14) });
    expect(dragWindow(at(12, 9), at(10, 18), earliest)).toEqual({ start: at(11, 9), end: at(12, 9) });
  });

  it("never starts before the earliest bookable time", () => {
    expect(dragWindow(at(10, 9), at(10, 14), earliest)).toEqual({ start: earliest, end: at(10, 14) });
    expect(dragWindow(at(10, 14), at(10, 9), earliest)).toEqual({ start: earliest, end: at(10, 14) });
    expect(dragWindow(at(10, 8), at(10, 9), earliest)).toEqual({ start: earliest, end: at(10, 12, 30) });
  });
});
