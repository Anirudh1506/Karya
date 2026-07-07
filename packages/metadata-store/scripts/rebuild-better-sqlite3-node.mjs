import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname } from "node:path";

const require = createRequire(import.meta.url);
const packagePath = require.resolve("better-sqlite3/package.json");
const packageDirectory = dirname(packagePath);

const result = spawnSync("npm", ["rebuild"], {
  cwd: packageDirectory,
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
