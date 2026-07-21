import type { KernelSnapshot } from "./types";

export function cloneSnapshot(snapshot: KernelSnapshot): KernelSnapshot {
  return structuredClone(snapshot) as KernelSnapshot;
}

export function freezeSnapshot(snapshot: KernelSnapshot): KernelSnapshot {
  return cloneAndFreeze(snapshot);
}

function cloneAndFreeze<TValue>(value: TValue): TValue {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;

  // Clone only newly introduced branches so freezing a snapshot never freezes
  // an event payload owned by another service. Already-frozen branches are
  // immutable and can be shared safely between snapshots.
  if (Array.isArray(value)) {
    return Object.freeze(value.map((child) => cloneAndFreeze(child))) as TValue;
  }

  const clone = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneAndFreeze(child)])) as TValue;
  return Object.freeze(clone);
}
