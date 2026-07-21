function trimTrailingSeparators(path: string): string {
  if (path === "/" || /^[A-Za-z]:[\\/]$/.test(path)) return path;
  return path.replace(/[\\/]+$/, "");
}

export function fileNameFromPath(path: string): string {
  const normalized = trimTrailingSeparators(path);
  const separatorIndex = Math.max(normalized.lastIndexOf("/"), normalized.lastIndexOf("\\"));
  return normalized.slice(separatorIndex + 1);
}

export function parentPath(path: string): string {
  const normalized = trimTrailingSeparators(path);
  const separatorIndex = Math.max(normalized.lastIndexOf("/"), normalized.lastIndexOf("\\"));

  if (separatorIndex < 0) return ".";
  if (separatorIndex === 0) return normalized[0];
  if (separatorIndex === 2 && /^[A-Za-z]:/.test(normalized)) return normalized.slice(0, 3);
  return normalized.slice(0, separatorIndex);
}
