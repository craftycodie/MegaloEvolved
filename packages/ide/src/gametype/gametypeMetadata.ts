import {
  type CompiledMegaloMetadata,
  pickLocalizedStringTableText,
} from "@megacrow/megalo";
import { getObjectListIconUrl, getReachGametypeIconUrl } from "./gametypeIcons";
import {
  isObjectListsPath,
  isRecognizedObjectListName,
} from "./objectListsPath";

export interface VariantIdentity {
  description: string | null;
  /** Engine icon index, or `null` when unset (do not treat as CTF/0). */
  iconIndex: number | null;
  /** Reach fileshare icon URL, or `null` when no icon should be shown. */
  iconUrl: string | null;
  /** Document kind — object lists always show their sidebar icon. */
  kind?: "gametype" | "object-list";
  name: string;
}

/** Basename without directory; strips common gametype/script extensions. */
export function displayFileStem(fileName: string | null | undefined): string {
  if (!fileName) {
    return "";
  }
  const base = fileName.replace(/\\/g, "/").split("/").pop() ?? fileName;
  return base.replace(/\.(bin|blf|meg|txt|mglo)$/i, "");
}

function normalizeEngineIconIndex(
  icon: number | null | undefined
): number | null {
  if (icon === null || icon === undefined || icon < 0) {
    return null;
  }
  return icon;
}

function displayLocalizedString(
  value: CompiledMegaloMetadata["name"] | undefined
): string {
  return pickLocalizedStringTableText(value);
}

/**
 * Sidebar identity for the open document. Gametype name, description and icon
 * come from the LSP compile (`compiledMetadata`); before the first successful
 * compile the file name is shown.
 */
export function buildVariantIdentity(options: {
  fileName: string | null;
  /** Absolute path when available (preferred for object-list detection). */
  absoluteFilePath?: string | null;
  /** Version-recognized object list filenames (e.g. `objects.txt`). */
  objectListNames?: readonly string[];
  /** Prefer compiler-emitted metadata when a compile succeeded. */
  compiledMetadata?: CompiledMegaloMetadata | null;
}): VariantIdentity | null {
  const pathForKind = options.absoluteFilePath ?? options.fileName;
  const basename =
    (options.fileName ?? pathForKind)?.replace(/\\/g, "/").split("/").pop() ??
    "";
  if (
    isObjectListsPath(pathForKind) &&
    basename.length > 0 &&
    isRecognizedObjectListName(basename, options.objectListNames ?? [])
  ) {
    const name = displayFileStem(options.fileName ?? pathForKind);
    if (!name) {
      return null;
    }
    return {
      kind: "object-list",
      name,
      description: "object list",
      iconIndex: null,
      iconUrl: getObjectListIconUrl(),
    };
  }

  if (options.compiledMetadata) {
    const iconIndex = normalizeEngineIconIndex(
      options.compiledMetadata.engineIcon
    );
    const name =
      displayLocalizedString(options.compiledMetadata.name) ||
      displayFileStem(options.fileName) ||
      "";
    if (!name) {
      return null;
    }
    const description =
      displayLocalizedString(options.compiledMetadata.description) || null;
    return {
      name,
      description,
      iconIndex,
      iconUrl: getReachGametypeIconUrl(iconIndex),
    };
  }

  const name = displayFileStem(options.fileName);
  if (!name) {
    return null;
  }
  return {
    name,
    description: null,
    iconIndex: null,
    iconUrl: getReachGametypeIconUrl(null),
  };
}
