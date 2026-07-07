import type { KernelSnapshot } from "@karya/shell-adapter";
import { Badge, Input, cn } from "@karya/ui";
import { AnimatePresence, motion } from "framer-motion";
import {
  AppWindow,
  Archive,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Command,
  CornerDownLeft,
  Eye,
  FileText,
  FolderOpen,
  MoveRight,
  Pencil,
  Search,
  Settings,
  Share2,
  UserCircle,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";

type SearchResult = KernelSnapshot["search"]["results"][number];
type SearchDocument = SearchResult["document"];

interface UniversalSearchOverlayProps {
  isOpen: boolean;
  snapshot?: KernelSnapshot;
  onClose(): void;
  onExecute(result: SearchResult): Promise<void>;
  onSearch(term: string): void;
}

export function UniversalSearchOverlay({
  isOpen,
  snapshot,
  onClose,
  onExecute,
  onSearch,
}: UniversalSearchOverlayProps): ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const query = snapshot?.search.query ?? "";
  const hasQuery = query.trim().length > 0;
  const results = useMemo(() => {
    if (!snapshot) return [];
    const sourceResults = !hasQuery
      ? buildEmptyStateResults(snapshot)
      : snapshot.search.results.length
        ? snapshot.search.results
        : buildQuickCreateResults(query);
    return rankSearchResults(uniqueSearchResults(sourceResults), snapshot, query);
  }, [hasQuery, query, snapshot]);
  const groups = useMemo(() => groupResults(results, hasQuery), [hasQuery, results]);
  const groupedItems = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const selectedResult = groupedItems[selectedIndex]?.result ?? groupedItems[0]?.result;

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
    setPreviewExpanded(false);
  }, [query, isOpen]);

  useEffect(() => {
    rowRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((index) => Math.min(index + 1, Math.max(groupedItems.length - 1, 0)));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((index) => Math.max(index - 1, 0));
        return;
      }

      if (event.key === "Tab") {
        event.preventDefault();
        setPreviewExpanded((expanded) => !expanded);
        return;
      }

      if (event.key === "Enter" && selectedResult) {
        event.preventDefault();
        void onExecute(selectedResult).then(onClose);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [groupedItems.length, isOpen, onClose, onExecute, selectedResult]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center bg-[rgba(8,16,14,0.32)] px-5 pt-[9vh] backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.section
            className={cn(
              "grid max-h-[78vh] overflow-hidden rounded-2xl border border-[var(--karya-border-strong)] bg-[var(--karya-page)] text-[var(--karya-text)] shadow-[var(--karya-shadow-panel)] backdrop-blur-2xl",
              previewExpanded
                ? "w-[min(960px,calc(100vw-40px))] grid-cols-[minmax(0,1fr)_320px]"
                : "w-[min(720px,calc(100vw-40px))] grid-cols-1",
            )}
            initial={{ opacity: 0, scale: 0.97, y: -16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -10 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            <div className="flex min-h-0 flex-col border-r border-[var(--karya-border)]">
              <div className="relative border-b border-[var(--karya-border)] p-4">
                <Search className="pointer-events-none absolute left-8 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--karya-accent)]" />
                <Input
                  ref={inputRef}
                  aria-label="Universal search"
                  className="h-12 border-[var(--karya-border)] bg-[var(--karya-control)] pl-11 pr-12 text-base text-[var(--karya-text)] placeholder:text-[var(--karya-subtle)]"
                  placeholder="Search, create, run commands, navigate, or resume..."
                  value={query}
                  onChange={(event) => onSearch(event.target.value)}
                />
                <button
                  type="button"
                  aria-label="Close search"
                  onClick={onClose}
                  className="absolute right-7 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--karya-muted)] hover:bg-[var(--karya-control-hover)] hover:text-[var(--karya-text)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center justify-between border-b border-[var(--karya-border)] px-5 py-3 text-xs text-[var(--karya-muted)]">
                <span>
                  {hasQuery
                    ? snapshot?.search.results.length
                      ? `${results.length} results`
                      : "Quick create"
                    : "Recent and suggested"}
                </span>
                <span className="flex items-center gap-3">
                  <KeyHint icon={<ArrowUp className="h-3 w-3" />} label="Move" />
                  <KeyHint icon={<ArrowDown className="h-3 w-3" />} label="Move" />
                  <KeyHint label="Preview" text="Tab" />
                  <KeyHint icon={<CornerDownLeft className="h-3 w-3" />} label="Open" />
                </span>
              </div>

              <div className="min-h-0 max-h-[calc(78vh-9rem)] flex-1 overflow-y-auto overscroll-contain p-3 pr-2">
                {groupedItems.length ? (
                  <div className="space-y-4">
                    {(() => {
                      let visualIndex = 0;
                      return groups.map((group) => (
                        <section key={group.label}>
                          <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--karya-subtle)]">
                            {group.label}
                          </p>
                          <div className="space-y-1">
                            {group.items.map(({ result }) => {
                              const rowIndex = visualIndex;
                              visualIndex += 1;
                              return (
                                <SearchResultRow
                                  key={result.document.id}
                                  result={result}
                                  rowRef={(node) => {
                                    rowRefs.current[rowIndex] = node;
                                  }}
                                  snapshot={snapshot}
                                  selected={rowIndex === selectedIndex}
                                  onMouseEnter={() => setSelectedIndex(rowIndex)}
                                  onExecute={() => void onExecute(result).then(onClose)}
                                />
                              );
                            })}
                          </div>
                        </section>
                      ));
                    })()}
                  </div>
                ) : (
                  <div className="flex h-52 flex-col items-center justify-center text-center text-sm text-[var(--karya-muted)]">
                    <Search className="mb-3 h-8 w-8 text-[var(--karya-subtle)]" />
                    No indexed operating-system objects match this search.
                  </div>
                )}
              </div>
            </div>

            {previewExpanded ? <SearchPreview result={selectedResult} snapshot={snapshot} onExecute={onExecute} /> : null}
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function SearchResultRow({
  onExecute,
  onMouseEnter,
  result,
  rowRef,
  snapshot,
  selected,
}: {
  onExecute(): void;
  onMouseEnter(): void;
  result: SearchResult;
  rowRef?(node: HTMLButtonElement | null): void;
  snapshot?: KernelSnapshot;
  selected: boolean;
}): ReactElement {
  const label = getObjectTypeLabel(result.document, snapshot);
  const shortcut = getCommandShortcut(result.document);

  return (
    <button
      ref={rowRef}
      type="button"
      onClick={onExecute}
      onMouseEnter={onMouseEnter}
      className={cn(
        "relative flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors",
        selected
          ? "bg-[var(--karya-control-hover)] text-[var(--karya-text)] ring-1 ring-[var(--karya-ring)] shadow-[inset_3px_0_0_var(--karya-accent)]"
          : "text-[var(--karya-text)] hover:bg-[var(--karya-control)]",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          selected ? "bg-[var(--karya-ring-soft)] text-[var(--karya-accent)] ring-1 ring-[var(--karya-ring)]" : "bg-[var(--karya-control)] text-[var(--karya-accent)]",
        )}
      >
        <ResultIcon type={result.document.type} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{result.document.title}</span>
        <span className={cn("block truncate text-xs", selected ? "text-[var(--karya-muted)]" : "text-[var(--karya-subtle)]")}>
          {label}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {shortcut ? (
          <kbd
            className={cn(
              "rounded-md border px-2 py-1 text-[11px] font-semibold leading-none",
              selected ? "border-[var(--karya-ring)] bg-[var(--karya-ring-soft)] text-[var(--karya-text)]" : "border-[var(--karya-border)] bg-[var(--karya-control)] text-[var(--karya-muted)]",
            )}
          >
            {shortcut}
          </kbd>
        ) : null}
        <Badge className={selected ? "border-[var(--karya-ring)] bg-[var(--karya-ring-soft)] text-[var(--karya-text)]" : "border-[var(--karya-border)] bg-[var(--karya-control)] text-[var(--karya-muted)]"}>
          {label}
        </Badge>
      </span>
    </button>
  );
}

function SearchPreview({
  result,
  snapshot,
  onExecute,
}: {
  onExecute(result: SearchResult): Promise<void>;
  result?: SearchResult;
  snapshot?: KernelSnapshot;
}): ReactElement {
  if (!result || !snapshot) {
    return (
      <aside className="flex min-h-0 flex-col justify-center p-5 text-sm text-[var(--karya-muted)]">
        Select a result to preview its operating-system context.
      </aside>
    );
  }

  const rows = getPreviewRows(result.document, snapshot);
  const actions = getPreviewActions(result.document, snapshot);

  return (
    <aside className="min-h-0 overflow-y-auto p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--karya-accent)] text-[var(--karya-bg)]">
          <ResultIcon type={result.document.type} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{result.document.title}</p>
          <p className="truncate text-xs text-[var(--karya-muted)]">{getObjectTypeLabel(result.document, snapshot)}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            disabled={!action.result}
            onClick={() => {
              if (action.result) void onExecute(action.result);
            }}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
              action.result
                ? "border-[var(--karya-border)] bg-[var(--karya-control)] text-[var(--karya-text)] hover:bg-[var(--karya-control-hover)]"
                : "cursor-not-allowed border-[var(--karya-border)] bg-[var(--karya-control)] text-[var(--karya-subtle)] opacity-60",
            )}
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="rounded-xl border border-[var(--karya-border)] bg-[var(--karya-control)] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--karya-subtle)]">{row.label}</p>
            <p className="mt-1 break-words text-sm text-[var(--karya-text)]">{row.value}</p>
          </div>
        ))}
      </div>
    </aside>
  );
}

function KeyHint({ icon, label, text }: { icon?: ReactElement; label: string; text?: string }): ReactElement {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-[var(--karya-border)] bg-[var(--karya-control)] px-1">
        {icon ?? text}
      </span>
      {label}
    </span>
  );
}

function ResultIcon({ type }: { type: SearchDocument["type"] }): ReactElement {
  switch (type) {
    case "resource":
      return <FileText className="h-4 w-4" />;
    case "event":
      return <CalendarDays className="h-4 w-4" />;
    case "notification":
      return <Archive className="h-4 w-4" />;
    case "activity":
      return <MoveRight className="h-4 w-4" />;
    case "workspace":
      return <FolderOpen className="h-4 w-4" />;
    case "profile":
      return <UserCircle className="h-4 w-4" />;
    case "application":
      return <AppWindow className="h-4 w-4" />;
    case "setting":
      return <Settings className="h-4 w-4" />;
    case "command":
      return <Command className="h-4 w-4" />;
  }
}

function buildEmptyStateResults(snapshot?: KernelSnapshot): SearchResult[] {
  if (!snapshot) return [];

  const recentQueryResults = snapshot.search.recentQueries.map((query, index) => ({
    document: {
      id: `recent-search:${query}`,
      type: "command" as const,
      title: query,
      subtitle: "Recent Search",
      keywords: [query],
      sourceId: `recent-search:${query}`,
    },
    score: 90 - index,
  }));

  const recentResources = snapshot.resources.recent.slice(0, 4).map((resource, index) => ({
    document: {
      id: `recent-resource:${resource.id}`,
      type: "resource" as const,
      title: resource.metadata.title,
      subtitle: resource.type,
      keywords: resource.tags,
      sourceId: resource.id,
    },
    score: 80 - index,
  }));

  const recentWorkspaces = snapshot.workspaces.recent.slice(0, 4).map((workspace, index) => ({
    document: {
      id: `recent-workspace:${workspace.id}`,
      type: "workspace" as const,
      title: workspace.name,
      subtitle: workspace.metadata.description ?? "Workspace",
      keywords: [workspace.lifecycleState],
      sourceId: workspace.id,
    },
    score: 70 - index,
  }));

  const recentProfiles = snapshot.profiles.recent.slice(0, 3).map((profile, index) => ({
    document: {
      id: `recent-profile:${profile.id}`,
      type: "profile" as const,
      title: profile.name,
      subtitle: profile.description ?? "Profile",
      keywords: [profile.lifecycleState ?? "profile"],
      sourceId: profile.id,
    },
    score: 68 - index,
  }));

  const recentApplications = snapshot.applications.recent.slice(0, 4).map((application, index) => ({
    document: {
      id: `recent-application:${application.metadata.id}`,
      type: "application" as const,
      title: application.metadata.name,
      subtitle: application.metadata.category ?? "Application",
      keywords: [application.metadata.category ?? "application", application.pinned ? "pinned" : "available"],
      sourceId: application.metadata.id,
    },
    score: 66 - index,
  }));

  const pinnedCommands = snapshot.search.suggestedCommands
    .filter((document) => document.keywords.some((keyword) => keyword.includes("pinned")))
    .slice(0, 4)
    .map((document, index) => ({
      document,
      score: 100 - index,
    }));

  const recentCommands = snapshot.search.suggestedCommands
    .filter((document) => document.keywords.includes("recent"))
    .slice(0, 4)
    .map((document, index) => ({
      document: { ...document, id: `recent-command:${document.id}` },
      score: 88 - index,
    }));

  const suggestedCommands = snapshot.search.suggestedCommands.slice(0, 8).map((document, index) => ({
    document,
    score: 60 - index,
  }));

  return [...pinnedCommands, ...recentCommands, ...recentQueryResults, ...recentResources, ...recentWorkspaces, ...recentProfiles, ...recentApplications, ...suggestedCommands];
}

function buildQuickCreateResults(query: string): SearchResult[] {
  const title = query.trim();
  if (!title) return [];

  return [
    quickCreateResult("quick-create-note", "Create Note", "Note", title, 100),
    quickCreateResult("quick-create-task", "Create Task", "Task", title, 98),
    quickCreateResult("quick-create-document", "Create Document", "Document", title, 95),
    quickCreateResult("quick-create-workspace", "Create Workspace", "Workspace", title, 90),
    quickCreateResult("quick-capture", "Capture", "Resource", title, 85),
  ];
}

function quickCreateResult(
  commandId: string,
  title: string,
  subtitle: string,
  query: string,
  score: number,
): SearchResult {
  return {
    document: {
      id: `command:${commandId}:${query}`,
      type: "command",
      title,
      subtitle,
      keywords: [query, "create", subtitle.toLocaleLowerCase()],
      sourceId: `${commandId}:${query}`,
    },
    score,
  };
}

function groupResults(
  results: SearchResult[],
  hasQuery: boolean,
): Array<{ label: string; items: Array<{ result: SearchResult }> }> {
  const indexed = results.map((result) => ({ result }));
  if (!hasQuery) {
    return [
      {
        label: "Recent Searches",
        items: indexed.filter(({ result }) => result.document.id.startsWith("recent-search:")),
      },
      {
        label: "Commands",
        items: indexed.filter(({ result }) => result.document.type === "command" && result.document.keywords.some((keyword) => keyword.includes("pinned"))),
      },
      section("Resources", indexed, "resource"),
      section("Workspaces", indexed, "workspace"),
      section("Profiles", indexed, "profile"),
      section("Applications", indexed, "application"),
      { label: "Suggested Commands", items: indexed.filter(({ result }) => result.document.type === "command" && !result.document.id.startsWith("recent-search:") && !result.document.keywords.some((keyword) => keyword.includes("pinned"))) },
    ].filter((group) => group.items.length > 0);
  }

  return [
    section("Commands", indexed, "command"),
    section("Resources", indexed, "resource"),
    section("Workspaces", indexed, "workspace"),
    section("Profiles", indexed, "profile"),
    section("Applications", indexed, "application"),
    section("Calendar Events", indexed, "event"),
    section("Notifications", indexed, "notification"),
    section("Activity", indexed, "activity"),
    section("Settings", indexed, "setting"),
  ].filter((group) => group.items.length > 0);
}

function section(
  label: string,
  indexed: Array<{ result: SearchResult }>,
  type: SearchDocument["type"],
): { label: string; items: Array<{ result: SearchResult }> } {
  return {
    label,
    items: indexed.filter(({ result }) => result.document.type === type),
  };
}

function uniqueSearchResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    const document = result.document;
    const key = [document.type, document.sourceId, document.title.toLocaleLowerCase()].join(":");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function rankSearchResults(results: SearchResult[], snapshot: KernelSnapshot, query: string): SearchResult[] {
  const normalizedQuery = normalizeSearchText(query);
  const activeWorkspaceId = currentSearchWorkspaceId(snapshot);
  const recentResourceIds = new Set(snapshot.resources.recent.map((resource) => resource.id));
  const recentWorkspaceIds = new Set(snapshot.workspaces.recent.map((workspace) => workspace.id));
  const recentApplicationIds = new Set(snapshot.applications.recent.map((application) => application.metadata.id));
  const preferredApplicationIds = activeWorkspaceId ? new Set(snapshot.applications.preferredByWorkspace[activeWorkspaceId] ?? []) : new Set<string>();

  return [...results].sort((left, right) => {
    const leftScore = rankedScore(left, snapshot, normalizedQuery, activeWorkspaceId, recentResourceIds, recentWorkspaceIds, recentApplicationIds, preferredApplicationIds);
    const rightScore = rankedScore(right, snapshot, normalizedQuery, activeWorkspaceId, recentResourceIds, recentWorkspaceIds, recentApplicationIds, preferredApplicationIds);
    return rightScore - leftScore;
  });
}

function rankedScore(
  result: SearchResult,
  snapshot: KernelSnapshot,
  normalizedQuery: string,
  activeWorkspaceId: string | undefined,
  recentResourceIds: Set<string>,
  recentWorkspaceIds: Set<string>,
  recentApplicationIds: Set<string>,
  preferredApplicationIds: Set<string>,
): number {
  let score = result.score;
  const title = normalizeSearchText(result.document.title);
  if (normalizedQuery && title === normalizedQuery) score += 120;
  if (normalizedQuery && title.startsWith(normalizedQuery)) score += 45;

  if (result.document.type === "resource") {
    const resource = snapshot.resources.all.find((item) => item.id === result.document.sourceId);
    if (resource) {
      if (activeWorkspaceId && (resource.primaryWorkspaceId === activeWorkspaceId || resource.workspaceRefs.includes(activeWorkspaceId))) score += 35;
      if (recentResourceIds.has(resource.id)) score += 30;
      if (resource.tags.includes("pinned")) score += 22;
    }
  }

  if (result.document.type === "workspace") {
    const workspace = snapshot.workspaces.all.find((item) => item.id === result.document.sourceId);
    if (workspace?.id === activeWorkspaceId) score += 28;
    if (workspace?.pinned) score += 24;
    if (recentWorkspaceIds.has(result.document.sourceId)) score += 18;
  }

  if (result.document.type === "application") {
    const application = snapshot.applications.installed.find((item) => item.metadata.id === result.document.sourceId);
    if (preferredApplicationIds.has(result.document.sourceId)) score += 36;
    if (application?.pinned) score += 24;
    if (recentApplicationIds.has(result.document.sourceId)) score += 20;
    if (application?.launchCount) score += Math.min(application.launchCount, 20);
  }

  if (result.document.type === "command") score += 10;
  return score;
}

function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function currentSearchWorkspaceId(snapshot: KernelSnapshot): string | undefined {
  const activeSurface = snapshot.shell.activeSurface;
  if (activeSurface.type === "workspace") return activeSurface.workspaceId;
  if (activeSurface.type === "folder") {
    const folder = snapshot.resources.all.find((resource) => resource.id === activeSurface.resourceId);
    return folder?.primaryWorkspaceId ?? folder?.workspaceRefs[0];
  }
  return snapshot.workspaces.active?.id;
}

function getPreviewRows(
  document: SearchDocument,
  snapshot: KernelSnapshot,
): Array<{ label: string; value: string }> {
  switch (document.type) {
    case "resource": {
      const resource = snapshot.resources.all.find((item) => item.id === document.sourceId);
      if (!resource) return fallbackRows(document);
      return [
        { label: "Metadata", value: resource.metadata.description ?? "No description" },
        { label: "Workspaces", value: resource.workspaceRefs.join(", ") || "No workspace references" },
        { label: "Profile", value: resource.profileId },
        { label: "Modified", value: formatDate(resource.metadata.updatedAt) },
      ];
    }
    case "event": {
      const event = snapshot.events.all.find((item) => item.id === document.sourceId);
      if (!event) return fallbackRows(document);
      return [
        { label: "Type", value: "Calendar Event" },
        { label: "When", value: event.metadata.attributes?.calendarStartDate ? String(event.metadata.attributes.calendarStartDate) : "Unscheduled" },
        { label: "Workspace", value: event.primaryWorkspaceId ?? event.workspaceRefs[0] ?? "No workspace reference" },
        { label: "Modified", value: formatDate(event.metadata.updatedAt) },
      ];
    }
    case "notification": {
      const notification = snapshot.notifications.items.find((item) => item.id === document.sourceId);
      if (!notification) return fallbackRows(document);
      return [
        { label: "Status", value: notification.status },
        { label: "Category", value: notification.category },
        { label: "Source", value: notification.source },
        { label: "Created", value: formatDate(notification.createdAt) },
      ];
    }
    case "activity": {
      const activity = snapshot.activity.items.find((item) => item.id === document.sourceId);
      if (!activity) return fallbackRows(document);
      return [
        { label: "Action", value: `${activity.category} ${activity.verb}` },
        { label: "Object", value: activity.object.title ?? activity.object.id },
        { label: "Workspace", value: activity.workspaceId ?? "Global" },
        { label: "When", value: formatDate(activity.occurredAt) },
      ];
    }
    case "workspace": {
      const workspace = snapshot.workspaces.all.find((item) => item.id === document.sourceId);
      if (!workspace) return fallbackRows(document);
      const recentResources = workspace.resourceRefs
        .map((resourceId) => snapshot.resources.metadataById[resourceId]?.title)
        .filter(Boolean)
        .slice(0, 3)
        .join(", ");
      return [
        { label: "Recent Resources", value: recentResources || "No resources yet" },
        { label: "Last Opened", value: formatDate(workspace.lastOpenedAt ?? workspace.updatedAt) },
        { label: "Pinned Apps", value: workspace.pinnedApplicationIds.join(", ") || "No pinned apps" },
        { label: "Status", value: workspace.lifecycleState },
      ];
    }
    case "profile": {
      const profile = snapshot.profiles.all.find((item) => item.id === document.sourceId);
      if (!profile) return fallbackRows(document);
      return [
        { label: "Default Space", value: profile.defaultSpaceId },
        { label: "Spaces", value: String(profile.spaceIds.length) },
        { label: "Created", value: formatDate(profile.createdAt) },
      ];
    }
    case "application": {
      const application = snapshot.applications.installed.find((item) => item.metadata.id === document.sourceId);
      if (!application) return fallbackRows(document);
      return [
        { label: "Launch", value: application.metadata.description },
        { label: "Pinned", value: application.pinned ? "Pinned to shell" : "Available through search" },
        { label: "Version", value: application.metadata.version },
      ];
    }
    case "setting": {
      const setting = snapshot.settings.byId[document.sourceId];
      if (!setting) return fallbackRows(document);
      return [
        { label: "Category", value: setting.category },
        { label: "Current Value", value: String(setting.value) },
        { label: "Searchable", value: setting.searchable ? "Yes" : "No" },
      ];
    }
    case "command":
      return [
        { label: "Action", value: "Executes through the Karya Command Bus" },
        { label: "Keywords", value: document.keywords.join(", ") },
        { label: "Source", value: document.sourceId },
      ];
  }
}

function getPreviewActions(
  document: SearchDocument,
  snapshot: KernelSnapshot,
): Array<{ icon: ReactElement; label: string; result?: SearchResult }> {
  if (document.type === "resource") {
    const resource = snapshot.resources.all.find((item) => item.id === document.sourceId);
    return [
      { icon: <CornerDownLeft className="h-3.5 w-3.5" />, label: "Open", result: createActionResult("Open", document) },
      { icon: <Eye className="h-3.5 w-3.5" />, label: "Reveal", result: createActionResult("Reveal", document) },
      { icon: <Pencil className="h-3.5 w-3.5" />, label: "Rename" },
      { icon: <FileText className="h-3.5 w-3.5" />, label: "Duplicate", result: createCommandAction("Duplicate Resource", `preview-duplicate-resource:${document.sourceId}`) },
      {
        icon: <Archive className="h-3.5 w-3.5" />,
        label: "Archive",
        result: resource?.lifecycleState === "archived"
          ? undefined
          : createCommandAction("Archive Resource", `preview-archive-resource:${document.sourceId}`),
      },
      { icon: <X className="h-3.5 w-3.5" />, label: "Delete", result: createCommandAction("Delete Resource", `preview-delete-resource:${document.sourceId}`) },
      { icon: <MoveRight className="h-3.5 w-3.5" />, label: "Move" },
      { icon: <Share2 className="h-3.5 w-3.5" />, label: "Relationships", result: createActionResult("Show Relationships", document) },
    ];
  }

  if (document.type === "workspace") {
    return [
      { icon: <CornerDownLeft className="h-3.5 w-3.5" />, label: "Open", result: createActionResult("Open", document) },
      { icon: <Eye className="h-3.5 w-3.5" />, label: "Reveal", result: createActionResult("Reveal", document) },
      { icon: <Pencil className="h-3.5 w-3.5" />, label: "Rename" },
      { icon: <Archive className="h-3.5 w-3.5" />, label: "Archive" },
    ];
  }

  return [
    { icon: <CornerDownLeft className="h-3.5 w-3.5" />, label: "Open", result: createActionResult("Open", document) },
  ];
}

function createActionResult(title: string, document: SearchDocument): SearchResult {
  return {
    document: {
      ...document,
      id: `action:${title.toLocaleLowerCase()}:${document.id}`,
      title,
    },
    score: 1,
  };
}

function createCommandAction(title: string, sourceId: string): SearchResult {
  return {
    document: {
      id: `command:${sourceId}`,
      type: "command",
      title,
      subtitle: "Command",
      keywords: [title],
      sourceId,
    },
    score: 1,
  };
}

function getObjectTypeLabel(document: SearchDocument, snapshot?: KernelSnapshot): string {
  switch (document.type) {
    case "resource":
      return getResourceTypeLabel(document.sourceId, snapshot);
    case "event":
      return "📅 Calendar Event";
    case "notification":
      return "🔔 Notification";
    case "activity":
      return "Timeline Activity";
    case "workspace":
      return "📂 Workspace";
    case "profile":
      return snapshot?.profiles.all.find((profile) => profile.id === document.sourceId)?.lifecycleState === "archived"
        ? "👤 Profile · Archived"
        : "👤 Profile";
    case "application":
      return "🖥 Application";
    case "setting":
      return "⚙️ Setting";
    case "command":
      return "⌘ Command";
  }
}

function getCommandShortcut(document: SearchDocument): string | undefined {
  if (document.type !== "command") return undefined;

  const keywordShortcut = document.keywords.find((keyword) => /[⌘⌃⌥⇧↵]/u.test(keyword));
  if (keywordShortcut) return keywordShortcut;

  const title = document.title.toLocaleLowerCase();
  const sourceId = document.sourceId.toLocaleLowerCase();
  if (sourceId === "create-resource" || title === "create resource") return "⌘⇧R";
  if (sourceId.includes("quick-create-note") || sourceId === "create-note" || title === "create note") return "⌘N";
  if (sourceId.includes("quick-create-task") || sourceId === "create-task" || title === "create task") return "⌘T";
  if (sourceId === "create-bookmark" || title.includes("bookmark")) return "⌘B";
  if (sourceId.includes("quick-create-workspace") || sourceId === "create-workspace" || title.includes("workspace")) return "⇧⌘W";
  if (sourceId === "create-profile" || title.includes("profile")) return "⇧⌘P";
  if (sourceId === "open-clipboard" || title.includes("clipboard")) return "⇧⌘V";
  if (sourceId === "open-calendar" || title.includes("calendar")) return "⌘7";
  if (sourceId === "open-notes" || title.includes("notes")) return "⌘2";
  if (sourceId === "open-tasks" || title.includes("tasks")) return "⌘3";
  if (sourceId === "open-bookmarks" || title.includes("bookmarks")) return "⌘4";
  if (sourceId === "open-notifications" || title.includes("notifications")) return "⌘9";
  if (sourceId === "open-recent-activity" || title.includes("activity")) return "⌘8";
  if (sourceId === "open-settings" || title.includes("settings")) return "⌘,";
  if (sourceId === "import-file" || title.includes("import file")) return "⌘I";
  if (sourceId === "import-folder" || title.includes("import folder")) return "⇧⌘I";
  if (sourceId === "archive-resource" || title.includes("archive")) return "⌘⌫";
  if (sourceId === "resume-last-workspace" || title.includes("resume")) return "⌘R";
  return "↵";
}

function getResourceTypeLabel(resourceId: string, snapshot?: KernelSnapshot): string {
  const resource = snapshot?.resources.all.find((item) => item.id === resourceId);
  const kind = (resource?.metadata.kind ?? resource?.type ?? "").toLocaleLowerCase();

  if (kind.includes("note")) return "📝 Note";
  if (kind.includes("spreadsheet") || kind.includes("sheet")) return "📊 Spreadsheet";
  if (kind.includes("calendar") || kind.includes("event")) return "📅 Calendar";
  return "📄 Document";
}

function fallbackRows(document: SearchDocument): Array<{ label: string; value: string }> {
  return [
    { label: "Type", value: document.type },
    { label: "Source", value: document.sourceId },
  ];
}

function formatDate(value?: string): string {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
