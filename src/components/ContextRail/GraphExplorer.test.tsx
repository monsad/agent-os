import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GraphExplorer } from "./GraphExplorer";

afterEach(() => vi.restoreAllMocks());

describe("GraphExplorer", () => {
  it("posts the query and renders the graphify answer", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ graph: "Answer: foo", messages: [] }), { status: 200 }),
    ));
    render(<GraphExplorer />);
    fireEvent.change(screen.getByPlaceholderText(/ask the graph/i), {
      target: { value: "what is foo" },
    });
    fireEvent.submit(screen.getByTestId("graph-query"));
    await waitFor(() => expect(screen.getByText(/Answer: foo/)).toBeInTheDocument());
  });

  it("triggers a rebuild", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<GraphExplorer />);
    fireEvent.click(screen.getByText(/rebuild/i));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/graph/rebuild", expect.objectContaining({ method: "POST" })),
    );
  });
});
