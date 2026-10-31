import { formatGallons, formatWindow } from "./format";
import { findConflict, type ScheduleIndex } from "./schedule";
import { DAY } from "./time";
import type { Driver, DriverId, Load, LoadInput } from "./types";

export const TITLE_MIN_LENGTH = 5;
export const TITLE_MAX_LENGTH = 35;
/** Loads may cross midnight, but never run longer than a day. */
export const MAX_LOAD_DURATION = DAY;

export type LoadErrorKey = keyof LoadInput | "locked" | "conflict";
export type LoadErrors = Partial<Record<LoadErrorKey, string>>;

/**
 * Past and in-progress loads are read-only. Unassigned loads are not on the
 * timeline yet, so an overdue one can still be rescheduled from the queue.
 */
export const isLocked = (load: Pick<Load, "driverId" | "start">, now: number) =>
  load.driverId !== null && load.start <= now;

export function validateTitle(title: string): string | undefined {
  const length = title.trim().length;
  if (length < TITLE_MIN_LENGTH) return `Use at least ${TITLE_MIN_LENGTH} characters.`;
  if (length > TITLE_MAX_LENGTH) return `Use ${TITLE_MAX_LENGTH} characters or fewer.`;
  return undefined;
}

export interface ValidationContext {
  now: number;
  drivers: ReadonlyMap<DriverId, Driver>;
  schedules: ScheduleIndex;
  /** The load being edited, if any. */
  original?: Load;
}

export interface ValidationResult {
  valid: boolean;
  errors: LoadErrors;
  conflict?: Load;
}

export function validateLoad(
  input: LoadInput,
  { now, drivers, schedules, original }: ValidationContext
): ValidationResult {
  if (original && isLocked(original, now)) {
    return {
      valid: false,
      errors: { locked: "This load has already started. Past and in-progress loads can't be changed." },
    };
  }

  const errors: LoadErrors = {};

  const titleError = validateTitle(input.title);
  if (titleError) errors.title = titleError;

  const hasStart = Number.isFinite(input.start);
  const hasEnd = Number.isFinite(input.end);
  if (!hasStart) errors.start = "Choose a start date and time.";
  else if (input.start <= now) errors.start = "Start time must be in the future.";
  if (!hasEnd) errors.end = "Choose an end date and time.";
  else if (hasStart && input.end <= input.start) errors.end = "End time must be after the start time.";
  else if (hasStart && input.end - input.start > MAX_LOAD_DURATION) errors.end = "A load can last at most 24 hours.";

  const driver = input.driverId === null ? undefined : drivers.get(input.driverId);
  if (input.driverId !== null && !driver) errors.driverId = "Choose a driver or carrier.";

  if (!Number.isInteger(input.gallons) || input.gallons <= 0) {
    errors.gallons = "Enter the gallons to deliver.";
  } else if (driver && input.gallons > driver.capacityGallons) {
    errors.gallons = `${driver.name}'s truck holds ${formatGallons(driver.capacityGallons)}.`;
  }

  if (input.backupTerminalId !== null && input.backupTerminalId === input.primaryTerminalId) {
    errors.backupTerminalId = "Pick a different terminal than the primary.";
  }

  let conflict: Load | undefined;
  if (driver && !errors.start && !errors.end) {
    conflict = findConflict(schedules.get(driver.id), input, original?.id);
    if (conflict) {
      errors.conflict = `${driver.name} already has “${conflict.title}” (${formatWindow(conflict.start, conflict.end)}).`;
    }
  }

  return { valid: Object.keys(errors).length === 0, errors, conflict };
}

/** The most useful single message for a toast, e.g. after a rejected drag. */
export function primaryError(errors: LoadErrors): string | undefined {
  return errors.locked ?? errors.conflict ?? errors.start ?? errors.end ?? errors.gallons ?? Object.values(errors)[0];
}

/** A few words for tight spaces, like the label on a load being dragged across the timeline. */
export function shortProblem(input: LoadInput, { errors, conflict }: ValidationResult): string | null {
  if (errors.locked) return "Read-only";
  if (conflict) return `Overlaps ${conflict.title}`;
  if (errors.start) return "Can't start in the past";
  if (errors.end) return input.end - input.start > MAX_LOAD_DURATION ? "Over 24 hours" : "Ends before it starts";
  if (errors.gallons) return "Truck too small";
  if (errors.driverId) return "Pick a driver";
  return primaryError(errors) ?? null;
}
