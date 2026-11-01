"use client";

import "react-calendar-timeline/style.css";
import "./timeline.css";

import type { Dayjs } from "dayjs";
import {
  type CSSProperties,
  type DragEvent,
  memo,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Timeline, {
  CursorMarker,
  DateHeader,
  type IntervalRenderer,
  type ReactCalendarTimelineProps,
  SidebarHeader,
  TimelineHeaders,
  TimelineMarkers,
  TodayMarker,
} from "react-calendar-timeline";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDuration, formatTime, formatTimeRange } from "../domain/format";
import { findConflict, type ScheduleIndex, type TimeSlot } from "../domain/schedule";
import { nextBookableStart, snapNearest } from "../domain/time";
import type { Driver, DriverId, Load, LoadId, Terminal, TerminalId } from "../domain/types";
import { MAX_ZOOM, MIN_ZOOM, type TimelineView } from "../domain/view";
import { useStableCallback } from "../state/use-stable-callback";
import { GroupLabel } from "./group-label";
import { type CheckSlot, CheckSlotContext, renderLoadItem } from "./load-item";
import {
  type BoardGroup,
  buildGroups,
  buildItems,
  clampGesture,
  dragWindow,
  type DriverGroup,
  ITEM_HEIGHT_RATIO,
  LINE_HEIGHT,
  type LoadItem,
  TIMELINE_KEYS,
} from "./timeline-model";

type TimelineProps = ReactCalendarTimelineProps<LoadItem, BoardGroup>;
type FormatLabel = (range: [Dayjs, Dayjs], unit: string, labelWidth?: number) => string;

export interface DispatchTimelineProps {
  drivers: readonly Driver[];
  driversById: ReadonlyMap<DriverId, Driver>;
  terminals: ReadonlyMap<TerminalId, Terminal>;
  loads: readonly Load[];
  schedules: ScheduleIndex;
  now: number;
  /** Loads matching the search or filter; everything else is dimmed. `null` shows all. */
  matches: ReadonlySet<LoadId> | null;
  view: TimelineView;
  selectedId: LoadId | null;
  sidebarWidth: number;
  stickyTop: number;
  /** A queued load currently being dragged towards the timeline. */
  queueDrag: Load | null;
  checkSlot: CheckSlot;
  onViewChange: (view: TimelineView) => void;
  onSelect: (id: LoadId | null) => void;
  onOpen: (id: LoadId) => void;
  onCreateAt: (driverId: DriverId, time: number) => void;
  /** A window dragged across empty time in a driver's row. */
  onCreateBetween: (driverId: DriverId, start: number, end: number) => void;
  onMove: (id: LoadId, start: number, driverId: DriverId) => void;
  onResize: (id: LoadId, edge: "left" | "right", time: number) => void;
  onQueueDrop: (id: LoadId, driverId: DriverId, start: number) => void;
}

interface DropTarget {
  driverId: DriverId | null;
  start: number;
  style: CSSProperties;
  label: string;
  problem: string | null;
}

/** A row of the canvas; `top` is measured from the top of the first row. */
interface Row {
  group: BoardGroup;
  top: number;
  height: number;
}

type DriverRow = Row & { group: DriverGroup };

/** The visible canvas, and the wrapper the previews are positioned in. */
interface Geometry {
  scroll: DOMRect;
  container: DOMRect;
}

/** A press on empty space in a driver's row. It becomes a drag once the pointer travels. */
interface Press {
  pointerId: number;
  x: number;
  time: number;
  row: DriverRow;
  dragging: boolean;
  /** Aborting removes every window listener the press added. */
  listeners: AbortController;
}

interface DragSelection {
  slot: TimeSlot;
  style: CSSProperties;
  label: string;
  problem: string | null;
}

/** Pixels the pointer travels before a press becomes a drag, so clicks and double-clicks still work. */
const DRAG_THRESHOLD = 5;

const sectionRowClass = (group: BoardGroup) => (group.kind === "section" ? ["rct-section-row"] : []);

const formatPrimaryLabel: FormatLabel = ([start], unit, width = 0) => {
  if (unit === "day") return start.format(width > 160 ? "dddd, MMMM D" : width > 90 ? "ddd, MMM D" : "MMM D");
  if (unit === "month") return start.format(width > 110 ? "MMMM YYYY" : "MMM YYYY");
  if (unit === "year") return start.format("YYYY");
  return start.format("ddd, MMM D · h A");
};

const formatSecondaryLabel: FormatLabel = ([start], unit, width = 0) => {
  if (unit === "hour")
    return width >= 46 ? start.format("h A") : width >= 32 ? start.format("ha") : width >= 18 ? start.format("h") : "";
  if (unit === "day") return start.format(width >= 64 ? "ddd D" : "D");
  if (unit === "minute") return width >= 36 ? start.format("h:mm") : "";
  if (unit === "month") return start.format(width >= 56 ? "MMM" : "M");
  return start.format("D");
};

/** Approximate width of a day label, used to keep it inside its interval. */
const LABEL_ROOM = 150;

function createIntervalRenderer(variant: "primary" | "secondary", now: number, visibleStart: number) {
  return function TimelineInterval({ getIntervalProps, intervalContext }: IntervalRenderer<unknown>) {
    const { key, ...intervalProps } = getIntervalProps();
    const { startTime, endTime, labelWidth } = intervalContext.interval;
    const start = startTime.valueOf();
    const end = endTime.valueOf();
    const isCurrent = variant === "primary" && start <= now && now < end;
    // The header scrolls with a transform, so CSS sticky can't keep a day's label on screen; shift it by hand.
    const offset =
      variant === "primary" && start < visibleStart
        ? Math.max(0, Math.min(((visibleStart - start) / (end - start)) * labelWidth, labelWidth - LABEL_ROOM))
        : 0;
    return (
      <div
        key={key}
        {...intervalProps}
        className={cn("timeline-interval", `timeline-interval--${variant}`, isCurrent && "timeline-interval--today")}
      >
        <span
          className="timeline-interval__label"
          style={offset ? { transform: `translateX(${offset}px)` } : undefined}
        >
          {intervalContext.intervalText}
        </span>
      </div>
    );
  };
}

const renderSidebarHeader = ({ getRootProps }: { getRootProps: (props?: { style?: CSSProperties }) => object }) => (
  <div
    {...getRootProps({ style: { color: "inherit" } })}
    className="flex items-end px-3 pb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
  >
    Drivers &amp; carriers
  </div>
);

const renderNowMarker = ({ styles }: { styles: CSSProperties }) => (
  <div style={{ ...styles, backgroundColor: undefined }} className="now-marker" />
);

const renderCursorMarker = ({ styles }: { styles: CSSProperties }) => (
  <div style={{ ...styles, backgroundColor: undefined, width: 0 }} className="cursor-marker" />
);

type TimelineCanvasProps = Pick<
  TimelineProps,
  | "groups"
  | "items"
  | "selected"
  | "visibleTimeStart"
  | "visibleTimeEnd"
  | "sidebarWidth"
  | "scrollRef"
  | "verticalLineClassNamesForTime"
  | "onTimeChange"
  | "onItemSelect"
  | "onItemDeselect"
  | "onItemDoubleClick"
  | "onCanvasDoubleClick"
  | "onItemMove"
  | "onItemResize"
> & { now: number };

/**
 * The library component itself, memoised so drop-preview updates in the
 * wrapper never re-render the whole timeline.
 */
const TimelineCanvas = memo(function TimelineCanvas({ now, ...props }: TimelineCanvasProps) {
  const visibleStart = props.visibleTimeStart ?? 0;
  const primaryInterval = useMemo(() => createIntervalRenderer("primary", now, visibleStart), [now, visibleStart]);
  const secondaryInterval = useMemo(() => createIntervalRenderer("secondary", now, visibleStart), [now, visibleStart]);

  return (
    <Timeline
      {...props}
      keys={TIMELINE_KEYS}
      lineHeight={LINE_HEIGHT}
      itemHeightRatio={ITEM_HEIGHT_RATIO}
      stackItems={false}
      canSelect
      itemTouchSendsClick={false}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      moveResizeValidator={clampGesture}
      itemRenderer={renderLoadItem}
      groupRenderer={GroupLabel}
      horizontalLineClassNamesForGroup={sectionRowClass}
    >
      <TimelineHeaders>
        <SidebarHeader>{renderSidebarHeader}</SidebarHeader>
        <DateHeader
          unit="primaryHeader"
          height={34}
          labelFormat={formatPrimaryLabel}
          intervalRenderer={primaryInterval}
        />
        <DateHeader height={30} labelFormat={formatSecondaryLabel} intervalRenderer={secondaryInterval} />
      </TimelineHeaders>
      <TimelineMarkers>
        <TodayMarker interval={15_000}>{renderNowMarker}</TodayMarker>
        <CursorMarker>{renderCursorMarker}</CursorMarker>
      </TimelineMarkers>
    </Timeline>
  );
});

export function DispatchTimeline({
  drivers,
  driversById,
  terminals,
  loads,
  schedules,
  now,
  matches,
  view,
  selectedId,
  sidebarWidth,
  stickyTop,
  queueDrag,
  checkSlot,
  onViewChange,
  onSelect,
  onOpen,
  onCreateAt,
  onCreateBetween,
  onMove,
  onResize,
  onQueueDrop,
}: DispatchTimelineProps) {
  const groups = useMemo(() => buildGroups(drivers, schedules, now), [drivers, schedules, now]);
  const items = useMemo(
    () => buildItems(loads, driversById, terminals, now, matches),
    [loads, driversById, terminals, now, matches]
  );
  const selected = useMemo(() => (selectedId ? [selectedId] : []), [selectedId]);
  const pastColumns = useCallback((_start: number, end: number) => (end < now ? ["rct-past"] : []), [now]);

  const scrollElement = useRef<HTMLDivElement | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const handleScrollRef = useCallback((element: HTMLDivElement) => {
    scrollElement.current = element;
  }, []);

  const handleTimeChange = useStableCallback((start: number, end: number) => onViewChange({ start, end }));
  const handleItemSelect = useStableCallback((id: string | number) => onSelect(String(id)));
  const handleItemDeselect = useStableCallback(() => onSelect(null));
  const handleItemDoubleClick = useStableCallback((id: string | number) => onOpen(String(id)));
  const handleCanvasDoubleClick = useStableCallback((groupId: string | number, time: number) => {
    const group = groups.find((candidate) => candidate.id === groupId);
    if (group?.kind === "driver") onCreateAt(group.id, time);
  });
  const handleItemMove = useStableCallback((id: string | number, start: number, groupIndex: number) => {
    const group = groups[groupIndex];
    if (group?.kind === "driver") onMove(String(id), start, group.id);
    else toast.warning("Drop loads on a driver's row");
  });
  const handleItemResize = useStableCallback((id: string | number, time: number, edge: "left" | "right") =>
    onResize(String(id), edge, time)
  );

  const measure = (): Geometry | null => {
    const scroll = scrollElement.current?.getBoundingClientRect();
    const container = wrapper.current?.getBoundingClientRect();
    return scroll && container ? { scroll, container } : null;
  };

  /** The time under a horizontal position, pinned to the visible range. */
  const timeAt = ({ scroll }: Geometry, clientX: number) => {
    const x = Math.min(Math.max(clientX, scroll.left), scroll.right);
    return view.start + ((x - scroll.left) / scroll.width) * (view.end - view.start);
  };

  const rowAt = ({ scroll }: Geometry, clientY: number): Row | null => {
    let top = 0;
    for (const group of groups) {
      const height = group.height ?? LINE_HEIGHT;
      if (clientY - scroll.top < top + height) return { group, top, height };
      top += height;
    }
    return null;
  };

  /** Where a load-shaped preview of `start`–`end` sits over a row, in the wrapper's coordinates. */
  const previewStyle = ({ scroll, container }: Geometry, row: Row, start: number, end: number): CSSProperties => {
    const span = view.end - view.start;
    const itemHeight = LINE_HEIGHT * ITEM_HEIGHT_RATIO;
    return {
      left: scroll.left - container.left + ((start - view.start) / span) * scroll.width,
      top: scroll.top - container.top + row.top + (row.height - itemHeight) / 2,
      width: Math.max(24, ((end - start) / span) * scroll.width),
      height: itemHeight,
    };
  };

  // Dragging a load in from the unassigned queue (native HTML drag and drop).
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  const locateDrop = (event: DragEvent): DropTarget | null => {
    const geometry = measure();
    if (!queueDrag || !geometry) return null;
    const { clientX, clientY } = event;
    const { scroll } = geometry;
    if (clientX < scroll.left || clientX > scroll.right || clientY < scroll.top || clientY > scroll.bottom) return null;
    const row = rowAt(geometry, clientY);
    if (!row) return null;

    const start = snapNearest(timeAt(geometry, clientX));
    const end = start + (queueDrag.end - queueDrag.start);
    const driverId = row.group.kind === "driver" ? row.group.id : null;
    return {
      driverId,
      start,
      label: driverId ? `${row.group.title} · ${formatTime(start)}` : "Drop on a driver's row",
      problem: driverId ? checkSlot({ id: queueDrag.id, driverId, start, end }) : "Drop on a driver's row",
      style: previewStyle(geometry, row, start, end),
    };
  };

  const handleDragOver = (event: DragEvent) => {
    if (!queueDrag) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const next = locateDrop(event);
    setDropTarget((current) =>
      current && next && current.start === next.start && current.driverId === next.driverId ? current : next
    );
  };

  const handleDrop = (event: DragEvent) => {
    if (!queueDrag) return;
    event.preventDefault();
    const target = locateDrop(event);
    setDropTarget(null);
    if (target?.driverId) onQueueDrop(queueDrag.id, target.driverId, target.start);
    else toast.warning("Drop loads on a driver's row");
  };

  const handleDragLeave = (event: DragEvent) => {
    if (!wrapper.current?.contains(event.relatedTarget as Node | null)) setDropTarget(null);
  };

  // Dragging across empty time in a driver's row draws the window for a new load.
  const press = useRef<Press | null>(null);
  const [selection, setSelection] = useState<DragSelection | null>(null);

  const describeSelection = (geometry: Geometry, row: DriverRow, slot: TimeSlot): DragSelection => {
    const conflict = findConflict(schedules.get(row.group.id), slot);
    return {
      slot,
      style: previewStyle(geometry, row, slot.start, slot.end),
      label: `${formatTimeRange(slot.start, slot.end)} · ${formatDuration(slot.end - slot.start)}`,
      problem: conflict ? `Overlaps ${conflict.title}` : null,
    };
  };

  const endPress = () => {
    press.current?.listeners.abort();
    press.current = null;
    setSelection(null);
  };

  const trackPress = useStableCallback((event: PointerEvent) => {
    const current = press.current;
    if (!current || event.pointerId !== current.pointerId) return;
    // The press is ours, so the library must not pan the board underneath it.
    event.stopPropagation();
    if (!current.dragging && Math.abs(event.clientX - current.x) < DRAG_THRESHOLD) return;
    current.dragging = true;
    const geometry = measure();
    if (!geometry) return;
    const slot = dragWindow(current.time, timeAt(geometry, event.clientX), nextBookableStart(Date.now()));
    setSelection((shown) =>
      shown?.slot.start === slot.start && shown.slot.end === slot.end
        ? shown
        : describeSelection(geometry, current.row, slot)
    );
  });

  const releasePress = useStableCallback((event: PointerEvent) => {
    const current = press.current;
    if (!current || event.pointerId !== current.pointerId) return;
    const geometry = current.dragging ? measure() : null;
    endPress();
    if (!geometry) return;
    const { start, end } = dragWindow(current.time, timeAt(geometry, event.clientX), nextBookableStart(Date.now()));
    onCreateBetween(current.row.group.id, start, end);
  });

  const cancelPress = useStableCallback(endPress);

  const cancelOnEscape = useStableCallback((event: KeyboardEvent) => {
    if (event.key !== "Escape" || !press.current?.dragging) return;
    // Only the drag is cancelled; the selected load stays selected.
    event.stopPropagation();
    endPress();
  });

  const handlePointerDown = (event: ReactPointerEvent) => {
    // Touch keeps panning and pinch-zooming the board; drawing a window is for mouse and pen.
    if (event.pointerType === "touch" || event.button !== 0 || event.ctrlKey || event.metaKey) return;
    const target = event.target as Element;
    if (!scrollElement.current?.contains(target) || target.closest(".rct-item")) return;
    const geometry = measure();
    const row = geometry && rowAt(geometry, event.clientY);
    if (!geometry || !row || row.group.kind !== "driver") return;

    endPress();
    const listeners = new AbortController();
    press.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      time: timeAt(geometry, event.clientX),
      row: { ...row, group: row.group },
      dragging: false,
      listeners,
    };
    const options = { capture: true, signal: listeners.signal };
    window.addEventListener("pointermove", trackPress, options);
    window.addEventListener("pointerup", releasePress, options);
    window.addEventListener("pointercancel", cancelPress, options);
    window.addEventListener("keydown", cancelOnEscape, options);
    window.addEventListener("blur", cancelPress, options);
  };

  // A press's window listeners must not outlive the timeline.
  useEffect(() => () => press.current?.listeners.abort(), []);

  const preview = queueDrag && dropTarget ? dropTarget : selection;

  return (
    <div
      ref={wrapper}
      className="dispatch-timeline relative"
      style={{ "--timeline-sticky-top": `${stickyTop}px` } as CSSProperties}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPointerDown={handlePointerDown}
    >
      <CheckSlotContext.Provider value={checkSlot}>
        <TimelineCanvas
          now={now}
          groups={groups}
          items={items}
          selected={selected}
          visibleTimeStart={view.start}
          visibleTimeEnd={view.end}
          sidebarWidth={sidebarWidth}
          scrollRef={handleScrollRef}
          verticalLineClassNamesForTime={pastColumns}
          onTimeChange={handleTimeChange}
          onItemSelect={handleItemSelect}
          onItemDeselect={handleItemDeselect}
          onItemDoubleClick={handleItemDoubleClick}
          onCanvasDoubleClick={handleCanvasDoubleClick}
          onItemMove={handleItemMove}
          onItemResize={handleItemResize}
        />
      </CheckSlotContext.Provider>
      {preview && (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute z-50 flex items-center rounded-[14px] border-2 border-dashed px-3 text-xs font-semibold whitespace-nowrap shadow-lg",
            preview.problem
              ? "border-destructive bg-destructive/15 text-destructive"
              : "border-brand-sky bg-brand-sky/25 text-brand-navy"
          )}
          style={preview.style}
        >
          {preview.problem ?? preview.label}
        </div>
      )}
    </div>
  );
}
