import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Sidebar } from "./Sidebar";
import { AGENTS } from "./agents";

describe("Sidebar", () => {
  it("renders workspace nav and the agent roster", () => {
    render(<Sidebar active="mission-control" onWorkspace={() => {}} onSelectAgent={() => {}} />);
    expect(screen.getByText("Mission Control")).toBeInTheDocument();
    expect(screen.getByText("Local LLM")).toBeInTheDocument();
    expect(screen.getByText("Claude")).toBeInTheDocument();
  });

  it("fires onSelectAgent with the agent when clicked", () => {
    const onSelectAgent = vi.fn();
    render(<Sidebar active="mission-control" onWorkspace={() => {}} onSelectAgent={onSelectAgent} />);
    fireEvent.click(screen.getByText("Local LLM"));
    expect(onSelectAgent).toHaveBeenCalledWith(AGENTS[0]);
  });

  it("fires onWorkspace when a workspace item is clicked", () => {
    const onWorkspace = vi.fn();
    render(<Sidebar active="mission-control" onWorkspace={onWorkspace} onSelectAgent={() => {}} />);
    fireEvent.click(screen.getByText("Knowledge Graph"));
    expect(onWorkspace).toHaveBeenCalledWith("graph");
  });
});
