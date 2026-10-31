import dayjs from "dayjs";
import { overlaps } from "../domain/schedule";
import { HOUR, MINUTE, SNAP, snapDown, snapUp } from "../domain/time";
import type { Driver, Load, ProductCode, Terminal } from "../domain/types";
import type { BoardState } from "../state/board-reducer";

export const SEED_DRIVERS: Driver[] = [
  { id: "maria-lopez", name: "Maria Lopez", kind: "company", truck: "Tanker T-102", capacityGallons: 9_200 },
  { id: "james-carter", name: "James Carter", kind: "company", truck: "Tanker T-104", capacityGallons: 9_200 },
  { id: "aisha-patel", name: "Aisha Patel", kind: "company", truck: "Tanker T-107", capacityGallons: 8_800 },
  { id: "tom-nguyen", name: "Tom Nguyen", kind: "company", truck: "Bobtail B-21", capacityGallons: 3_000 },
  { id: "luis-romero", name: "Luis Romero", kind: "company", truck: "Tanker T-110", capacityGallons: 9_200 },
  { id: "grace-kim", name: "Grace Kim", kind: "company", truck: "Tanker T-115", capacityGallons: 9_000 },
  { id: "summit-fuel", name: "Summit Fuel Carriers", kind: "carrier", truck: "Common carrier", capacityGallons: 9_500 },
  { id: "iron-horse", name: "Iron Horse Logistics", kind: "carrier", truck: "Common carrier", capacityGallons: 9_500 },
];

export const SEED_TERMINALS: Terminal[] = [
  { id: "north-rack", name: "North Rack Terminal", available: true },
  { id: "harbor-point", name: "Harbor Point Terminal", available: true },
  { id: "riverside", name: "Riverside Supply", available: true },
  { id: "eastgate", name: "Eastgate Rack", available: true },
];

const SITES = [
  "Gas-N-Go #112",
  "Sunrise Mart #7",
  "Harbor Marina Fuel Dock",
  "County DPW Garage",
  "Valley Farms Co-op",
  "Metro Transit Depot",
  "Pine Ridge Quarry",
  "QuickStop #31",
  "Northside Truck Plaza",
  "Fast Lane #18",
  "Riverside Hospital",
  "Oak Hill Golf Club",
  "Airport FBO Hangar 3",
  "Maple Ave Express",
  "Lakeview Travel Center",
  "Bayside Fleet Yard",
  "Cedar Grove School Buses",
  "Hilltop Market #4",
  "Route 9 Fuel Stop",
  "Greenfield Farms",
  "Westgate Car Wash",
  "City Water Plant",
  "Summit Ski Lodge",
  "Crossroads Diner",
];

const PRODUCT_WEIGHTS: [ProductCode, number][] = [
  ["regular", 0.34],
  ["diesel", 0.24],
  ["premium", 0.12],
  ["midgrade", 0.1],
  ["dyedDiesel", 0.1],
  ["biodiesel", 0.1],
];

/** Small deterministic PRNG (mulberry32) so the demo board looks the same on every reset. */
function createRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSeedState(now: number): BoardState {
  const random = createRandom(20261031);
  const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)];
  const quarters = (min: number, max: number) => (min + Math.floor(random() * (max - min + 1))) * SNAP;
  const today = dayjs(now).startOf("day");
  const loads: Load[] = [];
  let sequence = 0;

  const pickProduct = () => {
    let roll = random();
    for (const [product, weight] of PRODUCT_WEIGHTS) {
      roll -= weight;
      if (roll <= 0) return product;
    }
    return "regular";
  };

  /** Adds the load unless it would double-book the driver, mirroring the board's own rules. */
  const add = (driver: Driver | null, start: number, end: number, options: { dispatched?: boolean } = {}) => {
    if (driver && loads.some((load) => load.driverId === driver.id && overlaps(load, { start, end }))) return;
    const capacity = driver?.capacityGallons ?? 9_000;
    const gallons = Math.round((capacity * (0.55 + random() * 0.45)) / 100) * 100;
    const primary = pick(SEED_TERMINALS);
    const backup = random() < 0.7 ? pick(SEED_TERMINALS.filter((terminal) => terminal !== primary)) : null;
    const dispatched = options.dispatched ?? (start <= now || random() < (start - now < 36 * HOUR ? 0.85 : 0.45));
    const createdAt = Math.min(start, now) - quarters(8, 96);
    loads.push({
      id: `seed-${++sequence}`,
      title: pick(SITES),
      driverId: driver?.id ?? null,
      start,
      end,
      product: pickProduct(),
      gallons,
      primaryTerminalId: primary.id,
      backupTerminalId: backup?.id ?? null,
      dispatchedAt: driver && dispatched ? createdAt + 30 * MINUTE : null,
      createdAt,
      updatedAt: createdAt,
    });
  };

  const [maria, james, aisha, , luis, , summit] = SEED_DRIVERS;

  // Anchors first, so the demo always shows live work, a forgotten draft and an overnight run.
  add(maria, snapDown(now - 80 * MINUTE), snapUp(now + 100 * MINUTE), { dispatched: true });
  add(james, snapDown(now - 30 * MINUTE), snapUp(now + 3 * HOUR), { dispatched: true });
  add(summit, snapDown(now - 3 * HOUR), snapUp(now + 45 * MINUTE), { dispatched: true });
  add(aisha, snapUp(now + 70 * MINUTE), snapUp(now + 70 * MINUTE) + 2.5 * HOUR, { dispatched: false });
  const overnight = today.add(1, "day").hour(21).valueOf();
  add(luis, overnight, overnight + 6 * HOUR, { dispatched: true });

  for (const driver of SEED_DRIVERS) {
    const isBobtail = driver.capacityGallons < 5_000;
    for (let offset = -2; offset <= 9; offset++) {
      if (random() < (driver.kind === "carrier" ? 0.4 : 0.12)) continue;
      const day = today.add(offset, "day");
      const lastEnd = day.add(22, "hour").valueOf();
      let cursor = day.add(5, "hour").valueOf() + quarters(0, 10);
      const runs = isBobtail ? 4 : 2 + Math.floor(random() * 2);
      for (let run = 0; run < runs; run++) {
        const end = cursor + (isBobtail ? quarters(5, 9) : quarters(8, 20));
        if (end > lastEnd) break;
        add(driver, cursor, end);
        cursor = end + quarters(2, 7);
      }
    }
  }

  // The unassigned queue: one due soon (raises a "needs a driver" alert), the rest later this week.
  for (const hoursOut of [1.5, 5, 26, 30, 52, 75]) {
    const start = snapUp(now + hoursOut * HOUR);
    add(null, start, start + quarters(8, 14));
  }

  return {
    version: 1,
    drivers: SEED_DRIVERS,
    terminals: SEED_TERMINALS,
    loads,
    defaults: { primaryTerminalId: "north-rack", backupTerminalId: "harbor-point" },
  };
}
