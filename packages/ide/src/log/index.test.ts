import {
  _event_critical,
  _event_error,
  _event_message,
  _event_status,
  _event_verbose,
  _event_warning,
  event,
} from "@blamnetwork/datamine";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("IDE event log", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("routes each level to the matching console method", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});

    event(_event_error, "ide:compile: export failed: %s", "boom");
    event(_event_critical, "ide:app: fatal %d", 7);
    event(_event_warning, "ide:lsp: connection lost");
    event(_event_status, "ide:desktop: wrote %d bytes -> %s", 12, "a.mglo");
    event(_event_message, "ide:files: saved");
    event(_event_verbose, "ide:editor: opened %s", "a.txt");

    expect(error.mock.calls.map(([line]) => line)).toEqual([
      expect.stringMatching(/^error +ide:compile: export failed: boom$/),
      expect.stringMatching(/ide:app: fatal 7$/),
    ]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/^warning +ide:lsp: connection lost$/)
    );
    expect(info.mock.calls.map(([line]) => line)).toEqual([
      expect.stringMatching(/^status +ide:desktop: wrote 12 bytes -> a.mglo$/),
      expect.stringMatching(/^message +ide:files: saved$/),
    ]);
    expect(debug).toHaveBeenCalledWith(
      expect.stringMatching(/^verbose +ide:editor: opened a.txt$/)
    );
  });

  it("keeps repeated lines and treats argument text literally", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    for (let i = 0; i < 20; i++) {
      event(
        _event_error,
        "ide:files: Failed to watch %s: %s",
        "C:/x %d",
        "denied"
      );
    }
    expect(error).toHaveBeenCalledTimes(20);
    expect(error).toHaveBeenLastCalledWith(
      expect.stringMatching(/ide:files: Failed to watch C:\/x %d: denied$/)
    );
  });
});
