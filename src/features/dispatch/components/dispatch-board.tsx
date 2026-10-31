"use client";

import dayjs from "dayjs";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { deriveAlerts, isActionable } from "../domain/alerts";
import { formatWindow } from "../domain/format";
import { shortProblem } from "../domain/rules";
import { findAvailableDrivers, findNextOpenStart } from "../domain/schedule";
import { getLoadState } from "../domain/status";
import { HOUR, nextBookableStart, snapUp } from "../domain/time";
import {
  type DriverId,
  type Load,
  type LoadId,
  type LoadInput,
  PRODUCTS,
  type TerminalId,
  toLoadInput,
} from "../domain/types";
import {
  centerViewOn,
  matchPreset,
  nowView,
  presetView,
  type RangePreset,
  shiftView,
  type TimelineView,
} from "../domain/view";
import { useActivityLog } from "../state/use-activity-log";
import { useBoardState } from "../state/use-board-state";
import { useKeyboardShortcuts } from "../state/use-keyboard-shortcuts";
import { useLoadCommands } from "../state/use-load-commands";
import { useMediaQuery } from "../state/use-media-query";
import { useNow } from "../state/use-now";
import { useStatusFeed } from "../state/use-status-feed";
import { AlertsPopover } from "./alerts-popover";
import { AppHeader, HEADER_HEIGHT, SEARCH_INPUT_ID } from "./app-header";
import { BoardLegend } from "./board-legend";
import { type BoardFilter, BoardToolbar } from "./board-toolbar";
import { DispatchTimeline } from "./dispatch-timeline";
import { type EditorState, LoadDialog } from "./load-dialog";
import { LoadDetails } from "./load-details";
import type { CheckSlot } from "./load-item";
import { ShortcutsDialog } from "./shortcuts-dialog";
import { SupplyPointsPopover } from "./supply-points-popover";
import { UnassignedQueue } from "./unassigned-queue";

const DESKTOP_QUERY = "(min-width: 1024px)";
const TABLET_QUERY = "(min-width: 640px)";
const DEFAULT_DURATION = 2 * HOUR;
const DEFAULT_GALLONS = 7_500;

/** Moves the view only when the load is off-screen, keeping the current zoom. */
const revealLoad = (view: TimelineView, load: Load) =>
  load.start < view.end && load.end > view.start ? view : centerViewOn(view, load.start);

export function DispatchBoard() {
  const [state, dispatch] = useBoardState();
  const now = useNow();
  const { entries: activity, log } = useActivityLog();
  const {
    drivers: driversById,
    terminals: terminalsById,
    loadsById,
    schedules,
    validate,
    saveLoad,
    moveLoad,
    resizeLoad,
    dispatchLoad,
    deleteLoad,
    autoAssign,
    setTerminalAvailability,
    setDefaults,
    resetBoard,
  } = useLoadCommands(state, dispatch, log);
  useStatusFeed(state.loads, state.drivers, now, log);

  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const isTablet = useMediaQuery(TABLET_QUERY);
  // Phones open on a few hours around now; the full day is one tap away.
  const [view, setView] = useState<TimelineView>(() =>
    window.matchMedia(TABLET_QUERY).matches ? presetView("day", Date.now()) : nowView(Date.now())
  );
  const [selectedId, setSelectedId] = useState<LoadId | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<BoardFilter>("all");
  const [queueOpen, setQueueOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [queueDrag, setQueueDrag] = useState<Load | null>(null);

  const alerts = useMemo(() => deriveAlerts(state.loads, terminalsById, now), [state.loads, terminalsById, now]);
  const flaggedIds = useMemo(() => new Set(alerts.filter(isActionable).map((alert) => alert.loadId)), [alerts]);
  const queue = useMemo(
    () => state.loads.filter((load) => load.driverId === null).sort((a, b) => a.start - b.start),
    [state.loads]
  );
  const selectedLoad = selectedId ? loadsById.get(selectedId) : undefined;

  /** Loads matching the search box and filter chips; the rest are dimmed on the board. */
  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term && filter === "all") return null;
    const result = new Set<LoadId>();
    for (const load of state.loads) {
      if (filter === "attention" && !flaggedIds.has(load.id)) continue;
      if (filter === "drafts" && getLoadState(load, now).status !== "draft") continue;
      const driverName = load.driverId ? (driversById.get(load.driverId)?.name ?? "") : "unassigned";
      const haystack = [load.title, driverName, PRODUCTS[load.product]].join(" ").toLowerCase();
      if (!term || haystack.includes(term)) result.add(load.id);
    }
    return result;
  }, [driversById, filter, flaggedIds, now, query, state.loads]);
  const visibleQueue = matches ? queue.filter((load) => matches.has(load.id)) : queue;

  const terminalUsage = useMemo(() => {
    const usage = new Map<TerminalId, number>();
    for (const load of state.loads) {
      const { status } = getLoadState(load, now);
      if (status !== "draft" && status !== "dispatched") continue;
      for (const id of [load.primaryTerminalId, load.backupTerminalId]) {
        if (id) usage.set(id, (usage.get(id) ?? 0) + 1);
      }
    }
    return usage;
  }, [now, state.loads]);

  /** Short reason a drag or drop would be rejected, using the same rules as saving. */
  const checkSlot = useCallback<CheckSlot>(
    ({ id, driverId, start, end }) => {
      const load = loadsById.get(id);
      if (!load) return null;
      const input = { ...toLoadInput(load), driverId, start, end };
      return shortProblem(input, validate(input, load));
    },
    [loadsById, validate]
  );

  const openCreate = useCallback(
    (overrides: Partial<LoadInput> = {}) => {
      const start = overrides.start ?? snapUp(Date.now() + HOUR);
      const end = overrides.end ?? start + DEFAULT_DURATION;
      const gallons = overrides.gallons ?? DEFAULT_GALLONS;
      // Pre-pick the first driver who is free, so most loads need only a title.
      const driverId =
        overrides.driverId !== undefined
          ? overrides.driverId
          : (findAvailableDrivers(state.drivers, schedules, { start, end }, gallons)[0]?.id ?? null);
      setEditor({
        mode: "create",
        key: crypto.randomUUID(),
        initial: {
          title: "",
          product: "regular",
          primaryTerminalId: state.defaults.primaryTerminalId,
          backupTerminalId: state.defaults.backupTerminalId,
          ...overrides,
          driverId,
          start,
          end,
          gallons,
        },
      });
    },
    [schedules, state.defaults, state.drivers]
  );

  const createAt = useCallback(
    (driverId: DriverId, time: number) => {
      const from = Math.max(time, nextBookableStart(Date.now()));
      const start = findNextOpenStart(schedules.get(driverId), DEFAULT_DURATION, from);
      const capacity = driversById.get(driverId)?.capacityGallons ?? DEFAULT_GALLONS;
      openCreate({ driverId, start, end: start + DEFAULT_DURATION, gallons: Math.min(DEFAULT_GALLONS, capacity) });
    },
    [driversById, openCreate, schedules]
  );

  const openEditor = useCallback((loadId: LoadId) => setEditor({ mode: "edit", key: crypto.randomUUID(), loadId }), []);

  /** Repeat deliveries: same driver and time of day, on the next day that is free. */
  const duplicate = useCallback(
    (load: Load) => {
      const duration = load.end - load.start;
      let next = dayjs(load.start).add(1, "day");
      while (next.valueOf() <= Date.now()) next = next.add(1, "day");
      const schedule = load.driverId ? schedules.get(load.driverId) : undefined;
      const start = findNextOpenStart(schedule, duration, next.valueOf());
      openCreate({ ...toLoadInput(load), start, end: start + duration });
    },
    [openCreate, schedules]
  );

  const remove = useCallback(
    (id: LoadId) => {
      deleteLoad(id);
      setEditor(null);
      setSelectedId((current) => (current === id ? null : current));
    },
    [deleteLoad]
  );

  const focusLoad = useCallback(
    (id: LoadId) => {
      const load = loadsById.get(id);
      if (!load) return;
      if (load.driverId === null) {
        openEditor(id);
        return;
      }
      setSelectedId(id);
      setView((current) => revealLoad(current, load));
    },
    [loadsById, openEditor]
  );

  const handleSubmit = useCallback(
    (input: LoadInput, { dispatchNow, original }: { dispatchNow: boolean; original?: Load }) => {
      const result = saveLoad(input, { original, dispatchNow });
      if (!result.ok) return result;
      const { load } = result;
      setEditor(null);
      if (load.driverId) {
        setSelectedId(load.id);
        setView((current) => revealLoad(current, load));
      }
      const headline = original
        ? "Load updated"
        : load.driverId === null
          ? "Added to the unassigned queue"
          : dispatchNow
            ? "Load created and dispatched"
            : "Draft saved";
      toast.success(headline, { description: `${load.title} · ${formatWindow(load.start, load.end)}` });
      return result;
    },
    [saveLoad]
  );

  const handleQueueDrop = useCallback(
    (id: LoadId, driverId: DriverId, start: number) => {
      setQueueDrag(null);
      moveLoad(id, start, driverId);
    },
    [moveLoad]
  );

  /** Back to now, keeping the zoom level: presets snap to today, custom zooms center on the current time. */
  const goToday = useCallback(
    () =>
      setView((current) => {
        const preset = matchPreset(current);
        return preset ? presetView(preset, Date.now()) : centerViewOn(current, Date.now());
      }),
    []
  );
  const step = useCallback((direction: 1 | -1) => setView((current) => shiftView(current, direction)), []);
  const choosePreset = useCallback(
    (preset: RangePreset) => setView((current) => presetView(preset, current.start)),
    []
  );
  const jumpTo = useCallback(
    (date: Date) => setView((current) => presetView(matchPreset(current) ?? "day", date.valueOf())),
    []
  );

  useKeyboardShortcuts(
    {
      n: () => openCreate(),
      "/": () => document.getElementById(SEARCH_INPUT_ID)?.focus(),
      t: goToday,
      ArrowLeft: () => step(-1),
      ArrowRight: () => step(1),
      Escape: () => setSelectedId(null),
      ...(selectedLoad && {
        e: () => openEditor(selectedLoad.id),
        d: () => dispatchLoad(selectedLoad.id),
        Delete: () => remove(selectedLoad.id),
        Backspace: () => remove(selectedLoad.id),
      }),
    },
    editor === null && !shortcutsOpen
  );

  const queuePanel = (
    <UnassignedQueue
      loads={visibleQueue}
      filtered={matches !== null}
      now={now}
      draggable={isDesktop}
      onAutoAssign={autoAssign}
      onSchedule={(id) => {
        setQueueOpen(false);
        openEditor(id);
      }}
      onDragStart={setQueueDrag}
      onDragEnd={() => setQueueDrag(null)}
    />
  );

  const details = selectedLoad && (
    <LoadDetails
      load={selectedLoad}
      driver={selectedLoad.driverId ? driversById.get(selectedLoad.driverId) : undefined}
      terminals={terminalsById}
      now={now}
      className={isDesktop ? undefined : "fixed inset-x-3 bottom-3 z-40 shadow-xl"}
      onEdit={() => openEditor(selectedLoad.id)}
      onDispatch={() => dispatchLoad(selectedLoad.id)}
      onDuplicate={() => duplicate(selectedLoad)}
      onDelete={() => remove(selectedLoad.id)}
      onClose={() => setSelectedId(null)}
    />
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="min-h-dvh bg-background">
        <AppHeader
          query={query}
          onQueryChange={setQuery}
          onShowShortcuts={() => setShortcutsOpen(true)}
          onReset={() => {
            setSelectedId(null);
            resetBoard();
          }}
          actions={
            <>
              <SupplyPointsPopover
                terminals={state.terminals}
                usage={terminalUsage}
                defaults={state.defaults}
                onToggle={setTerminalAvailability}
                onDefaultsChange={setDefaults}
              />
              <AlertsPopover
                alerts={alerts}
                activity={activity}
                now={now}
                onDispatch={dispatchLoad}
                onAutoAssign={autoAssign}
                onShow={focusLoad}
              />
            </>
          }
        />

        <main className="mx-auto flex max-w-[1680px] items-start gap-4 p-3 sm:p-4">
          <section
            aria-label="Dispatch board"
            className="min-w-0 flex-1 overflow-clip rounded-2xl border bg-card shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-16px_rgb(27_20_70/0.18)]"
          >
            <BoardToolbar
              view={view}
              compact={!isTablet}
              filter={filter}
              attentionCount={flaggedIds.size}
              queueCount={queue.length}
              showQueueButton={!isDesktop}
              onToday={goToday}
              onStep={step}
              onPreset={choosePreset}
              onJumpTo={jumpTo}
              onFilterChange={setFilter}
              onOpenQueue={() => setQueueOpen(true)}
              onNewLoad={() => openCreate()}
            />
            <DispatchTimeline
              drivers={state.drivers}
              driversById={driversById}
              terminals={terminalsById}
              loads={state.loads}
              schedules={schedules}
              now={now}
              matches={matches}
              view={view}
              selectedId={selectedId}
              sidebarWidth={isDesktop ? 224 : isTablet ? 184 : 116}
              stickyTop={HEADER_HEIGHT}
              queueDrag={queueDrag}
              checkSlot={checkSlot}
              onViewChange={setView}
              onSelect={setSelectedId}
              onOpen={openEditor}
              onCreateAt={createAt}
              onMove={moveLoad}
              onResize={resizeLoad}
              onQueueDrop={handleQueueDrop}
            />
            <BoardLegend />
          </section>

          {isDesktop && (
            <aside
              className="sticky flex w-80 shrink-0 flex-col gap-4 overflow-y-auto pb-1"
              style={{ top: HEADER_HEIGHT + 16, maxHeight: `calc(100dvh - ${HEADER_HEIGHT + 32}px)` }}
            >
              {details}
              <div className="rounded-2xl border bg-card p-4 shadow-sm">{queuePanel}</div>
            </aside>
          )}
        </main>

        {!isDesktop && details}

        <Sheet open={queueOpen && !isDesktop} onOpenChange={setQueueOpen}>
          <SheetContent
            side="right"
            className="w-[min(92vw,24rem)] overflow-y-auto p-4"
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <SheetHeader className="p-0">
              <SheetTitle>Dispatch queue</SheetTitle>
              <SheetDescription>Loads waiting for a driver.</SheetDescription>
            </SheetHeader>
            {queuePanel}
          </SheetContent>
        </Sheet>

        <LoadDialog
          editor={editor}
          now={now}
          drivers={state.drivers}
          driversById={driversById}
          terminals={state.terminals}
          loadsById={loadsById}
          schedules={schedules}
          validate={validate}
          onSubmit={handleSubmit}
          onDelete={remove}
          onDuplicate={(load) => duplicate(load)}
          onClose={() => setEditor(null)}
        />
        <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
        <Toaster position={isDesktop ? "bottom-left" : "top-center"} closeButton />
      </div>
    </TooltipProvider>
  );
}
