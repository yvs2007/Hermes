import type { ReactNode } from "react";

/**
 * Wrap the lede paragraph in `DropCap` to apply the broadsheet drop-cap
 * styling defined in globals.css. The first letter of the children is rendered
 * with the display serif at 76px.
 */
export function DropCap({ children }: { children: ReactNode }) {
  return <p className="drop-cap">{children}</p>;
}
