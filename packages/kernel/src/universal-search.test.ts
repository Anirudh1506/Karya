import { describe, expect, it } from "vitest";
import { InMemoryEventBus } from "@karya/event-bus";
import { InMemorySearchService } from "@karya/search-service";
import type { SessionRepository } from "@karya/persistence";
import type { ContinuitySession } from "@karya/types";
import { createKaryaCore } from "./factory";
import { createSeedData } from "./seed-data";

describe("Universal Search", () => {
  it("uses the inverted index to isolate candidates in a large metadata collection", async () => {
    const service = new InMemorySearchService(new InMemoryEventBus());
    await service.index(
      Array.from({ length: 2_000 }, (_, index) => ({
        id: `resource:${index}`,
        type: "resource" as const,
        title: `Document ${index}`,
        subtitle: `metadata-${index}`,
        keywords: [`tag-${index}`],
        sourceId: String(index),
      })),
    );
    const results = await service.query("metadata-1731", { types: ["resource"] });
    expect(results.map((result) => result.document.sourceId)).toEqual(["1731"]);
  });

  it("indexes metadata incrementally and ranks active context deterministically", async () => {
    const core = createKaryaCore({ seed: { includeDemoContent: false } });
    await core.boot();
    const firstWorkspace = core.shell.getSnapshotSync().workspaces.active!;
    const first = await core.shell.createNote(undefined, "Project Atlas", "secret body text");
    const secondWorkspace = await core.shell.createWorkspace("Atlas Studio", "Planning workspace");
    const second = await core.shell.createNote(undefined, "Project Atlas", "");
    await core.shell.openWorkspace(firstWorkspace.id);

    const exact = await core.shell.search("Project Atlas");
    expect(
      exact.filter((result) => result.document.type === "resource").map((result) => result.document.sourceId),
    ).toEqual([first.id, second.id]);
    expect(exact[0]?.matches?.[0]?.kind).toBe("exact");
    expect(
      (await core.shell.search("Atlas")).some((result) =>
        result.matches?.some((match) => match.kind === "word-boundary"),
      ),
    ).toBe(true);
    expect((await core.shell.search("Planning workspace"))[0]?.document.sourceId).toBe(secondWorkspace.id);
    expect((await core.shell.search("secret body text"))[0]?.document.sourceId).toBe(first.id);

    await core.shell.renameResource(first.id, "Atlas Plan");
    expect((await core.shell.search("Atlas Pl"))[0]?.matches?.[0]?.kind).toBe("prefix");
    await core.shell.archiveResource(first.id);
    expect((await core.shell.search("Atlas Plan")).map((result) => result.document.sourceId)).not.toContain(first.id);
    await core.shell.restoreResource(first.id);
    expect((await core.shell.search("Atlas Plan")).map((result) => result.document.sourceId)).toContain(first.id);

    await core.shell.archiveWorkspace(secondWorkspace.id);
    expect((await core.shell.search("Atlas Studio")).map((result) => result.document.sourceId)).not.toContain(
      secondWorkspace.id,
    );
    await core.shell.restoreWorkspace(secondWorkspace.id);
    expect((await core.shell.search("Atlas Studio")).map((result) => result.document.sourceId)).toContain(
      secondWorkspace.id,
    );

    const otherProfile = await core.shell.createProfile("Searchable Profile");
    await core.shell.switchProfile("profile-primary");
    expect((await core.shell.search("Searchable Profile"))[0]?.document.sourceId).toBe(otherProfile.id);
    await core.shell.archiveProfile(otherProfile.id);
    expect(
      (await core.shell.search("Searchable Profile")).filter((result) => result.document.type === "profile"),
    ).toEqual([]);
    await core.shell.restoreProfile(otherProfile.id);
    expect((await core.shell.search("Searchable Profile"))[0]?.document.sourceId).toBe(otherProfile.id);
    await core.shutdown();
  });

  it("restores result context through Core before opening a Resource", async () => {
    const core = createKaryaCore({ seed: { includeDemoContent: false } });
    await core.boot();
    const originalWorkspaceId = core.shell.getSnapshotSync().workspaces.active!.id;
    const targetWorkspace = await core.shell.createWorkspace("Remote Workspace");
    const target = await core.shell.createNote(undefined, "Remote Result", "");
    await core.shell.openWorkspace(originalWorkspaceId);
    const result = (await core.shell.search("Remote Result"))[0]!;

    await core.shell.openSearchResult(result, "Remote Result");

    expect(core.shell.getSnapshotSync().profiles.active?.id).toBe(target.profileId);
    expect(core.shell.getSnapshotSync().workspaces.active?.id).toBe(targetWorkspace.id);
    expect(core.shell.getSnapshotSync().resources.selectedId).toBe(target.id);
    expect((await core.shell.recentSearches())[0]?.query).toBe("Remote Result");
    await core.shutdown();
  });

  it("persists deduplicated recent searches across Core restart", async () => {
    const seed = createSeedData({ includeDemoContent: false });
    const sessions = sessionRepository(seed.session);
    const first = createKaryaCore({ seed: { includeDemoContent: false }, persistence: { sessions } });
    await first.boot();
    await first.shell.recordSearch("Atlas");
    await first.shell.recordSearch("atlas");
    await first.shutdown();

    const second = createKaryaCore({ seed: { includeDemoContent: false }, persistence: { sessions } });
    await second.boot();
    expect(await second.shell.recentSearches()).toHaveLength(1);
    expect((await second.shell.recentSearches())[0]?.query).toBe("atlas");
    await second.shell.clearRecentSearches();
    expect(await second.shell.recentSearches()).toEqual([]);
    await second.shutdown();
  });
});

function sessionRepository(initial: ContinuitySession): SessionRepository {
  let current = initial;
  return {
    async list() {
      return [current];
    },
    async get(id) {
      return id === current.id ? current : undefined;
    },
    async save(session) {
      current = session;
    },
    async delete() {},
    async getCurrent() {
      return current;
    },
    async saveCurrent(session) {
      current = session;
    },
  };
}
