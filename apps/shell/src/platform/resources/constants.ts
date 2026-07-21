export const FILE_SYSTEM_SEARCH_MAX_DEPTH = 4;
export const MACOS_APPLICATION_EXTENSION = ".app";
export const TEXT_READABLE_EXTENSIONS = ["md", "markdown", "txt", "rtf"] as const;
export const FALLBACK_MIME_TYPE = "application/octet-stream";
export const MIME_TYPE_BY_EXTENSION: Readonly<Record<string, string>> = {
  csv: "text/csv",
  gif: "image/gif",
  htm: "text/html",
  html: "text/html",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  json: "application/json",
  md: "text/markdown",
  pdf: "application/pdf",
  png: "image/png",
  txt: "text/plain",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
