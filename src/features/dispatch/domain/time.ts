export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Every scheduling interaction snaps to quarter hours, matching how dispatchers book loads. */
export const SNAP = 15 * MINUTE;

export const snapDown = (time: number, step = SNAP) => Math.floor(time / step) * step;
export const snapUp = (time: number, step = SNAP) => Math.ceil(time / step) * step;
export const snapNearest = (time: number, step = SNAP) => Math.round(time / step) * step;

/** The earliest bookable start: the next quarter hour that is strictly in the future. */
export const nextBookableStart = (now: number) => snapUp(now + 1);
