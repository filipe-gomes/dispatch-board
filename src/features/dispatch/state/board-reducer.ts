import type { Driver, Load, LoadId, Terminal, TerminalId } from "../domain/types";

export interface SupplyDefaults {
  primaryTerminalId: TerminalId;
  backupTerminalId: TerminalId | null;
}

export interface BoardState {
  version: 1;
  drivers: Driver[];
  terminals: Terminal[];
  loads: Load[];
  /** Supply points pre-selected for new loads. */
  defaults: SupplyDefaults;
}

export type BoardAction =
  | { type: "loadSaved"; load: Load }
  | { type: "loadRemoved"; id: LoadId }
  | { type: "terminalToggled"; id: TerminalId; available: boolean }
  | { type: "defaultsChanged"; defaults: SupplyDefaults }
  | { type: "boardReplaced"; state: BoardState };

/**
 * Pure state transitions. Business rules are enforced before an action is
 * dispatched (see `useLoadCommands`), so the reducer never has to reject one.
 */
export function boardReducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case "loadSaved": {
      const exists = state.loads.some((load) => load.id === action.load.id);
      return {
        ...state,
        loads: exists
          ? state.loads.map((load) => (load.id === action.load.id ? action.load : load))
          : [...state.loads, action.load],
      };
    }
    case "loadRemoved":
      return { ...state, loads: state.loads.filter((load) => load.id !== action.id) };
    case "terminalToggled":
      return {
        ...state,
        terminals: state.terminals.map((terminal) =>
          terminal.id === action.id ? { ...terminal, available: action.available } : terminal
        ),
      };
    case "defaultsChanged":
      return { ...state, defaults: action.defaults };
    case "boardReplaced":
      return action.state;
  }
}
