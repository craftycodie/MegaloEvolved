import { _event_warning, event } from "@blamnetwork/datamine";
import { isTauriRuntime } from "../desktop/tauriRuntime";
import {
  isNewerBuild,
  isReleaseBranchBuild,
  parseBuildSeq,
} from "./buildString";

const GITHUB_REPO = "craftycodie/MegaCrow";
const RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=100`;

/** Latest GitHub Release page (redirects to the newest non-prerelease). */
export const GITHUB_LATEST_RELEASE_PAGE = `https://github.com/${GITHUB_REPO}/releases/latest`;

export interface GithubReleaseInfo {
  htmlUrl: string;
  name: string;
  prerelease: boolean;
  tagName: string;
}

interface GithubReleaseApiResponse {
  draft?: boolean;
  html_url?: string;
  name?: string | null;
  prerelease?: boolean;
  tag_name?: string;
}

function mapGithubRelease(
  data: GithubReleaseApiResponse
): GithubReleaseInfo | null {
  if (!(data.tag_name && data.html_url) || data.draft) {
    return null;
  }
  return {
    tagName: data.tag_name,
    htmlUrl: data.html_url,
    name: data.name?.trim() || data.tag_name,
    prerelease: Boolean(data.prerelease),
  };
}

export async function fetchGithubReleases(): Promise<GithubReleaseInfo[]> {
  try {
    const response = await fetch(RELEASES_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!response.ok) {
      event(
        _event_warning,
        "ide:app: update check failed: HTTP %d",
        response.status
      );
      return [];
    }
    const data: unknown = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }
    const releases: GithubReleaseInfo[] = [];
    for (const item of data as GithubReleaseApiResponse[]) {
      const release = mapGithubRelease(item);
      if (release) {
        releases.push(release);
      }
    }
    return releases;
  } catch (error) {
    event(_event_warning, "ide:app: update check failed: %s", String(error));
    return [];
  }
}

/**
 * Newest GitHub release newer than the current build.
 * Pre-releases are included only for non-`release` branch builds.
 */
export function selectUpdateRelease(
  releases: readonly GithubReleaseInfo[],
  currentBuildString: string,
  includePrereleases = !isReleaseBranchBuild(currentBuildString)
): GithubReleaseInfo | null {
  let best: GithubReleaseInfo | null = null;
  for (const release of releases) {
    if (release.prerelease && !includePrereleases) {
      continue;
    }
    if (!isNewerBuild(release.tagName, currentBuildString)) {
      continue;
    }
    if (!best || isNewerBuild(release.tagName, best.tagName)) {
      best = release;
    }
  }
  return best;
}

export type UpdateCheckResult =
  | { kind: "available"; release: GithubReleaseInfo }
  | { kind: "none" };

/**
 * Returns an available update when running a tracked Tauri build and GitHub
 * has a newer release tag than the current build string.
 *
 * Full (non-prerelease) GitHub Releases are always considered. Pre-releases
 * are included when the current build is from a non-`release` branch (e.g.
 * `00023.26.08.16.1810.alpha`).
 *
 * Releases are published manually; CI only builds/tags and does not create them.
 */
export async function checkForAppUpdate(options: {
  currentBuildString: string;
  skippedUpdateVersion?: string | null;
}): Promise<UpdateCheckResult> {
  if (!isTauriRuntime()) {
    return { kind: "none" };
  }

  const currentBuildString = options.currentBuildString;
  if (parseBuildSeq(currentBuildString) === null) {
    return { kind: "none" };
  }

  const release = selectUpdateRelease(
    await fetchGithubReleases(),
    currentBuildString
  );
  if (!release) {
    return { kind: "none" };
  }

  if (options.skippedUpdateVersion === release.tagName) {
    return { kind: "none" };
  }

  return { kind: "available", release };
}
