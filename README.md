# Dispatch Board

A fuel-load dispatching board built on [react-calendar-timeline](https://github.com/namespace-ee/react-calendar-timeline): schedule loads for drivers and carriers, dispatch them in a click, and watch deliveries progress through the day.

It started from the library's "Item Moving and Resizing" CodeSandbox and grew into something closer to a dispatcher's daily tool, borrowing cues from DashFuel's dispatching product: fast load creation, live status, supply-point fallbacks, forgotten-load alerts, a longer planning horizon and a layout that works on a phone.

## Getting started

Requires Node 26, the current LTS (pinned in `.nvmrc`); 22.22+ and 24.15+ also work.

```bash
npm install
npm run dev
```

Then open http://localhost:3000. The board seeds itself with realistic demo data relative to the current time, and every change is saved to `localStorage`. Use **⋯ → Reset demo data** to start over.

| Script                    | What it does                                          |
| ------------------------- | ----------------------------------------------------- |
| `npm run dev`             | Development server (Turbopack)                        |
| `npm run build` / `start` | Production build and server                           |
| `npm test`                | Unit and component tests (Vitest + Testing Library)   |
| `npm run typecheck`       | Type-check with the TypeScript 7 native compiler      |
| `npm run lint`            | ESLint with Next.js, React Hooks and TypeScript rules |
| `npm run format`          | Prettier, including Tailwind class sorting            |

Every push and pull request runs lint, type-check, format check, tests and a production build in GitHub Actions. Vercel needs no configuration: import the repository and keep the detected Next.js settings.

## The brief, and where it lives

| Requirement                                      | How it works                                                                                                                                                                                                                                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Add an item with a title, a user and a date/time | **New load** (or `N`), double-click an empty slot on a driver's row to pre-fill the driver and the next free time, or drag across empty time on the row to set the start and end directly. The form has a title, driver, start and end date/time, plus product, gallons and supply points. |
| Edit the text of an event                        | Double-click a load, press `E`, or use **Edit** in the details panel. The title field is focused with its text selected.                                                                                                                                                                   |
| Remove an item                                   | **Delete** in the form or details panel, or the `Delete` key. Every delete can be undone from the toast.                                                                                                                                                                                   |
| Titles are 5–35 characters                       | Measured after trimming whitespace, with a live counter and inline error (`validateTitle`).                                                                                                                                                                                                |
| Max 24 hours, may cross date boundaries          | End must be after start and at most 24 hours later; 6 PM → 6 PM the next day is allowed. The form says when a load "ends the next day", and dragging or resizing is clamped to 24 hours while the pointer moves.                                                                           |
| No overlapping events per user: warn and prevent | Checked on every path (form, drag, resize, queue drop, auto-assign). The form shows the clashing load with one-click fixes ("next opening", "James Carter is free"); a drag turns the load red mid-gesture and is rejected on drop.                                                        |
| Past and current events can't be edited          | A load is locked from the moment it starts. Locked loads can't be dragged, resized, edited or deleted; they open read-only and can be duplicated as a repeat delivery. The lock follows the clock as it ticks.                                                                             |

All of these rules live in one pure module, [`domain/rules.ts`](src/features/dispatch/domain/rules.ts), and every change goes through [`useLoadCommands`](src/features/dispatch/state/use-load-commands.ts), so the form, the timeline gestures and the queue can't disagree.

### Interpretations worth calling out

- **"Current" means started.** A load is read-only once `start <= now`, including moves, resizes and deletes. New and edited loads must start in the future.
- **Back-to-back is not an overlap.** Intervals are half-open, so a load ending at 2:00 PM and another starting at 2:00 PM are fine.
- **Unassigned loads aren't on the timeline yet**, so the lock rule doesn't apply to them. An overdue queued load can still be rescheduled.
- **Times are local** to the browser, and everything snaps to quarter hours.

## Inspired by DashFuel's dispatching tool

- **Time saver.** Double-click to create with the driver and next free slot pre-filled, or drag across a driver's empty time to draw the window, with a live preview that turns red on overlaps. The driver picker shows who is busy or too small for the volume. New loads are created and dispatched in one step, with **Save draft** as the alternative.
- **Unassigned queue.** Loads without a driver wait in the right-hand panel (mirroring the card list on DashFuel's board). Drag one onto a driver's row, with a live preview that turns red on conflicts, or use **Auto-assign** to give it to whoever can take it soonest.
- **Real-time updates.** In-progress loads show progress and a delivery stage ("Loading at rack", "En route to site"), driven by the clock as a stand-in for the driver app's feed. Status changes and deliveries ("customer notified") stream into **Live activity**. Changes also sync live between open tabs.
- **Clear alerts.** The bell flags forgotten loads (drafts or unassigned loads starting within two hours), loads that started without dispatch, and supply problems, with **Dispatch now**, **Auto-assign** and **Show** actions. Reroutes are listed but don't count toward the badge.
- **Supply points.** Each load has a primary and optional backup terminal. Marking a terminal out reroutes upcoming loads to their backup automatically and flags any left without supply. Defaults for new loads are set in the same panel.
- **Extended planning horizon.** Day, 3-day, week and 2-week views, previous/next, jump-to-date and a "Today" button, plus zoom (`Ctrl`/`⌘` + scroll) and pan (scroll sideways, or `Shift` + scroll).
- **On the go.** On phones the board opens on the next few hours, the queue moves into a sheet, load details dock to the bottom, and the timeline supports touch panning and pinch zoom.
- **Keyboard first.** `N` new, `/` search, `E` edit, `D` dispatch, `Del` delete, `T` today, `←`/`→` previous or next, `Esc` clear. The full list is under **⋯ → Keyboard shortcuts**.

## Architecture

```
src/
├── app/                        Next.js App Router shell (layout, page, theme)
├── components/ui/              shadcn/ui components (Radix + Tailwind), unmodified
└── features/dispatch/
    ├── domain/                 Pure TypeScript: types, rules, scheduling, status, alerts, views
    ├── data/                   Deterministic seed data generated relative to "now"
    ├── state/                  Reducer, persistence and cross-tab sync, commands, hooks
    └── components/             The board, timeline wrapper, form, queue, panels
```

- **Domain first.** Business rules are plain functions with no React, which makes them easy to test and reuse. The reducer is a dumb state machine; the rules run before anything is dispatched.
- **Efficient conflict checks.** Loads are indexed per driver and sorted once per change, so checks stop at the first load past the slot instead of scanning everything. That matters because the drag preview validates on every pointer move.
- **Working with the library, not around it.** The timeline is controlled (`visibleTimeStart`/`visibleTimeEnd`). Its items deep-compare their props, so the item renderer, the gesture validator and the handlers are kept referentially stable (module-level functions and a `useStableCallback` helper). Then a clock tick or a scroll doesn't re-render every load.
- **Client-only timeline.** The board needs the DOM and `localStorage`, so it is loaded with `next/dynamic` and `ssr: false`. The route itself is prerendered as a static skeleton, which deploys to Vercel as-is.

### Compared with the starter sandbox

The sandbox was a class component with inline `Object.assign` updates, `moment`, and no validation. This version uses function components and hooks, a typed domain model, `dayjs` (as the library's 0.30 line requires), immutable updates through a reducer, and a single validation path. It is covered by 74 tests across the rules, scheduling helpers, seed data, reducer, load form and drag-to-create.

## Tech stack

Next.js 16 (App Router, Turbopack) · React 19.3 · TypeScript 7 (native compiler; the TS 6 API package is aliased for ESLint, as the TypeScript team recommends) · Tailwind CSS 4 · shadcn/ui on Radix · react-calendar-timeline 0.30 beta · dayjs · Sonner · Vitest 5 + Testing Library · ESLint 10 · Prettier

## What I'd build next

- A real backend (for example Postgres with server actions or tRPC) with optimistic updates and websocket or SSE sync, so dispatchers and drivers share one source of truth.
- Tank-level forecasts that suggest loads before a site runs out (DashFuel's tank monitoring), and a "time change" view of projected levels.
- Hours-of-service limits per driver, truck compartments, and multi-drop routes.
- Recurring loads for keep-full customers, bulk dispatch, and printable daily driver sheets.
- Roles and an audit log, plus end-to-end tests for drag and drop (Playwright).
