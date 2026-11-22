import { act, cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { TurnIdSchema } from "../../shared/ids.ts";
import { sessionSummary } from "../testing/fake-api-client.ts";
import { renderWithServices } from "../testing/render-with-services.tsx";
import { App } from "./App.tsx";

afterEach(() => {
  cleanup();
  window.location.hash = "";
});

describe("App", () => {
  it("R-UI-1 lists sessions and keeps the list live", async () => {
    const harness = renderWithServices(<App />);
    harness.api.sessions = [sessionSummary()];
    harness.render();
    const sidebar = screen.getByRole("navigation", { name: "Sessions" });
    expect(await within(sidebar).findByText("Fix the login bug")).toBeTruthy();
    expect(within(sidebar).getByText("fake-fast · webapp")).toBeTruthy();
    act(() =>
      harness.live.emitToSessionList({
        type: "session.updated",
        session: sessionSummary({ title: "Renamed live", status: "running" }),
      }),
    );
    expect(await within(sidebar).findByText("Renamed live")).toBeTruthy();
    expect(within(sidebar).getByRole("img", { name: /Running/ })).toBeTruthy();
  });

  it("opens a session and shows its live transcript", async () => {
    const harness = renderWithServices(<App />);
    const session = sessionSummary();
    harness.api.sessions = [session];
    harness.render();
    await userEvent.click(await screen.findByText("Fix the login bug"));
    const turnId = TurnIdSchema.parse("turn-1");
    act(() => {
      harness.live.emitToSession(session.id, {
        type: "session.event",
        envelope: {
          sessionId: session.id,
          seq: 1,
          timestamp: "2026-01-01T00:00:00.000Z",
          event: { type: "turn.started", turnId, text: "Why does login fail?" },
        },
      });
      harness.live.emitToSession(session.id, {
        type: "session.delta",
        delta: { sessionId: session.id, turnId, messageId: "m1", text: "Looking into it" },
      });
    });
    const transcript = screen.getByTestId("transcript");
    expect(within(transcript).getByText("Why does login fail?")).toBeTruthy();
    expect(within(transcript).getByText("Looking into it")).toBeTruthy();
    await userEvent.type(screen.getByRole("textbox", { name: "Message" }), "Thanks{Enter}");
    expect(harness.api.sentMessages).toEqual([{ sessionId: session.id, text: "Thanks" }]);
  });

  it("R-SES-1 creates a scratch session from the dialog and selects it", async () => {
    const harness = renderWithServices(<App />);
    harness.render();
    const sidebar = screen.getByRole("complementary");
    await userEvent.click(within(sidebar).getByRole("button", { name: "New session" }));
    const dialog = await screen.findByRole("dialog", { name: "New session" });
    await userEvent.click(await within(dialog).findByRole("button", { name: "Create session" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(window.location.hash).toBe("#/sessions/session-1");
  });

  it("shows a newly created session at once, without waiting for the live update", async () => {
    const harness = renderWithServices(<App />);
    harness.render();
    const sidebar = screen.getByRole("complementary");
    await userEvent.click(within(sidebar).getByRole("button", { name: "New session" }));
    const dialog = await screen.findByRole("dialog", { name: "New session" });
    await userEvent.click(await within(dialog).findByRole("button", { name: "Create session" }));
    expect(screen.getByRole("region", { name: "Chat" })).toBeTruthy();
    expect(within(sidebar).getByText("Fix the login bug")).toBeTruthy();
  });
});
