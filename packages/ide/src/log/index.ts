/**
 * Starts @blamnetwork/datamine's event system for the IDE.
 *
 * IDE code logs with datamine directly (`event(e_event_level.error, "ide:compile: ...")`).
 * Each entry point (app, docs window, CLI, tests) calls `startEventLog` first;
 * events raised before that are dropped. The display sink writes every event
 * to the console (DevTools in the app, stderr/stdout in the CLI). Nothing is
 * written to disk.
 */
import {
  e_event_level,
  events_initialize,
  events_initialized,
  k_event_level_none,
  type s_event_category_default_configuration,
} from "@blamnetwork/datamine";

/** Categories IDE events use, below `ide:`. */
const IDE_CATEGORIES = [
  "ide:",
  "ide:app:",
  "ide:compile:",
  "ide:desktop:",
  "ide:editor:",
  "ide:files:",
  "ide:lsp:",
  "ide:settings:",
] as const;

const category = (
  name: string,
  level: e_event_level
): s_event_category_default_configuration => ({
  name,
  display_color: { red: 1, green: 1, blue: 1 },
  display_level: level,
  log_level: k_event_level_none,
  remote_log_level: k_event_level_none,
});

/** Datamine's display sink: route each line to the console method for its level. */
export const writeToConsole = (line: string, level: e_event_level): void => {
  if (level >= e_event_level.error) {
    console.error(line);
  } else if (level === e_event_level.warning) {
    console.warn(line);
  } else if (level === e_event_level.verbose) {
    console.debug(line);
  } else {
    console.info(line);
  }
};

/** Start the event system once; later calls (and HMR reloads) do nothing. */
export const startEventLog = (): void => {
  if (events_initialized()) {
    return;
  }
  // Everything while developing, status and up otherwise.
  const level = import.meta.env?.DEV
    ? e_event_level.verbose
    : e_event_level.status;
  events_initialize({
    root: ".",
    name: "MegaCrow IDE",
    write_files: false,
    install_exit_flush: false,
    // DevTools is the only place IDE logs go, so keep every line: no repeat
    // filter and no console limiter.
    spam_mode: "disabled",
    console_spam_limit: false,
    command_echo: false,
    initial_levels: {
      display: level,
      log: k_event_level_none,
      remote_log: k_event_level_none,
    },
    categories: IDE_CATEGORIES.map((name) => category(name, level)),
    sinks: { display: writeToConsole },
  });
};
