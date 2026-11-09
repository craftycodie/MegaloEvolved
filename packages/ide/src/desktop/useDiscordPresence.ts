import { useEffect, useRef } from "react";
import { APP_NAME } from "../app/constants";
import type { CompileState } from "../compile";
import { setDiscordPresenceEnabled, updateDiscordPresence } from "../desktop";
import { translate } from "../localization";

interface UseDiscordPresenceOptions {
  compileState: CompileState;
  enabled: boolean;
  fileName: string | null;
  locale: string;
}

function presenceState(
  fileName: string | null,
  compileState: CompileState
): string {
  if (!fileName) {
    return translate("discord_editing_halo_reach");
  }
  switch (compileState) {
    case "ok":
      return translate("discord_script_compiled");
    case "warn":
      return translate("discord_compile_warning");
    case "error":
      return translate("discord_compile_errors");
    default:
      return translate("discord_editing_gametype");
  }
}

export function useDiscordPresence({
  compileState,
  enabled,
  fileName,
  locale,
}: UseDiscordPresenceOptions) {
  const lastSentRef = useRef<string | null>(null);

  useEffect(() => {
    lastSentRef.current = null;
    void setDiscordPresenceEnabled(enabled);
  }, [enabled]);

  useEffect(() => {
    // `parsing` flips on and off with every compile while typing. Discord
    // rate-limits presence updates, so only settled states are sent, and
    // only when the text actually changes.
    if (!enabled || compileState === "parsing") {
      return;
    }
    const details = fileName ?? APP_NAME;
    const state = presenceState(fileName, compileState);
    const key = `${locale}\u0000${details}\u0000${state}`;
    if (key === lastSentRef.current) {
      return;
    }
    lastSentRef.current = key;
    void updateDiscordPresence({ details, state });
  }, [compileState, enabled, fileName, locale]);
}
