import type { KernelSnapshot } from "./types";

export function cloneSnapshot(snapshot: KernelSnapshot): KernelSnapshot {
  return structuredClone(snapshot) as KernelSnapshot;
}

export function freezeSnapshot(snapshot: KernelSnapshot): KernelSnapshot {
  return deepFreeze(snapshot);
}

function deepFreeze<TValue>(value: TValue): TValue {
  if (value && typeof value === "object") {
    Object.freeze(value);
    Object.values(value).forEach((child) => deepFreeze(child));
  }
  return value;
}
