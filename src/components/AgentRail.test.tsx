import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AgentRail, AGENTS } from "./AgentRail";

describe("AgentRail", () => {
  it("renders all agents with status labels", () => {
    render(<AgentRail onSelect={() => {}} />);
    expect(screen.getByText("Local LLM")).toBeInTheDocument();
    expect(screen.getByText("Ghost")).toBeInTheDocument();
    expect(screen.getAllByText(/offline|online|data/i).length).toBeGreaterThan(0);
  });

  it("invokes onSelect when an agent is clicked", () => {
    const onSelect = vi.fn();
    render(<AgentRail onSelect={onSelect} />);
    fireEvent.click(screen.getByText("Local LLM"));
    expect(onSelect).toHaveBeenCalledWith(AGENTS[0]);
  });
});
