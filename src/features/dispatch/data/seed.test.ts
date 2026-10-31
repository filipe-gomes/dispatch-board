import { describe, expect, it } from "vitest";
import { MAX_LOAD_DURATION, validateTitle } from "../domain/rules";
import { buildScheduleIndex, overlaps } from "../domain/schedule";
import { getLoadState } from "../domain/status";
import { NOW } from "../test/factories";
import { createSeedState } from "./seed";

describe("createSeedState", () => {
  const state = createSeedState(NOW);
  const drivers = new Map(state.drivers.map((driver) => [driver.id, driver]));

  it("is deterministic for a given time", () => {
    expect(createSeedState(NOW)).toEqual(state);
  });

  it("only produces loads that satisfy the board's rules", () => {
    for (const load of state.loads) {
      expect(validateTitle(load.title), load.title).toBeUndefined();
      expect(load.end - load.start).toBeGreaterThan(0);
      expect(load.end - load.start).toBeLessThanOrEqual(MAX_LOAD_DURATION);
      if (load.driverId) expect(load.gallons).toBeLessThanOrEqual(drivers.get(load.driverId)!.capacityGallons);
    }
  });

  it("never double-books a driver", () => {
    for (const schedule of buildScheduleIndex(state.loads).values()) {
      schedule.forEach((load, i) => {
        if (i > 0) expect(overlaps(schedule[i - 1], load)).toBe(false);
      });
    }
  });

  it("covers every status the board can show", () => {
    const statuses = new Set(state.loads.map((load) => getLoadState(load, NOW).status));
    for (const status of ["unassigned", "draft", "dispatched", "in-progress", "delivered"]) {
      expect(statuses).toContain(status);
    }
  });

  it("includes a load that crosses midnight", () => {
    expect(state.loads.some((load) => new Date(load.start).getUTCDate() !== new Date(load.end - 1).getUTCDate())).toBe(
      true
    );
  });
});
