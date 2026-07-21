import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

const karyaAliases = {
  "@karya/application-registry": resolve("../../packages/application-registry/src/index.ts"),
  "@karya/activity-service": resolve("../../packages/activity-service/src/index.ts"),
  "@karya/content-store/node": resolve("../../packages/content-store/src/filesystem-content-store.ts"),
  "@karya/content-store": resolve("../../packages/content-store/src/index.ts"),
  "@karya/command-registry": resolve("../../packages/command-registry/src/index.ts"),
  "@karya/continuity-service": resolve("../../packages/continuity-service/src/index.ts"),
  "@karya/core": resolve("../../packages/core/src/index.ts"),
  "@karya/domain": resolve("../../packages/domain/src/index.ts"),
  "@karya/event-bus": resolve("../../packages/event-bus/src/index.ts"),
  "@karya/event-service": resolve("../../packages/event-service/src/index.ts"),
  "@karya/import-service/node": resolve("../../packages/import-service/src/node-import-source-provider.ts"),
  "@karya/import-service": resolve("../../packages/import-service/src/index.ts"),
  "@karya/kernel": resolve("../../packages/kernel/src/index.ts"),
  "@karya/metadata-store": resolve("../../packages/metadata-store/src/index.ts"),
  "@karya/notification-service": resolve("../../packages/notification-service/src/index.ts"),
  "@karya/persistence": resolve("../../packages/persistence/src/index.ts"),
  "@karya/platform": resolve("../../packages/platform/src/index.ts"),
  "@karya/profile-service": resolve("../../packages/profile-service/src/index.ts"),
  "@karya/query-service": resolve("../../packages/query-service/src/index.ts"),
  "@karya/relationship-service": resolve("../../packages/relationship-service/src/index.ts"),
  "@karya/resource-service": resolve("../../packages/resource-service/src/index.ts"),
  "@karya/search-service": resolve("../../packages/search-service/src/index.ts"),
  "@karya/settings-service": resolve("../../packages/settings-service/src/index.ts"),
  "@karya/shell-adapter": resolve("../../packages/shell-adapter/src/index.ts"),
  "@karya/state-engine": resolve("../../packages/state-engine/src/index.ts"),
  "@karya/types": resolve("../../packages/types/src/index.ts"),
  "@karya/workspace-service": resolve("../../packages/workspace-service/src/index.ts"),
};

const bundledWorkspacePackages = [
  "@karya/core",
  "@karya/content-store",
  "@karya/command-registry",
  "@karya/domain",
  "@karya/event-bus",
  "@karya/event-service",
  "@karya/import-service",
  "@karya/kernel",
  "@karya/metadata-store",
  "@karya/notification-service",
  "@karya/persistence",
  "@karya/platform",
  "@karya/state-engine",
  "@karya/shell-adapter",
  "@karya/types",
  "@karya/application-registry",
  "@karya/activity-service",
  "@karya/continuity-service",
  "@karya/profile-service",
  "@karya/query-service",
  "@karya/relationship-service",
  "@karya/resource-service",
  "@karya/search-service",
  "@karya/settings-service",
  "@karya/workspace-service",
];

export default defineConfig(({ mode }) => {
  const isProduction = mode === "production";
  const build = {
    minify: isProduction ? ("esbuild" as const) : false,
    sourcemap: !isProduction,
    reportCompressedSize: isProduction,
    emptyOutDir: true,
    rollupOptions: {
      treeshake: isProduction,
      external: ["electron"],
    },
  };
  const esbuild = isProduction
    ? {
        drop: ["console", "debugger"] as Array<"console" | "debugger">,
        legalComments: "none" as const,
      }
    : undefined;

  return {
    main: {
      resolve: {
        alias: karyaAliases,
      },
      build,
      esbuild,
      plugins: [
        externalizeDepsPlugin({
          exclude: bundledWorkspacePackages,
        }),
      ],
    },
    preload: {
      build,
      esbuild,
      plugins: [externalizeDepsPlugin()],
    },
    renderer: {
      resolve: {
        alias: {
          "@renderer": resolve("src/renderer"),
        },
      },
      build: {
        ...build,
        cssMinify: isProduction,
      },
      esbuild,
      plugins: [react()],
    },
  };
});
