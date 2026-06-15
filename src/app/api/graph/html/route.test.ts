// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("node:fs/promises", async (orig) => {
  const actual = await orig<typeof import("node:fs/promises")>();
  return { ...actual, readFile: vi.fn() };
});
import { readFile } from "node:fs/promises";
import { GET } from "./route";

afterEach(() => vi.restoreAllMocks());

describe("GET /api/graph/html", () => {
  it("returns the html with the right content type", async () => {
    (readFile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue("<html>graph</html>");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(await res.text()).toContain("graph");
  });

  it("returns 404 when the graph is not built", async () => {
    (readFile as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("ENOENT"));
    const res = await GET();
    expect(res.status).toBe(404);
  });
});
