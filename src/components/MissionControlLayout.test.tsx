import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MissionControlLayout } from "./MissionControlLayout";

afterEach(() => vi.restoreAllMocks());

describe("MissionControlLayout", () => {
  it("renders the Mission Control dashboard: sidebar, header, agent cards", () => {
    render(<MissionControlLayout />);
    // sidebar
    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(screen.getAllByText("Agents").length).toBeGreaterThan(0);
    // header (heading + at least one sidebar entry share the name, so check the h1)
    expect(screen.getByRole("heading", { level: 1, name: "Mission Control" })).toBeInTheDocument();
    // agent cards section
    expect(screen.getByText(/click to open control room/i)).toBeInTheDocument();
  });

  // The header used to be hard-coded, so switching view left the heading
  // claiming "Mission Control" while a different page was on screen.
  it("retitles the header when the workspace changes", () => {
    render(<MissionControlLayout />);
    fireEvent.click(screen.getByRole("button", { name: /Threads/ }));
    expect(screen.getByRole("heading", { level: 1, name: "Threads" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Mission Control" })).not.toBeInTheDocument();
  });

  it("opens the control room when an agent card is clicked", () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ exists: false }), { status: 200 })));
    render(<MissionControlLayout />);
    // the live agent's card shows its tagline; click it to open the modal
    fireEvent.click(screen.getByText(/direct streaming line to your local model/i));
    // modal-only affordances
    expect(screen.getByLabelText("Close")).toBeInTheDocument();
    expect(screen.getByText(/— Control Room/)).toBeInTheDocument();
  });
});
