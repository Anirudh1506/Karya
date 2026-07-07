import type { KernelSnapshot } from "@karya/shell-adapter";
import { create } from "zustand";

interface ShellState {
  isReady: boolean;
  snapshot?: KernelSnapshot;
  setReady(isReady: boolean): void;
  setSnapshot(snapshot: KernelSnapshot): void;
}

export const useShellStore = create<ShellState>((set) => ({
  isReady: false,
  setReady: (isReady) => set({ isReady }),
  setSnapshot: (snapshot) => set({ snapshot }),
}));
