import { formatRelative } from "./format";
import { getLoadState, resolveSupply } from "./status";
import { DAY, HOUR } from "./time";
import type { Load, LoadId, Terminal, TerminalId } from "./types";

/** How far ahead a load that still needs action counts as "forgotten". */
export const ATTENTION_WINDOW = 2 * HOUR;
/** Terminal outages are usually short, so only near-term supply problems raise alerts. */
export const SUPPLY_WINDOW = 2 * DAY;

export type AlertSeverity = "critical" | "warning" | "info";
export type AlertAction = "dispatch" | "assign" | "open";

export interface DispatchAlert {
  id: string;
  loadId: LoadId;
  severity: AlertSeverity;
  title: string;
  description: string;
  action: AlertAction;
  at: number;
}

const SEVERITY_RANK: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };

/** Alerts that need a dispatcher to act; informational ones (like reroutes) don't count. */
export const isActionable = (alert: DispatchAlert) => alert.severity !== "info";

export function deriveAlerts(
  loads: readonly Load[],
  terminals: ReadonlyMap<TerminalId, Terminal>,
  now: number
): DispatchAlert[] {
  const alerts: DispatchAlert[] = [];
  const push = (kind: string, load: Load, alert: Omit<DispatchAlert, "id" | "loadId" | "at">) =>
    alerts.push({ ...alert, id: `${kind}:${load.id}`, loadId: load.id, at: load.start });

  for (const load of loads) {
    const { status } = getLoadState(load, now);
    const startsIn = load.start - now;
    const when = formatRelative(load.start, now);

    if (status === "overdue") {
      push("overdue", load, {
        severity: "critical",
        title: `${load.title} has no driver`,
        description: `Requested ${when}. Reschedule or assign it.`,
        action: "assign",
      });
    } else if (status === "unassigned" && startsIn <= ATTENTION_WINDOW) {
      push("unassigned", load, {
        severity: "warning",
        title: `${load.title} needs a driver`,
        description: `Requested start ${when}.`,
        action: "assign",
      });
    } else if (status === "draft" && startsIn <= ATTENTION_WINDOW) {
      push("draft", load, {
        severity: "warning",
        title: `${load.title} isn't dispatched`,
        description: `Starts ${when} and the driver hasn't received it.`,
        action: "dispatch",
      });
    } else if (status === "missed" && now < load.end) {
      push("missed", load, {
        severity: "critical",
        title: `${load.title} started without dispatch`,
        description: `Started ${when}. Contact the driver.`,
        action: "open",
      });
    }

    if ((status === "draft" || status === "dispatched") && startsIn <= SUPPLY_WINDOW) {
      const supply = resolveSupply(load, terminals);
      const primary = terminals.get(load.primaryTerminalId)?.name ?? "The primary terminal";
      if (!supply.terminal) {
        push("supply", load, {
          severity: "critical",
          title: `${load.title} has no supply point`,
          description:
            load.backupTerminalId === null
              ? `${primary} is out and no backup is set. Starts ${when}.`
              : `Primary and backup terminals are both out. Starts ${when}.`,
          action: "open",
        });
      } else if (supply.usingBackup) {
        push("backup", load, {
          severity: "info",
          title: `${load.title} rerouted`,
          description: `${primary} is out, so the driver loads at ${supply.terminal.name}.`,
          action: "open",
        });
      }
    }
  }

  return alerts.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.at - b.at);
}
