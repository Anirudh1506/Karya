import type { ResourceDomainEvent } from "@karya/domain";
import type { EventBus } from "@karya/event-bus";
import type { Resource } from "@karya/types";

export async function publishResourceDomainEvent(
  eventBus: EventBus,
  event: ResourceDomainEvent,
  resource: Resource,
): Promise<void> {
  if (event.name === "ResourceCreated") {
    await eventBus.publish("ResourceCreated", { resource });
    await eventBus.publish("resource:created", { resource });
    return;
  }

  if (event.name === "ResourceDeleted") {
    await eventBus.publish("ResourceDeleted", { resource });
  } else if (event.name === "ResourceArchived") {
    await eventBus.publish("ResourceArchived", { resource });
  } else if (event.name === "ResourceRestored") {
    await eventBus.publish("ResourceRestored", { resource });
  } else if (event.name === "ResourceRenamed") {
    await eventBus.publish("ResourceRenamed", { resource });
  } else if (event.name === "WorkspaceReferenceAdded") {
    await eventBus.publish("WorkspaceReferenceAdded", { resource, workspaceId: event.payload.workspaceId.value });
  } else if (event.name === "WorkspaceReferenceRemoved") {
    await eventBus.publish("WorkspaceReferenceRemoved", { resource, workspaceId: event.payload.workspaceId.value });
  } else if (event.name === "MetadataUpdated") {
    await eventBus.publish("MetadataUpdated", { resource });
  }

  await eventBus.publish("ResourceUpdated", { resource });
  await eventBus.publish("resource:updated", { resource });
}
