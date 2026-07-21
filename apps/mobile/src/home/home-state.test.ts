import { describe, expect, it } from "vitest";
import { createKaryaCore } from "@karya/core";
import { linking } from "../navigation/linking";
import { selectHomeState } from "./home-state";

describe("Home composition", () => {
  it("renders restored Core state and reacts to Resource and context events without local state", async () => {
    const core = createKaryaCore({ seed: { includeDemoContent: false } });
    await core.boot();

    const initial = selectHomeState(core.shell.getSnapshotSync());
    expect(initial.profile?.id).toBe("profile-primary");
    expect(initial.workspace).toBeDefined();
    expect(initial.continueWorking).toEqual([]);
    expect(initial.recentResources).toEqual([]);

    const created = await core.shell.createNote(undefined, "Home note", "");
    const afterCreateSnapshot = core.shell.getSnapshotSync();
    const afterCreate = selectHomeState(afterCreateSnapshot);
    expect(afterCreate.continueWorking[0]?.resourceId).toBe(created.id);
    expect(afterCreate.recentResources[0]?.id).toBe(created.id);
    expect(afterCreate.continueWorking).toBe(afterCreateSnapshot.continuity.continueWorking);
    expect(afterCreate.recentResources).toBe(
      afterCreateSnapshot.resources.recentModifiedByWorkspace[afterCreate.workspace?.id ?? ""],
    );

    await core.shell.archiveResource(created.id);
    expect(selectHomeState(core.shell.getSnapshotSync()).recentResources).toEqual([]);

    await core.shell.createProfile("Another profile");
    const switched = selectHomeState(core.shell.getSnapshotSync());
    expect(switched.profile?.name).toBe("Another profile");
    expect(switched.continueWorking).toEqual([]);
    expect(switched.recentResources).toEqual([]);
    await core.shutdown();
  });

  it("keeps Home as the launch route while existing routes remain authoritative", () => {
    expect(linking.config?.screens).toMatchObject({
      Profiles: "profiles",
      Workspaces: "workspaces/:workspaceId?",
      CreateResource: "resources/new",
      ResourceDetail: "resources/:resourceId",
    });
    expect(linking.config?.screens).not.toHaveProperty("Home");
  });
});
