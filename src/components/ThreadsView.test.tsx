import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ThreadsView from "./ThreadsView";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).endsWith("/api/threads")) {
        return { ok: true, json: async () => ({ threads: [] }) } as Response;
      }
      return { ok: true, json: async () => ({ thread: { id: 1, status: "idle" }, messages: [] }) } as Response;
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("ThreadsView", () => {
  it("names the agents you can address", async () => {
    render(<ThreadsView />);
    await waitFor(() => expect(screen.getByText(/@claude/)).toBeTruthy());
    expect(screen.getByText(/@codex/)).toBeTruthy();
  });

  // The route rejects a mention-less opener; saying so up front beats a 400.
  it("keeps the send button disabled until the message mentions an agent", async () => {
    render(<ThreadsView />);
    const box = await screen.findByPlaceholderText(/@claude/i);
    const send = screen.getByRole("button", { name: /start/i });
    fireEvent.change(box, { target: { value: "what do we think?" } });
    expect((send as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(box, { target: { value: "@claude what do we think?" } });
    expect((send as HTMLButtonElement).disabled).toBe(false);
  });
});
