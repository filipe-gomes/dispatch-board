import dayjs from "dayjs";
import { DAY, HOUR, snapDown } from "./time";

export const RANGE_PRESETS = {
  day: { label: "Day", days: 1 },
  threeDays: { label: "3 days", days: 3 },
  week: { label: "Week", days: 7 },
  twoWeeks: { label: "2 weeks", days: 14 },
} as const;

export type RangePreset = keyof typeof RANGE_PRESETS;

/** The visible slice of the timeline, in epoch milliseconds. */
export interface TimelineView {
  start: number;
  end: number;
}

export const MIN_ZOOM = 2 * HOUR;
export const MAX_ZOOM = 31 * DAY;

export function presetView(preset: RangePreset, anchor: number): TimelineView {
  const start = dayjs(anchor).startOf("day");
  return { start: start.valueOf(), end: start.add(RANGE_PRESETS[preset].days, "day").valueOf() };
}

/** A short window around the current time, used as the starting view on phones. */
export function nowView(now: number, hours = 8): TimelineView {
  const start = snapDown(now - 2 * HOUR, HOUR);
  return { start, end: start + hours * HOUR };
}

/**
 * Steps a whole span backwards or forwards. Spans of a day or more move by
 * calendar days so DST changes don't drift the view; shorter ones by their length.
 */
export function shiftView(view: TimelineView, direction: 1 | -1): TimelineView {
  const span = view.end - view.start;
  if (span < DAY - HOUR) return { start: view.start + direction * span, end: view.end + direction * span };
  const days = Math.round(span / DAY);
  return {
    start: dayjs(view.start)
      .add(direction * days, "day")
      .valueOf(),
    end: dayjs(view.end)
      .add(direction * days, "day")
      .valueOf(),
  };
}

/** The preset matching the current span, if the user hasn't zoomed to something in between. */
export function matchPreset(view: TimelineView): RangePreset | undefined {
  const span = view.end - view.start;
  return (Object.keys(RANGE_PRESETS) as RangePreset[]).find(
    (preset) => Math.abs(span - RANGE_PRESETS[preset].days * DAY) <= HOUR
  );
}

/** Keeps the zoom level but moves the view so `time` sits a little left of center. */
export function centerViewOn(view: TimelineView, time: number): TimelineView {
  const span = view.end - view.start;
  const start = time - span / 3;
  return { start, end: start + span };
}

export function formatViewLabel(view: TimelineView, compact = false): string {
  const start = dayjs(view.start);
  const last = dayjs(view.end - 1);
  if (start.isSame(last, "day")) return start.format(compact ? "ddd, MMM D" : "dddd, MMMM D");
  if (start.isSame(last, "month")) return `${start.format("MMM D")} – ${last.format("D, YYYY")}`;
  if (start.isSame(last, "year")) return `${start.format("MMM D")} – ${last.format("MMM D, YYYY")}`;
  return `${start.format("MMM D, YYYY")} – ${last.format("MMM D, YYYY")}`;
}
