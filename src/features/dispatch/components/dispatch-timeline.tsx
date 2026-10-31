"use client";

import "react-calendar-timeline/style.css";
import "./timeline.css";

import type { Dayjs } from "dayjs";
import { type CSSProperties, type DragEvent, memo, useCallback, useMemo, useRef, useState } from "react";
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
import { formatTime } from "../domain/format";
import type { ScheduleIndex } from "../domain/schedule";
import { snapNearest } from "../domain/time";
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

  // Dragging a load in from the unassigned queue (native HTML drag and drop).
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  const locateDrop = (event: DragEvent): DropTarget | null => {
    const scroll = scrollElement.current?.getBoundingClientRect();
    const container = wrapper.current?.getBoundingClientRect();
    if (!queueDrag || !scroll || !container) return null;
    const { clientX, clientY } = event;
    if (clientX < scroll.left || clientX > scroll.right || clientY < scroll.top || clientY > scroll.bottom) return null;

    const span = view.end - view.start;
    const start = snapNearest(view.start + ((clientX - scroll.left) / scroll.width) * span);
    const duration = queueDrag.end - queueDrag.start;
    let rowTop = 0;
    for (const group of groups) {
      const rowHeight = group.height ?? LINE_HEIGHT;
      if (clientY - scroll.top < rowTop + rowHeight) {
        const driverId = group.kind === "driver" ? group.id : null;
        const itemHeight = LINE_HEIGHT * ITEM_HEIGHT_RATIO;
        return {
          driverId,
          start,
          label: driverId ? `${group.title} · ${formatTime(start)}` : "Drop on a driver's row",
          problem: driverId
            ? checkSlot({ id: queueDrag.id, driverId, start, end: start + duration })
            : "Drop on a driver's row",
          style: {
            left: scroll.left - container.left + ((start - view.start) / span) * scroll.width,
            top: scroll.top - container.top + rowTop + (rowHeight - itemHeight) / 2,
            width: Math.max(24, (duration / span) * scroll.width),
            height: itemHeight,
          },
        };
      }
      rowTop += rowHeight;
    }
    return null;
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

  return (
    <div
      ref={wrapper}
      className="dispatch-timeline relative"
      style={{ "--timeline-sticky-top": `${stickyTop}px` } as CSSProperties}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
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
      {queueDrag && dropTarget && (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute z-50 flex items-center rounded-[14px] border-2 border-dashed px-3 text-xs font-semibold whitespace-nowrap shadow-lg",
            dropTarget.problem
              ? "border-destructive bg-destructive/15 text-destructive"
              : "border-brand-sky bg-brand-sky/25 text-brand-navy"
          )}
          style={dropTarget.style}
        >
          {dropTarget.problem ?? dropTarget.label}
        </div>
      )}
    </div>
  );
}
