// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SaveAsMenu } from "./SaveAsMenu";

describe("SaveAsMenu", () => {
  it("opens with focus on the first item and moves with arrow keys", async () => {
    render(<SaveAsMenu onSave={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Export/ }));
    const items = await screen.findAllByRole("menuitem");
    await waitFor(() => expect(document.activeElement).toBe(items[0]));
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowUp" });
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowUp" });
    expect(document.activeElement).toBe(items.at(-1));
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    render(<SaveAsMenu onSave={() => {}} />);
    const trigger = screen.getByRole("button", { name: /Export/ });
    fireEvent.click(trigger);
    await screen.findByRole("menu");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("saves in the chosen format and closes", async () => {
    const onSave = vi.fn();
    render(<SaveAsMenu onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: /Export/ }));
    const items = await screen.findAllByRole("menuitem");
    fireEvent.click(items[1]!);
    expect(onSave).toHaveBeenCalledWith("gvar");
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
