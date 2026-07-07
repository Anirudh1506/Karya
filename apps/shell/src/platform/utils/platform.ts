import type { InstalledApplication } from "@karya/types";

export function getPlatform(): InstalledApplication["metadata"]["platform"] {
  if (typeof process !== "undefined") {
    if (process.platform === "darwin") return "darwin";
    if (process.platform === "win32") return "windows";
    if (process.platform === "linux") return "linux";
  }
  if (typeof navigator !== "undefined") {
    if (navigator.userAgent.includes("Mac")) return "darwin";
    if (navigator.userAgent.includes("Windows")) return "windows";
  }
  return "unknown";
}
