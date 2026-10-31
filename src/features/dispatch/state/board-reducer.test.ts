import { describe, expect, it } from "vitest";
import { load } from "../test/factories";
import { boardReducer, type BoardState } from "./board-reducer";

const state = (overrides: Partial<BoardState> = {}): BoardState => ({
  version: 1,
  drivers: [],
  terminals: [{ id: "north", name: "North Rack", available: true }],
  loads: [],
  defaults: { primaryTerminalId: "north", backupTerminalId: null },
  ...overrides,
});

describe("boardReducer", () => {
  it("adds new loads and replaces existing ones by id", () => {
    const original = load();
    const added = boardReducer(state(), { type: "loadSaved", load: original });
    expect(added.loads).toEqual([original]);

    const renamed = { ...original, title: "Renamed load" };
    expect(boardReducer(added, { type: "loadSaved", load: renamed }).loads).toEqual([renamed]);
  });

  it("removes loads", () => {
    const doomed = load();
    expect(boardReducer(state({ loads: [doomed] }), { type: "loadRemoved", id: doomed.id }).loads).toEqual([]);
  });

  it("toggles terminal availability without touching other state", () => {
    const before = state();
    const after = boardReducer(before, { type: "terminalToggled", id: "north", available: false });
    expect(after.terminals[0].available).toBe(false);
    expect(after.loads).toBe(before.loads);
  });
});
