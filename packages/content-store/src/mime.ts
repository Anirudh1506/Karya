import { extname } from "node:path";

const extensionMimeTypes: Record<string, string> = {
  ".csv": "text/csv",
  ".gif": "image/gif",
  ".htm": "text/html",
  ".html": "text/html",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".md": "text/markdown",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".txt": "text/plain",
  ".webp": "image/webp",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function detectMimeType(path: string, header: Uint8Array, fallback?: string): string {
  if (fallback) return fallback;

  if (matches(header, [0x25, 0x50, 0x44, 0x46])) return "application/pdf";
  if (matches(header, [0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (matches(header, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (matches(header, [0x47, 0x49, 0x46])) return "image/gif";
  if (matches(header, [0x50, 0x4b, 0x03, 0x04])) return extensionMimeTypes[extname(path).toLocaleLowerCase()] ?? "application/zip";

  return extensionMimeTypes[extname(path).toLocaleLowerCase()] ?? "application/octet-stream";
}

function matches(header: Uint8Array, signature: number[]): boolean {
  return signature.every((byte, index) => header[index] === byte);
}
