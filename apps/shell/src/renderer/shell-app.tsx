import type { ReactElement } from "react";

import { ShellScreen } from "./screens";

/**
 * Renderer entry point. Screen composition and behavior live under `screens/`;
 * this component only mounts the shell screen required by the application.
 */
export function ShellApp(): ReactElement {
  return <ShellScreen />;
}
