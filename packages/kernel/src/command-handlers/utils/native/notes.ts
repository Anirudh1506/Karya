import type { Resource } from "@karya/types";
import type { CommandContext } from "../resource-context";
import { resolveImportDestination } from "../resource-context";

export async function createNativeNote(
  input: {
    title?: string;
    content: string;
    destination: Awaited<ReturnType<typeof resolveImportDestination>>;
    tags: string[];
  },
  context: Pick<CommandContext, "registry">,
): Promise<Resource> {
  return context.registry.resolve("resourceService").create({
    displayTitle: input.title?.trim() || "Untitled Note",
    description: summarizeNote(input.content),
    type: "text/markdown",
    owner: input.destination.profileId,
    profileId: input.destination.profileId,
    workspaceRefs: input.destination.workspaceRefs,
    primaryWorkspaceId: input.destination.primaryWorkspaceId,
    defaultSpace: input.destination.defaultSpace,
    tags: input.tags,
    metadata: {
      kind: "note",
      attributes: {
        noteOrigin: "native",
        noteEditableInKarya: true,
        ...createNoteContentAttributes(input.content),
      },
    },
  });
}

export function isEditableKaryaNote(resource: Resource): boolean {
  return resource.metadata.kind === "note"
    && resource.metadata.attributes?.noteEditableInKarya !== false
    && resource.metadata.attributes?.noteOrigin !== "linked";
}

export function isNoteFile(extension: string | undefined | null): boolean {
  return Boolean(extension && ["md", "markdown", "txt", "rtf"].includes(extension.toLocaleLowerCase()));
}

export function createNoteContentAttributes(content: string): NonNullable<Resource["metadata"]["attributes"]> {
  return {
    noteContent: content,
    ...createNoteTextMetrics(content),
  };
}

export function createIndexedNoteAttributes(content: string): NonNullable<Resource["metadata"]["attributes"]> {
  return {
    noteIndexedContent: content,
    ...createNoteTextMetrics(content),
  };
}

export function createNoteTextMetrics(content: string): NonNullable<Resource["metadata"]["attributes"]> {
  const text = noteContentToPlainText(content);
  const words = text.trim().split(/\s+/).filter(Boolean);
  const headings = content
    .split(/\n+/)
    .map((line) => /^#{1,6}\s+(.+)$/.exec(line.trim())?.[1] ?? /<h[1-6][^>]*>(.*?)<\/h[1-6]>/i.exec(line.trim())?.[1])
    .map((heading) => heading ? noteContentToPlainText(heading) : undefined)
    .filter((heading): heading is string => Boolean(heading));

  return {
    noteContentFormat: "html",
    noteWordCount: words.length,
    noteCharacterCount: text.length,
    noteReadingTimeMinutes: Math.max(1, Math.ceil(words.length / 220)),
    noteHeadings: headings.join("\n"),
  };
}

export function summarizeNote(content: string): string {
  return noteContentToPlainText(content)
    .replace(/^#{1,6}\s+/gm, "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 180);
}

export function summarizeTask(content: string): string {
  return noteContentToPlainText(content)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 180);
}

export function noteContentToPlainText(content: string): string {
  return content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|blockquote|pre)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
