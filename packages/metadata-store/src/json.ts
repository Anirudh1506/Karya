export function serializeJson(value: unknown): string {
  return JSON.stringify(value);
}

export function parseJson<TValue>(value: unknown): TValue {
  if (typeof value !== "string") {
    throw new Error("Expected SQLite JSON payload to be a string");
  }
  return JSON.parse(value) as TValue;
}
