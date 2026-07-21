import type { Resource } from "@karya/types";
import type { CommandContext } from "../resource-context";
import { registryUpdateMetadata, resolveImportDestination } from "../resource-context";
import { readTaskBoolean, readTaskList, readTaskString } from "./attributes";

export async function createNativeBookmark(
  input: {
    url: string;
    title?: string;
    description?: string;
    websiteName?: string;
    favicon?: string;
    previewImage?: string;
    notes: string;
    labels: string[];
    readingStatus: string;
    favorite: boolean;
    pinned: boolean;
    destination: Awaited<ReturnType<typeof resolveImportDestination>>;
    tags: string[];
  },
  context: Pick<CommandContext, "registry">,
): Promise<Resource> {
  const now = new Date().toISOString();
  const normalizedUrl = normalizeBookmarkUrl(input.url);
  const domain = getBookmarkDomain(normalizedUrl);
  const title = input.title?.trim() || domain || normalizedUrl;
  const websiteName = input.websiteName?.trim() || domain;
  return context.registry.resolve("resourceService").create({
    displayTitle: title,
    description: input.description?.trim() || `Saved web resource from ${websiteName || "the web"}`,
    type: "application/vnd.karya.bookmark",
    owner: input.destination.profileId,
    profileId: input.destination.profileId,
    workspaceRefs: input.destination.workspaceRefs,
    primaryWorkspaceId: input.destination.primaryWorkspaceId,
    defaultSpace: input.destination.defaultSpace,
    tags: input.tags,
    metadata: {
      kind: "bookmark",
      attributes: createBookmarkAttributes({
        url: normalizedUrl,
        title,
        description: input.description ?? "",
        websiteName,
        domain,
        favicon: input.favicon || defaultFaviconUrl(normalizedUrl),
        previewImage: input.previewImage ?? "",
        notes: input.notes,
        labels: input.labels,
        readingStatus: input.readingStatus,
        favorite: input.favorite,
        pinned: input.pinned,
        createdAt: now,
        updatedAt: now,
      }),
    },
  });
}

export async function updateNativeBookmark(
  resource: Resource,
  patch: {
    title?: string;
    url?: string;
    description?: string;
    websiteName?: string;
    favicon?: string;
    previewImage?: string;
    notes?: string;
    labels?: string[];
    readingStatus?: string;
    favorite?: boolean;
    pinned?: boolean;
    tags?: string[];
  },
  context: CommandContext,
): Promise<Resource> {
  const now = new Date().toISOString();
  const nextUrl = normalizeBookmarkUrl(patch.url ?? readTaskString(resource, "bookmarkUrl") ?? "");
  const domain = getBookmarkDomain(nextUrl);
  const title = patch.title?.trim() || resource.metadata.title;
  const websiteName = patch.websiteName ?? readTaskString(resource, "bookmarkWebsiteName") ?? domain;
  return registryUpdateMetadata(context, resource.id, {
    title,
    description: typeof patch.description === "string" ? patch.description : resource.metadata.description,
    attributes: {
      ...(resource.metadata.attributes ?? {}),
      ...createBookmarkAttributes({
        url: nextUrl,
        title,
        description: patch.description ?? readTaskString(resource, "bookmarkDescription") ?? "",
        websiteName,
        domain,
        favicon: patch.favicon ?? readTaskString(resource, "bookmarkFavicon") ?? defaultFaviconUrl(nextUrl),
        previewImage: patch.previewImage ?? readTaskString(resource, "bookmarkPreviewImage") ?? "",
        notes: patch.notes ?? readTaskString(resource, "bookmarkNotes") ?? "",
        labels: patch.labels ?? readTaskList(resource, "bookmarkLabels"),
        readingStatus: patch.readingStatus ?? readTaskString(resource, "bookmarkReadingStatus") ?? "unread",
        favorite: patch.favorite ?? readTaskBoolean(resource, "bookmarkFavorite"),
        pinned: patch.pinned ?? readTaskBoolean(resource, "bookmarkPinned"),
        createdAt: readTaskString(resource, "bookmarkCreatedAt") ?? resource.metadata.createdAt,
        updatedAt: now,
      }),
    },
  });
}

export function isKaryaBookmark(resource: Resource): boolean {
  return resource.metadata.kind === "bookmark" || resource.type === "application/vnd.karya.bookmark";
}

export function createBookmarkAttributes(input: {
  url: string;
  title: string;
  description: string;
  websiteName: string;
  domain: string;
  favicon: string;
  previewImage: string;
  notes: string;
  labels: string[];
  readingStatus: string;
  favorite: boolean;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}): NonNullable<Resource["metadata"]["attributes"]> {
  return {
    bookmarkUrl: input.url,
    bookmarkTitle: input.title,
    bookmarkDescription: input.description,
    bookmarkWebsiteName: input.websiteName,
    bookmarkDomain: input.domain,
    bookmarkFavicon: input.favicon,
    bookmarkPreviewImage: input.previewImage,
    bookmarkNotes: input.notes,
    bookmarkLabels: input.labels.join("\n"),
    bookmarkReadingStatus: input.readingStatus,
    bookmarkFavorite: input.favorite,
    bookmarkPinned: input.pinned,
    bookmarkCreatedAt: input.createdAt,
    bookmarkUpdatedAt: input.updatedAt,
    bookmarkSearchText: [input.title, input.url, input.domain, input.description, input.notes, ...input.labels]
      .filter(Boolean)
      .join(" "),
  };
}

export function normalizeBookmarkUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function getBookmarkDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0] ?? url;
  }
}

export function defaultFaviconUrl(url: string): string {
  const domain = getBookmarkDomain(url);
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : "";
}
