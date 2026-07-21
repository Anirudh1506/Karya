/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const config = getDefaultConfig(projectRoot);

function escapedAbsolutePath(relativePath) {
  return path.resolve(workspaceRoot, relativePath).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const generatedPaths = [
  "apps/mobile/.expo",
  "apps/mobile/android",
  "apps/mobile/dist",
  "apps/mobile/ios",
  "apps/shell/build",
  "apps/shell/out",
  "apps/shell/release",
  ".turbo",
];

config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
      ? [config.resolver.blockList]
      : []),
  ...generatedPaths.map((relativePath) => new RegExp(`^${escapedAbsolutePath(relativePath)}(?:[/\\\\].*)?$`)),
  new RegExp(`^${escapedAbsolutePath("packages")}(?:[/\\\\][^/\\\\]+)?[/\\\\]dist(?:[/\\\\].*)?$`),
];

module.exports = config;
