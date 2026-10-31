import dayjs from "dayjs";
import { HOUR, MINUTE } from "./time";

const gallonsFormat = new Intl.NumberFormat("en-US");

export const formatGallons = (gallons: number) => `${gallonsFormat.format(gallons)} gal`;

export const formatTime = (time: number) => dayjs(time).format("h:mm A");

export const formatDay = (time: number) => dayjs(time).format("ddd, MMM D");

export const isSameDay = (a: number, b: number) => dayjs(a).isSame(b, "day");

/** "Tue, Nov 10 · 2:00 PM – 5:30 PM", or both dates when the window crosses midnight. */
export function formatWindow(start: number, end: number): string {
  if (isSameDay(start, end)) return `${formatDay(start)} · ${formatTime(start)} – ${formatTime(end)}`;
  return `${formatDay(start)}, ${formatTime(start)} – ${formatDay(end)}, ${formatTime(end)}`;
}

/** Compact range for tight spaces: "2:00 – 5:30 PM" style without dates. */
export function formatTimeRange(start: number, end: number): string {
  const sameMeridiem = dayjs(start).format("A") === dayjs(end).format("A") && isSameDay(start, end);
  return sameMeridiem
    ? `${dayjs(start).format("h:mm")} – ${formatTime(end)}`
    : `${formatTime(start)} – ${formatTime(end)}`;
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / MINUTE);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

/** "in 45 min", "in 3h 15m", "20 min ago". */
export function formatRelative(target: number, now: number): string {
  const delta = target - now;
  const magnitude = Math.abs(delta);
  if (magnitude < MINUTE) return "now";
  const amount = magnitude < HOUR ? `${Math.round(magnitude / MINUTE)} min` : formatDuration(magnitude);
  return delta > 0 ? `in ${amount}` : `${amount} ago`;
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
