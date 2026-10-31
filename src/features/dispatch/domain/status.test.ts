import { describe, expect, it } from "vitest";
import { at, load, NOW } from "../test/factories";
import { deriveAlerts } from "./alerts";
import { getLoadState, resolveSupply } from "./status";
import { HOUR, MINUTE } from "./time";
import type { Terminal } from "./types";

const terminals = (outIds: string[] = []) =>
  new Map<string, Terminal>(
    ["north", "harbor"].map((id) => [
      id,
      { id, name: id === "north" ? "North Rack" : "Harbor Point", available: !outIds.includes(id) },
    ])
  );

describe("getLoadState", () => {
  it.each([
    [{ driverId: null }, "unassigned"],
    [{ driverId: null, start: NOW - HOUR }, "overdue"],
    [{ dispatchedAt: null }, "draft"],
    [{ dispatchedAt: at(9, 10) }, "dispatched"],
    [{ dispatchedAt: at(9, 10), start: NOW - 4 * HOUR, end: NOW - HOUR }, "delivered"],
    [{ dispatchedAt: null, start: NOW - HOUR, end: NOW + HOUR }, "missed"],
  ] as const)("%o → %s", (overrides, status) => {
    expect(getLoadState(load(overrides), NOW).status).toBe(status);
  });

  it("reports the delivery stage and progress of an active load", () => {
    const active = load({ dispatchedAt: at(9, 10), start: NOW - HOUR, end: NOW + HOUR });
    expect(getLoadState(active, NOW)).toEqual({ status: "in-progress", label: "En route to site", progress: 0.5 });
  });
});

describe("resolveSupply", () => {
  const scheduled = load({ primaryTerminalId: "north", backupTerminalId: "harbor" });

  it("uses the primary terminal while it is available", () => {
    expect(resolveSupply(scheduled, terminals())).toMatchObject({ terminal: { id: "north" }, usingBackup: false });
  });

  it("falls back to the backup when the primary is out", () => {
    expect(resolveSupply(scheduled, terminals(["north"]))).toMatchObject({
      terminal: { id: "harbor" },
      usingBackup: true,
    });
  });

  it("reports no supply when both are out", () => {
    expect(resolveSupply(scheduled, terminals(["north", "harbor"])).terminal).toBeUndefined();
  });
});

describe("deriveAlerts", () => {
  it("flags drafts that start soon as forgotten loads", () => {
    const soon = load({ start: NOW + 45 * MINUTE, end: NOW + 3 * HOUR });
    const later = load({ start: NOW + 5 * HOUR, end: NOW + 7 * HOUR });
    const alerts = deriveAlerts([soon, later], terminals(), NOW);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ loadId: soon.id, severity: "warning", action: "dispatch" });
  });

  it("flags unassigned loads that start soon, and overdue ones as critical", () => {
    const soon = load({ driverId: null, start: NOW + HOUR, end: NOW + 3 * HOUR });
    const overdue = load({ driverId: null, start: NOW - HOUR, end: NOW + HOUR });
    const alerts = deriveAlerts([soon, overdue], terminals(), NOW);
    expect(alerts.map((alert) => [alert.loadId, alert.severity])).toEqual([
      [overdue.id, "critical"],
      [soon.id, "warning"],
    ]);
  });

  it("flags upcoming loads whose terminals are out", () => {
    const rerouted = load({ dispatchedAt: at(9, 10), start: NOW + 5 * HOUR, end: NOW + 7 * HOUR });
    expect(deriveAlerts([rerouted], terminals(["north"]), NOW)[0]).toMatchObject({ severity: "info" });
    expect(deriveAlerts([rerouted], terminals(["north", "harbor"]), NOW)[0]).toMatchObject({ severity: "critical" });
  });

  it("only raises supply alerts for the next two days", () => {
    const later = load({ dispatchedAt: at(9, 10), start: NOW + 72 * HOUR, end: NOW + 74 * HOUR });
    expect(deriveAlerts([later], terminals(["north", "harbor"]), NOW)).toEqual([]);
  });

  it("explains a missing backup terminal", () => {
    const noBackup = load({
      dispatchedAt: at(9, 10),
      backupTerminalId: null,
      start: NOW + 5 * HOUR,
      end: NOW + 7 * HOUR,
    });
    expect(deriveAlerts([noBackup], terminals(["north"]), NOW)[0].description).toMatch(/no backup is set/);
  });

  it("stays quiet for healthy loads", () => {
    const healthy = load({ dispatchedAt: at(9, 10), start: NOW + HOUR, end: NOW + 2 * HOUR });
    expect(deriveAlerts([healthy], terminals(), NOW)).toEqual([]);
  });
});
