// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { StoredWorkspace } from "../../workspace";
import { AddWorkspaceModal } from "./AddWorkspaceModal";

const stored = (): StoredWorkspace => ({
  gameBuildNumber: null,
  gameLaunchCommand: null,
  id: "ws1",
  inputPath: "C:/hrek/scripts",
  lastOpenFilePath: null,
  megaloVersion: "107-mcc",
  name: "Reach",
  outputPath: null,
});

describe("AddWorkspaceModal", () => {
  it("keeps typed input when the parent passes a new copy of the same workspace", () => {
    const { rerender } = render(
      <AddWorkspaceModal initialWorkspace={stored()} onSave={() => {}} open />
    );
    const name = screen.getByDisplayValue("Reach");
    fireEvent.change(name, { target: { value: "Edited" } });

    rerender(
      <AddWorkspaceModal initialWorkspace={stored()} onSave={() => {}} open />
    );
    expect(screen.getByDisplayValue("Edited")).toBe(name);
  });

  it("starts from the workspace it is keyed to", () => {
    const { rerender } = render(
      <AddWorkspaceModal
        initialWorkspace={stored()}
        key="ws1"
        onSave={() => {}}
        open
      />
    );
    fireEvent.change(screen.getByDisplayValue("Reach"), {
      target: { value: "Edited" },
    });
    rerender(
      <AddWorkspaceModal
        initialWorkspace={{ ...stored(), id: "ws2", name: "Other" }}
        key="ws2"
        onSave={() => {}}
        open
      />
    );
    expect(screen.getByDisplayValue("Other")).toBeTruthy();
  });
});
