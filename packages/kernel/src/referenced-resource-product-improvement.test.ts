import { NoopPlatformProviders } from "@karya/platform";
import { describe, expect, it } from "vitest";
import { createKaryaCore } from "./factory";

describe("Referenced Resource product behavior", () => {
  it("references files and folders without reading their contents and delegates folder opening to the system", async () => {
    const platform = new NoopPlatformProviders();
    const openedPaths: string[] = [];
    const launchedApplicationIds: string[] = [];
    let contentReadCount = 0;

    const textApplication = {
      metadata: {
        id: "application-notes",
        name: "Notes",
        description: "A text-capable application",
        icon: "notes",
        version: "1",
        platform: "darwin" as const,
        supportedFileTypes: ["txt"],
        capabilities: [],
      },
      installedAt: "2026-07-17T00:00:00.000Z",
      lifecycleState: "available" as const,
      pinned: false,
      favorite: false,
      hidden: false,
      defaultApplication: true,
      launchCount: 0,
    };
    platform.applications.discoverInstalledApplications = async () => [textApplication];
    platform.applications.launch = async (applicationId) => {
      launchedApplicationIds.push(applicationId);
    };

    platform.fileSystem.getMetadata = async (path) => ({
      path,
      name: path.split("/").at(-1) ?? path,
      kind: path.includes(".") ? "file" : "directory",
      byteLength: path.includes(".") ? 4_000_000 : 0,
      extension: path.split(".").at(-1),
      mimeType: path.endsWith(".txt") ? "text/plain" : path.endsWith(".md") ? "text/markdown" : "inode/directory",
      modifiedAt: "2026-07-17T00:00:00.000Z",
      fileSystemId: `filesystem:${path}`,
    });
    platform.fileSystem.readTextFile = async () => {
      contentReadCount += 1;
      return "external file content must remain outside Karya";
    };
    platform.fileSystem.exists = async () => true;
    platform.fileSystem.openPath = async (path) => {
      openedPaths.push(path);
    };

    const core = createKaryaCore({ platform, seed: { includeDemoContent: false } });
    await core.boot();

    const folder = await core.shell.linkResource("/work/backend-api");
    const file = await core.shell.linkResource("/work/research.md");
    const textFile = await core.shell.linkResource("/work/observations.txt");
    const desktopReference = await core.shell.linkResource("/work/desktop-reference.md", undefined, {
      profileId: "desktop-user",
      workspaceId: "workspace-desktop-home-default-space",
      defaultSpace: "user",
    });

    expect(folder.metadata.attributes?.resourceLocationKind).toBe("local-linked");
    expect(file.metadata.attributes?.resourceLocationKind).toBe("local-linked");
    expect(desktopReference).toMatchObject({
      profileId: "desktop-user",
      workspaceRefs: ["workspace-desktop-home-default-space"],
      primaryWorkspaceId: "workspace-desktop-home-default-space",
      defaultSpace: "user",
    });
    expect(contentReadCount).toBe(0);

    await core.shell.openFolderResource(folder.id);
    await core.shell.openResource(textFile.id);
    expect(openedPaths).toEqual(["/work/backend-api", "/work/observations.txt"]);
    expect(launchedApplicationIds).toEqual([]);
    expect((await core.shell.getSnapshot()).shell.activeSurface.type).not.toBe("folder");

    await core.shutdown();
  });

  it("synchronizes reference metadata without external content while retaining native note content", async () => {
    const platform = new NoopPlatformProviders();
    platform.fileSystem.getMetadata = async (path) => ({
      path,
      name: "research.md",
      kind: "file",
      byteLength: 512,
      extension: "md",
      mimeType: "text/markdown",
    });

    const core = createKaryaCore({ platform, seed: { includeDemoContent: false } });
    await core.boot();

    const referenced = await core.shell.linkResource("/outside/research.md");
    await core.shell.updateResourceMetadata(referenced.id, {
      attributes: {
        ...referenced.metadata.attributes,
        noteIndexedContent: "EXTERNAL_SECRET_CONTENT",
      },
    });

    const referenceOperations = (await core.shell.pendingSyncOperations()).filter(
      (operation) => operation.entityId === referenced.id,
    );
    expect(referenceOperations.length).toBeGreaterThan(0);
    expect(referenceOperations.every((operation) => !operation.payload.includes("EXTERNAL_SECRET_CONTENT"))).toBe(true);
    expect(referenceOperations.some((operation) => operation.payload.includes("/outside/research.md"))).toBe(true);

    const native = await core.shell.createNote(undefined, "Native note", "Owned by Karya");
    const edit = await core.shell.openEditSession(native.id);
    await core.shell.updateEditContent(edit.session.id, "Owned by Karya and synchronized");
    await core.shell.flushEditSession(edit.session.id);

    const nativeContentOperations = (await core.shell.pendingSyncOperations()).filter(
      (operation) => operation.entityId === native.id && operation.entityType === "resource-content",
    );
    expect(nativeContentOperations).toHaveLength(1);
    expect(nativeContentOperations[0]?.payload).toContain("Owned by Karya and synchronized");

    await core.shutdown();
  });
});
