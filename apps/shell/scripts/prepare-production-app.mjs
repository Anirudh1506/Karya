import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const shellRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appRoot = join(shellRoot, "build", "app");
const stagedNodeModules = join(appRoot, "node_modules");

await rm(appRoot, { recursive: true, force: true });
await mkdir(stagedNodeModules, { recursive: true });
await cp(join(shellRoot, "out"), join(appRoot, "out"), {
  recursive: true,
  filter: (source) => !source.endsWith(".map"),
});

const sourcePackage = JSON.parse(await readFile(join(shellRoot, "package.json"), "utf8"));
await writeFile(
  join(appRoot, "package.json"),
  `${JSON.stringify({
    name: sourcePackage.name,
    version: sourcePackage.version,
    description: sourcePackage.description ?? "Karya Desktop",
    author: sourcePackage.author ?? "Karya",
    private: true,
    type: sourcePackage.type,
    main: sourcePackage.main,
    dependencies: {
      "better-sqlite3": sourcePackage.dependencies["better-sqlite3"],
      bindings: "^1.5.0",
      "file-uri-to-path": "1.0.0",
    },
  }, null, 2)}\n`,
);

const betterSqliteRoot = await copyPackage("better-sqlite3", [shellRoot]);
const bindingsRoot = await copyPackage("bindings", [betterSqliteRoot, shellRoot]);
await copyPackage("file-uri-to-path", [bindingsRoot, shellRoot]);
await mkdir(join(stagedNodeModules, "better-sqlite3", "node_modules"), { recursive: true });
await cp(join(stagedNodeModules, "bindings"), join(stagedNodeModules, "better-sqlite3", "node_modules", "bindings"), { recursive: true });
await mkdir(join(stagedNodeModules, "better-sqlite3", "node_modules", "bindings", "node_modules"), { recursive: true });
await cp(
  join(stagedNodeModules, "file-uri-to-path"),
  join(stagedNodeModules, "better-sqlite3", "node_modules", "bindings", "node_modules", "file-uri-to-path"),
  { recursive: true },
);
await trimBetterSqlitePackage();

async function copyPackage(packageName, paths) {
  const packageJsonPath = require.resolve(`${packageName}/package.json`, { paths });
  const packageRoot = dirname(packageJsonPath);
  await cp(packageRoot, join(stagedNodeModules, packageName), {
    recursive: true,
    dereference: true,
    filter: (source) => !source.includes(`${packageName}/node_modules/.bin`),
  });
  return packageRoot;
}

async function trimBetterSqlitePackage() {
  const packageJsonPath = join(stagedNodeModules, "better-sqlite3", "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  packageJson.dependencies = {
    bindings: packageJson.dependencies.bindings,
  };
  delete packageJson.devDependencies;
  delete packageJson.scripts;
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}
