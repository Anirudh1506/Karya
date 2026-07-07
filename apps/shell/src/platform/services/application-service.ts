import type { InstalledApplication } from "@karya/types";
import { access, readdir } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { exists } from "../resources/file-system";
import { getPlatform } from "../utils/platform";

const now = new Date().toISOString();
const platform = getPlatform();
const execFileAsync = promisify(execFile);

export async function discoverNativeApplications(): Promise<InstalledApplication[]> {
  if (platform !== "darwin") {
    return [];
  }

  const roots = [
    "/Applications",
    "/System/Applications",
    "/System/Applications/Utilities",
    join(homedir(), "Applications"),
  ];
  const bundlePaths = new Set<string>();
  await Promise.all(roots.map(async (root) => {
    for (const bundlePath of await findApplicationBundles(root, 3)) {
      bundlePaths.add(bundlePath);
    }
  }));

  const applications = await Promise.all([...bundlePaths].map(createMacApplication));
  return applications
    .filter((application): application is InstalledApplication => Boolean(application))
    .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name));
}

async function findApplicationBundles(root: string, maxDepth: number): Promise<string[]> {
  try {
    await access(root);
  } catch {
    return [];
  }

  const results: string[] = [];
  async function walk(directory: string, depth: number): Promise<void> {
    if (depth < 0) return;
    let entries: Dirent[];
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    await Promise.all(entries.map(async (entry) => {
      if (!entry.isDirectory() || entry.name.startsWith(".")) return;
      const path = join(directory, entry.name);
      if (entry.name.endsWith(".app")) {
        results.push(path);
        return;
      }
      await walk(path, depth - 1);
    }));
  }

  await walk(root, maxDepth);
  return results;
}

async function createMacApplication(bundlePath: string): Promise<InstalledApplication | undefined> {
  const info = await readInfoPlist(bundlePath);
  if (!info) return undefined;

  const name = readString(info.CFBundleDisplayName) ?? readString(info.CFBundleName) ?? basename(bundlePath, ".app");
  const bundleIdentifier = readString(info.CFBundleIdentifier);
  const executableName = readString(info.CFBundleExecutable);
  const executablePath = executableName ? join(bundlePath, "Contents", "MacOS", executableName) : undefined;
  if (!bundleIdentifier || !executablePath || !(await exists(executablePath))) return undefined;
  if (!isUserLaunchableApplication({ name, bundleIdentifier, bundlePath, info })) return undefined;

  const category = inferApplicationCategory(name, bundleIdentifier);
  const capabilities = inferApplicationCapabilities(name, category);
  const supportedFileTypes = inferSupportedFileTypes(name, bundleIdentifier);

  return {
    metadata: {
      id: createApplicationId(bundleIdentifier),
      name,
      description: `${categoryLabel(category)} application installed on this Mac`,
      icon: name,
      iconRef: `platform-icon:${bundleIdentifier}`,
      version: readString(info.CFBundleShortVersionString) ?? readString(info.CFBundleVersion) ?? "unknown",
      category,
      platform,
      executableIdentifier: bundleIdentifier,
      bundleIdentifier,
      installLocation: bundlePath,
      executablePath,
      launchArguments: [],
      supportedFileTypes,
      supportedUrlSchemes: [],
      capabilities,
      attributes: {
        bundlePath,
      },
    },
    installedAt: now,
    lifecycleState: "available",
    pinned: isCommonPinnedApplication(name, bundleIdentifier),
    favorite: false,
    hidden: false,
    defaultApplication: false,
    launchCount: 0,
  };
}

export async function launchApplication(application: InstalledApplication | undefined, args: string[] = []): Promise<void> {
  if (!application) return;
  if (platform === "darwin" && application.metadata.bundleIdentifier) {
    await spawnAndWait("open", ["-b", application.metadata.bundleIdentifier, ...args]);
    return;
  }
  if (application.metadata.executablePath && application.metadata.executablePath !== "platform") {
    await spawnAndWait(application.metadata.executablePath, args);
  }
}

async function readInfoPlist(bundlePath: string): Promise<Record<string, unknown> | undefined> {
  try {
    const { stdout } = await execFileAsync("plutil", ["-convert", "json", "-o", "-", join(bundlePath, "Contents", "Info.plist")], {
      maxBuffer: 1024 * 1024,
    });
    return JSON.parse(stdout) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function isUserLaunchableApplication(input: {
  name: string;
  bundleIdentifier: string;
  bundlePath: string;
  info: Record<string, unknown>;
}): boolean {
  const loweredName = input.name.toLocaleLowerCase();
  const loweredBundleId = input.bundleIdentifier.toLocaleLowerCase();
  const loweredPath = input.bundlePath.toLocaleLowerCase();
  const excludedNameTerms = [
    "helper",
    "installer",
    "uninstaller",
    "updater",
    "daemon",
    "agent",
    "login item",
    "crashpad",
    "renderer",
  ];
  if (excludedNameTerms.some((term) => loweredName.includes(term) || loweredBundleId.includes(term))) return false;
  if (loweredPath.includes("/contents/")) return false;
  if (input.info.LSBackgroundOnly === true || input.info.LSUIElement === true) return false;
  return true;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function createApplicationId(bundleIdentifier: string): string {
  return `app-${bundleIdentifier.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function inferApplicationCategory(name: string, bundleIdentifier: string): InstalledApplication["metadata"]["category"] {
  const haystack = `${name} ${bundleIdentifier}`.toLocaleLowerCase();
  if (/(safari|chrome|firefox|arc|browser|edge|brave)/.test(haystack)) return "browser";
  if (/(code|cursor|xcode|terminal|iterm|docker|postman|github|sublime|zed)/.test(haystack)) return "development";
  if (/(figma|sketch|photoshop|illustrator|canva)/.test(haystack)) return "design";
  if (/(slack|discord|teams|zoom|messages|mail)/.test(haystack)) return "communication";
  if (/(spotify|music|podcast|vlc|quicktime)/.test(haystack)) return "media";
  if (/(excel|word|powerpoint|numbers|pages|keynote|office)/.test(haystack)) return "office";
  if (/(notes|notion|calendar|reminders|obsidian)/.test(haystack)) return "productivity";
  return "utility";
}

function categoryLabel(category: InstalledApplication["metadata"]["category"]): string {
  if (!category) return "Desktop";
  return category.charAt(0).toLocaleUpperCase() + category.slice(1);
}

function inferApplicationCapabilities(name: string, category: InstalledApplication["metadata"]["category"]): string[] {
  const capabilities = new Set<string>([category ?? "application"]);
  const normalizedName = name.toLocaleLowerCase();
  if (category === "browser") capabilities.add("web");
  if (category === "development") capabilities.add("development");
  if (category === "productivity") capabilities.add("documents");
  if (normalizedName.includes("terminal")) capabilities.add("shell");
  if (normalizedName.includes("notes")) capabilities.add("notes");
  return [...capabilities];
}

function inferSupportedFileTypes(name: string, bundleIdentifier: string): string[] {
  const haystack = `${name} ${bundleIdentifier}`.toLocaleLowerCase();
  if (/(code|cursor|sublime|zed)/.test(haystack)) return ["txt", "md", "markdown", "js", "ts", "tsx", "jsx", "json", "java", "py", "css", "html", "yml", "yaml"];
  if (/(terminal|iterm)/.test(haystack)) return ["sh", "zsh", "bash"];
  if (/(safari|chrome|firefox|arc|edge|brave)/.test(haystack)) return ["html", "htm", "pdf", "url"];
  if (/(notes|notion|obsidian)/.test(haystack)) return ["txt", "md", "markdown"];
  if (/(excel|numbers)/.test(haystack)) return ["xls", "xlsx", "csv"];
  if (/(figma|sketch|photoshop|illustrator|preview)/.test(haystack)) return ["fig", "svg", "png", "jpg", "jpeg", "pdf"];
  return [];
}

function isCommonPinnedApplication(name: string, bundleIdentifier: string): boolean {
  const haystack = `${name} ${bundleIdentifier}`.toLocaleLowerCase();
  return /(chrome|safari|code|cursor|terminal)/.test(haystack);
}

function spawnAndWait(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}
