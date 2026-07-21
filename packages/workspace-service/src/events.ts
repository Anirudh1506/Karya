import type { WorkspaceDomainEvent } from "@karya/domain";
import type { EventBus } from "@karya/event-bus";
import type { Workspace } from "@karya/types";

export async function publishWorkspaceDomainEvent(
  eventBus: EventBus,
  event: WorkspaceDomainEvent,
  workspace: Workspace,
): Promise<void> {
  if (event.name === "WorkspaceCreated") {
    await eventBus.publish("WorkspaceCreated", { workspace });
    await eventBus.publish("workspace:created", { workspace });
    await eventBus.publish("ActiveWorkspaceChanged", { workspaceId: workspace.id });
  } else if (event.name === "WorkspaceOpened") {
    await eventBus.publish("WorkspaceOpened", { workspace, workspaceId: workspace.id });
    await eventBus.publish("workspace:opened", { workspace, workspaceId: workspace.id });
    await eventBus.publish("ActiveWorkspaceChanged", { workspaceId: workspace.id });
  } else if (event.name === "WorkspaceClosed") {
    await eventBus.publish("WorkspaceClosed", { workspace, workspaceId: workspace.id });
    await eventBus.publish("workspace:closed", { workspace, workspaceId: workspace.id });
    await eventBus.publish("ActiveWorkspaceChanged", { workspaceId: undefined });
  } else if (event.name === "WorkspaceRenamed") {
    await eventBus.publish("WorkspaceRenamed", { workspace });
  } else if (event.name === "WorkspaceArchived") {
    await eventBus.publish("WorkspaceArchived", { workspace });
    await eventBus.publish("ActiveWorkspaceChanged", { workspaceId: undefined });
  } else if (event.name === "WorkspaceRestored") {
    await eventBus.publish("WorkspaceRestored", { workspace });
    await eventBus.publish("workspace:restored", { workspace, workspaceId: workspace.id });
  } else if (event.name === "WorkspaceDeleted") {
    await eventBus.publish("WorkspaceDeleted", { workspace });
    await eventBus.publish("ActiveWorkspaceChanged", { workspaceId: undefined });
  } else if (event.name === "WorkspacePinned") {
    await eventBus.publish("WorkspacePinned", { workspace });
  } else if (event.name === "WorkspaceApplicationPinned") {
    await eventBus.publish("WorkspaceApplicationPreferred", {
      workspace,
      applicationId: event.payload.applicationId.value,
    });
  } else if (event.name === "WorkspaceApplicationUnpinned") {
    await eventBus.publish("WorkspaceApplicationUnpreferred", {
      workspace,
      applicationId: event.payload.applicationId.value,
    });
  } else if (event.name === "WorkspaceLaunchSetUpdated") {
    await eventBus.publish("WorkspaceLaunchSetUpdated", { workspace });
  } else if (event.name === "WorkspaceSettingsUpdated") {
    await eventBus.publish("WorkspaceSettingsUpdated", { workspace });
  }

  await eventBus.publish("WorkspaceUpdated", { workspace });
}
