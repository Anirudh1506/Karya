import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const root = process.cwd();
const mobile = join(root, "apps", "mobile");
const command = process.argv[2] ?? "start";
const platform = process.argv[3];

function stopMetro() {
  let output = "";

  try {
    output = execFileSync("lsof", ["-tiTCP:8081", "-sTCP:LISTEN"], {
      encoding: "utf8",
    });
  } catch {
    return;
  }

  const pids = output
    .split(/\s+/)
    .map((pid) => Number(pid))
    .filter(Number.isInteger);

  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
      console.log(`Stopped Metro process ${pid}.`);
    } catch (error) {
      console.warn(`Could not stop Metro process ${pid}: ${error.message}`);
    }
  }
}

function clearMetroState() {
  rmSync(join(mobile, ".expo"), { force: true, recursive: true });
  rmSync(join(mobile, "node_modules", ".cache", "metro"), {
    force: true,
    recursive: true,
  });
}

function ensureAndroidSdk() {
  const sdk =
    process.env.ANDROID_HOME ??
    process.env.ANDROID_SDK_ROOT ??
    join(process.env.HOME ?? "", "Library", "Android", "sdk");

  if (!sdk || !existsSync(sdk)) {
    console.error("Android SDK not found. Set ANDROID_HOME or ANDROID_SDK_ROOT before rebuilding.");
    process.exit(1);
  }

  // Expo prebuild --clean recreates android/ and removes this ignored local
  // machine setting. Gradle requires it when the shell has no SDK environment.
  const escapedSdk = sdk.replaceAll("\\", "\\\\").replaceAll(":", "\\:");
  writeFileSync(join(mobile, "android", "local.properties"), `sdk.dir=${escapedSdk}\n`);
  console.log(`Configured Android SDK: ${sdk}`);
}

function run(binary, args, options = {}) {
  const result = spawnSync(binary, args, {
    cwd: options.cwd ?? root,
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

stopMetro();
clearMetroState();

if (command === "start") {
  run("pnpm", ["--filter", "@karya/mobile", "exec", "expo", "start", "--dev-client", "--clear"]);
} else if (command === "rebuild" && (platform === "ios" || platform === "android")) {
  run("pnpm", ["--filter", "@karya/mobile", "exec", "expo", "prebuild", "--platform", platform, "--clean"]);
  if (platform === "android") ensureAndroidSdk();
  run("pnpm", ["--filter", "@karya/mobile", "exec", "expo", `run:${platform}`, "--no-install"]);
} else {
  console.error("Usage: node scripts/mobile.mjs start | rebuild <ios|android>");
  process.exit(1);
}
