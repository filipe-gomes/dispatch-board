import { buildScheduleIndex } from "../domain/schedule";
import type { ValidationContext } from "../domain/rules";
import type { Driver, Load, LoadInput } from "../domain/types";

/** 2026-08-10 12:00 UTC: a fixed "now" for every test. */
export const NOW = Date.UTC(2026, 7, 10, 12, 0);
export const at = (day: number, hour: number, minute = 0) => Date.UTC(2026, 7, day, hour, minute);

export const driver = (overrides: Partial<Driver> = {}): Driver => ({
  id: "maria",
  name: "Maria Lopez",
  kind: "company",
  truck: "Tanker T-102",
  capacityGallons: 9_000,
  ...overrides,
});

let sequence = 0;
export const load = (overrides: Partial<Load> = {}): Load => ({
  id: `load-${++sequence}`,
  title: "QuickStop #31",
  driverId: "maria",
  start: at(10, 14),
  end: at(10, 16),
  product: "diesel",
  gallons: 8_000,
  primaryTerminalId: "north",
  backupTerminalId: "harbor",
  dispatchedAt: null,
  createdAt: at(9, 9),
  updatedAt: at(9, 9),
  ...overrides,
});

export const input = (overrides: Partial<LoadInput> = {}): LoadInput => ({
  title: "Harbor Marina Fuel Dock",
  driverId: "maria",
  start: at(10, 18),
  end: at(10, 20),
  product: "regular",
  gallons: 7_500,
  primaryTerminalId: "north",
  backupTerminalId: null,
  ...overrides,
});

export function context(loads: Load[] = [], overrides: Partial<ValidationContext> = {}): ValidationContext {
  const drivers = [
    driver(),
    driver({ id: "james", name: "James Carter" }),
    driver({ id: "tom", name: "Tom Nguyen", capacityGallons: 3_000 }),
  ];
  return {
    now: NOW,
    drivers: new Map(drivers.map((d) => [d.id, d])),
    schedules: buildScheduleIndex(loads),
    ...overrides,
  };
}
