import type { TimelineGroupBase, TimelineItemBase, TimelineKeys } from "react-calendar-timeline";
import { formatGallons, formatWindow } from "../domain/format";
import { isLocked, MAX_LOAD_DURATION } from "../domain/rules";
import type { ScheduleIndex, TimeSlot } from "../domain/schedule";
import { getLoadState, type LoadState, resolveSupply, type SupplyPlan } from "../domain/status";
import { nextBookableStart, SNAP, snapNearest } from "../domain/time";
import {
  type Driver,
  type DriverId,
  type FleetKind,
  type Load,
  type LoadId,
  PRODUCTS,
  type Terminal,
  type TerminalId,
} from "../domain/types";

export const LINE_HEIGHT = 60;
export const SECTION_HEIGHT = 32;
export const ITEM_HEIGHT_RATIO = 0.7;

/** Item `title` attributes come from `tooltip`, so hovering a load shows its full details. */
export const TIMELINE_KEYS: TimelineKeys = {
  groupIdKey: "id",
  groupTitleKey: "title",
  groupRightTitleKey: "rightTitle",
  groupLabelKey: "title",
  itemIdKey: "id",
  itemTitleKey: "title",
  itemDivTitleKey: "tooltip",
  itemGroupKey: "group",
  itemTimeStartKey: "start_time",
  itemTimeEndKey: "end_time",
};

export interface SectionGroup extends TimelineGroupBase {
  kind: "section";
  id: string;
  title: string;
  count: number;
}

export interface DriverGroup extends TimelineGroupBase {
  kind: "driver";
  id: DriverId;
  title: string;
  driver: Driver;
  /** The load the driver is working right now, if any. */
  current?: Load;
}

export type BoardGroup = SectionGroup | DriverGroup;

export interface LoadItem extends TimelineItemBase<number> {
  id: LoadId;
  group: DriverId;
  title: string;
  start_time: number;
  end_time: number;
  tooltip: string;
  load: Load;
  state: LoadState;
  supply: SupplyPlan;
  locked: boolean;
  dimmed: boolean;
}

const SECTIONS: { kind: FleetKind; title: string }[] = [
  { kind: "company", title: "Company fleet" },
  { kind: "carrier", title: "Common carriers" },
];

/** Drivers grouped under grey section rows, like the fleet groupings on DashFuel's board. */
export function buildGroups(drivers: readonly Driver[], schedules: ScheduleIndex, now: number): BoardGroup[] {
  return SECTIONS.flatMap(({ kind, title }) => {
    const members = drivers.filter((driver) => driver.kind === kind);
    if (members.length === 0) return [];
    const section: SectionGroup = {
      kind: "section",
      id: `section:${kind}`,
      title,
      count: members.length,
      height: SECTION_HEIGHT,
    };
    return [
      section,
      ...members.map<DriverGroup>((driver) => ({
        kind: "driver",
        id: driver.id,
        title: driver.name,
        driver,
        current: schedules.get(driver.id)?.find((load) => load.start <= now && now < load.end),
      })),
    ];
  });
}

export function buildItems(
  loads: readonly Load[],
  drivers: ReadonlyMap<DriverId, Driver>,
  terminals: ReadonlyMap<TerminalId, Terminal>,
  now: number,
  matches: ReadonlySet<LoadId> | null
): LoadItem[] {
  const items: LoadItem[] = [];
  for (const load of loads) {
    if (load.driverId === null) continue;
    const state = getLoadState(load, now);
    const supply = resolveSupply(load, terminals);
    const locked = isLocked(load, now);
    const supplyLine = supply.terminal
      ? `${supply.terminal.name}${supply.usingBackup ? " (backup)" : ""}`
      : "No supply point available";
    items.push({
      id: load.id,
      group: load.driverId,
      title: load.title,
      start_time: load.start,
      end_time: load.end,
      canMove: !locked,
      canResize: locked ? false : "both",
      canChangeGroup: !locked,
      tooltip: [
        load.title,
        `${drivers.get(load.driverId)?.name ?? "Unknown driver"} · ${state.label}`,
        formatWindow(load.start, load.end),
        `${PRODUCTS[load.product]} · ${formatGallons(load.gallons)}`,
        `Supply: ${supplyLine}`,
        locked ? "Read-only: this load has started" : "Drag to reschedule · double-click to edit",
      ].join("\n"),
      load,
      state,
      supply,
      locked,
      dimmed: matches !== null && !matches.has(load.id),
    });
  }
  return items;
}

/**
 * Keeps drags and resizes inside the rules while the pointer moves: never into
 * the past, never longer than 24 hours, never shorter than one snap step.
 * Overlaps are allowed mid-gesture (and shown in red) but rejected on drop.
 */
export function clampGesture(
  action: "move" | "resize",
  item: TimelineItemBase<number>,
  time: number,
  edge?: "left" | "right" | null
): number {
  const earliest = nextBookableStart(Date.now());
  if (action === "move") return Math.max(time, earliest);
  if (edge === "left") {
    return Math.min(Math.max(time, earliest, item.end_time - MAX_LOAD_DURATION), item.end_time - SNAP);
  }
  return Math.max(Math.min(time, item.start_time + MAX_LOAD_DURATION), item.start_time + SNAP);
}

/**
 * The window a drag across empty time selects, held to the same rules as the
 * gestures above: quarter hours, never before `earliest`, 15 minutes to 24
 * hours. The press stays put and the pointer moves the other edge, so dragging
 * left of the press sets the start instead of the end.
 */
export function dragWindow(press: number, pointer: number, earliest: number): TimeSlot {
  const fixed = snapNearest(press);
  const moving = snapNearest(pointer);
  if (moving >= fixed) {
    const start = Math.max(fixed, earliest);
    return { start, end: Math.min(Math.max(moving, start + SNAP), start + MAX_LOAD_DURATION) };
  }
  const end = Math.max(fixed, earliest + SNAP);
  return { start: Math.max(moving, earliest, end - MAX_LOAD_DURATION), end };
}
