import { spawnSync } from "node:child_process";

const staged = spawnSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"], { encoding: "utf8" });

if (staged.status !== 0) process.exit(staged.status ?? 1);

const files = staged.stdout.split("\0").filter(Boolean);
if (!files.length) process.exit(0);

const prettier = spawnSync("pnpm", ["exec", "prettier", "--write", "--ignore-unknown", ...files], { stdio: "inherit" });
if (prettier.status !== 0) process.exit(prettier.status ?? 1);

const restage = spawnSync("git", ["add", "--", ...files], { stdio: "inherit" });
process.exit(restage.status ?? 1);
