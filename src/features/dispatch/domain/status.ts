import type { Load, Terminal, TerminalId } from "./types";

export type LoadStatus =
  | "unassigned" // waiting in the queue
  | "overdue" // still unassigned after its requested start
  | "draft" // assigned, not yet sent to the driver
  | "dispatched" // sent to the driver, not started
  | "in-progress"
  | "delivered"
  | "missed"; // started without ever being dispatched

export interface LoadState {
  status: LoadStatus;
  label: string;
  /** 0–1 share of the delivery window that has elapsed. */
  progress: number;
}

/**
 * Stand-in for the driver app's live feed: an in-progress load reports the
 * stage implied by how far through its window it is.
 */
const DELIVERY_STAGES = [
  { until: 0.15, label: "Heading to terminal" },
  { until: 0.35, label: "Loading at rack" },
  { until: 0.85, label: "En route to site" },
  { until: 1, label: "Unloading at site" },
] as const;

const STATUS_LABELS: Record<Exclude<LoadStatus, "in-progress">, string> = {
  unassigned: "Unassigned",
  overdue: "Overdue",
  draft: "Draft",
  dispatched: "Dispatched",
  delivered: "Delivered",
  missed: "Not dispatched",
};

export function getLoadState(load: Load, now: number): LoadState {
  const progress = Math.min(1, Math.max(0, (now - load.start) / (load.end - load.start)));

  if (load.driverId === null) {
    const status = now < load.start ? "unassigned" : "overdue";
    return { status, label: STATUS_LABELS[status], progress: 0 };
  }
  if (now < load.start) {
    const status = load.dispatchedAt === null ? "draft" : "dispatched";
    return { status, label: STATUS_LABELS[status], progress: 0 };
  }
  if (load.dispatchedAt === null) return { status: "missed", label: STATUS_LABELS.missed, progress };
  if (now >= load.end) return { status: "delivered", label: STATUS_LABELS.delivered, progress: 1 };

  const stage = DELIVERY_STAGES.find((candidate) => progress < candidate.until) ?? DELIVERY_STAGES.at(-1)!;
  return { status: "in-progress", label: stage.label, progress };
}

export interface SupplyPlan {
  terminal: Terminal | undefined;
  usingBackup: boolean;
}

/** Which terminal the driver should load at: the primary, else the backup when the primary is out. */
export function resolveSupply(load: Load, terminals: ReadonlyMap<TerminalId, Terminal>): SupplyPlan {
  const primary = terminals.get(load.primaryTerminalId);
  if (primary?.available) return { terminal: primary, usingBackup: false };
  const backup = load.backupTerminalId === null ? undefined : terminals.get(load.backupTerminalId);
  if (backup?.available) return { terminal: backup, usingBackup: true };
  return { terminal: undefined, usingBackup: false };
}
