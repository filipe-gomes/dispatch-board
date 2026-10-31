export type DriverId = string;
export type LoadId = string;
export type TerminalId = string;

export const PRODUCTS = {
  regular: "Regular 87",
  midgrade: "Midgrade 89",
  premium: "Premium 93",
  diesel: "Diesel ULSD",
  dyedDiesel: "Dyed diesel",
  biodiesel: "Biodiesel B20",
} as const;

export type ProductCode = keyof typeof PRODUCTS;

export const PRODUCT_CODES = Object.keys(PRODUCTS) as ProductCode[];

export type FleetKind = "company" | "carrier";

export interface Driver {
  id: DriverId;
  name: string;
  kind: FleetKind;
  truck: string;
  capacityGallons: number;
}

/** A rack or supplier terminal where trucks load product. */
export interface Terminal {
  id: TerminalId;
  name: string;
  available: boolean;
}

export interface Load {
  id: LoadId;
  title: string;
  /** `null` while the load waits in the unassigned queue. */
  driverId: DriverId | null;
  start: number;
  end: number;
  product: ProductCode;
  gallons: number;
  primaryTerminalId: TerminalId;
  backupTerminalId: TerminalId | null;
  /** When the load was sent to the driver's app; `null` while it is a draft. */
  dispatchedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

/** The fields a dispatcher controls when creating or editing a load. */
export type LoadInput = Pick<
  Load,
  "title" | "driverId" | "start" | "end" | "product" | "gallons" | "primaryTerminalId" | "backupTerminalId"
>;

export const toLoadInput = ({
  title,
  driverId,
  start,
  end,
  product,
  gallons,
  primaryTerminalId,
  backupTerminalId,
}: Load): LoadInput => ({ title, driverId, start, end, product, gallons, primaryTerminalId, backupTerminalId });
