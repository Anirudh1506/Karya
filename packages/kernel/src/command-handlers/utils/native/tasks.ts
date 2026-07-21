import type { Resource } from "@karya/types";
import type { CommandContext } from "../resource-context";
import { registryUpdateMetadata, resolveImportDestination } from "../resource-context";
import { readTaskBoolean, readTaskBooleanList, readTaskList, readTaskString } from "./attributes";
import { noteContentToPlainText, summarizeTask } from "./notes";

export async function createNativeTask(
  input: {
    title?: string;
    description: string;
    checklistItems: string[];
    checklistCompleted: boolean[];
    labels: string[];
    status: string;
    priority: string;
    dueDate?: string;
    reminderAt?: string;
    reminderDate?: string;
    reminderTime?: string;
    reminderRepeat?: string;
    pinned: boolean;
    parentTaskId?: string;
    destination: Awaited<ReturnType<typeof resolveImportDestination>>;
    tags: string[];
  },
  context: Pick<CommandContext, "registry">,
): Promise<Resource> {
  const now = new Date().toISOString();
  return context.registry.resolve("resourceService").create({
    displayTitle: input.title?.trim() || "Untitled Task",
    description: summarizeTask(input.description),
    type: "application/vnd.karya.task",
    owner: input.destination.profileId,
    profileId: input.destination.profileId,
    workspaceRefs: input.destination.workspaceRefs,
    primaryWorkspaceId: input.destination.primaryWorkspaceId,
    defaultSpace: input.destination.defaultSpace,
    tags: input.tags,
    metadata: {
      kind: "task",
      attributes: createTaskAttributes({
        description: input.description,
        checklistItems: input.checklistItems,
        checklistCompleted: input.checklistCompleted,
        labels: input.labels,
        status: input.status,
        priority: input.priority,
        dueDate: input.dueDate,
        reminderAt: input.reminderAt,
        reminderDate: input.reminderDate,
        reminderTime: input.reminderTime,
        reminderRepeat: input.reminderRepeat,
        pinned: input.pinned,
        parentTaskId: input.parentTaskId,
        createdAt: now,
        updatedAt: now,
      }),
    },
  });
}

export async function updateNativeTask(
  resource: Resource,
  patch: {
    title?: string;
    description?: string;
    checklistItems?: string[];
    checklistCompleted?: boolean[];
    labels?: string[];
    status?: string;
    priority?: string;
    dueDate?: string;
    reminderAt?: string;
    reminderDate?: string;
    reminderTime?: string;
    reminderRepeat?: string;
    pinned?: boolean;
    tags?: string[];
    parentTaskId?: string;
  },
  context: CommandContext,
): Promise<Resource> {
  const now = new Date().toISOString();
  const nextStatus = patch.status ?? readTaskString(resource, "taskStatus") ?? "todo";
  const completedAt = nextStatus === "completed" ? (readTaskString(resource, "taskCompletedAt") ?? now) : "";
  return registryUpdateMetadata(context, resource.id, {
    title: patch.title?.trim() || resource.metadata.title,
    description:
      typeof patch.description === "string" ? summarizeTask(patch.description) : resource.metadata.description,
    attributes: {
      ...(resource.metadata.attributes ?? {}),
      ...createTaskAttributes({
        description: patch.description ?? readTaskString(resource, "taskDescription") ?? "",
        checklistItems: patch.checklistItems ?? readTaskList(resource, "taskChecklistItems"),
        checklistCompleted: patch.checklistCompleted ?? readTaskBooleanList(resource, "taskChecklistCompleted"),
        labels: patch.labels ?? readTaskList(resource, "taskLabels"),
        status: nextStatus,
        priority: patch.priority ?? readTaskString(resource, "taskPriority") ?? "none",
        dueDate: patch.dueDate ?? readTaskString(resource, "taskDueDate") ?? "",
        reminderAt: patch.reminderAt ?? readTaskString(resource, "taskReminderAt") ?? "",
        reminderDate: patch.reminderDate ?? readTaskString(resource, "taskReminderDate") ?? "",
        reminderTime: patch.reminderTime ?? readTaskString(resource, "taskReminderTime") ?? "",
        reminderRepeat: patch.reminderRepeat ?? readTaskString(resource, "taskReminderRepeat") ?? "none",
        pinned: patch.pinned ?? readTaskBoolean(resource, "taskPinned"),
        parentTaskId: patch.parentTaskId ?? readTaskString(resource, "taskParentId") ?? "",
        createdAt: readTaskString(resource, "taskCreatedAt") ?? resource.metadata.createdAt,
        updatedAt: now,
        completedAt,
      }),
    },
  });
}

export function isKaryaTask(resource: Resource): boolean {
  return resource.metadata.kind === "task" || resource.type === "application/vnd.karya.task";
}

export function createTaskAttributes(input: {
  description: string;
  checklistItems: string[];
  checklistCompleted: boolean[];
  labels: string[];
  status: string;
  priority: string;
  dueDate?: string;
  reminderAt?: string;
  reminderDate?: string;
  reminderTime?: string;
  reminderRepeat?: string;
  pinned: boolean;
  parentTaskId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}): NonNullable<Resource["metadata"]["attributes"]> {
  const description = input.description ?? "";
  return {
    taskDescription: description,
    taskDescriptionFormat: "html",
    taskChecklistItems: input.checklistItems.join("\n"),
    taskChecklistCompleted: input.checklistCompleted.map((checked) => (checked ? "1" : "0")).join("\n"),
    taskLabels: input.labels.join("\n"),
    taskStatus: input.status,
    taskPriority: input.priority,
    taskDueDate: input.dueDate ?? "",
    taskReminderAt: input.reminderAt ?? "",
    taskReminderDate: input.reminderDate ?? "",
    taskReminderTime: input.reminderTime ?? "",
    taskReminderRepeat: input.reminderRepeat ?? "none",
    taskPinned: input.pinned,
    taskParentId: input.parentTaskId ?? "",
    taskCompletedAt: input.completedAt ?? "",
    taskCreatedAt: input.createdAt,
    taskUpdatedAt: input.updatedAt,
    taskDescriptionText: noteContentToPlainText(description),
  };
}
