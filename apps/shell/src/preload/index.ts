import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("karyaShell", {
  platform: process.platform,
  invoke(method: string, args: unknown[] = []) {
    return ipcRenderer.invoke("karya:shell:invoke", method, args);
  },
  showProfileContextMenu(profile: { id: string; name: string; archived: boolean }) {
    return ipcRenderer.invoke("karya:profile-context-menu", profile);
  },
  showResourceContextMenu(resource: { id: string; title: string; archived: boolean; hasLocation: boolean }) {
    return ipcRenderer.invoke("karya:resource-context-menu", resource);
  },
  showApplicationContextMenu(application: { id: string; name: string; pinned: boolean; favorite: boolean; preferred: boolean; hasActiveWorkspace: boolean }) {
    return ipcRenderer.invoke("karya:application-context-menu", application);
  },
  subscribe(listener: (snapshot: unknown) => void) {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: unknown) => listener(snapshot);
    ipcRenderer.on("karya:snapshot", handler);
    return () => ipcRenderer.removeListener("karya:snapshot", handler);
  },
  subscribeImports(listener: (event: unknown) => void) {
    const handler = (_event: Electron.IpcRendererEvent, importEvent: unknown) => listener(importEvent);
    ipcRenderer.on("karya:import", handler);
    return () => ipcRenderer.removeListener("karya:import", handler);
  },
  subscribeNativeCommands(listener: (command: string) => void) {
    const handler = (_event: Electron.IpcRendererEvent, command: string) => listener(command);
    ipcRenderer.on("karya:native-command", handler);
    return () => ipcRenderer.removeListener("karya:native-command", handler);
  },
});
