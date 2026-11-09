// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusIcon } from "./StatusIcon";

describe("StatusIcon", () => {
  it("renders one icon per compile state", () => {
    for (const state of ["idle", "parsing", "ok", "warn", "error"] as const) {
      const { container, unmount } = render(<StatusIcon state={state} />);
      expect(container.querySelector(`.status-icon--${state}`)).not.toBeNull();
      unmount();
    }
  });
});
