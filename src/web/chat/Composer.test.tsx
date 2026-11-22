import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Composer } from "./Composer.tsx";

afterEach(cleanup);

describe("Composer", () => {
  it("sends on Enter, keeps Shift+Enter as a new line, and clears after sending", async () => {
    const onSend = vi.fn(async () => {});
    render(<Composer busy={false} onSend={onSend} onInterrupt={async () => {}} />);
    const input = screen.getByRole("textbox", { name: "Message" });
    await userEvent.type(input, "first line{Shift>}{Enter}{/Shift}second line{Enter}");
    expect(onSend).toHaveBeenCalledWith("first line\nsecond line");
    expect(input).toHaveProperty("value", "");
  });

  it("R-CHAT-3 offers Stop instead of Send while the agent works", async () => {
    const onInterrupt = vi.fn(async () => {});
    render(<Composer busy={true} onSend={async () => {}} onInterrupt={onInterrupt} />);
    expect(screen.queryByRole("button", { name: "Send" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(onInterrupt).toHaveBeenCalled();
  });

  it("keeps the text and shows the error when sending fails", async () => {
    const onSend = vi.fn(async () => {
      throw new Error("Session is busy");
    });
    render(<Composer busy={false} onSend={onSend} onInterrupt={async () => {}} />);
    const input = screen.getByRole("textbox", { name: "Message" });
    await userEvent.type(input, "hello{Enter}");
    expect(await screen.findByText("Session is busy")).toBeTruthy();
    expect(input).toHaveProperty("value", "hello");
  });
});
