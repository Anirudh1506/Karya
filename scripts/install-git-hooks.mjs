import { spawnSync } from "node:child_process";

const result = spawnSync("git", ["config", "core.hooksPath", ".githooks"], {
  stdio: "inherit",
});

if (result.status !== 0) {
  console.warn("Git hooks were not installed. Run: git config core.hooksPath .githooks");
}
