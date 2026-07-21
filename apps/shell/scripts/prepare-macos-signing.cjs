const { execFile } = require("node:child_process");
const { existsSync, realpathSync } = require("node:fs");
const { readdir } = require("node:fs/promises");
const { dirname, join } = require("node:path");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const shellRoot = dirname(__dirname);
const electronDist = join(shellRoot, "node_modules", "electron", "dist");

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  if (!existsSync(electronDist)) {
    return;
  }

  const resolvedElectronDist = realpathSync(electronDist);

  await execFileAsync("xattr", ["-cr", resolvedElectronDist]);
  await removeAttributeDeep("com.apple.provenance", resolvedElectronDist);
}

async function removeAttribute(attribute, path) {
  try {
    await execFileAsync("xattr", ["-dr", attribute, path]);
  } catch (error) {
    if (!String(error.stderr).includes("No such xattr")) {
      throw error;
    }
  }
}

async function removeAttributeDeep(attribute, path) {
  await removeAttribute(attribute, path);

  const entries = await readdir(path, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(path, entry.name);
      await removeAttribute(attribute, entryPath);

      if (entry.isDirectory()) {
        await removeAttributeDeep(attribute, entryPath);
      }
    }),
  );
}
