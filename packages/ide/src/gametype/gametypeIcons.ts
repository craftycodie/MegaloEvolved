/** Reach fileshare gametype icons (`reach_gametypes_*.png`). */

const FILESHARE_BASE = `${import.meta.env.BASE_URL}img/fileshare`;

/** Matches HREK `engine_icons.txt` order used by `k_engine_icon_*` symbols. */
const ENGINE_ICON_SUFFIXES = [
  "ctf",
  "slayer",
  "oddball",
  "king",
  "juggernaut",
  "territories",
  "assault",
  "infection",
  "vip",
  "invasion",
  "invasion_slayer",
  "stockpile",
  "action_sack",
  "race",
  "rocket_race",
  "grifball",
  "soccer",
  "headhunter",
  "crosshair",
  "wheel",
  "swirl",
  "bunker",
  "healthpack",
  "towershield",
  "return",
  "pre_game_warm_up",
  "cartographer",
  "eightball",
  "spartan",
  "elite",
  "attack",
] as const;

export function getReachGametypeIconUrl(
  iconIndex: number | null | undefined
): string | null {
  if (
    iconIndex === null ||
    iconIndex === undefined ||
    !Number.isInteger(iconIndex) ||
    iconIndex < 0
  ) {
    return null;
  }
  const index = Math.min(38, iconIndex);
  const name = ENGINE_ICON_SUFFIXES[index] ?? String(index).padStart(2, "0");
  return `${FILESHARE_BASE}/gametypes/reach_gametypes_${name}.png`;
}

/** Fileshare icon used for open object-list documents in the sidebar. */
export function getObjectListIconUrl(): string {
  return `${FILESHARE_BASE}/gametypes/reach_gametypes_pre_game_warm_up.png`;
}

/** Game icon for a Megalo version's picker rows (every version is Reach). */
export function gameIconSrc(_version: string): string {
  return `${import.meta.env.BASE_URL}img/icons/game-reach.png`;
}
