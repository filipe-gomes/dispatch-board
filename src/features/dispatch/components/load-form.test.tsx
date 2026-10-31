import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { validateLoad } from "../domain/rules";
import { HOUR } from "../domain/time";
import type { Load, LoadInput, Terminal } from "../domain/types";
import { context, driver, input, load, NOW } from "../test/factories";
import { LoadForm } from "./load-form";

const drivers = [
  driver(),
  driver({ id: "james", name: "James Carter" }),
  driver({ id: "tom", name: "Tom Nguyen", capacityGallons: 3_000 }),
];
const terminals: Terminal[] = [
  { id: "north", name: "North Rack Terminal", available: true },
  { id: "harbor", name: "Harbor Point Terminal", available: true },
];

function renderForm({
  initial = input(),
  original,
  loads = [],
}: { initial?: LoadInput; original?: Load; loads?: Load[] } = {}) {
  const ctx = context(loads);
  const validate = (value: LoadInput, edited?: Load) => validateLoad(value, { ...ctx, original: edited });
  const onSubmit = vi.fn((value: LoadInput) => {
    const result = validate(value, original);
    return result.valid ? { ok: true as const, load: load(value) } : { ok: false as const, errors: result.errors };
  });
  render(
    <LoadForm
      initial={initial}
      original={original}
      now={NOW}
      drivers={drivers}
      terminals={terminals}
      schedules={ctx.schedules}
      validate={validate}
      onSubmit={onSubmit}
      onCancel={vi.fn()}
    />
  );
  return { onSubmit, user: userEvent.setup() };
}

describe("LoadForm", () => {
  it("blocks a title that is too short and points the dispatcher at it", async () => {
    const { onSubmit, user } = renderForm({ initial: input({ title: "" }) });

    await user.type(screen.getByLabelText("Title"), "Gas");
    await user.click(screen.getByRole("button", { name: /create & dispatch/i }));

    expect(screen.getByText("Use at least 5 characters.")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveFocus();
    expect(onSubmit).toHaveReturnedWith(expect.objectContaining({ ok: false }));
  });

  it("dispatches a valid load straight away", async () => {
    const { onSubmit, user } = renderForm();

    await user.click(screen.getByRole("button", { name: /create & dispatch/i }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: "Harbor Marina Fuel Dock" }), {
      dispatchNow: true,
    });
    expect(onSubmit).toHaveReturnedWith(expect.objectContaining({ ok: true }));
  });

  it("warns about overlaps and offers one-click fixes", async () => {
    const busy = load({ title: "QuickStop #31", start: input().start - HOUR, end: input().start + HOUR });
    const { onSubmit, user } = renderForm({ loads: [busy] });

    expect(screen.getByText("Schedule conflict")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next opening/i })).toHaveTextContent("7:00 PM – 9:00 PM");

    await user.click(screen.getByRole("button", { name: "James Carter is free" }));

    expect(screen.queryByText("Schedule conflict")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /create & dispatch/i }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ driverId: "james" }), { dispatchNow: true });
  });

  it("is read-only once the load has started", () => {
    const started = load({ start: NOW - HOUR, end: NOW + HOUR });
    renderForm({ initial: input({ start: started.start, end: started.end }), original: started });

    expect(screen.getByText("This load is read-only")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toBeDisabled();
    expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument();
  });
});
