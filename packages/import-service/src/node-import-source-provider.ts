import { readdir, stat } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import type { ImportFileCandidate, ImportSourceProvider } from "./contracts";

const IGNORED_METADATA_FILES = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);

export class NodeImportSourceProvider implements ImportSourceProvider {
  async walkDirectory(path: string): Promise<ImportFileCandidate[]> {
    const rootStat = await stat(path);
    if (!rootStat.isDirectory()) {
      throw new Error(`Import source is not a directory: ${path}`);
    }

    const files: ImportFileCandidate[] = [];
    await this.walk(path, path, files);
    return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  }

  private async walk(rootPath: string, currentPath: string, files: ImportFileCandidate[]): Promise<void> {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      if (shouldIgnoreEntry(entry.name)) continue;

      const entryPath = join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await this.walk(rootPath, entryPath, files);
        continue;
      }

      if (!entry.isFile()) continue;

      const relativePath = relative(rootPath, entryPath);
      files.push({
        path: entryPath,
        relativePath,
        displayTitle: relativePath || basename(entryPath),
      });
    }
  }
}

function shouldIgnoreEntry(name: string): boolean {
  return IGNORED_METADATA_FILES.has(name) || name.startsWith("._");
}
