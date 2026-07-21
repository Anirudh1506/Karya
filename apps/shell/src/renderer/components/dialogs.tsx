import { Badge, Button, cn } from "@karya/ui";
import type { KernelSnapshot } from "@karya/core";
import type { ImportDestination } from "@karya/types";
import { useEffect, useState, type FormEvent, type ReactElement } from "react";
import { DESKTOP_HOME_DEFAULT_SPACE_ID } from "../types";
import type { ApplicationSnapshot, ImportMode, PlacementOperation, ResourceSnapshot } from "../types";
import {
  applicationSupportsResource,
  destinationFromWorkspace,
  displayWorkspaceName,
  formatShortDate,
  getDesktopHomeDefaultSpace,
  getImportWorkspaceOptions,
  profileNameForWorkspace,
  readBooleanAttribute,
  readNumberAttribute,
  readStringAttribute,
} from "../resources/resource-utils";
import { ExplainThisButton } from "../screens/progressive-understanding";

const LINKING_EDUCATION_STORAGE_KEY = "karya.progressive-understanding.linking.v1";

function InspectorRow({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-1 break-words text-sm text-zinc-800">{value}</p>
    </div>
  );
}

function readBooleanPreference(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  const value = window.localStorage.getItem(key);
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function writeBooleanPreference(key: string, value: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, String(value));
}

export function CreateNamedEntityDialog({
  entityLabel,
  maxLength,
  onClose,
  onCreate,
  placeholder,
}: {
  entityLabel: "Profile" | "Workspace";
  maxLength: number;
  onClose(): void;
  onCreate(name: string): Promise<void>;
  placeholder: string;
}): ReactElement {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName) return;
    setSubmitting(true);
    try {
      await onCreate(nextName);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-950/20 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
        <h2 className="text-base font-semibold">Create {entityLabel}</h2>
        <label className="mt-4 block text-xs font-medium text-zinc-600" htmlFor={`create-${entityLabel}-name`}>
          Name
        </label>
        <input
          id={`create-${entityLabel}-name`}
          autoFocus
          className="mt-2 h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
          maxLength={maxLength}
          placeholder={placeholder}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={submitting || !name.trim()}>
            {submitting ? "Creating…" : `Create ${entityLabel.toLocaleLowerCase()}`}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function ImportDestinationDialog({
  activeSurface,
  mode,
  onClose,
  onImport,
  operation,
  snapshot,
}: {
  activeSurface: KernelSnapshot["shell"]["activeSurface"];
  mode: ImportMode;
  onClose(): void;
  onImport(destination: ImportDestination): Promise<void>;
  operation: PlacementOperation;
  snapshot: KernelSnapshot;
}): ReactElement {
  const desktopDefaultSpace = getDesktopHomeDefaultSpace(snapshot);
  const profileContextId = activeSurface.type === "profile" ? activeSurface.profileId : undefined;
  const activeProfiles = snapshot.profiles.all.filter((profile) => (profile.lifecycleState ?? "active") === "active");
  const initialProfileId = profileContextId ?? "none";
  const [profileId, setProfileId] = useState(initialProfileId);
  const selectedProfile = activeProfiles.find((profile) => profile.id === profileId);
  const workspaceOptions = selectedProfile
    ? getImportWorkspaceOptions(snapshot, selectedProfile.id)
    : desktopDefaultSpace
      ? [desktopDefaultSpace]
      : [];
  const [workspaceId, setWorkspaceId] = useState(selectedProfile?.defaultSpaceId ?? desktopDefaultSpace?.id ?? "");
  const [showLinkingEducation, setShowLinkingEducation] = useState(
    () => operation === "link" && window.localStorage.getItem(LINKING_EDUCATION_STORAGE_KEY) !== "complete",
  );
  const selectedWorkspace = workspaceOptions.find((workspace) => workspace.id === workspaceId) ?? workspaceOptions[0];
  const actionLabel = operation === "link" ? "Reference" : "Import";
  const importLabel = `${actionLabel} ${mode === "directory" ? "Folder" : "File"}`;
  const canChooseWorkspace = workspaceOptions.length > 1;
  const selectedWorkspaceLabel =
    selectedWorkspace?.id === DESKTOP_HOME_DEFAULT_SPACE_ID ? "Default Space" : selectedWorkspace?.name;

  const handleProfileChange = (nextProfileId: string) => {
    setProfileId(nextProfileId);
    if (nextProfileId === "none") {
      setWorkspaceId(desktopDefaultSpace?.id ?? "");
      return;
    }
    const nextProfile = activeProfiles.find((profile) => profile.id === nextProfileId);
    setWorkspaceId(nextProfile?.defaultSpaceId ?? getImportWorkspaceOptions(snapshot, nextProfileId)[0]?.id ?? "");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedWorkspace) return;

    await onImport({
      profileId: selectedProfile?.id,
      workspaceId: selectedWorkspace.id,
      defaultSpace:
        selectedProfile && selectedWorkspace.id === selectedProfile.defaultSpaceId
          ? "profile"
          : selectedProfile
            ? "none"
            : "user",
    });
    if (operation === "link") {
      window.localStorage.setItem(LINKING_EDUCATION_STORAGE_KEY, "complete");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/20 p-4 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl"
      >
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase text-zinc-400">{actionLabel} To</p>
          <h2 className="mt-1 text-lg font-semibold">{importLabel}</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Choose which work should remember this {operation === "link" ? "reference" : "imported resource"}.
          </p>
          {operation === "link" ? <ExplainThisButton capability="linking" className="mt-2" /> : null}
        </div>

        {showLinkingEducation ? (
          <div className="mb-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-sm font-semibold text-zinc-900">Your files stay where they are.</p>
            <p className="mt-1 text-sm leading-6 text-zinc-600">
              Linking helps Karya remember where this work belongs. Karya does not copy, move, or own the file or
              folder.
            </p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="mt-2"
              onClick={() => {
                window.localStorage.setItem(LINKING_EDUCATION_STORAGE_KEY, "complete");
                setShowLinkingEducation(false);
              }}
            >
              I understand
            </Button>
          </div>
        ) : null}

        <div className="space-y-4">
          {profileContextId ? (
            <div>
              <label className="text-xs font-medium uppercase text-zinc-400">Profile</label>
              <div className="mt-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
                {selectedProfile?.name ?? "Current Profile"}
              </div>
            </div>
          ) : (
            <div>
              <label className="text-xs font-medium uppercase text-zinc-400" htmlFor="import-profile">
                Profile
              </label>
              <select
                id="import-profile"
                value={profileId}
                onChange={(event) => handleProfileChange(event.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
              >
                <option value="none">None - Desktop Default Space</option>
                {activeProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {canChooseWorkspace ? (
            <div>
              <label className="text-xs font-medium uppercase text-zinc-400" htmlFor="import-workspace">
                Workspace
              </label>
              <select
                id="import-workspace"
                value={selectedWorkspace?.id ?? ""}
                onChange={(event) => setWorkspaceId(event.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
              >
                {workspaceOptions.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.id === DESKTOP_HOME_DEFAULT_SPACE_ID ? "Default Space" : workspace.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="text-xs font-medium uppercase text-zinc-400">Destination</label>
              <div className="mt-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
                {selectedWorkspaceLabel ?? "No import destination is available yet."}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!selectedWorkspace}>
            {importLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function RenameProfileDialog({
  onClose,
  onRename,
  profile,
}: {
  onClose(): void;
  onRename(name: string): Promise<void>;
  profile: KernelSnapshot["profiles"]["all"][number];
}): ReactElement {
  const [name, setName] = useState(profile.name);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName || nextName === profile.name) {
      onClose();
      return;
    }
    setSubmitting(true);
    try {
      await onRename(nextName);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-950/20 backdrop-blur-sm">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
        <h2 className="text-base font-semibold">Rename Profile</h2>
        <input
          autoFocus
          className="mt-4 h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={submitting || !name.trim()}>
            Rename
          </Button>
        </div>
      </form>
    </div>
  );
}

export function RenameWorkspaceDialog({
  onClose,
  onRename,
  workspace,
}: {
  onClose(): void;
  onRename(name: string): Promise<void>;
  workspace: KernelSnapshot["workspaces"]["all"][number];
}): ReactElement {
  const [name, setName] = useState(workspace.name);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName || nextName === workspace.name) {
      onClose();
      return;
    }
    setSubmitting(true);
    try {
      await onRename(nextName);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-950/20 backdrop-blur-sm">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
        <h2 className="text-base font-semibold">Rename Workspace</h2>
        <input
          autoFocus
          className="mt-4 h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={submitting || !name.trim()}>
            Rename
          </Button>
        </div>
      </form>
    </div>
  );
}

export function RenameResourceDialog({
  onClose,
  onRename,
  resource,
}: {
  onClose(): void;
  onRename(title: string): Promise<void>;
  resource: ResourceSnapshot;
}): ReactElement {
  const [title, setTitle] = useState(resource.metadata.title);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle || nextTitle === resource.metadata.title) {
      onClose();
      return;
    }
    setSubmitting(true);
    try {
      await onRename(nextTitle);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-950/20 backdrop-blur-sm">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
        <h2 className="text-base font-semibold">Rename Resource</h2>
        <input
          autoFocus
          className="mt-4 h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={submitting || !title.trim()}>
            Rename
          </Button>
        </div>
      </form>
    </div>
  );
}

export function MoveResourceDialog({
  onClose,
  onMove,
  resource,
  snapshot,
}: {
  onClose(): void;
  onMove(destination: ImportDestination): Promise<void>;
  resource: ResourceSnapshot;
  snapshot: KernelSnapshot;
}): ReactElement {
  const desktopDefaultSpace = getDesktopHomeDefaultSpace(snapshot);
  const activeProfiles = snapshot.profiles.all.filter((profile) => (profile.lifecycleState ?? "active") === "active");
  const currentWorkspaceId = resource.primaryWorkspaceId ?? resource.workspaceRefs[0];
  const isDesktopResource = resource.defaultSpace === "user" || currentWorkspaceId === DESKTOP_HOME_DEFAULT_SPACE_ID;
  const initialProfileId = isDesktopResource
    ? "none"
    : (activeProfiles.find((profile) => profile.id === resource.profileId)?.id ?? "none");
  const [profileId, setProfileId] = useState(initialProfileId);
  const selectedProfile = activeProfiles.find((profile) => profile.id === profileId);
  const workspaceOptions = selectedProfile
    ? getImportWorkspaceOptions(snapshot, selectedProfile.id)
    : desktopDefaultSpace
      ? [desktopDefaultSpace]
      : [];
  const [workspaceId, setWorkspaceId] = useState(
    workspaceOptions.some((workspace) => workspace.id === currentWorkspaceId)
      ? (currentWorkspaceId ?? "")
      : (selectedProfile?.defaultSpaceId ?? workspaceOptions[0]?.id ?? ""),
  );
  const selectedWorkspace = workspaceOptions.find((workspace) => workspace.id === workspaceId) ?? workspaceOptions[0];
  const [submitting, setSubmitting] = useState(false);
  const canChooseWorkspace = workspaceOptions.length > 1;
  const selectedWorkspaceLabel =
    selectedWorkspace?.id === DESKTOP_HOME_DEFAULT_SPACE_ID ? "Default Space" : selectedWorkspace?.name;

  const handleProfileChange = (nextProfileId: string) => {
    setProfileId(nextProfileId);
    if (nextProfileId === "none") {
      setWorkspaceId(desktopDefaultSpace?.id ?? "");
      return;
    }
    const nextProfile = activeProfiles.find((profile) => profile.id === nextProfileId);
    setWorkspaceId(nextProfile?.defaultSpaceId ?? getImportWorkspaceOptions(snapshot, nextProfileId)[0]?.id ?? "");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedWorkspace) return;
    setSubmitting(true);
    try {
      await onMove(destinationFromWorkspace(snapshot, selectedWorkspace.id));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-950/20 backdrop-blur-sm">
      <form onSubmit={submit} className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
        <p className="text-xs font-semibold uppercase text-zinc-400">Move To</p>
        <h2 className="mt-2 text-base font-semibold">{resource.metadata.title}</h2>
        <p className="mt-1 text-sm text-zinc-500">Choose which work should own this resource.</p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-medium uppercase text-zinc-400" htmlFor="move-profile">
              Profile
            </label>
            <select
              id="move-profile"
              value={profileId}
              onChange={(event) => handleProfileChange(event.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
            >
              <option value="none">None - Desktop Default Space</option>
              {activeProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </div>

          {canChooseWorkspace ? (
            <div>
              <label className="text-xs font-medium uppercase text-zinc-400" htmlFor="move-workspace">
                Workspace
              </label>
              <select
                id="move-workspace"
                value={selectedWorkspace?.id ?? ""}
                onChange={(event) => setWorkspaceId(event.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
              >
                {workspaceOptions.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {displayWorkspaceName(workspace)}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="text-xs font-medium uppercase text-zinc-400">Destination</label>
              <div className="mt-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
                {selectedWorkspaceLabel ?? "No destination is available for this Profile."}
              </div>
            </div>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={submitting || !selectedWorkspace}>
            Move
          </Button>
        </div>
      </form>
    </div>
  );
}

export function AddResourceReferenceDialog({
  onAdd,
  onClose,
  resource,
  snapshot,
}: {
  onAdd(workspaceId: string): Promise<void>;
  onClose(): void;
  resource: ResourceSnapshot;
  snapshot: KernelSnapshot;
}): ReactElement {
  const activeWorkspaces = snapshot.workspaces.all
    .filter((workspace) => workspace.lifecycleState !== "deleted" && workspace.lifecycleState !== "archived")
    .filter((workspace) => !resource.workspaceRefs.includes(workspace.id));
  const [workspaceId, setWorkspaceId] = useState(activeWorkspaces[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!workspaceId) return;
    setSubmitting(true);
    try {
      await onAdd(workspaceId);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-950/20 backdrop-blur-sm">
      <form onSubmit={submit} className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
        <p className="text-xs font-semibold uppercase text-zinc-400">Add Reference</p>
        <h2 className="mt-2 text-base font-semibold">{resource.metadata.title}</h2>
        {activeWorkspaces.length ? (
          <>
            <label className="mt-4 block text-xs font-medium uppercase text-zinc-400">Workspace</label>
            <select
              className="mt-2 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
              value={workspaceId}
              onChange={(event) => setWorkspaceId(event.target.value)}
            >
              {activeWorkspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.id === DESKTOP_HOME_DEFAULT_SPACE_ID
                    ? "Desktop Default Space"
                    : `${profileNameForWorkspace(snapshot, workspace.profileId)} / ${displayWorkspaceName(workspace)}`}
                </option>
              ))}
            </select>
          </>
        ) : (
          <p className="mt-4 text-sm text-zinc-500">This resource already appears in every available Workspace.</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={submitting || !workspaceId}>
            Add Reference
          </Button>
        </div>
      </form>
    </div>
  );
}

export function ResourcePropertiesDialog({
  onClose,
  resource,
  snapshot,
}: {
  onClose(): void;
  resource: ResourceSnapshot;
  snapshot?: KernelSnapshot;
}): ReactElement {
  const workspaceNames = resource.workspaceRefs.map((workspaceId) => {
    const workspace = snapshot?.workspaces.all.find((candidate) => candidate.id === workspaceId);
    return workspace ? displayWorkspaceName(workspace) : workspaceId;
  });
  const ownerProfile = snapshot?.profiles.all.find((profile) => profile.id === resource.profileId);
  const location = readStringAttribute(resource, "contentSourcePath");

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-950/20 backdrop-blur-sm">
      <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-zinc-400">Resource Properties</p>
            <h2 className="mt-2 text-xl font-semibold">{resource.metadata.title}</h2>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
          <InspectorRow label="Name" value={resource.metadata.title} />
          <InspectorRow label="Type" value={resource.type} />
          <InspectorRow label="Owner" value={resource.defaultSpace === "user" ? "Desktop" : resource.owner} />
          <InspectorRow
            label="Profile"
            value={resource.defaultSpace === "user" ? "Desktop" : (ownerProfile?.name ?? resource.profileId)}
          />
          <InspectorRow label="Primary Workspace" value={resource.primaryWorkspaceId ?? "None"} />
          <InspectorRow label="Referenced Workspaces" value={workspaceNames.join(", ") || "None"} />
          <InspectorRow label="Created" value={resource.metadata.createdAt} />
          <InspectorRow label="Modified" value={resource.metadata.updatedAt} />
          <InspectorRow label="Imported" value={resource.tags.includes("imported") ? "Yes" : "No"} />
          <InspectorRow label="File Location" value={location ?? "No local source path"} />
          <InspectorRow label="Lifecycle" value={resource.lifecycleState} />
          <InspectorRow label="Relationships" value={String(resource.relationships.length)} />
          <InspectorRow label="Tags" value={resource.tags.join(", ") || "None"} />
          <InspectorRow label="Version" value="1" />
        </div>
      </div>
    </div>
  );
}

export function ApplicationPropertiesDialog({
  application,
  onClose,
  snapshot,
}: {
  application: ApplicationSnapshot;
  onClose(): void;
  snapshot?: KernelSnapshot;
}): ReactElement {
  const preferredWorkspaces =
    snapshot?.workspaces.all
      .filter((workspace) => workspace.pinnedApplicationIds.includes(application.metadata.id))
      .map((workspace) => displayWorkspaceName(workspace)) ?? [];
  const recentLaunches =
    snapshot?.applications.launchHistory
      .filter((launch) => launch.applicationId === application.metadata.id)
      .slice(0, 5) ?? [];
  const supportedTypes = application.metadata.supportedFileTypes?.join(", ") || "System default";
  const supportedSchemes = application.metadata.supportedUrlSchemes?.join(", ") || "None";

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-950/20 backdrop-blur-sm">
      <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-zinc-400">Application Properties</p>
            <h2 className="mt-2 text-xl font-semibold">{application.metadata.name}</h2>
            <p className="mt-1 text-sm text-zinc-500">{application.metadata.description}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
          <InspectorRow label="Name" value={application.metadata.name} />
          <InspectorRow label="Category" value={application.metadata.category ?? "Application"} />
          <InspectorRow label="Lifecycle" value={application.lifecycleState} />
          <InspectorRow label="Platform" value={application.metadata.platform ?? "Unknown"} />
          <InspectorRow label="Version" value={application.metadata.version || "Unknown"} />
          <InspectorRow label="Launch Count" value={String(application.launchCount)} />
          <InspectorRow label="Last Launched" value={application.lastLaunchedAt ?? "Never"} />
          <InspectorRow label="Pinned" value={application.pinned ? "Yes" : "No"} />
          <InspectorRow label="Favorite" value={application.favorite ? "Yes" : "No"} />
          <InspectorRow label="Default Application" value={application.defaultApplication ? "Yes" : "No"} />
          <InspectorRow label="Bundle Identifier" value={application.metadata.bundleIdentifier ?? "None"} />
          <InspectorRow
            label="Executable"
            value={
              application.metadata.executablePath ?? application.metadata.executableIdentifier ?? "Platform default"
            }
          />
          <InspectorRow label="Supported Types" value={supportedTypes} />
          <InspectorRow label="URL Schemes" value={supportedSchemes} />
          <InspectorRow label="Preferred Workspaces" value={preferredWorkspaces.join(", ") || "None"} />
          <InspectorRow
            label="Recent Launches"
            value={
              recentLaunches.length
                ? recentLaunches.map((launch) => formatShortDate(launch.launchedAt)).join(", ")
                : "None"
            }
          />
        </div>
      </div>
    </div>
  );
}

export function AddWorkspaceApplicationDialog({
  onAdd,
  onClose,
  snapshot,
  workspace,
}: {
  onAdd(applicationId: string, includeInLaunchSet: boolean): Promise<void>;
  onClose(): void;
  snapshot: KernelSnapshot;
  workspace: KernelSnapshot["workspaces"]["all"][number];
}): ReactElement {
  const associatedIds = new Set(workspace.pinnedApplicationIds);
  const launchPreferenceKey = `karya.workspace.${workspace.id}.include-added-apps-in-launch-set`;
  const applications = snapshot.applications.installed
    .filter((application) => !application.hidden && application.lifecycleState !== "removed")
    .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name));
  const [selectedApplicationId, setSelectedApplicationId] = useState(
    applications.find((application) => !associatedIds.has(application.metadata.id))?.metadata.id ??
      applications[0]?.metadata.id ??
      "",
  );
  const [includeInLaunchSet, setIncludeInLaunchSet] = useState(() => readBooleanPreference(launchPreferenceKey, true));
  const [submitting, setSubmitting] = useState(false);
  const selectedApplication = applications.find((application) => application.metadata.id === selectedApplicationId);
  const alreadyAssociated = selectedApplication ? associatedIds.has(selectedApplication.metadata.id) : false;
  const launchSetEnabled = workspace.launchSet?.enabled === true;
  const alreadyInLaunchSet = selectedApplication
    ? workspace.launchSet?.items.some(
        (item) => item.kind === "application" && item.applicationId === selectedApplication.metadata.id,
      ) === true
    : false;
  const canIncludeInLaunchSet = launchSetEnabled && Boolean(selectedApplication) && !alreadyInLaunchSet;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedApplicationId || alreadyAssociated) return;
    setSubmitting(true);
    try {
      writeBooleanPreference(launchPreferenceKey, includeInLaunchSet);
      await onAdd(selectedApplicationId, canIncludeInLaunchSet && includeInLaunchSet);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-950/20 backdrop-blur-sm">
      <form onSubmit={submit} className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-zinc-400">Add Application</p>
            <h2 className="mt-2 text-lg font-semibold">{displayWorkspaceName(workspace)}</h2>
            <p className="mt-1 text-sm text-zinc-500">Associate an installed application with this Workspace.</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <label className="mt-5 block text-xs font-medium uppercase text-zinc-400" htmlFor="workspace-application">
          Application
        </label>
        <select
          id="workspace-application"
          className="mt-2 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
          value={selectedApplicationId}
          onChange={(event) => setSelectedApplicationId(event.target.value)}
        >
          {applications.map((application) => (
            <option key={application.metadata.id} value={application.metadata.id}>
              {application.metadata.name}
              {associatedIds.has(application.metadata.id) ? " - already associated" : ""}
            </option>
          ))}
        </select>
        {selectedApplication ? (
          <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <p className="font-medium">{selectedApplication.metadata.name}</p>
            <p className="mt-1 text-sm text-zinc-500">{selectedApplication.metadata.description}</p>
            <p className="mt-2 text-xs text-zinc-500">{selectedApplication.metadata.category ?? "Application"}</p>
          </div>
        ) : null}
        {launchSetEnabled ? (
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <input
              className="mt-1 h-4 w-4 accent-zinc-900"
              type="checkbox"
              checked={canIncludeInLaunchSet && includeInLaunchSet}
              disabled={!canIncludeInLaunchSet}
              onChange={(event) => {
                setIncludeInLaunchSet(event.target.checked);
                writeBooleanPreference(launchPreferenceKey, event.target.checked);
              }}
            />
            <span>
              <span className="block text-sm font-medium text-zinc-900">Include in Continue Working launch set</span>
              <span className="mt-1 block text-xs leading-5 text-zinc-500">
                {alreadyInLaunchSet
                  ? "This application is already part of the launch set."
                  : "When Continue Working is selected, this application will launch with the Workspace."}
              </span>
            </span>
          </label>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={submitting || !selectedApplicationId || alreadyAssociated}>
            Add Application
          </Button>
        </div>
      </form>
    </div>
  );
}

export function OpenWithDialog({
  onClose,
  onOpen,
  resource,
  snapshot,
}: {
  onClose(): void;
  onOpen(applicationId: string, makePreferred: boolean): Promise<void>;
  resource: ResourceSnapshot;
  snapshot: KernelSnapshot;
}): ReactElement {
  const workspaceId = resource.primaryWorkspaceId ?? resource.workspaceRefs[0];
  const applications = snapshot.applications.installed.filter((application) =>
    applicationSupportsResource(application, resource),
  );
  const [selectedApplicationId, setSelectedApplicationId] = useState(applications[0]?.metadata.id ?? "");
  const [makePreferred, setMakePreferred] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedApplicationId) return;
    setSubmitting(true);
    try {
      await onOpen(selectedApplicationId, makePreferred);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-950/20 backdrop-blur-sm">
      <form onSubmit={submit} className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-zinc-400">Open With</p>
            <h2 className="mt-2 text-lg font-semibold">{resource.metadata.title}</h2>
            <p className="mt-1 text-sm text-zinc-500">Choose an application for this resource.</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        {applications.length ? (
          <>
            <div className="mt-5 space-y-2">
              {applications.map((application) => (
                <label
                  key={application.metadata.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border p-3",
                    selectedApplicationId === application.metadata.id
                      ? "border-zinc-950 bg-zinc-50"
                      : "border-zinc-200",
                  )}
                >
                  <input
                    type="radio"
                    name="open-with-application"
                    value={application.metadata.id}
                    checked={selectedApplicationId === application.metadata.id}
                    onChange={(event) => setSelectedApplicationId(event.target.value)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{application.metadata.name}</span>
                    <span className="block truncate text-xs text-zinc-500">
                      {application.metadata.category ?? "Application"}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {workspaceId ? (
              <label className="mt-4 flex items-center gap-2 text-sm text-zinc-600">
                <input
                  type="checkbox"
                  checked={makePreferred}
                  onChange={(event) => setMakePreferred(event.target.checked)}
                />
                Use this application for this Workspace
              </label>
            ) : null}
          </>
        ) : (
          <p className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-500">
            No discovered application currently advertises support for this resource type.
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={submitting || !selectedApplicationId}>
            Open
          </Button>
        </div>
      </form>
    </div>
  );
}
