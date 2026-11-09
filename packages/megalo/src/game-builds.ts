import type { MegaloVersionId } from "src/version";

const EMPTY_BUILDS: readonly number[] = [];

/**
 * Halo engine build numbers that share a Megalo encoding (last = default).
 * Reach Beta (73) covers the original beta, beta TU1, and delta.
 */
const KNOWN_GAME_BUILDS: Partial<Record<MegaloVersionId, readonly number[]>> = {
  "49": [8516],
  "73": [9449, 9664, 9730],
  "106": [11860],
  "107": [12065],
};

export function knownGameBuildsFor(
  versionId: MegaloVersionId
): readonly number[] {
  return KNOWN_GAME_BUILDS[versionId] ?? EMPTY_BUILDS;
}

export function hasMultipleKnownGameBuilds(
  versionId: MegaloVersionId
): boolean {
  return knownGameBuildsFor(versionId).length > 1;
}

export function defaultGameBuildNumber(
  versionId: MegaloVersionId
): number | undefined {
  const builds = knownGameBuildsFor(versionId);
  return builds.at(-1);
}

/**
 * Build number a host should pass for `versionId`: the stored choice when it
 * is a known build, else the default. `undefined` when the version has no
 * known build (MCC), meaning "no build" (-1).
 */
export function resolveGameBuildNumber(
  versionId: MegaloVersionId,
  stored: number | null | undefined
): number | undefined {
  const builds = knownGameBuildsFor(versionId);
  if (builds.length === 0) {
    return;
  }
  if (typeof stored === "number" && builds.includes(stored)) {
    return stored;
  }
  return defaultGameBuildNumber(versionId);
}
