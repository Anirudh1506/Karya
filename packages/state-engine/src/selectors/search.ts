import type { InstalledApplication, Resource, SearchResult, Workspace } from "@karya/types";

export function deriveSearchSuggestions(resources: Resource[], applications: InstalledApplication[], workspaces: Workspace[] = []): string[] {
  return [...new Set([
    ...resources.flatMap((resource) => [resource.metadata.title, ...resource.tags]),
    ...workspaces.map((workspace) => workspace.name),
    ...applications.map((application) => application.metadata.name),
  ])].slice(0, 8);
}

export function searchResources(resources: Resource[], query: string): SearchResult[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [];

  return resources
    .filter((resource) => resource.lifecycleState !== "deleted")
    .map((resource) => {
      const title = resource.metadata.title.toLocaleLowerCase();
      const type = resource.type.toLocaleLowerCase();
      const tags = resource.tags.join(" ").toLocaleLowerCase();
      let score = 0;

      if (title === normalized) score += 100;
      if (title.includes(normalized)) score += 50;
      if (type.includes(normalized)) score += 20;
      if (tags.includes(normalized)) score += 10;

      return {
        document: {
          id: `resource:${resource.id}`,
          type: "resource" as const,
          title: resource.metadata.title,
          subtitle: resource.type,
          keywords: resource.tags,
          sourceId: resource.id,
        },
        score,
      };
    })
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score);
}
