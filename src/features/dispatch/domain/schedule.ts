import { HOUR, snapUp } from "./time";
import type { Driver, DriverId, Load, LoadId } from "./types";

export interface TimeSlot {
  start: number;
  end: number;
}

/** Each driver's loads, sorted by start time. Built once per change instead of scanning every load per check. */
export type ScheduleIndex = ReadonlyMap<DriverId, readonly Load[]>;

/** Half-open intervals: a load ending at 2:00 PM does not overlap one starting at 2:00 PM. */
export const overlaps = (a: TimeSlot, b: TimeSlot) => a.start < b.end && b.start < a.end;

export function buildScheduleIndex(loads: readonly Load[]): ScheduleIndex {
  const index = new Map<DriverId, Load[]>();
  for (const load of loads) {
    if (load.driverId === null) continue;
    const schedule = index.get(load.driverId);
    if (schedule) schedule.push(load);
    else index.set(load.driverId, [load]);
  }
  for (const schedule of index.values()) schedule.sort((a, b) => a.start - b.start);
  return index;
}

export function findConflict(
  schedule: readonly Load[] | undefined,
  slot: TimeSlot,
  ignoreId?: LoadId
): Load | undefined {
  if (!schedule) return undefined;
  for (const load of schedule) {
    // Sorted by start, so nothing after this point can overlap.
    if (load.start >= slot.end) break;
    if (load.id !== ignoreId && overlaps(load, slot)) return load;
  }
  return undefined;
}

/** Earliest quarter-hour start at or after `from` where a load of `duration` fits the driver's schedule. */
export function findNextOpenStart(
  schedule: readonly Load[] | undefined,
  duration: number,
  from: number,
  ignoreId?: LoadId
): number {
  let start = snapUp(from);
  for (const load of schedule ?? []) {
    if (load.id === ignoreId || load.end <= start) continue;
    if (load.start >= start + duration) break;
    start = snapUp(load.end);
  }
  return start;
}

/** Drivers who are free for the whole slot and whose truck can carry the load. */
export function findAvailableDrivers(
  drivers: readonly Driver[],
  index: ScheduleIndex,
  slot: TimeSlot,
  gallons: number,
  ignoreId?: LoadId
): Driver[] {
  return drivers.filter(
    (driver) => driver.capacityGallons >= gallons && !findConflict(index.get(driver.id), slot, ignoreId)
  );
}

export interface AssignmentSuggestion {
  driver: Driver;
  start: number;
}

/**
 * Picks the driver who can take the load soonest (never before `earliest`),
 * breaking ties by the lightest schedule so work spreads across the fleet.
 */
export function suggestAssignment(
  drivers: readonly Driver[],
  index: ScheduleIndex,
  load: Pick<Load, "id" | "start" | "end" | "gallons">,
  earliest: number
): AssignmentSuggestion | null {
  const duration = load.end - load.start;
  const from = Math.max(load.start, earliest);
  let best: (AssignmentSuggestion & { workload: number }) | null = null;

  for (const driver of drivers) {
    if (driver.capacityGallons < load.gallons) continue;
    const schedule = index.get(driver.id);
    const start = findNextOpenStart(schedule, duration, from, load.id);
    const shift = { start: start - 12 * HOUR, end: start + 12 * HOUR };
    const workload = schedule?.filter((other) => overlaps(other, shift)).length ?? 0;
    if (!best || start < best.start || (start === best.start && workload < best.workload)) {
      best = { driver, start, workload };
    }
  }

  return best && { driver: best.driver, start: best.start };
}
