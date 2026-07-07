import type { FileSystemMetadata } from "@karya/platform";
import { access, readdir, stat } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { basename, dirname, extname, join } from "node:path";

export async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function getFileSystemMetadata(path: string): Promise<FileSystemMetadata | undefined> {
  try {
    const stats = await stat(path);
    const extension = stats.isFile() ? extname(path).replace(/^\./, "").toLocaleLowerCase() : undefined;
    return {
      path,
      name: basename(path),
      kind: stats.isDirectory() ? "directory" : "file",
      byteLength: stats.isFile() ? stats.size : 0,
      createdAt: stats.birthtime.toISOString(),
      modifiedAt: stats.mtime.toISOString(),
      mimeType: stats.isDirectory() ? "inode/directory" : inferMimeType(extension),
      extension,
      fileSystemId: `${stats.dev}:${stats.ino}`,
    };
  } catch {
    return undefined;
  }
}

export async function findFileSystemMetadataById(
  fileSystemId: string,
  searchRoots: string[],
): Promise<FileSystemMetadata | undefined> {
  const seen = new Set<string>();
  for (const root of searchRoots.filter(Boolean)) {
    const found = await findFileSystemMetadataByIdInTree(root, fileSystemId, 4, seen);
    if (found) return found;
  }
  return undefined;
}

async function findFileSystemMetadataByIdInTree(
  root: string,
  fileSystemId: string,
  depth: number,
  seen: Set<string>,
): Promise<FileSystemMetadata | undefined> {
  if (depth < 0 || seen.has(root)) return undefined;
  seen.add(root);

  const metadata = await getFileSystemMetadata(root);
  if (!metadata) return undefined;
  if (metadata.fileSystemId === fileSystemId) return metadata;
  if (metadata.kind !== "directory") return undefined;

  let entries: Dirent[];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return undefined;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const childPath = join(root, entry.name);
    const childMetadata = await getFileSystemMetadata(childPath);
    if (childMetadata?.fileSystemId === fileSystemId) return childMetadata;
    if (entry.isDirectory() && !entry.name.endsWith(".app")) {
      const found = await findFileSystemMetadataByIdInTree(childPath, fileSystemId, depth - 1, seen);
      if (found) return found;
    }
  }

  return undefined;
}

function inferMimeType(extension: string | undefined): string {
  if (!extension) return "application/octet-stream";
  const mimeTypes: Record<string, string> = {
    csv: "text/csv",
    gif: "image/gif",
    htm: "text/html",
    html: "text/html",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    json: "application/json",
    md: "text/markdown",
    pdf: "application/pdf",
    png: "image/png",
    txt: "text/plain",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  return mimeTypes[extension] ?? "application/octet-stream";
}

export function isTextReadableExtension(extension: string | undefined): boolean {
  return Boolean(extension && ["md", "markdown", "txt", "rtf"].includes(extension));
}
