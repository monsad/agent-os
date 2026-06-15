import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MissionControlLayout } from "./MissionControlLayout";

describe("MissionControlLayout", () => {
  it("renders the three panes", () => {
    render(<MissionControlLayout />);
    expect(screen.getByText("Agents")).toBeInTheDocument();          // left
    expect(screen.getByPlaceholderText(/message/i)).toBeInTheDocument(); // center
    expect(screen.getByText("Knowledge graph")).toBeInTheDocument(); // right
  });
});
