import type { KernelSnapshot } from "@karya/core";
import { Code, Layers3 } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactElement } from "react";

import { displayWorkspaceName, uniqueIds } from "../../resources/resource-utils";
import type { ApplicationSnapshot } from "../../types";

type DockApplicationSource = "Pinned" | "Recent" | "Running" | "Suggested";

interface DockApplication {
  application: ApplicationSnapshot;
  source: DockApplicationSource;
  running: boolean;
}

interface DockPosition {
  left: number;
  top: number;
}

const DOCK_POSITION_STORAGE_KEY = "karya.workspaceDock.position";

export function FloatingApplicationDock({
  activeWorkspaceId,
  onLaunchApplication,
  snapshot,
}: {
  activeWorkspaceId?: string;
  snapshot?: KernelSnapshot;
  onLaunchApplication(
    applicationId: string,
    options?: { workspaceId?: string; profileId?: string; resourceIds?: string[] },
  ): void;
}): ReactElement | null {
  const dockRef = useRef<HTMLDivElement | null>(null);
  const [dockPosition, setDockPosition] = useState<DockPosition>(() => readDockPosition());
  const [dragOffset, setDragOffset] = useState<DockPosition | undefined>();

  useEffect(() => {
    const onResize = () => {
      setDockPosition((position) => clampDockPosition(position, dockRef.current));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    writeDockPosition(dockPosition);
  }, [dockPosition]);

  useEffect(() => {
    if (!dragOffset) return undefined;

    const onPointerMove = (event: PointerEvent) => {
      setDockPosition(
        clampDockPosition(
          {
            left: event.clientX - dragOffset.left,
            top: event.clientY - dragOffset.top,
          },
          dockRef.current,
        ),
      );
    };
    const onPointerUp = () => setDragOffset(undefined);

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
    window.addEventListener("pointercancel", onPointerUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [dragOffset]);

  if (!snapshot) return null;
  const activeWorkspace = activeWorkspaceId
    ? snapshot.workspaces.all.find((workspace) => workspace.id === activeWorkspaceId)
    : undefined;
  const dockApplications = buildWorkspaceDockApplications(snapshot, activeWorkspaceId).slice(0, 7);
  if (!dockApplications.length) return null;

  return (
    <div
      key={activeWorkspaceId ?? "global-dock"}
      ref={dockRef}
      className="karya-dock karya-dock-context fixed z-50 flex items-end gap-3 rounded-xl px-4 py-3"
      aria-label={activeWorkspace ? `${displayWorkspaceName(activeWorkspace)} application dock` : "Application dock"}
      style={{ left: dockPosition.left, top: dockPosition.top }}
    >
      <button
        type="button"
        className="karya-interactive flex h-9 w-4 cursor-grab items-center justify-center rounded-md text-[var(--karya-subtle)] active:cursor-grabbing"
        aria-label="Move application dock"
        title="Drag to move dock"
        onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
          const rect = dockRef.current?.getBoundingClientRect();
          if (!rect) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragOffset({ left: event.clientX - rect.left, top: event.clientY - rect.top });
        }}
        onDoubleClick={() => setDockPosition(defaultDockPosition())}
      >
        <span className="grid grid-cols-1 gap-0.5">
          <span className="h-1 w-1 rounded-full bg-current" />
          <span className="h-1 w-1 rounded-full bg-current" />
          <span className="h-1 w-1 rounded-full bg-current" />
        </span>
      </button>
      {dockApplications.map(({ application, running, source }, index) => (
        <button
          key={application.metadata.id}
          type="button"
          className="karya-dock-item group relative flex w-14 flex-col items-center gap-2 text-center"
          title={`${application.metadata.name} · ${source}${activeWorkspace ? ` · ${displayWorkspaceName(activeWorkspace)}` : ""}`}
          style={{ animationDelay: `${index * 28}ms` }}
          onClick={() =>
            onLaunchApplication(
              application.metadata.id,
              activeWorkspace ? { workspaceId: activeWorkspace.id, profileId: activeWorkspace.profileId } : undefined,
            )
          }
        >
          <span className="karya-interactive relative flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--karya-surface-strong)] text-[var(--karya-text)] shadow-[var(--karya-shadow-button)] group-hover:border group-hover:border-[var(--karya-border-strong)]">
            {application.metadata.name.toLowerCase().includes("terminal") ? (
              <Code className="h-4 w-4" />
            ) : (
              <Layers3 className="h-4 w-4" />
            )}
            {running ? (
              <span className="absolute -bottom-1 h-1.5 w-1.5 rounded-full bg-[var(--karya-success)] shadow-[var(--karya-shadow-button)]" />
            ) : null}
          </span>
          <span className="w-full truncate text-[10px] font-medium text-[var(--karya-muted)]">
            {application.metadata.name}
          </span>
          <span className="absolute -top-2 rounded-full bg-[var(--karya-control)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--karya-subtle)] opacity-0 shadow-[var(--karya-shadow-button)] transition-opacity duration-150 group-hover:opacity-100">
            {source}
          </span>
        </button>
      ))}
    </div>
  );
}

function readDockPosition(): DockPosition {
  if (typeof window === "undefined") return { left: 0, top: 0 };
  const raw = window.localStorage.getItem(DOCK_POSITION_STORAGE_KEY);
  if (!raw) return defaultDockPosition();
  try {
    const parsed = JSON.parse(raw) as Partial<DockPosition>;
    if (typeof parsed.left === "number" && typeof parsed.top === "number") {
      return clampDockPosition({ left: parsed.left, top: parsed.top });
    }
  } catch {
    return defaultDockPosition();
  }
  return defaultDockPosition();
}

function writeDockPosition(position: DockPosition): void {
  window.localStorage.setItem(DOCK_POSITION_STORAGE_KEY, JSON.stringify(position));
}

function defaultDockPosition(): DockPosition {
  const estimatedWidth = 520;
  const estimatedHeight = 82;
  return {
    left: Math.max(16, (window.innerWidth - estimatedWidth) / 2),
    top: Math.max(16, window.innerHeight - estimatedHeight - 24),
  };
}

function clampDockPosition(position: DockPosition, dockElement?: HTMLElement | null): DockPosition {
  const margin = 12;
  const width = dockElement?.offsetWidth ?? 520;
  const height = dockElement?.offsetHeight ?? 82;
  return {
    left: Math.min(Math.max(margin, position.left), Math.max(margin, window.innerWidth - width - margin)),
    top: Math.min(Math.max(margin, position.top), Math.max(margin, window.innerHeight - height - margin)),
  };
}

function buildWorkspaceDockApplications(snapshot: KernelSnapshot, workspaceId?: string): DockApplication[] {
  const installed = snapshot.applications.installed;
  const runningIds = new Set(snapshot.applications.running.map((application) => application.metadata.id));
  const workspace = workspaceId ? snapshot.workspaces.all.find((candidate) => candidate.id === workspaceId) : undefined;
  const preferredIds = workspaceId
    ? (snapshot.applications.preferredByWorkspace[workspaceId] ?? workspace?.pinnedApplicationIds ?? [])
    : [];
  const workspaceRecentIds = uniqueIds([
    ...(workspaceId
      ? snapshot.applications.launchHistory
          .filter((entry) => entry.workspaceId === workspaceId)
          .sort((left, right) => right.launchedAt.localeCompare(left.launchedAt))
          .map((entry) => entry.applicationId)
      : []),
    ...(workspaceId
      ? (snapshot.continuity.activityByWorkspace[workspaceId] ?? [])
          .filter((activity) => activity.type === "application-launched" && activity.applicationId)
          .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
          .map((activity) => activity.applicationId)
          .filter((applicationId): applicationId is string => Boolean(applicationId))
      : []),
  ]);
  const globalPinnedIds = snapshot.applications.pinned.map((application) => application.metadata.id);
  const fallbackRecentIds = snapshot.applications.recent.map((application) => application.metadata.id);
  const frequentIds = snapshot.applications.frequent.map((application) => application.metadata.id);
  const selected = new Set<string>();
  const dock: DockApplication[] = [];

  const addById = (applicationId: string, source: DockApplicationSource) => {
    if (selected.has(applicationId)) return;
    const application = installed.find((candidate) => candidate.metadata.id === applicationId);
    if (!application) return;
    selected.add(applicationId);
    dock.push({ application, source, running: runningIds.has(applicationId) });
  };

  preferredIds.forEach((applicationId) => addById(applicationId, "Pinned"));
  if (!workspaceId) globalPinnedIds.forEach((applicationId) => addById(applicationId, "Pinned"));
  workspaceRecentIds.forEach((applicationId) => addById(applicationId, "Recent"));
  snapshot.applications.running.forEach((application) => addById(application.metadata.id, "Running"));
  [...frequentIds, ...fallbackRecentIds, ...installed.map((application) => application.metadata.id)].forEach(
    (applicationId) => addById(applicationId, "Suggested"),
  );

  return dock;
}
