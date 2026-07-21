import { describe, expect, it } from "vitest";
import { createKaryaCore } from "./factory";

const personas = [
  { role: "Student", workspace: "Thesis research", capture: "Argument about local-first tools" },
  { role: "Engineer", workspace: "Release reliability", capture: "Investigate startup regression" },
  { role: "Founder", workspace: "Company strategy", capture: "Customer interview insight" },
  { role: "Designer", workspace: "Mobile interaction", capture: "Reduce context-switching friction" },
  { role: "Researcher", workspace: "Field study", capture: "Contradictory source to revisit" },
  { role: "Writer", workspace: "Long-form essay", capture: "Opening scene and central question" },
] as const;

const measurements: Array<{
  role: string;
  startupMs: number;
  captureMs: number;
  editAndSaveMs: number;
  searchAndRestoreMs: number;
  resumeMs: number;
}> = [];

describe.sequential("Karya v1.0 Alpha product workflows", () => {
  it.each(personas)("supports a realistic focused-work cycle for a $role", async (persona) => {
    const core = createKaryaCore({ seed: { includeDemoContent: false }, editing: { autosaveDelayMs: 60_000 } });
    const startupStarted = performance.now();
    await core.boot();
    const startupMs = performance.now() - startupStarted;

    await core.shell.createProfile(persona.role);
    const workspace = await core.shell.createWorkspace(persona.workspace, `Primary work for the ${persona.role}`);

    const captureStarted = performance.now();
    const capture = await core.shell.beginCapture();
    const resource = await core.shell.completeCapture(capture.id, persona.capture);
    const captureMs = performance.now() - captureStarted;

    const supporting = await Promise.all(
      Array.from({ length: 12 }, async (_, index) => {
        const session = await core.shell.beginCapture();
        return core.shell.completeCapture(session.id, `${persona.workspace} reference ${index + 1}`);
      }),
    );

    const editingStarted = performance.now();
    const editing = await core.shell.openEditSession(resource.id);
    const longNote = Array.from(
      { length: 300 },
      (_, index) => `${index + 1}. ${persona.capture}: evidence, decision, and next action.`,
    ).join("\n");
    await core.shell.updateEditContent(editing.session.id, longNote);
    await core.shell.flushEditSession(editing.session.id);
    await core.shell.closeEditSession(editing.session.id);
    const editAndSaveMs = performance.now() - editingStarted;

    const alternate = await core.shell.createWorkspace(`${persona.role} inbox`, "Temporary incoming work");
    const incoming = await core.shell.createNote(undefined, `${persona.role} follow-up`, "");
    expect(incoming.primaryWorkspaceId).toBe(alternate.id);

    const searchStarted = performance.now();
    const result = (await core.shell.search(persona.capture))[0];
    expect(result?.document.sourceId).toBe(resource.id);
    await core.shell.openSearchResult(result!, persona.capture);
    const searchAndRestoreMs = performance.now() - searchStarted;

    expect(core.shell.getSnapshotSync().profiles.active?.name).toBe(persona.role);
    expect(core.shell.getSnapshotSync().workspaces.active?.id).toBe(workspace.id);
    expect(core.shell.getSnapshotSync().resources.selectedId).toBe(resource.id);
    expect(core.shell.getSnapshotSync().continuity.continueWorking[0]?.resourceId).toBe(resource.id);

    const resumeStarted = performance.now();
    await core.suspend();
    await core.resume();
    const resumeMs = performance.now() - resumeStarted;

    const restored = core.shell.getSnapshotSync();
    expect(restored.profiles.active?.name).toBe(persona.role);
    expect(restored.workspaces.active?.id).toBe(workspace.id);
    expect(restored.continuity.continueWorking[0]?.resourceId).toBe(resource.id);
    expect(restored.resources.all).toHaveLength(supporting.length + 2);
    expect((await core.shell.recentActivities(100)).length).toBeGreaterThan(0);
    expect((await core.shell.search(`${persona.workspace} reference`)).length).toBe(supporting.length);

    measurements.push({ role: persona.role, startupMs, captureMs, editAndSaveMs, searchAndRestoreMs, resumeMs });
    await core.shutdown();
  });

  it("reports product workflow measurements for every internal persona", () => {
    expect(measurements).toHaveLength(personas.length);
    expect(
      measurements.every((measurement) =>
        Object.values(measurement).every((value) => typeof value !== "number" || value >= 0),
      ),
    ).toBe(true);
    console.info(`KARYA_ALPHA_PRODUCT_METRICS=${JSON.stringify(measurements)}`);
  });
});
