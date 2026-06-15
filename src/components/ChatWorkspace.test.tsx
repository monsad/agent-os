import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatWorkspace } from "./ChatWorkspace";
import * as hook from "./hooks/useChat";

afterEach(() => vi.restoreAllMocks());

describe("ChatWorkspace", () => {
  it("renders messages and shows the offline banner", () => {
    vi.spyOn(hook, "useChat").mockReturnValue({
      messages: [
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello" },
      ],
      send: vi.fn(),
      status: "offline",
    } as unknown as ReturnType<typeof hook.useChat>);
    render(<ChatWorkspace conversationId="c1" />);
    expect(screen.getByText("hi")).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(screen.getByText(/ollama serve/i)).toBeInTheDocument();
  });

  it("calls send on submit", () => {
    const send = vi.fn();
    vi.spyOn(hook, "useChat").mockReturnValue({ messages: [], send, status: "idle" } as unknown as ReturnType<typeof hook.useChat>);
    render(<ChatWorkspace conversationId="c1" />);
    fireEvent.change(screen.getByPlaceholderText(/message/i), { target: { value: "yo" } });
    fireEvent.submit(screen.getByTestId("composer"));
    expect(send).toHaveBeenCalledWith("yo");
  });
});
