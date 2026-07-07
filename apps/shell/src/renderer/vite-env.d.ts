/// <reference types="vite/client" />

interface Window {
  karyaShell?: {
    platform: NodeJS.Platform;
    invoke<TResponse = unknown>(method: string, args?: unknown[]): Promise<TResponse>;
    showProfileContextMenu?(profile: { id: string; name: string; archived: boolean }): Promise<
      | "open"
      | "rename"
      | "create-workspace"
      | "set-active"
      | "archive"
      | "restore"
      | "delete"
      | "properties"
      | undefined
    >;
    showResourceContextMenu?(resource: { id: string; title: string; archived: boolean; hasLocation: boolean }): Promise<
      | "open"
      | "open-with"
      | "reveal"
      | "rename"
      | "duplicate"
      | "move"
      | "add-to-workspace"
      | "archive"
      | "restore"
      | "delete"
      | "properties"
      | undefined
    >;
    showApplicationContextMenu?(application: { id: string; name: string; pinned: boolean; favorite: boolean; preferred: boolean; hasActiveWorkspace: boolean }): Promise<
      | "launch"
      | "open-workspace"
      | "pin"
      | "unpin"
      | "favorite"
      | "unfavorite"
      | "set-preferred"
      | "unset-preferred"
      | "remove-from-workspace"
      | "properties"
      | undefined
    >;
    subscribe(listener: (snapshot: import("@karya/shell-adapter").KernelSnapshot) => void): () => void;
    subscribeImports(listener: (event: import("@karya/shell-adapter").ImportLifecycleEvent) => void): () => void;
    subscribeNativeCommands?(listener: (command: string) => void): () => void;
  };
}
