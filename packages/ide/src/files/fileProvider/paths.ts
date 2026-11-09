/**
 * Normalize path separators to forward slashes for logical workspace paths.
 * Repeated separators collapse, except the leading pair of a UNC path
 * (`\\server\share`), which stays `//server/share`.
 */
export function normalizeLogicalPath(path: string): string {
  const forward = path.replace(/\\/g, "/");
  const collapsed = forward.replace(/\/+/g, "/");
  return forward.startsWith("//") ? `/${collapsed}` : collapsed;
}

export function joinLogicalPaths(base: string, relative: string): string {
  const normalizedBase = normalizeLogicalPath(base).replace(/\/+$/, "");
  const normalizedRelative = normalizeLogicalPath(relative).replace(/^\/+/, "");
  if (!normalizedBase) {
    return normalizedRelative;
  }
  if (!normalizedRelative) {
    return normalizedBase;
  }
  return `${normalizedBase}/${normalizedRelative}`;
}

export function isAbsoluteLogicalPath(path: string): boolean {
  const normalized = normalizeLogicalPath(path);
  return (
    /^[A-Za-z]:\//.test(normalized) ||
    normalized.startsWith("/") ||
    normalized.startsWith("workspace/")
  );
}

/** Filesystem absolute paths for CLI (no logical `workspace/` prefix). */
export function isAbsoluteFilesystemPath(path: string): boolean {
  const normalized = normalizeLogicalPath(path);
  return /^[A-Za-z]:\//.test(normalized) || normalized.startsWith("/");
}
