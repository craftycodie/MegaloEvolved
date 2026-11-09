import type { MegaloVersionId } from "@megacrow/megalo";

/**
 * Product name used by code (UI labels, window titles, log prefixes, the
 * default gametype author). Locale files still spell it out in their strings.
 */
export const APP_NAME = "MegaloEvolved";

/** Megalo version used when a workspace or setting does not name one. */
export const DEFAULT_MEGALO_VERSION: MegaloVersionId = "107-mcc";

/** True on Windows hosts (desktop app or browser). */
export function isWindowsPlatform(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  const userAgentData = (
    navigator as Navigator & { userAgentData?: { platform?: string } }
  ).userAgentData;
  const platform =
    userAgentData?.platform || navigator.platform || navigator.userAgent;
  return /Win/i.test(platform);
}
