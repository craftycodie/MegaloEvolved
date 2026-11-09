import {
  _event_error,
  _event_status,
  _event_verbose,
  _event_warning,
  type e_event_level,
  events_initialize,
  events_initialized,
  k_event_level_none,
} from "@blamnetwork/datamine";

/**
 * Start @blamnetwork/datamine's event system in the language server's own
 * thread or process, so `lsp:` and `megalo:` events reach the console.
 * In the Node server, vscode-languageserver forwards the console to the
 * client's output channel; in the IDE's worker it shows in DevTools.
 */
export function startLspEventLog(): void {
  if (events_initialized()) {
    return;
  }
  events_initialize({
    root: ".",
    name: "MegaCrow language server",
    write_files: false,
    install_exit_flush: false,
    spam_mode: "disabled",
    console_spam_limit: false,
    command_echo: false,
    initial_levels: {
      display: _event_status,
      log: k_event_level_none,
      remote_log: k_event_level_none,
    },
    sinks: { display: writeToConsole },
  });
}

function writeToConsole(line: string, level: e_event_level): void {
  if (level >= _event_error) {
    console.error(line);
  } else if (level === _event_warning) {
    console.warn(line);
  } else if (level === _event_verbose) {
    console.debug(line);
  } else {
    console.info(line);
  }
}
