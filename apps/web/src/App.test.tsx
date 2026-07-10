import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("nativas intake", () => {
  it("requires a public URL before beginning the truthful run", async () => {
    const user = userEvent.setup(); render(<App />);
    await user.clear(screen.getByLabelText("Homepage URL"));
    await user.type(screen.getByLabelText("Homepage URL"), "not-a-public-url");
    await user.click(screen.getByRole("button", { name: /run my free/i }));
    expect(screen.getByRole("alert")).toHaveTextContent("complete public");
  });

  it("shows the live Hermes run after a valid submission", async () => {
    const user = userEvent.setup(); render(<App />);
    await user.click(screen.getByRole("button", { name: /run my free/i }));
    expect(await screen.findByText("Reading your page in context.")).toBeInTheDocument();
    expect(screen.getByText(/Only real system events/)).toBeInTheDocument();
  });
});
